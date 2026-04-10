import type { AccessItemStatus, ContractMoveRequest, ContractMoveRequestStatusFilter, CreateContractDto, CreateContractMoveRequestDto, CreateLeaseAccessCardsDto, CreateLeaseDocumentDto, CreateLeaseParkingStickersDto, Lease, LeaseAccessCard, LeaseDocument, LeaseDocumentType, LeaseHistoryEntry, LeaseOccupant, LeaseParkingSticker, LeaseTimelineItem, LeaseTimelineQuery, LeaseTimelineResponse, OrgLeasesQuery, OrgLeasesResponse, RejectContractMoveRequestDto, ReplaceLeaseOccupantsDto, ResidentLeaseListItem, ResidentLeaseListQuery, ResidentLeaseListResponse, ResidentLeaseTimelineQuery, UpdateAccessItemStatusDto, UpdateLeaseDto } from '../types';
import { deriveLeaseDisplayStatus, normalizeLeaseStatus } from '../leaseStatus';
import { delay, USE_MOCK } from './config';
import { fetchJson, fetchJsonWithFallback } from './client';
import { getArray } from './shared';

// --- Lease Sub-Resource Functions ---

function normalizeLeaseAccessCard(card: any): LeaseAccessCard {
    return {
        id: String(card.id ?? card.accessCardId ?? ''),
        leaseId: String(card.leaseId ?? ''),
        cardNumber: String(card.cardNumber ?? card.card_number ?? ''),
        status: (card.status ?? 'ISSUED') as AccessItemStatus,
        createdAt: card.createdAt ?? card.created_at ?? new Date().toISOString(),
        updatedAt: card.updatedAt ?? card.updated_at ?? new Date().toISOString()
    };
}

function normalizeLeaseParkingSticker(sticker: any): LeaseParkingSticker {
    return {
        id: String(sticker.id ?? sticker.parkingStickerId ?? ''),
        leaseId: String(sticker.leaseId ?? ''),
        stickerNumber: String(sticker.stickerNumber ?? sticker.sticker_number ?? ''),
        status: (sticker.status ?? 'ISSUED') as AccessItemStatus,
        createdAt: sticker.createdAt ?? sticker.created_at ?? new Date().toISOString(),
        updatedAt: sticker.updatedAt ?? sticker.updated_at ?? new Date().toISOString()
    };
}

function normalizeLeaseOccupant(occupant: any): LeaseOccupant {
    return {
        id: String(occupant.id ?? occupant.occupantId ?? ''),
        leaseId: String(occupant.leaseId ?? ''),
        name: String(occupant.name ?? ''),
        createdAt: occupant.createdAt ?? occupant.created_at ?? new Date().toISOString(),
        updatedAt: occupant.updatedAt ?? occupant.updated_at ?? new Date().toISOString()
    };
}

export async function listLeaseAccessCards(leaseId: string): Promise<LeaseAccessCard[]> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/leases/${leaseId}/access-cards`);
        const data = getArray(res);
        return data.map(normalizeLeaseAccessCard);
    }
    await delay(800);
    return [];
}

export async function createLeaseAccessCards(
    leaseId: string,
    dto: CreateLeaseAccessCardsDto
): Promise<LeaseAccessCard[]> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/leases/${leaseId}/access-cards`, {
            method: 'POST',
            body: JSON.stringify(dto)
        });
        const data = getArray(res);
        return data.map(normalizeLeaseAccessCard);
    }
    await delay(800);
    return dto.cardNumbers.map((cardNumber, index) => ({
        id: `ac-${Date.now()}-${index}`,
        leaseId,
        cardNumber,
        status: 'ISSUED' as AccessItemStatus,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }));
}

export async function updateLeaseAccessCardStatus(
    leaseId: string,
    cardId: string,
    dto: UpdateAccessItemStatusDto
): Promise<LeaseAccessCard> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/leases/${leaseId}/access-cards/${cardId}`, {
            method: 'PATCH',
            body: JSON.stringify(dto)
        });
        const card = res?.data ?? res;
        return normalizeLeaseAccessCard(card);
    }
    await delay(800);
    return {
        id: cardId,
        leaseId,
        cardNumber: 'MOCK-CARD',
        status: dto.status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

export async function deleteLeaseAccessCard(leaseId: string, cardId: string): Promise<void> {
    if (!USE_MOCK) {
        await fetchJson(`/org/leases/${leaseId}/access-cards/${cardId}`, {
            method: 'DELETE'
        });
        return;
    }
    await delay(800);
}

export async function listLeaseParkingStickers(leaseId: string): Promise<LeaseParkingSticker[]> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/leases/${leaseId}/parking-stickers`);
        const data = getArray(res);
        return data.map(normalizeLeaseParkingSticker);
    }
    await delay(800);
    return [];
}

