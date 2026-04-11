import type { BuildingOccupancy, BuildingResident, OccupancyResponseDto, OrgResidentsResponse, ResidentDirectoryProfile, ResidentDirectoryResponse, ResidentDirectoryRow, ResidentInviteFilterStatus, ResidentInviteListItem, ResidentInviteStatus, ResidentInvitesResponse, User } from '../types';
import { useAuthStore } from '../auth';
import { fetchJson } from './client';
import { API_BASE_URL, delay, mockData, USE_MOCK } from './config';
import { getArray, mapOccupancyResponseDto, normalizeUser, resolveRole } from './shared';

const normalizeLeaseSummaryStatus = (rawStatus: unknown, ...sources: any[]): string | undefined => {
    if (rawStatus === null || rawStatus === undefined) return undefined;
    const normalizedStatus = String(rawStatus).toUpperCase();
    if (normalizedStatus !== "CANCELLED") return normalizedStatus;

    const hasMoveOutMarker = sources.some((source) =>
        source?.actualMoveOutDate != null ||
        source?.actual_move_out_date != null ||
        source?.moveOutDate != null ||
        source?.move_out_date != null ||
        source?.movedOutAt != null ||
        source?.moved_out_at != null ||
        source?.occupancyEndAt != null ||
        source?.occupancy_end_at != null ||
        source?.endAt != null ||
        source?.end_at != null ||
        source?.endedAt != null ||
        source?.ended_at != null ||
        source?.occupancy?.endAt != null ||
        source?.occupancy?.end_at != null ||
        source?.occupancy?.endedAt != null ||
        source?.occupancy?.ended_at != null ||
        String(source?.occupancy?.status ?? "").toUpperCase() === "ENDED"
    );

    return hasMoveOutMarker ? "ENDED" : normalizedStatus;
};

