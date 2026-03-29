import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getBuildings,
    getBuildingsForAdmin,
    getBuildingsForManager,
    getBuilding,
    getUsers,
    getUsersForAdminBuildings,
    setUserPermissionOverrides,
    getUserPermissionOverrides,
    getEffectivePermissions,
    getPermissions,
    getRoles,
    getUserRoles,
    createRole,
    setRolePermissions,
    setUserRoles,
    getRequests,
    getRequestsForBuildings,
    createRequest,
    updateRequestStatus,
    cancelRequest,
    assignRequest,
    addRequestComment,
    getRequest,
    createUser,
    deleteUser,
    createBuilding,
    assignAdminToBuilding,
    createPlatformOrg,
    createPlatformOrgAdmin,
    getPlatformOrgs,
    getPlatformOrgAdmins,
    getOrgProfile,
    getBuildingUnits,
    getBuildingUnit,
    getUnitTypes,
    createUnitType,
    getOwners,
    createOwner,
    getBuildingAmenities,
    createBuildingAmenity,
    updateBuildingAmenity,
    createBuildingUnit,
    updateBuildingUnit,
    getBuildingAssignments,
    createBuildingAssignment,
    getBuildingResidents,
    createBuildingResident,
    createResidentWithProfile,
    getOrgResidents,
    listResidentInvites,
    resendResidentInvite,
    getUserById,
    updateUserProfile,
    resetUserPassword,
    getBuildingOccupancies,
    getBuildingOccupanciesDto,
    moveResidentOccupancy,
    getResidentDirectory,
    upsertResidentProfile,
    updateMyProfile,
    updateOrgProfile,
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    getBroadcasts,
    getBroadcastById,
    createBroadcast,
    getConversations,
    getConversationById,
    createConversation,
    sendConversationMessage,
    markConversationRead,
    // Parking
    getParkingSlots,
    createParkingSlot,
    updateParkingSlot,
    getOccupancyParkingAllocations,
    createParkingAllocations,
    getUnitParkingAllocations,
    endParkingAllocation,
    endAllParkingAllocations,
    endAllUnitParkingAllocations,
    getOccupancyVehicles,
    createVehicle,
    updateVehicle,
    deleteVehicle,
    // Visitors
    getVisitors,
    createVisitor,
    updateVisitor,
    // Lease Sub-Resources
    listLeaseAccessCards,
    createLeaseAccessCards,
    updateLeaseAccessCardStatus,
    deleteLeaseAccessCard,
    listLeaseParkingStickers,
    createLeaseParkingStickers,
    updateLeaseParkingStickerStatus,
    deleteLeaseParkingSticker,
    getLeaseOccupants,
    replaceLeaseOccupants,
    // Lease Core
    getOrgLeases,
    getActiveLeaseForUnit,
    getLeaseById,
    updateLease,
    getLeaseHistory,
    getResidentLeases,
    getResidentLeaseTimeline,
    getLeaseTimeline,
    createContract,
    activateContract,
    cancelContract,
    replaceContractTerms,
    getLatestContractForResident,
    createMoveInRequest,
    createMoveOutRequest,
    listMoveInRequests,
    listMoveOutRequests,
    approveMoveInRequest,
    rejectMoveInRequest,
    approveMoveOutRequest,
    rejectMoveOutRequest,
    executeMoveIn,
    executeMoveOut,
    listLeaseDocuments,
    createLeaseDocument,
    deleteLeaseDocument
} from './api';
import { RequestStatus, MaintenancePayer, UnitSizeUnit, KitchenType, FurnishedStatus, PaymentFrequency, RoleDefinition, ParkingSlotType, VisitorType, VisitorStatus, Broadcast, BroadcastListResponse, CreateBroadcastInput, Conversation, ConversationListResponse, CreateConversationInput, ConversationMessage, AccessItemStatus, UpdateLeaseDto, CreateContractDto, CreateContractMoveRequestDto, RejectContractMoveRequestDto, ContractMoveRequestStatusFilter, LeaseDocumentType, OrgLeasesQuery, ResidentInviteFilterStatus, ResidentLeaseListQuery, ResidentLeaseTimelineQuery, LeaseTimelineQuery } from './types';

const IS_PROD = process.env.NODE_ENV === 'production';

export function useBuildings(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['buildings'],
        queryFn: getBuildings,
        enabled: options?.enabled ?? true,
    });
}

export function useAdminBuildings(adminId?: string) {
    return useQuery({
        queryKey: ['admin-buildings', adminId],
        queryFn: () => getBuildingsForAdmin(adminId as string),
        enabled: !!adminId,
    });
}

export function useManagerBuildings(managerId?: string) {
    return useQuery({
        queryKey: ['manager-buildings', managerId],
        queryFn: () => getBuildingsForManager(managerId as string),
        enabled: !!managerId,
    });
}

export function useBuilding(id: string) {
    return useQuery({
        queryKey: ['buildings', id],
        queryFn: () => getBuilding(id),
        enabled: !!id,
    });
}

export function useUsers(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['users'],
        queryFn: getUsers,
        enabled: options?.enabled ?? true,
    });
}

export function useAdminUsers(buildingIds: string[]) {
    return useQuery({
        queryKey: ['admin-users', buildingIds],
        queryFn: () => getUsersForAdminBuildings(buildingIds),
        enabled: buildingIds.length > 0,
    });
}

export function useSetUserPermissionOverrides() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, overrides }: { userId: string; overrides: { permissionKey: string; effect: 'ALLOW' | 'DENY' }[] }) =>
            setUserPermissionOverrides(userId, overrides),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });
}

export function useUserPermissionOverrides(userId?: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['user-permission-overrides', userId],
        queryFn: () => getUserPermissionOverrides(userId as string),
        enabled: options?.enabled ?? Boolean(userId),
    });
}

export function useEffectivePermissions(userIds: string[], options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['effective-permissions', userIds],
        queryFn: () => getEffectivePermissions(userIds),
        enabled: options?.enabled ?? userIds.length > 0,
    });
}

