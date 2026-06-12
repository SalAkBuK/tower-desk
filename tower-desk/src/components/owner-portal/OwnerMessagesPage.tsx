"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Search, Send } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { getOwnerConversationById, getOwnerConversations } from "@/lib/api/ownerPortal";
import type { Conversation, ConversationType } from "@/lib/types";
import {
    useCreateOwnerManagementConversation,
    useCreateOwnerTenantConversation,
    useMarkOwnerConversationRead,
    useOwnerConversation,
    useOwnerConversationUnreadCount,
    useOwnerConversations,
    useOwnerPortfolioUnits,
    useSendOwnerConversationMessage,
} from "@/lib/queries";
import { getPathWithoutSearchParams } from "@/lib/searchParams";

type OwnerConversationFilter = "all" | "management" | "tenant";

const PAGE_LIMIT = 50;
const MESSAGE_PAGE_LIMIT = 50;

const ownerConversationFilterLabels: Record<OwnerConversationFilter, string> = {
    all: "All conversations",
    management: "Management",
    tenant: "Tenants",
};

const ownerConversationFilterType: Record<Exclude<OwnerConversationFilter, "all">, ConversationType> = {
    management: "MANAGEMENT_OWNER",
    tenant: "OWNER_TENANT",
};

const formatDate = (value?: string | null) => {
    if (!value) return "N/A";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

export function OwnerMessagesPage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const { baseRole } = useAuth();
    const enabled = baseRole === "owner";
    const [search, setSearch] = useState("");
    const [conversationFilter, setConversationFilter] = useState<OwnerConversationFilter>("all");
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [composerMode, setComposerMode] = useState<"management" | "tenant">("management");
    const [unitId, setUnitId] = useState("");
    const [tenantUserId, setTenantUserId] = useState("");
    const [subject, setSubject] = useState("");
    const [composerMessage, setComposerMessage] = useState("");
    const [replyDraft, setReplyDraft] = useState("");
    const [isLoadingMoreConversations, setIsLoadingMoreConversations] = useState(false);
    const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
    const messagesViewportRef = useRef<HTMLDivElement | null>(null);
    const deepLinkedConversationId = searchParams.get("conversationId")?.trim() ?? "";

    const activeConversationType =
        conversationFilter === "all"
            ? undefined
            : ownerConversationFilterType[conversationFilter];
    const conversationsQuery = useOwnerConversations({ limit: PAGE_LIMIT, type: activeConversationType, enabled });
    const unreadCountQuery = useOwnerConversationUnreadCount({ enabled });
    const unitsQuery = useOwnerPortfolioUnits({ enabled });
    const selectedConversationQuery = useOwnerConversation(selectedConversationId, {
        enabled: enabled && Boolean(selectedConversationId),
    });
    const createManagementConversation = useCreateOwnerManagementConversation();
    const createTenantConversation = useCreateOwnerTenantConversation();
    const sendMessage = useSendOwnerConversationMessage();
    const markRead = useMarkOwnerConversationRead();

    const conversations = useMemo(
        () => conversationsQuery.data?.items ?? [],
        [conversationsQuery.data?.items]
    );
    const nextConversationCursor = conversationsQuery.data?.nextCursor ?? null;
    const filteredConversations = useMemo(() => {
        const term = search.trim().toLowerCase();
        return [...conversations]
            .filter((entry) => {
                if (!term) return true;
                return [
                    entry.subject,
                    entry.orgName,
                    entry.buildingName,
                    ...entry.participants.map((participant) => participant.name ?? participant.email ?? participant.unitLabel ?? ""),
                ]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(term));
            })
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }, [conversations, search]);

    useEffect(() => {
        if (deepLinkedConversationId) {
            const requestedConversation = conversations.find((entry) => entry.id === deepLinkedConversationId);
            if (requestedConversation) {
                if (selectedConversationId !== requestedConversation.id) {
                    setSelectedConversationId(requestedConversation.id);
                }
                router.replace(getPathWithoutSearchParams(pathname, searchParams, ["conversationId"]), { scroll: false });
                return;
            }
        }
        if (filteredConversations.length === 0) {
            setSelectedConversationId(null);
            return;
        }
        if (!selectedConversationId || !filteredConversations.some((entry) => entry.id === selectedConversationId)) {
            setSelectedConversationId(filteredConversations[0].id);
        }
    }, [conversations, deepLinkedConversationId, filteredConversations, pathname, router, searchParams, selectedConversationId]);

    const conversation = selectedConversationQuery.data ?? filteredConversations.find((entry) => entry.id === selectedConversationId) ?? null;
    const markedReadRef = useRef(new Set<string>());

    useEffect(() => {
        if (!conversation?.id || (conversation.unreadCount ?? 0) <= 0) return;
        if (markedReadRef.current.has(conversation.id)) return;
        markedReadRef.current.add(conversation.id);
        markRead.mutate(conversation.id);
    }, [conversation?.id, conversation?.unreadCount, markRead]);

    const handleCreateConversation = async () => {
        if (!unitId || !subject.trim() || !composerMessage.trim()) {
            toast.error("Unit, subject, and message are required.");
            return;
        }

        try {
            const created = composerMode === "management"
                ? await createManagementConversation.mutateAsync({
                    unitId,
                    subject: subject.trim(),
                    message: composerMessage.trim(),
                })
                : await createTenantConversation.mutateAsync({
                    unitId,
                    tenantUserId: tenantUserId.trim(),
                    subject: subject.trim(),
                    message: composerMessage.trim(),
                });
            setSelectedConversationId(created.id);
            setSubject("");
            setComposerMessage("");
            if (composerMode === "tenant") {
                setTenantUserId("");
            }
            toast.success("Conversation created");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to create conversation");
        }
    };

    const handleReply = async () => {
        if (!conversation?.id || !replyDraft.trim()) return;
        try {
            await sendMessage.mutateAsync({
                conversationId: conversation.id,
                content: replyDraft.trim(),
            });
            setReplyDraft("");
            toast.success("Message sent");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to send message");
        }
    };

    const handleLoadMoreConversations = async () => {
        if (!enabled || !nextConversationCursor || isLoadingMoreConversations) return;
        setIsLoadingMoreConversations(true);
        try {
            const response = await getOwnerConversations({
                limit: PAGE_LIMIT,
                cursor: nextConversationCursor,
                type: activeConversationType,
            });
            queryClient.setQueryData(
                ["owner-conversations", PAGE_LIMIT, "", activeConversationType ?? "all", "all"],
                (prev: { items?: Conversation[]; nextCursor?: string | null } | undefined) => {
                    const prevItems = prev?.items ?? [];
                    const seen = new Set(prevItems.map((item) => item.id));
                    const merged = [...prevItems];
                    response.items.forEach((item) => {
                        if (!seen.has(item.id)) {
                            merged.push(item);
                            seen.add(item.id);
                        }
                    });
                    return {
                        ...prev,
                        items: merged,
                        nextCursor: response.nextCursor ?? null,
                        totalCount: response.totalCount,
                        limit: response.limit,
                    };
                }
            );
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to load more conversations");
        } finally {
            setIsLoadingMoreConversations(false);
        }
    };

    const handleLoadOlderMessages = async () => {
        if (!conversation?.id || !conversation.nextMessageCursor || isLoadingOlderMessages) return;
        const viewport = messagesViewportRef.current;
        const previousScrollHeight = viewport?.scrollHeight ?? 0;
        const previousScrollTop = viewport?.scrollTop ?? 0;
        setIsLoadingOlderMessages(true);
        try {
            const olderPage = await getOwnerConversationById(conversation.id, {
                limit: MESSAGE_PAGE_LIMIT,
                cursor: conversation.nextMessageCursor,
            });
            queryClient.setQueryData<Conversation | undefined>(
                ["owner-conversation", conversation.id, MESSAGE_PAGE_LIMIT],
                (prev) => {
                    const current = prev ?? conversation;
                    const existingMessages = current.messages ?? [];
                    const seen = new Set(existingMessages.map((message) => message.id));
                    const olderMessages = (olderPage.messages ?? []).filter((message) => !seen.has(message.id));
                    return {
                        ...current,
                        ...olderPage,
                        messages: [...olderMessages, ...existingMessages],
                        nextMessageCursor: olderPage.nextMessageCursor ?? null,
                    };
                }
            );
            requestAnimationFrame(() => {
                if (!viewport) return;
                viewport.scrollTop = viewport.scrollHeight - previousScrollHeight + previousScrollTop;
            });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to load older messages");
        } finally {
            setIsLoadingOlderMessages(false);
        }
    };

    if (baseRole !== "owner") {
        return <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500">This portal surface is limited to owner users.</div>;
    }

    return (
        <div className="space-y-6">
            <section className="rounded-[28px] border border-zinc-200 bg-white p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">Owner messages</h1>
                        <p className="mt-2 text-sm text-zinc-500">
                            Conversation lists aggregate across orgs. Opening a thread does not mark it read implicitly, so this screen calls the explicit read endpoint after the thread loads.
                        </p>
                    </div>
                    <Badge className="bg-zinc-100 text-zinc-700">{unreadCountQuery.data ?? 0} unread</Badge>
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <div className="space-y-6">
                    <div className="rounded-[28px] border border-zinc-200 bg-white p-5">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" className="pl-9" />
                        </div>
                        <div className="mt-3">
                            <Select
                                value={conversationFilter}
                                onValueChange={(value: OwnerConversationFilter) => setConversationFilter(value)}
                            >
                                <SelectTrigger><SelectValue placeholder={ownerConversationFilterLabels[conversationFilter]} /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All conversations</SelectItem>
                                    <SelectItem value="management">Management</SelectItem>
                                    <SelectItem value="tenant">Tenants</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="mt-4 space-y-3">
                            {(conversationsQuery.isLoading && conversations.length === 0) ? (
                                <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-12 text-center text-sm text-zinc-500">Loading conversations...</div>
                            ) : filteredConversations.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-12 text-center text-sm text-zinc-500">No conversations in scope yet.</div>
                            ) : filteredConversations.map((entry) => (
                                <button
                                    key={entry.id}
                                    type="button"
                                    onClick={() => setSelectedConversationId(entry.id)}
                                    className={`w-full rounded-2xl border p-4 text-left ${entry.id === selectedConversationId ? "border-zinc-900 bg-zinc-950 text-white" : "border-zinc-200 bg-white"}`}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="font-semibold">{entry.subject ?? "Conversation"}</div>
                                        {entry.unreadCount > 0 ? <Badge className={entry.id === selectedConversationId ? "bg-white/10 text-white" : "bg-blue-50 text-blue-700"}>{entry.unreadCount}</Badge> : null}
                                    </div>
                                    <p className={`mt-2 text-sm ${entry.id === selectedConversationId ? "text-zinc-200" : "text-zinc-500"}`}>{entry.orgName ?? "Unknown org"} · {entry.buildingName ?? entry.buildingId ?? "No building"}</p>
                                    <p className={`mt-1 text-xs ${entry.id === selectedConversationId ? "text-zinc-300" : "text-zinc-400"}`}>{entry.lastMessage?.content ?? "No messages yet"}</p>
                                </button>
                            ))}
                            {nextConversationCursor ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleLoadMoreConversations}
                                    disabled={isLoadingMoreConversations}
                                    className="w-full"
                                >
                                    {isLoadingMoreConversations ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                                        </>
                                    ) : (
                                        "Load more"
                                    )}
                                </Button>
                            ) : null}
                        </div>
                    </div>

                    <div className="rounded-[28px] border border-zinc-200 bg-white p-5">
                        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950"><Plus className="h-4 w-4" />Start a conversation</div>
                        <div className="mt-4 space-y-3">
                            <Select value={composerMode} onValueChange={(value: "management" | "tenant") => setComposerMode(value)}>
                                <SelectTrigger><SelectValue placeholder="Select conversation type" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="management">Management</SelectItem>
                                    <SelectItem value="tenant">Tenant</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={unitId || "__none__"} onValueChange={(value) => setUnitId(value === "__none__" ? "" : value)}>
                                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">Select unit</SelectItem>
                                    {(unitsQuery.data ?? []).map((unit) => (
                                        <SelectItem key={unit.unitId} value={unit.unitId}>
                                            {unit.unitLabel ?? unit.unitId} · {unit.orgName ?? unit.orgId}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {composerMode === "tenant" ? (
                                <Input value={tenantUserId} onChange={(event) => setTenantUserId(event.target.value)} placeholder="Tenant user ID" />
                            ) : null}
                            <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" />
                            <Textarea value={composerMessage} onChange={(event) => setComposerMessage(event.target.value)} placeholder="Message" className="min-h-[120px]" />
                            <Button onClick={handleCreateConversation} disabled={createManagementConversation.isPending || createTenantConversation.isPending}>
                                Create conversation
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="rounded-[28px] border border-zinc-200 bg-white p-6">
                    {!conversation ? (
                        <div className="flex min-h-[28rem] items-center justify-center text-sm text-zinc-500">Select a conversation.</div>
                    ) : (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-2xl font-semibold text-zinc-950">{conversation.subject ?? "Conversation"}</h2>
                                <p className="mt-2 text-sm text-zinc-500">{conversation.orgName ?? "Unknown org"} · {conversation.buildingName ?? conversation.buildingId ?? "No building"}</p>
                            </div>
                            <div ref={messagesViewportRef} className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                                {conversation.nextMessageCursor ? (
                                    <div className="flex justify-center">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={handleLoadOlderMessages}
                                            disabled={isLoadingOlderMessages}
                                        >
                                            {isLoadingOlderMessages ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                                                </>
                                            ) : (
                                                "Load older messages"
                                            )}
                                        </Button>
                                    </div>
                                ) : null}
                                {(conversation.messages ?? []).length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-500">No messages yet.</div>
                                ) : (conversation.messages ?? []).map((message) => (
                                    <div key={message.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                                        <div className="flex items-center justify-between gap-3 text-xs text-zinc-400">
                                            <span>{message.sender.name ?? message.sender.email ?? "Unknown sender"}</span>
                                            <span>{formatDate(message.createdAt)}</span>
                                        </div>
                                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{message.content}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="space-y-3">
                                <Textarea value={replyDraft} onChange={(event) => setReplyDraft(event.target.value)} placeholder="Reply to this conversation" className="min-h-[120px]" />
                                <Button onClick={handleReply} disabled={sendMessage.isPending || !replyDraft.trim()}>
                                    <Send className="mr-2 h-4 w-4" />
                                    Send message
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
