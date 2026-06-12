import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    createBroadcast,
    createConversation,
    getBroadcastById,
    getBroadcasts,
    getConversationById,
    getConversations,
    markConversationRead,
    sendConversationMessage,
} from "../api/communications";
import type {
    Broadcast,
    BroadcastListResponse,
    Conversation,
    ConversationCounterpartyGroup,
    ConversationListResponse,
    ConversationType,
    CreateBroadcastInput,
    CreateConversationInput,
} from "../types";

const MESSAGE_PAGE_LIMIT = 50;

export const getConversationsQueryKey = (params?: {
    limit?: number;
    type?: ConversationType;
    counterpartyGroup?: ConversationCounterpartyGroup;
}) => [
    "conversations",
    params?.limit ?? 50,
    params?.type ?? "all",
    params?.counterpartyGroup ?? "all",
] as const;

export function useBroadcasts(params?: { buildingId?: string; limit?: number; enabled?: boolean }) {
    return useQuery<BroadcastListResponse>({
        queryKey: ["broadcasts", params?.buildingId ?? "all", params?.limit ?? 20],
        queryFn: () => getBroadcasts({ buildingId: params?.buildingId, limit: params?.limit }),
        enabled: params?.enabled ?? true,
    });
}

export function useBroadcast(id: string, options?: { enabled?: boolean }) {
    return useQuery<Broadcast>({
        queryKey: ["broadcast", id],
        queryFn: () => getBroadcastById(id),
        enabled: options?.enabled ?? Boolean(id),
    });
}

export function useCreateBroadcast() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateBroadcastInput) => createBroadcast(payload),
        onSuccess: (data, variables) => {
            const broadcast: Broadcast = {
                ...data,
                audiences: data.audiences?.length ? data.audiences : variables.audiences,
            };
            const queries = queryClient.getQueriesData<BroadcastListResponse>({ queryKey: ["broadcasts"] });

            queries.forEach(([queryKey, current]) => {
                const [, buildingIdKey, limitValue] = queryKey as [string, string, number?];
                const buildingIdFilter = buildingIdKey && buildingIdKey !== "all" ? buildingIdKey : undefined;
                const matchesFilter =
                    !buildingIdFilter
                    || !broadcast.buildingIds.length
                    || broadcast.buildingIds.includes(buildingIdFilter);

                if (!matchesFilter) return;

                queryClient.setQueryData<BroadcastListResponse>(queryKey, (prev) => {
                    const items = prev?.items ?? current?.items ?? [];
                    const merged = [broadcast, ...items.filter((item) => item.id !== broadcast.id)];
                    const limit = typeof limitValue === "number" ? limitValue : merged.length;
                    return {
                        items: merged.slice(0, limit),
                        nextCursor: prev?.nextCursor ?? current?.nextCursor ?? null,
                    };
                });
            });
        },
    });
}

export function useConversations(params?: {
    limit?: number;
    type?: ConversationType;
    counterpartyGroup?: ConversationCounterpartyGroup;
    enabled?: boolean;
}) {
    return useQuery<ConversationListResponse>({
        queryKey: getConversationsQueryKey(params),
        queryFn: () => getConversations({ limit: params?.limit ?? 50, type: params?.type, counterpartyGroup: params?.counterpartyGroup }),
        enabled: params?.enabled ?? true,
    });
}

export function useConversation(id: string, options?: { enabled?: boolean }) {
    return useQuery<Conversation>({
        queryKey: ["conversation", id, MESSAGE_PAGE_LIMIT],
        queryFn: () => getConversationById(id, { limit: MESSAGE_PAGE_LIMIT }),
        enabled: options?.enabled ?? Boolean(id),
    });
}

export function useCreateConversation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateConversationInput) => createConversation(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
        },
    });
}

export function useSendConversationMessage() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ conversationId, content }: { conversationId: string; content: string }) =>
            sendConversationMessage(conversationId, { content }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["conversation", variables.conversationId] });
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
        },
    });
}

export function useMarkConversationRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (conversationId: string) => markConversationRead(conversationId),
        onSuccess: (_, conversationId) => {
            queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
        },
    });
}
