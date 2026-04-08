"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import {
    Building2,
    CheckCheck,
    ChevronRight,
    Inbox,
    Loader2,
    MessageCircle,
    Search,
    Send,
    Sparkles,
    Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { getOwnerAccessGrants } from "@/lib/api/owners";
import { getConversations } from "@/lib/api/communications";
import { cn } from "@/lib/utils";
import { connectNotificationsSocket } from "@/lib/notificationsSocket";
import {
    useAccessibleBuildings,
    useBuildingResidents,
    useConversations,
    useConversation,
    useCreateConversation,
    useOwnerAccessGrants,
    useOwners,
    useSendConversationMessage,
    useOrgResidents,
    useMarkConversationRead,
} from "@/lib/queries";
import type { Conversation, ConversationListResponse, ConversationMessage, OwnerAccessGrant } from "@/lib/types";
import { resolveComposerBuildingSelection } from "@/components/messaging/messagingSelection";
import {
    getBuildingAccessAssignments,
    getOrgAccessAssignments,
    hasPermission as hasRbacPermission,
    isBuildingScopedOnly,
} from "@/lib/rbac";
import { isOrganizationAdminRole } from "@/lib/roles";

const PAGE_LIMIT = 20;
const MIN_MESSAGE = 1;
const MAX_MESSAGE = 5000;
const MIN_TITLE = 3;
const MAX_TITLE = 200;

type InboxView = "all" | "unread" | "needs_reply";
type ParticipantSource = "residents" | "owners";

type ParticipantOption = {
    id: string;
    name: string;
    email: string;
    unitLabel: string;
    buildingName: string;
    kind: ParticipantSource;
};

type ConversationSocketPayload = {
    conversationId?: string;
};

