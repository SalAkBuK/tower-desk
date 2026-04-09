import type { ParkingAllocation, ParkingSlot, ParkingSlotType, Vehicle } from '../types';
import { delay, IS_DEV, USE_MOCK } from './config';
import { fetchJson } from './client';
import { getArray, truncateForLog } from './shared';

// =====================
// Parking Slots
// =====================

export async function getParkingSlots(buildingId: string, options?: { available?: boolean }): Promise<ParkingSlot[]> {
    if (!USE_MOCK) {
        const query = options?.available ? '?available=true' : '';
        const endpoint = `/org/buildings/${buildingId}/parking-slots${query}`;
        const res = await fetchJson(endpoint);

        // Some endpoints return arrays under different keys (e.g. `data.slots`, `data.parkingSlots`, etc.).
        // Be defensive so the "available slots" view doesn't silently become empty.
        let slots = getArray(res);
        if (slots.length === 0) {
            if (Array.isArray(res?.slots)) slots = res.slots;
            else if (Array.isArray(res?.parkingSlots)) slots = res.parkingSlots;
            else if (Array.isArray(res?.availableSlots)) slots = res.availableSlots;
            else if (Array.isArray(res?.data?.slots)) slots = res.data.slots;
            else if (Array.isArray(res?.data?.parkingSlots)) slots = res.data.parkingSlots;
            else if (Array.isArray(res?.data?.availableSlots)) slots = res.data.availableSlots;
            else if (Array.isArray(res?.data?.data)) slots = res.data.data;
            else {
                // Last resort: find a plausible array in the response (depth-limited).
                const queue: Array<{ value: any; depth: number }> = [{ value: res, depth: 0 }];
                const candidates: any[][] = [];

                while (queue.length) {
                    const { value, depth } = queue.shift()!;
                    if (!value || typeof value !== 'object') continue;
                    if (depth > 3) continue;

                    for (const key of Object.keys(value)) {
                        const next = (value as any)[key];
                        if (Array.isArray(next)) {
                            const looksLikeSlot = next.some((item) => item && typeof item === 'object' && ('code' in item || 'slotCode' in item) && ('id' in item || 'slotId' in item));
                            const looksLikeList = next.length > 0 && next.every((item) => item && typeof item === 'object');
                            if (looksLikeSlot || looksLikeList) candidates.push(next);
                        } else if (next && typeof next === 'object') {
                            queue.push({ value: next, depth: depth + 1 });
                        }
                    }
                }

                if (candidates.length) {
                    candidates.sort((a, b) => b.length - a.length);
                    slots = candidates[0];
                }
            }
        }

        if (IS_DEV && options?.available) {
            const topKeys = res && typeof res === 'object' ? Object.keys(res) : [];
            const dataKeys = res?.data && typeof res.data === 'object' ? Object.keys(res.data) : [];
            console.log('[API] getParkingSlots parsed', { endpoint, topKeys, dataKeys, slotCount: slots.length });
            if (slots.length === 0) {
                console.log('[API] getParkingSlots raw (truncated)', {
                    endpoint,
                    res: truncateForLog(res),
                });
            }
        }

        const hasAvailabilityBoolean = slots.some((s: any) =>
            typeof s?.isAvailable === 'boolean' ||
            typeof s?.available === 'boolean' ||
            typeof s?.isVacant === 'boolean' ||
            typeof s?.vacant === 'boolean'
        );

        const mapped = slots.map((s: any) => {
            const availability =
                typeof s?.isAvailable === 'boolean'
                    ? s.isAvailable
                    : typeof s?.available === 'boolean'
                        ? s.available
                        : typeof s?.isVacant === 'boolean'
                            ? s.isVacant
                            : typeof s?.vacant === 'boolean'
                                ? s.vacant
                                : undefined;

            return {
                id: String(s.id ?? ''),
                buildingId: String(s.buildingId ?? buildingId),
                code: s.code ?? '',
                level: s.level ?? null,
                type: (s.type ?? 'CAR') as ParkingSlotType,
                isCovered: Boolean(s.isCovered),
                isActive: s.isActive !== false,
                createdAt: s.createdAt ?? new Date().toISOString(),
                __available: availability as boolean | undefined,
            };
        });

        const filtered = options?.available && hasAvailabilityBoolean
            ? mapped.filter((s) => s.__available === true)
            : mapped;

        return filtered.map(({ __available, ...slot }) => slot);
    }
    await delay(800);
    return [];
}