export async function createLeaseParkingStickers(
    leaseId: string,
    dto: CreateLeaseParkingStickersDto
): Promise<LeaseParkingSticker[]> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/leases/${leaseId}/parking-stickers`, {
            method: 'POST',
            body: JSON.stringify(dto)
        });
        const data = getArray(res);
        return data.map(normalizeLeaseParkingSticker);
    }
    await delay(800);
    return dto.stickerNumbers.map((stickerNumber, index) => ({
        id: `ps-${Date.now()}-${index}`,
        leaseId,
        stickerNumber,
        status: 'ISSUED' as AccessItemStatus,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }));
}

export async function updateLeaseParkingStickerStatus(
    leaseId: string,
    stickerId: string,
    dto: UpdateAccessItemStatusDto
): Promise<LeaseParkingSticker> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/leases/${leaseId}/parking-stickers/${stickerId}`, {
            method: 'PATCH',
            body: JSON.stringify(dto)
        });
        const sticker = res?.data ?? res;
        return normalizeLeaseParkingSticker(sticker);
    }
    await delay(800);
    return {
        id: stickerId,
        leaseId,
        stickerNumber: 'MOCK-STICKER',
        status: dto.status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

export async function deleteLeaseParkingSticker(leaseId: string, stickerId: string): Promise<void> {
    if (!USE_MOCK) {
        await fetchJson(`/org/leases/${leaseId}/parking-stickers/${stickerId}`, {
            method: 'DELETE'
        });
        return;
    }
    await delay(800);
}

export async function getLeaseOccupants(leaseId: string): Promise<LeaseOccupant[]> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/leases/${leaseId}/occupants`);
        const data = getArray(res);
        return data.map(normalizeLeaseOccupant);
    }
    await delay(800);
    return [];
}

export async function replaceLeaseOccupants(
    leaseId: string,
    dto: ReplaceLeaseOccupantsDto
): Promise<LeaseOccupant[]> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/leases/${leaseId}/occupants`, {
            method: 'PUT',
            body: JSON.stringify(dto)
        });
        const data = getArray(res);
        return data.map(normalizeLeaseOccupant);
    }
    await delay(800);
    return dto.names.map((name, index) => ({
        id: `occ-${Date.now()}-${index}`,
        leaseId,
        name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }));
}

// --- Lease Core Functions ---

function normalizeLease(lease: any): Lease {
    const unitSource = lease?.unit ?? lease?.unitInfo ?? lease?.unitDetails ?? {};
    const unitLabel =
        unitSource?.label ??
        lease?.unitLabel ??
        lease?.unitNumber ??
        unitSource?.name ??
        unitSource?.unitNumber;
    const residentSource =
        lease?.resident ??
        lease?.residentUser ??
        lease?.user ??
        lease?.tenant ??
        lease?.occupancy?.resident ??
        lease?.occupancy?.tenant;
    const residentName =
        residentSource?.name ??
        residentSource?.fullName ??
        lease?.residentName ??
        lease?.occupancy?.residentName ??
        lease?.tenantNameSnapshot;
    const residentEmail =
        residentSource?.email ??
        residentSource?.emailAddress ??
        lease?.residentEmail ??
        lease?.occupancy?.residentEmail ??
        lease?.tenantEmailSnapshot;
    const residentId =
        residentSource?.id ??
        residentSource?.userId ??
        lease?.residentId ??
        lease?.residentUserId ??
        lease?.occupancy?.residentUserId ??
        lease?.occupancy?.resident?.id;

    return {
        id: String(lease.id ?? lease.contractId ?? lease.leaseId ?? ''),
        buildingId: String(lease.buildingId ?? ''),
        unitId: String(lease.unitId ?? ''),
        residentUserId: String(lease.residentUserId ?? residentId ?? ''),
        occupancyId: lease.occupancyId != null
            ? String(lease.occupancyId)
            : (lease?.occupancy?.id != null
                ? String(lease.occupancy.id)
                : (lease?.occupancy?.occupancyId != null ? String(lease.occupancy.occupancyId) : null)),
        status: normalizeLeaseStatus(lease.status),
        displayStatus: deriveLeaseDisplayStatus(lease.status, lease),
        leaseStartDate: lease.contractPeriodFrom ?? lease.leaseStartDate ?? lease.startDate ?? '',
        leaseEndDate: lease.contractPeriodTo ?? lease.leaseEndDate ?? lease.endDate ?? '',
        contractPeriodFrom: lease.contractPeriodFrom ?? lease.leaseStartDate ?? lease.startDate ?? undefined,
        contractPeriodTo: lease.contractPeriodTo ?? lease.leaseEndDate ?? lease.endDate ?? undefined,
        ijariId: lease.ijariId ?? lease.tenancyRegistrationId ?? null,
        contractDate: lease.contractDate ?? null,
        propertyUsage: lease.propertyUsage ?? null,
        ownerNameSnapshot: lease.ownerNameSnapshot ?? null,
        landlordNameSnapshot: lease.landlordNameSnapshot ?? null,
        landlordEmailSnapshot: lease.landlordEmailSnapshot ?? null,
        landlordPhoneSnapshot: lease.landlordPhoneSnapshot ?? null,
        tenantNameSnapshot: lease.tenantNameSnapshot ?? null,
        tenantEmailSnapshot: lease.tenantEmailSnapshot ?? null,
        tenantPhoneSnapshot: lease.tenantPhoneSnapshot ?? null,
        buildingNameSnapshot: lease.buildingNameSnapshot ?? null,
        locationCommunity: lease.locationCommunity ?? null,
        propertySizeSqm: lease.propertySizeSqm != null ? String(lease.propertySizeSqm) : null,
        propertyTypeLabel: lease.propertyTypeLabel ?? null,
        propertyNumber: lease.propertyNumber ?? null,
        premisesNoDewa: lease.premisesNoDewa ?? null,
        plotNo: lease.plotNo ?? null,
        annualRent: String(lease.annualRent ?? '0'),
        paymentFrequency: lease.paymentFrequency ?? 'MONTHLY',
        numberOfCheques: lease.numberOfCheques,
        securityDepositAmount: String(lease.securityDepositAmount ?? '0'),
        contractValue: lease.contractValue != null ? String(lease.contractValue) : undefined,
        paymentModeText: lease.paymentModeText,
        additionalTerms: Array.isArray(lease.additionalTerms)
            ? lease.additionalTerms.map((term: any) => String(term))
            : undefined,
        internetTvProvider: lease.internetTvProvider,
        serviceChargesPaidBy: lease.serviceChargesPaidBy,
        vatApplicable: lease.vatApplicable,
        notes: lease.notes,
        firstPaymentReceived: lease.firstPaymentReceived,
        firstPaymentAmount: lease.firstPaymentAmount ? String(lease.firstPaymentAmount) : undefined,
        depositReceived: lease.depositReceived,
        depositReceivedAmount: lease.depositReceivedAmount ? String(lease.depositReceivedAmount) : undefined,
        actualMoveOutDate:
            lease.actualMoveOutDate ??
            lease.actual_move_out_date ??
            lease.moveOutDate ??
            lease.move_out_date ??
            lease.movedOutAt ??
            lease.moved_out_at ??
            lease.occupancyEndAt ??
            lease.occupancy_end_at ??
            lease?.occupancy?.endedAt ??
            lease?.occupancy?.ended_at ??
            lease?.occupancy?.endAt ??
            lease?.occupancy?.end_at ??
            null,
        tenancyRegistrationExpiry: lease.tenancyRegistrationExpiry ?? lease.tenancyRegistrationExpiryDate,
        noticeGivenDate: lease.noticeGivenDate ?? lease.noticeDate,
        createdAt: lease.createdAt ?? new Date().toISOString(),
        updatedAt: lease.updatedAt ?? new Date().toISOString(),
        unit: unitLabel || unitSource ? {
            id: String(unitSource?.id ?? lease.unitId ?? ''),
            label: String(unitLabel ?? unitSource?.label ?? ''),
            floor: unitSource?.floor ?? unitSource?.floorNumber,
            bedrooms: unitSource?.bedrooms ?? undefined,
            bathrooms: unitSource?.bathrooms ?? undefined,
            unitSize: unitSource?.unitSize ? Number(unitSource.unitSize) : undefined,
            unitSizeUnit: unitSource?.unitSizeUnit ?? undefined,
            furnishedStatus: unitSource?.furnishedStatus ?? undefined,
            unitType: unitSource?.unitType
                ? {
                    id: String(unitSource.unitType.id ?? unitSource.unitTypeId ?? ''),
                    name: unitSource.unitType.name ?? unitSource.unitType.label ?? unitSource.unitType.key,
                }
                : (unitSource?.unitTypeId ? { id: String(unitSource.unitTypeId) } : null),
        } : undefined,
        resident: (residentId || residentName || residentEmail) ? {
            id: String(residentId ?? ''),
            name: residentName,
            email: residentEmail
        } : undefined
    };
}