export async function getBuildingResidents(buildingId: string): Promise<BuildingResident[]> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/residents`);
        const residents = getArray(res);
        return residents.map((resident: any) => {
            const occupancy =
                resident?.occupancy ??
                resident?.activeOccupancy ??
                resident?.currentOccupancy ??
                resident?.residentOccupancy ??
                null;
            const unitSource = resident?.unit ?? occupancy?.unit ?? resident?.unitInfo ?? null;

            const unitId =
                resident?.unitId ??
                unitSource?.id ??
                unitSource?.unitId ??
                occupancy?.unitId ??
                occupancy?.unit?.id ??
                occupancy?.unit?.unitId ??
                null;
            const unitLabel =
                unitSource?.label ??
                unitSource?.unitLabel ??
                unitSource?.unitNumber ??
                unitSource?.number ??
                unitSource?.name ??
                (typeof unitSource === 'string' ? unitSource : null) ??
                occupancy?.unitLabel ??
                occupancy?.unitNumber ??
                occupancy?.unitNo ??
                occupancy?.unit?.label ??
                occupancy?.unit?.unitLabel ??
                occupancy?.unit?.unitNumber ??
                occupancy?.unit?.number ??
                occupancy?.unit?.name ??
                resident?.unitLabel ??
                resident?.unitNumber ??
                resident?.unitNo ??
                (typeof resident?.unit === 'string' ? resident.unit : null) ??
                null;

            const status = resident?.status ?? occupancy?.status ?? occupancy?.occupancyStatus;
            const startAt =
                resident?.startAt ??
                resident?.startedAt ??
                occupancy?.startAt ??
                occupancy?.startedAt ??
                null;
            const endAt =
                resident?.endAt ??
                resident?.endedAt ??
                occupancy?.endAt ??
                occupancy?.endedAt ??
                null;

            return {
                userId: String(resident?.userId ?? resident?.user?.id ?? resident?.id ?? ''),
                name: resident?.name ?? resident?.user?.fullName ?? resident?.user?.name ?? '',
                email: resident?.email ?? resident?.user?.email ?? '',
                phoneNumber: resident?.phone ?? resident?.user?.phone ?? resident?.user?.phoneNumber,
                avatarUrl: resident?.avatarUrl ?? resident?.user?.avatarUrl ?? resident?.user?.avatar,
                isActive:
                    typeof resident?.isActive === 'boolean'
                        ? resident.isActive
                        : (typeof occupancy?.isActive === 'boolean' ? occupancy.isActive : undefined),
                unit: unitId || unitLabel
                    ? {
                        id: String(unitId ?? ''),
                        label: String(unitLabel ?? ''),
                    }
                    : undefined,
                status,
                startAt: startAt ?? undefined,
                endAt: endAt ?? undefined
            };
        });
    }
    await delay(800);
    return [];
}

export async function createBuildingResident(
    buildingId: string,
    data: { name: string; email: string; password?: string; unitId: string }
): Promise<BuildingResident & { tempPassword?: string; mustChangePassword?: boolean }> {
    if (!USE_MOCK) {
        // NOTE: Previously we onboarded residents via `/org/users/provision` which (depending on backend behavior)
        // can provision identities and create/modify occupancies. Per request: avoid POSTing occupancies from
        // the frontend and use POST `/residents` to onboard instead.
        //
        // const identity: Record<string, any> = {
        //     email: data.email,
        //     name: data.name,
        // };
        // if (data.password && data.password.trim()) {
        //     identity.password = data.password;
        // } else {
        //     identity.sendInvite = true;
        // }
        // const res = await fetchJson('/org/users/provision', {
        //     method: 'POST',
        //     body: JSON.stringify({
        //         identity,
        //         grants: {
        //             resident: {
        //                 buildingId,
        //                 unitId: data.unitId,
        //                 mode: 'ADD'
        //             }
        //         }
        //     })
        // });

        const body: Record<string, any> = {
            name: data.name,
            email: data.email,
            unitId: data.unitId,
        };
        if (data.password && data.password.trim()) {
            body.password = data.password;
        } else {
            body.sendInvite = true;
        }

        const res = await fetchJson(`/org/buildings/${buildingId}/residents`, {
            method: 'POST',
            body: JSON.stringify(body),
        });

        const payload = res?.data ?? res ?? {};
        const resident = payload?.resident ?? payload?.data?.resident ?? payload;
        const userData = resident?.user ?? payload?.user ?? payload?.data?.user ?? payload?.identity ?? {};
        const unit = resident?.unit ?? payload?.unit ?? {};

        return {
            userId: String(
                resident?.userId ??
                userData?.id ??
                userData?.userId ??
                resident?.id ??
                ''
            ),
            name: userData?.fullName ?? userData?.name ?? resident?.name ?? data.name,
            email: userData?.email ?? resident?.email ?? data.email,
            phoneNumber: userData?.phoneNumber ?? userData?.phone ?? resident?.phone ?? resident?.phoneNumber,
            avatarUrl: userData?.avatarUrl ?? userData?.avatar ?? resident?.avatarUrl,
            isActive: typeof userData?.isActive === 'boolean'
                ? userData.isActive
                : (typeof resident?.isActive === 'boolean' ? resident.isActive : undefined),
            unit: {
                id: String(unit?.id ?? unit?.unitId ?? resident?.unitId ?? data.unitId),
                label: unit?.label ?? unit?.unitLabel ?? resident?.unitLabel ?? ""
            },
            status: resident?.status,
            startAt: resident?.startAt,
            endAt: resident?.endAt,
            tempPassword: payload?.tempPassword ?? resident?.tempPassword,
            mustChangePassword: payload?.mustChangePassword ?? resident?.mustChangePassword
        };
    }
    await delay(800);
    return {
        userId: String(Date.now()),
        name: data.name,
        email: data.email,
        unit: { id: data.unitId, label: data.unitId }
    };
}

export async function createResidentWithProfile(
    data: {
        user: { name: string; email: string; phone?: string; password?: string };
        profile?: {
            emiratesIdNumber?: string;
            passportNumber?: string;
            nationality?: string;
            dateOfBirth?: string;
            currentAddress?: string;
            emergencyContactName?: string;
            emergencyContactPhone?: string;
        };
    }
): Promise<{
    userId: string;
    name: string;
    email: string;
    phoneNumber?: string;
    profile?: ResidentDirectoryProfile | null;
    tempPassword?: string;
    mustChangePassword?: boolean;
}> {
    if (!USE_MOCK) {
        const res = await fetchJson('/org/residents', {
            method: 'POST',
            body: JSON.stringify({
                user: {
                    name: data.user.name,
                    email: data.user.email,
                    phone: data.user.phone,
                    password: data.user.password,
                },
                profile: data.profile,
            }),
        });
        const payload = res?.data ?? res ?? {};
        const userData =
            payload.user ??
            payload.residentUser ??
            payload.identity ??
            payload.data?.user ??
            payload;
        const profile =
            payload.profile ??
            payload.residentProfile ??
            payload.data?.profile ??
            payload;
        return {
            userId: String(userData?.id ?? userData?.userId ?? payload?.userId ?? payload?.id ?? ''),
            name: userData?.fullName ?? userData?.name ?? data.user.name,
            email: userData?.email ?? data.user.email,
            phoneNumber: userData?.phoneNumber ?? userData?.phone ?? data.user.phone,
            profile: {
                emiratesIdNumber: profile?.emiratesIdNumber ?? profile?.emiratesId ?? null,
                passportNumber: profile?.passportNumber ?? null,
                nationality: profile?.nationality ?? null,
                dateOfBirth: profile?.dateOfBirth ?? null,
                currentAddress: profile?.currentAddress ?? null,
                emergencyContactName: profile?.emergencyContactName ?? null,
                emergencyContactPhone: profile?.emergencyContactPhone ?? null,
            },
            tempPassword: payload?.tempPassword ?? userData?.tempPassword ?? undefined,
            mustChangePassword: payload?.mustChangePassword ?? userData?.mustChangePassword ?? undefined,
        };
    }
    await delay(800);
    return {
        userId: String(Date.now()),
        name: data.user.name,
        email: data.user.email,
        phoneNumber: data.user.phone,
        profile: {
            emiratesIdNumber: data.profile?.emiratesIdNumber ?? null,
            passportNumber: data.profile?.passportNumber ?? null,
            nationality: data.profile?.nationality ?? null,
            dateOfBirth: data.profile?.dateOfBirth ?? null,
            currentAddress: data.profile?.currentAddress ?? null,
            emergencyContactName: data.profile?.emergencyContactName ?? null,
            emergencyContactPhone: data.profile?.emergencyContactPhone ?? null,
        },
    };
}

export async function getOrgResidents(params?: {
    status?: "ALL" | "WITH_OCCUPANCY" | "WITHOUT_OCCUPANCY" | "NEW" | "FORMER";
    q?: string;
    limit?: number;
    cursor?: string;
    includeProfile?: boolean;
}): Promise<OrgResidentsResponse> {
    if (!USE_MOCK) {
        const query = new URLSearchParams();
        const normalizedLimit =
            typeof params?.limit === "number"
                ? Math.min(100, Math.max(1, Math.trunc(params.limit)))
                : undefined;
        if (params?.status) query.set('status', params.status);
        if (params?.q) query.set('q', params.q);
        if (typeof normalizedLimit === "number") query.set('limit', String(normalizedLimit));
        if (params?.cursor) query.set('cursor', params.cursor);
        if (typeof params?.includeProfile === 'boolean') {
            query.set('includeProfile', params.includeProfile ? 'true' : 'false');
        }
        const res = await fetchJson(`/org/residents${query.toString() ? `?${query.toString()}` : ''}`);
        const payload = res?.data ?? res ?? {};
        const items = getArray(payload);
        return {
            items: items.map((entry: any) => {
                const userData = entry?.user ?? entry?.residentUser ?? entry?.identity ?? entry ?? {};
                const profileData =
                    entry?.residentProfile ??
                    entry?.profile ??
                    entry?.data?.residentProfile ??
                    entry?.data?.profile ??
                    userData?.residentProfile ??
                    userData?.profile ??
                    null;
                const residentStatus = entry?.residentStatus ?? entry?.status;
                const rawLastOccupancy =
                    entry?.lastOccupancy ??
                    entry?.last_occupancy ??
                    entry?.previousOccupancy ??
                    entry?.formerOccupancy ??
                    entry?.lastOccupancies ??
                    entry?.previousOccupancies ??
                    null;
                const lastOccupancy = Array.isArray(rawLastOccupancy)
                    ? (rawLastOccupancy.find(Boolean) ?? null)
                    : rawLastOccupancy;
                const rawActiveOccupancy =
                    entry?.activeOccupancy ??
                    entry?.currentOccupancy ??
                    entry?.occupancy ??
                    entry?.active_occupancy ??
                    entry?.current_occupancy ??
                    entry?.activeOccupancies ??
                    entry?.occupancies ??
                    null;
                const activeOccupancy = Array.isArray(rawActiveOccupancy)
                    ? (rawActiveOccupancy.find(Boolean) ?? null)
                    : rawActiveOccupancy;
                const asBool = (value: unknown) => {
                    if (typeof value === "boolean") return value;
                    if (typeof value === "string") {
                        const normalized = value.trim().toLowerCase();
                        if (normalized === "true") return true;
                        if (normalized === "false") return false;
                    }
                    return undefined;
                };
                const contractSource =
                    entry?.contract ??
                    entry?.contractInfo ??
                    entry?.activeContract ??
                    entry?.lastContract ??
                    entry?.formerContract ??
                    activeOccupancy?.contract ??
                    activeOccupancy?.activeContract ??
                    activeOccupancy?.lastContract ??
                    lastOccupancy?.contract ??
                    lastOccupancy?.lastContract ??
                    entry?.occupancy?.contract ??
                    null;
                const leaseSource =
                    contractSource ??
                    entry?.lease ??
                    entry?.leaseInfo ??
                    entry?.activeLease ??
                    entry?.lastLease ??
                    entry?.formerLease ??
                    activeOccupancy?.lease ??
                    activeOccupancy?.activeLease ??
                    activeOccupancy?.lastLease ??
                    lastOccupancy?.lease ??
                    lastOccupancy?.lastLease ??
                    entry?.occupancy?.lease ??
                    null;
                const latestContractIdRaw =
                    entry?.latestContractId ??
                    entry?.contractId ??
                    entry?.activeContractId ??
                    entry?.lastContractId ??
                    entry?.formerContractId ??
                    contractSource?.contractId ??
                    contractSource?.id ??
                    activeOccupancy?.contractId ??
                    activeOccupancy?.activeContractId ??
                    activeOccupancy?.lastContractId ??
                    activeOccupancy?.contract?.id ??
                    activeOccupancy?.activeContract?.id ??
                    activeOccupancy?.lastContract?.id ??
                    lastOccupancy?.contractId ??
                    lastOccupancy?.lastContractId ??
                    lastOccupancy?.contract?.id ??
                    lastOccupancy?.lastContract?.id ??
                    entry?.occupancy?.contractId ??
                    entry?.occupancy?.contract?.id ??
                    null;
                const leaseId =
                    latestContractIdRaw ??
                    leaseSource?.leaseId ??
                    leaseSource?.contractId ??
                    leaseSource?.id ??
                    entry?.leaseId ??
                    entry?.activeLeaseId ??
                    entry?.lastLeaseId ??
                    entry?.formerLeaseId ??
                    activeOccupancy?.leaseId ??
                    activeOccupancy?.activeLeaseId ??
                    activeOccupancy?.lastLeaseId ??
                    activeOccupancy?.lease?.id ??
                    activeOccupancy?.activeLease?.id ??
                    activeOccupancy?.lastLease?.id ??
                    lastOccupancy?.leaseId ??
                    lastOccupancy?.lastLeaseId ??
                    lastOccupancy?.lease?.id ??
                    lastOccupancy?.lastLease?.id ??
                    entry?.occupancy?.leaseId ??
                    entry?.occupancy?.lease?.id ??
                    null;
                const normalizedLease = leaseId
                    ? {
                        leaseId: String(leaseId),
                        status: normalizeLeaseSummaryStatus(
                            contractSource?.status ?? leaseSource?.status ?? entry?.contractStatus ?? entry?.leaseStatus ?? null,
                            contractSource,
                            leaseSource,
                            entry,
                            activeOccupancy,
                            lastOccupancy
                        ),
                        leaseStartDate:
                            contractSource?.contractPeriodFrom ??
                            contractSource?.leaseStartDate ??
                            contractSource?.startDate ??
                            leaseSource?.leaseStartDate ??
                            leaseSource?.startDate ??
                            entry?.contractPeriodFrom ??
                            entry?.leaseStartDate ??
                            activeOccupancy?.leaseStartDate ??
                            activeOccupancy?.startDate ??
                            lastOccupancy?.leaseStartDate ??
                            lastOccupancy?.startDate ??
                            null,
                        leaseEndDate:
                            contractSource?.contractPeriodTo ??
                            contractSource?.leaseEndDate ??
                            contractSource?.endDate ??
                            leaseSource?.leaseEndDate ??
                            leaseSource?.endDate ??
                            entry?.contractPeriodTo ??
                            entry?.leaseEndDate ??
                            activeOccupancy?.leaseEndDate ??
                            activeOccupancy?.endDate ??
                            lastOccupancy?.leaseEndDate ??
                            lastOccupancy?.endDate ??
                            null,
                        annualRent:
                            contractSource?.annualRent ??
                            leaseSource?.annualRent ??
                            entry?.annualRent ??
                            null,
                        unitLabel:
                            leaseSource?.unitLabel ??
                            leaseSource?.unitNumber ??
                            leaseSource?.unit?.label ??
                            leaseSource?.unit?.unitLabel ??
                            leaseSource?.unit?.unitNumber ??
                            activeOccupancy?.unitLabel ??
                            activeOccupancy?.unit?.label ??
                            activeOccupancy?.unit?.unitLabel ??
                            entry?.unitLabel ??
                            entry?.unitNumber ??
                            null,
                        buildingName:
                            leaseSource?.buildingName ??
                            leaseSource?.building?.name ??
                            leaseSource?.building?.label ??
                            activeOccupancy?.buildingName ??
                            activeOccupancy?.building?.name ??
                            entry?.buildingName ??
                            entry?.building?.name ??
                            null,
                    }
                    : null;
                const occupancyId =
                    entry?.occupancyId
                    ?? entry?.activeOccupancyId
                    ?? entry?.currentOccupancyId
                    ?? entry?.occupancy?.id
                    ?? entry?.activeOccupancy?.id
                    ?? entry?.currentOccupancy?.id
                    ?? activeOccupancy?.id
                    ?? activeOccupancy?.occupancyId
                    ?? null;
                const hasActiveOccupancy = Boolean(
                    entry?.hasActiveOccupancy ??
                    entry?.hasOccupancy ??
                    (Array.isArray(rawActiveOccupancy)
                        ? rawActiveOccupancy.length > 0
                        : (rawActiveOccupancy ?? activeOccupancy))
                );
                const normalizedStatus = residentStatus ? String(residentStatus).toUpperCase() : "";
                const resolvedStatus =
                    normalizedStatus === "ACTIVE" || normalizedStatus === "NEW" || normalizedStatus === "FORMER"
                        ? normalizedStatus
                        : normalizedStatus === "WITH_OCCUPANCY"
                            ? "ACTIVE"
                            : normalizedStatus === "WITHOUT_OCCUPANCY"
                                ? (lastOccupancy ? "FORMER" : "NEW")
                                : hasActiveOccupancy
                                    ? "ACTIVE"
                                    : lastOccupancy
                                        ? "FORMER"
                                        : "NEW";
                const fallbackBuildingId =
                    entry?.buildingId ??
                    entry?.building?.id ??
                    entry?.building?.buildingId ??
                    entry?.building?.building_id ??
                    activeOccupancy?.buildingId ??
                    activeOccupancy?.building?.id ??
                    "";
                const fallbackUnitId =
                    entry?.unitId ??
                    entry?.unit?.id ??
                    entry?.unit?.unitId ??
                    entry?.unit?.unit_id ??
                    activeOccupancy?.unitId ??
                    activeOccupancy?.unit?.id ??
                    "";
                const fallbackUnitLabel =
                    entry?.unitLabel ??
                    entry?.unit?.label ??
                    entry?.unit?.unitLabel ??
                    entry?.unitNumber ??
                    entry?.unitNo ??
                    entry?.unit?.unitNumber ??
                    entry?.unit?.number ??
                    entry?.unit?.name ??
                    entry?.unit?.unitNo ??
                    entry?.unitName ??
                    entry?.unitCode ??
                    entry?.occupancy?.unitLabel ??
                    entry?.occupancy?.unitNumber ??
                    entry?.occupancy?.unit?.label ??
                    entry?.occupancy?.unit?.unitLabel ??
                    (typeof entry?.unit === "string" ? entry.unit : null) ??
                    null;
                const fallbackBuildingName =
                    entry?.buildingName ??
                    entry?.building?.name ??
                    entry?.building?.label ??
                    entry?.building?.title ??
                    entry?.occupancy?.buildingName ??
                    entry?.occupancy?.building?.name ??
                    (typeof entry?.building === "string" ? entry.building : null) ??
                    activeOccupancy?.buildingName ??
                    activeOccupancy?.building?.name ??
                    null;
                const activeBuildingId =
                    activeOccupancy?.buildingId ??
                    activeOccupancy?.building?.id ??
                    activeOccupancy?.building?.buildingId ??
                    activeOccupancy?.building?.building_id ??
                    fallbackBuildingId;
                const activeUnitId =
                    activeOccupancy?.unitId ??
                    activeOccupancy?.unit?.id ??
                    activeOccupancy?.unit?.unitId ??
                    activeOccupancy?.unit?.unit_id ??
                    fallbackUnitId;
                const activeUnitLabel =
                    activeOccupancy?.unitLabel ??
                    activeOccupancy?.unit?.label ??
                    activeOccupancy?.unit?.unitLabel ??
                    activeOccupancy?.unitNumber ??
                    activeOccupancy?.unitNo ??
                    activeOccupancy?.unit?.unitNumber ??
                    activeOccupancy?.unit?.number ??
                    activeOccupancy?.unit?.name ??
                    activeOccupancy?.unit?.unitNo ??
                    (typeof activeOccupancy?.unit === "string" ? activeOccupancy.unit : null) ??
                    fallbackUnitLabel;
                const activeBuildingName =
                    activeOccupancy?.buildingName ??
                    activeOccupancy?.building?.name ??
                    activeOccupancy?.building?.label ??
                    activeOccupancy?.building?.title ??
                    (typeof activeOccupancy?.building === "string" ? activeOccupancy.building : null) ??
                    fallbackBuildingName;
                const hasActiveOccupancyData = Boolean(
                    activeBuildingId || activeUnitId || activeUnitLabel || activeBuildingName
                );
                const normalizedUserIsActive = asBool(
                    userData?.isActive ??
                    userData?.is_active ??
                    entry?.isActive ??
                    entry?.is_active
                );
                const normalizedMustChangePassword = asBool(
                    userData?.mustChangePassword ??
                    userData?.must_change_password ??
                    entry?.mustChangePassword ??
                    entry?.must_change_password
                );
                return {
                    user: normalizeUser(
                        {
                            ...userData,
                            name: userData?.name ?? userData?.fullName,
                            isActive: normalizedUserIsActive,
                            mustChangePassword: normalizedMustChangePassword,
                        },
                        'tenant'
                    ),
                    hasActiveOccupancy,
                    occupancyId: occupancyId ? String(occupancyId) : null,
                    activeOccupancy: hasActiveOccupancy || hasActiveOccupancyData
                        ? {
                            buildingId: String(activeBuildingId),
                            unitId: String(activeUnitId),
                            unitLabel: activeUnitLabel ? String(activeUnitLabel) : null,
                            buildingName: activeBuildingName ? String(activeBuildingName) : null,
                        }
                        : null,
                    residentStatus: resolvedStatus,
                    lastOccupancy: lastOccupancy
                        ? {
                            buildingName: String(
                                lastOccupancy?.buildingName ??
                                lastOccupancy?.building?.name ??
                                lastOccupancy?.building?.label ??
                                lastOccupancy?.building ??
                                ""
                            ),
                            unitLabel: String(
                                lastOccupancy?.unitLabel ??
                                lastOccupancy?.unit?.label ??
                                lastOccupancy?.unit?.unitLabel ??
                                lastOccupancy?.unit?.unitNumber ??
                                lastOccupancy?.unit?.number ??
                                lastOccupancy?.unit ??
                                ""
                            ),
                            endAt: lastOccupancy?.endAt ?? lastOccupancy?.endedAt ?? null,
                        }
                        : null,
                    residentProfile: profileData
                        ? {
                            emiratesIdNumber: profileData?.emiratesIdNumber ?? profileData?.emiratesId ?? null,
                            passportNumber: profileData?.passportNumber ?? null,
                            nationality: profileData?.nationality ?? null,
                            dateOfBirth: profileData?.dateOfBirth ?? null,
                            currentAddress: profileData?.currentAddress ?? null,
                            emergencyContactName: profileData?.emergencyContactName ?? null,
                            emergencyContactPhone: profileData?.emergencyContactPhone ?? null,
                        }
                        : null,
                    lease: normalizedLease,
                    latestContractId: (latestContractIdRaw ?? leaseId) ? String(latestContractIdRaw ?? leaseId) : null,
                    canAddContract: asBool(entry?.canAddContract ?? entry?.canAddLease),
                    canViewContract: asBool(entry?.canViewContract ?? entry?.canViewLease),
                    canRequestMoveIn: asBool(entry?.canRequestMoveIn),
                    canRequestMoveOut: asBool(entry?.canRequestMoveOut),
                    canExecuteMoveOut: asBool(entry?.canExecuteMoveOut),
                };
            }),
            nextCursor: payload?.nextCursor ?? payload?.cursor ?? null,
        };
    }
    await delay(800);
    return { items: [], nextCursor: null };
}

export async function listResidentInvites(params?: {
    status?: ResidentInviteFilterStatus;
    q?: string;
    limit?: number;
    cursor?: string;
}): Promise<ResidentInvitesResponse> {
    const asBool = (value: unknown) => {
        if (typeof value === "boolean") return value;
        if (typeof value === "string") {
            const normalized = value.trim().toLowerCase();
            if (normalized === "true") return true;
            if (normalized === "false") return false;
        }
        return undefined;
    };

    const normalizeStatus = (value: unknown): ResidentInviteStatus => {
        const normalized = String(value ?? "").toUpperCase();
        if (normalized === "ACCEPTED") return "ACCEPTED";
        if (normalized === "FAILED") return "FAILED";
        if (normalized === "EXPIRED") return "EXPIRED";
        return "PENDING";
    };

    const normalizeInviteRow = (row: any): ResidentInviteListItem => {
        const userData = row?.user ?? row?.residentUser ?? row?.identity ?? {};
        const createdBy = row?.createdByUser ?? row?.createdBy ?? row?.invitedBy ?? null;
        return {
            inviteId: String(row?.inviteId ?? row?.id ?? ""),
            status: normalizeStatus(row?.status),
            sentAt: row?.sentAt ?? row?.createdAt ?? null,
            expiresAt: row?.expiresAt ?? row?.expires_at ?? null,
            acceptedAt: row?.acceptedAt ?? row?.accepted_at ?? null,
            failedAt: row?.failedAt ?? row?.failed_at ?? null,
            failureReason: row?.failureReason ?? row?.failure_reason ?? row?.error ?? null,
            user: {
                id: String(userData?.id ?? userData?.userId ?? row?.userId ?? ""),
                email: String(userData?.email ?? row?.email ?? ""),
                name: userData?.name ?? userData?.fullName ?? row?.name ?? "",
                isActive: asBool(
                    userData?.isActive ??
                    userData?.is_active ??
                    row?.isActive ??
                    row?.is_active
                ),
                mustChangePassword: asBool(
                    userData?.mustChangePassword ??
                    userData?.must_change_password ??
                    row?.mustChangePassword ??
                    row?.must_change_password
                ),
            },
            createdByUser: createdBy
                ? {
                    id: String(createdBy?.id ?? createdBy?.userId ?? ""),
                    name: createdBy?.name ?? createdBy?.fullName ?? undefined,
                    email: createdBy?.email ?? undefined,
                }
                : null,
        };
    };

    if (!USE_MOCK) {
        const query = new URLSearchParams();
        if (params?.status) query.set("status", params.status);
        if (params?.q) query.set("q", params.q);
        if (typeof params?.limit === "number") query.set("limit", String(Math.min(100, Math.max(1, Math.trunc(params.limit)))));
        if (params?.cursor) query.set("cursor", params.cursor);
        try {
            const res = await fetchJson(
                `/org/residents/invites${query.toString() ? `?${query.toString()}` : ""}`,
                undefined,
                { silentStatusCodes: [404] }
            );
            const payload = res?.data ?? res ?? {};
            const items = getArray(payload);
            return {
                items: items.map((row: any) => normalizeInviteRow(row)),
                nextCursor: payload?.nextCursor ?? payload?.cursor ?? null,
            };
        } catch (error) {
            const status = (error as { status?: unknown })?.status;
            if (status === 404) {
                return { items: [], nextCursor: null };
            }
            throw error;
        }
    }

    await delay(800);
    return { items: [], nextCursor: null };
}

export async function resendResidentInvite(userId: string): Promise<{ success: boolean }> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/residents/${userId}/send-invite`, {
            method: 'POST',
        });
        const payload = res?.data ?? res ?? {};
        const success =
            typeof payload?.success === 'boolean'
                ? payload.success
                : (typeof payload?.ok === 'boolean' ? payload.ok : true);
        return { success };
    }
    await delay(800);
    return { success: true };
}

