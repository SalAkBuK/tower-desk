"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Home, Search, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import {
    useAdminBuildings,
    useManagerBuildings,
    useBuildingOccupancies,
    useBuildingResidents,
    useBuildingUnits
} from "@/lib/queries";
import type { BuildingOccupancy } from "@/lib/types";

export function OccupancyPage({ title = "Occupancy" }: { title?: string }) {
    const { user, baseRole } = useAuth();
    const isManager = baseRole === "manager";
    const adminBuildingsQuery = useAdminBuildings(isManager ? undefined : user?.id);
    const managerBuildingsQuery = useManagerBuildings(isManager ? user?.id : undefined);
    const buildings = isManager ? managerBuildingsQuery.data : adminBuildingsQuery.data;

    const [selectedBuildingId, setSelectedBuildingId] = useState("");
    const [search, setSearch] = useState("");

    const buildingOptions = useMemo(
        () => (buildings || []).map((building) => ({ id: building.id, name: building.name })),
        [buildings]
    );

    useEffect(() => {
        if (selectedBuildingId || buildingOptions.length === 0) return;
        setSelectedBuildingId(buildingOptions[0].id);
    }, [buildingOptions, selectedBuildingId]);

    const { data: occupancies, isLoading } = useBuildingOccupancies(selectedBuildingId, { enabled: Boolean(selectedBuildingId) });
    const { data: residents } = useBuildingResidents(selectedBuildingId, { enabled: Boolean(selectedBuildingId) });
    const { data: units } = useBuildingUnits(selectedBuildingId, { enabled: Boolean(selectedBuildingId) });

    const residentById = useMemo(() => {
        const map = new Map<string, { name: string; email: string }>();
        (residents || []).forEach((resident) => {
            map.set(resident.userId, { name: resident.name, email: resident.email });
        });
        return map;
    }, [residents]);

    const unitLabelById = useMemo(() => {
        const map = new Map<string, string>();
        (units || []).forEach((unit) => {
            map.set(unit.id, unit.label);
        });
        return map;
    }, [units]);

    const normalizedOccupancies: BuildingOccupancy[] = useMemo(() => {
        return (occupancies || []).map((entry) => ({
            ...entry,
            unitLabel: entry.unitLabel || unitLabelById.get(entry.unitId),
            residentName: entry.residentName || residentById.get(entry.residentUserId || "")?.name,
            residentEmail: entry.residentEmail || residentById.get(entry.residentUserId || "")?.email,
        }));
    }, [occupancies, unitLabelById, residentById]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return normalizedOccupancies;
        return normalizedOccupancies.filter((entry) => {
            const haystack = `${entry.unitLabel ?? ""} ${entry.residentName ?? ""} ${entry.residentEmail ?? ""}`.toLowerCase();
            return haystack.includes(term);
        });
    }, [normalizedOccupancies, search]);

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{title}</h1>
                        <p className="mt-1 text-sm text-zinc-500">Monitor active unit occupancy across buildings.</p>
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
                    </div>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                            <Home className="h-5 w-5" />
                        </div>
                        <div className="mt-3 text-2xl font-bold text-zinc-900">{filtered.length}</div>
                        <p className="text-xs text-zinc-500">Active Occupancies</p>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                            <Users className="h-5 w-5" />
                        </div>
                        <div className="mt-3 text-2xl font-bold text-zinc-900">{residents?.length || 0}</div>
                        <p className="text-xs text-zinc-500">Residents</p>
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
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle>Occupancy Ledger</CardTitle>
                        <p className="text-sm text-zinc-500">Active resident-to-unit assignments.</p>
                    </div>
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search units or residents"
                            className="pl-9"
                        />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isLoading ? (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {[1, 2, 3, 4, 5, 6].map((item) => (
                                <div key={item} className="rounded-xl border border-zinc-200 bg-white p-4">
                                    <Skeleton className="h-5 w-2/3" />
                                    <Skeleton className="mt-3 h-4 w-1/2" />
                                    <Skeleton className="mt-2 h-4 w-4/5" />
                                </div>
                            ))}
                        </div>
                    ) : !selectedBuildingId ? (
                        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-10 text-center text-sm text-zinc-500">
                            Select a building to view occupancy.
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-10 text-center text-sm text-zinc-500">
                            No active occupancy records.
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {filtered.map((entry) => (
                                <div key={entry.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold text-zinc-900">{entry.unitLabel || "Unit"}</div>
                                            <div className="text-xs text-zinc-500">{entry.residentName || "Unknown resident"}</div>
                                        </div>
                                        <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">
                                            {entry.status || "ACTIVE"}
                                        </Badge>
                                    </div>
                                    <div className="mt-4 space-y-2 text-xs text-zinc-500">
                                        <div className="flex items-center justify-between">
                                            <span>Resident Email</span>
                                            <span className="font-medium text-zinc-700">{entry.residentEmail || "-"}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span>Start</span>
                                            <span className="font-medium text-zinc-700">{entry.startAt ? new Date(entry.startAt).toLocaleDateString() : "-"}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
