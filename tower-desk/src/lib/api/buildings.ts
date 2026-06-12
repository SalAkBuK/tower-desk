import type { Building, BuildingAssignment, BuildingDTO, UpdateBuildingPayload, User } from '../types';
import { useAuthStore } from '../auth';
import { hasAnyCanonicalRole } from '../roles';
import { delay, mockData, USE_MOCK } from './config';
import { fetchJson } from './client';
import { createUserAccessAssignment, getRoleTemplates } from './users';
import { buildBuildingAddress, getArray, mapUser, resolveBuildingStatus } from './shared';

const BUILDING_ACCESS_ROLE_TEMPLATE_KEY_BY_TYPE = {
    BUILDING_ADMIN: 'building_admin',
    MANAGER: 'building_manager',
    STAFF: 'building_staff',
} as const;

const omitUndefined = <T extends Record<string, unknown>>(value: T) =>
    Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));

const mapBuilding = (b: any, fallback?: Partial<Building>): Building => ({
    id: String(b?.id ?? b?.buildingId ?? fallback?.id ?? ''),
    name: b?.name ?? fallback?.name ?? 'Building',
    address: buildBuildingAddress(b) || fallback?.address,
    city: b?.city ?? fallback?.city,
    emirate: b?.emirate ?? fallback?.emirate,
    country: b?.country ?? fallback?.country,
    timezone: b?.timezone ?? fallback?.timezone,
    status: resolveBuildingStatus(b),
    stats: fallback?.stats ?? {
        totalTenants: 0,
        activeRequests: 0,
        occupancyRate: 0,
    },
});

async function createCanonicalBuildingAssignment(
    buildingId: string,
    userId: string,
    type: keyof typeof BUILDING_ACCESS_ROLE_TEMPLATE_KEY_BY_TYPE
) {
    const roleTemplateKey = BUILDING_ACCESS_ROLE_TEMPLATE_KEY_BY_TYPE[type];
    const roleTemplates = await getRoleTemplates();
    const roleTemplate = roleTemplates.find((entry) => entry.key === roleTemplateKey);

    if (!roleTemplate?.id) {
        throw new Error(`Role template '${roleTemplateKey}' not found.`);
    }

    return createUserAccessAssignment(userId, {
        roleTemplateId: roleTemplate.id,
        scopeType: 'BUILDING',
        scopeId: buildingId,
    });
}

export async function getBuildings(): Promise<Building[]> {
    if (!USE_MOCK) {
        try {
            const role = useAuthStore.getState().user?.baseRole ?? useAuthStore.getState().user?.role;
            if (role === 'superadmin') {
                return [];
            }
            const res = await fetchJson('/org/buildings');
            const buildings = getArray(res);
            return buildings.map((b: any) => mapBuilding(b));
        } catch {
            return [];
        }
    }
    await delay(800);
    return mockData.buildings;
}

export async function getBuildingsForAdmin(adminId: string): Promise<Building[]> {
    if (!USE_MOCK) {
        try {
            const role = useAuthStore.getState().user?.baseRole ?? useAuthStore.getState().user?.role;
            // Building-scoped admins should stay on the assigned-buildings endpoint.
            const endpoint = hasAnyCanonicalRole(role, ['admin', 'building_admin']) ? '/org/buildings/assigned' : '/org/buildings';
            const res = await fetchJson(endpoint);
            const buildings = getArray(res);
            return buildings.map((b: any) => mapBuilding(b));
        } catch {
            return [];
        }
    }
    await delay(800);
    return mockData.buildings;
}

export async function getBuildingsForManager(managerId: string): Promise<Building[]> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson('/org/buildings/assigned');
            const buildings = getArray(res);
            return buildings.map((b: any) => mapBuilding(b));
        } catch {
            return [];
        }
    }
    await delay(800);
    return mockData.buildings.slice(0, 1);
}

export async function getBuilding(id: string): Promise<Building | undefined> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson(`/org/buildings/${id}`);
            const b = res?.data || res;
            if (!b) return undefined;
            return mapBuilding(b, { id });
        } catch {
        }
    }
    const buildings = await getBuildings();
    return buildings.find((b) => b.id === id);
}

// --- Building Management Functions ---

export async function createBuilding(data: BuildingDTO): Promise<Building> {
    if (!USE_MOCK) {
        const res = await fetchJson('/org/buildings', {
            method: 'POST',
            body: JSON.stringify({
                name: data.name,
                city: data.city,
                emirate: data.emirate,
                country: data.country,
                timezone: data.timezone
            })
        });
        const b = res?.data || res;
        return mapBuilding(b, {
            name: data.name,
            address: buildBuildingAddress(data),
            city: data.city,
            emirate: data.emirate,
            country: data.country,
            timezone: data.timezone,
            stats: { totalTenants: 0, activeRequests: 0, occupancyRate: 0 },
        });
    }
    await delay(800);
    const newBuilding: Building = {
        id: 'b' + (mockData.buildings.length + 1),
        name: data.name,
        address: buildBuildingAddress(data),
        city: data.city,
        emirate: data.emirate,
        country: data.country,
        timezone: data.timezone,
        status: 'active',
        stats: { totalTenants: 0, activeRequests: 0, occupancyRate: 0 }
    };
    mockData.buildings.push(newBuilding);
    return newBuilding;
}

