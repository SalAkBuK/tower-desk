import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBuildings, getBuildingsForAdmin, getBuildingsForManager, getBuilding, getUsers, getUsersForAdminBuildings, getRequests, getRequestsForBuildings, createRequest, updateRequestStatus, assignRequest, addRequestComment, getRequest, createUser, deleteUser, createBuilding, assignAdminToBuilding } from './api';
import { RequestStatus, ServiceRequest } from './types';

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

export function useRequest(id: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['request', id],
        queryFn: () => getRequest(id),
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
        mutationFn: ({ id, status, note }: { id: string; status: RequestStatus; note?: string }) => updateRequestStatus(id, status, note),
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
        mutationFn: ({ requestId, assignedToId }: { requestId: string; assignedToId: string }) => assignRequest(requestId, assignedToId),
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
        mutationFn: ({ requestId, commentText }: { requestId: string; commentText: string }) => addRequestComment(requestId, commentText),
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
