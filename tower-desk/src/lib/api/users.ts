import type { AdminDTO, BaseRole, PermissionDefinition, PermissionOverride, Role, RoleDefinition, User, UserEffectivePermissions } from '../types';
import { useAuthStore } from '../auth';
import { isOrganizationAdminRole } from '../roles';
import { delay, IS_DEV, mockData, USE_MOCK } from './config';
import { fetchJson } from './client';
import { ROLE_PRIORITY, getArray, isBaseRoleKey, mapAssignmentRole, mapRoleValue, mapUser, normalizeAssignmentUser, normalizeResidentUser, normalizeUser, resolveRole } from './shared';

let supportsEffectivePermissionsEndpoint = true;

export type ProvisionUserPayload = {
    identity: {
        email: string;
        name?: string;
        password?: string;
        sendInvite?: boolean;
    };
    grants?: {
        roleIds?: string[];
        roleKeys?: string[];
        orgRoleKeys?: string[];
        buildingAssignments?: Array<{
            buildingId: string;
            type: 'BUILDING_ADMIN' | 'MANAGER' | 'STAFF';
        }>;
        resident?: {
            buildingId: string;
            unitId?: string;
            mode: 'ADD' | 'MOVE' | 'MOVE_OUT';
        };
    };
    mode?: {
        ifEmailExists?: 'LINK' | 'ERROR';
        requireSameOrg?: boolean;
    };
};

export type ProvisionUserResponse = {
    user: Record<string, any>;
    created: boolean;
    linkedExisting: boolean;
    applied: {
        roleIds?: string[];
        roleKeys?: string[];
        orgRoleKeys?: string[];
        roles?: RoleDefinition[];
        buildingAssignments?: Array<Record<string, any>>;
        resident?: Record<string, any> | null;
    };
};

function normalizeRoleDefinitions(entries: unknown): RoleDefinition[] {
    if (!Array.isArray(entries)) return [];
    return entries.map((role: any) => ({
        id: String(role?.id ?? role?.roleId ?? role?._id ?? role?.key ?? role?.name ?? ''),
        key: String(role?.key ?? role?.name ?? role?.id ?? ''),
        name: role?.name ?? role?.displayName ?? role?.key ?? 'Role',
        description: role?.description ?? role?.desc ?? undefined,
        permissionKeys: role?.permissionKeys ?? role?.permissions ?? role?.perms ?? undefined
    })).filter((role) => role.id);
}

export async function getUsers(): Promise<User[]> {
    if (!USE_MOCK) {
        try {
            const role = useAuthStore.getState().user?.baseRole ?? useAuthStore.getState().user?.role;
            if (role && role !== 'superadmin') {
                if (IS_DEV) {
                    console.warn('[API] Skipping getUsers for non-superadmin role');
                }
                return [];
            }
            const [adminsRes, staffRes, managersRes, tenantsRes] = await Promise.all([
                fetchJson('/Admin/getall').catch(() => []),
                fetchJson('/MaintenanceStaff/getall').catch(() => []),
                fetchJson('/Manager/getall').catch(() => []),
                fetchJson('/Tenant/getall').catch(() => [])
            ]);

            const admins = getArray(adminsRes);
            const staff = getArray(staffRes);
            const managers = getArray(managersRes);
            const tenants = getArray(tenantsRes);

            return [
                ...admins.map((u: any) => mapUser(u, 'admin')),
                ...staff.map((u: any) => mapUser(u, 'employee')),
                ...managers.map((u: any) => mapUser(u, 'manager')),
                ...tenants.map((u: any) => mapUser(u, 'tenant'))
            ].sort((a, b) => Number(b.id) - Number(a.id));
        } catch (e) {
            console.warn("Falling back to mock users due to API error", e);
        }
    }
    await delay(800);
    return mockData.users;
}

export async function setUserPermissionOverrides(userId: string, overrides: PermissionOverride[]): Promise<{ success: boolean }> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/users/${userId}/permissions`, {
            method: 'POST',
            body: JSON.stringify({ overrides })
        });
        return res?.data ?? res ?? { success: true };
    }
    await delay(800);
    return { success: true };
}

export async function getUserPermissionOverrides(userId: string): Promise<PermissionOverride[]> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/users/${userId}/permissions`);
        const payload = res?.data ?? res ?? {};
        const overrides = payload.overrides ?? payload.permissions ?? payload.items ?? [];
        return Array.isArray(overrides) ? overrides : [];
    }
    await delay(800);
    return [];
}