export async function updateBuilding(buildingId: string, data: UpdateBuildingPayload): Promise<Building> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}`, {
            method: 'PATCH',
            body: JSON.stringify(omitUndefined({
                name: data.name?.trim(),
                city: data.city?.trim(),
                emirate: Object.prototype.hasOwnProperty.call(data, 'emirate') ? data.emirate?.trim() || null : undefined,
                country: Object.prototype.hasOwnProperty.call(data, 'country') ? data.country?.trim().toUpperCase() || null : undefined,
                timezone: data.timezone?.trim(),
            })),
        });
        const b = res?.data || res;
        return mapBuilding(b, { id: buildingId });
    }

    await delay(800);
    const building = mockData.buildings.find((entry) => entry.id === buildingId);
    if (!building) throw new Error("Building not found");
    const nextBuilding = {
        ...building,
        ...omitUndefined({
            name: data.name?.trim(),
            city: data.city?.trim(),
            emirate: data.emirate?.trim(),
            country: data.country?.trim().toUpperCase(),
            timezone: data.timezone?.trim(),
        }),
    };
    Object.assign(building, nextBuilding);
    return building;
}

export async function deleteBuilding(buildingId: string): Promise<void> {
    if (!USE_MOCK) {
        await fetchJson(`/org/buildings/${buildingId}`, {
            method: 'DELETE',
        });
        return;
    }

    await delay(800);
    const index = mockData.buildings.findIndex((building) => building.id === buildingId);
    if (index >= 0) {
        mockData.buildings.splice(index, 1);
    }
}

export async function assignAdminToBuilding(buildingId: string, adminId: string): Promise<any> {
    if (!USE_MOCK) {
        return await createCanonicalBuildingAssignment(buildingId, adminId, 'BUILDING_ADMIN');
    }
    await delay(800);
    return { success: true };
}

export async function assignManagerToBuilding(buildingId: string, managerId: string): Promise<any> {
    if (!USE_MOCK) {
        return await createCanonicalBuildingAssignment(buildingId, managerId, 'MANAGER');
    }
    await delay(800);
    return { success: true };
}

export async function assignMaintenanceStaffToBuilding(buildingId: string, staffId: string): Promise<any> {
    if (!USE_MOCK) {
        return await createCanonicalBuildingAssignment(buildingId, staffId, 'STAFF');
    }
    await delay(800);
    return { success: true };
}

export async function removeAdminFromBuilding(buildingId: string, adminId: string): Promise<any> {
    if (!USE_MOCK) {
        return await fetchJson('/BuildingAdmin/remove', {
            method: 'DELETE',
            body: JSON.stringify({ buildingId: Number(buildingId), adminId: Number(adminId) })
        });
    }
    await delay(800);
    return { success: true };
}

export async function getBuildingAdmins(buildingId: string): Promise<User[]> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/BuildingAdmin/building/${buildingId}`);
        const data = getArray(res);
        return data.map((u: any) => mapUser(u, 'admin'));
    }
    await delay(800);
    return [];
}

export async function getBuildingAssignments(buildingId: string): Promise<BuildingAssignment[]> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/assignments`);
        const assignments = getArray(res);
        return assignments.map((assignment: any) => ({
            id: String(assignment.id ?? assignment.assignmentId ?? assignment.userId ?? ''),
            userId: assignment.userId ?? assignment.user?.id,
            type: assignment.type ?? assignment.assignmentType ?? assignment.role ?? 'STAFF',
            user: assignment.user
                ? {
                    id: String(assignment.user.id ?? assignment.user.userId ?? ''),
                    name: assignment.user.fullName ?? assignment.user.name,
                    email: assignment.user.email
                }
                : undefined
        }));
    }
    await delay(800);
    return [];
}

export async function createBuildingAssignment(buildingId: string, data: { userId: string; type: "MANAGER" | "STAFF" | "BUILDING_ADMIN" }): Promise<BuildingAssignment> {
    if (!USE_MOCK) {
        const assignment = await createCanonicalBuildingAssignment(buildingId, data.userId, data.type);
        return {
            id: String(assignment.assignmentId ?? data.userId),
            userId: data.userId,
            type: data.type,
        };
    }
    await delay(800);
    return { id: String(Date.now()), userId: data.userId, type: data.type };
}

export async function deleteBuildingAssignment(buildingId: string, assignmentId: string): Promise<{ success: boolean }> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/assignments/${assignmentId}`, {
            method: 'DELETE',
        });
        return res?.data ?? res ?? { success: true };
    }
    await delay(800);
    return { success: true };
}
