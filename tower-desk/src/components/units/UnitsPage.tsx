"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Search, LayoutGrid, Home, Plus, Edit, Check, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import {
    useAdminBuildings,
    useManagerBuildings,
    useBuildingUnits,
    useUnitTypes,
    useCreateBuildingUnit,
    useUpdateBuildingUnit,
} from "@/lib/queries";
import type { BuildingUnit, UnitType } from "@/lib/types";

const emptyForm = {
    label: "",
    floor: "",
    notes: "",
    unitTypeId: "",
    isAvailable: true,
};

export function UnitsPage({ title = "Units" }: { title?: string }) {
    const { user, role } = useAuth();
    const isManager = role === "manager";
    const adminBuildingsQuery = useAdminBuildings(isManager ? undefined : user?.id);
    const managerBuildingsQuery = useManagerBuildings(isManager ? user?.id : undefined);
    const buildings = isManager ? managerBuildingsQuery.data : adminBuildingsQuery.data;

    const [selectedBuildingId, setSelectedBuildingId] = useState("");
    const [search, setSearch] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editUnit, setEditUnit] = useState<BuildingUnit | null>(null);
    const [formValues, setFormValues] = useState(emptyForm);

    const { data: unitTypes } = useUnitTypes();
    const createUnitMutation = useCreateBuildingUnit();
    const updateUnitMutation = useUpdateBuildingUnit();

    const buildingOptions = useMemo(
        () => (buildings || []).map((building) => ({ id: building.id, name: building.name })),
        [buildings]
    );

    useEffect(() => {
        if (selectedBuildingId || buildingOptions.length === 0) return;
        setSelectedBuildingId(buildingOptions[0].id);
    }, [buildingOptions, selectedBuildingId]);

    const { data: units, isLoading } = useBuildingUnits(selectedBuildingId, { enabled: Boolean(selectedBuildingId) });

    useEffect(() => {
        if (editUnit) {
            setFormValues({
                label: editUnit.label || "",
                floor: editUnit.floor?.toString() || "",
                notes: editUnit.notes || "",
                unitTypeId: editUnit.unitTypeId || "",
                isAvailable: editUnit.isAvailable ?? true,
            });
        } else {
            setFormValues(emptyForm);
        }
    }, [editUnit]);

    const filteredUnits = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return units || [];
        return (units || []).filter((unit) => {
            const haystack = `${unit.label} ${unit.floor ?? ""} ${unit.notes ?? ""}`.toLowerCase();
            return haystack.includes(term);
        });
    }, [units, search]);

    const availableCount = useMemo(() => {
        return (units || []).filter((u) => u.isAvailable).length;
    }, [units]);

    const occupiedCount = useMemo(() => {
        return (units || []).filter((u) => !u.isAvailable).length;
    }, [units]);

    const handleCreateUnit = async () => {
        if (!selectedBuildingId || !formValues.label.trim()) {
            toast.error("Unit label is required");
            return;
        }
        try {
            await createUnitMutation.mutateAsync({
                buildingId: selectedBuildingId,
                data: {
                    label: formValues.label.trim(),
                    floor: formValues.floor ? parseInt(formValues.floor, 10) : undefined,
                    notes: formValues.notes.trim() || undefined,
                    unitTypeId: formValues.unitTypeId || undefined,
                },
            });
            toast.success("Unit created");
            setIsCreateOpen(false);
            setFormValues(emptyForm);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to create unit";
            toast.error(message);
        }
    };

    const handleUpdateUnit = async () => {
        if (!selectedBuildingId || !editUnit || !formValues.label.trim()) {
            toast.error("Unit label is required");
            return;
        }
        try {
            await updateUnitMutation.mutateAsync({
                buildingId: selectedBuildingId,
                unitId: editUnit.id,
                data: {
                    label: formValues.label.trim(),
                    floor: formValues.floor ? parseInt(formValues.floor, 10) : undefined,
                    notes: formValues.notes.trim() || undefined,
                    unitTypeId: formValues.unitTypeId || undefined,
                },
            });
            toast.success("Unit updated");
            setEditUnit(null);
            setFormValues(emptyForm);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to update unit";
            toast.error(message);
        }
    };

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
                        <p className="mt-1 text-sm text-zinc-500">Manage building units and availability.</p>
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
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle>Unit Directory</CardTitle>
                        <p className="text-sm text-zinc-500">View and manage units in this building.</p>
                    </div>
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search units"
                            className="pl-9"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4, 5].map((item) => (
                                <Skeleton key={item} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : !selectedBuildingId ? (
                        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-10 text-center text-sm text-zinc-500">
                            Select a building to view units.
                        </div>
                    ) : filteredUnits.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-10 text-center text-sm text-zinc-500">
                            No units found for this building.
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
                                        <TableHead>Notes</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUnits.map((unit) => (
                                        <TableRow key={unit.id}>
                                            <TableCell className="font-medium">{unit.label}</TableCell>
                                            <TableCell>{unit.floor ?? "-"}</TableCell>
                                            <TableCell>{getUnitTypeName(unit.unitTypeId)}</TableCell>
                                            <TableCell>
                                                {unit.isAvailable ? (
                                                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                                        Available
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                                                        Occupied
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="max-w-[200px] truncate text-zinc-500">
                                                {unit.notes || "-"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setEditUnit(unit)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create Unit Sheet */}
            <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle>Add Unit</SheetTitle>
                        <SheetDescription>Create a new unit in this building.</SheetDescription>
                    </SheetHeader>
                    <div className="mt-6 space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Unit Label *</label>
                            <Input
                                value={formValues.label}
                                onChange={(e) => setFormValues((prev) => ({ ...prev, label: e.target.value }))}
                                placeholder="e.g., 101, A-201"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Floor</label>
                            <Input
                                type="number"
                                value={formValues.floor}
                                onChange={(e) => setFormValues((prev) => ({ ...prev, floor: e.target.value }))}
                                placeholder="e.g., 1"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Unit Type</label>
                            <Select
                                value={formValues.unitTypeId}
                                onValueChange={(val) => setFormValues((prev) => ({ ...prev, unitTypeId: val }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(unitTypes || []).map((type) => (
                                        <SelectItem key={type.id} value={type.id}>
                                            {type.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Notes</label>
                            <Input
                                value={formValues.notes}
                                onChange={(e) => setFormValues((prev) => ({ ...prev, notes: e.target.value }))}
                                placeholder="Optional notes"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreateUnit} disabled={createUnitMutation.isPending}>
                                {createUnitMutation.isPending ? "Creating..." : "Create Unit"}
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Edit Unit Sheet */}
            <Sheet open={Boolean(editUnit)} onOpenChange={(open) => !open && setEditUnit(null)}>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle>Edit Unit</SheetTitle>
                        <SheetDescription>Update unit details.</SheetDescription>
                    </SheetHeader>
                    <div className="mt-6 space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Unit Label *</label>
                            <Input
                                value={formValues.label}
                                onChange={(e) => setFormValues((prev) => ({ ...prev, label: e.target.value }))}
                                placeholder="e.g., 101, A-201"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Floor</label>
                            <Input
                                type="number"
                                value={formValues.floor}
                                onChange={(e) => setFormValues((prev) => ({ ...prev, floor: e.target.value }))}
                                placeholder="e.g., 1"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Unit Type</label>
                            <Select
                                value={formValues.unitTypeId}
                                onValueChange={(val) => setFormValues((prev) => ({ ...prev, unitTypeId: val }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(unitTypes || []).map((type) => (
                                        <SelectItem key={type.id} value={type.id}>
                                            {type.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Notes</label>
                            <Input
                                value={formValues.notes}
                                onChange={(e) => setFormValues((prev) => ({ ...prev, notes: e.target.value }))}
                                placeholder="Optional notes"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setEditUnit(null)}>
                                Cancel
                            </Button>
                            <Button onClick={handleUpdateUnit} disabled={updateUnitMutation.isPending}>
                                {updateUnitMutation.isPending ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