export async function getEffectivePermissions(userIds: string[]): Promise<UserEffectivePermissions[]> {
    if (userIds.length === 0) return [];
    if (!supportsEffectivePermissionsEndpoint) return [];
    if (!USE_MOCK) {
        try {
            const res = await fetchJson('/users/effective-permissions', {
                method: 'POST',
                body: JSON.stringify({ userIds })
            }, { silentStatusCodes: [404] });
            const payload = res?.data ?? res ?? {};
            const users = payload.users ?? payload.items ?? payload ?? [];
            if (!Array.isArray(users)) return [];
            return users.map((entry: any) => ({
                userId: String(entry.userId ?? entry.id ?? ''),
                permissions: Array.isArray(entry.permissions) ? entry.permissions : []
            })).filter((entry) => entry.userId);
        } catch (error) {
            if (error instanceof Error && /not found/i.test(error.message)) {
                supportsEffectivePermissionsEndpoint = false;
                return [];
            }
            throw error;
        }
    }
    await delay(800);
    return [];
}

export async function getPermissions(): Promise<PermissionDefinition[]> {
    if (!USE_MOCK) {
        const res = await fetchJson('/permissions');
        const permissions = getArray(res);
        return permissions.map((permission: any) => ({
            key: String(permission.key ?? permission.permissionKey ?? permission.name ?? ''),
            name: permission.name ?? permission.displayName ?? undefined,
            description: permission.description ?? permission.desc ?? undefined
        })).filter((permission) => permission.key);
    }
    await delay(800);
    return [];
}

export async function getRoles(): Promise<RoleDefinition[]> {
    if (!USE_MOCK) {
        const res = await fetchJson('/roles');
        const roles = getArray(res);
        return roles.map((role: any) => ({
            id: String(role.id ?? role.roleId ?? role._id ?? role.key ?? role.name ?? ''),
            key: String(role.key ?? role.name ?? role.id ?? ''),
            name: role.name ?? role.displayName ?? role.key ?? 'Role',
            description: role.description ?? role.desc ?? undefined,
            permissionKeys: role.permissionKeys ?? role.permissions ?? role.perms ?? undefined
        }));
    }
    await delay(800);
    return [];
}

export async function getUserRoles(userId?: string | null): Promise<RoleDefinition[]> {
    if (!USE_MOCK) {
        const currentUserId = useAuthStore.getState().user?.id;
        const isSelf = userId && currentUserId && String(userId) === String(currentUserId);
        const endpoint = userId && !isSelf ? `/users/${userId}/roles` : '/users/me/roles';
        let res: any;
        try {
            res = await fetchJson(endpoint, undefined, userId && !isSelf ? { silentStatusCodes: [404] } : undefined);
        } catch (error) {
            if (userId && !isSelf && error instanceof Error && /not found/i.test(error.message)) {
                return [];
            }
            throw error;
        }
        const payload = res?.data ?? res ?? {};
        const roles = Array.isArray(payload?.roles) ? payload.roles : getArray(payload);
        return roles.map((role: any) => ({
            id: String(role.id ?? role.roleId ?? role._id ?? role.key ?? role.name ?? ''),
            key: String(role.key ?? role.name ?? role.id ?? ''),
            name: role.name ?? role.displayName ?? role.key ?? 'Role',
            description: role.description ?? role.desc ?? undefined,
            permissionKeys: role.permissionKeys ?? role.permissions ?? role.perms ?? undefined
        }));
    }
    await delay(800);
    return [];
}

export async function setUserRoles(userId: string, payload: { roleIds: string[]; mode?: 'replace' | 'add' }) {
    if (!USE_MOCK) {
        const res = await fetchJson(`/users/${userId}/roles`, {
            method: 'POST',
            body: JSON.stringify({ roleIds: payload.roleIds, mode: payload.mode ?? 'replace' })
        });
        return res?.data ?? res ?? { success: true };
    }
    await delay(800);
    return { success: true };
}

