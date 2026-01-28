"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Search, UserRound, Home, LayoutGrid, List, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateResidentSheet } from "@/components/buildings/CreateResidentSheet";
import { useAuth } from "@/lib/auth";
import {
    useAdminBuildings,
    useManagerBuildings,
    // useBuildingResidents,
    useBuildingOccupancies,
    useBuildingUnits,
    useMoveResidentOccupancy,
    useResetUserPassword,
    useUpdateUserProfile,
    useUserById
} from "@/lib/queries";
import type { BuildingOccupancy } from "@/lib/types";

const emptyForm = {
    name: "",
    email: "",
    phoneNumber: "",
    avatarUrl: "",
    isActive: true,
};

export function ResidentsPage({ title = "" }: { title?: string }) {
    const { user, baseRole } = useAuth();
    const isManager = baseRole === "manager";
    const adminBuildingsQuery = useAdminBuildings(isManager ? undefined : user?.id);
    const managerBuildingsQuery = useManagerBuildings(isManager ? user?.id : undefined);
    const buildings = isManager ? managerBuildingsQuery.data : adminBuildingsQuery.data;

    const [selectedBuildingId, setSelectedBuildingId] = useState("");
    const [search, setSearch] = useState("");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    type Tenant = {
        userId: string;
        name: string;
        email: string;
        phoneNumber?: string;
        avatarUrl?: string;
        isActive?: boolean;
        unit?: { id: string; label: string };
        status?: string;
        startAt?: string;
        endAt?: string;
    };

    const [editResident, setEditResident] = useState<Tenant | null>(null);
    const [editValues, setEditValues] = useState(emptyForm);
    const [moveResident, setMoveResident] = useState<Tenant | null>(null);
    const [moveUnitId, setMoveUnitId] = useState("");
    const [moveMode, setMoveMode] = useState<'MOVE' | 'MOVE_OUT'>('MOVE');
    const [moveError, setMoveError] = useState<string | null>(null);
    const [resetResident, setResetResident] = useState<Tenant | null>(null);
    const [resetResult, setResetResult] = useState<{ tempPassword?: string; mustChangePassword?: boolean } | null>(null);

    const buildingOptions = useMemo(
        () => (buildings || []).map((building) => ({ id: building.id, name: building.name })),
        [buildings]
    );

    useEffect(() => {
        if (selectedBuildingId || buildingOptions.length === 0) return;
        setSelectedBuildingId(buildingOptions[0].id);
    }, [buildingOptions, selectedBuildingId]);

    // const { data: residents, isLoading } = useBuildingResidents(selectedBuildingId, { enabled: Boolean(selectedBuildingId) });
    const { data: occupancies, isLoading } = useBuildingOccupancies(selectedBuildingId, { enabled: Boolean(selectedBuildingId) });
    const { data: availableUnits } = useBuildingUnits(selectedBuildingId, {
        available: true,
        enabled: Boolean(selectedBuildingId),
    });

    const moveResidentMutation = useMoveResidentOccupancy();
    const resetPasswordMutation = useResetUserPassword();
    const updateUserProfileMutation = useUpdateUserProfile();
    const residentUserQuery = useUserById(editResident?.userId, { enabled: Boolean(editResident?.userId) });

    useEffect(() => {
        if (!editResident) {
            setEditValues(emptyForm);
            return;
        }
        const profile = residentUserQuery.data;
        setEditValues({
            name: profile?.name ?? editResident.name ?? "",
            email: profile?.email ?? editResident.email ?? "",
            phoneNumber: profile?.phoneNumber ?? editResident.phoneNumber ?? "",
            avatarUrl: profile?.avatarUrl ?? editResident.avatarUrl ?? "",
            isActive: typeof profile?.isActive === "boolean"
                ? profile.isActive
                : (typeof editResident.isActive === "boolean" ? editResident.isActive : true),
        });
    }, [editResident, residentUserQuery.data]);

    const tenants = useMemo<Tenant[]>(() => {
        const active = (occupancies || []).filter((o) => o.status === "ACTIVE" || !o.endAt);
        return active.map((o: BuildingOccupancy) => ({
            userId: String(o.residentUserId ?? ""),
            name: o.residentName ?? "",
            email: o.residentEmail ?? "",
            unit: { id: String(o.unitId ?? ""), label: o.unitLabel ?? "" },
            status: o.status,
            startAt: o.startAt,
            endAt: o.endAt,
        }));
    }, [occupancies]);

    const filteredResidents = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return tenants;
        return tenants.filter((resident) => {
            const haystack = `${resident.name} ${resident.email} ${resident.unit?.label ?? ""}`.toLowerCase();
            return haystack.includes(term);
        });
    }, [tenants, search]);

    const openMoveDialog = (resident: Tenant) => {
        setMoveResident(resident);
        setMoveUnitId(availableUnits?.[0]?.id ?? "");
    };

    const openResetDialog = (resident: Tenant) => {
        setResetResident(resident);
        setResetResult(null);
    };

    const handleSaveResident = async () => {
        if (!editResident) return;
        try {
            await updateUserProfileMutation.mutateAsync({
                userId: editResident.userId,
                data: {
                    name: editValues.name.trim(),
                    email: editValues.email.trim(),
                    phoneNumber: editValues.phoneNumber.trim() || undefined,
                    avatarUrl: editValues.avatarUrl.trim() || undefined,
                    isActive: editValues.isActive,
                },
            });
            toast.success("Resident updated");
            setEditResident(null);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to update resident";
            toast.error(message);
        }
    };

    const handleMoveOccupancy = async () => {
        if (!moveResident || !selectedBuildingId) return;
        if (moveMode === 'MOVE' && !moveUnitId) {
            setMoveError("Select a unit to move into.");
            return;
        }
        setMoveError(null);
        try {
            await moveResidentMutation.mutateAsync({
                buildingId: selectedBuildingId,
                residentUserId: moveResident.userId,
                residentEmail: moveResident.email,
                residentName: moveResident.name,
                unitId: moveMode === 'MOVE' ? moveUnitId : undefined,
                mode: moveMode
            });
            toast.success(moveMode === 'MOVE' ? "Occupancy moved" : "Resident moved out");
            setMoveResident(null);
            setMoveUnitId("");
            setMoveMode('MOVE');
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to move occupancy";
            setMoveError(message);
            toast.error(message);
        }
    };

    const handleResetPassword = async () => {
        if (!resetResident) return;
        try {
            const result = await resetPasswordMutation.mutateAsync(resetResident.userId);
            setResetResult(result);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to reset password";
            toast.error(message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{title}</h1>
                        <p className="mt-1 text-sm text-zinc-500">Manage resident profiles and active occupancies.</p>
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
                            <UserRound className="mr-2 h-4 w-4" /> Add Tenant
                        </Button>
                    </div>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                            <UserRound className="h-5 w-5" />
                        </div>
                        <div className="mt-3 text-2xl font-bold text-zinc-900">{tenants.length}</div>
                        <p className="text-xs text-zinc-500">Active Tenants</p>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                            <Home className="h-5 w-5" />
                        </div>
                        <div className="mt-3 text-2xl font-bold text-zinc-900">{availableUnits?.length || 0}</div>
                        <p className="text-xs text-zinc-500">Available Units</p>
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
                        <CardTitle>Tenant Directory</CardTitle>
                        <p className="text-sm text-zinc-500">Update profiles, move occupancy, or reset access.</p>
                    </div>
                    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                            <Input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search tenants"
                                className="pl-9"
                            />
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
                            Select a building to view residents.
                        </div>
                    ) : filteredResidents.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-10 text-center text-sm text-zinc-500">
                            No residents found for this building.
                        </div>
                    ) : viewMode === "grid" ? (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {filteredResidents.map((resident, idx) => (
                                <div
                                    key={`${resident.userId}-${resident.unit?.id ?? 'none'}-${resident.startAt ?? idx}`}
                                    className="rounded-xl border border-zinc-200 bg-white p-4"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold text-zinc-900">{resident.name}</div>
                                            <div className="text-xs text-zinc-500">{resident.email}</div>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <div className="flex flex-col items-end gap-2">
                                                <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">
                                                    {resident.unit?.label || "Unassigned"}
                                                </Badge>
                                                {resident.isActive === false ? (
                                                    <Badge variant="destructive" className="text-[10px]">Inactive</Badge>
                                                ) : null}
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-zinc-500 hover:text-zinc-900"
                                                        aria-label="Resident actions"
                                                    >
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => setEditResident(resident)}>
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => openMoveDialog(resident)}>
                                                        Move
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => openResetDialog(resident)}>
                                                        Reset Password
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                    <div className="mt-4 space-y-2 text-xs text-zinc-500">
                                        <div className="flex items-center justify-between">
                                            <span>Status</span>
                                            <span className="font-medium text-zinc-700">{resident.status || "ACTIVE"}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span>Start</span>
                                            <span className="font-medium text-zinc-700">{resident.startAt ? new Date(resident.startAt).toLocaleDateString() : "-"}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span>Phone</span>
                                            <span className="font-medium text-zinc-700">{resident.phoneNumber || "-"}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-lg border border-zinc-200 bg-white">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead>Resident</TableHead>
                                        <TableHead>Unit</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Phone</TableHead>
                                        <TableHead>Start</TableHead>
                                        <TableHead className="w-[60px]" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredResidents.map((resident, idx) => (
                                        <TableRow key={`${resident.userId}-${resident.unit?.id ?? 'none'}-${resident.startAt ?? idx}`}>
                                            <TableCell>
                                                <div className="text-sm font-medium text-zinc-900">{resident.name}</div>
                                                <div className="text-xs text-zinc-500">{resident.email}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">
                                                    {resident.unit?.label || "Unassigned"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-zinc-700">
                                                {resident.isActive === false ? (
                                                    <Badge variant="destructive" className="text-[10px]">Inactive</Badge>
                                                ) : (
                                                    <span className="text-sm">{resident.status || "ACTIVE"}</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-zinc-600">{resident.phoneNumber || "-"}</TableCell>
                                            <TableCell className="text-zinc-600">{resident.startAt ? new Date(resident.startAt).toLocaleDateString() : "-"}</TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-zinc-500 hover:text-zinc-900"
                                                            aria-label="Resident actions"
                                                        >
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => setEditResident(resident)}>
                                                            Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => openMoveDialog(resident)}>
                                                            Move
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => openResetDialog(resident)}>
                                                            Reset Password
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {selectedBuildingId ? (
                <CreateResidentSheet
                    open={isCreateOpen}
                    onOpenChange={setIsCreateOpen}
                    buildingId={selectedBuildingId}
                />
            ) : null}

            <Dialog open={Boolean(editResident)} onOpenChange={(open) => !open && setEditResident(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Resident</DialogTitle>
                        <DialogDescription>Update resident profile and access status.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Name</label>
                            <Input
                                value={editValues.name}
                                onChange={(event) => setEditValues((prev) => ({ ...prev, name: event.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Email</label>
                            <Input
                                type="email"
                                value={editValues.email}
                                onChange={(event) => setEditValues((prev) => ({ ...prev, email: event.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Phone</label>
                            <Input
                                value={editValues.phoneNumber}
                                onChange={(event) => setEditValues((prev) => ({ ...prev, phoneNumber: event.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Avatar URL</label>
                            <Input
                                value={editValues.avatarUrl}
                                onChange={(event) => setEditValues((prev) => ({ ...prev, avatarUrl: event.target.value }))}
                                placeholder="https://..."
                            />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={editValues.isActive}
                                onChange={(event) => setEditValues((prev) => ({ ...prev, isActive: event.target.checked }))}
                                className="rounded border-zinc-300"
                            />
                            Active account
                        </label>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditResident(null)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveResident} disabled={updateUserProfileMutation.isPending}>
                            {updateUserProfileMutation.isPending ? "Saving..." : "Save changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(moveResident)} onOpenChange={(open) => {
                if (!open) {
                    setMoveResident(null);
                    setMoveUnitId("");
                    setMoveMode('MOVE');
                    setMoveError(null);
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Move Resident</DialogTitle>
                        <DialogDescription>Transfer to another unit or move out of the building.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <Button
                                variant={moveMode === 'MOVE' ? "default" : "outline"}
                                size="sm"
                                onClick={() => setMoveMode('MOVE')}
                            >
                                Transfer to another unit
                            </Button>
                            <Button
                                variant={moveMode === 'MOVE_OUT' ? "default" : "outline"}
                                size="sm"
                                onClick={() => setMoveMode('MOVE_OUT')}
                            >
                                Move out
                            </Button>
                        </div>
                        <div className="space-y-2">
                            <div className="text-xs text-zinc-500">
                                {moveMode === 'MOVE'
                                    ? "Select a destination unit in this building."
                                    : "Ends current active occupancy without assigning a new unit."}
                            </div>
                        </div>
                        <Select
                            value={moveUnitId}
                            onValueChange={setMoveUnitId}
                            disabled={moveMode === 'MOVE_OUT'}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                            <SelectContent>
                                {(availableUnits || []).map((unit) => (
                                    <SelectItem key={unit.id} value={unit.id}>
                                        {unit.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {availableUnits && availableUnits.length === 0 && moveMode === 'MOVE' ? (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                                No available units found in this building.
                            </div>
                        ) : null}
                        {moveError ? (
                            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                                {moveError}
                            </div>
                        ) : null}
                        <p className="text-xs text-zinc-500">
                            {moveMode === 'MOVE'
                                ? "Ends current active occupancy and creates a new one."
                                : "Ends current active occupancy without creating a new one."}
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMoveResident(null)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleMoveOccupancy}
                            disabled={moveResidentMutation.isPending || (moveMode === 'MOVE' && !moveUnitId)}
                        >
                            {moveResidentMutation.isPending
                                ? "Working..."
                                : moveMode === 'MOVE' ? "Confirm transfer" : "Confirm move out"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(resetResident)} onOpenChange={(open) => {
                if (!open) {
                    setResetResident(null);
                    setResetResult(null);
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reset Password</DialogTitle>
                        <DialogDescription>Generate a temporary password for this resident.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {resetResult ? (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                <div className="font-semibold">Temporary password</div>
                                <div className="mt-2 font-mono text-base text-emerald-900">{resetResult.tempPassword || "Generated"}</div>
                                <div className="mt-2 text-xs text-emerald-700">
                                    Must change password: {resetResult.mustChangePassword ? "Yes" : "No"}
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                                This will invalidate the current password and generate a new temporary one.
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setResetResident(null)}>
                            Close
                        </Button>
                        <Button
                            onClick={handleResetPassword}
                            disabled={resetPasswordMutation.isPending}
                        >
                            {resetPasswordMutation.isPending ? "Resetting..." : "Reset password"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