function normalizeLeaseDocument(doc: any): LeaseDocument {
    return {
        id: String(doc.id ?? doc.documentId ?? ''),
        leaseId: String(doc.leaseId ?? doc.contractId ?? ''),
        type: (doc.type ?? 'OTHER') as LeaseDocumentType,
        fileName: String(doc.fileName ?? doc.filename ?? ''),
        mimeType: String(doc.mimeType ?? doc.contentType ?? ''),
        sizeBytes: Number(doc.sizeBytes ?? doc.size ?? 0),
        url: String(doc.url ?? doc.fileUrl ?? ''),
        createdAt: doc.createdAt ?? new Date().toISOString(),
        updatedAt: doc.updatedAt ?? new Date().toISOString()
    };
}

function normalizeLeaseHistoryEntry(entry: any): LeaseHistoryEntry {
    const rawChanges = entry?.changes && typeof entry.changes === 'object' ? entry.changes : {};
    const normalizedChanges = Object.entries(rawChanges).reduce<Record<string, { from: string | number | boolean | null; to: string | number | boolean | null }>>((acc, [field, change]) => {
        const value = (change && typeof change === 'object' ? change : {}) as { from?: unknown; to?: unknown };
        const normalizeValue = (input: unknown): string | number | boolean | null => {
            if (input === null || input === undefined) return null;
            if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') return input;
            return JSON.stringify(input);
        };
        acc[field] = {
            from: normalizeValue(value.from),
            to: normalizeValue(value.to),
        };
        return acc;
    }, {});
    const actor = entry?.changedByUser ?? entry?.actor ?? entry?.user ?? null;
    return {
        id: String(entry?.id ?? `${entry?.action ?? 'UPDATED'}-${entry?.createdAt ?? Date.now()}`),
        action: (entry?.action ?? 'UPDATED') as LeaseHistoryEntry["action"],
        createdAt: entry?.createdAt ?? new Date().toISOString(),
        changedByUser: actor ? {
            id: String(actor?.id ?? actor?.userId ?? ''),
            name: actor?.name ?? actor?.fullName,
            email: actor?.email ?? actor?.emailAddress,
        } : null,
        changes: normalizedChanges
    };
}

