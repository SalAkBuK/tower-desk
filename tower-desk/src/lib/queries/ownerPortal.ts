import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ConversationCounterpartyGroup, ConversationType } from "../types";
import {
    addOwnerRequestComment,
    approveOwnerRequest,
    createOwnerManagementConversation,
    createOwnerTenantConversation,
    dismissOwnerNotification,
    getOwnerConversationById,
    getOwnerConversationUnreadCount,
    getOwnerConversations,
    getOwnerNotificationUnreadCount,
    getOwnerNotifications,
    getOwnerPortfolioRequest,
    getOwnerPortfolioRequests,
    getOwnerPortfolioSummary,
    getOwnerPortfolioUnits,
    getOwnerRequestCommentUnreadCount,
    getOwnerRequestComments,
    markAllOwnerNotificationsRead,
    markOwnerConversationRead,
    markOwnerNotificationRead,
    rejectOwnerRequest,
    sendOwnerConversationMessage,
    undismissOwnerNotification,
} from "../api/ownerPortal";

export const getOwnerConversationsQueryKey = (params?: {
    limit?: number;
    cursor?: string;
    type?: ConversationType;
    counterpartyGroup?: ConversationCounterpartyGroup;
}) => [
    "owner-conversations",
    params?.limit ?? 20,
    params?.cursor ?? "",
    params?.type ?? "all",
    params?.counterpartyGroup ?? "all",
] as const;

export function useOwnerPortfolioSummary(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["owner-portfolio-summary"],
        queryFn: getOwnerPortfolioSummary,
        enabled: options?.enabled ?? true,
    });
}

export function useOwnerPortfolioUnits(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["owner-portfolio-units"],
        queryFn: getOwnerPortfolioUnits,
        enabled: options?.enabled ?? true,
    });
}

export function useOwnerPortfolioRequests(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["owner-portfolio-requests"],
        queryFn: getOwnerPortfolioRequests,
        enabled: options?.enabled ?? true,
    });
}

export function useOwnerPortfolioRequest(requestId?: string | null, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["owner-portfolio-request", requestId],
        queryFn: () => getOwnerPortfolioRequest(requestId as string),
        enabled: options?.enabled ?? Boolean(requestId),
    });
}

export function useOwnerRequestCommentUnreadCount(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["owner-request-comment-unread-count"],
        queryFn: getOwnerRequestCommentUnreadCount,
        enabled: options?.enabled ?? true,
    });
}

export function useOwnerRequestComments(requestId?: string | null, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["owner-request-comments", requestId],
        queryFn: () => getOwnerRequestComments(requestId as string),
        enabled: options?.enabled ?? Boolean(requestId),
    });
}

const invalidateOwnerRequestQueries = (queryClient: ReturnType<typeof useQueryClient>, requestId?: string | null) => {
    queryClient.invalidateQueries({ queryKey: ["owner-portfolio-requests"] });
    queryClient.invalidateQueries({ queryKey: ["owner-request-comment-unread-count"] });
    if (requestId) {
        queryClient.invalidateQueries({ queryKey: ["owner-portfolio-request", requestId] });
        queryClient.invalidateQueries({ queryKey: ["owner-request-comments", requestId] });
    }
};

export function useApproveOwnerRequest() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId, approvalReason }: { requestId: string; approvalReason?: string }) =>
            approveOwnerRequest(requestId, { approvalReason }),
        onSuccess: (_, variables) => invalidateOwnerRequestQueries(queryClient, variables.requestId),
    });
}

export function useRejectOwnerRequest() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId, approvalReason }: { requestId: string; approvalReason: string }) =>
            rejectOwnerRequest(requestId, { approvalReason }),
        onSuccess: (_, variables) => invalidateOwnerRequestQueries(queryClient, variables.requestId),
    });
}

export function useAddOwnerRequestComment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId, message }: { requestId: string; message: string }) =>
            addOwnerRequestComment(requestId, { message }),
        onSuccess: (_, variables) => invalidateOwnerRequestQueries(queryClient, variables.requestId),
    });
}