export async function createParkingSlot(
    buildingId: string,
    data: { code: string; type: ParkingSlotType; level?: string; isCovered?: boolean }
): Promise<ParkingSlot> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/parking-slots`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        const slot = res?.data ?? res;
        return {
            id: String(slot.id ?? ''),
            buildingId: String(slot.buildingId ?? buildingId),
            code: slot.code ?? data.code,
            level: slot.level ?? data.level ?? null,
            type: (slot.type ?? data.type) as ParkingSlotType,
            isCovered: Boolean(slot.isCovered ?? data.isCovered),
            isActive: slot.isActive !== false,
            createdAt: slot.createdAt ?? new Date().toISOString(),
        };
    }
    await delay(800);
    return {
        id: String(Date.now()),
        buildingId,
        code: data.code,
        level: data.level ?? null,
        type: data.type,
        isCovered: data.isCovered ?? false,
        isActive: true,
        createdAt: new Date().toISOString(),
    };
}

export async function updateParkingSlot(
    slotId: string,
    data: { code?: string; type?: ParkingSlotType; level?: string; isCovered?: boolean; isActive?: boolean }
): Promise<ParkingSlot> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/parking-slots/${slotId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
        const slot = res?.data ?? res;
        return {
            id: String(slot.id ?? slotId),
            buildingId: String(slot.buildingId ?? ''),
            code: slot.code ?? '',
            level: slot.level ?? null,
            type: (slot.type ?? 'CAR') as ParkingSlotType,
            isCovered: Boolean(slot.isCovered),
            isActive: slot.isActive !== false,
            createdAt: slot.createdAt ?? new Date().toISOString(),
        };
    }
    await delay(800);
    return {
        id: slotId,
        buildingId: '',
        code: data.code ?? '',
        level: data.level ?? null,
        type: data.type ?? 'CAR',
        isCovered: data.isCovered ?? false,
        isActive: data.isActive ?? true,
        createdAt: new Date().toISOString(),
    };
}

// =====================
// Parking Allocations
// =====================

export async function getOccupancyParkingAllocations(
    occupancyId: string,
    options?: { active?: boolean }
): Promise<ParkingAllocation[]> {
    if (!USE_MOCK) {
        let query = '';
        if (options?.active === true) query = '?active=true';
        else if (options?.active === false) query = '?active=false';
        const res = await fetchJson(`/org/occupancies/${occupancyId}/parking-allocations${query}`);
        const allocations = getArray(res);
        return allocations.map((a: any) => ({
            id: String(a.id ?? ''),
            buildingId: String(a.buildingId ?? ''),
            occupancyId: a.occupancyId != null ? String(a.occupancyId) : String(occupancyId),
            unitId: a.unitId != null ? String(a.unitId) : undefined,
            parkingSlotId: String(a.parkingSlotId ?? ''),
            startDate: a.startDate ?? new Date().toISOString(),
            endDate: a.endDate ?? null,
            slot: {
                id: String(a.slot?.id ?? a.parkingSlotId ?? ''),
                code: a.slot?.code ?? '',
                level: a.slot?.level ?? null,
                type: (a.slot?.type ?? 'CAR') as ParkingSlotType,
            },
        }));
    }
    await delay(800);
    return [];
}

export async function createParkingAllocations(
    buildingId: string,
    data: { occupancyId?: string; unitId?: string; slotIds?: string[]; count?: number }
): Promise<ParkingAllocation[]> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/parking-allocations`, {
            method: 'POST',
            body: JSON.stringify(data),
        }, { silentStatusCodes: [409] });
        const allocations = getArray(res);
        return allocations.map((a: any) => ({
            id: String(a.id ?? ''),
            buildingId: String(a.buildingId ?? buildingId),
            occupancyId: a.occupancyId != null ? String(a.occupancyId) : (data.occupancyId ? String(data.occupancyId) : undefined),
            unitId: a.unitId != null ? String(a.unitId) : (data.unitId ? String(data.unitId) : undefined),
            parkingSlotId: String(a.parkingSlotId ?? ''),
            startDate: a.startDate ?? new Date().toISOString(),
            endDate: a.endDate ?? null,
            slot: {
                id: String(a.slot?.id ?? a.parkingSlotId ?? ''),
                code: a.slot?.code ?? '',
                level: a.slot?.level ?? null,
                type: (a.slot?.type ?? 'CAR') as ParkingSlotType,
            },
        }));
    }
    await delay(800);
    return [];
}

export async function getUnitParkingAllocations(unitId: string): Promise<ParkingAllocation[]> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson(
                `/org/units/${unitId}/parking-allocations`,
                undefined,
                { silentStatusCodes: [404] }
            );
            const allocations = getArray(res);
            return allocations.map((a: any) => ({
                id: String(a.id ?? ''),
                buildingId: String(a.buildingId ?? ''),
                occupancyId: a.occupancyId != null ? String(a.occupancyId) : undefined,
                unitId: a.unitId != null ? String(a.unitId) : unitId,
                parkingSlotId: String(a.parkingSlotId ?? ''),
                startDate: a.startDate ?? new Date().toISOString(),
                endDate: a.endDate ?? null,
                slot: {
                    id: String(a.slot?.id ?? a.parkingSlotId ?? ''),
                    code: a.slot?.code ?? '',
                    level: a.slot?.level ?? null,
                    type: (a.slot?.type ?? 'CAR') as ParkingSlotType,
                },
            }));
        } catch (error) {
            if ((error as any)?.silent || (error instanceof Error && /404/.test(error.message))) {
                return [];
            }
            throw error;
        }
    }
    await delay(800);
    return [];
}

