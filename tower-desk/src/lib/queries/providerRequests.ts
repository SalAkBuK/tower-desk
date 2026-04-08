import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RequestAttachmentUploadPayload, RequestStatus } from "../types";
import {
    addProviderRequestAttachments,
    addProviderRequestComment,
    assignProviderRequestWorker,
    getProviderRequest,
    getProviderRequestComments,
    getProviderRequestUnreadCount,
    getProviderRequests,
    updateProviderRequestStatus,
} from "../api/providerRequests";

const invalidateProviderRequestQueries = (
    queryClient: ReturnType<typeof useQueryClient>,
    requestId?: string
) => {
    queryClient.invalidateQueries({ queryKey: ["provider-requests"] });
    queryClient.invalidateQueries({ queryKey: ["provider-request-unread-count"] });
    if (requestId) {
        queryClient.invalidateQueries({ queryKey: ["provider-request", requestId] });
        queryClient.invalidateQueries({ queryKey: ["provider-request-comments", requestId] });
    } else {
        queryClient.invalidateQueries({ queryKey: ["provider-request"] });
        queryClient.invalidateQueries({ queryKey: ["provider-request-comments"] });
    }
};

export function useProviderRequests(options?: {
    enabled?: boolean;
    status?: RequestStatus | "all";
    serviceProviderId?: string;
}) {
    return useQuery({
        queryKey: ["provider-requests", options?.status ?? "all", options?.serviceProviderId ?? ""],
        queryFn: () => getProviderRequests({ status: options?.status, serviceProviderId: options?.serviceProviderId }),
        enabled: options?.enabled ?? true,
    });
}

export function useProviderRequestUnreadCount(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["provider-request-unread-count"],
        queryFn: getProviderRequestUnreadCount,
        enabled: options?.enabled ?? true,
    });
}

export function useProviderRequest(requestId?: string | null, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["provider-request", requestId ?? ""],
        queryFn: () => getProviderRequest(requestId as string),
        enabled: options?.enabled ?? Boolean(requestId),
    });
}

export function useProviderRequestComments(requestId?: string | null, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["provider-request-comments", requestId ?? ""],
        queryFn: () => getProviderRequestComments(requestId as string),
        enabled: options?.enabled ?? Boolean(requestId),
    });
}

export function useAssignProviderRequestWorker() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId, userId }: { requestId: string; userId: string }) =>
            assignProviderRequestWorker(requestId, userId),
        onSuccess: (_, variables) => invalidateProviderRequestQueries(queryClient, variables.requestId),
    });
}

export function useUpdateProviderRequestStatus() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId, status }: { requestId: string; status: Extract<RequestStatus, "in-progress" | "completed"> }) =>
            updateProviderRequestStatus(requestId, status),
        onSuccess: (_, variables) => invalidateProviderRequestQueries(queryClient, variables.requestId),
    });
}

export function useAddProviderRequestComment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId, message }: { requestId: string; message: string }) =>
            addProviderRequestComment(requestId, message),
        onSuccess: (_, variables) => invalidateProviderRequestQueries(queryClient, variables.requestId),
    });
}

export function useAddProviderRequestAttachments() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId, attachments }: { requestId: string; attachments: RequestAttachmentUploadPayload[] }) =>
            addProviderRequestAttachments(requestId, attachments),
        onSuccess: (_, variables) => invalidateProviderRequestQueries(queryClient, variables.requestId),
    });
}
