"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
    Building2,
    ChevronDown,
    ChevronRight,
    Inbox,
    Loader2,
    Megaphone,
    RefreshCw,
    Search,
    Send,
    Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { getBroadcasts } from "@/lib/api/communications";
import { getBroadcastAudienceLabel, getBroadcastMetadata, getBroadcastScopeLabel } from "@/lib/broadcastMetadata";
import { useAccessibleBuildings, useBroadcast, useBroadcasts, useCreateBroadcast } from "@/lib/queries";
import type { Broadcast, BroadcastAudience, BroadcastListResponse } from "@/lib/types";
import {
    getBuildingAccessAssignments,
    getOrgAccessAssignments,
    hasPermission as hasRbacPermission,
    isBuildingScopedOnly,
} from "@/lib/rbac";
import { cn } from "@/lib/utils";

const MIN_TITLE = 3;
const MAX_TITLE = 200;
const MAX_BODY = 2000;
const PAGE_LIMIT = 20;

type BroadcastTemplate = {
    id: string;
    label: string;
    title: string;
    body: string;
    audiences: BroadcastAudience[];
    note: string;
};

type BroadcastRenderCap = "12" | "25" | "50" | "all";
type BroadcastAudienceFilter = BroadcastAudience | "all";

type AudienceOption = {
    value: BroadcastAudience;
    label: string;
    description: string;
};

const BROADCAST_TEMPLATES: BroadcastTemplate[] = [
    {
        id: "planned-maintenance",
        label: "Planned maintenance",
        title: "Planned maintenance notice",
        body: "Dear residents,\n\nPlease note that scheduled maintenance will take place on [DATE] from [TIME] to [TIME]. During this window, [SYSTEM/AREA] may be temporarily unavailable.\n\nOur team will work to minimize disruption and restore normal service as quickly as possible.\n\nThank you for your patience.\n\nManagement",
        audiences: ["tenants"],
        note: "For scheduled work, contractor access, or temporary service interruptions.",
    },
    {
        id: "emergency-advisory",
        label: "Urgent advisory",
        title: "Urgent building advisory",
        body: "Dear residents,\n\nWe are currently responding to an urgent issue affecting [AREA/SYSTEM]. Please avoid the affected area until further notice and follow any instructions from building staff.\n\nWe will share another update as soon as more information is available.\n\nManagement",
        audiences: ["all_users"],
        note: "For urgent incidents where everyone should receive the message immediately.",
    },
    {
        id: "community-reminder",
        label: "Community reminder",
        title: "Community reminder",
        body: "Dear residents,\n\nThis is a reminder regarding [TOPIC]. Please make sure to follow the building guidelines and complete any required action by [DATE].\n\nIf you need clarification, please contact management.\n\nThank you,\nManagement",
        audiences: ["tenants"],
        note: "For policy reminders, housekeeping guidance, parking etiquette, or recurring notices.",
    },
    {
        id: "service-access",
        label: "Service access notice",
        title: "Service access required",
        body: "Dear residents,\n\nOur team needs access to [AREA/UNIT TYPE] on [DATE] between [TIME] and [TIME] for [SERVICE/INSPECTION]. Please ensure appropriate access is available during this window.\n\nIf this timing creates an issue, contact management as soon as possible.\n\nManagement",
        audiences: ["tenants"],
        note: "For inspections, service appointments, meter checks, or building access coordination.",
    },
];

const AUDIENCE_OPTIONS: AudienceOption[] = [
    { value: "tenants", label: "Tenants", description: "Residents in units and occupancies." },
    { value: "admins", label: "Admins", description: "Organization admins." },
    { value: "staff", label: "Staff", description: "Operational staff accounts." },
    { value: "managers", label: "Managers", description: "Building or operations managers." },
    { value: "building_admins", label: "Building admins", description: "Admins scoped to buildings." },
    { value: "all_users", label: "All users", description: "Everyone in the org." },
];

const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;

const normalizeSearchText = (value: string) => value.trim().toLowerCase();

