import type { Building, BuildingAssignment, BuildingDTO, User } from '../types';
import { useAuthStore } from '../auth';
import { hasAnyCanonicalRole } from '../roles';
import { delay, IS_DEV, mockData, USE_MOCK } from './config';
import { fetchJson } from './client';
import { createUserAccessAssignment, getRoleTemplates } from './users';
import { buildBuildingAddress, getArray, mapUser, resolveBuildingStatus } from './shared';

const BUILDING_ACCESS_ROLE_TEMPLATE_KEY_BY_TYPE = {
    BUILDING_ADMIN: 'building_admin',
    MANAGER: 'building_manager',
    STAFF: 'building_staff',
} as const;

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
                if (IS_DEV) {
                    console.warn('[API] Skipping org buildings for superadmin');
                }
                return [];
            }
            const res = await fetchJson('/org/buildings');
            const buildings = getArray(res);
            return buildings.map((b: any) => ({
                id: String(b.id ?? b.buildingId),
                name: b.name ?? 'Building',
                address: buildBuildingAddress(b),
                city: b.city,
                emirate: b.emirate,
                country: b.country,
                timezone: b.timezone,
                floors: b.floors,
                unitsCount: b.unitsCount ?? b.unintsCount,
                status: resolveBuildingStatus(b),
                stats: {
                    totalTenants: b.unitsCount || 0,
                    activeRequests: 0,
                    occupancyRate: 0
                }
            }));
        } catch (e) {
            console.warn("Fetch buildings failed", e);
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
            return buildings.map((b: any) => ({
                id: String(b.id ?? b.buildingId),
                name: b.name ?? 'Building',
                address: buildBuildingAddress(b),
                city: b.city,
                emirate: b.emirate,
                country: b.country,
                timezone: b.timezone,
                floors: b.floors,
                unitsCount: b.unitsCount ?? b.unintsCount,
                status: resolveBuildingStatus(b),
                stats: {
                    totalTenants: b.unitsCount || 0,
                    activeRequests: 0,
                    occupancyRate: 0
                }
            }));
        } catch (e) {
            console.warn("Fetch admin buildings failed", e);
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
            return buildings.map((b: any) => ({
                id: String(b.id ?? b.buildingId),
                name: b.name ?? 'Building',
                address: buildBuildingAddress(b),
                city: b.city,
                emirate: b.emirate,
                country: b.country,
                timezone: b.timezone,
                floors: b.floors,
                unitsCount: b.unitsCount ?? b.unintsCount,
                status: resolveBuildingStatus(b),
                stats: {
                    totalTenants: b.unitsCount || 0,
                    activeRequests: 0,
                    occupancyRate: 0
                }
            }));
        } catch (e) {
            console.warn("Fetch manager buildings failed", e);
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
            return {
                id: String(b.id ?? b.buildingId ?? id),
                name: b.name ?? 'Building',
                address: buildBuildingAddress(b),
                city: b.city,
                emirate: b.emirate,
                country: b.country,
                timezone: b.timezone,
                floors: b.floors,
                unitsCount: b.unitsCount ?? b.unintsCount,
                status: resolveBuildingStatus(b),
                stats: {
                    totalTenants: b.unitsCount || b.unintsCount || 0,
                    activeRequests: 0,
                    occupancyRate: 0
                }
            };
        } catch (e) {
            console.warn("Fetch building failed", e);
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
                timezone: data.timezone,
                floors: data.floors,
                unitsCount: data.unitsCount
            })
        });
        const b = res?.data || res;
        return {
            id: String(b.id ?? b.buildingId ?? ''),
            name: b.name ?? data.name,
            address: buildBuildingAddress(b) || buildBuildingAddress(data),
            city: b.city ?? data.city,
            emirate: b.emirate ?? data.emirate,
            country: b.country ?? data.country,
            timezone: b.timezone ?? data.timezone,
            floors: b.floors ?? data.floors,
            unitsCount: b.unitsCount ?? b.unintsCount ?? data.unitsCount,
            status: resolveBuildingStatus(b),
            stats: { totalTenants: 0, activeRequests: 0, occupancyRate: 0 }
        };
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
        floors: data.floors,
        unitsCount: data.unitsCount,
        status: 'active',
        stats: { totalTenants: 0, activeRequests: 0, occupancyRate: 0 }
    };
    mockData.buildings.push(newBuilding);
    return newBuilding;
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
