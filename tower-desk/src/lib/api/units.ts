import type { Amenity, BuildingUnit, FurnishedStatus, KitchenType, MaintenancePayer, Owner, ParkingSlotsImportMode, ParkingSlotsImportResponse, PaymentFrequency, UnitSizeUnit, UnitStatus, UnitType, UnitsImportMode, UnitsImportResponse } from '../types';
import { useAuthStore } from '../auth';
import { buildFriendlyErrorMessage, fetchJson, isPublicEndpoint, notifyUnauthorized, refreshSessionSingleFlight } from './client';
import { API_BASE_URL, delay, IS_DEV, USE_MOCK } from './config';
import { getArray, getPermissionSet } from './shared';

export async function getUnitTypes(): Promise<UnitType[]> {
    if (!USE_MOCK) {
        const user = useAuthStore.getState().user;
        const role = user?.baseRole ?? user?.role;
        const permissions = getPermissionSet(user);
        const canView = role === 'superadmin' || role === 'org_admin' || permissions.has('unittypes.read');
        if (!canView) {
            if (IS_DEV) {
                console.warn('[API] Skipping getUnitTypes due to role restrictions', {
                    role,
                    permissions: Array.from(permissions)
                });
            }
            return [];
        }
        if (IS_DEV) {
            console.log('[API] getUnitTypes allowed', { role, permissions: Array.from(permissions) });
        }
        const res = await fetchJson('/org/unit-types');
        const data = getArray(res);
        return data.map((item: any) => ({
            id: String(item.id ?? item.unitTypeId ?? item.typeId ?? ''),
            name: item.name ?? item.label ?? item.title ?? '',
            isActive: typeof item.isActive === 'boolean' ? item.isActive : undefined
        }));
    }
    await delay(800);
    return [];
}

export async function createUnitType(data: { name: string; isActive?: boolean }): Promise<UnitType> {
    if (!USE_MOCK) {
        if (IS_DEV) {
            const user = useAuthStore.getState().user;
            const role = user?.baseRole ?? user?.role;
            const permissions = getPermissionSet(user);
            console.log('[API] createUnitType attempt', { role, permissions: Array.from(permissions), payload: data });
        }
        const res = await fetchJson('/org/unit-types', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        const payload = res?.data ?? res ?? {};
        return {
            id: String(payload.id ?? payload.unitTypeId ?? ''),
            name: payload.name ?? data.name,
            isActive: typeof payload.isActive === 'boolean' ? payload.isActive : data.isActive
        };
    }
    await delay(800);
    return { id: String(Date.now()), name: data.name, isActive: data.isActive };
}

export async function getOwners(search?: string): Promise<Owner[]> {
    if (!USE_MOCK) {
        const user = useAuthStore.getState().user;
        const role = user?.baseRole ?? user?.role;
        const permissions = getPermissionSet(user);
        const canView = role === 'superadmin' || role === 'org_admin' || permissions.has('owners.read');
        if (!canView) {
            if (IS_DEV) {
                console.warn('[API] Skipping getOwners due to role restrictions', {
                    role,
                    permissions: Array.from(permissions)
                });
            }
            return [];
        }
        if (IS_DEV) {
            console.log('[API] getOwners allowed', { role, permissions: Array.from(permissions), search });
        }
        const query = search ? `?search=${encodeURIComponent(search)}` : '';
        const res = await fetchJson(`/org/owners${query}`);
        const data = getArray(res);
        return data.map((item: any) => ({
            id: String(item.id ?? item.ownerId ?? ''),
            name: item.name ?? item.fullName ?? item.ownerName ?? '',
            email: item.email,
            phone: item.phone ?? item.phoneNumber,
            address: item.address
        }));
    }
    await delay(800);
    return [];
}

export async function createOwner(data: { name: string; email?: string; phone?: string; address?: string }): Promise<Owner> {
    if (!USE_MOCK) {
        if (IS_DEV) {
            const user = useAuthStore.getState().user;
            const role = user?.baseRole ?? user?.role;
            const permissions = getPermissionSet(user);
            console.log('[API] createOwner attempt', { role, permissions: Array.from(permissions), payload: data });
        }
        const res = await fetchJson('/org/owners', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        const payload = res?.data ?? res ?? {};
        return {
            id: String(payload.id ?? payload.ownerId ?? ''),
            name: payload.name ?? data.name,
            email: payload.email ?? data.email,
            phone: payload.phone ?? payload.phoneNumber ?? data.phone,
            address: payload.address ?? data.address
        };
    }
    await delay(800);
    return {
        id: String(Date.now()),
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address
    };
}

export async function getBuildingAmenities(buildingId: string): Promise<Amenity[]> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/amenities`);
        const data = getArray(res);
        return data.map((item: any) => ({
            id: String(item.id ?? item.amenityId ?? ''),
            name: item.name ?? item.label ?? '',
            isDefault: typeof item.isDefault === 'boolean' ? item.isDefault : undefined,
            isActive: typeof item.isActive === 'boolean' ? item.isActive : undefined
        }));
    }
    await delay(800);
    return [];
}

export async function createBuildingAmenity(
    buildingId: string,
    data: { name: string; isDefault?: boolean; isActive?: boolean }
): Promise<Amenity> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/amenities`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        const payload = res?.data ?? res ?? {};
        return {
            id: String(payload.id ?? payload.amenityId ?? ''),
            name: payload.name ?? data.name,
            isDefault: typeof payload.isDefault === 'boolean' ? payload.isDefault : data.isDefault,
            isActive: typeof payload.isActive === 'boolean' ? payload.isActive : data.isActive
        };
    }
    await delay(800);
    return { id: String(Date.now()), name: data.name, isDefault: data.isDefault };
}

