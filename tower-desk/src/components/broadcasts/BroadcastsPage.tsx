"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Megaphone, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { getBroadcasts } from "@/lib/api";
import { getUserPermissionSet, hasPermission, hasPermissionPrefix } from "@/lib/permissions";
import { useAdminBuildings, useBroadcasts, useCreateBroadcast, useManagerBuildings } from "@/lib/queries";
import type { Broadcast, BroadcastListResponse } from "@/lib/types";

const MIN_TITLE = 3;
const MAX_TITLE = 200;
const MAX_BODY = 2000;
const PAGE_LIMIT = 20;

export function BroadcastsPage() {
    const { user, baseRole } = useAuth();
    const isManager = baseRole === "manager";
    const adminBuildingsQuery = useAdminBuildings(isManager ? undefined : user?.id);
    const managerBuildingsQuery = useManagerBuildings(isManager ? user?.id : undefined);
    const buildings = isManager ? managerBuildingsQuery.data : adminBuildingsQuery.data;
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

    const permissionSet = useMemo(
        () => getUserPermissionSet(user),
        [user?.effectivePermissions, user?.roleKeys, user?.orgRoleKeys]
    );
    const canRead = hasPermissionPrefix(permissionSet, "broadcasts");
    const canWrite = hasPermission(permissionSet, "broadcasts.write") || hasPermissionPrefix(permissionSet, "broadcasts.write");

    const [filterBuildingId, setFilterBuildingId] = useState<string>("all");
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [sendToAll, setSendToAll] = useState(true);
    const [selectedBuildingIds, setSelectedBuildingIds] = useState<string[]>([]);
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

    const toggleBuilding = (buildingId: string) => {
        setSelectedBuildingIds((prev) =>
            prev.includes(buildingId) ? prev.filter((id) => id !== buildingId) : [...prev, buildingId]
        );
    };

    const resetForm = () => {
        setTitle("");
        setBody("");
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
            });
            toast.success(`Broadcast sent to ${result.recipientCount} recipient(s).`);
            resetForm();
            listQuery.refetch();
        } catch (error: any) {
            toast.error(error?.message || "Failed to send broadcast.");
        }
    };

    const handleLoadMore = async () => {
        if (!nextCursor || isLoadingMore) return;
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
        } catch (error: any) {
            toast.error(error?.message || "Failed to load more broadcasts.");
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

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Broadcasts</h1>
                        <p className="mt-1 text-sm text-zinc-500">Send announcements to residents across your buildings.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => listQuery.refetch()}
                            disabled={!canRead || listQuery.isFetching}
                        >
                            {listQuery.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Refresh
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
                <Card className="border-zinc-200">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base text-zinc-900">
                            <Megaphone className="h-4 w-4 text-zinc-500" />
                            Create broadcast
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {!canWrite ? (
                            <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
                                You do not have permission to send broadcasts.
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Title</label>
                                    <Input
                                        value={title}
                                        onChange={(event) => setTitle(event.target.value)}
                                        maxLength={MAX_TITLE}
                                        placeholder="Building maintenance notice"
                                    />
                                    <p className="text-xs text-zinc-400">{title.length}/{MAX_TITLE}</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Body (optional)</label>
                                    <Textarea
                                        value={body}
                                        onChange={(event) => setBody(event.target.value)}
                                        maxLength={MAX_BODY}
                                        rows={5}
                                        placeholder="Add details residents should know..."
                                    />
                                    <p className="text-xs text-zinc-400">{body.length}/{MAX_BODY}</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Recipients</label>
                                    <div className="flex items-center gap-2">
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
                                        <label htmlFor="broadcast-all" className="text-sm text-zinc-700">
                                            All accessible buildings
                                        </label>
                                    </div>
                                    {!sendToAll ? (
                                        <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
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
                                        <p className="text-xs text-zinc-400">Broadcast will reach all buildings you can access.</p>
                                    )}
                                </div>
                                <Button
                                    onClick={handleCreateBroadcast}
                                    disabled={createBroadcastMutation.isPending}
                                    className="w-full"
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
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-zinc-200">
                    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle className="text-base text-zinc-900">Broadcast history</CardTitle>
                            <p className="text-xs text-zinc-400">Recent announcements sent to residents.</p>
                        </div>
                        <Select value={filterBuildingId} onValueChange={setFilterBuildingId}>
                            <SelectTrigger className="w-56">
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
                    </CardHeader>
                    <CardContent>
                        {!canRead ? (
                            <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
                                You do not have permission to view broadcasts.
                            </div>
                        ) : listQuery.isLoading ? (
                            <div className="flex items-center justify-center py-10 text-sm text-zinc-500">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Loading broadcasts...
                            </div>
                        ) : broadcasts.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
                                No broadcasts yet.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="rounded-lg border border-zinc-200">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Message</TableHead>
                                                <TableHead>Buildings</TableHead>
                                                <TableHead>Recipients</TableHead>
                                                <TableHead>Sender</TableHead>
                                                <TableHead>Sent</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {broadcasts.map((broadcast) => (
                                                <TableRow key={broadcast.id}>
                                                    <TableCell className="align-top">
                                                        <div className="space-y-1">
                                                            <p className="text-sm font-semibold text-zinc-900">{broadcast.title}</p>
                                                            {broadcast.body ? (
                                                                <p className="text-xs text-zinc-500 line-clamp-2">{broadcast.body}</p>
                                                            ) : null}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-zinc-600">
                                                        {formatBuildings(broadcast)}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-zinc-600">
                                                        {broadcast.recipientCount}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-zinc-600">
                                                        {broadcast.sender?.name || broadcast.sender?.email || broadcast.sender?.id || "-"}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-zinc-500">
                                                        {broadcast.createdAt ? new Date(broadcast.createdAt).toLocaleString() : "-"}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                {nextCursor ? (
                                    <div className="flex justify-center">
                                        <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
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
            </div>
        </div>
    );
}