function normalizeActor(actor: any) {
    if (!actor) return null;
    return {
        id: String(actor?.id ?? actor?.userId ?? ''),
        name: actor?.name ?? actor?.fullName ?? undefined,
        email: actor?.email ?? actor?.emailAddress ?? undefined,
    };
}

function normalizeHistoryChanges(rawChanges: any) {
    const changes = rawChanges && typeof rawChanges === 'object' ? rawChanges : {};
    return Object.entries(changes).reduce<Record<string, { from: string | number | boolean | null; to: string | number | boolean | null }>>((acc, [field, change]) => {
        const value = (change && typeof change === 'object' ? change : {}) as { from?: unknown; to?: unknown };
        const normalizeValue = (input: unknown): string | number | boolean | null => {
            if (input === null || input === undefined) return null;
            if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') return input;
            return JSON.stringify(input);
        };
        acc[field] = {
            from: normalizeValue(value.from),
            to: normalizeValue(value.to),
        };
        return acc;
    }, {});
}

function normalizeResidentLeaseListItem(item: any): ResidentLeaseListItem {
    const buildingSource = item?.building ?? item?.buildingInfo ?? {};
    const unitSource = item?.unit ?? item?.unitInfo ?? {};
    return {
        leaseId: String(item?.contractId ?? item?.leaseId ?? item?.id ?? ''),
        status: normalizeLeaseStatus(item?.status),
        displayStatus: deriveLeaseDisplayStatus(item?.status, item),
        leaseStartDate: String(item?.contractPeriodFrom ?? item?.leaseStartDate ?? item?.startDate ?? ''),
        leaseEndDate: String(item?.contractPeriodTo ?? item?.leaseEndDate ?? item?.endDate ?? ''),
        actualMoveOutDate:
            item?.actualMoveOutDate ??
            item?.actual_move_out_date ??
            item?.moveOutDate ??
            item?.move_out_date ??
            item?.movedOutAt ??
            item?.moved_out_at ??
            item?.occupancyEndAt ??
            item?.occupancy_end_at ??
            item?.occupancy?.endedAt ??
            item?.occupancy?.ended_at ??
            item?.occupancy?.endAt ??
            item?.occupancy?.end_at ??
            null,
        occupancyId: item?.occupancyId ? String(item.occupancyId) : null,
        building: item?.buildingId || buildingSource?.id || buildingSource?.name
            ? {
                id: String(item?.buildingId ?? buildingSource?.id ?? buildingSource?.buildingId ?? ''),
                name: buildingSource?.name ?? buildingSource?.label ?? item?.buildingName ?? item?.buildingLabel ?? null,
            }
            : null,
        unit: item?.unitId || unitSource?.id || unitSource?.label
            ? {
                id: String(item?.unitId ?? unitSource?.id ?? ''),
                label: unitSource?.label ?? unitSource?.name ?? item?.unitLabel ?? null,
            }
            : null,
    };
}

function normalizeLeaseTimelineItem(entry: any): LeaseTimelineItem {
    const rawSource = String(entry?.source ?? '').toUpperCase();
    const source = rawSource === 'ACTIVITY' ? 'ACTIVITY' : 'HISTORY';
    const actor = normalizeActor(entry?.changedByUser ?? entry?.actor ?? entry?.user);
    const historyChanges = normalizeHistoryChanges(entry?.changes);
    const leaseSource = entry?.contract ?? entry?.contractContext ?? entry?.lease ?? entry?.leaseContext ?? null;
    const leaseId = entry?.contractId ?? entry?.leaseId ?? leaseSource?.contractId ?? leaseSource?.leaseId ?? leaseSource?.id;
    const normalizedPayload =
        entry?.payload && typeof entry.payload === 'object'
            ? entry.payload as Record<string, unknown>
            : Object.keys(historyChanges).length > 0
                ? { changes: historyChanges }
                : null;
    return {
        id: String(entry?.id ?? `${source}-${entry?.action ?? 'UPDATED'}-${entry?.createdAt ?? Date.now()}`),
        source,
        action: String(entry?.action ?? 'UPDATED'),
        createdAt: entry?.createdAt ?? new Date().toISOString(),
        changedByUser: actor,
        payload: normalizedPayload,
        leaseId: leaseId ? String(leaseId) : undefined,
        lease: leaseId || leaseSource || entry?.buildingId || entry?.unitId
            ? {
                leaseId: leaseId ? String(leaseId) : undefined,
                status: normalizeLeaseStatus(entry?.status ?? leaseSource?.status),
                displayStatus: deriveLeaseDisplayStatus(entry?.status ?? leaseSource?.status, entry ?? leaseSource, entry?.action),
                leaseStartDate:
                    entry?.contractPeriodFrom ??
                    entry?.leaseStartDate ??
                    leaseSource?.contractPeriodFrom ??
                    leaseSource?.leaseStartDate ??
                    leaseSource?.startDate ??
                    null,
                leaseEndDate:
                    entry?.contractPeriodTo ??
                    entry?.leaseEndDate ??
                    leaseSource?.contractPeriodTo ??
                    leaseSource?.leaseEndDate ??
                    leaseSource?.endDate ??
                    null,
                buildingId: entry?.buildingId ?? leaseSource?.buildingId,
                unitId: entry?.unitId ?? leaseSource?.unitId,
            }
            : null,
    };
}