export function usePermissions(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['permissions'],
        queryFn: getPermissions,
        enabled: options?.enabled ?? true,
    });
}

export function useRoles(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['roles'],
        queryFn: getRoles,
        enabled: options?.enabled ?? true,
    });
}

export function useUserRoles(userId?: string | null, options?: { enabled?: boolean }) {
    return useQuery<RoleDefinition[]>({
        queryKey: ['user-roles', userId ?? 'me'],
        queryFn: () => getUserRoles(userId ?? undefined),
        enabled: options?.enabled ?? Boolean(userId),
    });
}

export function useCreateRole() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: { key: string; name: string; description?: string }) => createRole(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roles'] });
        },
    });
}

export function useSetRolePermissions() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ roleId, permissionKeys, mode }: { roleId: string; permissionKeys: string[]; mode?: 'add' | 'replace' }) =>
            setRolePermissions(roleId, permissionKeys, mode ?? 'add'),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roles'] });
        },
    });
}

export function useSetUserRoles() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, roleIds, mode }: { userId: string; roleIds: string[]; mode?: 'replace' | 'add' }) =>
            setUserRoles(userId, { roleIds, mode }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['user-roles', variables.userId] });
            queryClient.invalidateQueries({ queryKey: ['effective-permissions', [variables.userId]] });
        },
    });
}
export function useBuildingOccupanciesDto(
    buildingId: string,
    status: "ACTIVE" | "ENDED" | "ALL" = "ACTIVE",
    options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["building-occupancies-dto", buildingId, status],
    queryFn: () => getBuildingOccupanciesDto(buildingId, status),
    enabled: options?.enabled ?? !!buildingId,
  });
}

export function useRequests(buildingId?: string) {
    return useQuery({
        queryKey: ['requests', buildingId],
        queryFn: () => getRequests(buildingId),
    });
}

export function useAdminRequests(buildingIds: string[]) {
    return useQuery({
        queryKey: ['admin-requests', buildingIds],
        queryFn: () => getRequestsForBuildings(buildingIds),
        enabled: buildingIds.length > 0,
    });
}

export function useRequest(id: string, buildingId?: string | null, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['request', id, buildingId ?? ''],
        queryFn: () => getRequest(id, buildingId ?? undefined),
        enabled: options?.enabled ?? !!id,
    });
}

export function useCreateRequest() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createRequest,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['requests'] });
            queryClient.invalidateQueries({ queryKey: ['admin-requests'] });
        },
    });
}

export function useUpdateRequestStatus() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, status, note, buildingId }: { id: string; status: RequestStatus; note?: string; buildingId?: string | null }) =>
            updateRequestStatus(id, status, note, buildingId ?? undefined),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['requests'] });
            queryClient.invalidateQueries({ queryKey: ['request'] });
            queryClient.invalidateQueries({ queryKey: ['admin-requests'] });
        },
    });
}

export function useCancelRequest() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId, buildingId }: { requestId: string; buildingId?: string | null }) =>
            cancelRequest(requestId, buildingId ?? undefined),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['requests'] });
            queryClient.invalidateQueries({ queryKey: ['request'] });
            queryClient.invalidateQueries({ queryKey: ['admin-requests'] });
        },
    });
}

export function useAssignRequest() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId, assignedToId, buildingId }: { requestId: string; assignedToId: string; buildingId?: string | null }) =>
            assignRequest(requestId, assignedToId, buildingId ?? undefined),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['requests'] });
            queryClient.invalidateQueries({ queryKey: ['request'] });
            queryClient.invalidateQueries({ queryKey: ['admin-requests'] });
        },
    });
}

export function useAddRequestComment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId, commentText, buildingId }: { requestId: string; commentText: string; buildingId?: string | null }) =>
            addRequestComment(requestId, commentText, buildingId ?? undefined),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['request'] });
            queryClient.invalidateQueries({ queryKey: ['requests'] });
            queryClient.invalidateQueries({ queryKey: ['admin-requests'] });
        },
    });
}


export function useCreateUser() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ role, data }: { role: any, data: any }) => createUser(role, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        },
    });
}

export function useDeleteUser() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ role, id, buildingIds }: { role: any; id: string; buildingIds?: string[] }) => deleteUser(role, id, buildingIds),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        },
    });
}

export function useCreateBuilding() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createBuilding,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['buildings'] });
        },
    });
}

export function useAssignAdmin() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ buildingId, adminId }: { buildingId: string, adminId: string }) => assignAdminToBuilding(buildingId, adminId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['buildings'] });
            queryClient.invalidateQueries({ queryKey: ['buildings', variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ['admin-buildings', variables.adminId] });
        },
    });
}

export function useCreatePlatformOrg() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: {
            name: string;
            businessName?: string;
            businessType?: 'OWNER' | 'PROPERTY_MANAGEMENT' | 'FACILITY_MANAGEMENT' | 'DEVELOPER';
            tradeLicenseNumber?: string;
            vatRegistrationNumber?: string;
            registeredOfficeAddress?: string;
            city?: string;
            officePhoneNumber?: string;
            businessEmailAddress?: string;
            website?: string;
            ownerName?: string;
        }) => createPlatformOrg(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['platform-orgs'] });
        },
    });
}

export function useCreatePlatformOrgAdmin() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ orgId, name, email, password }: { orgId: string; name: string; email: string; password?: string }) =>
            createPlatformOrgAdmin(orgId, { name, email, password }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['platform-org-admins'] });
        },
    });
}

export function usePlatformOrgs() {
    return useQuery({
        queryKey: ['platform-orgs'],
        queryFn: getPlatformOrgs,
    });
}

export function usePlatformOrgAdmins() {
    return useQuery({
        queryKey: ['platform-org-admins'],
        queryFn: getPlatformOrgAdmins,
    });
}

