import type { Building, BuildingAssignment, BuildingDTO, User } from '../types';
import { useAuthStore } from '../auth';
import { hasAnyCanonicalRole } from '../roles';
import { delay, IS_DEV, mockData, USE_MOCK } from './config';
import { fetchJson } from './client';
import { buildBuildingAddress, getArray, mapAssignmentRole, mapUser, normalizeAssignmentUser, resolveBuildingStatus } from './shared';

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

export async function assignAdminToBuilding(buildingId: string, adminId: string): Promise<any> {
    if (!USE_MOCK) {
        return await fetchJson(`/org/buildings/${buildingId}/assignments`, {
            method: 'POST',
            body: JSON.stringify({ userId: adminId, type: "BUILDING_ADMIN" })
        });
    }
    await delay(800);
    return { success: true };
}

export async function assignManagerToBuilding(buildingId: string, managerId: string): Promise<any> {
    if (!USE_MOCK) {
        return await fetchJson(`/org/buildings/${buildingId}/assignments`, {
            method: 'POST',
            body: JSON.stringify({ userId: managerId, type: "MANAGER" })
        });
    }
    await delay(800);
    return { success: true };
}

export async function assignMaintenanceStaffToBuilding(buildingId: string, staffId: string): Promise<any> {
    if (!USE_MOCK) {
        return await fetchJson(`/org/buildings/${buildingId}/assignments`, {
            method: 'POST',
            body: JSON.stringify({ userId: staffId, type: "STAFF" })
        });
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
        const res = await fetchJson(`/org/buildings/${buildingId}/assignments`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        const assignment = res?.data ?? res;
        return {
            id: String(assignment.id ?? assignment.assignmentId ?? data.userId),
            userId: assignment.userId ?? data.userId,
            type: assignment.type ?? assignment.assignmentType ?? data.type,
            user: assignment.user
                ? {
                    id: String(assignment.user.id ?? assignment.user.userId ?? ''),
                    name: assignment.user.fullName ?? assignment.user.name,
                    email: assignment.user.email
                }
                : undefined
        };
    }
    await delay(800);
    return { id: String(Date.now()), userId: data.userId, type: data.type };
}