export async function getOrgLeases(query?: OrgLeasesQuery): Promise<OrgLeasesResponse> {
    if (!USE_MOCK) {
        const searchParams = new URLSearchParams();
        if (query?.status) searchParams.set('status', query.status);
        if (query?.buildingId) searchParams.set('buildingId', query.buildingId);
        if (query?.unitId) searchParams.set('unitId', query.unitId);
        if (query?.residentUserId) searchParams.set('residentUserId', query.residentUserId);
        if (query?.q) searchParams.set('q', query.q);
        if (query?.date_from) searchParams.set('date_from', query.date_from);
        if (query?.date_to) searchParams.set('date_to', query.date_to);
        if (query?.order) searchParams.set('order', query.order);
        if (query?.cursor) searchParams.set('cursor', query.cursor);
        if (typeof query?.limit === 'number') searchParams.set('limit', String(query.limit));
        const qs = searchParams.toString();
        const primaryEndpoint = `/org/contracts${qs ? `?${qs}` : ''}`;
        const fallbackEndpoint = `/org/leases${qs ? `?${qs}` : ''}`;
        const res = await fetchJsonWithFallback(primaryEndpoint, fallbackEndpoint);
        const payload = res?.data ?? res ?? {};
        const items = getArray(payload).map(normalizeLease);
        return {
            items,
            nextCursor: payload?.nextCursor ?? payload?.cursor ?? null,
        };
    }
    await delay(800);
    return { items: [], nextCursor: null };
}

