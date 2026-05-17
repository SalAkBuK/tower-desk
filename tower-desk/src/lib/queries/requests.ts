import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    addRequestAttachments,
    addRequestComment,
    assignRequestProvider,
    assignRequestProviderWorker,
    assignRequest,
    cancelRequest,
    createRequest,
    getRequest,
    getRequestAssignees,
    getRequests,
    getRequestsForBuildings,
    overrideOwnerApproval,
    requestEstimate,
    requestOwnerApprovalNow,
    sendOwnerApprovalReminder,
    submitRequestEstimate,
    triageRequestPolicy,
    unassignRequestProvider,
    updateRequestStatus,
} from "../api/requests";
import type {
    OwnerApprovalStatus,
    RequestAttachmentUploadPayload,
    RequestCommentVisibility,
    RequestListStatus,
    RequestQueue,
    RequestStatus,
} from "../types";

type RequestListOptions = {
    enabled?: boolean;
    status?: RequestListStatus;
    ownerApprovalStatus?: OwnerApprovalStatus;
    queue?: RequestQueue | null;
};

export function useRequests(buildingId?: string, options?: RequestListOptions) {
    return useQuery({
        queryKey: ["requests", buildingId, options?.status ?? "", options?.ownerApprovalStatus ?? "", options?.queue ?? ""],
        queryFn: () => getRequests(buildingId, {
            status: options?.status,
            ownerApprovalStatus: options?.ownerApprovalStatus,
            queue: options?.queue,
        }),
        enabled: options?.enabled ?? true,
    });
}

export function useAdminRequests(buildingIds: string[], options?: RequestListOptions) {
    return useQuery({
        queryKey: ["admin-requests", buildingIds, options?.status ?? "", options?.ownerApprovalStatus ?? "", options?.queue ?? ""],
        queryFn: () => getRequestsForBuildings(buildingIds, {
            status: options?.status,
            ownerApprovalStatus: options?.ownerApprovalStatus,
            queue: options?.queue,
        }),
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

export function useRequestAssignees(buildingId?: string | null, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["request-assignees", buildingId ?? ""],
        queryFn: () => getRequestAssignees(buildingId ?? ""),
        enabled: options?.enabled ?? Boolean(buildingId),
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

export function useAssignRequestProvider() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId, serviceProviderId, buildingId }: { requestId: string; serviceProviderId: string; buildingId: string }) =>
            assignRequestProvider(requestId, serviceProviderId, buildingId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["requests"] });
            queryClient.invalidateQueries({ queryKey: ["request"] });
            queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
            queryClient.invalidateQueries({ queryKey: ["service-providers"] });
        },
    });
}

export function useAssignRequestProviderWorker() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId, userId, buildingId }: { requestId: string; userId: string; buildingId: string }) =>
            assignRequestProviderWorker(requestId, userId, buildingId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["requests"] });
            queryClient.invalidateQueries({ queryKey: ["request"] });
            queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
        },
    });
}

export function useUnassignRequestProvider() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId, buildingId }: { requestId: string; buildingId: string }) =>
            unassignRequestProvider(requestId, buildingId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["requests"] });
            queryClient.invalidateQueries({ queryKey: ["request"] });
            queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
        },
    });
}

export function useRequestEstimate() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId, buildingId, serviceProviderId }: { requestId: string; buildingId: string; serviceProviderId: string }) =>
            requestEstimate(requestId, buildingId, serviceProviderId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["requests"] });
            queryClient.invalidateQueries({ queryKey: ["request"] });
            queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
        },
    });
}

export function useTriageRequestPolicy() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            requestId,
            buildingId,
            payload,
        }: {
            requestId: string;
            buildingId: string;
            payload: {
                estimatedAmount?: number | null;
                estimatedCurrency?: string | null;
                isEmergency: boolean;
                isLikeForLike: boolean;
                isUpgrade: boolean;
                isMajorReplacement: boolean;
                isResponsibilityDisputed: boolean;
            };
        }) => triageRequestPolicy(requestId, buildingId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["requests"] });
            queryClient.invalidateQueries({ queryKey: ["request"] });
            queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
        },
    });
}

export function useRequestOwnerApprovalNow() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            requestId,
            buildingId,
            payload,
        }: {
            requestId: string;
            buildingId: string;
            payload?: {
                estimatedAmount?: number | null;
                estimatedCurrency?: string | null;
                approvalRequiredReason?: string | null;
                isEmergency?: boolean;
                isLikeForLike?: boolean;
                isUpgrade?: boolean;
                isMajorReplacement?: boolean;
                isResponsibilityDisputed?: boolean;
                ownerApprovalDeadlineAt?: string | null;
            };
        }) => requestOwnerApprovalNow(requestId, buildingId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["requests"] });
            queryClient.invalidateQueries({ queryKey: ["request"] });
            queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
    });
}

export function useSubmitRequestEstimate() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            requestId,
            buildingId,
            payload,
        }: {
            requestId: string;
            buildingId: string;
            payload: {
                estimatedAmount: number;
                estimatedCurrency?: string | null;
                approvalRequiredReason?: string | null;
                isEmergency?: boolean;
                isLikeForLike?: boolean;
                isUpgrade?: boolean;
                isMajorReplacement?: boolean;
                isResponsibilityDisputed?: boolean;
                ownerApprovalDeadlineAt?: string | null;
            };
        }) => submitRequestEstimate(requestId, buildingId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["requests"] });
            queryClient.invalidateQueries({ queryKey: ["request"] });
            queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
        },
    });
}

export function useSendOwnerApprovalReminder() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId, buildingId }: { requestId: string; buildingId: string }) =>
            sendOwnerApprovalReminder(requestId, buildingId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["requests"] });
            queryClient.invalidateQueries({ queryKey: ["request"] });
            queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
        },
    });
}

export function useOverrideOwnerApproval() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            requestId,
            buildingId,
            payload,
        }: {
            requestId: string;
            buildingId: string;
            payload: { decisionSource: string; ownerApprovalOverrideReason: string };
        }) => overrideOwnerApproval(requestId, buildingId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["requests"] });
            queryClient.invalidateQueries({ queryKey: ["request"] });
            queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
        },
    });
}

export function useAddRequestAttachments() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            requestId,
            buildingId,
            attachments,
        }: {
            requestId: string;
            buildingId: string;
            attachments: RequestAttachmentUploadPayload[];
        }) => addRequestAttachments(requestId, buildingId, attachments),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["request"] });
            queryClient.invalidateQueries({ queryKey: ["requests"] });
            queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
        },
    });
}

export function useAddRequestComment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            requestId,
            commentText,
            buildingId,
            visibility,
        }: {
            requestId: string;
            commentText: string;
            buildingId?: string | null;
            visibility?: RequestCommentVisibility;
        }) => addRequestComment(requestId, commentText, buildingId ?? undefined, visibility),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["request"] });
            queryClient.invalidateQueries({ queryKey: ["requests"] });
            queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
        },
    });
}