export async function getUserById(userId: string): Promise<User> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/users/${userId}`);
        const payload = res?.data ?? res ?? {};
        const baseRole = resolveRole(payload, payload);
        const orgRoleKeys = payload.orgRoleKeys ?? payload.roleKeys;
        const roleKeys = payload.roleKeys;
        const displayRole = String((orgRoleKeys?.[0] ?? roleKeys?.[0] ?? payload.role ?? payload.roleName ?? baseRole) ?? baseRole);
        return {
            id: String(payload.id ?? payload.userId ?? userId),
            name: payload.name ?? payload.fullName ?? payload.email?.split('@')[0] ?? 'User',
            email: payload.email ?? '',
            role: displayRole,
            baseRole,
            buildingIds: Array.isArray(payload.buildingIds) ? payload.buildingIds.map((id: any) => String(id)) : [],
            orgId: payload.orgId ?? null,
            orgRoleKeys,
            roleKeys,
            effectivePermissions: payload.effectivePermissions ?? payload.permissions ?? payload.perms,
            avatarUrl: payload.avatarUrl ?? payload.avatar ?? payload.photoUrl,
            isActive: typeof payload.isActive === 'boolean' ? payload.isActive : undefined,
            mustChangePassword: typeof (payload.mustChangePassword ?? payload.must_change_password) === 'boolean'
                ? (payload.mustChangePassword ?? payload.must_change_password)
                : undefined,
            fullName: payload.fullName,
            phoneNumber: payload.phoneNumber ?? payload.phone,
            address: payload.address,
            nationality: payload.nationality
        };
    }
    await delay(800);
    const user = mockData.users.find((entry) => entry.id === userId) ?? mockData.users[0];
    return user;
}

export async function updateUserProfile(
    userId: string,
    data: { name?: string; email?: string; phoneNumber?: string; avatarUrl?: string; isActive?: boolean }
): Promise<User> {
    if (!USE_MOCK) {
        const payloadBody = JSON.stringify({
            name: data.name,
            email: data.email,
            phoneNumber: data.phoneNumber,
            phone: data.phoneNumber,
            avatarUrl: data.avatarUrl,
            isActive: data.isActive
        });
        let res: any;
        try {
            res = await fetchJson(`/users/${userId}`, {
                method: 'PATCH',
                body: payloadBody
            });
        } catch (error) {
            const status = (error as { status?: number })?.status;
            if (status === 404 || status === 405) {
                try {
                    res = await fetchJson(`/org/users/${userId}`, {
                        method: 'PATCH',
                        body: payloadBody
                    });
                } catch (orgError) {
                    const orgStatus = (orgError as { status?: number })?.status;
                    if (orgStatus === 405) {
                        res = await fetchJson(`/org/users/${userId}`, {
                            method: 'PUT',
                            body: payloadBody
                        });
                    } else {
                        throw orgError;
                    }
                }
            } else {
                throw error;
            }
        }
        const payload = res?.data ?? res ?? {};
        const baseRole = resolveRole(payload, payload);
        const orgRoleKeys = payload.orgRoleKeys ?? payload.roleKeys;
        const roleKeys = payload.roleKeys;
        const displayRole = String((orgRoleKeys?.[0] ?? roleKeys?.[0] ?? payload.role ?? payload.roleName ?? baseRole) ?? baseRole);
        return {
            id: String(payload.id ?? payload.userId ?? userId),
            name: payload.name ?? payload.fullName ?? data.name ?? payload.email?.split('@')[0] ?? 'User',
            email: payload.email ?? data.email ?? '',
            role: displayRole,
            baseRole,
            buildingIds: Array.isArray(payload.buildingIds) ? payload.buildingIds.map((id: any) => String(id)) : [],
            orgId: payload.orgId ?? null,
            orgRoleKeys,
            roleKeys,
            effectivePermissions: payload.effectivePermissions ?? payload.permissions ?? payload.perms,
            avatarUrl: payload.avatarUrl ?? payload.avatar ?? payload.photoUrl ?? data.avatarUrl,
            isActive: typeof payload.isActive === 'boolean' ? payload.isActive : data.isActive,
            fullName: payload.fullName,
            phoneNumber: payload.phoneNumber ?? payload.phone ?? data.phoneNumber,
            address: payload.address,
            nationality: payload.nationality
        };
    }
    await delay(800);
    const existing = mockData.users.find((entry) => entry.id === userId);
    const next: User = {
        ...(existing ?? {
            id: userId,
            name: data.name ?? 'User',
            email: data.email ?? '',
            role: 'tenant',
            baseRole: 'tenant',
            buildingIds: []
        }),
        name: data.name ?? existing?.name ?? 'User',
        email: data.email ?? existing?.email ?? '',
        phoneNumber: data.phoneNumber ?? existing?.phoneNumber,
        avatarUrl: data.avatarUrl ?? existing?.avatarUrl,
        isActive: typeof data.isActive === 'boolean' ? data.isActive : existing?.isActive
    };
    return next;
}

export async function upsertResidentProfile(
    userId: string,
    data: {
        emiratesIdNumber?: string;
        passportNumber?: string;
        nationality?: string;
        dateOfBirth?: string;
        currentAddress?: string;
        emergencyContactName?: string;
        emergencyContactPhone?: string;
    }
): Promise<ResidentDirectoryProfile> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/residents/${userId}/profile`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        const payload = res?.data ?? res ?? {};
        return {
            emiratesIdNumber: payload.emiratesIdNumber ?? payload.emiratesId ?? null,
            passportNumber: payload.passportNumber ?? null,
            nationality: payload.nationality ?? null,
            dateOfBirth: payload.dateOfBirth ?? null,
            currentAddress: payload.currentAddress ?? null,
            emergencyContactName: payload.emergencyContactName ?? null,
            emergencyContactPhone: payload.emergencyContactPhone ?? null,
        };
    }
    await delay(800);
    return {
        emiratesIdNumber: data.emiratesIdNumber ?? null,
        passportNumber: data.passportNumber ?? null,
        nationality: data.nationality ?? null,
        dateOfBirth: data.dateOfBirth ?? null,
        currentAddress: data.currentAddress ?? null,
        emergencyContactName: data.emergencyContactName ?? null,
        emergencyContactPhone: data.emergencyContactPhone ?? null,
    };
}

