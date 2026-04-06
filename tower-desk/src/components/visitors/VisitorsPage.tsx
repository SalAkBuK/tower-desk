"use client";

import { useState, useEffect, useMemo } from "react";
import { Building2, Users, LogIn, LogOut, Clock, Plus, Search } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VisitorsTable } from "./VisitorsTable";
import { CreateVisitorSheet } from "./CreateVisitorSheet";
import { VisitorDetailSheet } from "./VisitorDetailSheet";
import { useAccessibleBuildings, useVisitors, useBuildingUnits } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { getUserPermissionSet, hasAnyPermission } from "@/lib/permissions";
import { getPortalModuleByKey } from "@/lib/portalRegistry";
import { Visitor, VisitorStatus } from "@/lib/types";

export function VisitorsPage() {
    const { user, baseRole, selectedBuildingId, setSelectedBuildingId } = useAuth();
    const permissionSet = getUserPermissionSet(user);
    const visitorsModuleRule = getPortalModuleByKey("visitors")?.rule;
    const canReadVisitors = Boolean(visitorsModuleRule && hasAnyPermission(permissionSet, visitorsModuleRule));
    const accessibleBuildingsQuery = useAccessibleBuildings(user?.id, baseRole, { enabled: canReadVisitors });
    const buildings = accessibleBuildingsQuery.data;
    const isBuildingsLoading = accessibleBuildingsQuery.isLoading;
    const buildingIds = buildings?.map((building) => building.id) || [];

    const { data: visitors, isLoading: isVisitorsLoading } = useVisitors(
        selectedBuildingId || "",
        undefined,
        { enabled: canReadVisitors && !!selectedBuildingId }
    );

    const { data: units } = useBuildingUnits(selectedBuildingId || "", { enabled: canReadVisitors && !!selectedBuildingId });

    const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
    const [createSheetOpen, setCreateSheetOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [selectedUnitId, setSelectedUnitId] = useState<string>("");
    const [selectedDate, setSelectedDate] = useState<string>("");

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

    useEffect(() => {
        const handle = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300);
        return () => clearTimeout(handle);
    }, [search]);

    const formatLocalDate = (value: string | Date) => {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    const filterVisitors = (status: VisitorStatus | "all") => {
        if (!visitors) return [];
        let filtered = status === "all" ? visitors : visitors.filter((v) => v.status === status);

        if (debouncedSearch) {
            filtered = filtered.filter(
                (v) =>
                    v.visitorName?.toLowerCase().includes(debouncedSearch) ||
                    v.phoneNumber?.toLowerCase().includes(debouncedSearch) ||
                    v.vehicleNumber?.toLowerCase().includes(debouncedSearch) ||
                    v.unit?.label?.toLowerCase().includes(debouncedSearch)
            );
        }

        if (selectedUnitId) {
            filtered = filtered.filter((v) => v.unit?.id === selectedUnitId);
        }

        if (selectedDate) {
            filtered = filtered.filter((v) => formatLocalDate(v.createdAt) === selectedDate);
        }

        return [...filtered].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
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

    if (!canReadVisitors) {
        return (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
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
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Visitors</h1>
                        <p className="mt-1 text-sm text-zinc-500">
                            Track and manage visitor access to your building.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white">
                                <Building2 className="h-4 w-4 text-zinc-500" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[11px] uppercase tracking-wide text-zinc-400">
                                    Building
                                </span>
                                <Select
                                    value={selectedBuildingId || ""}
                                    onValueChange={(value) => setSelectedBuildingId(value || null)}
                                >
                                    <SelectTrigger className="h-auto w-[200px] border-none p-0 text-sm font-medium text-zinc-800 shadow-none focus:ring-0">
                                        <SelectValue placeholder="Select building" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {buildings?.map((building) => (
                                            <SelectItem key={building.id} value={building.id}>
                                                {building.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <Button onClick={() => setCreateSheetOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Register Visitor
                        </Button>
                    </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                        {
                            label: "Total Today",
                            value: totalVisitors,
                            icon: Users,
                            color: "bg-blue-50 text-blue-700"
                        },
                        {
                            label: "Expected",
                            value: statusCounts.EXPECTED,
                            icon: Clock,
                            color: "bg-amber-50 text-amber-700"
                        },
                        {
                            label: "Checked In",
                            value: statusCounts.ARRIVED,
                            icon: LogIn,
                            color: "bg-emerald-50 text-emerald-700"
                        },
                        {
                            label: "Checked Out",
                            value: statusCounts.COMPLETED,
                            icon: LogOut,
                            color: "bg-zinc-100 text-zinc-700"
                        }
                    ].map((stat) => (
                        <div key={stat.label} className="rounded-xl border border-zinc-200 bg-white p-4">
                            <div
                                className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}`}
                            >
                                <stat.icon className="h-5 w-5" />
                            </div>
                            <div className="mt-3 text-2xl font-bold text-zinc-900">{stat.value}</div>
                            <p className="text-xs text-zinc-500">{stat.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <Tabs defaultValue="all" className="w-full">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-sm font-semibold text-zinc-900">Visitor Log</h2>
                            <p className="text-xs text-zinc-400">
                                View and manage all visitor records.
                            </p>
                        </div>
                        <TabsList className="rounded-lg bg-zinc-100 p-1">
                            <TabsTrigger value="all">All</TabsTrigger>
                            <TabsTrigger value="EXPECTED">Expected</TabsTrigger>
                            <TabsTrigger value="ARRIVED">Checked In</TabsTrigger>
                            <TabsTrigger value="COMPLETED">Checked Out</TabsTrigger>
                            <TabsTrigger value="CANCELLED">Cancelled</TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                            <Input
                                placeholder="Search visitors..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-[180px]"
                            aria-label="Filter by date"
                        />
                        <Select value={selectedUnitId || "__all__"} onValueChange={(v) => setSelectedUnitId(v === "__all__" ? "" : v)}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="All units" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">All units</SelectItem>
                                {units?.map((unit) => (
                                    <SelectItem key={unit.id} value={unit.id}>
                                        {unit.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {["all", "EXPECTED", "ARRIVED", "COMPLETED", "CANCELLED"].map((tab) => {
                        const filteredVisitors = filterVisitors(tab as VisitorStatus | "all");
                        return (
                            <TabsContent key={tab} value={tab} className="mt-6">
                                <VisitorsTable
                                    visitors={filteredVisitors}
                                    isLoading={isLoading}
                                    onSelect={setSelectedVisitor}
                                />
                            </TabsContent>
                        );
                    })}
                </Tabs>
            </div>

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