export function useBuildingUnits(
    buildingId: string,
    options?: { available?: boolean; includeOccupancy?: boolean; search?: string; enabled?: boolean }
) {
    return useQuery({
        queryKey: [
            'building-units',
            buildingId,
            options?.available ?? false,
            options?.includeOccupancy ?? false,
            options?.search ?? '',
        ],
        queryFn: () =>
            getBuildingUnits(buildingId, {
                available: options?.available,
                includeOccupancy: options?.includeOccupancy,
                q: options?.search,
            }),
        enabled: options?.enabled ?? !!buildingId,
        refetchOnWindowFocus: !IS_PROD,
        staleTime: IS_PROD ? 60_000 : 0,
    });
}

export function useBuildingUnit(buildingId: string, unitId: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['building-unit', buildingId, unitId],
        queryFn: () => getBuildingUnit(buildingId, unitId),
        enabled: options?.enabled ?? Boolean(buildingId && unitId),
        refetchOnWindowFocus: !IS_PROD,
        staleTime: IS_PROD ? 60_000 : 0,
    });
}

export function useUnitTypes(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['unit-types'],
        queryFn: getUnitTypes,
        enabled: options?.enabled ?? true,
        refetchOnWindowFocus: !IS_PROD,
        staleTime: IS_PROD ? 5 * 60_000 : 0,
    });
}

export function useBuildingAmenities(buildingId: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['building-amenities', buildingId],
        queryFn: () => getBuildingAmenities(buildingId),
        enabled: options?.enabled ?? !!buildingId,
        refetchOnWindowFocus: !IS_PROD,
        staleTime: IS_PROD ? 5 * 60_000 : 0,
    });
}

export function useCreateBuildingAmenity() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ buildingId, data }: { buildingId: string; data: { name: string; isDefault?: boolean; isActive?: boolean } }) =>
            createBuildingAmenity(buildingId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['building-amenities', variables.buildingId] });
        },
    });
}

export function useUpdateBuildingAmenity() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            buildingId,
            amenityId,
            data
        }: {
            buildingId: string;
            amenityId: string;
            data: { name?: string; isDefault?: boolean; isActive?: boolean };
        }) => updateBuildingAmenity(buildingId, amenityId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['building-amenities', variables.buildingId] });
        },
    });
}

export function useCreateUnitType() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { name: string; isActive?: boolean }) => createUnitType(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['unit-types'] });
        },
    });
}

export function useOwners(options?: { enabled?: boolean; search?: string }) {
    return useQuery({
        queryKey: ['owners', options?.search ?? ''],
        queryFn: () => getOwners(options?.search),
        enabled: options?.enabled ?? true,
        refetchOnWindowFocus: !IS_PROD,
        staleTime: IS_PROD ? 5 * 60_000 : 0,
    });
}

export function useCreateOwner() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { name: string; email?: string; phone?: string; address?: string }) => createOwner(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['owners'] });
        },
    });
}

export function useCreateBuildingUnit() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            buildingId,
            data
        }: {
            buildingId: string;
            data: {
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
            };
        }) =>
            createBuildingUnit(buildingId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['building-units', variables.buildingId] });
        },
    });
}

export function useUpdateBuildingUnit() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            buildingId,
            unitId,
            data
        }: {
            buildingId: string;
            unitId: string;
            data: {
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
            };
        }) =>
            updateBuildingUnit(buildingId, unitId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['building-units', variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ['building-unit', variables.buildingId, variables.unitId] });
        },
    });
}

export function useBuildingAssignments(buildingId: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['building-assignments', buildingId],
        queryFn: () => getBuildingAssignments(buildingId),
        enabled: options?.enabled ?? !!buildingId,
        refetchOnWindowFocus: !IS_PROD,
        staleTime: IS_PROD ? 60_000 : 0,
    });
}

export function useCreateBuildingAssignment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ buildingId, data }: { buildingId: string; data: { userId: string; type: "MANAGER" | "STAFF" | "BUILDING_ADMIN" } }) =>
            createBuildingAssignment(buildingId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['building-assignments', variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        },
    });
}

export function useBuildingResidents(buildingId: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['building-residents', buildingId],
        queryFn: () => getBuildingResidents(buildingId),
        enabled: options?.enabled ?? !!buildingId,
    });
}

export function useBuildingOccupancies(buildingId: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['building-occupancies', buildingId],
        queryFn: () => getBuildingOccupancies(buildingId),
        enabled: options?.enabled ?? !!buildingId,
    });
}

export function useCreateBuildingResident() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ buildingId, data }: { buildingId: string; data: { name: string; email: string; password?: string; unitId: string } }) =>
            createBuildingResident(buildingId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['building-residents', variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ['building-units', variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ['building-occupancies', variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        },
    });
}

export function useCreateResidentWithProfile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ data }: { data: { user: { name: string; email: string; phone?: string; password?: string }; profile?: { emiratesIdNumber?: string; passportNumber?: string; nationality?: string; dateOfBirth?: string; currentAddress?: string; emergencyContactName?: string; emergencyContactPhone?: string } } }) =>
            createResidentWithProfile(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['resident-directory'] });
            queryClient.invalidateQueries({ queryKey: ['building-residents'] });
            queryClient.invalidateQueries({ queryKey: ['org-residents'] });
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        },
    });
}

export function useResendResidentInvite() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (userId: string) => resendResidentInvite(userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['org-residents'] });
            queryClient.invalidateQueries({ queryKey: ['resident-invites'] });
        },
    });
}

export function useUserById(userId?: string | null, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['user', userId],
        queryFn: () => getUserById(userId as string),
        enabled: options?.enabled ?? Boolean(userId),
    });
}

export function useResidentInvites(
    params?: { status?: ResidentInviteFilterStatus; q?: string; limit?: number; cursor?: string },
    options?: { enabled?: boolean }
) {
    return useQuery({
        queryKey: ['resident-invites', params],
        queryFn: () => listResidentInvites(params),
        enabled: options?.enabled ?? true,
    });
}

export function useOrgResidents(
    params?: { status?: "ALL" | "WITH_OCCUPANCY" | "WITHOUT_OCCUPANCY" | "NEW" | "FORMER"; q?: string; limit?: number; cursor?: string; includeProfile?: boolean },
    options?: { enabled?: boolean }
) {
    return useQuery({
        queryKey: ['org-residents', params],
        queryFn: () => getOrgResidents(params),
        enabled: options?.enabled ?? true,
    });
}


