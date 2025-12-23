import { Building, RequestStatus, RequestPriority, ServiceRequest, User, Role, AdminDTO, BuildingDTO } from './types';
import { useAuthStore } from './auth';

const DELAY_MS = 800;
const API_BASE_URL = '/api/proxy';
const IS_DEV = process.env.NODE_ENV !== 'production';

// Toggle this to false to try connecting to real API
const USE_MOCK = false;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --- Mock Data ---

const MOCK_BUILDINGS: Building[] = [
    { id: 'b1', name: 'Tower One', address: '100 Main St, New York, NY', status: 'active', stats: { totalTenants: 120, activeRequests: 5, occupancyRate: 0.95 } },
    { id: 'b2', name: 'Skyline Heights', address: '200 High Ave, San Francisco, CA', status: 'active', stats: { totalTenants: 85, activeRequests: 12, occupancyRate: 0.88 } },
    { id: 'b3', name: 'The Vertex', address: '300 Peak Rd, Austin, TX', status: 'maintenance', stats: { totalTenants: 40, activeRequests: 2, occupancyRate: 0.60 } },
    { id: 'b4', name: 'Oceanview Plaza', address: '400 Shore Blvd, Miami, FL', status: 'active', stats: { totalTenants: 200, activeRequests: 8, occupancyRate: 0.98 } },
];

// Initial Mock Users
let MOCK_USERS: User[] = [
    { id: 'u1', name: 'Alice Super', email: 'alice@towerdesk.com', role: 'superadmin', buildingIds: [], fullName: 'Alice Superadmin', phoneNumber: '1234567890', address: 'Admin HQ', nationality: 'US' },
    { id: 'u2', name: 'Bob Admin', email: 'bob@towerdesk.com', role: 'admin', buildingIds: ['b1', 'b2'], fullName: 'Bob Administrator', phoneNumber: '0987654321', address: 'Site B', nationality: 'CA' },
    { id: 'u3', name: 'Charlie Manager', email: 'charlie@towerdesk.com', role: 'manager', buildingIds: ['b1'], fullName: 'Charlie Manager', phoneNumber: '5551234567', address: 'Site A', nationality: 'US' },
    { id: 'u4', name: 'David Tenant', email: 'david@tenant.com', role: 'tenant', buildingIds: ['b1'], fullName: 'David Tenant', phoneNumber: '5559876543', address: 'Unit 101', nationality: 'US' },
    { id: 'u5', name: 'Eve Employee', email: 'eve@maintenance.com', role: 'employee', buildingIds: ['b1', 'b2', 'b3', 'b4'], fullName: 'Eve Fixit', phoneNumber: '5556667777', address: 'Service HQ', nationality: 'MX' },
    { id: 'u6', name: 'Frank Admin', email: 'frank@towerdesk.com', role: 'admin', buildingIds: ['b3', 'b4'], fullName: 'Frank Admin', phoneNumber: '5554443333', address: 'Site C', nationality: 'US' },
];

const MOCK_REQUESTS: ServiceRequest[] = [
    {
        id: 'r1',
        title: 'Leaking Faucet in 101',
        description: 'The kitchen faucet is dripping constantly.',
        status: 'pending',
        priority: 'medium',
        buildingId: 'b1',
        createdByTenantId: 'u4',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
    {
        id: 'r2',
        title: 'AC Not Working',
        description: 'Unit 305 is extremely hot, AC blowing warm air.',
        priority: 'high',
        buildingId: 'b1',
        createdByTenantId: 'u4',
        assignedEmployeeId: 'u5',
        status: 'in-progress',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    },
    {
        id: 'r3',
        title: 'Elevator Noise',
        description: 'Strange grinding noise in service elevator.',
        status: 'assigned',
        priority: 'urgent',
        buildingId: 'b2',
        createdByTenantId: 'u2', // Admin created
        assignedEmployeeId: 'u5',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(),
    }
];

// --- Helpers ---

async function fetchJson(endpoint: string, options?: RequestInit) {
    if (USE_MOCK) return null;
    try {
        if (IS_DEV) {
            console.log(`[API] Fetching: ${API_BASE_URL}${endpoint}`);
        }
        const token = useAuthStore.getState().token;
        const shouldAttachAuth = Boolean(token) && !endpoint.startsWith('/Auth/login');
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'accept': '*/*',
                ...(shouldAttachAuth ? { Authorization: `Bearer ${token}` } : {}),
                ...options?.headers,
            },
        });
        if (IS_DEV) {
            console.log(`[API] Status: ${res.status}`);
        }
        if (!res.ok) {
            let errorBody = '';
            try {
                errorBody = await res.text();
            } catch {
                errorBody = '';
            }
            if (IS_DEV) {
                console.error(`API Error: ${res.status} ${res.statusText}`);
                if (errorBody) {
                    console.error(`[API] Error Body:`, errorBody);
                }
            }
            let errorMessage = `API Error: ${res.status}`;
            if (errorBody) {
                try {
                    const parsed = JSON.parse(errorBody);
                    errorMessage = parsed?.message || errorBody;
                } catch {
                    errorMessage = errorBody;
                }
            }
            throw new Error(errorMessage);
        }
        const data = await res.json();
        if (IS_DEV) {
            console.log(`[API] Data received for ${endpoint}`);
        }
        return data;
    } catch (e) {
        console.error("[API] Fetch failed", e);
        throw e;
    }
}

