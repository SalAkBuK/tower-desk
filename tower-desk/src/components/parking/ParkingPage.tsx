"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, ParkingSquare, Search, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import {
    useAdminBuildings,
    useManagerBuildings,
    useBuildingUnits,
    useBuildingOccupancies,
    useParkingSlots,
    useUpdateParkingSlot,
} from "@/lib/queries";
import { getOccupancyParkingAllocations } from "@/lib/api";
import type { BuildingOccupancy, ParkingAllocation, ParkingSlot } from "@/lib/types";
import { AllocateParkingDialog } from "./AllocateParkingDialog";
import { CreateParkingSlotSheet } from "./CreateParkingSlotSheet";
import { ManageAllocationsDialog } from "./ManageAllocationsDialog";
import { ParkingGroupList } from "./ParkingGroupList";
import type { ParkingGroupDetailsData, ParkingGroupMode, ParkingGroupSummary, ParkingGroupSlotEntry } from "./parkingGroups.types";

const SEARCH_DEBOUNCE_MS = 300;
const ALLOCATION_CONCURRENCY = 4;

export function ParkingPage({ title = "Parking Management" }: { title?: string }) {
    const { user, baseRole } = useAuth();
    const isManager = baseRole === "manager";
    const adminBuildingsQuery = useAdminBuildings(isManager ? undefined : user?.id);
    const managerBuildingsQuery = useManagerBuildings(isManager ? user?.id : undefined);
    const buildings = isManager ? managerBuildingsQuery.data : adminBuildingsQuery.data;

    const router = useRouter();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();

    const [selectedBuildingId, setSelectedBuildingId] = useState("");
    const [groupMode, setGroupMode] = useState<ParkingGroupMode>("unit");
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [showCreateSheet, setShowCreateSheet] = useState(false);
    const [editSlot, setEditSlot] = useState<ParkingSlot | null>(null);
    const [allocateSlotId, setAllocateSlotId] = useState<string | null>(null);
    const [isAllocateOpen, setIsAllocateOpen] = useState(false);
    const [manageAllocations, setManageAllocations] = useState<{ occupancyId: string; label?: string } | null>(null);

    const buildingOptions = useMemo(
        () => (buildings || []).map((building) => ({ id: building.id, name: building.name })),
        [buildings]
    );

    useEffect(() => {
        if (selectedBuildingId || buildingOptions.length === 0) return;
        setSelectedBuildingId(buildingOptions[0].id);
    }, [buildingOptions, selectedBuildingId]);

    useEffect(() => {
        const urlMode = searchParams.get("groupBy");
        const storedMode = typeof window !== "undefined" ? window.localStorage.getItem("parkingGroupBy") : null;
        const nextMode = urlMode === "resident" || urlMode === "unit"
            ? urlMode
            : storedMode === "resident"
                ? "resident"
                : "unit";
        setGroupMode((prev) => (prev === nextMode ? prev : (nextMode as ParkingGroupMode)));
    }, [searchParams]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem("parkingGroupBy", groupMode);
        const params = new URLSearchParams(searchParams.toString());
        if (params.get("groupBy") !== groupMode) {
            params.set("groupBy", groupMode);
            router.replace(`?${params.toString()}`);
        }
    }, [groupMode, router, searchParams]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setDebouncedSearch(search.trim());
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timeout);
    }, [search]);

    useEffect(() => {
        setExpandedIds(new Set());
    }, [groupMode, selectedBuildingId]);

    const { data: parkingSlots } = useParkingSlots(selectedBuildingId, { enabled: Boolean(selectedBuildingId) });
    const { data: availableSlots } = useParkingSlots(selectedBuildingId, { available: true, enabled: Boolean(selectedBuildingId) });
    const { data: units } = useBuildingUnits(selectedBuildingId, { enabled: Boolean(selectedBuildingId) });
    const { data: occupancies } = useBuildingOccupancies(selectedBuildingId, { enabled: Boolean(selectedBuildingId) });

    const updateSlotMutation = useUpdateParkingSlot();

    const stats = useMemo(() => {
        const all = parkingSlots || [];
        const available = availableSlots || [];
        return {
            total: all.length,
            available: available.length,
            occupied: all.length - available.length,
        };
    }, [parkingSlots, availableSlots]);

    const slotById = useMemo(() => {
        return new Map((parkingSlots || []).map((slot) => [slot.id, slot]));
    }, [parkingSlots]);

    const unitById = useMemo(() => {
        return new Map((units || []).map((unit) => [unit.id, unit]));
    }, [units]);

    const occupancyById = useMemo(() => {
        return new Map((occupancies || []).map((occupancy) => [occupancy.id, occupancy]));
    }, [occupancies]);

    const activeOccupancies = useMemo(() => {
        return (occupancies || []).filter((occ) => occ.status === "ACTIVE" || !occ.endAt);
    }, [occupancies]);

    const activeOccupanciesByUnitId = useMemo(() => {
        const map = new Map<string, BuildingOccupancy[]>();
        activeOccupancies.forEach((occ) => {
            if (!occ.unitId) return;
            const list = map.get(occ.unitId) ?? [];
            list.push(occ);
            map.set(occ.unitId, list);
        });
        return map;
    }, [activeOccupancies]);

    const fetchAllocationsForOccupancies = useCallback(
        async (occupancyIds: string[]) => {
            const allocationsByOccupancy = new Map<string, ParkingAllocation[]>();
            const missing: string[] = [];

            occupancyIds.forEach((occupancyId) => {
                const cached = queryClient.getQueryData([
                    "occupancy-parking-allocations",
                    occupancyId,
                    true,
                ]) as ParkingAllocation[] | undefined;
                if (cached) {
                    allocationsByOccupancy.set(occupancyId, cached);
                } else {
                    missing.push(occupancyId);
                }
            });

            for (let i = 0; i < missing.length; i += ALLOCATION_CONCURRENCY) {
                const chunk = missing.slice(i, i + ALLOCATION_CONCURRENCY);
                const chunkResults = await Promise.all(
                    chunk.map((occupancyId) => getOccupancyParkingAllocations(occupancyId, { active: true }))
                );
                chunk.forEach((occupancyId, index) => {
                    const list = chunkResults[index] ?? [];
                    allocationsByOccupancy.set(occupancyId, list);
                    queryClient.setQueryData([
                        "occupancy-parking-allocations",
                        occupancyId,
                        true,
                    ], list);
                });
            }

            return allocationsByOccupancy;
        },
        [queryClient]
    );

    // NOTE: Fallback summary builder aggregates occupancy allocations client-side.
    // Replace with a server-backed /parking/groups endpoint when available for large buildings.
    const groupSummariesQuery = useQuery({
        queryKey: [
            "parking-group-summaries",
            selectedBuildingId,
            groupMode,
            debouncedSearch,
            units?.length ?? 0,
            activeOccupancies.length,
        ],
        queryFn: async (): Promise<ParkingGroupSummary[]> => {
            if (!selectedBuildingId || !units) return [];
            const occupancyIds = activeOccupancies.map((occ) => occ.id).filter(Boolean);
            const allocationsByOccupancy = await fetchAllocationsForOccupancies(occupancyIds);
            const searchTerm = debouncedSearch.trim().toLowerCase();

            if (groupMode === "unit") {
                return units
                    .map((unit) => {
                        const unitOccupancies = activeOccupanciesByUnitId.get(unit.id) ?? [];
                        const allocatedSlotsCount = unitOccupancies.reduce((sum, occ) => {
                            const list = allocationsByOccupancy.get(occ.id) ?? [];
                            return sum + list.length;
                        }, 0);

                        const residentMatches = unitOccupancies.some((occ) => {
                            const residentLabel = `${occ.residentName ?? ""} ${occ.residentEmail ?? ""}`.toLowerCase();
                            return searchTerm && residentLabel.includes(searchTerm);
                        });

                        const slotMatches = unitOccupancies.some((occ) => {
                            const list = allocationsByOccupancy.get(occ.id) ?? [];
                            return list.some((allocation) =>
                                String(allocation.slot?.code ?? allocation.parkingSlotId ?? "")
                                    .toLowerCase()
                                    .includes(searchTerm)
                            );
                        });

                        const labelMatches = unit.label?.toLowerCase().includes(searchTerm);
                        const matchesSearch = !searchTerm || labelMatches || residentMatches || slotMatches;

                        return {
                            id: unit.id,
                            label: unit.label,
                            allocatedSlotsCount,
                            residentsCount: unitOccupancies.length,
                            isVacant: unitOccupancies.length === 0,
                            matchesSearch,
                        } as ParkingGroupSummary & { matchesSearch: boolean };
                    })
                    .filter((summary) => summary.matchesSearch)
                    .map(({ matchesSearch, ...summary }) => summary);
            }

            return activeOccupancies
                .map((occ) => {
                    const allocations = allocationsByOccupancy.get(occ.id) ?? [];
                    const unitLabel = occ.unitId ? unitById.get(occ.unitId)?.label : "";
                    const label = occ.residentName || occ.residentEmail || "Resident";
                    const labelMatches = label.toLowerCase().includes(searchTerm);
                    const unitMatches = unitLabel?.toLowerCase().includes(searchTerm);
                    const slotMatches = allocations.some((allocation) =>
                        String(allocation.slot?.code ?? allocation.parkingSlotId ?? "")
                            .toLowerCase()
                            .includes(searchTerm)
                    );
                    const matchesSearch = !searchTerm || labelMatches || unitMatches || slotMatches;

                    return {
                        id: occ.id,
                        label,
                        allocatedSlotsCount: allocations.length,
                        unitsCount: occ.unitId ? 1 : 0,
                        matchesSearch,
                    } as ParkingGroupSummary & { matchesSearch: boolean };
                })
                .filter((summary) => summary.matchesSearch)
                .map(({ matchesSearch, ...summary }) => summary);
        },
        enabled: Boolean(selectedBuildingId && units && occupancies),
        staleTime: 60_000,
    });

    const groupSummaries = groupSummariesQuery.data || [];

    const fetchGroupDetails = useCallback(
        async (groupId: string): Promise<ParkingGroupDetailsData> => {
            if (groupMode === "unit") {
                const unitOccupancies = activeOccupanciesByUnitId.get(groupId) ?? [];
                const occupancyIds = unitOccupancies.map((occ) => occ.id).filter(Boolean);
                const allocationsByOccupancy = await fetchAllocationsForOccupancies(occupancyIds);
                const slots: ParkingGroupSlotEntry[] = [];

                allocationsByOccupancy.forEach((allocations, occupancyId) => {
                    const occupancy = occupancyById.get(occupancyId);
                    allocations.forEach((allocation) => {
                        slots.push({ allocation, occupancy });
                    });
                });

                return {
                    id: groupId,
                    mode: groupMode,
                    residents: unitOccupancies,
                    slots,
                };
            }

            const occupancy = occupancyById.get(groupId);
            const allocationsByOccupancy = await fetchAllocationsForOccupancies([groupId]);
            const allocations = allocationsByOccupancy.get(groupId) ?? [];
            const unitLabel = occupancy?.unitId
                ? (unitById.get(occupancy.unitId)?.label ?? "Unknown unit")
                : "Unknown unit";

            return {
                id: groupId,
                mode: groupMode,
                occupancy,
                units: [
                    {
                        unitId: occupancy?.unitId,
                        unitLabel,
                        slots: allocations.map((allocation) => ({ allocation, occupancy })),
                    },
                ],
            };
        },
        [
            activeOccupanciesByUnitId,
            fetchAllocationsForOccupancies,
            groupMode,
            occupancyById,
            unitById,
        ]
    );

    const expandedGroupIds = useMemo(() => Array.from(expandedIds), [expandedIds]);

    const detailQueries = useQueries({
        queries: expandedGroupIds.map((groupId) => ({
            queryKey: ["parking-group-details", selectedBuildingId, groupMode, groupId],
            queryFn: () => fetchGroupDetails(groupId),
            enabled: Boolean(selectedBuildingId),
            staleTime: 60_000,
        })),
    });

    const detailQueryMap = useMemo(() => {
        const map = new Map<string, { data?: ParkingGroupDetailsData; isLoading: boolean; error?: Error | null; refetch: () => void }>();
        expandedGroupIds.forEach((groupId, index) => {
            const query = detailQueries[index];
            map.set(groupId, {
                data: query.data,
                isLoading: query.isLoading,
                error: query.error as Error | null,
                refetch: query.refetch,
            });
        });
        return map;
    }, [detailQueries, expandedGroupIds]);

    const handleToggleActive = async (slot: ParkingSlot) => {
        if (!selectedBuildingId) return;
        try {
            await updateSlotMutation.mutateAsync({
                slotId: slot.id,
                buildingId: selectedBuildingId,
                data: { isActive: !slot.isActive },
            });
            toast.success(slot.isActive ? "Slot deactivated" : "Slot activated");
        } catch (error: any) {
            toast.error(error.message || "Failed to update slot");
        }
    };

    const toggleGroup = (groupId: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(groupId)) {
                next.delete(groupId);
            } else {
                next.add(groupId);
            }
            return next;
        });
    };

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{title}</h1>
                        <p className="mt-1 text-sm text-zinc-500">Manage parking allocations by unit or resident.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId}>
                            <SelectTrigger className="w-60">
                                <SelectValue placeholder="Select building" />
                            </SelectTrigger>
                            <SelectContent>
                                {buildingOptions.map((building) => (
                                    <SelectItem key={building.id} value={building.id}>
                                        {building.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button onClick={() => setShowCreateSheet(true)} disabled={!selectedBuildingId}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Slot
                        </Button>
                    </div>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                            <ParkingSquare className="h-5 w-5" />
                        </div>
                        <div className="mt-3 text-2xl font-bold text-zinc-900">{stats.total}</div>
                        <p className="text-xs text-zinc-500">Total Slots</p>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                            <ParkingSquare className="h-5 w-5" />
                        </div>
                        <div className="mt-3 text-2xl font-bold text-zinc-900">{stats.available}</div>
                        <p className="text-xs text-zinc-500">Available</p>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-700">
                            <ParkingSquare className="h-5 w-5" />
                        </div>
                        <div className="mt-3 text-2xl font-bold text-zinc-900">{stats.occupied}</div>
                        <p className="text-xs text-zinc-500">Occupied</p>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                            <Building2 className="h-5 w-5" />
                        </div>
                        <div className="mt-3 text-2xl font-bold text-zinc-900">{buildingOptions.length}</div>
                        <p className="text-xs text-zinc-500">Buildings</p>
                    </div>
                </div>
            </div>

            <Card className="border-zinc-200">
                <CardHeader className="flex flex-col gap-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle>Grouped Allocations</CardTitle>
                            <p className="text-sm text-zinc-500">Explore parking allocations grouped by unit or resident.</p>
                        </div>
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                            <Input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search unit, resident, or slot"
                                className="pl-9"
                            />
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 rounded-lg border border-zinc-200/50 bg-zinc-100/50 p-1">
                            <Button
                                variant={groupMode === "unit" ? "white" : "ghost"}
                                size="sm"
                                onClick={() => setGroupMode("unit")}
                                className={groupMode === "unit" ? "bg-white shadow-sm" : ""}
                            >
                                Group by Unit
                            </Button>
                            <Button
                                variant={groupMode === "resident" ? "white" : "ghost"}
                                size="sm"
                                onClick={() => setGroupMode("resident")}
                                className={groupMode === "resident" ? "bg-white shadow-sm" : ""}
                            >
                                Group by Resident
                            </Button>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg border border-zinc-200/50 bg-zinc-100/50 px-3 py-1 text-xs text-zinc-500">
                            <Users className="h-3 w-3" />
                            {groupSummaries.length} groups
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {groupSummariesQuery.isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4].map((item) => (
                                <div key={item} className="rounded-xl border border-zinc-200 bg-white p-4">
                                    <Skeleton className="h-5 w-1/3" />
                                    <Skeleton className="mt-2 h-4 w-1/2" />
                                </div>
                            ))}
                        </div>
                    ) : groupSummariesQuery.isError ? (
                        <div className="rounded-xl border border-dashed border-red-200 bg-red-50/60 px-6 py-10 text-center text-sm text-red-700">
                            <div>Failed to load parking groups.</div>
                            <Button
                                size="sm"
                                variant="outline"
                                className="mt-3"
                                onClick={() => groupSummariesQuery.refetch()}
                            >
                                Retry
                            </Button>
                        </div>
                    ) : !selectedBuildingId ? (
                        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-10 text-center text-sm text-zinc-500">
                            Select a building to view parking groups.
                        </div>
                    ) : groupSummaries.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-10 text-center text-sm text-zinc-500">
                            No groups found.
                        </div>
                    ) : (
                        <ParkingGroupList
                            groups={groupSummaries}
                            mode={groupMode}
                            expandedIds={expandedIds}
                            onToggle={toggleGroup}
                            getDetailsState={(groupId) => {
                                const detail = detailQueryMap.get(groupId);
                                return {
                                    data: detail?.data,
                                    isLoading: detail?.isLoading ?? false,
                                    error: detail?.error,
                                    onRetry: () => detail?.refetch(),
                                };
                            }}
                            onAllocate={() => {
                                setAllocateSlotId(null);
                                setIsAllocateOpen(true);
                            }}
                            onEditSlot={(slot) => setEditSlot(slot)}
                            onManageAllocations={(occupancyId, label) => setManageAllocations({ occupancyId, label })}
                            onToggleActive={handleToggleActive}
                            slotById={slotById}
                            isUpdating={updateSlotMutation.isPending}
                        />
                    )}
                </CardContent>
            </Card>

            <CreateParkingSlotSheet
                open={showCreateSheet}
                onOpenChange={setShowCreateSheet}
                buildingId={selectedBuildingId}
            />

            {editSlot ? (
                <CreateParkingSlotSheet
                    open={Boolean(editSlot)}
                    onOpenChange={(open) => !open && setEditSlot(null)}
                    buildingId={selectedBuildingId}
                    mode="edit"
                    slot={editSlot}
                />
            ) : null}

            <AllocateParkingDialog
                open={isAllocateOpen}
                onOpenChange={(open) => {
                    setIsAllocateOpen(open);
                    if (!open) {
                        setAllocateSlotId(null);
                    }
                }}
                buildingId={selectedBuildingId}
                preSelectedSlotId={allocateSlotId ?? undefined}
                occupancies={occupancies || []}
            />

            {manageAllocations ? (
                <ManageAllocationsDialog
                    open={Boolean(manageAllocations)}
                    onOpenChange={(open) => !open && setManageAllocations(null)}
                    buildingId={selectedBuildingId}
                    occupancyId={manageAllocations.occupancyId}
                    occupancyLabel={manageAllocations.label}
                />
            ) : null}
        </div>
    );
}