export function useUpdateUserProfile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, data }: { userId: string; data: { name?: string; email?: string; phoneNumber?: string; avatarUrl?: string; isActive?: boolean } }) =>
            updateUserProfile(userId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['user', variables.userId] });
            queryClient.invalidateQueries({ queryKey: ['building-residents'] });
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        },
    });
}

export function useUpsertResidentProfile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, data }: { userId: string; data: { emiratesIdNumber?: string; passportNumber?: string; nationality?: string; dateOfBirth?: string; currentAddress?: string; emergencyContactName?: string; emergencyContactPhone?: string } }) =>
            upsertResidentProfile(userId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['resident-directory'] });
            queryClient.invalidateQueries({ queryKey: ['user', variables.userId] });
        },
    });
}

export function useResetUserPassword() {
    return useMutation({
        mutationFn: (userId: string) => resetUserPassword(userId),
    });
}

export function useMoveResidentOccupancy() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { buildingId: string; residentUserId: string; residentEmail: string; residentName: string; unitId?: string; mode: 'MOVE' | 'MOVE_OUT' }) =>
            moveResidentOccupancy(data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['building-residents', variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ['building-units', variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ['building-occupancies', variables.buildingId] });
        },
    });
}

export function useResidentDirectory(
    buildingId: string,
    params?: {
        q?: string;
        status?: string;
        sort?: "residentName" | "unitLabel" | "createdAt" | "startAt";
        order?: "asc" | "desc";
        limit?: number;
        cursor?: string | null;
        includeProfile?: boolean;
        enabled?: boolean;
    }
) {
    return useQuery({
        queryKey: [
            "resident-directory",
            buildingId,
            params?.q ?? "",
            params?.status ?? "",
            params?.sort ?? "",
            params?.order ?? "",
            params?.limit ?? "",
            params?.cursor ?? "",
            params?.includeProfile ?? false,
        ],
        queryFn: () =>
            getResidentDirectory(buildingId, {
                q: params?.q,
                status: params?.status,
                sort: params?.sort,
                order: params?.order,
                limit: params?.limit,
                cursor: params?.cursor ?? undefined,
                includeProfile: params?.includeProfile,
            }),
        enabled: params?.enabled ?? !!buildingId,
        refetchOnWindowFocus: !IS_PROD,
        staleTime: IS_PROD ? 60_000 : 0,
    });
}

export function useUpdateMyProfile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { name?: string; avatarUrl?: string; phone?: string }) => updateMyProfile(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });
}

export function useOrgProfile(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['org-profile'],
        queryFn: getOrgProfile,
        enabled: options?.enabled ?? true,
    });
}

export function useUpdateOrgProfile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: {
            name?: string;
            logoUrl?: string;
            businessName?: string;
            businessType?: 'OWNER' | 'PROPERTY_MANAGEMENT' | 'FACILITY_MANAGEMENT' | 'DEVELOPER';
            tradeLicenseNumber?: string;
            vatRegistrationNumber?: string;
            registeredOfficeAddress?: string;
            city?: string;
            officePhoneNumber?: string;
            businessEmailAddress?: string;
            website?: string;
            ownerName?: string;
        }) => updateOrgProfile(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['org-profile'] });
        },
    });
}

export function useNotifications(params?: { unreadOnly?: boolean; cursor?: string; limit?: number; enabled?: boolean }) {
    return useQuery({
        queryKey: ['notifications', params?.unreadOnly ?? false, params?.cursor ?? '', params?.limit ?? ''],
        queryFn: () => getNotifications({ unreadOnly: params?.unreadOnly, cursor: params?.cursor, limit: params?.limit }),
        enabled: params?.enabled ?? true,
    });
}

export function useMarkNotificationRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (notificationId: string) => markNotificationRead(notificationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
}

export function useMarkAllNotificationsRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => markAllNotificationsRead(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
}

// =====================
// Broadcasts
// =====================

export function useBroadcasts(params?: { buildingId?: string; limit?: number; enabled?: boolean }) {
    return useQuery<BroadcastListResponse>({
        queryKey: ['broadcasts', params?.buildingId ?? 'all', params?.limit ?? 20],
        queryFn: () => getBroadcasts({ buildingId: params?.buildingId, limit: params?.limit }),
        enabled: params?.enabled ?? true,
    });
}

export function useBroadcast(id: string, options?: { enabled?: boolean }) {
    return useQuery<Broadcast>({
        queryKey: ['broadcast', id],
        queryFn: () => getBroadcastById(id),
        enabled: options?.enabled ?? Boolean(id),
    });
}

export function useCreateBroadcast() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateBroadcastInput) => createBroadcast(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
        },
    });
}

// =====================
// Conversations
// =====================

export function useConversations(params?: { limit?: number; enabled?: boolean }) {
    return useQuery<ConversationListResponse>({
        queryKey: ['conversations', params?.limit ?? 20],
        queryFn: () => getConversations({ limit: params?.limit }),
        enabled: params?.enabled ?? true,
    });
}

export function useConversation(id: string, options?: { enabled?: boolean }) {
    return useQuery<Conversation>({
        queryKey: ['conversation', id],
        queryFn: () => getConversationById(id),
        enabled: options?.enabled ?? Boolean(id),
    });
}

export function useCreateConversation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateConversationInput) => createConversation(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
        },
    });
}

export function useSendConversationMessage() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ conversationId, content }: { conversationId: string; content: string }) =>
            sendConversationMessage(conversationId, { content }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['conversation', variables.conversationId] });
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
        },
    });
}

export function useMarkConversationRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (conversationId: string) => markConversationRead(conversationId),
        onSuccess: (_, conversationId) => {
            queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
        },
    });
}

// =====================
// Parking Slots
// =====================