export async function endAllUnitParkingAllocations(unitId: string, data?: { endDate?: string }): Promise<{ success: boolean }> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson(
                `/org/units/${unitId}/parking-allocations/end-all`,
                {
                    method: 'POST',
                    body: JSON.stringify(data ?? {}),
                },
                { silentStatusCodes: [404] }
            );
            return res?.data ?? res ?? { success: true };
        } catch (error) {
            if ((error as any)?.silent || (error instanceof Error && /404/.test(error.message))) {
                return { success: false };
            }
            throw error;
        }
    }
    await delay(800);
    return { success: true };
}

export async function endParkingAllocation(
    allocationId: string,
    data?: { endDate?: string }
): Promise<ParkingAllocation> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/parking-allocations/${allocationId}/end`, {
            method: 'POST',
            body: JSON.stringify(data ?? {}),
        });
        const a = res?.data ?? res;
        return {
            id: String(a.id ?? allocationId),
            buildingId: String(a.buildingId ?? ''),
            occupancyId: a.occupancyId != null ? String(a.occupancyId) : undefined,
            unitId: a.unitId != null ? String(a.unitId) : undefined,
            parkingSlotId: String(a.parkingSlotId ?? ''),
            startDate: a.startDate ?? '',
            endDate: a.endDate ?? new Date().toISOString(),
            slot: {
                id: String(a.slot?.id ?? a.parkingSlotId ?? ''),
                code: a.slot?.code ?? '',
                level: a.slot?.level ?? null,
                type: (a.slot?.type ?? 'CAR') as ParkingSlotType,
            },
        };
    }
    await delay(800);
    return {
        id: allocationId,
        buildingId: '',
        occupancyId: '',
        parkingSlotId: '',
        startDate: '',
        endDate: data?.endDate ?? new Date().toISOString(),
        slot: { id: '', code: '', level: null, type: 'CAR' },
    };
}

export async function endAllParkingAllocations(
    occupancyId: string,
    data?: { endDate?: string }
): Promise<{ ended: number }> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/occupancies/${occupancyId}/parking-allocations/end-all`, {
            method: 'POST',
            body: JSON.stringify(data ?? {}),
        });
        return { ended: res?.ended ?? res?.data?.ended ?? 0 };
    }
    await delay(800);
    return { ended: 0 };
}

// =====================
// Vehicles
// =====================

export async function getOccupancyVehicles(occupancyId: string): Promise<Vehicle[]> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/occupancies/${occupancyId}/vehicles`);
        const vehicles = getArray(res);
        return vehicles.map((v: any) => ({
            id: String(v.id ?? ''),
            occupancyId: String(v.occupancyId ?? occupancyId),
            plateNumber: v.plateNumber ?? '',
            label: v.label ?? null,
            createdAt: v.createdAt ?? new Date().toISOString(),
        }));
    }
    await delay(800);
    return [];
}

export async function createVehicle(
    occupancyId: string,
    data: { plateNumber: string; label?: string }
): Promise<Vehicle> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/occupancies/${occupancyId}/vehicles`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        const v = res?.data ?? res;
        return {
            id: String(v.id ?? ''),
            occupancyId: String(v.occupancyId ?? occupancyId),
            plateNumber: v.plateNumber ?? data.plateNumber,
            label: v.label ?? data.label ?? null,
            createdAt: v.createdAt ?? new Date().toISOString(),
        };
    }
    await delay(800);
    return {
        id: String(Date.now()),
        occupancyId,
        plateNumber: data.plateNumber,
        label: data.label ?? null,
        createdAt: new Date().toISOString(),
    };
}

export async function updateVehicle(
    vehicleId: string,
    data: { plateNumber?: string; label?: string }
): Promise<Vehicle> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/vehicles/${vehicleId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
        const v = res?.data ?? res;
        return {
            id: String(v.id ?? vehicleId),
            occupancyId: String(v.occupancyId ?? ''),
            plateNumber: v.plateNumber ?? '',
            label: v.label ?? null,
            createdAt: v.createdAt ?? new Date().toISOString(),
        };
    }
    await delay(800);
    return {
        id: vehicleId,
        occupancyId: '',
        plateNumber: data.plateNumber ?? '',
        label: data.label ?? null,
        createdAt: new Date().toISOString(),
    };
}

export async function deleteVehicle(vehicleId: string): Promise<{ success: boolean }> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/vehicles/${vehicleId}`, { method: 'DELETE' });
        return res?.data ?? res ?? { success: true };
    }
    await delay(800);
    return { success: true };
}