export async function provisionUser(payload: ProvisionUserPayload): Promise<ProvisionUserResponse> {
    if (!USE_MOCK) {
        const res = await fetchJson('/org/users/provision', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const response = res?.data ?? res ?? {};
        return {
            user: response?.user ?? response?.data?.user ?? response?.identity ?? response ?? {},
            created: Boolean(response?.created ?? response?.data?.created),
            linkedExisting: Boolean(response?.linkedExisting ?? response?.data?.linkedExisting),
            applied: response?.applied ?? response?.data?.applied ?? {},
        };
    }

    await delay(800);
    return {
        user: {
            id: `u${mockData.users.length + 1}${Math.random()}`,
            email: payload.identity.email,
            name: payload.identity.name,
            role: payload.grants?.buildingAssignments?.some((assignment) => assignment.type === 'BUILDING_ADMIN')
                ? 'building_admin'
                : payload.grants?.resident
                    ? 'tenant'
                    : payload.grants?.buildingAssignments?.[0]?.type === 'STAFF'
                        ? 'employee'
                        : 'manager',
            baseRole: payload.grants?.buildingAssignments?.some((assignment) => assignment.type === 'BUILDING_ADMIN')
                ? 'building_admin'
                : payload.grants?.resident
                    ? 'tenant'
                    : payload.grants?.buildingAssignments?.[0]?.type === 'STAFF'
                        ? 'employee'
                        : 'manager',
            roleIds: payload.grants?.roleIds ?? [],
            roleKeys: payload.grants?.roleKeys ?? [],
            effectivePermissions: [],
            buildingAssignments: payload.grants?.buildingAssignments ?? [],
            resident: payload.grants?.resident ?? null,
        },
        created: true,
        linkedExisting: false,
        applied: {
            roleIds: payload.grants?.roleIds ?? [],
            roleKeys: payload.grants?.roleKeys ?? [],
            orgRoleKeys: payload.grants?.orgRoleKeys ?? [],
            roles: [],
            buildingAssignments: payload.grants?.buildingAssignments ?? [],
            resident: payload.grants?.resident ?? null,
        }
    };
}

export async function createRole(payload: { key: string; name: string; description?: string }): Promise<RoleDefinition> {
    if (!USE_MOCK) {
        const res = await fetchJson('/roles', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const role = res?.data ?? res ?? payload;
        return {
            id: String(role.id ?? role.roleId ?? role._id ?? role.key ?? payload.key),
            key: String(role.key ?? payload.key),
            name: role.name ?? payload.name,
            description: role.description ?? payload.description,
            permissionKeys: role.permissionKeys ?? role.permissions ?? role.perms ?? undefined
        };
    }
    await delay(800);
    return {
        id: payload.key,
        key: payload.key,
        name: payload.name,
        description: payload.description,
        permissionKeys: []
    };
}

export async function setRolePermissions(
    roleId: string,
    permissionKeys: string[],
    mode: 'add' | 'replace' = 'add'
): Promise<{ success: boolean }> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/roles/${roleId}/permissions`, {
            method: 'POST',
            body: JSON.stringify({ permissionKeys, mode })
        });
        return res?.data ?? res ?? { success: true };
    }
    await delay(800);
    return { success: true };
}

export async function getUsersForAdminBuildings(buildingIds: string[]): Promise<User[]> {
    if (buildingIds.length === 0) return [];
    if (!USE_MOCK) {
        try {
            let orgUsers: any[] = [];
            const role = useAuthStore.getState().user?.baseRole ?? useAuthStore.getState().user?.role;
            const shouldLoadOrgUsers = role === 'superadmin' || isOrganizationAdminRole(role);
            if (shouldLoadOrgUsers) {
                try {
                    const orgUsersRes = await fetchJson('/org/users');
                    orgUsers = getArray(orgUsersRes);
                } catch (err) {
                    if (IS_DEV) {
                        console.warn('[API] Failed to load /org/users, falling back to assignments/residents.', err);
                    }
                    orgUsers = [];
                }
            }

            const results = await Promise.all(buildingIds.map(async (buildingId) => {
                const [assignmentsRes, residentsRes] = await Promise.all([
                    fetchJson(`/org/buildings/${buildingId}/assignments`).catch(() => []),
                    fetchJson(`/org/buildings/${buildingId}/residents`).catch(() => [])
                ]);
                return {
                    buildingId,
                    assignments: getArray(assignmentsRes),
                    residents: getArray(residentsRes)
                };
            }));

            const roleMap = new Map<string, { roles: Set<BaseRole>; buildingIds: Set<string> }>();
            const assignmentUsers = new Map<string, User>();
            const remember = (userId: string, role: BaseRole, buildingId: string) => {
                const key = String(userId);
                const entry = roleMap.get(key) ?? { roles: new Set<BaseRole>(), buildingIds: new Set<string>() };
                entry.roles.add(role);
                if (buildingId) entry.buildingIds.add(String(buildingId));
                roleMap.set(key, entry);
            };

            results.forEach(({ buildingId, assignments, residents }) => {
                assignments.forEach((assignment: any) => {
                    const role = mapAssignmentRole(assignment?.type ?? assignment?.assignmentType ?? assignment?.role);
                    if (!role) return;
                    const userId = assignment?.userId ?? assignment?.user?.id ?? assignment?.id;
                    if (userId) {
                        remember(userId, role, String(buildingId));
                    }
                    const normalized = normalizeAssignmentUser(assignment, role, String(buildingId));
                    assignmentUsers.set(String(normalized.id), normalized);
                });
                residents.forEach((resident: any) => {
                    const userId = resident?.userId ?? resident?.user?.id ?? resident?.id;
                    if (userId) {
                        remember(userId, 'tenant', String(buildingId));
                    }
                    const normalized = normalizeResidentUser(resident, String(buildingId));
                    assignmentUsers.set(String(normalized.id), normalized);
                });
            });

            const pickRole = (roles: Set<BaseRole>, fallback: BaseRole): BaseRole => {
                for (const role of ROLE_PRIORITY) {
                    if (roles.has(role)) return role;
                }
                return fallback;
            };

            if (orgUsers.length === 0) {
                return Array.from(assignmentUsers.values());
            }

            const users = orgUsers.map((user: any) => {
                const id = String(user.id ?? user.userId ?? '');
                const nameFromParts = [user.firstName, user.lastName].filter(Boolean).join(' ');
                const fullName = user.name ?? user.fullName ?? nameFromParts;
                const displayName = fullName || user.email?.split('@')[0] || 'User';
                const baseRole = resolveRole(user, { orgId: user.orgId ?? null });
                const orgRoleKeys = user.orgRoleKeys ?? user.roleKeys ?? [];
                const roleKeys = user.roleKeys ?? [];
                const assignedRoles = normalizeRoleDefinitions(user.assignedRoles ?? user.roles);
                const info = roleMap.get(id);
                const baseRoleResolved = info ? pickRole(info.roles, baseRole) : baseRole;
                const displayRole = String(orgRoleKeys?.[0] ?? roleKeys?.[0] ?? baseRoleResolved);
                const buildingIds = info ? Array.from(info.buildingIds) : [];
                return {
                    id,
                    name: displayName,
                    email: user.email ?? '',
                    role: displayRole,
                    baseRole: baseRoleResolved,
                    buildingIds,
                    orgId: user.orgId ?? null,
                    orgRoleKeys,
                    roleKeys,
                    assignedRoles,
                    fullName,
                    phoneNumber: user.phone ?? user.phoneNumber,
                    address: user.address,
                    nationality: user.nationality,
                    avatarUrl: user.avatarUrl ?? user.avatar
                } as User;
            });

            const knownIds = new Set(users.map((user) => user.id));
            assignmentUsers.forEach((user, id) => {
                if (!knownIds.has(id)) {
                    users.push(user);
                }
            });

            return users;
        } catch (e) {
            console.warn("Fetch admin-scoped users failed", e);
        }
    }
    await delay(800);
    return mockData.users;
}

// --- Admin APIs (Keep these for Admin specific actions) ---

// --- Generic Create User for all roles ---

export async function createUser(
    role: Role,
    data: AdminDTO & { buildingIds?: string[]; roleIds?: string[]; assignmentType?: BaseRole }
): Promise<User> {
    const roleKey = String(role ?? '').trim();
    const isBaseRole = roleKey ? isBaseRoleKey(roleKey) : false;
    const baseRole: BaseRole = isBaseRole ? (roleKey as BaseRole) : (data.assignmentType ?? 'manager');
    const normalizedRoleKey = roleKey || baseRole;

    if (baseRole === 'superadmin' || baseRole === 'service_provider') {
        throw new Error(`Creation not supported for role: ${baseRole}`);
    }

    const buildingId = data.buildingId !== undefined && data.buildingId !== null ? String(data.buildingId) : undefined;
    const buildingIds = (data.buildingIds ?? []).map((id) => String(id)).filter(Boolean);
    if (baseRole === 'admin' && buildingId && buildingIds.length === 0) {
        buildingIds.push(buildingId);
    }
    if (!data.email) {
        throw new Error('Email is required.');
    }
    if ((baseRole === 'manager' || baseRole === 'employee') && !buildingId) {
        throw new Error('Building assignment is required.');
    }
    if (baseRole === 'admin' && buildingIds.length === 0) {
        throw new Error('Building assignment is required.');
    }
    if (baseRole === 'tenant' && (!buildingId || !data.unitId)) {
        throw new Error('Unit assignment is required.');
    }
    const identity: Record<string, any> = {
        email: data.email,
        name: data.fullName,
    };

    if (data.password && data.password.trim()) {
        identity.password = data.password;
    } else {
        identity.sendInvite = true;
    }

    const grants: Record<string, any> = {};
    if (baseRole === 'admin' && buildingIds.length > 0) {
        grants.buildingAssignments = buildingIds.map((id) => ({
            buildingId: id,
            type: 'BUILDING_ADMIN'
        }));
    } else if ((baseRole === 'manager' || baseRole === 'employee') && buildingId) {
        grants.buildingAssignments = [
            {
                buildingId,
                type: baseRole === 'manager' ? 'MANAGER' : 'STAFF'
            }
        ];
    }
    if (baseRole === 'tenant' && buildingId && data.unitId) {
        grants.resident = {
            buildingId,
            unitId: data.unitId,
            mode: 'ADD'
        };
    }

    const roleIds = Array.from(new Set((data.roleIds ?? []).map((id) => String(id).trim()).filter(Boolean)));
    if (roleIds.length > 0) {
        grants.roleIds = roleIds;
    }

    const payload: ProvisionUserPayload = Object.keys(grants).length > 0 ? { identity, grants } : { identity };

    if (!USE_MOCK) {
        try {
            if (IS_DEV) {
                console.log(`[API] Provisioning ${baseRole} via /org/users/provision`);
                console.log('[API] Provision payload', payload);
            }
            const response = await provisionUser(payload);
            const userData = response.user ?? {};
            const applied = response.applied ?? {};
            const assignedBuildingIds = new Set<string>();
            const assignments = Array.isArray(userData?.buildingAssignments)
                ? userData.buildingAssignments
                : (Array.isArray(applied?.buildingAssignments) ? applied.buildingAssignments : []);
            assignments.forEach((assignment: any) => {
                const assignedId = assignment?.buildingId ?? assignment?.building?.id;
                if (assignedId) assignedBuildingIds.add(String(assignedId));
            });
            const resident = userData?.resident ?? applied?.resident;
            const residentBuildingId = resident?.buildingId ?? resident?.building?.id;
            if (residentBuildingId) assignedBuildingIds.add(String(residentBuildingId));
            if (baseRole === 'admin' && assignedBuildingIds.size === 0 && buildingIds.length > 0) {
                buildingIds.forEach((id) => assignedBuildingIds.add(id));
            }
            if (buildingId && assignedBuildingIds.size === 0 && baseRole !== 'admin') {
                assignedBuildingIds.add(buildingId);
            }
            const resolvedBaseRole = resolveRole(userData, {
                baseRole: userData?.baseRole,
                role: userData?.role,
                roleKeys: userData?.roleKeys ?? applied?.roleKeys,
                orgRoleKeys: userData?.orgRoleKeys ?? applied?.orgRoleKeys,
                buildingAssignments: assignments,
                resident,
            });
            const normalized = normalizeUser(userData, resolvedBaseRole);
            const roleKeys = Array.isArray(userData?.roleKeys)
                ? userData.roleKeys.map((entry: unknown) => String(entry)).filter(Boolean)
                : (Array.isArray(applied?.roleKeys) ? applied.roleKeys.map((entry: unknown) => String(entry)).filter(Boolean) : []);
            const orgRoleKeys = Array.isArray(userData?.orgRoleKeys)
                ? userData.orgRoleKeys.map((entry: unknown) => String(entry)).filter(Boolean)
                : (Array.isArray(applied?.orgRoleKeys) ? applied.orgRoleKeys.map((entry: unknown) => String(entry)).filter(Boolean) : []);
            const effectivePermissions = Array.isArray(userData?.effectivePermissions)
                ? userData.effectivePermissions.map((entry: unknown) => String(entry)).filter(Boolean)
                : [];
            const assignedRoles = normalizeRoleDefinitions(userData?.assignedRoles ?? applied?.roles);
            const displayRole = String(userData?.role ?? userData?.baseRole ?? normalized.role ?? resolvedBaseRole);
            return {
                ...normalized,
                id: String(userData?.id ?? userData?.userId ?? normalized.id ?? Math.random()),
                name: normalized.name || data.fullName,
                email: normalized.email || data.email || '',
                role: displayRole,
                baseRole: resolvedBaseRole,
                buildingIds: Array.from(assignedBuildingIds),
                orgId: userData?.orgId ?? normalized.orgId ?? null,
                orgRoleKeys,
                roleKeys,
                assignedRoles,
                effectivePermissions,
                fullName: userData?.fullName ?? data.fullName,
                phoneNumber: userData?.phoneNumber ?? data.phoneNumber,
                address: userData?.address ?? data.address,
                nationality: userData?.nationality ?? data.nationality
            };
        } catch (e) {
            console.error(`[API] Failed to provision ${baseRole}`, e);
            throw e;
        }
    }

    await delay(800);
    const newUser: User = {
        id: 'u' + (mockData.users.length + 1) + Math.random(),
        name: data.fullName,
        email: data.email || `new.${normalizedRoleKey}@test.com`,
        role: normalizedRoleKey ?? baseRole,
        baseRole,
        buildingIds: baseRole === 'admin' && buildingIds.length > 0 ? buildingIds : (buildingId ? [buildingId] : []),
        roleKeys: [],
        orgRoleKeys: [],
        fullName: data.fullName,
        phoneNumber: data.phoneNumber,
        address: data.address,
        nationality: data.nationality
    };
    mockData.users.push(newUser);
    return newUser;
}

export async function createAdmin(data: AdminDTO): Promise<User> {
    return createUser('admin', data);
}

export async function updateAdmin(id: string, data: Partial<AdminDTO>): Promise<User> {
    if (!USE_MOCK) {
        await fetchJson(`/Admin/update/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        return {
            id,
            name: data.fullName || 'Updated',
            email: 'updated@test.com',
            role: 'admin',
            baseRole: 'admin',
            buildingIds: [],
            ...data
        } as User;
    }

    await delay(800);
    const userIndex = mockData.users.findIndex(u => u.id === id);
    if (userIndex === -1) throw new Error('User not found');

    const updatedUser = { ...mockData.users[userIndex], ...data, name: data.fullName || mockData.users[userIndex].name };
    mockData.users[userIndex] = updatedUser;
    return updatedUser;
}