export function useParkingSlots(buildingId: string, options?: { available?: boolean; enabled?: boolean }) {
    return useQuery({
        queryKey: ['parking-slots', buildingId, options?.available ?? false],
        queryFn: () => getParkingSlots(buildingId, { available: options?.available }),
        enabled: options?.enabled ?? !!buildingId,
        refetchOnWindowFocus: !IS_PROD,
        staleTime: IS_PROD ? 60_000 : 0,
    });
}

export function useCreateParkingSlot() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ buildingId, data }: { buildingId: string; data: { code: string; type: ParkingSlotType; level?: string; isCovered?: boolean } }) =>
            createParkingSlot(buildingId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['parking-slots', variables.buildingId] });
        },
    });
}

export function useUpdateParkingSlot() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ slotId, buildingId, data }: { slotId: string; buildingId: string; data: { code?: string; type?: ParkingSlotType; level?: string; isCovered?: boolean; isActive?: boolean } }) =>
            updateParkingSlot(slotId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['parking-slots', variables.buildingId] });
        },
    });
}

// =====================
// Parking Allocations
// =====================

export function useOccupancyParkingAllocations(occupancyId: string, options?: { active?: boolean; enabled?: boolean }) {
    return useQuery({
        queryKey: ['occupancy-parking-allocations', occupancyId, options?.active],
        queryFn: () => getOccupancyParkingAllocations(occupancyId, { active: options?.active }),
        enabled: options?.enabled ?? !!occupancyId,
        refetchOnWindowFocus: !IS_PROD,
        staleTime: IS_PROD ? 60_000 : 0,
    });
}

export function useCreateParkingAllocations() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (variables: { buildingId: string; leaseId?: string; data: { occupancyId?: string; unitId?: string; slotIds?: string[]; count?: number } }) =>
            createParkingAllocations(variables.buildingId, variables.data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['parking-slots', variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ['parking-slot-unit-labels', variables.buildingId] });
            if (variables.data.occupancyId) {
                queryClient.invalidateQueries({ queryKey: ['occupancy-parking-allocations', variables.data.occupancyId] });
            }
            if (variables.data.unitId) {
                queryClient.invalidateQueries({ queryKey: ['unit-parking-allocations', variables.data.unitId] });
            }
            if (variables.leaseId) {
                queryClient.invalidateQueries({ queryKey: ['lease-timeline', variables.leaseId] });
                queryClient.invalidateQueries({ queryKey: ['leases', 'byId', variables.leaseId] });
            }
        },
    });
}

export function useUnitParkingAllocations(unitId: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['unit-parking-allocations', unitId],
        queryFn: () => getUnitParkingAllocations(unitId),
        enabled: options?.enabled ?? !!unitId,
        refetchOnWindowFocus: !IS_PROD,
        staleTime: IS_PROD ? 60_000 : 0,
    });
}

export function useEndAllUnitParkingAllocations() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ unitId, buildingId, data }: { unitId: string; buildingId?: string; data?: { endDate?: string } }) =>
            endAllUnitParkingAllocations(unitId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['unit-parking-allocations', variables.unitId] });
            if (variables.buildingId) {
                queryClient.invalidateQueries({ queryKey: ['parking-slots', variables.buildingId] });
            }
        },
    });
}

export function useEndParkingAllocation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (variables: { allocationId: string; buildingId: string; occupancyId: string; leaseId?: string; data?: { endDate?: string } }) =>
            endParkingAllocation(variables.allocationId, variables.data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['parking-slots', variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ['occupancy-parking-allocations', variables.occupancyId] });
            if (variables.leaseId) {
                queryClient.invalidateQueries({ queryKey: ['lease-timeline', variables.leaseId] });
                queryClient.invalidateQueries({ queryKey: ['leases', 'byId', variables.leaseId] });
            }
        },
    });
}

export function useEndAllParkingAllocations() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (variables: { occupancyId: string; buildingId: string; leaseId?: string; data?: { endDate?: string } }) =>
            endAllParkingAllocations(variables.occupancyId, variables.data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['parking-slots', variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ['occupancy-parking-allocations', variables.occupancyId] });
            if (variables.leaseId) {
                queryClient.invalidateQueries({ queryKey: ['lease-timeline', variables.leaseId] });
                queryClient.invalidateQueries({ queryKey: ['leases', 'byId', variables.leaseId] });
            }
        },
    });
}

// =====================
// Vehicles
// =====================

export function useOccupancyVehicles(occupancyId: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['occupancy-vehicles', occupancyId],
        queryFn: () => getOccupancyVehicles(occupancyId),
        enabled: options?.enabled ?? !!occupancyId,
        refetchOnWindowFocus: !IS_PROD,
        staleTime: IS_PROD ? 60_000 : 0,
    });
}

export function useCreateVehicle() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (variables: { occupancyId: string; leaseId?: string; data: { plateNumber: string; label?: string } }) =>
            createVehicle(variables.occupancyId, variables.data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['occupancy-vehicles', variables.occupancyId] });
            if (variables.leaseId) {
                queryClient.invalidateQueries({ queryKey: ['lease-timeline', variables.leaseId] });
                queryClient.invalidateQueries({ queryKey: ['leases', 'byId', variables.leaseId] });
            }
        },
    });
}

export function useUpdateVehicle() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (variables: { vehicleId: string; occupancyId: string; leaseId?: string; data: { plateNumber?: string; label?: string } }) =>
            updateVehicle(variables.vehicleId, variables.data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['occupancy-vehicles', variables.occupancyId] });
            if (variables.leaseId) {
                queryClient.invalidateQueries({ queryKey: ['lease-timeline', variables.leaseId] });
                queryClient.invalidateQueries({ queryKey: ['leases', 'byId', variables.leaseId] });
            }
        },
    });
}

export function useDeleteVehicle() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (variables: { vehicleId: string; occupancyId: string; leaseId?: string }) =>
            deleteVehicle(variables.vehicleId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['occupancy-vehicles', variables.occupancyId] });
            if (variables.leaseId) {
                queryClient.invalidateQueries({ queryKey: ['lease-timeline', variables.leaseId] });
                queryClient.invalidateQueries({ queryKey: ['leases', 'byId', variables.leaseId] });
            }
        },
    });
}

