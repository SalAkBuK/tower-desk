import type { Visitor, VisitorStatus, VisitorType } from '../types';
import { delay, USE_MOCK } from './config';
import { fetchJson } from './client';
import { getArray } from './shared';

// =====================
// Visitors
// =====================

const VISITOR_TYPES: VisitorType[] = [
    'GUEST_VISITOR',
    'DELIVERY_RIDER',
    'COURIER_PARCEL',
    'SERVICE_PROVIDER',
    'MAINTENANCE_TECHNICIAN',
    'HOUSEKEEPING_CLEANER',
    'CONTRACTOR_WORKER',
    'DRIVER_PICKUP',
    'SECURITY_STAFF_EXTERNAL',
    'OTHER'
];

const VISITOR_STATUSES: VisitorStatus[] = ['EXPECTED', 'ARRIVED', 'COMPLETED', 'CANCELLED'];

function resolveVisitorType(value: any): VisitorType {
    if (typeof value === 'string' && VISITOR_TYPES.includes(value as VisitorType)) {
        return value as VisitorType;
    }
    return 'GUEST_VISITOR';
}

function resolveVisitorStatus(value: any): VisitorStatus {
    if (typeof value === 'string' && VISITOR_STATUSES.includes(value as VisitorStatus)) {
        return value as VisitorStatus;
    }
    return 'EXPECTED';
}

function normalizeVisitor(v: any): Visitor {
    return {
        id: String(v.id ?? ''),
        buildingId: String(v.buildingId ?? ''),
        type: resolveVisitorType(v.type),
        status: resolveVisitorStatus(v.status),
        visitorName: v.visitorName ?? 'Visitor',
        phoneNumber: v.phoneNumber ?? undefined,
        emiratesId: v.emiratesId ?? null,
        vehicleNumber: v.vehicleNumber ?? null,
        expectedArrivalAt: v.expectedArrivalAt ?? null,
        notes: v.notes ?? null,
        unit: v.unit ? { id: String(v.unit.id), label: v.unit.label } : undefined,
        tenantName: v.tenantName ?? null,
        createdAt: v.createdAt ?? new Date().toISOString(),
        updatedAt: v.updatedAt ?? new Date().toISOString()
    };
}

export async function getVisitors(
    buildingId: string,
    filters?: { status?: VisitorStatus; unitId?: string }
): Promise<Visitor[]> {
    if (!USE_MOCK) {
        try {
            const params = new URLSearchParams();
            if (filters?.status) {
                params.append('status', filters.status);
            }
            if (filters?.unitId) {
                params.append('unitId', filters.unitId);
            }
            const queryStr = params.toString();
            const endpoint = `/org/buildings/${buildingId}/visitors${queryStr ? `?${queryStr}` : ''}`;
            const res = await fetchJson(endpoint);
            const visitors = getArray(res);
            return visitors.map(normalizeVisitor);
        } catch (e) {
            console.warn('[API] getVisitors failed', e);
            return [];
        }
    }
    await delay(800);
    return [];
}

export async function createVisitor(
    buildingId: string,
    data: {
        unitId: string;
        visitorName: string;
        phoneNumber?: string;
        type: VisitorType;
        emiratesId?: string;
        vehicleNumber?: string;
        expectedArrivalAt?: string;
        notes?: string;
    }
): Promise<Visitor> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/visitors`, {
            method: 'POST',
            body: JSON.stringify({
                unitId: data.unitId,
                visitorName: data.visitorName,
                phoneNumber: data.phoneNumber,
                type: data.type,
                emiratesId: data.emiratesId || undefined,
                vehicleNumber: data.vehicleNumber || undefined,
                expectedArrivalAt: data.expectedArrivalAt || undefined,
                notes: data.notes || undefined
            })
        });
        const visitor = res?.data ?? res;
        return normalizeVisitor(visitor);
    }
    await delay(800);
    return normalizeVisitor({
        id: `v-${Date.now()}`,
        buildingId,
        ...data,
        status: 'EXPECTED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
}

export async function updateVisitor(
    buildingId: string,
    visitorId: string,
    data: {
        status?: VisitorStatus;
        type?: VisitorType;
        visitorName?: string;
        phoneNumber?: string;
        unitId?: string;
        emiratesId?: string;
        vehicleNumber?: string;
        expectedArrivalAt?: string | null;
        notes?: string;
    }
): Promise<Visitor> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/visitors/${visitorId}`, {
            method: 'PATCH',
            body: JSON.stringify({
                ...(data.status && { status: data.status }),
                ...(data.type && { type: data.type }),
                ...(data.visitorName && { visitorName: data.visitorName }),
                ...(data.phoneNumber !== undefined && { phoneNumber: data.phoneNumber }),
                ...(data.unitId && { unitId: data.unitId }),
                ...(data.emiratesId !== undefined && { emiratesId: data.emiratesId }),
                ...(data.vehicleNumber !== undefined && { vehicleNumber: data.vehicleNumber }),
                ...(data.expectedArrivalAt !== undefined && { expectedArrivalAt: data.expectedArrivalAt }),
                ...(data.notes !== undefined && { notes: data.notes })
            })
        });
        const visitor = res?.data ?? res;
        return normalizeVisitor(visitor);
    }
    await delay(800);
    return normalizeVisitor({
        id: visitorId,
        buildingId,
        ...data,
        updatedAt: new Date().toISOString()
    });
}
