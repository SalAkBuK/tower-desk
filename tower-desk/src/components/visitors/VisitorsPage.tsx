"use client";

import { type ReactNode, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Building2, Users, Plus, Search } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VirtualizedBuildingSelect } from "@/components/buildings/VirtualizedBuildingSelect";
import { VirtualizedUnitSelect } from "@/components/buildings/VirtualizedUnitSelect";
import { VisitorsTable } from "./VisitorsTable";
import { CreateVisitorSheet } from "./CreateVisitorSheet";
import { VisitorDetailSheet } from "./VisitorDetailSheet";
import { useAccessibleBuildings, useVisitors, useBuildingUnits } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { getUserPermissionSet, hasAnyPermission } from "@/lib/permissions";
import { getPortalModuleByKey } from "@/lib/portalRegistry";
import { Visitor, VisitorStatus } from "@/lib/types";

type VisitorFilterValue = "ALL" | VisitorStatus;

const visitorStatusFilterOptions: VisitorFilterValue[] = [
    "ALL",
    "EXPECTED",
    "ARRIVED",
    "COMPLETED",
    "CANCELLED",
];

const visitorStatusFilterLabels: Record<VisitorFilterValue, string> = {
    ALL: "All Visitors",
    EXPECTED: "Expected",
    ARRIVED: "Checked In",
    COMPLETED: "Checked Out",
    CANCELLED: "Cancelled",
};

function FilterField({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <div className="rounded-[22px] border border-zinc-200 bg-white p-3 shadow-xs">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">{label}</div>
            <div className="mt-2">{children}</div>
        </div>
    );
}