export async function updateBuildingAmenity(
    buildingId: string,
    amenityId: string,
    data: { name?: string; isDefault?: boolean; isActive?: boolean }
): Promise<Amenity> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/amenities/${amenityId}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
        const payload = res?.data ?? res ?? {};
        return {
            id: String(payload.id ?? payload.amenityId ?? amenityId),
            name: payload.name ?? data.name ?? '',
            isDefault: typeof payload.isDefault === 'boolean' ? payload.isDefault : data.isDefault,
            isActive: typeof payload.isActive === 'boolean' ? payload.isActive : data.isActive
        };
    }
    await delay(800);
    return { id: amenityId, name: data.name ?? '', isDefault: data.isDefault };
}

export async function getBuildingUnit(buildingId: string, unitId: string): Promise<BuildingUnit> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/units/${unitId}`);
        const unit = res?.data ?? res ?? {};
        return {
            id: String(unit.id ?? unit.unitId ?? unitId),
            label: unit.label ?? unit.unitLabel ?? unit.name ?? '',
            floor: unit.floor ?? unit.floorNumber,
            notes: unit.notes,
            unitTypeId: unit.unitTypeId,
            ownerId: unit.ownerId,
            maintenancePayer: unit.maintenancePayer,
            unitSize: unit.unitSize ? Number(unit.unitSize) : undefined,
            unitSizeUnit: (unit.unitSizeUnit ?? "SQ_FT") as UnitSizeUnit,
            bedrooms: unit.bedrooms ?? undefined,
            bathrooms: unit.bathrooms ?? undefined,
            balcony: typeof unit.balcony === 'boolean' ? unit.balcony : undefined,
            kitchenType: unit.kitchenType,
            furnishedStatus: unit.furnishedStatus,
            rentAnnual: unit.rentAnnual ? Number(unit.rentAnnual) : undefined,
            paymentFrequency: unit.paymentFrequency,
            securityDepositAmount: unit.securityDepositAmount ? Number(unit.securityDepositAmount) : undefined,
            serviceChargePerUnit: unit.serviceChargePerUnit ? Number(unit.serviceChargePerUnit) : undefined,
            vatApplicable: typeof unit.vatApplicable === 'boolean' ? unit.vatApplicable : undefined,
            electricityMeterNumber: unit.electricityMeterNumber,
            waterMeterNumber: unit.waterMeterNumber,
            gasMeterNumber: unit.gasMeterNumber,
            amenityIds: Array.isArray(unit.amenityIds) ? unit.amenityIds.map((id: any) => String(id)) : undefined,
            amenities: Array.isArray(unit.amenities)
                ? unit.amenities.map((item: any) => ({
                    id: String(item.id ?? item.amenityId ?? ''),
                    name: item.name ?? item.label ?? '',
                    isDefault: typeof item.isDefault === 'boolean' ? item.isDefault : undefined
                }))
                : undefined,
            isAvailable: unit.isAvailable ?? unit.available ?? (unit.status ? String(unit.status).toLowerCase() === 'available' : undefined)
        };
    }
    await delay(800);
    return {
        id: String(unitId),
        label: 'Unit',
        unitSizeUnit: "SQ_FT",
    };
}

export async function getBuildingUnits(
    buildingId: string,
    options?: { available?: boolean; includeOccupancy?: boolean; q?: string }
): Promise<BuildingUnit[]> {
    if (!USE_MOCK) {
        const params = new URLSearchParams();
        if (options?.available) params.set('available', 'true');
        if (options?.includeOccupancy) params.set('include', 'occupancy');
        if (options?.q) params.set('q', options.q);
        const buildEndpoint = () => {
            const query = params.toString();
            return `/org/buildings/${buildingId}/units${query ? `?${query}` : ''}`;
        };

        let units: any[] = [];
        try {
            const res = await fetchJson(
                buildEndpoint(),
                undefined,
                options?.q ? { silentStatusCodes: [400] } : undefined
            );
            units = getArray(res);
        } catch (error) {
            const status = (error as { status?: unknown })?.status;
            const body = String((error as { body?: unknown })?.body ?? "");
            const unsupportedQ =
                status === 400 &&
                Boolean(options?.q) &&
                /property\s+q\s+should\s+not\s+exist/i.test(body);
            if (!unsupportedQ) {
                throw error;
            }
            // Backward-compatible fallback for backends that don't support q on units list.
            params.delete('q');
            const fallbackRes = await fetchJson(buildEndpoint());
            units = getArray(fallbackRes);
        }
        return units.map((u: any) => ({
            id: String(u.id ?? u.unitId ?? ''),
            label: u.label ?? u.unitLabel ?? u.name ?? '',
            floor: u.floor ?? u.floorNumber,
            notes: u.notes,
            unitTypeId: u.unitTypeId,
            ownerId: u.ownerId,
            maintenancePayer: u.maintenancePayer,
            unitSize: u.unitSize ? Number(u.unitSize) : undefined,
            unitSizeUnit: (u.unitSizeUnit ?? "SQ_FT") as UnitSizeUnit,
            bedrooms: u.bedrooms ?? undefined,
            bathrooms: u.bathrooms ?? undefined,
            balcony: typeof u.balcony === 'boolean' ? u.balcony : undefined,
            kitchenType: u.kitchenType,
            furnishedStatus: u.furnishedStatus,
            rentAnnual: u.rentAnnual ? Number(u.rentAnnual) : undefined,
            paymentFrequency: u.paymentFrequency,
            securityDepositAmount: u.securityDepositAmount ? Number(u.securityDepositAmount) : undefined,
            serviceChargePerUnit: u.serviceChargePerUnit ? Number(u.serviceChargePerUnit) : undefined,
            vatApplicable: typeof u.vatApplicable === 'boolean' ? u.vatApplicable : undefined,
            electricityMeterNumber: u.electricityMeterNumber,
            waterMeterNumber: u.waterMeterNumber,
            gasMeterNumber: u.gasMeterNumber,
            isAvailable: u.isAvailable ?? u.available ?? (u.status ? String(u.status).toLowerCase() === 'available' : undefined),
            status: u.status,
            occupancy: u.occupancy ? {
                id: String(u.occupancy.id ?? u.occupancy.occupancyId ?? ''),
                status: u.occupancy.status,
                resident: u.occupancy.resident ? {
                    id: String(u.occupancy.resident.id ?? u.occupancy.resident.userId ?? ''),
                    name: u.occupancy.resident.name ?? u.occupancy.resident.fullName ?? null,
                    email: u.occupancy.resident.email ?? null
                } : undefined,
                lease: (u.occupancy.contract ?? u.occupancy.lease) ? {
                    id: String((u.occupancy.contract ?? u.occupancy.lease).id ?? ''),
                    leaseStartDate:
                        (u.occupancy.contract ?? u.occupancy.lease).contractPeriodFrom ??
                        (u.occupancy.contract ?? u.occupancy.lease).leaseStartDate ??
                        (u.occupancy.contract ?? u.occupancy.lease).startDate,
                    leaseEndDate:
                        (u.occupancy.contract ?? u.occupancy.lease).contractPeriodTo ??
                        (u.occupancy.contract ?? u.occupancy.lease).leaseEndDate ??
                        (u.occupancy.contract ?? u.occupancy.lease).endDate,
                    tenancyRegistrationExpiry: (u.occupancy.contract ?? u.occupancy.lease).tenancyRegistrationExpiry,
                    noticeGivenDate: (u.occupancy.contract ?? u.occupancy.lease).noticeGivenDate,
                    annualRent: (u.occupancy.contract ?? u.occupancy.lease).annualRent
                        ? String((u.occupancy.contract ?? u.occupancy.lease).annualRent)
                        : undefined,
                    status: (u.occupancy.contract ?? u.occupancy.lease).status
                } : undefined
            } : undefined
        }));
    }
    await delay(800);
    return [];
}

export async function createBuildingUnit(buildingId: string, data: {
    label: string;
    floor?: number;
    notes?: string;
    unitTypeId?: string;
    ownerId?: string;
    maintenancePayer?: MaintenancePayer;
    unitSize?: number;
    unitSizeUnit?: UnitSizeUnit;
    bedrooms?: number;
    bathrooms?: number;
    balcony?: boolean;
    kitchenType?: KitchenType;
    furnishedStatus?: FurnishedStatus;
    rentAnnual?: number;
    paymentFrequency?: PaymentFrequency;
    securityDepositAmount?: number;
    serviceChargePerUnit?: number;
    vatApplicable?: boolean;
    electricityMeterNumber?: string;
    waterMeterNumber?: string;
    gasMeterNumber?: string;
    amenityIds?: string[];
}): Promise<BuildingUnit> {
    if (!USE_MOCK) {
        if (IS_DEV) {
            const { user, selectedOrgId } = useAuthStore.getState();
            const permissions = getPermissionSet(user);
            console.log('[API] createBuildingUnit attempt', {
                buildingId,
                orgId: selectedOrgId ?? user?.orgId ?? null,
                role: user?.role ?? null,
                permissions: Array.from(permissions),
                assignedBuildings: user?.buildingIds ?? [],
                payload: data
            });
        }
        const res = await fetchJson(`/org/buildings/${buildingId}/units`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        const unit = res?.data ?? res;
        return {
            id: String(unit.id ?? unit.unitId ?? ''),
            label: unit.label ?? unit.unitLabel ?? data.label,
            floor: unit.floor ?? unit.floorNumber ?? data.floor,
            notes: unit.notes ?? data.notes,
            unitTypeId: unit.unitTypeId ?? data.unitTypeId,
            ownerId: unit.ownerId ?? data.ownerId,
            maintenancePayer: unit.maintenancePayer ?? data.maintenancePayer,
            unitSize: unit.unitSize ? Number(unit.unitSize) : data.unitSize,
            unitSizeUnit: (unit.unitSizeUnit ?? data.unitSizeUnit ?? "SQ_FT") as UnitSizeUnit,
            bedrooms: unit.bedrooms ?? data.bedrooms,
            bathrooms: unit.bathrooms ?? data.bathrooms,
            balcony: typeof unit.balcony === 'boolean' ? unit.balcony : data.balcony,
            kitchenType: unit.kitchenType ?? data.kitchenType,
            furnishedStatus: unit.furnishedStatus ?? data.furnishedStatus,
            rentAnnual: unit.rentAnnual ? Number(unit.rentAnnual) : data.rentAnnual,
            paymentFrequency: unit.paymentFrequency ?? data.paymentFrequency,
            securityDepositAmount: unit.securityDepositAmount ? Number(unit.securityDepositAmount) : data.securityDepositAmount,
            serviceChargePerUnit: unit.serviceChargePerUnit ? Number(unit.serviceChargePerUnit) : data.serviceChargePerUnit,
            vatApplicable: typeof unit.vatApplicable === 'boolean' ? unit.vatApplicable : data.vatApplicable,
            electricityMeterNumber: unit.electricityMeterNumber ?? data.electricityMeterNumber,
            waterMeterNumber: unit.waterMeterNumber ?? data.waterMeterNumber,
            gasMeterNumber: unit.gasMeterNumber ?? data.gasMeterNumber,
            amenityIds: Array.isArray(unit.amenityIds) ? unit.amenityIds.map((id: any) => String(id)) : data.amenityIds,
            amenities: Array.isArray(unit.amenities)
                ? unit.amenities.map((item: any) => ({
                    id: String(item.id ?? item.amenityId ?? ''),
                    name: item.name ?? item.label ?? '',
                    isDefault: typeof item.isDefault === 'boolean' ? item.isDefault : undefined
                }))
                : undefined,
            isAvailable: unit.isAvailable ?? unit.available
        };
    }
    await delay(800);
    return {
        id: String(Date.now()),
        label: data.label,
        floor: data.floor,
        notes: data.notes,
        unitTypeId: data.unitTypeId,
        ownerId: data.ownerId,
        maintenancePayer: data.maintenancePayer,
        unitSize: data.unitSize,
        unitSizeUnit: (data.unitSizeUnit ?? "SQ_FT") as UnitSizeUnit,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        balcony: data.balcony,
        kitchenType: data.kitchenType,
        furnishedStatus: data.furnishedStatus,
        rentAnnual: data.rentAnnual,
        paymentFrequency: data.paymentFrequency,
        securityDepositAmount: data.securityDepositAmount,
        serviceChargePerUnit: data.serviceChargePerUnit,
        vatApplicable: data.vatApplicable,
        electricityMeterNumber: data.electricityMeterNumber,
        waterMeterNumber: data.waterMeterNumber,
        gasMeterNumber: data.gasMeterNumber,
        amenityIds: data.amenityIds,
        isAvailable: true
    };
}

export async function updateBuildingUnit(buildingId: string, unitId: string, data: {
    label?: string;
    floor?: number;
    notes?: string;
    unitTypeId?: string;
    ownerId?: string;
    maintenancePayer?: MaintenancePayer;
    unitSize?: number;
    unitSizeUnit?: UnitSizeUnit;
    bedrooms?: number;
    bathrooms?: number;
    balcony?: boolean;
    kitchenType?: KitchenType;
    furnishedStatus?: FurnishedStatus;
    rentAnnual?: number;
    paymentFrequency?: PaymentFrequency;
    securityDepositAmount?: number;
    serviceChargePerUnit?: number;
    vatApplicable?: boolean;
    electricityMeterNumber?: string;
    waterMeterNumber?: string;
    gasMeterNumber?: string;
    amenityIds?: string[];
    status?: UnitStatus;
}): Promise<BuildingUnit> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/units/${unitId}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
        const unit = res?.data ?? res;
        return {
            id: String(unit.id ?? unit.unitId ?? unitId),
            label: unit.label ?? unit.unitLabel ?? data.label ?? '',
            floor: unit.floor ?? unit.floorNumber ?? data.floor,
            notes: unit.notes ?? data.notes,
            unitTypeId: unit.unitTypeId ?? data.unitTypeId,
            ownerId: unit.ownerId ?? data.ownerId,
            maintenancePayer: unit.maintenancePayer ?? data.maintenancePayer,
            unitSize: unit.unitSize ? Number(unit.unitSize) : data.unitSize,
            unitSizeUnit: (unit.unitSizeUnit ?? data.unitSizeUnit ?? "SQ_FT") as UnitSizeUnit,
            bedrooms: unit.bedrooms ?? data.bedrooms,
            bathrooms: unit.bathrooms ?? data.bathrooms,
            balcony: typeof unit.balcony === 'boolean' ? unit.balcony : data.balcony,
            kitchenType: unit.kitchenType ?? data.kitchenType,
            furnishedStatus: unit.furnishedStatus ?? data.furnishedStatus,
            rentAnnual: unit.rentAnnual ? Number(unit.rentAnnual) : data.rentAnnual,
            paymentFrequency: unit.paymentFrequency ?? data.paymentFrequency,
            securityDepositAmount: unit.securityDepositAmount ? Number(unit.securityDepositAmount) : data.securityDepositAmount,
            serviceChargePerUnit: unit.serviceChargePerUnit ? Number(unit.serviceChargePerUnit) : data.serviceChargePerUnit,
            vatApplicable: typeof unit.vatApplicable === 'boolean' ? unit.vatApplicable : data.vatApplicable,
            electricityMeterNumber: unit.electricityMeterNumber ?? data.electricityMeterNumber,
            waterMeterNumber: unit.waterMeterNumber ?? data.waterMeterNumber,
            gasMeterNumber: unit.gasMeterNumber ?? data.gasMeterNumber,
            amenityIds: Array.isArray(unit.amenityIds) ? unit.amenityIds.map((id: any) => String(id)) : data.amenityIds,
            amenities: Array.isArray(unit.amenities)
                ? unit.amenities.map((item: any) => ({
                    id: String(item.id ?? item.amenityId ?? ''),
                    name: item.name ?? item.label ?? '',
                    isDefault: typeof item.isDefault === 'boolean' ? item.isDefault : undefined
                }))
                : undefined,
            isAvailable: unit.isAvailable ?? unit.available ?? (unit.status ? String(unit.status).toLowerCase() === 'available' : undefined),
            status: unit.status ?? data.status
        };
    }
    await delay(800);
    return {
        id: String(unitId),
        label: data.label ?? '',
        floor: data.floor,
        notes: data.notes,
        unitTypeId: data.unitTypeId,
        ownerId: data.ownerId,
        maintenancePayer: data.maintenancePayer,
        unitSize: data.unitSize,
        unitSizeUnit: (data.unitSizeUnit ?? "SQ_FT") as UnitSizeUnit,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        balcony: data.balcony,
        kitchenType: data.kitchenType,
        furnishedStatus: data.furnishedStatus,
        rentAnnual: data.rentAnnual,
        paymentFrequency: data.paymentFrequency,
        securityDepositAmount: data.securityDepositAmount,
        serviceChargePerUnit: data.serviceChargePerUnit,
        vatApplicable: data.vatApplicable,
        electricityMeterNumber: data.electricityMeterNumber,
        waterMeterNumber: data.waterMeterNumber,
        gasMeterNumber: data.gasMeterNumber,
        amenityIds: data.amenityIds,
        isAvailable: data.status ? String(data.status).toLowerCase() === 'available' : true,
        status: data.status
    };
}

export async function importBuildingUnitsCsv(
    buildingId: string,
    file: File,
    options?: { dryRun?: boolean; mode?: UnitsImportMode }
): Promise<UnitsImportResponse> {
    if (USE_MOCK) {
        await delay(800);
        return { dryRun: options?.dryRun ?? false, mode: options?.mode ?? "create", summary: { totalRows: 0, validRows: 0, created: 0, updated: 0 }, errors: [] };
    }

    const dryRun = options?.dryRun ?? false;
    const mode = options?.mode ?? "create";
    const query = new URLSearchParams();
    query.set("mode", mode);
    if (dryRun) {
        query.set("dryRun", "true");
    }

    const endpoint = `/org/buildings/${buildingId}/units/import?${query.toString()}`;
    if (IS_DEV) {
        console.log(`[API] Fetching: ${API_BASE_URL}${endpoint}`);
    }

    const { token, user, selectedOrgId, refreshToken } = useAuthStore.getState();
    const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const shouldAttachAuth = Boolean(token) && !isPublicEndpoint(endpoint);
    const isOrgEndpoint = normalizedEndpoint.startsWith("/org/") || normalizedEndpoint.startsWith("/notifications");
    const activeOrgId = selectedOrgId ?? user?.orgId ?? null;
    const shouldAttachOrg = isOrgEndpoint && Boolean(activeOrgId);

    const formData = new FormData();
    formData.append("file", file);
    if (IS_DEV) {
        console.log("[API] Units import payload", {
            buildingId,
            mode,
            dryRun,
            orgId: activeOrgId ?? null,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type || null,
        });
    }

    const runRequest = async (authToken?: string | null) => {
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "POST",
            headers: {
                accept: "*/*",
                ...(authToken && shouldAttachAuth ? { Authorization: `Bearer ${authToken}` } : {}),
                ...(shouldAttachOrg ? { "x-org-id": String(activeOrgId) } : {}),
            },
            body: formData,
        });
        if (IS_DEV) {
            console.log(`[API] Status: ${res.status}`);
        }
        return res;
    };

    let res = await runRequest(token ?? null);

    if (res.status === 401 && !isPublicEndpoint(endpoint) && shouldAttachAuth) {
        if (refreshToken) {
            const refreshed = await refreshSessionSingleFlight();
            if (refreshed) {
                res = await runRequest(refreshed);
            }
        }
        if (res.status === 401) {
            useAuthStore.getState().logout();
            notifyUnauthorized(endpoint, 401, refreshToken ? 'refresh_failed' : 'unauthorized');
        }
    }

    if (!res.ok) {
        let errorBody = "";
        try {
            errorBody = await res.text();
        } catch {
            errorBody = "";
        }
        if (IS_DEV) {
            console.error(`API Error: ${res.status} ${res.statusText}`);
            if (errorBody) {
                console.error(`[API] Error Body:`, errorBody);
            }
            console.error("[API] Units import debug", {
                endpoint,
                buildingId,
                mode,
                dryRun,
                orgId: activeOrgId ?? null,
                fileName: file.name,
                fileSize: file.size,
            });
        }
        const contentType = res.headers.get("content-type");
        let errorMessage = buildFriendlyErrorMessage(res.status, errorBody, contentType);
        if (errorBody) {
            try {
                const parsed = JSON.parse(errorBody);
                const parsedMessage =
                    parsed?.message ??
                    parsed?.error?.message ??
                    parsed?.error?.detail ??
                    parsed?.error?.error ??
                    parsed?.data?.message ??
                    parsed?.data?.error?.message;
                if (parsedMessage) {
                    errorMessage = parsedMessage;
                }
            } catch {
                // Keep friendly message.
            }
        }
        throw new Error(errorMessage);
    }

    const payload = await res.json();
    if (IS_DEV) {
        console.log(`[API] Data received for ${endpoint}`);
    }
    const data = payload?.data ?? payload;
    return {
        dryRun: data?.dryRun ?? dryRun,
        mode: data?.mode ?? mode,
        summary: (data?.summary ?? {}) as UnitsImportResponse["summary"],
        errors: Array.isArray(data?.errors) ? (data.errors as UnitsImportResponse["errors"]) : [],
        unitIds: Array.isArray(data?.unitIds) ? (data.unitIds as string[]) : undefined,
    };
}

export async function importParkingSlotsCsv(
    buildingId: string,
    file: File,
    options?: { dryRun?: boolean; mode?: ParkingSlotsImportMode }
): Promise<ParkingSlotsImportResponse> {
    if (USE_MOCK) {
        await delay(800);
        return { dryRun: options?.dryRun ?? false, mode: options?.mode ?? "create", summary: { totalRows: 0, validRows: 0, created: 0, updated: 0 }, errors: [] };
    }

    const dryRun = options?.dryRun ?? false;
    const mode = options?.mode ?? "create";
    const query = new URLSearchParams();
    query.set("mode", mode);
    if (dryRun) {
        query.set("dryRun", "true");
    }

    const endpoint = `/org/buildings/${buildingId}/parking-slots/import?${query.toString()}`;
    if (IS_DEV) {
        console.log(`[API] Fetching: ${API_BASE_URL}${endpoint}`);
    }

    const { token, user, selectedOrgId, refreshToken } = useAuthStore.getState();
    const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const shouldAttachAuth = Boolean(token) && !isPublicEndpoint(endpoint);
    const isOrgEndpoint = normalizedEndpoint.startsWith("/org/") || normalizedEndpoint.startsWith("/notifications");
    const activeOrgId = selectedOrgId ?? user?.orgId ?? null;
    const shouldAttachOrg = isOrgEndpoint && Boolean(activeOrgId);

    const formData = new FormData();
    formData.append("file", file);
    if (IS_DEV) {
        console.log("[API] Parking slots import payload", {
            buildingId,
            mode,
            dryRun,
            orgId: activeOrgId ?? null,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type || null,
        });
    }

    const runRequest = async (authToken?: string | null) => {
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "POST",
            headers: {
                accept: "*/*",
                ...(authToken && shouldAttachAuth ? { Authorization: `Bearer ${authToken}` } : {}),
                ...(shouldAttachOrg ? { "x-org-id": String(activeOrgId) } : {}),
            },
            body: formData,
        });
        if (IS_DEV) {
            console.log(`[API] Status: ${res.status}`);
        }
        return res;
    };

    let res = await runRequest(token ?? null);

    if (res.status === 401 && !isPublicEndpoint(endpoint) && shouldAttachAuth) {
        if (refreshToken) {
            const refreshed = await refreshSessionSingleFlight();
            if (refreshed) {
                res = await runRequest(refreshed);
            }
        }
        if (res.status === 401) {
            useAuthStore.getState().logout();
            notifyUnauthorized(endpoint, 401, refreshToken ? 'refresh_failed' : 'unauthorized');
        }
    }

    if (!res.ok) {
        let errorBody = "";
        try {
            errorBody = await res.text();
        } catch {
            errorBody = "";
        }
        if (IS_DEV) {
            console.error(`API Error: ${res.status} ${res.statusText}`);
            if (errorBody) {
                console.error(`[API] Error Body:`, errorBody);
            }
            console.error("[API] Parking slots import debug", {
                endpoint,
                buildingId,
                mode,
                dryRun,
                orgId: activeOrgId ?? null,
                fileName: file.name,
                fileSize: file.size,
            });
        }
        const contentType = res.headers.get("content-type");
        let errorMessage = buildFriendlyErrorMessage(res.status, errorBody, contentType);
        if (errorBody) {
            try {
                const parsed = JSON.parse(errorBody);
                const parsedMessage =
                    parsed?.message ??
                    parsed?.error?.message ??
                    parsed?.error?.detail ??
                    parsed?.error?.error ??
                    parsed?.data?.message ??
                    parsed?.data?.error?.message;
                if (parsedMessage) {
                    errorMessage = parsedMessage;
                }
            } catch {
                // Keep friendly message.
            }
        }
        throw new Error(errorMessage);
    }

    const payload = await res.json();
    if (IS_DEV) {
        console.log(`[API] Data received for ${endpoint}`);
    }
    const data = payload?.data ?? payload;
    return {
        dryRun: data?.dryRun ?? dryRun,
        mode: data?.mode ?? mode,
        summary: (data?.summary ?? {}) as ParkingSlotsImportResponse["summary"],
        errors: Array.isArray(data?.errors) ? (data.errors as ParkingSlotsImportResponse["errors"]) : [],
        slotIds: Array.isArray(data?.slotIds) ? (data.slotIds as string[]) : undefined,
    };
}
