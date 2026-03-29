import type { Building, ServiceRequest, User } from '../types';

const resolveApiBase = () => {
    const envBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!envBase) {
        throw new Error('Missing NEXT_PUBLIC_API_BASE_URL (e.g. http://localhost:3001/api)');
    }
    const trimmed = envBase.replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(trimmed)) {
        throw new Error('NEXT_PUBLIC_API_BASE_URL must be an absolute http(s) URL');
    }
    return trimmed;
};

export const DELAY_MS = 800;
export const IS_DEV = process.env.NODE_ENV !== 'production';
export const AUTH_REQUEST_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_AUTH_REQUEST_TIMEOUT_MS ?? 8000);
export const API_BASE_URL = resolveApiBase();
export const USE_MOCK = false;

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const mockData = {
    buildings: [
        { id: 'b1', name: 'Tower One', address: '100 Main St, New York, NY', status: 'active', stats: { totalTenants: 120, activeRequests: 5, occupancyRate: 0.95 } },
        { id: 'b2', name: 'Skyline Heights', address: '200 High Ave, San Francisco, CA', status: 'active', stats: { totalTenants: 85, activeRequests: 12, occupancyRate: 0.88 } },
        { id: 'b3', name: 'The Vertex', address: '300 Peak Rd, Austin, TX', status: 'maintenance', stats: { totalTenants: 40, activeRequests: 2, occupancyRate: 0.60 } },
        { id: 'b4', name: 'Oceanview Plaza', address: '400 Shore Blvd, Miami, FL', status: 'active', stats: { totalTenants: 200, activeRequests: 8, occupancyRate: 0.98 } },
    ] as Building[],
    users: [
        { id: 'u1', name: 'Alice Super', email: 'alice@towerdesk.com', role: 'superadmin', baseRole: 'superadmin', buildingIds: [], fullName: 'Alice Superadmin', phoneNumber: '1234567890', address: 'Admin HQ', nationality: 'US' },
        { id: 'u2', name: 'Bob Admin', email: 'bob@towerdesk.com', role: 'admin', baseRole: 'admin', buildingIds: ['b1', 'b2'], fullName: 'Bob Administrator', phoneNumber: '0987654321', address: 'Site B', nationality: 'CA' },
        { id: 'u3', name: 'Charlie Manager', email: 'charlie@towerdesk.com', role: 'manager', baseRole: 'manager', buildingIds: ['b1'], fullName: 'Charlie Manager', phoneNumber: '5551234567', address: 'Site A', nationality: 'US' },
        { id: 'u4', name: 'David Tenant', email: 'david@tenant.com', role: 'tenant', baseRole: 'tenant', buildingIds: ['b1'], fullName: 'David Tenant', phoneNumber: '5559876543', address: 'Unit 101', nationality: 'US' },
        { id: 'u5', name: 'Eve Employee', email: 'eve@maintenance.com', role: 'employee', baseRole: 'employee', buildingIds: ['b1', 'b2', 'b3', 'b4'], fullName: 'Eve Fixit', phoneNumber: '5556667777', address: 'Service HQ', nationality: 'MX' },
        { id: 'u6', name: 'Frank Admin', email: 'frank@towerdesk.com', role: 'admin', baseRole: 'admin', buildingIds: ['b3', 'b4'], fullName: 'Frank Admin', phoneNumber: '5554443333', address: 'Site C', nationality: 'US' },
    ] as User[],
    requests: [
        {
            id: 'r1',
            title: 'Leaking Faucet in 101',
            description: 'The kitchen faucet is dripping constantly.',
            status: 'pending',
            priority: 'medium',
            buildingId: 'b1',
            createdByTenantId: 'u4',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
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
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
            updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
        },
        {
            id: 'r3',
            title: 'Elevator Noise',
            description: 'Strange grinding noise in service elevator.',
            status: 'assigned',
            priority: 'urgent',
            buildingId: 'b2',
            createdByTenantId: 'u2',
            assignedEmployeeId: 'u5',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
            updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(),
        }
    ] as ServiceRequest[]
};