export function VisitorsPage() {
    const { user, baseRole, selectedBuildingId, setSelectedBuildingId } = useAuth();
    const permissionSet = getUserPermissionSet(user);
    const visitorsModuleRule = getPortalModuleByKey("visitors")?.rule;
    const canReadVisitors = Boolean(visitorsModuleRule && hasAnyPermission(permissionSet, visitorsModuleRule));
    const accessibleBuildingsQuery = useAccessibleBuildings(user?.id, baseRole, { enabled: canReadVisitors });
    const buildings = accessibleBuildingsQuery.data;
    const isBuildingsLoading = accessibleBuildingsQuery.isLoading;
    const buildingIds = useMemo(() => buildings?.map((building) => building.id) ?? [], [buildings]);

    const { data: visitors, isLoading: isVisitorsLoading } = useVisitors(
        selectedBuildingId || "",
        undefined,
        { enabled: canReadVisitors && !!selectedBuildingId }
    );

    const { data: units, isLoading: isUnitsLoading } = useBuildingUnits(selectedBuildingId || "", { enabled: canReadVisitors && !!selectedBuildingId });

    const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
    const [createSheetOpen, setCreateSheetOpen] = useState(false);
    const [search, setSearch] = useState("");
    const deferredSearch = useDeferredValue(search);
    const normalizedSearch = deferredSearch.trim().toLowerCase();
    const [selectedUnitId, setSelectedUnitId] = useState<string>("");
    const [selectedDate, setSelectedDate] = useState<string>("");
    const [statusFilter, setStatusFilter] = useState<VisitorFilterValue>("ALL");

    const isLoading = isBuildingsLoading || isVisitorsLoading;

    useEffect(() => {
        if (!buildings || buildings.length === 0) {
            if (selectedBuildingId) {
                setSelectedBuildingId(null);
            }
            return;
        }
        if (!selectedBuildingId || !buildingIds.includes(selectedBuildingId)) {
            setSelectedBuildingId(buildingIds[0]);
        }
    }, [buildings, buildingIds, selectedBuildingId, setSelectedBuildingId]);

    const formatLocalDate = (value: string | Date) => {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    const statusCounts = useMemo(() => {
        const counts: Record<VisitorStatus, number> = {
            EXPECTED: 0,
            ARRIVED: 0,
            COMPLETED: 0,
            CANCELLED: 0
        };
        visitors?.forEach((v) => {
            counts[v.status] += 1;
        });
        return counts;
    }, [visitors]);

    const totalVisitors = visitors?.length ?? 0;
    const activeBuildingLabel = useMemo(
        () => buildings?.find((building) => building.id === selectedBuildingId)?.name ?? "Select building",
        [buildings, selectedBuildingId]
    );
    const sortedUnits = useMemo(() => {
        const list = [...(units ?? [])];
        list.sort((left, right) =>
            String(left.label ?? "").localeCompare(String(right.label ?? ""), undefined, {
                numeric: true,
                sensitivity: "base",
            })
        );
        return list;
    }, [units]);

    const selectedUnitLabel = useMemo(
        () => sortedUnits.find((unit) => unit.id === selectedUnitId)?.label ?? "",
        [sortedUnits, selectedUnitId]
    );

    const filteredVisitors = useMemo(() => {
        if (!visitors) return [];

        let filtered = statusFilter === "ALL" ? visitors : visitors.filter((visitor) => visitor.status === statusFilter);

        if (normalizedSearch) {
            filtered = filtered.filter(
                (visitor) =>
                    visitor.visitorName?.toLowerCase().includes(normalizedSearch) ||
                    visitor.phoneNumber?.toLowerCase().includes(normalizedSearch) ||
                    visitor.vehicleNumber?.toLowerCase().includes(normalizedSearch) ||
                    visitor.unit?.label?.toLowerCase().includes(normalizedSearch) ||
                    visitor.tenantName?.toLowerCase().includes(normalizedSearch)
            );
        }

        if (selectedUnitId) {
            filtered = filtered.filter((visitor) => visitor.unit?.id === selectedUnitId);
        }

        if (selectedDate) {
            filtered = filtered.filter((visitor) => formatLocalDate(visitor.createdAt) === selectedDate);
        }

        return [...filtered].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    }, [visitors, statusFilter, normalizedSearch, selectedUnitId, selectedDate]);

    const selectedStatusCount = statusFilter === "ALL" ? totalVisitors : statusCounts[statusFilter];
    const selectedStatusLabel = `${visitorStatusFilterLabels[statusFilter]} (${selectedStatusCount})`;

    if (!canReadVisitors) {
        return (
            <div className="rounded-[30px] border border-zinc-200 bg-white p-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                        <Users className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-zinc-900">Visitors</h1>
                        <p className="text-sm text-zinc-500">You do not have permission to view visitors.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <section className="relative overflow-hidden rounded-[30px] border border-zinc-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.08),_transparent_34%),radial-gradient(circle_at_right_center,_rgba(15,23,42,0.03),_transparent_30%),linear-gradient(180deg,_#ffffff,_rgba(250,250,250,0.98))] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_16px_40px_rgba(0,0,0,0.04)]">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-zinc-950">Visitors</h1>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
                            Track and manage visitor access to your building.
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="rounded-[22px] border border-white/70 bg-white/80 p-3 shadow-sm backdrop-blur">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                                    <Building2 className="h-4 w-4" />
                                </div>
                                <div className="min-w-[190px]">
                                    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">Building</div>
                                    <VirtualizedBuildingSelect
                                        buildings={buildings ?? []}
                                        selectedId={selectedBuildingId || ""}
                                        onSelect={(value) => setSelectedBuildingId(value || null)}
                                        isLoading={isBuildingsLoading}
                                        disabled={!isBuildingsLoading && !buildings?.length}
                                        placeholder="Search building..."
                                        emptyMessage="No accessible buildings."
                                        triggerClassName="h-auto border-none bg-transparent px-0 py-0 text-left text-sm font-semibold text-zinc-900 shadow-none"
                                        searchPlaceholder="Search building, city, status..."
                                    />
                                </div>
                            </div>
                        </div>
                        <Button onClick={() => setCreateSheetOpen(true)} className="h-11 rounded-xl bg-zinc-900 px-4 text-white hover:bg-zinc-800">
                            <Plus className="h-4 w-4 mr-2" />
                            Register Visitor
                        </Button>
                    </div>
                </div>
            </section>

            <section className="rounded-[30px] border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4">
                    <div>
                        <h2 className="text-sm font-semibold text-zinc-950">Filter visitors</h2>
                        <p className="mt-1 text-xs text-zinc-400">
                            Use status, unit, date, or search to find visitor records fast.
                        </p>
                    </div>

                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_minmax(0,1.45fr)]">
                        <FilterField label="Status">
                            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as VisitorFilterValue)}>
                                <SelectTrigger className="h-11 w-full rounded-2xl border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 shadow-none">
                                    <SelectValue placeholder={selectedStatusLabel} />
                                </SelectTrigger>
                                <SelectContent>
                                    {visitorStatusFilterOptions.map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {visitorStatusFilterLabels[option]} ({option === "ALL" ? totalVisitors : statusCounts[option]})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FilterField>

                        <FilterField label="Unit">
                            <div className="space-y-2">
                                <VirtualizedUnitSelect
                                    units={sortedUnits}
                                    selectedId={selectedUnitId}
                                    onSelect={setSelectedUnitId}
                                    isLoading={Boolean(selectedBuildingId) && isUnitsLoading}
                                    disabled={!selectedBuildingId || (!isUnitsLoading && sortedUnits.length === 0)}
                                    placeholder={sortedUnits.length > 0 ? "Search all units..." : "No units available"}
                                    emptyMessage="No units in this building."
                                    triggerClassName="rounded-2xl border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 shadow-none"
                                    searchPlaceholder="Search unit, floor, status..."
                                />
                                {selectedUnitId ? (
                                    <div className="flex justify-end">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setSelectedUnitId("")}
                                            className="h-7 rounded-full px-2 text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                                        >
                                            All units
                                        </Button>
                                    </div>
                                ) : null}
                            </div>
                        </FilterField>

                        <FilterField label="Date">
                            <Input
                                type="date"
                                value={selectedDate}
                                onChange={(event) => setSelectedDate(event.target.value)}
                                className="h-11 rounded-2xl border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 shadow-none"
                                aria-label="Filter by date"
                            />
                        </FilterField>

                        <FilterField label="Search">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                <Input
                                    placeholder="Search visitors, units, phones..."
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    className="h-11 rounded-2xl border-zinc-200 bg-zinc-50 pl-10 text-sm text-zinc-900 shadow-none placeholder:text-zinc-400"
                                />
                            </div>
                        </FilterField>
                    </div>

                    <div className="flex flex-col gap-4 border-t border-zinc-100 pt-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600">
                            <span className="text-zinc-400">Summary</span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5">
                                <span className="text-zinc-500">Total</span>
                                <span className="font-semibold text-zinc-950">{totalVisitors}</span>
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5">
                                <span className="text-amber-700">Expected</span>
                                <span className="font-semibold text-amber-950">{statusCounts.EXPECTED}</span>
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5">
                                <span className="text-emerald-700">Checked In</span>
                                <span className="font-semibold text-emerald-950">{statusCounts.ARRIVED}</span>
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5">
                                <span className="text-zinc-600">Checked Out</span>
                                <span className="font-semibold text-zinc-950">{statusCounts.COMPLETED}</span>
                            </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5">
                                {visitorStatusFilterLabels[statusFilter]}
                            </span>
                            {selectedUnitId ? (
                                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5">
                                    Unit: {selectedUnitLabel || selectedUnitId}
                                </span>
                            ) : null}
                            {selectedDate ? (
                                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5">
                                    Date: {selectedDate}
                                </span>
                            ) : null}
                            {normalizedSearch ? (
                                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5">
                                    Search: {deferredSearch.trim()}
                                </span>
                            ) : null}
                            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5">
                                {activeBuildingLabel}
                            </span>
                            <span className="rounded-full border border-zinc-900 bg-zinc-950 px-3 py-1.5 font-medium text-white">
                                Showing {filteredVisitors.length} visitor{filteredVisitors.length === 1 ? "" : "s"}
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            <section className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
                <div>
                    <h2 className="text-sm font-semibold text-zinc-900">Visitor Log</h2>
                    <p className="text-xs text-zinc-400">
                        View and manage all visitor records.
                    </p>
                </div>
                <div className="mt-6">
                    <VisitorsTable
                        visitors={filteredVisitors}
                        isLoading={isLoading}
                        onSelect={setSelectedVisitor}
                    />
                </div>
            </section>

            <CreateVisitorSheet
                open={createSheetOpen}
                onOpenChange={setCreateSheetOpen}
                buildingId={selectedBuildingId || ""}
            />

            <VisitorDetailSheet
                visitor={selectedVisitor}
                buildingId={selectedBuildingId || ""}
                onClose={() => setSelectedVisitor(null)}
            />
        </div>
    );
}