export async function deleteAdmin(id: string): Promise<void> {
    if (!USE_MOCK) {
        await fetchJson(`/Admin/delete/${id}`, { method: 'DELETE' });
        return;
    }
    await delay(800);
    mockData.users = mockData.users.filter(u => u.id !== id);
}

export async function deleteUser(role: Role, id: string, buildingIds: string[] = []): Promise<void> {
    const baseRole = isBaseRoleKey(String(role)) ? (role as BaseRole) : (mapRoleValue(String(role)) ?? 'manager');
    if (baseRole === 'tenant') {
        if (!USE_MOCK) {
            await fetchJson(`/Tenant/delete/${id}`, { method: 'DELETE' });
            return;
        }
        await delay(800);
        mockData.users = mockData.users.filter(u => u.id !== id || u.role !== role);
        return;
    }

    if (baseRole === 'manager' || baseRole === 'employee') {
        if (buildingIds.length === 0) {
            throw new Error('Building assignment is required to remove this user.');
        }
        if (!USE_MOCK) {
            await Promise.all(buildingIds.map((buildingId) => {
                const endpoint = baseRole === 'manager' ? '/BuildingManager/remove' : '/BuildingMaintenanceStaff/remove';
                const payload = baseRole === 'manager'
                    ? { buildingId: Number(buildingId), managerId: Number(id) }
                    : { buildingId: Number(buildingId), staffId: Number(id) };
                return fetchJson(endpoint, {
                    method: 'DELETE',
                    body: JSON.stringify(payload)
                });
            }));
            return;
        }
        await delay(800);
        mockData.users = mockData.users.filter(u => u.id !== id || u.role !== role);
        return;
    }

    throw new Error(`Deletion not supported for role: ${role}`);
}