// --- API Functions ---

// Helper to unwrap API response
function getArray(res: any): any[] {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (res.data && Array.isArray(res.data)) return res.data;
    return [];
}

function mapRequestStatus(value: any): RequestStatus {
    if (typeof value === 'number') {
        const statusMap: Record<number, RequestStatus> = {
            1: 'pending',
            2: 'assigned',
            3: 'in-progress',
            4: 'on-hold',
            5: 'completed',
            6: 'cancelled'
        };
        return statusMap[value] || 'pending';
    }
    const normalized = String(value || '').toLowerCase().replace(/[\s-_]/g, '');
    if (normalized === 'new') return 'pending';
    if (normalized === 'assigned') return 'assigned';
    if (normalized === 'inprogress') return 'in-progress';
    if (normalized === 'onhold') return 'on-hold';
    if (normalized === 'completed') return 'completed';
    if (normalized === 'cancelled') return 'cancelled';
    return 'pending';
}

function mapRequestStatusToApi(status: RequestStatus): number {
    const statusMap: Record<RequestStatus, number> = {
        pending: 1,
        assigned: 2,
        'in-progress': 3,
        'on-hold': 4,
        completed: 5,
        cancelled: 6
    };
    return statusMap[status] || 1;
}

function mapRequestPriority(value: any): RequestPriority {
    if (typeof value === 'number') {
        const priorityMap: Record<number, RequestPriority> = {
            1: 'low',
            2: 'medium',
            3: 'high',
            4: 'urgent'
        };
        return priorityMap[value] || 'medium';
    }
    const normalized = String(value || 'medium').toLowerCase();
    if (normalized === 'urgent') return 'urgent';
    return normalized as RequestPriority;
}

function normalizeUser(u: any, role: Role, buildingId?: string): User {
    return {
        id: String(u.id || Math.random()),
        name: u.fullName || u.name || 'Unknown',
        email: u.email || '',
        role,
        buildingIds: buildingId ? [buildingId] : [],
        fullName: u.fullName,
        phoneNumber: u.phoneNumber,
        address: u.address,
        nationality: u.nationality
    };
}

export async function getBuildings(): Promise<Building[]> {
    if (!USE_MOCK) {
        try {
            const role = useAuthStore.getState().user?.role;
            if (role && role !== 'superadmin') {
                if (IS_DEV) {
                    console.warn('[API] Skipping getBuildings for non-superadmin role');
                }
                return [];
            }
            const res = await fetchJson('/Buildings/getall');
            const buildings = getArray(res);
            return buildings.map((b: any) => ({
                id: String(b.id),
                name: b.name,
                address: b.address,
                city: b.city,
                unitsCount: b.unintsCount, // Note: API typo 'unintsCount' check
                status: b.isActive ? 'active' : 'inactive', // Map boolean to status
                stats: {
                    totalTenants: b.unitsCount || 0, // Placeholder
                    activeRequests: 0,
                    occupancyRate: 0
                }
            }));
        } catch (e) { console.warn("Fetch buildings failed", e); }
    }
    await delay(DELAY_MS);
    return MOCK_BUILDINGS;
}