export async function resetUserPassword(userId: string): Promise<{ tempPassword?: string; mustChangePassword?: boolean }> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson(`/users/${userId}/reset-password`, {
                method: 'POST',
                body: JSON.stringify({})
            }, { silentStatusCodes: [404] });
            const payload = res?.data ?? res ?? {};
            return {
                tempPassword: payload.tempPassword ?? payload.password ?? undefined,
                mustChangePassword: typeof payload.mustChangePassword === 'boolean' ? payload.mustChangePassword : undefined
            };
        } catch (error) {
            if (error instanceof Error && /404/.test(error.message) || (error as any).silent) {
                throw new Error('Password reset is not supported by this API endpoint.');
            }
            throw error;
        }
    }
    await delay(800);
    return { tempPassword: Math.random().toString(36).slice(2, 10), mustChangePassword: true };
}

export async function getBuildingOccupancies(buildingId: string): Promise<BuildingOccupancy[]> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/occupancies`);
        const occupancies = getArray(res);
        return occupancies.map((entry: any) => {
            const unit = entry.unit ?? entry.unitInfo ?? {};
            const resident = entry.resident ?? entry.user ?? entry.residentUser ?? {};
            return {
                id: String(entry.id ?? entry.occupancyId ?? ''),
                unitId: String(entry.unitId ?? unit.id ?? unit.unitId ?? ''),
                unitLabel: unit.label ?? unit.unitLabel ?? entry.unitLabel ?? '',
                residentUserId: entry.residentUserId ?? resident.id ?? resident.userId ?? entry.userId,
                residentName: resident.name ?? resident.fullName ?? entry.residentName ?? '',
                residentEmail: resident.email ?? entry.residentEmail ?? '',
                status: entry.status,
                startAt: entry.startAt,
                endAt: entry.endAt
            };
        });
    }
    await delay(800);
    return [];
}
export async function getBuildingOccupanciesDto(
    buildingId: string,
    status: "ACTIVE" | "ENDED" | "ALL" = "ACTIVE"
): Promise<OccupancyResponseDto[]> {
  if (!USE_MOCK) {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const res = await fetchJson(`/org/buildings/${buildingId}/occupancies${query}`);

    // Your endpoint returns a raw array
    const rows = Array.isArray(res) ? res : getArray(res);

    return rows.map(mapOccupancyResponseDto);
  }

  await delay(800);
  return [];
}

function normalizeResidentDirectoryRow(row: any): ResidentDirectoryRow {
    const residentSource = row?.resident ?? row?.user ?? row?.residentUser ?? {};
    const unitSource = row?.unit ?? row?.unitInfo ?? {};
    const contractSource =
        row?.contract ??
        row?.contractInfo ??
        row?.latestContract ??
        row?.activeContract ??
        row?.endedContract ??
        row?.formerContract ??
        row?.previousContract ??
        row?.occupancy?.contract ??
        row?.occupancy?.latestContract ??
        row?.occupancy?.activeContract ??
        row?.occupancy?.endedContract ??
        row?.occupancy?.formerContract ??
        row?.endedOccupancy?.contract ??
        null;
    const leaseSource =
        contractSource ??
        row?.lease ??
        row?.leaseInfo ??
        row?.lastLease ??
        row?.activeLease ??
        row?.endedLease ??
        row?.formerLease ??
        row?.previousLease ??
        row?.latestLease ??
        row?.occupancy?.lease ??
        row?.occupancy?.lastLease ??
        row?.occupancy?.activeLease ??
        row?.occupancy?.endedLease ??
        row?.occupancy?.formerLease ??
        row?.endedOccupancy?.lease ??
        null;

    const asBool = (value: unknown) => {
        if (typeof value === "boolean") return value;
        if (typeof value === "string") {
            const normalized = value.trim().toLowerCase();
            if (normalized === "true") return true;
            if (normalized === "false") return false;
        }
        return undefined;
    };

    const latestContractIdRaw =
        row?.latestContractId ??
        row?.contractId ??
        row?.activeContractId ??
        row?.lastContractId ??
        row?.formerContractId ??
        row?.previousContractId ??
        contractSource?.contractId ??
        contractSource?.id ??
        row?.occupancy?.contractId ??
        row?.occupancy?.latestContractId ??
        row?.occupancy?.activeContractId ??
        row?.occupancy?.contract?.id ??
        row?.occupancy?.latestContract?.id ??
        row?.occupancy?.activeContract?.id ??
        row?.endedOccupancy?.contractId ??
        row?.endedOccupancy?.contract?.id ??
        null;

    const leaseId =
        latestContractIdRaw ??
        leaseSource?.leaseId ??
        leaseSource?.contractId ??
        leaseSource?.id ??
        row?.leaseId ??
        row?.lastLeaseId ??
        row?.activeLeaseId ??
        row?.endedLeaseId ??
        row?.formerLeaseId ??
        row?.previousLeaseId ??
        row?.latestLeaseId ??
        row?.occupancy?.leaseId ??
        row?.occupancy?.lastLeaseId ??
        row?.occupancy?.activeLeaseId ??
        row?.occupancy?.endedLeaseId ??
        row?.occupancy?.formerLeaseId ??
        row?.occupancy?.lease?.id ??
        row?.occupancy?.lastLease?.id ??
        row?.occupancy?.activeLease?.id ??
        row?.occupancy?.endedLease?.id ??
        row?.occupancy?.formerLease?.id ??
        row?.endedOccupancy?.leaseId ??
        row?.endedOccupancy?.lease?.id;

    const normalizedLease = leaseId
        ? {
            leaseId: String(leaseId),
            status: normalizeLeaseSummaryStatus(
                contractSource?.status ?? leaseSource?.status ?? row?.contractStatus ?? row?.leaseStatus ?? null,
                contractSource,
                leaseSource,
                row,
                row?.occupancy,
                row?.endedOccupancy
            ),
            leaseStartDate:
                contractSource?.contractPeriodFrom ??
                contractSource?.leaseStartDate ??
                contractSource?.startDate ??
                leaseSource?.leaseStartDate ??
                leaseSource?.startDate ??
                row?.contractPeriodFrom ??
                row?.leaseStartDate ??
                null,
            leaseEndDate:
                contractSource?.contractPeriodTo ??
                contractSource?.leaseEndDate ??
                contractSource?.endDate ??
                leaseSource?.leaseEndDate ??
                leaseSource?.endDate ??
                row?.contractPeriodTo ??
                row?.leaseEndDate ??
                null,
            annualRent:
                contractSource?.annualRent ??
                leaseSource?.annualRent ??
                row?.annualRent ??
                null,
        }
        : null;

    return {
        occupancyId: String(row?.occupancyId ?? row?.id ?? ''),
        residentUserId: String(
            row?.residentUserId ??
            row?.userId ??
            residentSource?.id ??
            residentSource?.userId ??
            ''
        ),
        residentName: row?.residentName ?? residentSource?.name ?? residentSource?.fullName ?? null,
        residentEmail: row?.residentEmail ?? residentSource?.email ?? null,
        residentPhone: row?.residentPhone ?? residentSource?.phone ?? residentSource?.phoneNumber ?? null,
        residentAvatarUrl: row?.residentAvatarUrl ?? residentSource?.avatarUrl ?? residentSource?.avatar ?? null,
        unitId: row?.unitId ?? unitSource?.id ?? unitSource?.unitId ?? null,
        unitLabel: row?.unitLabel ?? unitSource?.label ?? unitSource?.unitLabel ?? null,
        status: row?.status ?? row?.occupancyStatus ?? null,
        startAt: row?.startAt ?? row?.occupancyStartAt ?? null,
        endAt: row?.endAt ?? row?.occupancyEndAt ?? null,
        profile: row?.profile ?? row?.residentProfile ?? null,
        lease: normalizedLease,
        latestContractId: (latestContractIdRaw ?? leaseId) ? String(latestContractIdRaw ?? leaseId) : null,
        canAddContract: asBool(row?.canAddContract ?? row?.canAddLease),
        canViewContract: asBool(row?.canViewContract ?? row?.canViewLease),
        canRequestMoveIn: asBool(row?.canRequestMoveIn),
        canRequestMoveOut: asBool(row?.canRequestMoveOut),
        canExecuteMoveOut: asBool(row?.canExecuteMoveOut),
    };
}

export async function getResidentDirectory(
    buildingId: string,
    params?: {
        q?: string;
        status?: string;
        sort?: "residentName" | "unitLabel" | "createdAt" | "startAt";
        order?: "asc" | "desc";
        limit?: number;
        cursor?: string | null;
        includeProfile?: boolean;
    }
): Promise<ResidentDirectoryResponse> {
    if (!USE_MOCK) {
        const searchParams = new URLSearchParams();
        if (params?.q) searchParams.set("q", params.q);
        if (params?.status) searchParams.set("status", params.status);
        if (params?.sort) searchParams.set("sort", params.sort);
        if (params?.order) searchParams.set("order", params.order);
        if (params?.limit) searchParams.set("limit", String(params.limit));
        if (params?.cursor) searchParams.set("cursor", params.cursor);
        if (params?.includeProfile) searchParams.set("includeProfile", "true");
        const query = searchParams.toString();
        const endpoint = `/org/buildings/${buildingId}/resident-directory${query ? `?${query}` : ""}`;
        const fallbackEndpoint = `/api/org/buildings/${buildingId}/resident-directory${query ? `?${query}` : ""}`;
        const baseHasApi = /\/api$/i.test(API_BASE_URL);
        try {
            const res = await fetchJson(endpoint);
            const payload = res?.data ?? res ?? {};
            const items = Array.isArray(payload?.items) ? payload.items.map(normalizeResidentDirectoryRow) : [];
            return {
                items,
                nextCursor: payload?.nextCursor ?? null,
            };
        } catch (error) {
            const status = (error as { status?: number })?.status;
            if (status === 404 && !baseHasApi) {
                const res = await fetchJson(fallbackEndpoint);
                const payload = res?.data ?? res ?? {};
                const items = Array.isArray(payload?.items) ? payload.items.map(normalizeResidentDirectoryRow) : [];
                return {
                    items,
                    nextCursor: payload?.nextCursor ?? null,
                };
            }
            throw error;
        }
    }
    await delay(800);
    return { items: [], nextCursor: null };
}

export async function moveResidentOccupancy(data: {
    buildingId: string;
    residentUserId: string;
    residentEmail: string;
    residentName: string;
    unitId?: string;
    mode: 'MOVE' | 'MOVE_OUT';
}): Promise<BuildingResident & { tempPassword?: string; mustChangePassword?: boolean }> {
    if (!USE_MOCK) {
        if (data.mode === 'MOVE' && !data.unitId) {
            throw new Error('Unit is required to move resident');
        }
        const res = await fetchJson('/org/users/provision', {
            method: 'POST',
            body: JSON.stringify({
                identity: {
                    email: data.residentEmail,
                    name: data.residentName
                },
                resident: {
                    buildingId: data.buildingId,
                    unitId: data.unitId,
                    mode: data.mode
                },
                mode: {
                    ifEmailExists: 'LINK',
                    requireSameOrg: true
                }
            })
        });
        const payload = res?.data ?? res ?? {};
        const userData = payload?.user ?? payload?.data?.user ?? payload?.identity ?? {};
        const applied = payload?.applied ?? payload?.data?.applied ?? {};
        const resident = applied?.resident ?? payload?.resident ?? payload?.data?.resident ?? {};
        const unit = resident?.unit ?? {};
        return {
            userId: String(userData?.id ?? userData?.userId ?? resident?.userId ?? data.residentUserId ?? ''),
            name: userData?.fullName ?? userData?.name ?? data.residentName,
            email: userData?.email ?? data.residentEmail,
            unit: {
                id: String(unit.id ?? unit.unitId ?? resident?.unitId ?? data.unitId),
                label: unit.label ?? unit.unitLabel ?? ""
            },
            status: resident?.status,
            startAt: resident?.startAt,
            endAt: resident?.endAt,
            tempPassword: payload?.tempPassword ?? resident?.tempPassword,
            mustChangePassword: payload?.mustChangePassword ?? resident?.mustChangePassword
        };
    }
    await delay(800);
    return {
        userId: data.residentUserId,
        name: data.residentName,
        email: data.residentEmail,
        unit: data.unitId ? { id: data.unitId, label: data.unitId } : undefined
    };
}

export async function updateMyProfile(data: { name?: string; avatarUrl?: string; phone?: string }): Promise<User> {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) {
        throw new Error('User not authenticated');
    }
    if (!USE_MOCK) {
        const res = await fetchJson('/users/me/profile', {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
        const payload = res?.data ?? res ?? {};
        const nextUser: User = {
            ...currentUser,
            name: payload.name ?? payload.fullName ?? data.name ?? currentUser.name,
            fullName: payload.fullName ?? payload.name ?? currentUser.fullName,
            avatarUrl: payload.avatarUrl ?? payload.avatar ?? data.avatarUrl ?? currentUser.avatarUrl,
            phoneNumber: payload.phone ?? payload.phoneNumber ?? data.phone ?? currentUser.phoneNumber,
        };
        useAuthStore.setState({ user: nextUser });
        return nextUser;
    }
    await delay(800);
    const nextUser: User = {
        ...currentUser,
        name: data.name ?? currentUser.name,
        fullName: data.name ?? currentUser.fullName,
        avatarUrl: data.avatarUrl ?? currentUser.avatarUrl,
        phoneNumber: data.phone ?? currentUser.phoneNumber,
    };
    useAuthStore.setState({ user: nextUser });
    return nextUser;
}