// =====================
// Visitors
// =====================

export function useVisitors(buildingId: string, filters?: { status?: VisitorStatus; unitId?: string }, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['visitors', buildingId, filters?.status ?? '', filters?.unitId ?? ''],
        queryFn: () => getVisitors(buildingId, filters),
        enabled: options?.enabled ?? !!buildingId,
        refetchOnWindowFocus: !IS_PROD,
        staleTime: IS_PROD ? 60_000 : 0,
    });
}

export function useCreateVisitor() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            buildingId,
            data
        }: {
            buildingId: string;
            data: {
                unitId: string;
                visitorName: string;
                phoneNumber?: string;
                type: VisitorType;
                emiratesId?: string;
                vehicleNumber?: string;
                expectedArrivalAt?: string;
                notes?: string;
            };
        }) => createVisitor(buildingId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['visitors', variables.buildingId] });
        },
    });
}

export function useUpdateVisitor() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            buildingId,
            visitorId,
            data
        }: {
            buildingId: string;
            visitorId: string;
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
            };
        }) => updateVisitor(buildingId, visitorId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['visitors', variables.buildingId] });
        },
    });
}

// =====================
// Lease Sub-Resources
// =====================

export function useLeaseAccessCards(leaseId?: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['leases', 'accessCards', leaseId],
        queryFn: () => listLeaseAccessCards(leaseId as string),
        enabled: options?.enabled ?? !!leaseId,
    });
}

export function useCreateLeaseAccessCards() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ leaseId, cardNumbers }: { leaseId: string; cardNumbers: string[] }) =>
            createLeaseAccessCards(leaseId, { cardNumbers }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['leases', 'accessCards', variables.leaseId] });
        },
    });
}

export function useUpdateLeaseAccessCardStatus() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ leaseId, cardId, status }: { leaseId: string; cardId: string; status: AccessItemStatus }) =>
            updateLeaseAccessCardStatus(leaseId, cardId, { status }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['leases', 'accessCards', variables.leaseId] });
        },
    });
}

export function useDeleteLeaseAccessCard() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ leaseId, cardId }: { leaseId: string; cardId: string }) =>
            deleteLeaseAccessCard(leaseId, cardId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['leases', 'accessCards', variables.leaseId] });
        },
    });
}

export function useLeaseParkingStickers(leaseId?: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['leases', 'parkingStickers', leaseId],
        queryFn: () => listLeaseParkingStickers(leaseId as string),
        enabled: options?.enabled ?? !!leaseId,
    });
}

export function useCreateLeaseParkingStickers() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ leaseId, stickerNumbers }: { leaseId: string; stickerNumbers: string[] }) =>
            createLeaseParkingStickers(leaseId, { stickerNumbers }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['leases', 'parkingStickers', variables.leaseId] });
        },
    });
}

export function useUpdateLeaseParkingStickerStatus() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ leaseId, stickerId, status }: { leaseId: string; stickerId: string; status: AccessItemStatus }) =>
            updateLeaseParkingStickerStatus(leaseId, stickerId, { status }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['leases', 'parkingStickers', variables.leaseId] });
        },
    });
}

export function useDeleteLeaseParkingSticker() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ leaseId, stickerId }: { leaseId: string; stickerId: string }) =>
            deleteLeaseParkingSticker(leaseId, stickerId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['leases', 'parkingStickers', variables.leaseId] });
        },
    });
}

export function useLeaseOccupants(leaseId?: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['leases', 'occupants', leaseId],
        queryFn: () => getLeaseOccupants(leaseId as string),
        enabled: options?.enabled ?? !!leaseId,
    });
}

export function useReplaceLeaseOccupants() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ leaseId, names }: { leaseId: string; names: string[] }) =>
            replaceLeaseOccupants(leaseId, { names }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['leases', 'occupants', variables.leaseId] });
        },
    });
}

// =====================
// Lease Core
// =====================

export function useOrgLeases(
    query?: OrgLeasesQuery,
    options?: { enabled?: boolean }
) {
    return useQuery({
        queryKey: ['org-leases', query],
        queryFn: () => getOrgLeases(query),
        enabled: options?.enabled ?? true,
        retry: (failureCount, error) => {
            const status = (error as { status?: unknown })?.status;
            if (typeof status === 'number' && [400, 401, 403, 404].includes(status)) {
                return false;
            }
            return failureCount < 2;
        },
    });
}

export function useActiveLease(buildingId?: string, unitId?: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['leases', 'active', buildingId, unitId],
        queryFn: () => getActiveLeaseForUnit(buildingId as string, unitId as string),
        enabled: options?.enabled ?? Boolean(buildingId && unitId),
    });
}

export function useLeaseById(leaseId?: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['leases', 'byId', leaseId],
        queryFn: () => getLeaseById(leaseId as string),
        enabled: options?.enabled ?? !!leaseId,
    });
}

export function useCreateContract() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ buildingId, dto }: { buildingId: string; dto: CreateContractDto }) =>
            createContract(buildingId, dto),
        onSuccess: (contract, variables) => {
            queryClient.invalidateQueries({ queryKey: ['org-leases'] });
            queryClient.invalidateQueries({ queryKey: ['leases', 'byId', contract.id] });
            queryClient.invalidateQueries({ queryKey: ['resident-directory', variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ['building-units', variables.buildingId] });
        },
    });
}

export function useActivateContract() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ contractId }: { contractId: string }) => activateContract(contractId),
        onSuccess: (contract) => {
            queryClient.invalidateQueries({ queryKey: ['leases', 'byId', contract.id] });
            queryClient.invalidateQueries({ queryKey: ['org-leases'] });
            queryClient.invalidateQueries({ queryKey: ['lease-timeline', contract.id] });
            if (contract.residentUserId) {
                queryClient.invalidateQueries({ queryKey: ['resident-contract-latest', contract.residentUserId] });
                queryClient.invalidateQueries({ queryKey: ['resident-leases', contract.residentUserId] });
            }
        },
    });
}

