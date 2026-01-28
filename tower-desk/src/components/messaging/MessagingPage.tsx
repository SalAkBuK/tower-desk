"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageCircle, Plus, Send, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { getConversations } from "@/lib/api";
import { connectNotificationsSocket } from "@/lib/notificationsSocket";
import { getUserPermissionSet, hasPermission, hasPermissionPrefix } from "@/lib/permissions";
import {
    useAdminBuildings,
    useBuildingResidents,
    useConversations,
    useConversation,
    useCreateConversation,
    useManagerBuildings,
    useSendConversationMessage,
    useUsers,
    useMarkConversationRead,
} from "@/lib/queries";
import type { Conversation, ConversationListResponse, ConversationMessage } from "@/lib/types";

const PAGE_LIMIT = 20;
const MIN_MESSAGE = 1;
const MAX_MESSAGE = 5000;
const MIN_TITLE = 3;
const MAX_TITLE = 200;

export function MessagingPage() {
    const { user, token, baseRole, selectedOrgId } = useAuth();
    const isManager = baseRole === "manager";
    const isResident = baseRole === "tenant";
    const permissionSet = useMemo(
        () => getUserPermissionSet(user),
        [user?.effectivePermissions, user?.roleKeys, user?.orgRoleKeys]
    );
    const canRead = hasPermissionPrefix(permissionSet, "messaging");
    const canWrite = hasPermission(permissionSet, "messaging.write") || hasPermissionPrefix(permissionSet, "messaging.write");

    const adminBuildingsQuery = useAdminBuildings(isManager ? undefined : user?.id);
    const managerBuildingsQuery = useManagerBuildings(isManager ? user?.id : undefined);
    const buildings = isManager ? managerBuildingsQuery.data : adminBuildingsQuery.data;
    const buildingOptions = useMemo(
        () => (buildings || []).slice().sort((a, b) => a.name.localeCompare(b.name)),
        [buildings]
    );

    const [selectedConversationId, setSelectedConversationId] = useState<string>("");
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [newSubject, setNewSubject] = useState("");
    const [newMessage, setNewMessage] = useState("");
    const [newBuildingId, setNewBuildingId] = useState<string>("");
    const [participantIds, setParticipantIds] = useState<string[]>([]);
    const [selectedParticipantId, setSelectedParticipantId] = useState<string>("");
    const [replyContent, setReplyContent] = useState("");

    const listQuery = useConversations({ limit: PAGE_LIMIT, enabled: canRead });
    const conversations = listQuery.data?.items ?? [];
    const nextCursor = listQuery.data?.nextCursor ?? null;

    const conversationQuery = useConversation(selectedConversationId, { enabled: Boolean(selectedConversationId && canRead) });
    const conversation = conversationQuery.data;

    const createConversationMutation = useCreateConversation();
    const sendMessageMutation = useSendConversationMessage();
    const markReadMutation = useMarkConversationRead();
    const queryClient = useQueryClient();

    const residentsQuery = useBuildingResidents(newBuildingId, { enabled: Boolean(newBuildingId) });
    const usersQuery = useUsers({ enabled: !isManager && !newBuildingId });

    const participantOptions = useMemo(() => {
        if (isManager || newBuildingId) {
            const residents = residentsQuery.data ?? [];
            return residents
                .filter((resident) => resident.userId)
                .map((resident) => ({
                    id: resident.userId as string,
                    name: resident.name ?? resident.email ?? resident.userId,
                }));
        }
        const users = usersQuery.data ?? [];
        return users
            .filter((u) => (u.baseRole ?? u.role) === "tenant")
            .map((u) => ({ id: u.id, name: u.name ?? u.email ?? u.id }));
    }, [isManager, newBuildingId, residentsQuery.data, usersQuery.data]);

    const participantLookup = useMemo(() => {
        const map = new Map<string, string>();
        participantOptions.forEach((entry) => {
            map.set(entry.id, entry.name);
        });
        return map;
    }, [participantOptions]);

    const selectedConversationRef = useRef(selectedConversationId);
    useEffect(() => {
        selectedConversationRef.current = selectedConversationId;
    }, [selectedConversationId]);

    useEffect(() => {
        if (!token || !canRead) return;
        const socket = connectNotificationsSocket(token, selectedOrgId ?? user?.orgId ?? null);
        if (!socket) return;

        const handleConversationNew = (payload: any) => {
            const conversationId = payload?.conversationId;
            if (!conversationId) return;
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
        };

        const handleMessageNew = (payload: any) => {
            const conversationId = payload?.conversationId;
            const message = payload?.message as ConversationMessage | undefined;
            if (!conversationId) return;
            queryClient.setQueryData<ConversationListResponse | undefined>(["conversations", PAGE_LIMIT], (prev) => {
                if (!prev) return prev;
                const nextItems = prev.items.map((item) => {
                    if (item.id !== conversationId) return item;
                    const nextUnread =
                        conversationId === selectedConversationRef.current ? 0 : Math.max((item.unreadCount ?? 0) + 1, 1);
                    return {
                        ...item,
                        lastMessage: message ?? item.lastMessage,
                        updatedAt: message?.createdAt ?? item.updatedAt,
                        unreadCount: nextUnread,
                    };
                });
                return { ...prev, items: nextItems };
            });
            if (conversationId === selectedConversationRef.current) {
                queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
            }
        };

        const handleConversationRead = (payload: any) => {
            const conversationId = payload?.conversationId;
            if (!conversationId) return;
            queryClient.setQueryData<ConversationListResponse | undefined>(["conversations", PAGE_LIMIT], (prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    items: prev.items.map((item) =>
                        item.id === conversationId ? { ...item, unreadCount: 0 } : item
                    ),
                };
            });
        };

        socket.on("conversation:new", handleConversationNew);
        socket.on("message:new", handleMessageNew);
        socket.on("conversation:read", handleConversationRead);

        return () => {
            socket.off("conversation:new", handleConversationNew);
            socket.off("message:new", handleMessageNew);
            socket.off("conversation:read", handleConversationRead);
        };
    }, [token, canRead, queryClient, selectedOrgId, user?.orgId]);

    const handleSelectConversation = (conv: Conversation) => {
        setSelectedConversationId(conv.id);
        if (conv.unreadCount > 0 && !markReadMutation.isPending) {
            markReadMutation.mutate(conv.id, {
                onSuccess: () => {
                    queryClient.setQueryData<ConversationListResponse | undefined>(["conversations", PAGE_LIMIT], (prev) => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            items: prev.items.map((item) =>
                                item.id === conv.id ? { ...item, unreadCount: 0 } : item
                            ),
                        };
                    });
                },
            });
        }
    };

    const handleAddParticipant = () => {
        if (!selectedParticipantId) return;
        setParticipantIds((prev) =>
            prev.includes(selectedParticipantId) ? prev : [...prev, selectedParticipantId]
        );
        setSelectedParticipantId("");
    };

    const handleRemoveParticipant = (participantId: string) => {
        setParticipantIds((prev) => prev.filter((id) => id !== participantId));
    };

    const handleCreateConversation = async () => {
        if (!canWrite || isResident) return;
        const trimmedMessage = newMessage.trim();
        if (trimmedMessage.length < MIN_MESSAGE || trimmedMessage.length > MAX_MESSAGE) {
            toast.error(`Message must be between ${MIN_MESSAGE} and ${MAX_MESSAGE} characters.`);
            return;
        }
        const trimmedSubject = newSubject.trim();
        if (trimmedSubject && (trimmedSubject.length < MIN_TITLE || trimmedSubject.length > MAX_TITLE)) {
            toast.error(`Subject must be between ${MIN_TITLE} and ${MAX_TITLE} characters.`);
            return;
        }
        if (participantIds.length === 0) {
            toast.error("Select at least one participant.");
            return;
        }
        if (isManager && !newBuildingId) {
            toast.error("Managers must select a building.");
            return;
        }

        try {
            const conversation = await createConversationMutation.mutateAsync({
                participantUserIds: participantIds,
                subject: trimmedSubject || undefined,
                message: trimmedMessage,
                buildingId: newBuildingId || undefined,
            });
            toast.success("Conversation started.");
            setNewSubject("");
            setNewMessage("");
            setParticipantIds([]);
            setSelectedConversationId(conversation.id);
            listQuery.refetch();
        } catch (error: any) {
            toast.error(error?.message || "Failed to start conversation.");
        }
    };

    const handleSendMessage = async () => {
        if (!selectedConversationId) return;
        const trimmed = replyContent.trim();
        if (trimmed.length < MIN_MESSAGE || trimmed.length > MAX_MESSAGE) {
            toast.error(`Message must be between ${MIN_MESSAGE} and ${MAX_MESSAGE} characters.`);
            return;
        }
        try {
            await sendMessageMutation.mutateAsync({ conversationId: selectedConversationId, content: trimmed });
            setReplyContent("");
            queryClient.invalidateQueries({ queryKey: ["conversation", selectedConversationId] });
        } catch (error: any) {
            toast.error(error?.message || "Failed to send message.");
        }
    };

    const handleLoadMore = async () => {
        if (!nextCursor || isLoadingMore) return;
        setIsLoadingMore(true);
        try {
            const response = await getConversations({ limit: PAGE_LIMIT, cursor: nextCursor });
            queryClient.setQueryData<ConversationListResponse | undefined>(["conversations", PAGE_LIMIT], (prev) => {
                const prevItems = prev?.items ?? [];
                const merged = [...prevItems];
                const seen = new Set(prevItems.map((item) => item.id));
                response.items.forEach((item: Conversation) => {
                    if (!seen.has(item.id)) {
                        merged.push(item);
                        seen.add(item.id);
                    }
                });
                return {
                    items: merged,
                    nextCursor: response.nextCursor ?? null,
                };
            });
        } catch (error: any) {
            toast.error(error?.message || "Failed to load more conversations.");
        } finally {
            setIsLoadingMore(false);
        }
    };

    const renderConversationMeta = (conv: Conversation) => {
        const subject = conv.subject || "Conversation";
        const lastMessage = conv.lastMessage?.content || "No messages yet";
        const updated = conv.updatedAt ? new Date(conv.updatedAt).toLocaleString() : "";
        const unreadBadge = conv.unreadCount > 0
            ? (
                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                    {conv.unreadCount}
                </span>
            )
            : null;
        return (
            <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-zinc-900">{subject}</p>
                    {unreadBadge}
                </div>
                <p className="text-xs text-zinc-500 line-clamp-1">{lastMessage}</p>
                <p className="text-[10px] text-zinc-400">{updated}</p>
            </div>
        );
    };

    const messages = conversation?.messages ?? [];
    const selectedParticipants = participantIds.map((id) => ({
        id,
        name: participantLookup.get(id) ?? id,
    }));

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Messages</h1>
                        <p className="mt-1 text-sm text-zinc-500">Start conversations and reply to residents.</p>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
                <div className="space-y-6">
                    <Card className="border-zinc-200">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base text-zinc-900">
                                <Users className="h-4 w-4 text-zinc-500" />
                                Start conversation
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {!canWrite || isResident ? (
                                <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
                                    {isResident
                                        ? "Residents can only reply to existing conversations."
                                        : "You do not have permission to start conversations."}
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                            Building {isManager ? "*" : "(optional)"}
                                        </label>
                                        <Select
                                            value={newBuildingId}
                                            onValueChange={(value) => setNewBuildingId(value === "__all__" ? "" : value)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={isManager ? "Select building" : "All buildings"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {!isManager && (
                                                    <SelectItem value="__all__">All buildings</SelectItem>
                                                )}
                                                {buildingOptions.map((building) => (
                                                    <SelectItem key={building.id} value={building.id}>
                                                        {building.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Participants *</label>
                                        <div className="flex gap-2">
                                            <Select value={selectedParticipantId} onValueChange={setSelectedParticipantId}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select resident" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {participantOptions.length === 0 ? (
                                                        <SelectItem value="_none" disabled>
                                                            No residents available
                                                        </SelectItem>
                                                    ) : (
                                                        participantOptions.map((participant) => (
                                                            <SelectItem key={participant.id} value={participant.id}>
                                                                {participant.name}
                                                            </SelectItem>
                                                        ))
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            <Button type="button" variant="outline" onClick={handleAddParticipant}>
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        {selectedParticipants.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {selectedParticipants.map((participant) => (
                                                    <button
                                                        key={participant.id}
                                                        type="button"
                                                        onClick={() => handleRemoveParticipant(participant.id)}
                                                        className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-600 hover:border-zinc-300"
                                                    >
                                                        {participant.name} ×
                                                    </button>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Subject</label>
                                        <Input
                                            value={newSubject}
                                            onChange={(event) => setNewSubject(event.target.value)}
                                            maxLength={MAX_TITLE}
                                            placeholder="Lease renewal discussion"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Message *</label>
                                        <Textarea
                                            value={newMessage}
                                            onChange={(event) => setNewMessage(event.target.value)}
                                            maxLength={MAX_MESSAGE}
                                            rows={4}
                                            placeholder="Write your message..."
                                        />
                                    </div>
                                    <Button
                                        onClick={handleCreateConversation}
                                        disabled={createConversationMutation.isPending}
                                        className="w-full"
                                    >
                                        {createConversationMutation.isPending ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
                                            </>
                                        ) : (
                                            <>
                                                <MessageCircle className="mr-2 h-4 w-4" /> Start conversation
                                            </>
                                        )}
                                    </Button>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-zinc-200">
                        <CardHeader>
                            <CardTitle className="text-base text-zinc-900">Conversations</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {!canRead ? (
                                <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
                                    You do not have permission to view conversations.
                                </div>
                            ) : listQuery.isLoading ? (
                                <div className="flex items-center justify-center py-6 text-sm text-zinc-500">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Loading conversations...
                                </div>
                            ) : conversations.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
                                    No conversations yet.
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        {conversations.map((conv) => (
                                            <button
                                                key={conv.id}
                                                type="button"
                                                onClick={() => handleSelectConversation(conv)}
                                                className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                                                    conv.id === selectedConversationId
                                                        ? "border-blue-200 bg-blue-50/60"
                                                        : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                                                }`}
                                            >
                                                {renderConversationMeta(conv)}
                                            </button>
                                        ))}
                                    </div>
                                    {nextCursor ? (
                                        <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
                                            {isLoadingMore ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                                                </>
                                            ) : (
                                                "Load more"
                                            )}
                                        </Button>
                                    ) : null}
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Card className="border-zinc-200">
                    <CardHeader>
                        <CardTitle className="text-base text-zinc-900">Conversation</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {!selectedConversationId ? (
                            <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
                                Select a conversation to view messages.
                            </div>
                        ) : conversationQuery.isLoading ? (
                            <div className="flex items-center justify-center py-10 text-sm text-zinc-500">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Loading conversation...
                            </div>
                        ) : conversation ? (
                            <>
                                <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
                                    <p className="text-sm font-semibold text-zinc-900">
                                        {conversation.subject || "Conversation"}
                                    </p>
                                    <p className="text-xs text-zinc-500">
                                        {conversation.participants
                                            .map((p) => p.name ?? p.id)
                                            .join(", ") || "Participants"}
                                    </p>
                                </div>
                                <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-3">
                                    {messages.length === 0 ? (
                                        <p className="text-sm text-zinc-500">No messages yet.</p>
                                    ) : (
                                        messages.map((message) => (
                                            <div key={message.id} className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
                                                <div className="flex items-center justify-between text-xs text-zinc-500">
                                                    <span>{message.sender?.name ?? message.sender?.id ?? "Sender"}</span>
                                                    <span>{new Date(message.createdAt).toLocaleString()}</span>
                                                </div>
                                                <p className="mt-2 text-sm text-zinc-700 whitespace-pre-line">{message.content}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Reply</label>
                                    <Textarea
                                        value={replyContent}
                                        onChange={(event) => setReplyContent(event.target.value)}
                                        maxLength={MAX_MESSAGE}
                                        rows={3}
                                        placeholder="Write a reply..."
                                    />
                                    <Button
                                        onClick={handleSendMessage}
                                        disabled={sendMessageMutation.isPending || !canWrite}
                                    >
                                        {sendMessageMutation.isPending ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="mr-2 h-4 w-4" /> Send
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
                                Conversation not available.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