type MessageSocketPayload = ConversationSocketPayload & {
    message?: ConversationMessage;
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

const formatMessageTimestamp = (value?: string) =>
    value ? new Date(value).toLocaleString() : "";

const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;

const getErrorStatus = (error: unknown) =>
    typeof error === "object" && error !== null && "status" in error
        ? Number((error as { status?: number }).status)
        : undefined;

const formatInboxTimestamp = (value?: string) => {
    if (!value) return "";
    const date = new Date(value);
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    if (sameDay) {
        return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

export function MessagingPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, token, baseRole, selectedOrgId } = useAuth();
    const isResident = baseRole === "tenant";
    const isOrgAdmin = isOrganizationAdminRole(baseRole);
    const hasOrgScopedMessagingAccess = getOrgAccessAssignments(user).length > 0;
    const hasBuildingScopedMessagingAccess = getBuildingAccessAssignments(user).length > 0;
    const requiresComposerBuildingSelection = isBuildingScopedOnly(user, "messaging.write");
    const canSearchOrgResidents = hasOrgScopedMessagingAccess;
    const canSearchOwners =
        hasOrgScopedMessagingAccess
        && (baseRole === "superadmin" || isOrgAdmin || hasRbacPermission(user, "owners.read"))
        && (baseRole === "superadmin" || hasRbacPermission(user, "owner_access_grants.read"));
    const canWrite = hasRbacPermission(user, "messaging.write");
    const canRead =
        canWrite
        || hasRbacPermission(user, "messaging.read");
    const canUseMessaging = canRead || canWrite;

    const accessibleBuildingsQuery = useAccessibleBuildings(user?.id, baseRole, { enabled: canUseMessaging });
    const buildings = accessibleBuildingsQuery.data;
    const buildingOptions = useMemo(
        () => (buildings || []).slice().sort((a, b) => a.name.localeCompare(b.name)),
        [buildings]
    );

    const [selectedConversationId, setSelectedConversationId] = useState<string>("");
    const [selectedConversationIds, setSelectedConversationIds] = useState<string[]>([]);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isBulkMarking, setIsBulkMarking] = useState(false);
    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const [inboxView, setInboxView] = useState<InboxView>("all");
    const [inboxBuildingFilter, setInboxBuildingFilter] = useState<string>("all");
    const [newSubject, setNewSubject] = useState("");
    const [newMessage, setNewMessage] = useState("");
    const [newBuildingId, setNewBuildingId] = useState<string>("");
    const [participantIds, setParticipantIds] = useState<string[]>([]);
    const [selectedParticipantId, setSelectedParticipantId] = useState<string>("");
    const [participantSource, setParticipantSource] = useState<ParticipantSource>("residents");
    const [participantSearch, setParticipantSearch] = useState<string>("");
    const [conversationSearch, setConversationSearch] = useState<string>("");
    const [replyContent, setReplyContent] = useState("");
    const composerBuildingSelectionSeededRef = useRef(false);
    const composerPrefillAppliedRef = useRef(false);
    const prefilledParticipantId = searchParams.get("participantUserId")?.trim() ?? "";
    const prefilledOwnerId = searchParams.get("ownerId")?.trim() ?? "";
    const prefilledParticipantName = searchParams.get("participantName")?.trim() ?? "";
    const prefilledParticipantEmail = searchParams.get("participantEmail")?.trim() ?? "";
    const prefilledBuildingId = searchParams.get("buildingId")?.trim() ?? "";
    const shouldOpenPrefilledComposer = searchParams.get("compose") === "1" && Boolean(prefilledParticipantId);
    const orgResidentQueryTerm = useMemo(() => {
        if (!canSearchOrgResidents || newBuildingId) return undefined;
        const term = participantSearch.trim();
        return term.length > 0 ? term : undefined;
    }, [canSearchOrgResidents, newBuildingId, participantSearch]);
    const ownerQueryTerm = useMemo(() => {
        if (!canSearchOwners || participantSource !== "owners") return undefined;
        const term = participantSearch.trim();
        return term.length > 0 ? term : undefined;
    }, [canSearchOwners, participantSource, participantSearch]);

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

    const residentsQuery = useBuildingResidents(newBuildingId, {
        enabled: canWrite && isComposerOpen && Boolean(newBuildingId),
    });
    const orgActiveResidentsQuery = useOrgResidents(
        { status: "WITH_OCCUPANCY", limit: 100, q: orgResidentQueryTerm },
        { enabled: canWrite && isComposerOpen && canSearchOrgResidents }
    );
    const ownersQuery = useOwners({
        enabled: canWrite && isComposerOpen && canSearchOwners && participantSource === "owners",
        search: ownerQueryTerm,
    });
    const prefilledOwnerGrantsQuery = useOwnerAccessGrants(prefilledOwnerId, {
        enabled:
            canWrite
            && isComposerOpen
            && canSearchOwners
            && participantSource === "owners"
            && shouldOpenPrefilledComposer
            && Boolean(prefilledOwnerId),
    });
    const ownerGrantQueryOwners = useMemo(
        () => (ownersQuery.data ?? []).slice(0, 20),
        [ownersQuery.data]
    );
    const ownerGrantQueries = useQueries({
        queries: ownerGrantQueryOwners.map((owner) => ({
            queryKey: ["owner-access-grants", owner.id],
            queryFn: () => getOwnerAccessGrants(owner.id),
            enabled: canWrite && isComposerOpen && canSearchOwners && participantSource === "owners",
            staleTime: 60_000,
        })),
    });

    const residentParticipantOptions = useMemo<ParticipantOption[]>(() => {
        if (requiresComposerBuildingSelection || newBuildingId) {
            const residents = residentsQuery.data ?? [];
            return residents
                .filter((resident) => {
                    const status = resident.status ? resident.status.toUpperCase() : "";
                    return resident.isActive === true || status === "ACTIVE";
                })
                .filter((resident) => resident.userId)
                .map((resident) => ({
                    id: resident.userId as string,
                    name: resident.name ?? resident.email ?? String(resident.userId),
                    email: resident.email ?? "",
                    unitLabel: resident.unit?.label || "",
                    buildingName: "",
                    kind: "residents" as const,
                }));
        }
        const activeResidents = orgActiveResidentsQuery.data?.items ?? [];
        return activeResidents
            .filter((resident) => resident.hasActiveOccupancy || resident.residentStatus === "ACTIVE")
            .map((resident) => ({
                id: String(resident.user.id),
                name: resident.user.name ?? resident.user.email ?? String(resident.user.id),
                email: resident.user.email ?? "",
                unitLabel:
                    resident.activeOccupancy?.unitLabel ||
                    resident.lease?.unitLabel ||
                    resident.lastOccupancy?.unitLabel ||
                    "",
                buildingName:
                    resident.activeOccupancy?.buildingName ??
                    resident.lease?.buildingName ??
                    resident.lastOccupancy?.buildingName ??
                    "",
                kind: "residents" as const,
            }));
    }, [
        requiresComposerBuildingSelection,
        newBuildingId,
        residentsQuery.data,
        orgActiveResidentsQuery.data?.items,
    ]);
    const prefilledOwnerParticipant = useMemo<ParticipantOption | null>(() => {
        if (!prefilledOwnerId) return null;
        const grants = prefilledOwnerGrantsQuery.data ?? [];
        const activeGrant = grants.find((grant: OwnerAccessGrant) => {
            const isActive = String(grant.status ?? "").trim().toUpperCase() === "ACTIVE";
            return isActive && Boolean(grant.userId);
        });
        if (!activeGrant?.userId) return null;
        if (prefilledParticipantId && activeGrant.userId !== prefilledParticipantId) return null;
        return {
            id: activeGrant.userId,
            name: prefilledParticipantName || activeGrant.linkedUser?.name || activeGrant.linkedUser?.email || activeGrant.userId,
            email: prefilledParticipantEmail || activeGrant.linkedUser?.email || "",
            unitLabel: "",
            buildingName: prefilledBuildingId
                ? (buildingOptions.find((building) => building.id === prefilledBuildingId)?.name ?? "")
                : "",
            kind: "owners",
        };
    }, [
        prefilledOwnerId,
        prefilledOwnerGrantsQuery.data,
        prefilledParticipantId,
        prefilledParticipantName,
        prefilledParticipantEmail,
        prefilledBuildingId,
        buildingOptions,
    ]);
    const ownerParticipantOptions = useMemo<ParticipantOption[]>(() => {
        const options: ParticipantOption[] = ownerGrantQueryOwners.flatMap((owner, index) => {
            const grants = ownerGrantQueries[index]?.data ?? [];
            const activeGrant = grants.find((grant: OwnerAccessGrant) => {
                const isActive = String(grant.status ?? "").trim().toUpperCase() === "ACTIVE";
                return isActive && Boolean(grant.userId);
            });
            if (!activeGrant) return [];
            const participantId = activeGrant.userId ?? "";
            if (!participantId) return [];
            return [{
                id: participantId,
                name: owner.name || activeGrant.linkedUser?.name || activeGrant.linkedUser?.email || participantId,
                email: owner.email || activeGrant.linkedUser?.email || "",
                unitLabel: "",
                buildingName: "",
                kind: "owners" as const,
            }];
        });
        if (prefilledOwnerParticipant && !options.some((entry) => entry.id === prefilledOwnerParticipant.id)) {
            options.unshift(prefilledOwnerParticipant);
        }
        return options;
    }, [
        ownerGrantQueries,
        ownerGrantQueryOwners,
        prefilledOwnerParticipant,
    ]);
    const participantOptions = participantSource === "owners" ? ownerParticipantOptions : residentParticipantOptions;
    const allParticipantOptions = useMemo(() => {
        const map = new Map<string, ParticipantOption>();
        [...residentParticipantOptions, ...ownerParticipantOptions].forEach((entry) => {
            if (!map.has(entry.id)) map.set(entry.id, entry);
        });
        return Array.from(map.values());
    }, [ownerParticipantOptions, residentParticipantOptions]);

    useEffect(() => {
        if (!requiresComposerBuildingSelection) return;
        if (newBuildingId && buildingOptions.some((building) => building.id === newBuildingId)) return;
        const preferredBuildingId = buildingOptions.find((building) => building.status === "active")?.id ?? buildingOptions[0]?.id ?? "";
        setNewBuildingId(preferredBuildingId);
    }, [buildingOptions, requiresComposerBuildingSelection, newBuildingId]);

    useEffect(() => {
        if (!isComposerOpen || buildingOptions.length === 0) return;

        const nextSelection = resolveComposerBuildingSelection(
            buildingOptions,
            newBuildingId,
            composerBuildingSelectionSeededRef.current
        );

        composerBuildingSelectionSeededRef.current = nextSelection.hasSeededSelection;

        if (nextSelection.selectedBuildingId !== newBuildingId) {
            setNewBuildingId(nextSelection.selectedBuildingId);
        }
    }, [buildingOptions, isComposerOpen, newBuildingId]);

    useEffect(() => {
        if (!shouldOpenPrefilledComposer || composerPrefillAppliedRef.current) return;

        composerPrefillAppliedRef.current = true;
        setIsComposerOpen(true);
        setParticipantSource("owners");
        setSelectedParticipantId("");
        setParticipantSearch("");
        if (prefilledBuildingId && buildingOptions.some((building) => building.id === prefilledBuildingId)) {
            setNewBuildingId(prefilledBuildingId);
        }

        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.delete("compose");
        nextParams.delete("participantUserId");
        nextParams.delete("ownerId");
        nextParams.delete("participantName");
        nextParams.delete("participantEmail");
        nextParams.delete("buildingId");
        const nextQuery = nextParams.toString();
        router.replace(nextQuery ? `/portal/messages?${nextQuery}` : "/portal/messages");
    }, [
        shouldOpenPrefilledComposer,
        prefilledBuildingId,
        buildingOptions,
        router,
        searchParams,
    ]);

    const prefilledOwnerNoticeShownRef = useRef(false);
    useEffect(() => {
        if (!shouldOpenPrefilledComposer || !prefilledOwnerId || prefilledOwnerNoticeShownRef.current) return;
        if (prefilledOwnerGrantsQuery.isLoading || prefilledOwnerGrantsQuery.isFetching) return;
        prefilledOwnerNoticeShownRef.current = true;
        if (!prefilledOwnerParticipant) {
            toast.error("This owner does not have an active linked user account yet.");
        }
    }, [
        shouldOpenPrefilledComposer,
        prefilledOwnerId,
        prefilledOwnerGrantsQuery.isLoading,
        prefilledOwnerGrantsQuery.isFetching,
        prefilledOwnerParticipant,
    ]);

    useEffect(() => {
        if (!shouldOpenPrefilledComposer || !prefilledOwnerParticipant) return;
        setParticipantIds((prev) => (
            prev.includes(prefilledOwnerParticipant.id) ? prev : [...prev, prefilledOwnerParticipant.id]
        ));
    }, [shouldOpenPrefilledComposer, prefilledOwnerParticipant]);

    const allActiveParticipantIds = useMemo(
        () => participantOptions.map((entry) => entry.id),
        [participantOptions]
    );
    const allActiveSelected = participantSource === "residents" && newBuildingId
        ? allActiveParticipantIds.length > 0 && allActiveParticipantIds.every((id) => participantIds.includes(id))
        : false;

    const handleToggleSelectAllParticipants = (checked: boolean) => {
        if (!newBuildingId || participantSource !== "residents") return;
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
        allParticipantOptions.forEach((entry) => {
            map.set(entry.id, entry);
        });
        return map;
    }, [allParticipantOptions]);

    const residentMetaByUserId = useMemo(() => {
        const map = new Map<string, { name?: string; email?: string; unitLabel?: string; buildingName?: string }>();
        allParticipantOptions.forEach((entry) => {
            map.set(entry.id, {
                name: entry.name,
                email: entry.email,
                unitLabel: entry.unitLabel,
                buildingName: entry.buildingName,
            });
        });
        return map;
    }, [allParticipantOptions]);

    const searchedConversations = useMemo(() => {
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
    const messagesViewportRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const allowedIds = new Set(allParticipantOptions.map((entry) => entry.id));
        setParticipantIds((prev) => {
            const next = prev.filter((id) => allowedIds.has(id));
            if (next.length === prev.length && next.every((id, index) => id === prev[index])) {
                return prev;
            }
            return next;
        });
        setSelectedParticipantId((prev) => (prev && !allowedIds.has(prev) ? "" : prev));
    }, [allParticipantOptions]);

    const selectedConversationRef = useRef(selectedConversationId);
    useEffect(() => {
        selectedConversationRef.current = selectedConversationId;
    }, [selectedConversationId]);

    useEffect(() => {
        if (!selectedConversationId) return;
        const viewport = messagesViewportRef.current;
        if (!viewport) return;

        viewport.scrollTo({
            top: viewport.scrollHeight,
            behavior: "smooth",
        });
    }, [selectedConversationId, conversation?.messages?.length]);

    useEffect(() => {
        if (!token || !canRead) return;
        const socket = connectNotificationsSocket(token, selectedOrgId ?? user?.orgId ?? null);
        if (!socket) return;

        const handleConversationNew = (payload: ConversationSocketPayload) => {
            const conversationId = payload?.conversationId;
            if (!conversationId) return;
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
        };

        const handleMessageNew = (payload: MessageSocketPayload) => {
            const conversationId = payload?.conversationId;
            const message = payload?.message;
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

        const handleConversationRead = (payload: ConversationSocketPayload) => {
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
        if (requiresComposerBuildingSelection && !newBuildingId) {
            toast.error("Select a building before starting a conversation.");
            return;
        }
        const validParticipantIds = participantIds.filter((id) => participantLookup.has(id));
        if (validParticipantIds.length !== participantIds.length) {
            setParticipantIds(validParticipantIds);
            toast.error("One or more selected participants are no longer valid. Please reselect them.");
            return;
        }
        const createConversationBuildingId =
            participantSource === "owners" && hasOrgScopedMessagingAccess
                ? undefined
                : (newBuildingId || undefined);

        try {
            const conversation = await createConversationMutation.mutateAsync({
                participantUserIds: validParticipantIds,
                subject: trimmedSubject || undefined,
                message: trimmedMessage,
                buildingId: createConversationBuildingId,
            });
            toast.success("Conversation started.");
            setNewSubject("");
            setNewMessage("");
            setParticipantIds([]);
            setParticipantSearch("");
            setSelectedParticipantId("");
            setIsComposerOpen(false);
            setSelectedConversationId(conversation.id);
            listQuery.refetch();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Failed to start conversation."));
        }
    };

    const handleComposerOpenChange = (open: boolean) => {
        setIsComposerOpen(open);
        if (!open) {
            composerBuildingSelectionSeededRef.current = false;
            setParticipantSource("residents");
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
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Failed to send message."));
        }
    };

    const handleLoadMore = async () => {
        if (!canRead || !nextCursor || isLoadingMore) return;
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
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Failed to load more conversations."));
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
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Failed to mark conversations as read."));
        } finally {
            setIsBulkMarking(false);
        }
    };

    const currentUserId = user?.id ?? "";
    const conversationErrorStatus = getErrorStatus(conversationQuery.error);
    const conversationUnavailableMessage =
        conversationErrorStatus === 404
            ? "Conversation not found or not visible to this user."
            : conversationErrorStatus === 403
                ? "You do not have permission to view this conversation."
                : "Conversation not available.";
    const filteredConversations = useMemo(() => {
        return searchedConversations.filter((conversationEntry) => {
            const matchesBuilding =
                inboxBuildingFilter === "all" ||
                (conversationEntry.buildingId ?? "__none__") === inboxBuildingFilter;

            if (!matchesBuilding) return false;

            if (inboxView === "unread") {
                return conversationEntry.unreadCount > 0;
            }

            if (inboxView === "needs_reply") {
                const senderId = conversationEntry.lastMessage?.sender?.id ?? "";
                return Boolean(senderId) && senderId !== currentUserId;
            }

            return true;
        });
    }, [currentUserId, inboxBuildingFilter, inboxView, searchedConversations]);
    const allSelected =
        filteredConversations.length > 0 &&
        filteredConversations.every((conversationEntry) => selectedConversationIds.includes(conversationEntry.id));

    const renderConversationMeta = (conv: Conversation) => {
        const subject = conv.subject || "Conversation";
        const lastMessage = conv.lastMessage?.content || "No messages yet";
        const updated = formatInboxTimestamp(conv.updatedAt);
        const participantNames = conv.participants
            .filter((participant) => participant.id !== currentUserId)
            .map((participant) => participant.name ?? participant.email ?? participant.id);
        const participantSummary = participantNames.length > 0
            ? participantNames.join(", ")
            : conv.participants.map((participant) => participant.name ?? participant.email ?? participant.id).join(", ");
        const unitLabels = Array.from(
            new Set(
                conv.participants
                    .map((participant) => participant.unitLabel)
                    .filter((value): value is string => Boolean(value))
            )
        );
        const buildingNames = Array.from(
            new Set(
                conv.participants
                    .map((participant) => participant.buildingName)
                    .filter((value): value is string => Boolean(value))
            )
        );
        const contextLine = [unitLabels.length > 0 ? `Unit ${unitLabels.join(", ")}` : null, buildingNames[0] ?? null]
            .filter(Boolean)
            .join(" - ");
        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <p className={cn("truncate text-sm", conv.unreadCount > 0 ? "font-semibold text-zinc-950" : "font-medium text-zinc-800")}>
                        {subject}
                    </p>
                    <div className="flex items-center gap-2 pl-2">
                        {conv.unreadCount > 0 ? (
                            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                {conv.unreadCount}
                            </span>
                        ) : null}
                        <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-400">
                            {updated}
                        </span>
                    </div>
                </div>
                <p className={cn("line-clamp-1 text-xs", conv.unreadCount > 0 ? "font-medium text-zinc-700" : "text-zinc-500")}>
                    {participantSummary || "Participants"}
                </p>
                {contextLine ? (
                    <p className="line-clamp-1 text-[11px] text-zinc-400">{contextLine}</p>
                ) : null}
                <p className="line-clamp-2 text-xs leading-5 text-zinc-500">{lastMessage}</p>
            </div>
        );
    };

    const messages = conversation?.messages ?? [];
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
    const unreadCount = conversations.reduce((count, item) => count + (item.unreadCount ?? 0), 0);
    const buildingLabel = newBuildingId
        ? buildingOptions.find((building) => building.id === newBuildingId)?.name ?? "Selected building"
        : "All buildings";
    const stats = [
        {
            label: "Inbox",
            value: conversations.length,
            hint: "Tracked threads",
            icon: Inbox,
            tone: "bg-zinc-900 text-white",
        },
        {
            label: "Unread",
            value: unreadCount,
            hint: "Needs review",
            icon: CheckCheck,
            tone: "bg-emerald-50 text-emerald-700",
        },
        {
            label: "Audience",
            value: participantOptions.length,
            hint: "Available residents",
            icon: Users,
            tone: "bg-zinc-100 text-zinc-700",
        },
    ];
    const inboxViewOptions: Array<{ value: InboxView; label: string; count: number }> = [
        { value: "all", label: "All", count: searchedConversations.length },
        { value: "unread", label: "Unread", count: searchedConversations.filter((item) => item.unreadCount > 0).length },
        {
            value: "needs_reply",
            label: "Needs reply",
            count: searchedConversations.filter((item) => {
                const senderId = item.lastMessage?.sender?.id ?? "";
                return Boolean(senderId) && senderId !== currentUserId;
            }).length,
        },
    ];

    return (
        <div className="space-y-6">
            <section className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03),0_16px_40px_rgba(0,0,0,0.04)]">
                <div className="border-b border-zinc-100 bg-[radial-gradient(circle_at_top_left,_rgba(5,150,105,0.08),_transparent_36%),linear-gradient(180deg,_rgba(250,250,250,0.96),_#ffffff)] px-6 py-6 md:px-8 md:py-8">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl">
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/90 px-3 py-1 text-xs font-medium text-zinc-600 shadow-sm">
                                <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                                Resident messaging workspace
                            </div>
                            <h1 className="text-3xl font-bold tracking-tight text-zinc-950 md:text-4xl">Messages</h1>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 md:text-base">
                                Manage resident conversations in one quiet workspace. Search people fast, keep the inbox tidy, and answer from a focused thread view.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm">
                                <Building2 className="h-3.5 w-3.5 text-zinc-400" />
                                {buildingLabel}
                            </div>
                            {canWrite && !isResident ? (
                                <Button
                                    onClick={() => setIsComposerOpen(true)}
                                    className="h-10 rounded-xl bg-zinc-900 px-4 text-white hover:bg-zinc-800"
                                >
                                    <MessageCircle className="mr-2 h-4 w-4" />
                                    New conversation
                                </Button>
                            ) : null}
                        </div>
                    </div>

                    <div className="mt-8 grid gap-4 md:grid-cols-3">
                        {stats.map((stat) => (
                            <div
                                key={stat.label}
                                className="rounded-2xl border border-zinc-200/80 bg-white/90 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] backdrop-blur"
                            >
                                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.tone}`}>
                                    <stat.icon className="h-4 w-4" />
                                </div>
                                <div className="mt-4 text-[11px] uppercase tracking-[0.16em] text-zinc-400">{stat.label}</div>
                                <div className="mt-1 text-3xl font-bold tracking-tight text-zinc-950">{stat.value}</div>
                                <p className="mt-2 text-xs text-zinc-500">{stat.hint}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
                <div className="space-y-6">
                    <Card className="overflow-hidden rounded-[24px] border-zinc-200 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                        <CardHeader className="border-b border-zinc-100 bg-zinc-50/70">
                            <div className="flex items-center justify-between gap-3">
                                <CardTitle className="text-base text-zinc-950">Inbox</CardTitle>
                                {canWrite && !isResident ? (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="rounded-xl bg-white"
                                        onClick={() => setIsComposerOpen(true)}
                                    >
                                        <MessageCircle className="mr-2 h-4 w-4" />
                                        New
                                    </Button>
                                ) : null}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            {!canRead ? (
                                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
                                    You do not have permission to view conversations.
                                </div>
                            ) : listQuery.isLoading ? (
                                <div className="flex items-center justify-center py-6 text-sm text-zinc-500">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Loading conversations...
                                </div>
                            ) : listQuery.isError ? (
                                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
                                    {getErrorMessage(listQuery.error, "Failed to load conversations.")}
                                </div>
                            ) : conversations.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
                                    No conversations yet.
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {inboxViewOptions.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => setInboxView(option.value)}
                                                className={cn(
                                                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                                                    inboxView === option.value
                                                        ? "border-zinc-900 bg-zinc-900 text-white"
                                                        : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
                                                )}
                                            >
                                                {option.label}
                                                <span
                                                    className={cn(
                                                        "rounded-full px-1.5 py-0.5 text-[10px]",
                                                        inboxView === option.value
                                                            ? "bg-white/15 text-white"
                                                            : "bg-zinc-100 text-zinc-500"
                                                    )}
                                                >
                                                    {option.count}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                        <Input
                                            value={conversationSearch}
                                            onChange={(event) => setConversationSearch(event.target.value)}
                                            placeholder="Search by subject, tenant, or unit"
                                            className="pl-9"
                                        />
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs text-zinc-500">
                                            {filteredConversations.length} thread{filteredConversations.length === 1 ? "" : "s"} in this view
                                        </div>
                                        <Select value={inboxBuildingFilter} onValueChange={setInboxBuildingFilter}>
                                            <SelectTrigger className="bg-white">
                                                <SelectValue placeholder="All buildings" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All buildings</SelectItem>
                                                {buildingOptions.map((building) => (
                                                    <SelectItem key={building.id} value={building.id}>
                                                        {building.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs text-zinc-600">
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
                                        <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-4 text-xs text-zinc-500">
                                            No conversations match this search.
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {filteredConversations.map((conv) => {
                                            const isSelected = selectedConversationIds.includes(conv.id);
                                            return (
                                                <div
                                                    key={conv.id}
                                                    className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
                                                        conv.id === selectedConversationId
                                                            ? "border-emerald-200 bg-emerald-50/60 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                                                            : "border-zinc-200/80 hover:border-zinc-300 hover:bg-zinc-50"
                                                    }`}
                                                >
                                                    <Checkbox
                                                        id={`select-conversation-${conv.id}`}
                                                        checked={isSelected}
                                                        onCheckedChange={() => toggleConversationSelection(conv.id)}
                                                        className="mt-0.5"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectConversation(conv)}
                                                        className="min-w-0 flex-1 text-left"
                                                    >
                                                        {renderConversationMeta(conv)}
                                                    </button>
                                                    <ChevronRight
                                                        className={cn(
                                                            "mt-1 h-4 w-4 shrink-0 text-zinc-300 transition-colors",
                                                            conv.id === selectedConversationId && "text-emerald-600"
                                                        )}
                                                    />
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

                <Card className="overflow-hidden rounded-[24px] border-zinc-200 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                    <CardHeader className="border-b border-zinc-100 bg-zinc-50/70">
                        <CardTitle className="text-base text-zinc-950">Conversation</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                        {!selectedConversationId ? (
                            <div className="rounded-[24px] border border-dashed border-zinc-200 bg-zinc-50 px-4 py-14 text-center text-sm text-zinc-500">
                                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white shadow-sm">
                                    <MessageCircle className="h-5 w-5 text-zinc-300" />
                                </div>
                                Select a conversation to view messages.
                            </div>
                        ) : conversationQuery.isLoading ? (
                            <div className="flex items-center justify-center py-10 text-sm text-zinc-500">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Loading conversation...
                            </div>
                        ) : conversation ? (
                            <>
                                <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-5">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div>
                                            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-500">
                                                <Inbox className="h-3.5 w-3.5 text-emerald-600" />
                                                Active thread
                                            </div>
                                            <p className="text-lg font-semibold tracking-tight text-zinc-950">
                                                {conversation.subject || "Conversation"}
                                            </p>
                                            <div className="mt-2 space-y-1 text-xs leading-5 text-zinc-500">
                                                <p>To: {participantLine || "Participants"}</p>
                                                <p>From: You</p>
                                            </div>
                                        </div>
                                        <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-500 shadow-sm">
                                            {messages.length} {messages.length === 1 ? "message" : "messages"}
                                        </div>
                                    </div>
                                </div>
                                <div
                                    ref={messagesViewportRef}
                                    className="max-h-[520px] space-y-3 overflow-y-auto rounded-[24px] border border-zinc-200 bg-white p-4"
                                >
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
                                                        className={`max-w-[82%] rounded-[22px] border px-4 py-3 ${
                                                            isMine
                                                                ? "border-zinc-900 bg-zinc-900 text-white shadow-[0_8px_24px_rgba(24,24,27,0.12)]"
                                                                : "border-zinc-200 bg-zinc-50/70 text-zinc-900"
                                                        }`}
                                                    >
                                                        <div
                                                            className={cn(
                                                                "flex items-center justify-between gap-4 text-xs",
                                                                isMine ? "text-zinc-300" : "text-zinc-500"
                                                            )}
                                                        >
                                                            <span>{senderLabel}</span>
                                                            <span>{formatMessageTimestamp(message.createdAt)}</span>
                                                        </div>
                                                        <p
                                                            className={cn(
                                                                "mt-2 whitespace-pre-line text-sm leading-6",
                                                                isMine ? "text-white" : "text-zinc-700"
                                                            )}
                                                        >
                                                            {message.content}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                                <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/70 p-4">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Reply</label>
                                        <span className="text-xs text-zinc-400">{replyContent.trim().length}/{MAX_MESSAGE}</span>
                                    </div>
                                    <Textarea
                                        value={replyContent}
                                        onChange={(event) => setReplyContent(event.target.value)}
                                        maxLength={MAX_MESSAGE}
                                        rows={4}
                                        placeholder="Write a reply..."
                                        className="min-h-28 bg-white"
                                    />
                                    <div className="mt-3 flex justify-end">
                                        <Button
                                            onClick={handleSendMessage}
                                            disabled={sendMessageMutation.isPending || !canWrite}
                                            className="h-11 rounded-xl bg-zinc-900 px-5 text-white hover:bg-zinc-800"
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
                                </div>
                            </>
                        ) : (
                            <div className="rounded-[24px] border border-dashed border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
                                {conversationQuery.isError ? conversationUnavailableMessage : "Conversation not available."}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Sheet open={isComposerOpen} onOpenChange={handleComposerOpenChange}>
                <SheetContent side="right" className="w-full gap-0 border-l border-zinc-200 bg-white sm:max-w-xl">
                    <SheetHeader className="border-b border-zinc-100 bg-zinc-50/70 px-6 py-5 text-left">
                        <SheetTitle className="flex items-center gap-2 text-base text-zinc-950">
                            <Sparkles className="h-4 w-4 text-emerald-600" />
                            Start conversation
                        </SheetTitle>
                        <SheetDescription className="text-sm text-zinc-500">
                            Create a new resident or owner thread without leaving the inbox.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="flex-1 overflow-y-auto px-6 py-6">
                        {!canWrite || isResident ? (
                            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-sm leading-6 text-zinc-500">
                                {isResident
                                    ? "Residents can only reply to existing conversations."
                                    : "You do not have permission to start conversations."}
                            </div>
                        ) : (
                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                        Building {requiresComposerBuildingSelection ? "*" : "(optional)"}
                                    </label>
                                    <Select
                                        value={newBuildingId}
                                        onValueChange={(value) => setNewBuildingId(value === "__all__" ? "" : value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={requiresComposerBuildingSelection ? "Select building" : "All buildings"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {!requiresComposerBuildingSelection && (
                                                <SelectItem value="__all__">All buildings</SelectItem>
                                            )}
                                            {buildingOptions.map((building) => (
                                                <SelectItem key={building.id} value={building.id}>
                                                    {building.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-zinc-400">
                                        {requiresComposerBuildingSelection
                                            ? "Building-scoped messaging requires a building before you can start a thread."
                                            : hasBuildingScopedMessagingAccess && hasOrgScopedMessagingAccess
                                                ? "Optional. Leave blank to let the backend resolve any authorized scope."
                                                : "Optional for org-scoped users."}
                                    </p>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Participants *</label>
                                        <span className="text-xs text-zinc-400">{selectedParticipants.length} selected</span>
                                    </div>
                                    <Tabs value={participantSource} onValueChange={(value) => setParticipantSource(value as ParticipantSource)}>
                                        <TabsList className="grid w-full grid-cols-2">
                                            <TabsTrigger value="residents">Residents</TabsTrigger>
                                            <TabsTrigger value="owners" disabled={!canSearchOwners}>Owners</TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                    {participantSource === "residents" && newBuildingId ? (
                                        <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                                            <Checkbox
                                                id="select-all-participants"
                                                checked={allActiveSelected}
                                                onCheckedChange={(checked) => handleToggleSelectAllParticipants(Boolean(checked))}
                                            />
                                            <label htmlFor="select-all-participants">Select all active residents</label>
                                        </div>
                                    ) : null}
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                        <Input
                                            value={participantSearch}
                                            onChange={(event) => setParticipantSearch(event.target.value)}
                                            placeholder={participantSource === "owners" ? "Search by owner name or email" : "Search by participant name, email, unit, or building"}
                                            className="pl-9"
                                        />
                                    </div>
                                    {participantSearch.trim() ? (
                                        <div className="max-h-48 space-y-1 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-1.5">
                                            {participantSuggestions.length === 0 ? (
                                                <div className="px-2 py-2 text-xs text-zinc-500">No matching participants found.</div>
                                            ) : (
                                                participantSuggestions.map((participant) => (
                                                    <button
                                                        key={`suggestion-${participant.id}`}
                                                        type="button"
                                                        onClick={() => handleAddParticipant(participant.id)}
                                                        className="w-full rounded-xl px-3 py-2 text-left text-xs text-zinc-700 transition hover:bg-zinc-50"
                                                    >
                                                        <div className="font-medium text-zinc-800">{participant.name}</div>
                                                        <div className="mt-0.5 text-zinc-500">
                                                            {participant.kind === "owners"
                                                                ? (participant.email || "Owner contact")
                                                                : participant.unitLabel
                                                                ? `Unit ${participant.unitLabel}`
                                                                : (participant.email || "Unit unavailable")}
                                                            {participant.buildingName ? ` - ${participant.buildingName}` : ""}
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    ) : null}
                                    <Select
                                        value={selectedParticipantId}
                                        onValueChange={(value) => {
                                            if (value === "_none") return;
                                            handleAddParticipant(value);
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={participantSource === "owners" ? "Select owner" : "Select participant"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {participantOptionsFiltered.length === 0 ? (
                                                <SelectItem value="_none" disabled>
                                                    {participantSource === "owners" ? "No owners available" : "No participants available"}
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
                                    <p className="text-xs text-zinc-400">
                                        {participantSource === "owners"
                                            ? "Only owners with an active linked access grant can be messaged."
                                            : "Select a resident to add them to the conversation."}
                                    </p>
                                    {selectedParticipants.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {selectedParticipants.map((participant) => (
                                                <button
                                                    key={participant.id}
                                                    type="button"
                                                    onClick={() => handleRemoveParticipant(participant.id)}
                                                    className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600 transition hover:border-zinc-300 hover:bg-white"
                                                >
                                                    {formatParticipantLabel(participant)} x
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Subject</label>
                                    <Input
                                        value={newSubject}
                                        onChange={(event) => setNewSubject(event.target.value)}
                                        maxLength={MAX_TITLE}
                                        placeholder="Lease renewal discussion"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-3">
                                        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Message *</label>
                                        <span className="text-xs text-zinc-400">{newMessage.trim().length}/{MAX_MESSAGE}</span>
                                    </div>
                                    <Textarea
                                        value={newMessage}
                                        onChange={(event) => setNewMessage(event.target.value)}
                                        maxLength={MAX_MESSAGE}
                                        rows={8}
                                        placeholder="Write your message..."
                                        className="min-h-36"
                                    />
                                </div>
                                <div className="flex items-center justify-end gap-3 border-t border-zinc-100 pt-4">
                                    <Button variant="outline" className="rounded-xl" onClick={() => setIsComposerOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleCreateConversation}
                                        disabled={createConversationMutation.isPending}
                                        className="h-11 rounded-xl bg-zinc-900 px-5 text-white hover:bg-zinc-800"
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
                                </div>
                            </div>
                        )}
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}