export async function getBuildingsForAdmin(adminId: string): Promise<Building[]> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson(`/BuildingAdmin/admin/${adminId}`);
            const buildings = getArray(res);
            return buildings.map((b: any) => {
                const source = b?.building || b;
                return ({
                    id: String(source.id ?? b.id),
                    name: source.name,
                    address: source.address,
                    city: source.city,
                    unitsCount: source.unintsCount ?? source.unitsCount,
                    status: source.isActive ? 'active' : 'inactive',
                    stats: {
                        totalTenants: source.unitsCount || source.unintsCount || 0,
                        activeRequests: 0,
                        occupancyRate: 0
                    }
                });
            });
        } catch (e) {
            console.warn("Fetch admin buildings failed", e);
        }
    }
    await delay(DELAY_MS);
    return MOCK_BUILDINGS;
}

export async function getBuildingsForManager(managerId: string): Promise<Building[]> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson(`/BuildingManager/manager/${managerId}`);
            const buildings = getArray(res);
            return buildings.map((b: any) => {
                const source = b?.building || b;
                return ({
                    id: String(source.id ?? b.id),
                    name: source.name,
                    address: source.address,
                    city: source.city,
                    unitsCount: source.unintsCount ?? source.unitsCount,
                    status: source.isActive ? 'active' : 'inactive',
                    stats: {
                        totalTenants: source.unitsCount || source.unintsCount || 0,
                        activeRequests: 0,
                        occupancyRate: 0
                    }
                });
            });
        } catch (e) {
            console.warn("Fetch manager buildings failed", e);
        }
    }
    await delay(DELAY_MS);
    return MOCK_BUILDINGS.slice(0, 1);
}