export function useCancelContract() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ contractId, reason }: { contractId: string; reason?: string }) => cancelContract(contractId, reason),
        onSuccess: (contract) => {
            queryClient.invalidateQueries({ queryKey: ['leases', 'byId', contract.id] });
            queryClient.invalidateQueries({ queryKey: ['org-leases'] });
            queryClient.invalidateQueries({ queryKey: ['lease-history', contract.id] });
            queryClient.invalidateQueries({ queryKey: ['lease-timeline', contract.id] });
            queryClient.invalidateQueries({ queryKey: ['move-in-requests'] });
            queryClient.invalidateQueries({ queryKey: ['move-out-requests'] });
            if (contract.residentUserId) {
                queryClient.invalidateQueries({ queryKey: ['resident-contract-latest', contract.residentUserId] });
                queryClient.invalidateQueries({ queryKey: ['resident-leases', contract.residentUserId] });
            }
        },
    });
}

export function useReplaceContractTerms() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ contractId, terms }: { contractId: string; terms: string[] }) =>
            replaceContractTerms(contractId, terms),
        onSuccess: (contract, variables) => {
            queryClient.invalidateQueries({ queryKey: ['leases', 'byId', variables.contractId] });
            queryClient.invalidateQueries({ queryKey: ['lease-timeline', variables.contractId] });
            queryClient.invalidateQueries({ queryKey: ['org-leases'] });
            if (contract.residentUserId) {
                queryClient.invalidateQueries({ queryKey: ['resident-contract-latest', contract.residentUserId] });
            }
        },
    });
}

export function useLatestContractForResident(residentUserId?: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['resident-contract-latest', residentUserId],
        queryFn: () => getLatestContractForResident(residentUserId as string),
        enabled: options?.enabled ?? Boolean(residentUserId),
    });
}

export function useUpdateLease() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ leaseId, dto }: { leaseId: string; dto: UpdateLeaseDto }) =>
            updateLease(leaseId, dto),
        onSuccess: (updatedLease, variables) => {
            queryClient.invalidateQueries({ queryKey: ['leases', 'byId', variables.leaseId] });
            queryClient.invalidateQueries({ queryKey: ['lease-history', variables.leaseId] });
            queryClient.invalidateQueries({ queryKey: ['lease-timeline', variables.leaseId] });
            queryClient.invalidateQueries({ queryKey: ['org-leases'] });
            if (updatedLease.residentUserId) {
                queryClient.invalidateQueries({ queryKey: ['resident-leases', updatedLease.residentUserId] });
                queryClient.invalidateQueries({ queryKey: ['resident-lease-timeline', updatedLease.residentUserId] });
            }
            queryClient.invalidateQueries({ queryKey: ['leases', 'active', updatedLease.buildingId, updatedLease.unitId] });
            queryClient.invalidateQueries({ queryKey: ['building-occupancies', updatedLease.buildingId] });
            queryClient.invalidateQueries({ queryKey: ['building-occupancies-dto', updatedLease.buildingId] });
            queryClient.invalidateQueries({ queryKey: ['building-units', updatedLease.buildingId] });
        },
    });
}

export function useLeaseHistory(leaseId?: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['lease-history', leaseId],
        queryFn: () => getLeaseHistory(leaseId as string),
        enabled: options?.enabled ?? !!leaseId,
    });
}

export function useResidentLeases(
    residentUserId?: string,
    query?: ResidentLeaseListQuery,
    options?: { enabled?: boolean }
) {
    return useQuery({
        queryKey: ['resident-leases', residentUserId, query],
        queryFn: () => getResidentLeases(residentUserId as string, query),
        enabled: options?.enabled ?? !!residentUserId,
    });
}

export function useResidentLeaseTimeline(
    residentUserId?: string,
    query?: ResidentLeaseTimelineQuery,
    options?: { enabled?: boolean }
) {
    return useQuery({
        queryKey: ['resident-lease-timeline', residentUserId, query],
        queryFn: () => getResidentLeaseTimeline(residentUserId as string, query),
        enabled: options?.enabled ?? !!residentUserId,
    });
}

export function useLeaseTimeline(
    leaseId?: string,
    query?: LeaseTimelineQuery,
    options?: { enabled?: boolean }
) {
    return useQuery({
        queryKey: ['lease-timeline', leaseId, query],
        queryFn: () => getLeaseTimeline(leaseId as string, query),
        enabled: options?.enabled ?? !!leaseId,
    });
}

export function useLeaseDocuments(leaseId?: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['leases', 'documents', leaseId],
        queryFn: () => listLeaseDocuments(leaseId as string),
        enabled: options?.enabled ?? !!leaseId,
    });
}

export function useCreateMoveInRequest() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ contractId, dto }: { contractId: string; dto: CreateContractMoveRequestDto }) =>
            createMoveInRequest(contractId, dto),
        onSuccess: (request, variables) => {
            queryClient.invalidateQueries({ queryKey: ['move-in-requests'] });
            queryClient.invalidateQueries({ queryKey: ['leases', 'byId', variables.contractId] });
            queryClient.invalidateQueries({ queryKey: ['org-leases'] });
            if (request.buildingId) {
                queryClient.invalidateQueries({ queryKey: ['move-in-requests', request.buildingId] });
            }
            if (request.residentUserId) {
                queryClient.invalidateQueries({ queryKey: ['resident-contract-latest', request.residentUserId] });
                queryClient.invalidateQueries({ queryKey: ['resident-leases', request.residentUserId] });
            }
        },
    });
}

export function useCreateMoveOutRequest() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ contractId, dto }: { contractId: string; dto: CreateContractMoveRequestDto }) =>
            createMoveOutRequest(contractId, dto),
        onSuccess: (request, variables) => {
            queryClient.invalidateQueries({ queryKey: ['move-out-requests'] });
            queryClient.invalidateQueries({ queryKey: ['leases', 'byId', variables.contractId] });
            queryClient.invalidateQueries({ queryKey: ['org-leases'] });
            if (request.buildingId) {
                queryClient.invalidateQueries({ queryKey: ['move-out-requests', request.buildingId] });
            }
            if (request.residentUserId) {
                queryClient.invalidateQueries({ queryKey: ['resident-contract-latest', request.residentUserId] });
                queryClient.invalidateQueries({ queryKey: ['resident-leases', request.residentUserId] });
            }
        },
    });
}