export function useOwnerConversations(params?: {
    limit?: number;
    cursor?: string;
    type?: ConversationType;
    counterpartyGroup?: ConversationCounterpartyGroup;
    enabled?: boolean;
}) {
    return useQuery({
        queryKey: getOwnerConversationsQueryKey(params),
        queryFn: () => getOwnerConversations({
            limit: params?.limit,
            cursor: params?.cursor,
            type: params?.type,
            counterpartyGroup: params?.counterpartyGroup,
        }),
        enabled: params?.enabled ?? true,
    });
}

export function useOwnerConversationUnreadCount(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["owner-conversation-unread-count"],
        queryFn: getOwnerConversationUnreadCount,
        enabled: options?.enabled ?? true,
    });
}

export function useOwnerConversation(conversationId?: string | null, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["owner-conversation", conversationId],
        queryFn: () => getOwnerConversationById(conversationId as string),
        enabled: options?.enabled ?? Boolean(conversationId),
    });
}

const invalidateOwnerConversationQueries = (
    queryClient: ReturnType<typeof useQueryClient>,
    conversationId?: string | null
) => {
    queryClient.invalidateQueries({ queryKey: ["owner-conversations"] });
    queryClient.invalidateQueries({ queryKey: ["owner-conversation-unread-count"] });
    if (conversationId) {
        queryClient.invalidateQueries({ queryKey: ["owner-conversation", conversationId] });
    }
};

export function useCreateOwnerManagementConversation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createOwnerManagementConversation,
        onSuccess: () => invalidateOwnerConversationQueries(queryClient),
    });
}

export function useCreateOwnerTenantConversation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createOwnerTenantConversation,
        onSuccess: () => invalidateOwnerConversationQueries(queryClient),
    });
}

export function useSendOwnerConversationMessage() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ conversationId, content }: { conversationId: string; content: string }) =>
            sendOwnerConversationMessage(conversationId, { content }),
        onSuccess: (_, variables) => invalidateOwnerConversationQueries(queryClient, variables.conversationId),
    });
}

export function useMarkOwnerConversationRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (conversationId: string) => markOwnerConversationRead(conversationId),
        onSuccess: (_, conversationId) => invalidateOwnerConversationQueries(queryClient, conversationId),
    });
}

export function useOwnerNotifications(params?: {
    unreadOnly?: boolean;
    includeDismissed?: boolean;
    type?: string;
    limit?: number;
    cursor?: string;
    enabled?: boolean;
}) {
    return useQuery({
        queryKey: [
            "owner-notifications",
            params?.unreadOnly ?? false,
            params?.includeDismissed ?? false,
            params?.type ?? "",
            params?.limit ?? 20,
            params?.cursor ?? "",
        ],
        queryFn: () =>
            getOwnerNotifications({
                unreadOnly: params?.unreadOnly,
                includeDismissed: params?.includeDismissed,
                type: params?.type,
                limit: params?.limit,
                cursor: params?.cursor,
            }),
        enabled: params?.enabled ?? true,
    });
}

export function useOwnerNotificationUnreadCount(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["owner-notification-unread-count"],
        queryFn: getOwnerNotificationUnreadCount,
        enabled: options?.enabled ?? true,
    });
}

const invalidateOwnerNotificationQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
    queryClient.invalidateQueries({ queryKey: ["owner-notifications"] });
    queryClient.invalidateQueries({ queryKey: ["owner-notification-unread-count"] });
};

export function useMarkOwnerNotificationRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (notificationId: string) => markOwnerNotificationRead(notificationId),
        onSuccess: () => invalidateOwnerNotificationQueries(queryClient),
    });
}

export function useMarkAllOwnerNotificationsRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: markAllOwnerNotificationsRead,
        onSuccess: () => invalidateOwnerNotificationQueries(queryClient),
    });
}

export function useDismissOwnerNotification() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (notificationId: string) => dismissOwnerNotification(notificationId),
        onSuccess: () => invalidateOwnerNotificationQueries(queryClient),
    });
}

export function useUndismissOwnerNotification() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (notificationId: string) => undismissOwnerNotification(notificationId),
        onSuccess: () => invalidateOwnerNotificationQueries(queryClient),
    });
}