export async function getBuilding(id: string): Promise<Building | undefined> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson(`/Buildings/get/${id}`);
            const b = res?.data || res;
            if (!b) return undefined;
            return {
                id: String(b.id),
                name: b.name,
                address: b.address,
                city: b.city,
                unitsCount: b.unintsCount ?? b.unitsCount,
                status: b.isActive ? 'active' : 'inactive',
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


// Helper to map API user data to our User type
const mapUser = (u: any, role: Role): User => normalizeUser(u, role);

// Consolidated getUsers fetching from all user endpoints
export async function getUsers(): Promise<User[]> {
    if (!USE_MOCK) {
        try {
            const role = useAuthStore.getState().user?.role;
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
    await delay(DELAY_MS);
    return MOCK_USERS;
}

export async function getUsersForAdminBuildings(buildingIds: string[]): Promise<User[]> {
    if (buildingIds.length === 0) return [];
    if (!USE_MOCK) {
        try {
            const results = await Promise.all(buildingIds.map(async (buildingId) => {
                const [managersRes, staffRes, tenantsRes] = await Promise.all([
                    fetchJson(`/BuildingManager/building/${buildingId}`).catch(() => []),
                    fetchJson(`/BuildingMaintenanceStaff/building/${buildingId}`).catch(() => []),
                    fetchJson(`/Tenant/getall-by-building/${buildingId}`).catch(() => [])
                ]);
                return {
                    buildingId,
                    managers: getArray(managersRes),
                    staff: getArray(staffRes),
                    tenants: getArray(tenantsRes)
                };
            }));

            const merged = new Map<string, User>();
            const upsert = (user: User) => {
                const key = `${user.role}:${user.id}`;
                const existing = merged.get(key);
                if (existing) {
                    for (const bid of user.buildingIds) {
                        if (!existing.buildingIds.includes(bid)) {
                            existing.buildingIds.push(bid);
                        }
                    }
                    return;
                }
                merged.set(key, user);
            };

            results.forEach(({ buildingId, managers, staff, tenants }) => {
                managers.forEach((u: any) => upsert(normalizeUser(u, 'manager', String(buildingId))));
                staff.forEach((u: any) => upsert(normalizeUser(u, 'employee', String(buildingId))));
                tenants.forEach((u: any) => upsert(normalizeUser(u, 'tenant', String(buildingId))));
            });

            return Array.from(merged.values()).sort((a, b) => Number(b.id) - Number(a.id));
        } catch (e) {
            console.warn("Fetch admin-scoped users failed", e);
        }
    }
    await delay(DELAY_MS);
    return MOCK_USERS;
}

export async function getRequests(buildingId?: string): Promise<ServiceRequest[]> {
    if (!USE_MOCK) {
        try {
            const role = useAuthStore.getState().user?.role;
            if (!buildingId && role && role !== 'superadmin') {
                if (IS_DEV) {
                    console.warn('[API] Skipping getRequests(all) for non-superadmin role');
                }
                return [];
            }
            const res = await fetchJson(buildingId ? `/MaintenanceRequest/building/${buildingId}` : '/MaintenanceRequest/all');
            const data = getArray(res);
            return data.map((r: any) => ({
                id: String(r.id),
                title: r.title || 'Service Request',
                description: r.description || '',
                status: mapRequestStatus(r.status),
                priority: mapRequestPriority(r.priority),
                buildingId: String(r.buildingId || buildingId || ''),
                createdByTenantId: String(r.tenantId || ''),
                createdAt: r.createdAt || new Date().toISOString(),
                updatedAt: r.updatedAt || new Date().toISOString()
            }));
        } catch (e) { console.warn("Fetch requests failed", e) }
    }

    await delay(DELAY_MS);
    if (buildingId) {
        return MOCK_REQUESTS.filter((r) => r.buildingId === buildingId);
    }
    return MOCK_REQUESTS;
}

export async function getRequestsForBuildings(buildingIds: string[]): Promise<ServiceRequest[]> {
    if (buildingIds.length === 0) return [];
    if (!USE_MOCK) {
        try {
            const responses = await Promise.all(
                buildingIds.map(async (id) => {
                    const res = await fetchJson(`/MaintenanceRequest/building/${id}`).catch(() => []);
                    return { id, data: getArray(res) };
                })
            );
            return responses.flatMap(({ id, data }) =>
                data.map((r: any) => ({
                    id: String(r.id),
                    title: r.title || 'Service Request',
                    description: r.description || '',
                    status: mapRequestStatus(r.status),
                    priority: mapRequestPriority(r.priority),
                    buildingId: String(r.buildingId || id),
                    createdByTenantId: String(r.tenantId || ''),
                    createdAt: r.createdAt || new Date().toISOString(),
                    updatedAt: r.updatedAt || new Date().toISOString()
                }))
            );
        } catch (e) {
            console.warn("Fetch admin requests failed", e);
        }
    }
    await delay(DELAY_MS);
    return MOCK_REQUESTS.filter((req) => buildingIds.includes(req.buildingId));
}

export async function getRequest(id: string): Promise<ServiceRequest | undefined> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson(`/MaintenanceRequest/get/${id}`);
            const data = res?.data || res;
            if (!data) return undefined;
            return {
                id: String(data.id),
                title: data.title || 'Service Request',
                description: data.description || '',
                status: mapRequestStatus(data.status),
                priority: mapRequestPriority(data.priority),
                buildingId: String(data.buildingId || ''),
                createdByTenantId: String(data.tenantId || data.createdByTenantId || ''),
                assignedEmployeeId: data.assignedTo?.id ? String(data.assignedTo.id) : undefined,
                createdAt: data.createdAt || new Date().toISOString(),
                updatedAt: data.updatedAt || new Date().toISOString(),
                completedAt: data.completedAt || null,
                assignedTo: data.assignedTo
                    ? {
                        id: String(data.assignedTo.id),
                        fullName: data.assignedTo.fullName,
                        email: data.assignedTo.email
                    }
                    : undefined,
                comments: Array.isArray(data.comments)
                    ? data.comments.map((comment: any) => ({
                        id: String(comment.id),
                        commentText: comment.commentText || '',
                        createdAt: comment.createdAt || new Date().toISOString(),
                        user: comment.user
                            ? {
                                userId: String(comment.user.userId ?? comment.user.id ?? ''),
                                fullName: comment.user.fullName,
                                email: comment.user.email
                            }
                            : undefined
                    }))
                    : [],
                attachments: Array.isArray(data.attachments)
                    ? data.attachments.map((attachment: any) => ({
                        id: String(attachment.id),
                        fileUrl: attachment.fileUrl,
                        fileName: attachment.fileName,
                        contentType: attachment.contentType
                    }))
                    : [],
                statusHistory: Array.isArray(data.statusHistory)
                    ? data.statusHistory.map((entry: any) => ({
                        id: String(entry.id),
                        oldStatus: mapRequestStatus(entry.oldStatus),
                        newStatus: mapRequestStatus(entry.newStatus),
                        changedAt: entry.changedAt || new Date().toISOString(),
                        note: entry.note ?? null
                    }))
                    : []
            };
        } catch (e) {
            console.warn("Fetch request failed", e);
        }
    }
    const all = await getRequests();
    return all.find((r) => r.id === id);
}

