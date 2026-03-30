"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageCircle, Send, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { getConversations } from "@/lib/api/communications";
import { connectNotificationsSocket } from "@/lib/notificationsSocket";
import { getUserPermissionSet, hasPermission, hasPermissionPrefix } from "@/lib/permissions";
import { isBuildingScopedPortalRole, isOrganizationAdminRole } from "@/lib/roles";
import {
    useAccessibleBuildings,
    useBuildingResidents,
    useConversations,
    useConversation,
    useCreateConversation,
    useSendConversationMessage,
    useOrgResidents,
    useMarkConversationRead,
} from "@/lib/queries";
import type { Conversation, ConversationListResponse, ConversationMessage } from "@/lib/types";

const PAGE_LIMIT = 20;
const MIN_MESSAGE = 1;
const MAX_MESSAGE = 5000;
const MIN_TITLE = 3;
const MAX_TITLE = 200;

type ParticipantOption = {
    id: string;
    name: string;
    email?: string;
    unitLabel?: string;
    buildingName?: string;
};

const normalizeSearchText = (value: string) => value.trim().toLowerCase();

const tokenizeSearchText = (value: string) =>
    normalizeSearchText(value)
        .split(/[\s\-_/.,#:]+/)
        .filter(Boolean);

const rankSearchMatch = (query: string, values: Array<string | undefined | null>) => {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return 1;

    const queryTokens = tokenizeSearchText(normalizedQuery);
    let best = 0;

    values.forEach((entry) => {
        const text = normalizeSearchText(String(entry ?? ""));
        if (!text) return;

        const tokens = tokenizeSearchText(text);
        if (text === normalizedQuery) {
            best = Math.max(best, 120);
            return;
        }
        if (text.startsWith(normalizedQuery)) {
            best = Math.max(best, 100);
        }
        if (tokens.some((token) => token === normalizedQuery)) {
            best = Math.max(best, 95);
        } else if (tokens.some((token) => token.startsWith(normalizedQuery))) {
            best = Math.max(best, 85);
        } else if (text.includes(normalizedQuery)) {
            best = Math.max(best, 70);
        }

        if (queryTokens.length > 1) {
            const matchedTokenCount = queryTokens.filter((token) =>
                tokens.some((candidate) => candidate.startsWith(token)) || text.includes(token)
            ).length;
            if (matchedTokenCount === queryTokens.length) {
                best = Math.max(best, 80 + matchedTokenCount * 4);
            } else if (matchedTokenCount > 0) {
                best = Math.max(best, 50 + matchedTokenCount * 3);
            }
        }
    });

    return best;
};

const formatParticipantLabel = (participant: { name: string; unitLabel?: string }) =>
    participant.unitLabel ? `${participant.name} (Unit ${participant.unitLabel})` : participant.name;

export function MessagingPage() {
    const { user, token, baseRole, selectedOrgId } = useAuth();
    const isResident = baseRole === "tenant";
    const isBuildingScopedOperator = isBuildingScopedPortalRole(baseRole);
    const canSearchOrgResidents = isOrganizationAdminRole(baseRole);
    const permissionSet = useMemo(
        () => getUserPermissionSet(user),
        [user]
    );
    const canRead = hasPermissionPrefix(permissionSet, "messaging");
    const canWrite = hasPermission(permissionSet, "messaging.write") || hasPermissionPrefix(permissionSet, "messaging.write");

    const accessibleBuildingsQuery = useAccessibleBuildings(user?.id, baseRole);
    const buildings = accessibleBuildingsQuery.data;
    const buildingOptions = useMemo(
        () => (buildings || []).slice().sort((a, b) => a.name.localeCompare(b.name)),
        [buildings]
    );

    const [selectedConversationId, setSelectedConversationId] = useState<string>("");
    const [selectedConversationIds, setSelectedConversationIds] = useState<string[]>([]);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isBulkMarking, setIsBulkMarking] = useState(false);
    const [newSubject, setNewSubject] = useState("");
    const [newMessage, setNewMessage] = useState("");
    const [newBuildingId, setNewBuildingId] = useState<string>("");
    const [participantIds, setParticipantIds] = useState<string[]>([]);
    const [selectedParticipantId, setSelectedParticipantId] = useState<string>("");
    const [participantSearch, setParticipantSearch] = useState<string>("");
    const [conversationSearch, setConversationSearch] = useState<string>("");
    const [replyContent, setReplyContent] = useState("");
    const orgResidentQueryTerm = useMemo(() => {
        if (!canSearchOrgResidents || newBuildingId) return undefined;
        const term = participantSearch.trim();
        return term.length > 0 ? term : undefined;
    }, [canSearchOrgResidents, newBuildingId, participantSearch]);

    const listQuery = useConversations({ limit: PAGE_LIMIT, enabled: canRead });
    const conversations = useMemo(
        () => listQuery.data?.items ?? [],
        [listQuery.data?.items]
    );
    const nextCursor = listQuery.data?.nextCursor ?? null;

    const conversationQuery = useConversation(selectedConversationId, { enabled: Boolean(selectedConversationId && canRead) });
    const conversation = conversationQuery.data;

    const createConversationMutation = useCreateConversation();
    const sendMessageMutation = useSendConversationMessage();
    const markReadMutation = useMarkConversationRead();
    const queryClient = useQueryClient();

    const residentsQuery = useBuildingResidents(newBuildingId, { enabled: Boolean(newBuildingId) });
    const orgActiveResidentsQuery = useOrgResidents(
        { status: "WITH_OCCUPANCY", limit: 100, q: orgResidentQueryTerm },
        { enabled: canSearchOrgResidents && canRead }
    );

    const participantOptions = useMemo<ParticipantOption[]>(() => {
        if (isBuildingScopedOperator || newBuildingId) {
            const residents = residentsQuery.data ?? [];
            return residents
                .filter((resident) => {
                    const status = resident.status ? resident.status.toUpperCase() : "";
                    return resident.isActive === true || status === "ACTIVE";
                })
                .filter((resident) => resident.userId)
                .map((resident) => ({
                    id: resident.userId as string,
                    name: resident.name ?? resident.email ?? resident.userId,
                    email: resident.email ?? undefined,
                    unitLabel: resident.unit?.label || undefined,
                }));
        }
        const activeResidents = orgActiveResidentsQuery.data?.items ?? [];
        return activeResidents
            .filter((resident) => resident.hasActiveOccupancy || resident.residentStatus === "ACTIVE")
            .map((resident) => ({
                id: resident.user.id,
                name: resident.user.name ?? resident.user.email ?? resident.user.id,
                email: resident.user.email ?? undefined,
                unitLabel:
                    resident.activeOccupancy?.unitLabel ||
                    resident.lease?.unitLabel ||
                    resident.lastOccupancy?.unitLabel ||
                    undefined,
                buildingName:
                    resident.activeOccupancy?.buildingName ??
                    resident.lease?.buildingName ??
                    resident.lastOccupancy?.buildingName ??
                    undefined,
            }));
    }, [isBuildingScopedOperator, newBuildingId, residentsQuery.data, orgActiveResidentsQuery.data?.items]);

    useEffect(() => {
        if (!isBuildingScopedOperator) return;
        if (newBuildingId && buildingOptions.some((building) => building.id === newBuildingId)) return;
        setNewBuildingId(buildingOptions[0]?.id ?? "");
    }, [buildingOptions, isBuildingScopedOperator, newBuildingId]);

    const allActiveParticipantIds = useMemo(
        () => participantOptions.map((entry) => entry.id),
        [participantOptions]
    );
    const allActiveSelected = newBuildingId
        ? allActiveParticipantIds.length > 0 && allActiveParticipantIds.every((id) => participantIds.includes(id))
        : false;

    const handleToggleSelectAllParticipants = (checked: boolean) => {
        if (!newBuildingId) return;
        setParticipantIds(checked ? allActiveParticipantIds : []);
    };

    const participantOptionsFiltered = useMemo(() => {
        const term = participantSearch.trim();
        return participantOptions
            .map((entry) => ({
                entry,
                score: rankSearchMatch(term, [
                    entry.name,
                    entry.email,
                    entry.unitLabel,
                    entry.unitLabel ? `unit ${entry.unitLabel}` : "",
                    entry.buildingName,
                ]),
            }))
            .filter((result) => result.score > 0)
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return a.entry.name.localeCompare(b.entry.name);
            })
            .map((result) => result.entry);
    }, [participantOptions, participantSearch]);

    const participantLookup = useMemo(() => {
        const map = new Map<string, ParticipantOption>();
        participantOptions.forEach((entry) => {
            map.set(entry.id, entry);
        });
        return map;
    }, [participantOptions]);

    const residentMetaByUserId = useMemo(() => {
        const map = new Map<string, { name?: string; email?: string; unitLabel?: string; buildingName?: string }>();
        participantOptions.forEach((entry) => {
            map.set(entry.id, {
                name: entry.name,
                email: entry.email,
                unitLabel: entry.unitLabel,
                buildingName: entry.buildingName,
            });
        });
        return map;
    }, [participantOptions]);

    const filteredConversations = useMemo(() => {
        const term = conversationSearch.trim();
        return conversations
            .map((conversationEntry) => {
                const participantSearchValues = conversationEntry.participants.flatMap((participant) => {
                    const meta = residentMetaByUserId.get(participant.id);
                    return [
                        participant.name,
                        participant.email,
                        participant.unitLabel,
                        participant.unitLabel ? `unit ${participant.unitLabel}` : "",
                        participant.buildingName,
                        meta?.name,
                        meta?.email,
                        meta?.unitLabel,
                        meta?.unitLabel ? `unit ${meta.unitLabel}` : "",
                        meta?.buildingName,
                    ];
                });
                const score = rankSearchMatch(term, [
                    conversationEntry.subject,
                    conversationEntry.lastMessage?.content,
                    ...participantSearchValues,
                ]);
                return { conversationEntry, score };
            })
            .filter((entry) => entry.score > 0)
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return b.conversationEntry.updatedAt.localeCompare(a.conversationEntry.updatedAt);
            })
            .map((entry) => entry.conversationEntry);
    }, [conversationSearch, conversations, residentMetaByUserId]);

    const participantSuggestions = useMemo(
        () => participantOptionsFiltered.filter((entry) => !participantIds.includes(entry.id)).slice(0, 8),
        [participantOptionsFiltered, participantIds]
    );

    useEffect(() => {
        const allowedIds = new Set(participantOptions.map((entry) => entry.id));
        setParticipantIds((prev) => prev.filter((id) => allowedIds.has(id)));
        setSelectedParticipantId((prev) => (prev && !allowedIds.has(prev) ? "" : prev));
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

    const toggleConversationSelection = (convId: string) => {
        setSelectedConversationIds((prev) =>
            prev.includes(convId) ? prev.filter((id) => id !== convId) : [...prev, convId]
        );
    };

    const handleToggleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedConversationIds(filteredConversations.map((conv) => conv.id));
        } else {
            setSelectedConversationIds([]);
        }
    };

    const allSelected =
        filteredConversations.length > 0 &&
        filteredConversations.every((conversationEntry) => selectedConversationIds.includes(conversationEntry.id));

    const handleAddParticipant = (participantId: string) => {
        if (!participantId) return;
        setParticipantIds((prev) => (prev.includes(participantId) ? prev : [...prev, participantId]));
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
        if (isBuildingScopedOperator && !newBuildingId) {
            toast.error("Select a building before starting a conversation.");
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

    const handleBulkMarkRead = async () => {
        if (selectedConversationIds.length === 0) return;
        setIsBulkMarking(true);
        try {
            await Promise.allSettled(selectedConversationIds.map((id) => markReadMutation.mutateAsync(id)));
            toast.success("Marked selected conversations as read.");
            setSelectedConversationIds([]);
            listQuery.refetch();
        } catch (error: any) {
            toast.error(error?.message || "Failed to mark conversations as read.");
        } finally {
            setIsBulkMarking(false);
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
    const currentUserId = user?.id ?? "";
    const conversationParticipants = conversation?.participants ?? [];
    const otherParticipants = conversationParticipants
        .filter((participant) => participant.id !== currentUserId)
        .map((participant) => participant.name ?? participant.email ?? participant.id);
    const participantLine = otherParticipants.length > 0
        ? otherParticipants.join(", ")
        : conversationParticipants.map((participant) => participant.name ?? participant.email ?? participant.id).join(", ");
    const selectedParticipants = participantIds.map((id) => ({
        id,
        name: participantLookup.get(id)?.name ?? id,
        unitLabel: participantLookup.get(id)?.unitLabel ?? undefined,
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
                                            Building {isBuildingScopedOperator ? "*" : "(optional)"}
                                        </label>
                                        <Select
                                            value={newBuildingId}
                                            onValueChange={(value) => setNewBuildingId(value === "__all__" ? "" : value)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={isBuildingScopedOperator ? "Select building" : "All buildings"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {!isBuildingScopedOperator && (
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
                                        {newBuildingId ? (
                                            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                                                <Checkbox
                                                    id="select-all-participants"
                                                    checked={allActiveSelected}
                                                    onCheckedChange={(checked) => handleToggleSelectAllParticipants(Boolean(checked))}
                                                />
                                                <label htmlFor="select-all-participants">Select all active residents</label>
                                            </div>
                                        ) : null}
                                        <Input
                                            value={participantSearch}
                                            onChange={(event) => setParticipantSearch(event.target.value)}
                                            placeholder="Search by resident name or unit (e.g. 101)"
                                        />
                                        {participantSearch.trim() ? (
                                            <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1">
                                                {participantSuggestions.length === 0 ? (
                                                    <div className="px-2 py-2 text-xs text-zinc-500">No matching residents found.</div>
                                                ) : (
                                                    participantSuggestions.map((participant) => (
                                                        <button
                                                            key={`suggestion-${participant.id}`}
                                                            type="button"
                                                            onClick={() => handleAddParticipant(participant.id)}
                                                            className="w-full rounded-md px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-50"
                                                        >
                                                            <div className="font-medium text-zinc-800">{participant.name}</div>
                                                            <div className="text-zinc-500">
                                                                {participant.unitLabel
                                                                    ? `Unit ${participant.unitLabel}`
                                                                    : (participant.email ?? "Unit unavailable")}
                                                                {participant.buildingName ? ` - ${participant.buildingName}` : ""}
                                                            </div>
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        ) : null}
                                        <div className="flex gap-2">
                                            <Select
                                                value={selectedParticipantId}
                                                onValueChange={(value) => {
                                                    if (value === "_none") return;
                                                    handleAddParticipant(value);
                                                }}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select resident" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {participantOptionsFiltered.length === 0 ? (
                                                        <SelectItem value="_none" disabled>
                                                            No residents available
                                                        </SelectItem>
                                                    ) : (
                                                        participantOptionsFiltered.map((participant) => (
                                                            <SelectItem key={participant.id} value={participant.id}>
                                                                {formatParticipantLabel(participant)}
                                                            </SelectItem>
                                                        ))
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <p className="text-xs text-zinc-400">Select a resident to add them to the conversation.</p>
                                        {selectedParticipants.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {selectedParticipants.map((participant) => (
                                                    <button
                                                        key={participant.id}
                                                        type="button"
                                                        onClick={() => handleRemoveParticipant(participant.id)}
                                                        className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-600 hover:border-zinc-300"
                                                    >
                                                        {formatParticipantLabel(participant)} x
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
                                    <Input
                                        value={conversationSearch}
                                        onChange={(event) => setConversationSearch(event.target.value)}
                                        placeholder="Search by subject, tenant name, or unit (e.g. 101)"
                                    />
                                    <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="select-all-conversations"
                                                checked={allSelected}
                                                onCheckedChange={(checked) => handleToggleSelectAll(Boolean(checked))}
                                            />
                                            <label htmlFor="select-all-conversations">Select all</label>
                                        </div>
                                        {selectedConversationIds.length > 0 ? (
                                            <div className="flex items-center gap-3">
                                                <span>{selectedConversationIds.length} selected</span>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={handleBulkMarkRead}
                                                    disabled={isBulkMarking}
                                                >
                                                    {isBulkMarking ? "Marking..." : "Mark read"}
                                                </Button>
                                            </div>
                                        ) : null}
                                    </div>
                                    {filteredConversations.length === 0 ? (
                                        <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-3 py-4 text-xs text-zinc-500">
                                            No conversations match this search.
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {filteredConversations.map((conv) => {
                                            const isSelected = selectedConversationIds.includes(conv.id);
                                            return (
                                                <div
                                                    key={conv.id}
                                                    className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-left transition ${
                                                        conv.id === selectedConversationId
                                                            ? "border-blue-200 bg-blue-50/60"
                                                            : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                                                    }`}
                                                >
                                                    <Checkbox
                                                        id={`select-conversation-${conv.id}`}
                                                        checked={isSelected}
                                                        onCheckedChange={() => toggleConversationSelection(conv.id)}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectConversation(conv)}
                                                        className="flex-1 text-left"
                                                    >
                                                        {renderConversationMeta(conv)}
                                                    </button>
                                                </div>
                                            );
                                            })}
                                        </div>
                                    )}
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
                                    <div className="mt-1 space-y-1 text-xs text-zinc-500">
                                        <p>To: {participantLine || "Participants"}</p>
                                        <p>From: You</p>
                                    </div>
                                </div>
                                <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-3">
                                    {messages.length === 0 ? (
                                        <p className="text-sm text-zinc-500">No messages yet.</p>
                                    ) : (
                                        messages.map((message) => {
                                            const senderId = message.sender?.id ?? "";
                                            const isMine = Boolean(senderId && senderId === currentUserId);
                                            const senderLabel = isMine
                                                ? "You"
                                                : message.sender?.name ?? message.sender?.email ?? message.sender?.id ?? "Sender";
                                            return (
                                                <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                                                    <div
                                                        className={`max-w-[80%] rounded-lg border p-3 ${
                                                            isMine
                                                                ? "border-blue-200 bg-blue-50/70"
                                                                : "border-zinc-200 bg-zinc-50/60"
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-4 text-xs text-zinc-500">
                                                            <span>{senderLabel}</span>
                                                            <span>{new Date(message.createdAt).toLocaleString()}</span>
                                                        </div>
                                                        <p className="mt-2 text-sm text-zinc-700 whitespace-pre-line">{message.content}</p>
                                                    </div>
                                                </div>
                                            );
                                        })
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