export async function getActiveLeaseForUnit(buildingId: string, unitId: string): Promise<Lease | null> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/units/${unitId}/lease/active`);
        const payload = res?.data ?? res;
        // 200 + null means no active lease - this is not an error
        if (!payload) return null;
        return normalizeLease(payload);
    }
    await delay(800);
    return null;
}

export async function getLeaseById(leaseId: string): Promise<Lease> {
    if (!USE_MOCK) {
        const contractRes = await fetchJsonWithFallback(`/org/contracts/${leaseId}`, `/org/leases/${leaseId}`);
        const payload = contractRes?.data ?? contractRes;
        let leasePayload: any = null;

        try {
            const leaseRes = await fetchJson(`/org/leases/${leaseId}`, undefined, { silentStatusCodes: [404] });
            leasePayload = leaseRes?.data ?? leaseRes;
        } catch (error) {
            const status = (error as { status?: unknown })?.status;
            if (status !== 404) {
                throw error;
            }
        }

        const mergedPayload = leasePayload ? { ...payload, ...leasePayload } : payload;
        return normalizeLease(mergedPayload);
    }
    await delay(800);
    return {
        id: leaseId,
        buildingId: 'mock-building',
        unitId: 'mock-unit',
        residentUserId: 'mock-resident',
        status: 'ACTIVE',
        leaseStartDate: new Date().toISOString(),
        leaseEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        annualRent: '50000',
        paymentFrequency: 'MONTHLY',
        securityDepositAmount: '5000',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

export async function updateLease(leaseId: string, dto: UpdateLeaseDto): Promise<Lease> {
    if (!USE_MOCK) {
        const leaseOnlyKeys: Array<keyof UpdateLeaseDto> = [
            'tenancyRegistrationExpiry',
            'noticeGivenDate',
            'firstPaymentAmount',
            'depositReceivedAmount',
            'internetTvProvider',
            'notes',
            'serviceChargesPaidBy',
            'vatApplicable',
            'firstPaymentReceived',
            'depositReceived',
        ];
        const leaseOnlyKeySet = new Set<keyof UpdateLeaseDto>(leaseOnlyKeys);
        const contractPatch: UpdateLeaseDto = {};
        const leasePatch: UpdateLeaseDto = {};

        (Object.entries(dto) as Array<[keyof UpdateLeaseDto, UpdateLeaseDto[keyof UpdateLeaseDto]]>).forEach(([key, value]) => {
            if (key === 'leaseStartDate' || key === 'leaseEndDate') {
                return;
            }
            if (leaseOnlyKeySet.has(key)) {
                leasePatch[key] = value as never;
                return;
            }
            contractPatch[key] = value as never;
        });

        if (dto.contractPeriodFrom ?? dto.leaseStartDate) {
            contractPatch.contractPeriodFrom = dto.contractPeriodFrom ?? dto.leaseStartDate;
        }
        if (dto.contractPeriodTo ?? dto.leaseEndDate) {
            contractPatch.contractPeriodTo = dto.contractPeriodTo ?? dto.leaseEndDate;
        }

        let latestPayload: any = null;

        if (Object.keys(contractPatch).length > 0) {
            const res = await fetchJsonWithFallback(`/org/contracts/${leaseId}`, `/org/leases/${leaseId}`, {
                method: 'PATCH',
                body: JSON.stringify(contractPatch)
            });
            latestPayload = res?.data ?? res;
        }

        if (Object.keys(leasePatch).length > 0) {
            const res = await fetchJson(`/org/leases/${leaseId}`, {
                method: 'PATCH',
                body: JSON.stringify(leasePatch)
            });
            const leasePayload = res?.data ?? res;
            latestPayload = latestPayload ? { ...latestPayload, ...leasePayload } : leasePayload;
        }

        return normalizeLease(latestPayload ?? { id: leaseId, ...dto });
    }
    await delay(800);
    const existingLease = await getLeaseById(leaseId);
    return normalizeLease({
        ...existingLease,
        ...dto,
        updatedAt: new Date().toISOString()
    });
}

export async function getLeaseHistory(leaseId: string): Promise<LeaseHistoryEntry[]> {
    if (!USE_MOCK) {
        const res = await fetchJsonWithFallback(`/org/contracts/${leaseId}/history`, `/org/leases/${leaseId}/history`);
        const entries = getArray(res);
        return entries.map(normalizeLeaseHistoryEntry);
    }
    await delay(800);
    return [];
}

export async function getResidentLeases(
    userId: string,
    query?: ResidentLeaseListQuery
): Promise<ResidentLeaseListResponse> {
    if (!USE_MOCK) {
        const searchParams = new URLSearchParams();
        if (query?.status) searchParams.set('status', query.status);
        if (query?.order) searchParams.set('order', query.order);
        if (query?.cursor) searchParams.set('cursor', query.cursor);
        if (typeof query?.limit === 'number') searchParams.set('limit', String(query.limit));
        const qs = searchParams.toString();
        const primaryEndpoint = `/org/residents/${userId}/contracts${qs ? `?${qs}` : ''}`;
        const fallbackEndpoint = `/org/residents/${userId}/leases${qs ? `?${qs}` : ''}`;
        const res = await fetchJsonWithFallback(primaryEndpoint, fallbackEndpoint);
        const payload = res?.data ?? res ?? {};
        const rows = getArray(payload);
        return {
            items: rows.map(normalizeResidentLeaseListItem),
            nextCursor: payload?.nextCursor ?? payload?.cursor ?? null,
        };
    }
    await delay(800);
    return { items: [], nextCursor: null };
}

export async function getResidentLeaseTimeline(
    userId: string,
    query?: ResidentLeaseTimelineQuery
): Promise<LeaseTimelineResponse> {
    if (!USE_MOCK) {
        const searchParams = new URLSearchParams();
        if (query?.action) searchParams.set('action', query.action);
        if (query?.order) searchParams.set('order', query.order);
        if (query?.cursor) searchParams.set('cursor', query.cursor);
        if (typeof query?.limit === 'number') searchParams.set('limit', String(query.limit));
        const qs = searchParams.toString();
        const primaryEndpoint = `/org/residents/${userId}/contracts/timeline${qs ? `?${qs}` : ''}`;
        const fallbackEndpoint = `/org/residents/${userId}/leases/timeline${qs ? `?${qs}` : ''}`;
        const res = await fetchJsonWithFallback(primaryEndpoint, fallbackEndpoint);
        const payload = res?.data ?? res ?? {};
        const rows = getArray(payload);
        return {
            items: rows.map((entry: any) => normalizeLeaseTimelineItem({ ...entry, source: 'HISTORY' })),
            nextCursor: payload?.nextCursor ?? payload?.cursor ?? null,
        };
    }
    await delay(800);
    return { items: [], nextCursor: null };
}

export async function getLeaseTimeline(
    leaseId: string,
    query?: LeaseTimelineQuery
): Promise<LeaseTimelineResponse> {
    if (!USE_MOCK) {
        const searchParams = new URLSearchParams();
        if (query?.source) searchParams.set('source', query.source);
        if (query?.historyAction) searchParams.set('historyAction', query.historyAction);
        if (query?.activityAction) searchParams.set('activityAction', query.activityAction);
        if (query?.date_from) searchParams.set('date_from', query.date_from);
        if (query?.date_to) searchParams.set('date_to', query.date_to);
        if (query?.order) searchParams.set('order', query.order);
        if (query?.cursor) searchParams.set('cursor', query.cursor);
        if (typeof query?.limit === 'number') searchParams.set('limit', String(query.limit));
        const qs = searchParams.toString();
        const primaryEndpoint = `/org/contracts/${leaseId}/timeline${qs ? `?${qs}` : ''}`;
        const fallbackEndpoint = `/org/leases/${leaseId}/timeline${qs ? `?${qs}` : ''}`;
        const res = await fetchJsonWithFallback(primaryEndpoint, fallbackEndpoint);
        const payload = res?.data ?? res ?? {};
        const rows = getArray(payload);
        return {
            items: rows.map(normalizeLeaseTimelineItem),
            nextCursor: payload?.nextCursor ?? payload?.cursor ?? null,
        };
    }
    await delay(800);
    return { items: [], nextCursor: null };
}

function normalizeContractMoveRequest(request: any): ContractMoveRequest {
    const status = String(request?.status ?? 'PENDING').toUpperCase();
    const resident = request?.resident ?? request?.residentInfo ?? null;
    const unit = request?.unit ?? request?.unitInfo ?? null;
    return {
        id: String(request?.id ?? request?.requestId ?? ''),
        contractId: request?.contractId != null ? String(request.contractId) : undefined,
        leaseId: request?.leaseId != null ? String(request.leaseId) : undefined,
        residentUserId: String(request?.residentUserId ?? request?.residentId ?? ''),
        buildingId: String(request?.buildingId ?? ''),
        unitId: String(request?.unitId ?? ''),
        status: status as ContractMoveRequest['status'],
        requestedMoveAt: String(request?.requestedMoveAt ?? request?.requestedAt ?? ''),
        notes: request?.notes ?? null,
        reviewedByUserId: request?.reviewedByUserId != null ? String(request.reviewedByUserId) : null,
        reviewedAt: request?.reviewedAt ?? null,
        rejectionReason: request?.rejectionReason ?? null,
        createdAt: request?.createdAt ?? new Date().toISOString(),
        updatedAt: request?.updatedAt ?? new Date().toISOString(),
        resident: resident || request?.residentUserId || request?.residentId
            ? {
                id: resident?.id != null
                    ? String(resident.id)
                    : request?.residentUserId != null
                        ? String(request.residentUserId)
                        : request?.residentId != null
                            ? String(request.residentId)
                            : undefined,
                name: resident?.name ?? resident?.fullName ?? null,
                email: resident?.email ?? null,
            }
            : undefined,
        unit: unit || request?.unitId
            ? {
                id: unit?.id != null
                    ? String(unit.id)
                    : request?.unitId != null
                        ? String(request.unitId)
                        : undefined,
                label: unit?.label ?? unit?.name ?? request?.unitLabel ?? null,
            }
            : undefined,
    };
}

export async function createContract(buildingId: string, dto: CreateContractDto): Promise<Lease> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/contracts`, {
            method: 'POST',
            body: JSON.stringify(dto),
        });
        const payload = res?.data ?? res;
        return normalizeLease(payload);
    }
    await delay(800);
    return normalizeLease({
        id: `contract-${Date.now()}`,
        buildingId,
        ...dto,
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });
}