const tokenizeSearchText = (value: string) =>
    normalizeSearchText(value)
        .split(/[\s\-_/.,#:]+/)
        .filter(Boolean);

const formatBroadcastDate = (value?: string) =>
    value ? new Date(value).toLocaleString() : "-";

const formatBroadcastListDate = (value?: string) => {
    if (!value) return "";
    const date = new Date(value);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const getDateGroupKey = (value?: string) => {
    if (!value) return "__unknown__";
    const date = new Date(value);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const formatDateGroupLabel = (value?: string) => {
    if (!value) return "Unknown date";
    const date = new Date(value);
    const now = new Date();
    const todayKey = getDateGroupKey(now.toISOString());
    const targetKey = getDateGroupKey(value);

    if (targetKey === todayKey) return "Today";

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (targetKey === getDateGroupKey(yesterday.toISOString())) return "Yesterday";

    return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};

const getBroadcastBodyPreview = (value?: string, maxLength = 100) => {
    const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
    if (!normalized) return "";
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3).trimEnd()}...` : normalized;
};

const getAudienceLabel = (value: BroadcastAudience) => getBroadcastAudienceLabel(value);

const getBroadcastAudiences = (broadcast: Broadcast): BroadcastAudience[] => {
    const metadata = getBroadcastMetadata(broadcast);
    return metadata.audiences.length > 0
        ? metadata.audiences
        : broadcast.audiences && broadcast.audiences.length > 0
            ? broadcast.audiences
            : [];
};

const getAudienceSummary = (broadcast: Broadcast) => getBroadcastMetadata(broadcast).audienceSummary;

const getScopeSummary = (broadcast: Broadcast, buildingNameById: Record<string, string>) => {
    const metadata = getBroadcastMetadata(broadcast);
    if (metadata.scope === "org_wide") {
        return "Org-wide";
    }
    if (broadcast.buildingIds.length > 0) {
        return broadcast.buildingIds.map((id) => buildingNameById[id] ?? id).join(", ");
    }
    if (metadata.buildingCount > 0) {
        return `${metadata.buildingCount} building${metadata.buildingCount === 1 ? "" : "s"}`;
    }
    return getBroadcastScopeLabel(metadata.scope);
};

const getRenderCapValue = (value: BroadcastRenderCap) =>
    value === "all" ? Number.POSITIVE_INFINITY : Number(value);

function FilterField({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-[22px] border border-zinc-200 bg-white p-3 shadow-xs">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">{label}</div>
            <div className="mt-2">{children}</div>
        </div>
    );
}

export function BroadcastsPage() {
    const { user, baseRole } = useAuth();
    const hasOrgScopedBroadcastAccess = getOrgAccessAssignments(user).length > 0;
    const hasBuildingScopedBroadcastAccess = getBuildingAccessAssignments(user).length > 0;
    const isBuildingScopedBroadcastOnly = isBuildingScopedOnly(user, "broadcasts.write");
    const canWrite = hasRbacPermission(user, "broadcasts.write");
    const canRead =
        canWrite
        || hasRbacPermission(user, "broadcasts.read");
    const canUseBroadcasts = canRead || canWrite;

    const buildings = useAccessibleBuildings(user?.id, baseRole, { enabled: canUseBroadcasts }).data;
    const buildingOptions = useMemo(
        () => (buildings || []).slice().sort((a, b) => a.name.localeCompare(b.name)),
        [buildings]
    );
    const buildingNameById = useMemo(() => {
        const map: Record<string, string> = {};
        (buildings || []).forEach((building) => {
            map[building.id] = building.name;
        });
        return map;
    }, [buildings]);

    const [selectedBroadcastId, setSelectedBroadcastId] = useState<string>("");
    const [filterBuildingId, setFilterBuildingId] = useState<string>("all");
    const [filterAudience, setFilterAudience] = useState<BroadcastAudienceFilter>("all");
    const [isBuildingFilterOpen, setIsBuildingFilterOpen] = useState(false);
    const [isAudienceFilterOpen, setIsAudienceFilterOpen] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [renderCap, setRenderCap] = useState<BroadcastRenderCap>("12");
    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [sendToAll, setSendToAll] = useState(true);
    const [selectedBuildingIds, setSelectedBuildingIds] = useState<string[]>([]);
    const [selectedAudiences, setSelectedAudiences] = useState<BroadcastAudience[]>(["tenants"]);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

    const queryClient = useQueryClient();
    const listQuery = useBroadcasts({
        limit: PAGE_LIMIT,
        buildingId: filterBuildingId === "all" ? undefined : filterBuildingId,
        enabled: canRead,
    });
    const detailQuery = useBroadcast(selectedBroadcastId, { enabled: canRead && Boolean(selectedBroadcastId) });
    const createBroadcastMutation = useCreateBroadcast();
    const broadcasts = listQuery.data?.items ?? [];
    const nextCursor = listQuery.data?.nextCursor ?? null;

    const currentBuildingLabel =
        filterBuildingId === "all"
            ? "All buildings"
            : buildingNameById[filterBuildingId] ?? "Selected building";
    const currentAudienceLabel =
        filterAudience === "all"
            ? "All audiences"
            : getAudienceLabel(filterAudience);

    const getBroadcastMatchesBuilding = (broadcast: Broadcast, buildingId: string) =>
        broadcast.buildingIds.length === 0 || broadcast.buildingIds.includes(buildingId);

    const searchedBroadcasts = useMemo(() => {
        const query = normalizeSearchText(searchText);
        const queryTokens = tokenizeSearchText(query);

        return broadcasts.filter((broadcast) => {
            if (filterAudience !== "all" && !getBroadcastAudiences(broadcast).includes(filterAudience)) {
                return false;
            }

            if (!query) {
                return true;
            }

            const haystacks = [
                broadcast.title,
                broadcast.body,
                formatBuildingsForBroadcast(broadcast, buildingNameById),
                getAudienceSummary(broadcast),
                getBroadcastMetadata(broadcast).scope,
                getBroadcastScopeLabel(getBroadcastMetadata(broadcast).scope),
                String(getBroadcastMetadata(broadcast).buildingCount),
                broadcast.sender?.name,
                broadcast.sender?.email,
                String(broadcast.recipientCount),
            ]
                .filter(Boolean)
                .map((entry) => normalizeSearchText(String(entry)));

            return queryTokens.every((token) =>
                haystacks.some((entry) => entry.includes(token))
            );
        });
    }, [broadcasts, filterAudience, searchText, buildingNameById]);

    const visibleBroadcasts = useMemo(() => {
        const limit = getRenderCapValue(renderCap);
        return Number.isFinite(limit) ? searchedBroadcasts.slice(0, limit) : searchedBroadcasts;
    }, [searchedBroadcasts, renderCap]);

    const groupedVisibleBroadcasts = useMemo(() => {
        const groups: Array<{ key: string; label: string; items: Broadcast[] }> = [];
        visibleBroadcasts.forEach((broadcast) => {
            const key = getDateGroupKey(broadcast.createdAt);
            const existing = groups.find((group) => group.key === key);
            if (existing) {
                existing.items.push(broadcast);
                return;
            }
            groups.push({
                key,
                label: formatDateGroupLabel(broadcast.createdAt),
                items: [broadcast],
            });
        });
        return groups;
    }, [visibleBroadcasts]);

    useEffect(() => {
        if (!selectedBroadcastId) return;
        if (searchedBroadcasts.some((broadcast) => broadcast.id === selectedBroadcastId)) return;
        setSelectedBroadcastId("");
    }, [searchedBroadcasts, selectedBroadcastId]);

    const selectedBroadcastPreview = useMemo(
        () => broadcasts.find((broadcast) => broadcast.id === selectedBroadcastId) ?? null,
        [broadcasts, selectedBroadcastId]
    );
    const selectedBroadcast = detailQuery.data ?? selectedBroadcastPreview ?? null;
    const selectedBroadcastMetadata = selectedBroadcast ? getBroadcastMetadata(selectedBroadcast) : null;

    const hiddenBroadcastCount = Math.max(searchedBroadcasts.length - visibleBroadcasts.length, 0);
    const selectedTemplate = BROADCAST_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? null;
    const composerScopeLabel = sendToAll
        ? "All accessible buildings"
        : selectedBuildingIds.length > 0
            ? selectedBuildingIds.map((id) => buildingNameById[id] ?? id).join(", ")
            : "No buildings selected";
    const composerAudienceSummary = selectedAudiences.length > 0
        ? (selectedAudiences.includes("all_users") ? "All users" : selectedAudiences.map(getAudienceLabel).join(", "))
        : "Tenants";

    const toggleBuilding = (buildingId: string) => {
        setSelectedBuildingIds((prev) =>
            prev.includes(buildingId) ? prev.filter((id) => id !== buildingId) : [...prev, buildingId]
        );
    };

    const resetForm = () => {
        setTitle("");
        setBody("");
        setSendToAll(true);
        setSelectedBuildingIds([]);
        setSelectedAudiences(["tenants"]);
        setSelectedTemplateId("");
    };

    const applyTemplate = (template: BroadcastTemplate) => {
        setSelectedTemplateId(template.id);
        setTitle(template.title);
        setBody(template.body);
        setSelectedAudiences(template.audiences);
    };

    const handleToggleAudience = (value: BroadcastAudience) => {
        setSelectedAudiences((prev) => {
            if (value === "all_users") {
                return prev.includes("all_users") ? prev.filter((audience) => audience !== "all_users") : ["all_users"];
            }
            const next = prev.includes(value)
                ? prev.filter((audience) => audience !== value)
                : [...prev.filter((audience) => audience !== "all_users"), value];
            return next;
        });
    };

    const handleCreateBroadcast = async () => {
        const trimmedTitle = title.trim();
        const trimmedBody = body.trim();
        if (trimmedTitle.length < MIN_TITLE || trimmedTitle.length > MAX_TITLE) {
            toast.error(`Title must be between ${MIN_TITLE} and ${MAX_TITLE} characters.`);
            return;
        }
        if (trimmedBody.length > MAX_BODY) {
            toast.error(`Body must be ${MAX_BODY} characters or fewer.`);
            return;
        }
        if (!sendToAll && selectedBuildingIds.length === 0) {
            toast.error("Select at least one building or choose All buildings.");
            return;
        }
        if (sendToAll && buildingOptions.length === 0) {
            toast.error("No buildings available for broadcast.");
            return;
        }

        try {
            const normalizedAudiences: BroadcastAudience[] = selectedAudiences.length
                ? (selectedAudiences.includes("all_users") ? ["all_users"] : selectedAudiences)
                : ["tenants"];
            const result = await createBroadcastMutation.mutateAsync({
                title: trimmedTitle,
                body: trimmedBody ? trimmedBody : undefined,
                buildingIds: sendToAll ? undefined : selectedBuildingIds,
                audiences: normalizedAudiences,
            });
            toast.success(`Broadcast sent to ${result.recipientCount} recipient(s).`);
            resetForm();
            setIsComposerOpen(false);
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Failed to send broadcast."));
        }
    };

    const handleLoadMore = async () => {
        if (!canRead || !nextCursor || isLoadingMore) return;
        setIsLoadingMore(true);
        const key = ["broadcasts", filterBuildingId === "all" ? "all" : filterBuildingId, PAGE_LIMIT];
        try {
            const response = await getBroadcasts({
                limit: PAGE_LIMIT,
                cursor: nextCursor,
                buildingId: filterBuildingId === "all" ? undefined : filterBuildingId,
            });
            queryClient.setQueryData<BroadcastListResponse | undefined>(key, (prev) => {
                const prevItems = prev?.items ?? [];
                const merged = [...prevItems];
                const seen = new Set(prevItems.map((item) => item.id));
                response.items.forEach((item) => {
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
            toast.error(getErrorMessage(error, "Failed to load more broadcasts."));
        } finally {
            setIsLoadingMore(false);
        }
    };

    return (
        <div className="space-y-6">
            <section className="relative overflow-hidden rounded-[30px] border border-zinc-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.08),_transparent_34%),radial-gradient(circle_at_right_center,_rgba(15,23,42,0.03),_transparent_30%),linear-gradient(180deg,_#ffffff,_rgba(250,250,250,0.98))] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_16px_40px_rgba(0,0,0,0.04)]">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-2xl">
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 shadow-sm">
                            <Megaphone className="h-3.5 w-3.5 text-emerald-600" />
                            Broadcast control center
                        </div>
                        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-zinc-950">Broadcasts</h1>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
                            Send resident-wide announcements from one focused workspace. Filter the feed fast, inspect delivery details, and launch a new broadcast from the same surface.
                        </p>
                        {hasBuildingScopedBroadcastAccess ? (
                            <p className="mt-3 text-xs uppercase tracking-[0.16em] text-zinc-400">
                                {isBuildingScopedBroadcastOnly
                                    ? "Applies to accessible buildings"
                                    : hasOrgScopedBroadcastAccess
                                        ? "Org and building scopes supported"
                                        : "Broadcast scope available"}
                            </p>
                        ) : null}
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="rounded-[22px] border border-white/70 bg-white/80 p-3 shadow-sm backdrop-blur">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                                    <Building2 className="h-4 w-4" />
                                </div>
                                <div className="min-w-[190px]">
                                    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">Building</div>
                                    <div className="text-sm font-semibold text-zinc-900">{currentBuildingLabel}</div>
                                </div>
                            </div>
                        </div>
                        <Button variant="outline" className="h-11 rounded-xl bg-white/90 px-4" onClick={() => listQuery.refetch()} disabled={!canRead || listQuery.isFetching}>
                            {listQuery.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Refresh
                        </Button>
                        {canWrite ? (
                            <Button onClick={() => setIsComposerOpen(true)} className="h-11 rounded-xl bg-zinc-900 px-4 text-white hover:bg-zinc-800">
                                <Sparkles className="mr-2 h-4 w-4" />
                                New broadcast
                            </Button>
                        ) : null}
                    </div>
                </div>

            </section>
            {canRead ? (
                <section className="rounded-[30px] border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4">
                        <div>
                            <h2 className="text-sm font-semibold text-zinc-950">Filter broadcasts</h2>
                            <p className="mt-1 text-xs text-zinc-400">
                                Narrow the bulletin log by building scope, audience, visible item cap, or keyword search.
                            </p>
                        </div>

                        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.35fr)]">
                            <FilterField label="Building">
                                <Popover open={isBuildingFilterOpen} onOpenChange={setIsBuildingFilterOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className="h-11 w-full justify-between rounded-2xl border-zinc-200 bg-zinc-50 px-3 text-sm font-normal text-zinc-900 shadow-none">
                                            <span className="truncate text-left">{currentBuildingLabel}</span>
                                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
                                        <div className="mb-2 flex items-center justify-between px-2 py-1">
                                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Buildings</div>
                                            {filterBuildingId !== "all" ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setFilterBuildingId("all");
                                                        setIsBuildingFilterOpen(false);
                                                    }}
                                                    className="text-xs text-zinc-500 hover:text-zinc-900"
                                                >
                                                    Clear
                                                </button>
                                            ) : null}
                                        </div>
                                        <div className="space-y-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFilterBuildingId("all");
                                                    setIsBuildingFilterOpen(false);
                                                }}
                                                className={cn(
                                                    "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left",
                                                    filterBuildingId === "all" ? "border-zinc-900 bg-zinc-950 text-white" : "border-zinc-200 bg-white hover:bg-zinc-50"
                                                )}
                                            >
                                                <div>
                                                    <div className="text-sm font-medium">All buildings</div>
                                                    <div className={cn("text-xs", filterBuildingId === "all" ? "text-zinc-300" : "text-zinc-500")}>
                                                        {broadcasts.length} broadcast{broadcasts.length === 1 ? "" : "s"}
                                                    </div>
                                                </div>
                                            </button>
                                            {buildingOptions.map((building) => {
                                                const isSelected = filterBuildingId === building.id;
                                                const count = broadcasts.filter((broadcast) => getBroadcastMatchesBuilding(broadcast, building.id)).length;
                                                return (
                                                    <button
                                                        key={building.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setFilterBuildingId(building.id);
                                                            setIsBuildingFilterOpen(false);
                                                        }}
                                                        className={cn(
                                                            "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left",
                                                            isSelected ? "border-zinc-900 bg-zinc-950 text-white" : "border-zinc-200 bg-white hover:bg-zinc-50"
                                                        )}
                                                    >
                                                        <div>
                                                            <div className="text-sm font-medium">{building.name}</div>
                                                            <div className={cn("text-xs", isSelected ? "text-zinc-300" : "text-zinc-500")}>
                                                                {count} broadcast{count === 1 ? "" : "s"}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </FilterField>

                            <FilterField label="Audience">
                                <Popover open={isAudienceFilterOpen} onOpenChange={setIsAudienceFilterOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className="h-11 w-full justify-between rounded-2xl border-zinc-200 bg-zinc-50 px-3 text-sm font-normal text-zinc-900 shadow-none">
                                            <span className="truncate text-left">{currentAudienceLabel}</span>
                                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
                                        <div className="mb-2 flex items-center justify-between px-2 py-1">
                                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Audiences</div>
                                            {filterAudience !== "all" ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setFilterAudience("all");
                                                        setIsAudienceFilterOpen(false);
                                                    }}
                                                    className="text-xs text-zinc-500 hover:text-zinc-900"
                                                >
                                                    Clear
                                                </button>
                                            ) : null}
                                        </div>
                                        <div className="space-y-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFilterAudience("all");
                                                    setIsAudienceFilterOpen(false);
                                                }}
                                                className={cn(
                                                    "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left",
                                                    filterAudience === "all" ? "border-zinc-900 bg-zinc-950 text-white" : "border-zinc-200 bg-white hover:bg-zinc-50"
                                                )}
                                            >
                                                <div>
                                                    <div className="text-sm font-medium">All audiences</div>
                                                    <div className={cn("text-xs", filterAudience === "all" ? "text-zinc-300" : "text-zinc-500")}>
                                                        {broadcasts.length} broadcast{broadcasts.length === 1 ? "" : "s"}
                                                    </div>
                                                </div>
                                            </button>
                                            {AUDIENCE_OPTIONS.map((option) => {
                                                const isSelected = filterAudience === option.value;
                                                const count = broadcasts.filter((broadcast) => getBroadcastAudiences(broadcast).includes(option.value)).length;
                                                return (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => {
                                                            setFilterAudience(option.value);
                                                            setIsAudienceFilterOpen(false);
                                                        }}
                                                        className={cn(
                                                            "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left",
                                                            isSelected ? "border-zinc-900 bg-zinc-950 text-white" : "border-zinc-200 bg-white hover:bg-zinc-50"
                                                        )}
                                                    >
                                                        <div>
                                                            <div className="text-sm font-medium">{option.label}</div>
                                                            <div className={cn("text-xs", isSelected ? "text-zinc-300" : "text-zinc-500")}>
                                                                {count} broadcast{count === 1 ? "" : "s"}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </FilterField>

                            <FilterField label="Visible Items">
                                <Select value={renderCap} onValueChange={(value) => setRenderCap(value as BroadcastRenderCap)}>
                                    <SelectTrigger className="h-11 w-full rounded-2xl border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 shadow-none">
                                        <SelectValue placeholder={renderCap === "all" ? "Show all" : `Show ${renderCap}`} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="12">Show 12</SelectItem>
                                        <SelectItem value="25">Show 25</SelectItem>
                                        <SelectItem value="50">Show 50</SelectItem>
                                        <SelectItem value="all">Show all</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FilterField>

                            <FilterField label="Search">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                    <Input
                                        value={searchText}
                                        onChange={(event) => setSearchText(event.target.value)}
                                        placeholder="Search broadcast title, body, sender, or scope"
                                        className="h-11 rounded-2xl border-zinc-200 bg-zinc-50 pl-9 text-sm text-zinc-900 shadow-none placeholder:text-zinc-400"
                                    />
                                </div>
                            </FilterField>
                        </div>
                    </div>
                </section>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                <Card className="overflow-hidden rounded-[24px] border-zinc-200 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                    <CardHeader className="border-b border-zinc-100 bg-zinc-50/70">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <CardTitle className="text-base text-zinc-950">Bulletin log</CardTitle>
                                <p className="mt-1 text-xs text-zinc-400">Archive of sent announcements grouped by delivery date.</p>
                            </div>
                            {canWrite ? (
                                <Button variant="outline" className="h-10 rounded-xl bg-white" onClick={() => setIsComposerOpen(true)}>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    New
                                </Button>
                            ) : null}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                        {!canRead ? (
                            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-sm text-zinc-500">
                                You do not have permission to view broadcasts.
                            </div>
                        ) : listQuery.isError ? (
                            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-sm text-zinc-500">
                                {getErrorMessage(listQuery.error, "Failed to load broadcasts.")}
                            </div>
                        ) : listQuery.isLoading ? (
                            <div className="flex items-center justify-center py-12 text-sm text-zinc-500">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Loading broadcasts...
                            </div>
                        ) : broadcasts.length === 0 ? (
                            <div className="rounded-[24px] border border-dashed border-zinc-200 bg-zinc-50 px-4 py-12 text-center text-sm text-zinc-500">
                                No broadcasts yet.
                            </div>
                        ) : (
                            <>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3">
                                        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">Archive</div>
                                        <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">{broadcasts.length}</div>
                                        <p className="mt-1 text-xs text-zinc-500">Loaded announcements</p>
                                    </div>
                                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3">
                                        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">Audience</div>
                                        <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
                                            {filterAudience === "all" ? "All" : getAudienceLabel(filterAudience)}
                                        </div>
                                        <p className="mt-1 text-xs text-zinc-500">Current delivery audience</p>
                                    </div>
                                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3">
                                        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">Reach</div>
                                        <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
                                            {searchedBroadcasts.reduce((sum, item) => sum + item.recipientCount, 0)}
                                        </div>
                                        <p className="mt-1 text-xs text-zinc-500">Visible recipients in this view</p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50/80 px-3 py-3 text-xs text-zinc-500">
                                    <span className="rounded-full border border-zinc-200 bg-white px-3 py-1">Showing {visibleBroadcasts.length} of {searchedBroadcasts.length} announcements</span>
                                    <span className="rounded-full border border-zinc-200 bg-white px-3 py-1">
                                        {hiddenBroadcastCount > 0 ? `${hiddenBroadcastCount} hidden by display cap` : "No hidden announcements"}
                                    </span>
                                    <span className="rounded-full border border-zinc-200 bg-white px-3 py-1">{currentBuildingLabel}</span>
                                </div>

                                {searchedBroadcasts.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-sm text-zinc-500">
                                        No announcements match this search.
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {groupedVisibleBroadcasts.map((group) => (
                                            <div key={group.key} className="space-y-2">
                                                <div className="flex items-center justify-between gap-3 px-1">
                                                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">{group.label}</div>
                                                    <div className="text-xs text-zinc-400">{group.items.length} announcement{group.items.length === 1 ? "" : "s"}</div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    {group.items.map((broadcast) => {
                                                        const isSelected = broadcast.id === selectedBroadcastId;
                                                        const metadata = getBroadcastMetadata(broadcast);
                                                        return (
                                                            <button
                                                                key={broadcast.id}
                                                                type="button"
                                                                onClick={() => setSelectedBroadcastId(broadcast.id)}
                                                                className={cn(
                                                                    "flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition",
                                                                    isSelected
                                                                        ? "border-emerald-200 bg-emerald-50/60 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                                                                        : "border-zinc-200/80 hover:border-zinc-300 hover:bg-zinc-50"
                                                                )}
                                                            >
                                                                <div className={cn(
                                                                    "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
                                                                    isSelected ? "border-emerald-200 bg-white text-emerald-700" : "border-zinc-200 bg-white text-zinc-500"
                                                                )}>
                                                                    <Megaphone className="h-4 w-4" />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-start justify-between gap-3">
                                                                        <div className="min-w-0">
                                                                            <div className="flex items-center gap-2">
                                                                                <p className="truncate text-sm font-semibold text-zinc-950">{broadcast.title}</p>
                                                                                <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                                                                                    Sent
                                                                                </span>
                                                                            </div>
                                                                            <p className="mt-1 truncate text-xs text-zinc-500">
                                                                                {getBroadcastBodyPreview(broadcast.body) || "No body content."}
                                                                            </p>
                                                                        </div>
                                                                        <div className="shrink-0 text-right">
                                                                            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">
                                                                                {formatBroadcastListDate(broadcast.createdAt)}
                                                                            </div>
                                                                            <div className="mt-1 text-xs text-zinc-500">{broadcast.recipientCount} recipients</div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                                                        <Badge
                                                                            variant="secondary"
                                                                            className={cn(
                                                                                "rounded-full px-2.5 py-0.5 text-[11px]",
                                                                                isSelected ? "bg-white text-emerald-700" : "bg-zinc-100 text-zinc-700"
                                                                            )}
                                                                        >
                                                                            {metadata.audienceSummary}
                                                                        </Badge>
                                                                        <Badge
                                                                            variant="secondary"
                                                                            className={cn(
                                                                                "rounded-full px-2.5 py-0.5 text-[11px]",
                                                                                isSelected ? "bg-white text-emerald-700" : "bg-zinc-100 text-zinc-700"
                                                                            )}
                                                                        >
                                                                            {getBroadcastScopeLabel(metadata.scope)}
                                                                        </Badge>
                                                                    </div>
                                                                    <div className="mt-3 grid gap-2 text-xs text-zinc-500 sm:grid-cols-[minmax(0,1fr)_auto]">
                                                                        <div className="truncate">Scope: {getScopeSummary(broadcast, buildingNameById)}</div>
                                                                        <div className="truncate">Sender: {broadcast.sender?.name || broadcast.sender?.email || broadcast.sender?.id || "-"}</div>
                                                                    </div>
                                                                </div>
                                                                <ChevronRight className={cn("mt-1 h-4 w-4 shrink-0 text-zinc-300", isSelected && "text-emerald-600")} />
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {nextCursor ? (
                                    <div className="flex justify-center">
                                        <Button variant="outline" className="rounded-xl bg-white" onClick={handleLoadMore} disabled={isLoadingMore}>
                                            {isLoadingMore ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                                                </>
                                            ) : (
                                                "Load more"
                                            )}
                                        </Button>
                                    </div>
                                ) : null}
                            </>
                        )}
                    </CardContent>
                </Card>
                <Card className="overflow-hidden rounded-[24px] border-zinc-200 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                    <CardHeader className="border-b border-zinc-100 bg-zinc-50/70">
                        <CardTitle className="text-base text-zinc-950">Announcement detail</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                        {!selectedBroadcastId ? (
                            <div className="rounded-[24px] border border-dashed border-zinc-200 bg-zinc-50 px-4 py-14 text-center text-sm text-zinc-500">
                                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white shadow-sm">
                                    <Inbox className="h-5 w-5 text-zinc-300" />
                                </div>
                                Select an announcement to inspect delivery details.
                            </div>
                        ) : detailQuery.isLoading ? (
                            <div className="flex items-center justify-center py-12 text-sm text-zinc-500">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Loading announcement...
                            </div>
                        ) : detailQuery.isError ? (
                            <div className="rounded-[24px] border border-dashed border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
                                Announcement not found or not visible to this user.
                            </div>
                        ) : selectedBroadcast ? (
                            <>
                                <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-5">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div>
                                            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-500">
                                                <Megaphone className="h-3.5 w-3.5 text-emerald-600" />
                                                {selectedBroadcastMetadata?.audienceSummary} • {selectedBroadcastMetadata ? getBroadcastScopeLabel(selectedBroadcastMetadata.scope) : ""}
                                            </div>
                                            <p className="text-lg font-semibold tracking-tight text-zinc-950">
                                                {selectedBroadcast.title || "Broadcast"}
                                            </p>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                <Badge variant="secondary" className="rounded-full bg-white text-zinc-700">
                                                    {selectedBroadcastMetadata?.audienceSummary}
                                                </Badge>
                                                <Badge variant="secondary" className="rounded-full bg-white text-zinc-700">
                                                    {selectedBroadcastMetadata ? getBroadcastScopeLabel(selectedBroadcastMetadata.scope) : ""}
                                                </Badge>
                                                <Badge variant="secondary" className="rounded-full bg-white text-zinc-700">
                                                    {selectedBroadcastMetadata?.buildingCount} building{selectedBroadcastMetadata?.buildingCount === 1 ? "" : "s"}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-500 shadow-sm">
                                            {selectedBroadcast.recipientCount} {selectedBroadcast.recipientCount === 1 ? "recipient" : "recipients"}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                                        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">Scope</div>
                                        <p className="mt-2 text-sm font-medium text-zinc-950">
                                            {getScopeSummary(selectedBroadcast, buildingNameById)}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                                        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">Sent</div>
                                        <p className="mt-2 text-sm font-medium text-zinc-950">{formatBroadcastDate(selectedBroadcast.createdAt)}</p>
                                    </div>
                                    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                                        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">Sender</div>
                                        <p className="mt-2 text-sm font-medium text-zinc-950">
                                            {selectedBroadcast.sender?.name || selectedBroadcast.sender?.email || selectedBroadcast.sender?.id || "-"}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                                        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">Audience</div>
                                        <p className="mt-2 text-sm font-medium text-zinc-950">{getAudienceSummary(selectedBroadcast)}</p>
                                    </div>
                                    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                                        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">Coverage</div>
                                        <p className="mt-2 text-sm font-medium text-zinc-950">
                                            {selectedBroadcastMetadata?.buildingCount} building{selectedBroadcastMetadata?.buildingCount === 1 ? "" : "s"}
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-[24px] border border-zinc-200 bg-white p-5">
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 className="text-sm font-semibold text-zinc-950">Message body</h3>
                                        <span className="text-xs text-zinc-400">Read-only archive entry</span>
                                    </div>
                                    <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
                                        {selectedBroadcast.body ? (
                                            <p className="whitespace-pre-line text-sm leading-6 text-zinc-700">{selectedBroadcast.body}</p>
                                        ) : (
                                            <p className="text-sm text-zinc-500">No body content was provided for this broadcast.</p>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="rounded-[24px] border border-dashed border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
                                Broadcast not available.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isComposerOpen} onOpenChange={setIsComposerOpen}>
                <DialogContent className="w-[96vw] max-w-[96vw] overflow-hidden p-0 sm:max-w-5xl">
                    <DialogHeader className="border-b border-zinc-100 bg-zinc-50/70 px-6 py-5 text-left">
                        <DialogTitle className="flex items-center gap-2 text-base text-zinc-950">
                            <Sparkles className="h-4 w-4 text-emerald-600" />
                            New broadcast
                        </DialogTitle>
                        <DialogDescription className="text-sm text-zinc-500">
                            Draft one announcement, confirm the delivery scope, and send from a cleaner composer.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex max-h-[85vh] flex-col">
                        <div className="flex-1 overflow-x-hidden overflow-y-auto bg-zinc-50/40 px-6 py-6">
                            {!canWrite ? (
                                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-sm text-zinc-500">
                                    You do not have permission to send broadcasts.
                                </div>
                            ) : (
                                <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                                    <div className="space-y-5">
                                        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <h3 className="text-sm font-semibold text-zinc-950">Templates</h3>
                                                    <p className="mt-1 text-xs text-zinc-400">
                                                        Prefill a proven structure, then edit anything before you send.
                                                    </p>
                                                </div>
                                                {selectedTemplateId ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedTemplateId("")}
                                                        className="text-xs font-medium text-zinc-500 transition hover:text-zinc-900"
                                                    >
                                                        Clear template
                                                    </button>
                                                ) : null}
                                            </div>
                                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                                                {BROADCAST_TEMPLATES.map((template) => {
                                                    const isSelected = selectedTemplateId === template.id;
                                                    return (
                                                        <button
                                                            key={template.id}
                                                            type="button"
                                                            onClick={() => applyTemplate(template)}
                                                            className={cn(
                                                                "rounded-2xl border p-4 text-left transition",
                                                                isSelected
                                                                    ? "border-zinc-900 bg-white shadow-sm"
                                                                    : "border-zinc-200 bg-white/80 hover:border-zinc-300 hover:bg-white"
                                                            )}
                                                        >
                                                            <div className="flex items-center justify-between gap-3">
                                                                <span className="text-sm font-semibold text-zinc-900">{template.label}</span>
                                                                <Badge variant="secondary" className={isSelected ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}>
                                                                    Use
                                                                </Badge>
                                                            </div>
                                                            <p className="mt-2 text-xs text-zinc-500">{template.note}</p>
                                                            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-zinc-400">
                                                                Default audience: {template.audiences.includes("all_users") ? "All users" : template.audiences.map(getAudienceLabel).join(", ")}
                                                            </p>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Title</label>
                                                    <Input
                                                        value={title}
                                                        onChange={(event) => {
                                                            setTitle(event.target.value);
                                                            if (selectedTemplateId) setSelectedTemplateId("");
                                                        }}
                                                        maxLength={MAX_TITLE}
                                                        placeholder="Building maintenance notice"
                                                    />
                                                    <p className="text-xs text-zinc-400">{title.length}/{MAX_TITLE}</p>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Body</label>
                                                        <span className="text-xs text-zinc-400">{body.length}/{MAX_BODY}</span>
                                                    </div>
                                                    <Textarea
                                                        value={body}
                                                        onChange={(event) => {
                                                            setBody(event.target.value);
                                                            if (selectedTemplateId) setSelectedTemplateId("");
                                                        }}
                                                        maxLength={MAX_BODY}
                                                        rows={10}
                                                        placeholder="Add details residents should know..."
                                                        className="min-h-40"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-5">
                                        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
                                            <h3 className="text-sm font-semibold text-zinc-950">Scope</h3>
                                            <p className="mt-1 text-xs text-zinc-400">Choose whether this announcement reaches all accessible buildings or only selected ones.</p>
                                            <div className="mt-4 space-y-3">
                                                <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                                                    <Checkbox
                                                        id="broadcast-all"
                                                        checked={sendToAll}
                                                        onCheckedChange={(checked) => {
                                                            setSendToAll(Boolean(checked));
                                                            if (checked) {
                                                                setSelectedBuildingIds([]);
                                                            }
                                                        }}
                                                    />
                                                    <label htmlFor="broadcast-all">All accessible buildings</label>
                                                </div>
                                                {!sendToAll ? (
                                                    <div className="space-y-2 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3">
                                                        {buildingOptions.length === 0 ? (
                                                            <p className="text-xs text-zinc-500">No buildings available.</p>
                                                        ) : (
                                                            buildingOptions.map((building) => (
                                                                <div key={building.id} className="flex items-center gap-2">
                                                                    <Checkbox
                                                                        id={`building-${building.id}`}
                                                                        checked={selectedBuildingIds.includes(building.id)}
                                                                        onCheckedChange={() => toggleBuilding(building.id)}
                                                                    />
                                                                    <label htmlFor={`building-${building.id}`} className="text-sm text-zinc-700">
                                                                        {building.name}
                                                                    </label>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-zinc-400">
                                                        {isBuildingScopedBroadcastOnly
                                                            ? "Broadcast will reach the buildings available through your assignments."
                                                            : "Broadcast will reach all buildings you can access."}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
                                            <h3 className="text-sm font-semibold text-zinc-950">Audience</h3>
                                            <p className="mt-1 text-xs text-zinc-400">Treat audience as a first-class delivery choice before you send.</p>
                                            <div className="mt-4 space-y-2 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3">
                                                {AUDIENCE_OPTIONS.map((audience) => {
                                                    const isAllUsers = audience.value === "all_users";
                                                    const allUsersSelected = selectedAudiences.includes("all_users");
                                                    const isChecked = selectedAudiences.includes(audience.value);
                                                    const isDisabled = !isAllUsers && allUsersSelected;
                                                    return (
                                                        <div key={audience.value} className="flex items-start gap-3">
                                                            <Checkbox
                                                                id={`audience-${audience.value}`}
                                                                checked={isChecked}
                                                                disabled={isDisabled}
                                                                onCheckedChange={() => handleToggleAudience(audience.value)}
                                                            />
                                                            <label htmlFor={`audience-${audience.value}`} className="text-sm text-zinc-700">
                                                                <span className="font-medium">{audience.label}</span>
                                                                <span className="mt-0.5 block text-xs text-zinc-400">{audience.description}</span>
                                                            </label>
                                                        </div>
                                                    );
                                                })}
                                                {selectedAudiences.length === 0 ? (
                                                    <p className="text-xs text-zinc-400">No audience selected. Defaults to tenants.</p>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="rounded-[24px] border border-zinc-200 bg-zinc-950 p-5 text-white shadow-sm">
                                            <div className="flex items-center gap-2 text-sm font-semibold">
                                                <Send className="h-4 w-4" />
                                                Delivery preview
                                            </div>
                                            <div className="mt-4 space-y-4">
                                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                                    <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">Title</div>
                                                    <p className="mt-2 text-sm font-medium text-white">{title.trim() || "Untitled broadcast"}</p>
                                                </div>
                                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                                        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">Scope</div>
                                                        <p className="mt-2 text-sm text-zinc-100">{composerScopeLabel}</p>
                                                    </div>
                                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                                        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">Audience</div>
                                                        <p className="mt-2 text-sm text-zinc-100">{composerAudienceSummary}</p>
                                                    </div>
                                                </div>
                                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">Body preview</div>
                                                        {selectedTemplate ? (
                                                            <Badge variant="secondary" className="bg-white text-zinc-900">
                                                                {selectedTemplate.label}
                                                            </Badge>
                                                        ) : null}
                                                    </div>
                                                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-zinc-100">
                                                        {body.trim() || "Add broadcast details to preview the final message."}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="border-t border-zinc-100 bg-white px-6 py-4">
                            <div className="flex items-center justify-end gap-3">
                                <Button variant="outline" className="rounded-xl" onClick={() => setIsComposerOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleCreateBroadcast}
                                    disabled={!canWrite || createBroadcastMutation.isPending}
                                    className="h-11 rounded-xl bg-zinc-900 px-5 text-white hover:bg-zinc-800"
                                >
                                    {createBroadcastMutation.isPending ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="mr-2 h-4 w-4" /> Send broadcast
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function formatBuildingsForBroadcast(broadcast: Broadcast, buildingNameById: Record<string, string>) {
    const metadata = getBroadcastMetadata(broadcast);
    if (metadata.scope === "org_wide") {
        return "Org-wide";
    }
    if (!broadcast.buildingIds || broadcast.buildingIds.length === 0) {
        return metadata.buildingCount > 0
            ? `${metadata.buildingCount} building${metadata.buildingCount === 1 ? "" : "s"}`
            : "Recipients";
    }
    return broadcast.buildingIds
        .map((id) => buildingNameById[id] ?? id)
        .join(", ");
}
