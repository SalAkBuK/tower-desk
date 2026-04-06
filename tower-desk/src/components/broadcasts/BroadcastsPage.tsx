"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, Megaphone, RefreshCw, Send, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { getBroadcasts } from "@/lib/api/communications";
import { useAccessibleBuildings, useBroadcasts, useCreateBroadcast } from "@/lib/queries";
import type { Broadcast, BroadcastAudience, BroadcastListResponse } from "@/lib/types";
import {
    getBuildingAccessAssignments,
    getOrgAccessAssignments,
    hasPermission as hasRbacPermission,
    isBuildingScopedOnly,
} from "@/lib/rbac";

const MIN_TITLE = 3;
const MAX_TITLE = 200;
const MAX_BODY = 2000;
const PAGE_LIMIT = 20;

const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;

const formatBroadcastDate = (value?: string) =>
    value ? new Date(value).toLocaleString() : "-";

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
    const accessibleBuildingsQuery = useAccessibleBuildings(user?.id, baseRole, { enabled: canUseBroadcasts });
    const buildings = accessibleBuildingsQuery.data;
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

    const [filterBuildingId, setFilterBuildingId] = useState<string>("all");
    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [sendToAll, setSendToAll] = useState(true);
    const [selectedBuildingIds, setSelectedBuildingIds] = useState<string[]>([]);
    const [selectedAudiences, setSelectedAudiences] = useState<BroadcastAudience[]>(["tenants"]);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const queryClient = useQueryClient();
    const listQuery = useBroadcasts({
        limit: PAGE_LIMIT,
        buildingId: filterBuildingId === "all" ? undefined : filterBuildingId,
        enabled: canRead,
    });
    const createBroadcastMutation = useCreateBroadcast();
    const broadcasts = listQuery.data?.items ?? [];
    const nextCursor = listQuery.data?.nextCursor ?? null;

    const audienceOptions: { value: BroadcastAudience; label: string; description: string }[] = [
        { value: "tenants", label: "Tenants", description: "Residents in units and occupancies." },
        { value: "admins", label: "Admins", description: "Organization admins." },
        { value: "staff", label: "Staff", description: "Operational staff accounts." },
        { value: "managers", label: "Managers", description: "Building or operations managers." },
        { value: "building_admins", label: "Building admins", description: "Admins scoped to buildings." },
        { value: "all_users", label: "All users", description: "Everyone in the org." },
    ];

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
            const result = await createBroadcastMutation.mutateAsync({
                title: trimmedTitle,
                body: trimmedBody ? trimmedBody : undefined,
                buildingIds: sendToAll ? undefined : selectedBuildingIds,
                audiences: selectedAudiences.length ? (selectedAudiences.includes("all_users") ? ["all_users"] : selectedAudiences) : undefined,
            });
            toast.success(`Broadcast sent to ${result.recipientCount} recipient(s).`);
            resetForm();
            setIsComposerOpen(false);
            listQuery.refetch();
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

    const formatBuildings = (broadcast: Broadcast) => {
        if (!broadcast.buildingIds || broadcast.buildingIds.length === 0) {
            return "All accessible buildings";
        }
        return broadcast.buildingIds
            .map((id) => buildingNameById[id] ?? id)
            .join(", ");
    };

    const stats = [
        {
            label: "Broadcasts",
            value: broadcasts.length,
            hint: "Visible in this audit view",
            icon: Megaphone,
            tone: "bg-zinc-900 text-white",
        },
        {
            label: "Recipients",
            value: broadcasts.reduce((sum, item) => sum + item.recipientCount, 0),
            hint: "Total reach in current list",
            icon: Users,
            tone: "bg-emerald-50 text-emerald-700",
        },
        {
            label: "Buildings",
            value: buildingOptions.length,
            hint: "Accessible broadcast scope",
            icon: Building2,
            tone: "bg-zinc-100 text-zinc-700",
        },
    ];

    return (
        <div className="space-y-6">
            <section className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03),0_16px_40px_rgba(0,0,0,0.04)]">
                <div className="border-b border-zinc-100 bg-[linear-gradient(180deg,_rgba(250,250,250,0.96),_#ffffff)] px-6 py-6 md:px-8 md:py-8">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl">
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 shadow-sm">
                                <Megaphone className="h-3.5 w-3.5 text-emerald-600" />
                                Broadcast control center
                            </div>
                            <h1 className="text-3xl font-bold tracking-tight text-zinc-950 md:text-4xl">Broadcasts</h1>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 md:text-base">
                                Send resident-wide announcements from a focused composer and review delivery history in a clean audit view.
                            </p>
                            {hasBuildingScopedBroadcastAccess ? (
                                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-zinc-400">
                                    {isBuildingScopedBroadcastOnly
                                        ? "Applies to accessible buildings"
                                        : hasOrgScopedBroadcastAccess
                                            ? "Org and building scopes supported"
                                            : "Broadcast scope available"}
                                </p>
                            ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <Button
                                variant="outline"
                                className="rounded-xl bg-white"
                                onClick={() => listQuery.refetch()}
                                disabled={!canRead || listQuery.isFetching}
                            >
                                {listQuery.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                Refresh
                            </Button>
                            {canWrite ? (
                                <Button
                                    onClick={() => setIsComposerOpen(true)}
                                    className="h-10 rounded-xl bg-zinc-900 px-4 text-white hover:bg-zinc-800"
                                >
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    New broadcast
                                </Button>
                            ) : null}
                        </div>
                    </div>

                    <div className="mt-8 grid gap-4 md:grid-cols-3">
                        {stats.map((stat) => (
                            <div
                                key={stat.label}
                                className="rounded-2xl border border-zinc-200/80 bg-white/90 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
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

            <Card className="overflow-hidden rounded-[24px] border-zinc-200 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <CardHeader className="border-b border-zinc-100 bg-zinc-50/70">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <CardTitle className="text-base text-zinc-950">Broadcast history</CardTitle>
                            <p className="mt-1 text-xs text-zinc-400">Recent announcements across your accessible building scope.</p>
                        </div>
                        <Select value={filterBuildingId} onValueChange={setFilterBuildingId}>
                            <SelectTrigger className="w-full bg-white sm:w-56">
                                <SelectValue placeholder="Filter by building" />
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
                </CardHeader>
                <CardContent className="pt-6">
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
                        <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-12 text-center text-sm text-zinc-500">
                            No broadcasts yet.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="overflow-hidden rounded-2xl border border-zinc-200">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Message</TableHead>
                                            <TableHead>Scope</TableHead>
                                            <TableHead>Audience</TableHead>
                                            <TableHead>Recipients</TableHead>
                                            <TableHead>Sender</TableHead>
                                            <TableHead>Sent</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {broadcasts.map((broadcast) => (
                                            <TableRow key={broadcast.id}>
                                                <TableCell className="align-top">
                                                    <div className="space-y-1.5">
                                                        <p className="text-sm font-semibold text-zinc-950">{broadcast.title}</p>
                                                        {broadcast.body ? (
                                                            <p className="line-clamp-2 text-xs leading-5 text-zinc-500">{broadcast.body}</p>
                                                        ) : (
                                                            <p className="text-xs text-zinc-400">No body content.</p>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-52 text-xs leading-5 text-zinc-600">
                                                    {formatBuildings(broadcast)}
                                                </TableCell>
                                                <TableCell className="text-xs text-zinc-600">
                                                    <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">
                                                        Announcement
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs font-medium text-zinc-700">
                                                    {broadcast.recipientCount}
                                                </TableCell>
                                                <TableCell className="text-xs text-zinc-600">
                                                    {broadcast.sender?.name || broadcast.sender?.email || broadcast.sender?.id || "-"}
                                                </TableCell>
                                                <TableCell className="text-xs text-zinc-500">
                                                    {formatBroadcastDate(broadcast.createdAt)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
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
                        </div>
                    )}
                </CardContent>
            </Card>

            <Sheet open={isComposerOpen} onOpenChange={setIsComposerOpen}>
                <SheetContent side="right" className="w-full gap-0 border-l border-zinc-200 bg-white sm:max-w-xl">
                    <SheetHeader className="border-b border-zinc-100 bg-zinc-50/70 px-6 py-5 text-left">
                        <SheetTitle className="flex items-center gap-2 text-base text-zinc-950">
                            <Sparkles className="h-4 w-4 text-emerald-600" />
                            New broadcast
                        </SheetTitle>
                        <SheetDescription className="text-sm text-zinc-500">
                            Draft one announcement, choose the audience and scope, then send.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="flex-1 overflow-y-auto px-6 py-6">
                        {!canWrite ? (
                            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-sm text-zinc-500">
                                You do not have permission to send broadcasts.
                            </div>
                        ) : (
                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Title</label>
                                    <Input
                                        value={title}
                                        onChange={(event) => setTitle(event.target.value)}
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
                                        onChange={(event) => setBody(event.target.value)}
                                        maxLength={MAX_BODY}
                                        rows={8}
                                        placeholder="Add details residents should know..."
                                        className="min-h-36"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Scope</label>
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
                                        <label htmlFor="broadcast-all">
                                            {isBuildingScopedBroadcastOnly ? "All accessible buildings" : "All accessible buildings"}
                                        </label>
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
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Audience</label>
                                    <div className="space-y-2 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3">
                                        {audienceOptions.map((audience) => {
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
                                <div className="flex items-center justify-end gap-3 border-t border-zinc-100 pt-4">
                                    <Button variant="outline" className="rounded-xl" onClick={() => setIsComposerOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleCreateBroadcast}
                                        disabled={createBroadcastMutation.isPending}
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
                        )}
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