export async function activateContract(contractId: string): Promise<Lease> {
    if (!USE_MOCK) {
        const res = await fetchJsonWithFallback(
            `/org/contracts/${contractId}/activate`,
            `/org/leases/${contractId}/activate`,
            { method: 'POST' }
        );
        const payload = res?.data ?? res;
        return normalizeLease(payload);
    }
    await delay(800);
    return normalizeLease({ id: contractId, status: 'ACTIVE' });
}

export async function cancelContract(contractId: string, reason?: string): Promise<Lease> {
    if (!USE_MOCK) {
        const res = await fetchJsonWithFallback(
            `/org/contracts/${contractId}/cancel`,
            `/org/leases/${contractId}/cancel`,
            {
                method: 'POST',
                body: reason ? JSON.stringify({ reason }) : undefined,
            }
        );
        const payload = res?.data ?? res;
        return normalizeLease(payload);
    }
    await delay(800);
    return normalizeLease({ id: contractId, status: 'CANCELLED' });
}

export async function replaceContractTerms(contractId: string, terms: string[]): Promise<Lease> {
    if (!USE_MOCK) {
        const res = await fetchJsonWithFallback(
            `/org/contracts/${contractId}/additional-terms`,
            `/org/leases/${contractId}/additional-terms`,
            {
                method: 'PUT',
                body: JSON.stringify({ terms }),
            }
        );
        const payload = res?.data ?? res;
        return normalizeLease(payload);
    }
    await delay(800);
    return normalizeLease({ id: contractId, additionalTerms: terms });
}

export async function getLatestContractForResident(userId: string): Promise<Lease | null> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJsonWithFallback(
                `/org/residents/${userId}/contracts/latest`,
                `/org/residents/${userId}/leases/latest`
            );
            const payload = res?.data ?? res;
            if (!payload) return null;
            return normalizeLease(payload);
        } catch (error) {
            const status = (error as { status?: unknown })?.status;
            if (status === 404) return null;
            throw error;
        }
    }
    await delay(800);
    return null;
}

export async function createMoveInRequest(
    contractId: string,
    dto: CreateContractMoveRequestDto
): Promise<ContractMoveRequest> {
    if (!USE_MOCK) {
        const res = await fetchJsonWithFallback(
            `/resident/contracts/${contractId}/move-in-requests`,
            `/resident/leases/${contractId}/move-in-requests`,
            {
                method: 'POST',
                body: JSON.stringify(dto),
            }
        );
        const payload = res?.data ?? res;
        return normalizeContractMoveRequest(payload);
    }
    await delay(800);
    return normalizeContractMoveRequest({
        id: `move-in-${Date.now()}`,
        contractId,
        status: 'PENDING',
        ...dto,
    });
}

export async function createMoveOutRequest(
    contractId: string,
    dto: CreateContractMoveRequestDto
): Promise<ContractMoveRequest> {
    if (!USE_MOCK) {
        const res = await fetchJsonWithFallback(
            `/resident/contracts/${contractId}/move-out-requests`,
            `/resident/leases/${contractId}/move-out-requests`,
            {
                method: 'POST',
                body: JSON.stringify(dto),
            }
        );
        const payload = res?.data ?? res;
        return normalizeContractMoveRequest(payload);
    }
    await delay(800);
    return normalizeContractMoveRequest({
        id: `move-out-${Date.now()}`,
        contractId,
        status: 'PENDING',
        ...dto,
    });
}

