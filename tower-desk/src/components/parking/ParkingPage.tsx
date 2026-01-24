"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Car, Bike, Zap, Search, Plus, ParkingSquare } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import {
    useAdminBuildings,
    useManagerBuildings,
    useParkingSlots,
    useBuildingOccupancies,
    useUpdateParkingSlot
} from "@/lib/queries";
import type { ParkingSlot, ParkingSlotType } from "@/lib/types";
import { CreateParkingSlotSheet } from "./CreateParkingSlotSheet";
import { AllocateParkingDialog } from "./AllocateParkingDialog";

const slotTypeIcon: Record<ParkingSlotType, React.ReactNode> = {
    CAR: <Car className="h-4 w-4" />,
    BIKE: <Bike className="h-4 w-4" />,
    EV: <Zap className="h-4 w-4" />,
};

const slotTypeLabel: Record<ParkingSlotType, string> = {
    CAR: "Car",
    BIKE: "Bike",
    EV: "EV",
};

export function ParkingPage({ title = "Parking Management" }: { title?: string }) {
    const { user, role } = useAuth();
    const isManager = role === "manager";
    const adminBuildingsQuery = useAdminBuildings(isManager ? undefined : user?.id);
    const managerBuildingsQuery = useManagerBuildings(isManager ? user?.id : undefined);
    const buildings = isManager ? managerBuildingsQuery.data : adminBuildingsQuery.data;

    const [selectedBuildingId, setSelectedBuildingId] = useState("");
    const [search, setSearch] = useState("");
    const [showCreateSheet, setShowCreateSheet] = useState(false);
    const [editSlot, setEditSlot] = useState<ParkingSlot | null>(null);
    const [allocateSlot, setAllocateSlot] = useState<ParkingSlot | null>(null);

    const buildingOptions = useMemo(
        () => (buildings || []).map((building) => ({ id: building.id, name: building.name })),
        [buildings]
    );

    useEffect(() => {
        if (selectedBuildingId || buildingOptions.length === 0) return;
        setSelectedBuildingId(buildingOptions[0].id);
    }, [buildingOptions, selectedBuildingId]);

    const { data: parkingSlots, isLoading } = useParkingSlots(selectedBuildingId, { enabled: Boolean(selectedBuildingId) });
    const { data: availableSlots } = useParkingSlots(selectedBuildingId, { available: true, enabled: Boolean(selectedBuildingId) });
    const { data: occupancies } = useBuildingOccupancies(selectedBuildingId, { enabled: Boolean(selectedBuildingId) });

    const updateSlotMutation = useUpdateParkingSlot();

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return parkingSlots || [];
        return (parkingSlots || []).filter((slot) => {
            const haystack = `${slot.code} ${slot.level ?? ""} ${slot.type}`.toLowerCase();
            return haystack.includes(term);
        });
    }, [parkingSlots, search]);

    const stats = useMemo(() => {
        const all = parkingSlots || [];
        const available = availableSlots || [];
        const carSlots = all.filter((s) => s.type === "CAR").length;
        const bikeSlots = all.filter((s) => s.type === "BIKE").length;
        const evSlots = all.filter((s) => s.type === "EV").length;
        return {
            total: all.length,
            available: available.length,
            occupied: all.length - available.length,
            car: carSlots,
            bike: bikeSlots,
            ev: evSlots,
        };
    }, [parkingSlots, availableSlots]);

    const availableSlotIds = useMemo(() => {
        return new Set((availableSlots || []).map((s) => s.id));
    }, [availableSlots]);

    const handleToggleActive = async (slot: ParkingSlot) => {
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

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{title}</h1>
                        <p className="mt-1 text-sm text-zinc-500">Manage parking slots and allocations.</p>
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
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle>Parking Slots</CardTitle>
                        <p className="text-sm text-zinc-500">All parking slots in the selected building.</p>
                    </div>
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search by code, level, type"
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
                            Select a building to view parking slots.
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-10 text-center text-sm text-zinc-500">
                            No parking slots found.
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {filtered.map((slot) => {
                                const isAvailable = availableSlotIds.has(slot.id);
                                return (
                                    <div key={slot.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                                                    {slotTypeIcon[slot.type]}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-semibold text-zinc-900">{slot.code}</div>
                                                    <div className="text-xs text-zinc-500">{slot.level || "No level"}</div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <Badge
                                                    variant={isAvailable ? "secondary" : "default"}
                                                    className={isAvailable ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}
                                                >
                                                    {isAvailable ? "Available" : "Occupied"}
                                                </Badge>
                                                {!slot.isActive && (
                                                    <Badge variant="destructive">Inactive</Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div className="mt-4 space-y-2 text-xs text-zinc-500">
                                            <div className="flex items-center justify-between">
                                                <span>Type</span>
                                                <span className="font-medium text-zinc-700">{slotTypeLabel[slot.type]}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span>Covered</span>
                                                <span className="font-medium text-zinc-700">{slot.isCovered ? "Yes" : "No"}</span>
                                            </div>
                                        </div>
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            <Button variant="outline" size="sm" onClick={() => setEditSlot(slot)}>
                                                Edit
                                            </Button>
                                            {isAvailable && slot.isActive && (
                                                <Button variant="outline" size="sm" onClick={() => setAllocateSlot(slot)}>
                                                    Allocate
                                                </Button>
                                            )}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleToggleActive(slot)}
                                                disabled={updateSlotMutation.isPending}
                                            >
                                                {slot.isActive ? "Deactivate" : "Activate"}
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <CreateParkingSlotSheet
                open={showCreateSheet}
                onOpenChange={setShowCreateSheet}
                buildingId={selectedBuildingId}
            />

            {editSlot && (
                <CreateParkingSlotSheet
                    open={Boolean(editSlot)}
                    onOpenChange={(open) => !open && setEditSlot(null)}
                    buildingId={selectedBuildingId}
                    mode="edit"
                    slot={editSlot}
                />
            )}

            {allocateSlot && (
                <AllocateParkingDialog
                    open={Boolean(allocateSlot)}
                    onOpenChange={(open) => !open && setAllocateSlot(null)}
                    buildingId={selectedBuildingId}
                    preSelectedSlotId={allocateSlot.id}
                    occupancies={occupancies || []}
                />
            )}
        </div>
    );
}