export function useMoveInRequests(
    buildingId?: string,
    status?: ContractMoveRequestStatusFilter,
    options?: { enabled?: boolean }
) {
    return useQuery({
        queryKey: ['move-in-requests', buildingId, status ?? 'ALL'],
        queryFn: () => listMoveInRequests(buildingId as string, status),
        enabled: options?.enabled ?? Boolean(buildingId),
    });
}

export function useMoveOutRequests(
    buildingId?: string,
    status?: ContractMoveRequestStatusFilter,
    options?: { enabled?: boolean }
) {
    return useQuery({
        queryKey: ['move-out-requests', buildingId, status ?? 'ALL'],
        queryFn: () => listMoveOutRequests(buildingId as string, status),
        enabled: options?.enabled ?? Boolean(buildingId),
    });
}

export function useApproveMoveInRequest() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId }: { requestId: string }) => approveMoveInRequest(requestId),
        onSuccess: (request) => {
            queryClient.invalidateQueries({ queryKey: ['move-in-requests'] });
            if (request.buildingId) {
                queryClient.invalidateQueries({ queryKey: ['move-in-requests', request.buildingId] });
            }
        },
    });
}

export function useRejectMoveInRequest() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId, dto }: { requestId: string; dto?: RejectContractMoveRequestDto }) =>
            rejectMoveInRequest(requestId, dto),
        onSuccess: (request) => {
            queryClient.invalidateQueries({ queryKey: ['move-in-requests'] });
            if (request.buildingId) {
                queryClient.invalidateQueries({ queryKey: ['move-in-requests', request.buildingId] });
            }
        },
    });
}

export function useApproveMoveOutRequest() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId }: { requestId: string }) => approveMoveOutRequest(requestId),
        onSuccess: (request) => {
            queryClient.invalidateQueries({ queryKey: ['move-out-requests'] });
            if (request.buildingId) {
                queryClient.invalidateQueries({ queryKey: ['move-out-requests', request.buildingId] });
            }
        },
    });
}

export function useRejectMoveOutRequest() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId, dto }: { requestId: string; dto?: RejectContractMoveRequestDto }) =>
            rejectMoveOutRequest(requestId, dto),
        onSuccess: (request) => {
            queryClient.invalidateQueries({ queryKey: ['move-out-requests'] });
            if (request.buildingId) {
                queryClient.invalidateQueries({ queryKey: ['move-out-requests', request.buildingId] });
            }
        },
    });
}

export function useExecuteMoveIn() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ contractId }: { contractId: string }) => executeMoveIn(contractId),
        onSuccess: (contract, variables) => {
            queryClient.invalidateQueries({ queryKey: ['leases', 'byId', variables.contractId] });
            queryClient.invalidateQueries({ queryKey: ['lease-history', variables.contractId] });
            queryClient.invalidateQueries({ queryKey: ['lease-timeline', variables.contractId] });
            queryClient.invalidateQueries({ queryKey: ['org-leases'] });
            queryClient.invalidateQueries({ queryKey: ['move-in-requests'] });
            if (contract.residentUserId) {
                queryClient.invalidateQueries({ queryKey: ['resident-contract-latest', contract.residentUserId] });
                queryClient.invalidateQueries({ queryKey: ['resident-leases', contract.residentUserId] });
            }
            if (contract.buildingId) {
                queryClient.invalidateQueries({ queryKey: ['building-occupancies', contract.buildingId] });
                queryClient.invalidateQueries({ queryKey: ['building-occupancies-dto', contract.buildingId] });
                queryClient.invalidateQueries({ queryKey: ['resident-directory', contract.buildingId] });
            }
        },
    });
}

export function useExecuteMoveOut() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ contractId }: { contractId: string }) => executeMoveOut(contractId),
        onSuccess: (contract, variables) => {
            queryClient.invalidateQueries({ queryKey: ['leases', 'byId', variables.contractId] });
            queryClient.invalidateQueries({ queryKey: ['lease-history', variables.contractId] });
            queryClient.invalidateQueries({ queryKey: ['lease-timeline', variables.contractId] });
            queryClient.invalidateQueries({ queryKey: ['org-leases'] });
            queryClient.invalidateQueries({ queryKey: ['move-out-requests'] });
            if (contract.residentUserId) {
                queryClient.invalidateQueries({ queryKey: ['resident-contract-latest', contract.residentUserId] });
                queryClient.invalidateQueries({ queryKey: ['resident-leases', contract.residentUserId] });
            }
            if (contract.buildingId) {
                queryClient.invalidateQueries({ queryKey: ['building-occupancies', contract.buildingId] });
                queryClient.invalidateQueries({ queryKey: ['building-occupancies-dto', contract.buildingId] });
                queryClient.invalidateQueries({ queryKey: ['resident-directory', contract.buildingId] });
            }
        },
    });
}

export function useCreateLeaseDocument() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ leaseId, dto }: { leaseId: string; dto: { type: LeaseDocumentType; fileName: string; mimeType: string; sizeBytes: number; url: string } }) =>
            createLeaseDocument(leaseId, dto),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['leases', 'documents', variables.leaseId] });
            // Optionally invalidate lease-by-id if document counts are displayed
            queryClient.invalidateQueries({ queryKey: ['leases', 'byId', variables.leaseId] });
        },
    });
}

export function useDeleteLeaseDocument() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ leaseId, documentId }: { leaseId: string; documentId: string }) =>
            deleteLeaseDocument(leaseId, documentId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['leases', 'documents', variables.leaseId] });
            queryClient.invalidateQueries({ queryKey: ['leases', 'byId', variables.leaseId] });
        },
    });
}