export async function listMoveInRequests(
    buildingId: string,
    status?: ContractMoveRequestStatusFilter
): Promise<ContractMoveRequest[]> {
    if (!USE_MOCK) {
        const searchParams = new URLSearchParams();
        if (status && status !== 'ALL') searchParams.set('status', status);
        const query = searchParams.toString();
        const res = await fetchJson(`/org/buildings/${buildingId}/move-in-requests${query ? `?${query}` : ''}`);
        const payload = res?.data ?? res ?? {};
        return getArray(payload).map(normalizeContractMoveRequest);
    }
    await delay(800);
    return [];
}

export async function listMoveOutRequests(
    buildingId: string,
    status?: ContractMoveRequestStatusFilter
): Promise<ContractMoveRequest[]> {
    if (!USE_MOCK) {
        const searchParams = new URLSearchParams();
        if (status && status !== 'ALL') searchParams.set('status', status);
        const query = searchParams.toString();
        const res = await fetchJson(`/org/buildings/${buildingId}/move-out-requests${query ? `?${query}` : ''}`);
        const payload = res?.data ?? res ?? {};
        return getArray(payload).map(normalizeContractMoveRequest);
    }
    await delay(800);
    return [];
}

export async function approveMoveInRequest(requestId: string): Promise<ContractMoveRequest> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/move-in-requests/${requestId}/approve`, { method: 'POST' });
        const payload = res?.data ?? res;
        return normalizeContractMoveRequest(payload);
    }
    await delay(800);
    return normalizeContractMoveRequest({ id: requestId, status: 'APPROVED' });
}

export async function rejectMoveInRequest(
    requestId: string,
    dto?: RejectContractMoveRequestDto
): Promise<ContractMoveRequest> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/move-in-requests/${requestId}/reject`, {
            method: 'POST',
            body: JSON.stringify(dto ?? {}),
        });
        const payload = res?.data ?? res;
        return normalizeContractMoveRequest(payload);
    }
    await delay(800);
    return normalizeContractMoveRequest({ id: requestId, status: 'REJECTED', rejectionReason: dto?.rejectionReason });
}

export async function approveMoveOutRequest(requestId: string): Promise<ContractMoveRequest> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/move-out-requests/${requestId}/approve`, { method: 'POST' });
        const payload = res?.data ?? res;
        return normalizeContractMoveRequest(payload);
    }
    await delay(800);
    return normalizeContractMoveRequest({ id: requestId, status: 'APPROVED' });
}

export async function rejectMoveOutRequest(
    requestId: string,
    dto?: RejectContractMoveRequestDto
): Promise<ContractMoveRequest> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/move-out-requests/${requestId}/reject`, {
            method: 'POST',
            body: JSON.stringify(dto ?? {}),
        });
        const payload = res?.data ?? res;
        return normalizeContractMoveRequest(payload);
    }
    await delay(800);
    return normalizeContractMoveRequest({ id: requestId, status: 'REJECTED', rejectionReason: dto?.rejectionReason });
}

export async function executeMoveIn(contractId: string): Promise<Lease> {
    if (!USE_MOCK) {
        const res = await fetchJsonWithFallback(
            `/org/contracts/${contractId}/move-in/execute`,
            `/org/leases/${contractId}/move-in/execute`,
            { method: 'POST' }
        );
        const payload = res?.data ?? res;
        return normalizeLease(payload);
    }
    await delay(800);
    return normalizeLease({ id: contractId, status: 'ACTIVE' });
}

export async function executeMoveOut(contractId: string): Promise<Lease> {
    if (!USE_MOCK) {
        const res = await fetchJsonWithFallback(
            `/org/contracts/${contractId}/move-out/execute`,
            `/org/leases/${contractId}/move-out/execute`,
            { method: 'POST' }
        );
        const payload = res?.data ?? res;
        return normalizeLease({
            ...payload,
            status: normalizeLeaseStatus(payload?.status),
            displayStatus: deriveLeaseDisplayStatus(payload?.status, payload),
        });
    }
    await delay(800);
    return normalizeLease({ id: contractId, status: 'ENDED' });
}

export async function listLeaseDocuments(leaseId: string): Promise<LeaseDocument[]> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/leases/${leaseId}/documents`);
        const data = getArray(res);
        return data.map(normalizeLeaseDocument);
    }
    await delay(800);
    return [];
}

export async function createLeaseDocument(
    leaseId: string,
    dto: CreateLeaseDocumentDto
): Promise<LeaseDocument> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/leases/${leaseId}/documents`, {
            method: 'POST',
            body: JSON.stringify(dto)
        });
        const payload = res?.data ?? res;
        return normalizeLeaseDocument(payload);
    }
    await delay(800);
    return {
        id: `doc-${Date.now()}`,
        leaseId,
        type: dto.type,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        url: dto.url,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

export async function deleteLeaseDocument(leaseId: string, documentId: string): Promise<void> {
    if (!USE_MOCK) {
        await fetchJson(`/org/leases/${leaseId}/documents/${documentId}`, {
            method: 'DELETE'
        });
        return;
    }
    await delay(800);
}
