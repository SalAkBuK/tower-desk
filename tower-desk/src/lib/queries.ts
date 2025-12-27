import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getBuildings,
    getBuildingsForAdmin,
    getBuildingsForManager,
    getBuilding,
    getUsers,
    getUsersForAdminBuildings,
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
    getBuildingUnits,
    createBuildingUnit,
    getBuildingAssignments,
    createBuildingAssignment,
    getBuildingResidents,
    createBuildingResident,
    updateMyProfile,
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead
} from './api';
import { RequestStatus } from './types';

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
        mutationFn: ({ name }: { name: string }) => createPlatformOrg(name),
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
    });
}

export function useCreateBuildingUnit() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ buildingId, data }: { buildingId: string; data: { label: string; floor?: number; notes?: string } }) =>
            createBuildingUnit(buildingId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['building-units', variables.buildingId] });
        },
    });
}

export function useBuildingAssignments(buildingId: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['building-assignments', buildingId],
        queryFn: () => getBuildingAssignments(buildingId),
        enabled: options?.enabled ?? !!buildingId,
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

export function useCreateBuildingResident() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ buildingId, data }: { buildingId: string; data: { name: string; email: string; password?: string; unitId: string } }) =>
            createBuildingResident(buildingId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['building-residents', variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ['building-units', variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
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
