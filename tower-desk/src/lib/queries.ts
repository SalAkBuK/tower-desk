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
    getUserById,
    updateUserProfile,
    resetUserPassword,
    getBuildingOccupancies,
    moveResidentOccupancy,
    updateMyProfile,
    updateOrgProfile,
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    // Parking
    getParkingSlots,
    createParkingSlot,
    updateParkingSlot,
    getOccupancyParkingAllocations,
    createParkingAllocations,
    endParkingAllocation,
    endAllParkingAllocations,
    getOccupancyVehicles,
    createVehicle,
    updateVehicle,
    deleteVehicle
} from './api';
import { RequestStatus, MaintenancePayer, UnitSizeUnit, KitchenType, FurnishedStatus, PaymentFrequency, RoleDefinition, ParkingSlotType } from './types';

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

export function useBuildingUnits(buildingId: string, options?: { available?: boolean; enabled?: boolean }) {
    return useQuery({
        queryKey: ['building-units', buildingId, options?.available ?? false],
        queryFn: () => getBuildingUnits(buildingId, { available: options?.available }),
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
                includedParkingSlots?: number;
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
                includedParkingSlots?: number;
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

export function useUserById(userId?: string | null, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['user', userId],
        queryFn: () => getUserById(userId as string),
        enabled: options?.enabled ?? Boolean(userId),
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
        mutationFn: ({ buildingId, data }: { buildingId: string; data: { occupancyId: string; slotIds?: string[]; count?: number } }) =>
            createParkingAllocations(buildingId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['parking-slots', variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ['occupancy-parking-allocations', variables.data.occupancyId] });
        },
    });
}

export function useEndParkingAllocation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ allocationId, buildingId, occupancyId, data }: { allocationId: string; buildingId: string; occupancyId: string; data?: { endDate?: string } }) =>
            endParkingAllocation(allocationId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['parking-slots', variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ['occupancy-parking-allocations', variables.occupancyId] });
        },
    });
}

export function useEndAllParkingAllocations() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ occupancyId, buildingId, data }: { occupancyId: string; buildingId: string; data?: { endDate?: string } }) =>
            endAllParkingAllocations(occupancyId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['parking-slots', variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ['occupancy-parking-allocations', variables.occupancyId] });
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
        mutationFn: ({ occupancyId, data }: { occupancyId: string; data: { plateNumber: string; label?: string } }) =>
            createVehicle(occupancyId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['occupancy-vehicles', variables.occupancyId] });
        },
    });
}

export function useUpdateVehicle() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ vehicleId, occupancyId, data }: { vehicleId: string; occupancyId: string; data: { plateNumber?: string; label?: string } }) =>
            updateVehicle(vehicleId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['occupancy-vehicles', variables.occupancyId] });
        },
    });
}

export function useDeleteVehicle() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ vehicleId, occupancyId }: { vehicleId: string; occupancyId: string }) =>
            deleteVehicle(vehicleId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['occupancy-vehicles', variables.occupancyId] });
        },
    });
}
