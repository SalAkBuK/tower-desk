import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    addRequestComment,
    assignRequest,
    cancelRequest,
    createRequest,
    getRequest,
    getRequests,
    getRequestsForBuildings,
    updateRequestStatus,
} from "../api/requests";
import type { RequestStatus } from "../types";

export function useRequests(buildingId?: string) {
    return useQuery({
        queryKey: ["requests", buildingId],
        queryFn: () => getRequests(buildingId),
    });
}

export function useAdminRequests(buildingIds: string[], options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["admin-requests", buildingIds],
        queryFn: () => getRequestsForBuildings(buildingIds),
        enabled: options?.enabled ?? buildingIds.length > 0,
    });
}

export function useRequest(id: string, buildingId?: string | null, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["request", id, buildingId ?? ""],
        queryFn: () => getRequest(id, buildingId ?? undefined),
        enabled: options?.enabled ?? !!id,
    });
}

export function useCreateRequest() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createRequest,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["requests"] });
            queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
        },
    });
}

export function useUpdateRequestStatus() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, status, note, buildingId }: { id: string; status: RequestStatus; note?: string; buildingId?: string | null }) =>
            updateRequestStatus(id, status, note, buildingId ?? undefined),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["requests"] });
            queryClient.invalidateQueries({ queryKey: ["request"] });
            queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
        },
    });
}

export function useCancelRequest() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId, buildingId }: { requestId: string; buildingId?: string | null }) =>
            cancelRequest(requestId, buildingId ?? undefined),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["requests"] });
            queryClient.invalidateQueries({ queryKey: ["request"] });
            queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
        },
    });
}

export function useAssignRequest() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId, assignedToId, buildingId }: { requestId: string; assignedToId: string; buildingId?: string | null }) =>
            assignRequest(requestId, assignedToId, buildingId ?? undefined),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["requests"] });
            queryClient.invalidateQueries({ queryKey: ["request"] });
            queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
        },
    });
}

export function useAddRequestComment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId, commentText, buildingId }: { requestId: string; commentText: string; buildingId?: string | null }) =>
            addRequestComment(requestId, commentText, buildingId ?? undefined),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["request"] });
            queryClient.invalidateQueries({ queryKey: ["requests"] });
            queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
        },
    });
}