export async function createRequest(request: Omit<ServiceRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<ServiceRequest> {
    await delay(DELAY_MS);
    const newRequest: ServiceRequest = {
        ...request,
        id: `r${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    MOCK_REQUESTS.push(newRequest);
    return newRequest;
}

export async function updateRequestStatus(id: string, status: RequestStatus, note?: string): Promise<ServiceRequest> {
    if (!USE_MOCK) {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }
        await fetchJson('/MaintenanceRequest/status', {
            method: 'POST',
            body: JSON.stringify({
                requestId: Number(id),
                newStatus: mapRequestStatusToApi(status),
                changedById: Number(userId),
                note: note || ''
            })
        });
        const updated = await getRequest(id);
        if (!updated) {
            throw new Error('Request not found');
        }
        return updated;
    }

    await delay(DELAY_MS);
    const req = MOCK_REQUESTS.find((r) => r.id === id);
    if (!req) throw new Error('Request not found');
    req.status = status;
    req.updatedAt = new Date().toISOString();
    return req;
}

export async function assignRequest(requestId: string, assignedToId: string): Promise<ServiceRequest> {
    if (!USE_MOCK) {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }
        await fetchJson('/MaintenanceRequest/assign', {
            method: 'POST',
            body: JSON.stringify({
                requestId: Number(requestId),
                assignedToId: Number(assignedToId),
                assignedById: Number(userId)
            })
        });
        const updated = await getRequest(requestId);
        if (!updated) {
            throw new Error('Request not found');
        }
        return updated;
    }

    await delay(DELAY_MS);
    const req = MOCK_REQUESTS.find((r) => r.id === requestId);
    if (!req) throw new Error('Request not found');
    req.assignedEmployeeId = assignedToId;
    req.updatedAt = new Date().toISOString();
    return req;
}

export async function addRequestComment(requestId: string, commentText: string): Promise<ServiceRequest> {
    if (!USE_MOCK) {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }
        await fetchJson('/MaintenanceRequest/comment', {
            method: 'POST',
            body: JSON.stringify({
                requestId: Number(requestId),
                userId: Number(userId),
                commentText
            })
        });
        const updated = await getRequest(requestId);
        if (!updated) {
            throw new Error('Request not found');
        }
        return updated;
    }

    await delay(DELAY_MS);
    const req = MOCK_REQUESTS.find((r) => r.id === requestId);
    if (!req) throw new Error('Request not found');
    const newComment = {
        id: String(Date.now()),
        commentText,
        createdAt: new Date().toISOString(),
        user: { userId: useAuthStore.getState().user?.id || '' }
    };
    req.comments = [...(req.comments || []), newComment];
    req.updatedAt = new Date().toISOString();
    return req;
}

// --- Admin APIs (Keep these for Admin specific actions) ---

// --- Generic Create User for all roles ---

export async function createUser(role: Role, data: AdminDTO): Promise<User> {
    const endpoint =
        role === 'admin' ? '/Admin/create' :
            role === 'manager' ? '/Manager/create' :
                role === 'tenant' ? '/Tenant/create' :
                    role === 'employee' ? '/MaintenanceStaff/create' :
                        null;

    if (!endpoint) throw new Error(`Creation not supported for role: ${role}`);

    const basePayload = {
        fullName: data.fullName,
        email: data.email,
        password: data.password,
        phoneNumber: data.phoneNumber,
        address: data.address,
        nationality: data.nationality
    };
    const buildingId = data.buildingId !== undefined && data.buildingId !== null ? String(data.buildingId) : undefined;
    const payload = role === 'tenant'
        ? {
            ...basePayload,
            buildingId: buildingId ? Number(buildingId) : undefined,
            unitNumber: data.unitNumber,
            floorNumber: data.floorNumber ?? 0,
            entranceDate: data.entranceDate || new Date().toISOString()
        }
        : basePayload;

    if (!USE_MOCK) {
        try {
            if (IS_DEV) {
                console.log(`[API] Creating ${role} at ${endpoint}`);
            }
            const res = await fetchJson(endpoint, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            // Handle unwrapping if needed, though create usually returns object directly or success message
            // Based on GET responses, it might be wrapped in { data: ... }
            const createdData = (res && res.data) ? res.data : res;
            const createdId = String(createdData?.id || Math.random());

            if (role === 'manager' && buildingId) {
                await assignManagerToBuilding(buildingId, createdId);
            }
            if (role === 'employee' && buildingId) {
                await assignMaintenanceStaffToBuilding(buildingId, createdId);
            }

            return {
                id: createdId,
                name: data.fullName,
                email: data.email || '',
                role: role,
                buildingIds: buildingId ? [buildingId] : [],
                fullName: data.fullName,
                phoneNumber: data.phoneNumber,
                address: data.address,
                nationality: data.nationality
            };
        } catch (e) {
            console.error(`[API] Failed to create ${role}`, e);
            throw e;
        }
    }

    await delay(DELAY_MS);
    const newUser: User = {
        id: 'u' + (MOCK_USERS.length + 1) + Math.random(),
        name: data.fullName,
        email: data.email || `new.${role}@test.com`,
        role: role,
        buildingIds: buildingId ? [buildingId] : [],
        fullName: data.fullName,
        phoneNumber: data.phoneNumber,
        address: data.address,
        nationality: data.nationality
    };
    MOCK_USERS.push(newUser);
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
            buildingIds: [],
            ...data
        } as User;
    }

    await delay(DELAY_MS);
    const userIndex = MOCK_USERS.findIndex(u => u.id === id);
    if (userIndex === -1) throw new Error('User not found');

    const updatedUser = { ...MOCK_USERS[userIndex], ...data, name: data.fullName || MOCK_USERS[userIndex].name };
    MOCK_USERS[userIndex] = updatedUser;
    return updatedUser;
}

export async function deleteAdmin(id: string): Promise<void> {
    if (!USE_MOCK) {
        await fetchJson(`/Admin/delete/${id}`, { method: 'DELETE' });
        return;
    }
    await delay(DELAY_MS);
    MOCK_USERS = MOCK_USERS.filter(u => u.id !== id);
}

export async function deleteUser(role: Role, id: string, buildingIds: string[] = []): Promise<void> {
    if (role === 'tenant') {
        if (!USE_MOCK) {
            await fetchJson(`/Tenant/delete/${id}`, { method: 'DELETE' });
            return;
        }
        await delay(DELAY_MS);
        MOCK_USERS = MOCK_USERS.filter(u => u.id !== id || u.role !== role);
        return;
    }

    if (role === 'manager' || role === 'employee') {
        if (buildingIds.length === 0) {
            throw new Error('Building assignment is required to remove this user.');
        }
        if (!USE_MOCK) {
            await Promise.all(buildingIds.map((buildingId) => {
                const endpoint = role === 'manager' ? '/BuildingManager/remove' : '/BuildingMaintenanceStaff/remove';
                const payload = role === 'manager'
                    ? { buildingId: Number(buildingId), managerId: Number(id) }
                    : { buildingId: Number(buildingId), staffId: Number(id) };
                return fetchJson(endpoint, {
                    method: 'DELETE',
                    body: JSON.stringify(payload)
                });
            }));
            return;
        }
        await delay(DELAY_MS);
        MOCK_USERS = MOCK_USERS.filter(u => u.id !== id || u.role !== role);
        return;
    }

    throw new Error(`Deletion not supported for role: ${role}`);
}

// Auth Login
export async function login(email: string, password?: string): Promise<{ user: User; token: string | null }> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson('/Auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password: password || 'password' })
            });

            if (res?.success === false) {
                throw new Error(res?.message || 'Login failed');
            }

            if (res) {
                const data = res?.data || res;
                const userData = data?.user || data?.data?.user || data;
                const roleFromRoles = Array.isArray(userData?.roles) && userData.roles.length > 0
                    ? (typeof userData.roles[0] === 'string'
                        ? userData.roles[0]
                        : (userData.roles[0]?.roleName || userData.roles[0]?.name || userData.roles[0]?.role))
                    : undefined;
                const rawRole = data?.role ?? data?.roleName ?? userData?.role ?? userData?.roleName ?? userData?.userType ?? userData?.type ?? roleFromRoles;
                const normalizedRole = String(rawRole || '').toLowerCase().replace(/[\s-_]/g, '');
                const role: Role =
                    normalizedRole === 'super' || normalizedRole === 'superadmin' || normalizedRole === 'towerdesk'
                        ? 'superadmin'
                        : normalizedRole === 'admin'
                            ? 'admin'
                            : normalizedRole === 'manager'
                                ? 'manager'
                                : normalizedRole === 'tenant'
                                    ? 'tenant'
                                    : normalizedRole === 'serviceprovider'
                                        ? 'service_provider'
                                        : normalizedRole === 'maintenance' || normalizedRole === 'maintenancestaff'
                                            ? 'employee'
                                            : normalizedRole === 'employee'
                                                ? 'employee'
                                                : 'admin';

                return {
                    user: {
                        id: String(userData?.id || data?.id || 'api-user'),
                        name: userData?.fullName || userData?.name || data?.fullName || data?.name || 'API User',
                        email: userData?.email || data?.email || email,
                        role,
                        buildingIds: [],
                        fullName: userData?.fullName || data?.fullName,
                        phoneNumber: userData?.phoneNumber || data?.phoneNumber,
                        address: userData?.address || data?.address,
                        nationality: userData?.nationality || data?.nationality
                    },
                    token: data?.token || res?.token || null
                };
            }
        } catch (e) {
            console.warn("Login API failed, falling back if allowed.", e);
            throw e;
        }
    }


    await delay(DELAY_MS);
    const user = MOCK_USERS.find(u => u.email === email);
    if (!user) throw new Error('Invalid credentials');
    return { user, token: null };
}

// --- Building Management Functions ---

export async function createBuilding(data: BuildingDTO): Promise<Building> {
    if (!USE_MOCK) {
        const res = await fetchJson('/Buildings/create', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        const b = res?.data || res;
        return {
            id: String(b.id),
            name: b.name,
            address: b.address,
            city: b.city,
            unitsCount: b.unintsCount,
            status: b.isActive ? 'active' : 'inactive',
            stats: { totalTenants: 0, activeRequests: 0, occupancyRate: 0 }
        };
    }
    await delay(DELAY_MS);
    const newBuilding: Building = {
        id: 'b' + (MOCK_BUILDINGS.length + 1),
        name: data.name,
        address: data.address,
        city: data.city,
        unitsCount: data.unitsCount,
        status: 'active',
        stats: { totalTenants: 0, activeRequests: 0, occupancyRate: 0 }
    };
    MOCK_BUILDINGS.push(newBuilding);
    return newBuilding;
}

export async function assignAdminToBuilding(buildingId: string, adminId: string): Promise<any> {
    if (!USE_MOCK) {
        return await fetchJson('/BuildingAdmin/assign', {
            method: 'POST',
            body: JSON.stringify({ buildingId: Number(buildingId), adminId: Number(adminId) })
        });
    }
    await delay(DELAY_MS);
    return { success: true };
}

export async function assignManagerToBuilding(buildingId: string, managerId: string): Promise<any> {
    if (!USE_MOCK) {
        return await fetchJson('/BuildingManager/assign', {
            method: 'POST',
            body: JSON.stringify({ buildingId: Number(buildingId), managerId: Number(managerId) })
        });
    }
    await delay(DELAY_MS);
    return { success: true };
}

export async function assignMaintenanceStaffToBuilding(buildingId: string, staffId: string): Promise<any> {
    if (!USE_MOCK) {
        return await fetchJson('/BuildingMaintenanceStaff/assign', {
            method: 'POST',
            body: JSON.stringify({ buildingId: Number(buildingId), staffId: Number(staffId) })
        });
    }
    await delay(DELAY_MS);
    return { success: true };
}

export async function removeAdminFromBuilding(buildingId: string, adminId: string): Promise<any> {
    if (!USE_MOCK) {
        return await fetchJson('/BuildingAdmin/remove', {
            method: 'DELETE',
            body: JSON.stringify({ buildingId: Number(buildingId), adminId: Number(adminId) })
        });
    }
    await delay(DELAY_MS);
    return { success: true };
}

export async function getBuildingAdmins(buildingId: string): Promise<User[]> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/BuildingAdmin/building/${buildingId}`);
        const data = getArray(res);
        return data.map((u: any) => mapUser(u, 'admin'));
    }
    await delay(DELAY_MS);
    return [];
}
