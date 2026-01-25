"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Search, LayoutGrid, Home, Plus, Check, List } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { CreateUnitSheet } from "@/components/buildings/CreateUnitSheet";
import { useAuth } from "@/lib/auth";
import {
    useAdminBuildings,
    useManagerBuildings,
    useBuildingUnits,
    useBuildingOccupancies,
    useUnitTypes,
} from "@/lib/queries";
import type { BuildingOccupancy } from "@/lib/types";

export function UnitsPage({
    title = "Units",
    subtitle = "Manage building units and availability.",
    directoryTitle = "Unit Directory",
    directoryDescription = "View and manage units in this building.",
}: {
    title?: string;
    subtitle?: string;
    directoryTitle?: string;
    directoryDescription?: string;
}) {
    const { user, baseRole } = useAuth();
    const isManager = baseRole === "manager";
    const adminBuildingsQuery = useAdminBuildings(isManager ? undefined : user?.id);
    const managerBuildingsQuery = useManagerBuildings(isManager ? user?.id : undefined);
    const buildings = isManager ? managerBuildingsQuery.data : adminBuildingsQuery.data;

    const [selectedBuildingId, setSelectedBuildingId] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
    const [unitFilter, setUnitFilter] = useState<"all" | "vacant" | "occupied">("all");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    const { data: unitTypes } = useUnitTypes();

    const buildingOptions = useMemo(
        () => (buildings || []).map((building) => ({ id: building.id, name: building.name })),
        [buildings]
    );

    useEffect(() => {
        if (selectedBuildingId || buildingOptions.length === 0) return;
        setSelectedBuildingId(buildingOptions[0].id);
    }, [buildingOptions, selectedBuildingId]);

    const { data: units, isLoading } = useBuildingUnits(selectedBuildingId, { enabled: Boolean(selectedBuildingId) });
    const { data: availableUnits } = useBuildingUnits(selectedBuildingId, { available: true, enabled: Boolean(selectedBuildingId) });
    const { data: occupancies } = useBuildingOccupancies(selectedBuildingId, { enabled: Boolean(selectedBuildingId) });
    const availableUnitIds = useMemo(() => new Set((availableUnits || []).map((unit) => unit.id)), [availableUnits]);
    const occupanciesByUnitId = useMemo(() => {
        const map = new Map<string, BuildingOccupancy[]>();
        (occupancies || []).forEach((entry) => {
            const unitId = entry.unitId;
            if (!unitId) return;
            const list = map.get(unitId) ?? [];
            list.push(entry);
            map.set(unitId, list);
        });
        return map;
    }, [occupancies]);

    const filteredUnits = useMemo(() => {
        if (!units) return [];
        if (unitFilter === "all") return units;
        return units.filter((unit) => {
            const isVacant = unit.isAvailable ?? availableUnitIds.has(unit.id);
            return unitFilter === "vacant" ? isVacant : !isVacant;
        });
    }, [units, unitFilter, availableUnitIds]);

    const availableCount = useMemo(() => {
        return (units || []).filter((u) => (u.isAvailable ?? availableUnitIds.has(u.id))).length;
    }, [units, availableUnitIds]);

    const occupiedCount = useMemo(() => {
        return (units || []).filter((u) => !(u.isAvailable ?? availableUnitIds.has(u.id))).length;
    }, [units, availableUnitIds]);

    const getUnitTypeName = (typeId?: string) => {
        if (!typeId || !unitTypes) return "-";
        const type = unitTypes.find((t) => t.id === typeId);
        return type?.name || "-";
    };

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{title}</h1>
                        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
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
                        <Button onClick={() => setIsCreateOpen(true)} disabled={!selectedBuildingId}>
                            <Plus className="mr-2 h-4 w-4" /> Add Unit
                        </Button>
                    </div>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                            <LayoutGrid className="h-5 w-5" />
                        </div>
                        <div className="mt-3 text-2xl font-bold text-zinc-900">{units?.length || 0}</div>
                        <p className="text-xs text-zinc-500">Total Units</p>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                            <Check className="h-5 w-5" />
                        </div>
                        <div className="mt-3 text-2xl font-bold text-zinc-900">{availableCount}</div>
                        <p className="text-xs text-zinc-500">Available</p>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                            <Home className="h-5 w-5" />
                        </div>
                        <div className="mt-3 text-2xl font-bold text-zinc-900">{occupiedCount}</div>
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
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <CardTitle>{directoryTitle}</CardTitle>
                        <p className="text-sm text-zinc-500">{directoryDescription}</p>
                    </div>
                    <div className="flex items-center gap-2 bg-zinc-100/50 p-1 rounded-lg border border-zinc-200/50">
                        <Button
                            variant={unitFilter === "all" ? "white" : "ghost"}
                            size="sm"
                            onClick={() => setUnitFilter("all")}
                            className={unitFilter === "all" ? "bg-white shadow-sm" : ""}
                        >
                            All
                        </Button>
                        <Button
                            variant={unitFilter === "vacant" ? "white" : "ghost"}
                            size="sm"
                            onClick={() => setUnitFilter("vacant")}
                            className={unitFilter === "vacant" ? "bg-white shadow-sm" : ""}
                        >
                            Vacant
                        </Button>
                        <Button
                            variant={unitFilter === "occupied" ? "white" : "ghost"}
                            size="sm"
                            onClick={() => setUnitFilter("occupied")}
                            className={unitFilter === "occupied" ? "bg-white shadow-sm" : ""}
                        >
                            Occupied
                        </Button>
                    </div>
                    <div className="flex items-center gap-2 bg-zinc-100/50 p-1 rounded-lg border border-zinc-200/50">
                        <Button
                            variant={viewMode === "grid" ? "white" : "ghost"}
                            size="sm"
                            onClick={() => setViewMode("grid")}
                            className={viewMode === "grid" ? "bg-white shadow-sm" : ""}
                        >
                            <LayoutGrid className="mr-2 h-4 w-4" />
                            Grid
                        </Button>
                        <Button
                            variant={viewMode === "list" ? "white" : "ghost"}
                            size="sm"
                            onClick={() => setViewMode("list")}
                            className={viewMode === "list" ? "bg-white shadow-sm" : ""}
                        >
                            <List className="mr-2 h-4 w-4" />
                            List
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((item) => (
                                <Skeleton key={item} className="h-32 rounded-xl" />
                            ))}
                        </div>
                    ) : !selectedBuildingId ? (
                        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-10 text-center text-sm text-zinc-500">
                            Select a building to view units.
                        </div>
                    ) : filteredUnits.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-3">
                                <Search className="h-5 w-5 text-zinc-400" />
                            </div>
                            <h3 className="text-sm font-medium text-zinc-900">No units found</h3>
                            <p className="text-xs text-zinc-500 mt-1">Try adjusting the filter or add a new unit</p>
                        </div>
                    ) : viewMode === "grid" ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                            {filteredUnits.map((unit) => {
                                const isVacant = unit.isAvailable ?? availableUnitIds.has(unit.id);
                                const unitOccupancies = occupanciesByUnitId.get(unit.id) ?? [];
                                const residentNames = unitOccupancies
                                    .map((entry) => entry.residentName)
                                    .filter((name): name is string => Boolean(name && name.trim()));
                                const residentPreview = residentNames.slice(0, 2).join(", ");
                                const residentRemainder = residentNames.length > 2 ? ` +${residentNames.length - 2}` : "";
                                return (
                                    <div
                                        key={unit.id}
                                        onClick={() => setEditingUnitId(unit.id)}
                                        className={`
                                            group cursor-pointer rounded-xl border p-4 transition-all hover:shadow-md
                                            ${isVacant
                                                ? "border-emerald-100 bg-emerald-50/30 hover:border-emerald-200"
                                                : "border-zinc-200 bg-white hover:border-blue-200"
                                            }
                                        `}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-semibold text-lg text-zinc-900">{unit.label}</span>
                                            <div className={`h-2 w-2 rounded-full ${isVacant ? "bg-emerald-500" : "bg-blue-500"}`} />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] uppercase font-medium tracking-wider text-zinc-500">
                                                {isVacant ? "Vacant" : "Occupied"}
                                            </p>
                                            {unit.floor ? (
                                                <p className="text-xs text-zinc-500">Floor {unit.floor}</p>
                                            ) : null}
                                            {unit.unitTypeId ? (
                                                <p className="text-xs text-zinc-500">{getUnitTypeName(unit.unitTypeId)}</p>
                                            ) : null}
                                            {residentNames.length > 0 ? (
                                                <p className="text-xs text-zinc-600">
                                                    Residents: {residentPreview}{residentRemainder}
                                                </p>
                                            ) : (
                                                <p className="text-xs text-zinc-400">No resident assigned</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="rounded-lg border border-zinc-200">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Unit</TableHead>
                                        <TableHead>Floor</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Residents</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUnits.map((unit) => {
                                        const isVacant = unit.isAvailable ?? availableUnitIds.has(unit.id);
                                        const unitOccupancies = occupanciesByUnitId.get(unit.id) ?? [];
                                        const residentNames = unitOccupancies
                                            .map((entry) => entry.residentName)
                                            .filter((name): name is string => Boolean(name && name.trim()));
                                        const residentPreview = residentNames.slice(0, 2).join(", ");
                                        const residentRemainder = residentNames.length > 2 ? ` +${residentNames.length - 2}` : "";
                                        return (
                                            <TableRow key={unit.id} className="cursor-pointer" onClick={() => setEditingUnitId(unit.id)}>
                                                <TableCell className="font-medium text-zinc-900">{unit.label}</TableCell>
                                                <TableCell>{unit.floor ?? "-"}</TableCell>
                                                <TableCell>{getUnitTypeName(unit.unitTypeId)}</TableCell>
                                                <TableCell>
                                                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                                        isVacant ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                                                    }`}>
                                                        {isVacant ? "Vacant" : "Occupied"}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-zinc-600">
                                                    {residentNames.length > 0 ? `${residentPreview}${residentRemainder}` : "No resident assigned"}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <CreateUnitSheet
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                buildingId={selectedBuildingId}
                mode="create"
                layout="single"
            />
            <CreateUnitSheet
                open={Boolean(editingUnitId)}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditingUnitId(null);
                    }
                }}
                buildingId={selectedBuildingId}
                mode="edit"
                unitId={editingUnitId}
                layout="single"
            />
        </div>
    );
}
