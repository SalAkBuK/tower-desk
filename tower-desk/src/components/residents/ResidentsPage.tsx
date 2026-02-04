"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Search, UserRound, UserPlus, Home, LayoutGrid, List, MoreHorizontal } from "lucide-react";
import Link from "next/link";
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
import { CreateTenantDialog } from "@/components/residents/CreateTenantDialog";
import { MoveInDialog } from "@/components/leases/MoveInDialog";
import { TransferUnitDialog } from "@/components/leases/TransferUnitDialog";
import { MoveOutDialog } from "@/components/leases/MoveOutDialog";
import { useAuth } from "@/lib/auth";
import { getActiveLeaseForUnit } from "@/lib/api";
import {
    useAdminBuildings,
    useManagerBuildings,
    useBuildingUnits,
    useResidentDirectory,
    useResetUserPassword,
    useUpdateUserProfile,
    useUpsertResidentProfile,
    useUserById,
    useOccupancyVehicles,
    useCreateVehicle,
    useUpdateVehicle,
    useDeleteVehicle
} from "@/lib/queries";
import type { ResidentDirectoryRow } from "@/lib/types";
import { useQueryClient } from "@tanstack/react-query";

const emptyForm = {
    name: "",
    email: "",
    phoneNumber: "",
    avatarUrl: "",
    isActive: true,
};

const emptyProfileForm = {
    emiratesIdNumber: "",
    passportNumber: "",
    nationality: "",
    dateOfBirth: "",
    currentAddress: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
};

export function ResidentsPage({ title = "" }: { title?: string }) {
    const { user, baseRole } = useAuth();
    const isManager = baseRole === "manager";
    const leaseBasePath = isManager ? "" : "/admin/leases";
    const adminBuildingsQuery = useAdminBuildings(isManager ? undefined : user?.id);
    const managerBuildingsQuery = useManagerBuildings(isManager ? user?.id : undefined);
    const buildings = isManager ? managerBuildingsQuery.data : adminBuildingsQuery.data;

    const [selectedBuildingId, setSelectedBuildingId] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "ENDED">("ACTIVE");
    const [sortBy, setSortBy] = useState<"residentName" | "unitLabel" | "createdAt" | "startAt">("residentName");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [cursor, setCursor] = useState<string | null>(null);
    const [residentRows, setResidentRows] = useState<ResidentDirectoryRow[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"grid" | "list">("list");
    const [isAddTenantOpen, setIsAddTenantOpen] = useState(false);
    const [isMoveInOpen, setIsMoveInOpen] = useState(false);
    type Tenant = {
        userId: string;
        occupancyId?: string;
        name: string;
        email: string;
        phoneNumber?: string;
        avatarUrl?: string;
        isActive?: boolean;
        unit?: { id: string; label: string };
        status?: string;
        startAt?: string;
        endAt?: string;
        lease?: {
            leaseId: string;
            status?: string;
            leaseStartDate?: string | null;
            leaseEndDate?: string | null;
            annualRent?: string | number | null;
        };
        profile?: {
            emiratesIdNumber?: string | null;
            passportNumber?: string | null;
            nationality?: string | null;
            dateOfBirth?: string | null;
            currentAddress?: string | null;
            emergencyContactName?: string | null;
            emergencyContactPhone?: string | null;
        };
    };

    const [editResident, setEditResident] = useState<Tenant | null>(null);
    const [editValues, setEditValues] = useState(emptyForm);
    const [editProfileValues, setEditProfileValues] = useState(emptyProfileForm);
    const [moveInResident, setMoveInResident] = useState<Tenant | null>(null);
    const [transferContext, setTransferContext] = useState<{
        resident: Tenant;
        leaseId?: string;
        unitId?: string;
        unitLabel?: string;
    } | null>(null);
    const [moveOutContext, setMoveOutContext] = useState<{
        resident: Tenant;
        leaseId: string;
        unitId: string;
        unitLabel?: string;
    } | null>(null);
    const [moveOutLoadingId, setMoveOutLoadingId] = useState<string | null>(null);
    const [resetResident, setResetResident] = useState<Tenant | null>(null);
    const [resetResult, setResetResult] = useState<{ tempPassword?: string; mustChangePassword?: boolean } | null>(null);
    const [vehicleEdits, setVehicleEdits] = useState<Record<string, string>>({});
    const [newVehiclePlate, setNewVehiclePlate] = useState("");

    const buildingOptions = useMemo(
        () => (buildings || []).map((building) => ({ id: building.id, name: building.name })),
        [buildings]
    );

    useEffect(() => {
        if (selectedBuildingId || buildingOptions.length === 0) return;
        setSelectedBuildingId(buildingOptions[0].id);
    }, [buildingOptions, selectedBuildingId]);

    const {
        data: residentDirectory,
        isLoading,
        isFetching,
    } = useResidentDirectory(selectedBuildingId, {
        q: search.trim() || undefined,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        sort: sortBy,
        order: sortOrder,
        limit: 50,
        cursor,
        includeProfile: true,
        enabled: Boolean(selectedBuildingId),
    });
    const { data: availableUnits } = useBuildingUnits(selectedBuildingId, {
        available: true,
        enabled: Boolean(selectedBuildingId),
    });
    const queryClient = useQueryClient();
    const resetPasswordMutation = useResetUserPassword();
    const updateUserProfileMutation = useUpdateUserProfile();
    const updateResidentProfileMutation = useUpsertResidentProfile();
    const residentUserQuery = useUserById(editResident?.userId, { enabled: Boolean(editResident?.userId) });
    const occupancyIdForVehicles = editResident?.occupancyId ?? "";
    const occupancyVehiclesQuery = useOccupancyVehicles(occupancyIdForVehicles, { enabled: Boolean(occupancyIdForVehicles) });
    const createVehicleMutation = useCreateVehicle();
    const updateVehicleMutation = useUpdateVehicle();
    const deleteVehicleMutation = useDeleteVehicle();

    useEffect(() => {
        if (!editResident) {
            setEditValues(emptyForm);
            setEditProfileValues(emptyProfileForm);
            return;
        }
        const profile = residentUserQuery.data;
        const residentProfile = editResident.profile;
        setEditValues({
            name: profile?.name ?? editResident.name ?? "",
            email: profile?.email ?? editResident.email ?? "",
            phoneNumber: profile?.phoneNumber ?? editResident.phoneNumber ?? "",
            avatarUrl: profile?.avatarUrl ?? editResident.avatarUrl ?? "",
            isActive: typeof profile?.isActive === "boolean"
                ? profile.isActive
                : (typeof editResident.isActive === "boolean" ? editResident.isActive : true),
        });
        const dateOfBirth = residentProfile?.dateOfBirth
            ? String(residentProfile.dateOfBirth).split("T")[0]
            : "";
        setEditProfileValues({
            emiratesIdNumber: residentProfile?.emiratesIdNumber ?? "",
            passportNumber: residentProfile?.passportNumber ?? "",
            nationality: residentProfile?.nationality ?? "",
            dateOfBirth,
            currentAddress: residentProfile?.currentAddress ?? "",
            emergencyContactName: residentProfile?.emergencyContactName ?? "",
            emergencyContactPhone: residentProfile?.emergencyContactPhone ?? "",
        });
    }, [editResident, residentUserQuery.data]);

    useEffect(() => {
        setCursor(null);
        setResidentRows([]);
        setNextCursor(null);
    }, [selectedBuildingId, search, statusFilter, sortBy, sortOrder]);

    useEffect(() => {
        if (!residentDirectory) return;
        setNextCursor(residentDirectory.nextCursor ?? null);
        if (!cursor) {
            setResidentRows(residentDirectory.items || []);
            return;
        }
        setResidentRows((prev) => {
            const existing = new Map(prev.map((row) => [row.occupancyId, row]));
            residentDirectory.items.forEach((row) => {
                if (!existing.has(row.occupancyId)) {
                    existing.set(row.occupancyId, row);
                }
            });
            return Array.from(existing.values());
        });
    }, [residentDirectory, cursor]);

    const tenants = useMemo<Tenant[]>(() => {
        return (residentRows || []).map((row) => ({
            occupancyId: row.occupancyId,
            userId: String(row.residentUserId ?? ""),
            name: row.residentName ?? "",
            email: row.residentEmail ?? "",
            phoneNumber: row.residentPhone ?? undefined,
            avatarUrl: row.residentAvatarUrl ?? undefined,
            unit: row.unitId ? { id: String(row.unitId), label: row.unitLabel ?? "" } : undefined,
            status: row.status ?? undefined,
            startAt: row.startAt ?? undefined,
            endAt: row.endAt ?? undefined,
            lease: row.lease
                ? {
                    leaseId: String(row.lease.leaseId),
                    status: row.lease.status,
                    leaseStartDate: row.lease.leaseStartDate ?? undefined,
                    leaseEndDate: row.lease.leaseEndDate ?? undefined,
                    annualRent: row.lease.annualRent ?? undefined,
                }
                : undefined,
            profile: row.profile
                ? {
                    emiratesIdNumber: row.profile.emiratesIdNumber ?? undefined,
                    passportNumber: row.profile.passportNumber ?? undefined,
                    nationality: row.profile.nationality ?? undefined,
                    dateOfBirth: row.profile.dateOfBirth ?? undefined,
                    currentAddress: row.profile.currentAddress ?? undefined,
                    emergencyContactName: row.profile.emergencyContactName ?? undefined,
                    emergencyContactPhone: row.profile.emergencyContactPhone ?? undefined,
                }
                : undefined,
        }));
    }, [residentRows]);

    const activeTenantsCount = useMemo(() => {
        return tenants.filter((resident) => String(resident.status ?? "").toUpperCase() === "ACTIVE").length;
    }, [tenants]);

    const shouldShowMoveIn = (resident: Tenant) =>
        !resident.unit?.id || String(resident.status ?? "").toUpperCase() !== "ACTIVE";

    const openMoveInDialog = (resident: Tenant) => {
        setIsMoveInOpen(false);
        setMoveInResident(resident);
    };

    const openMoveOutDialog = async (resident: Tenant) => {
        if (!selectedBuildingId) return;
        const unitId = resident.unit?.id;
        if (!unitId) {
            toast.error("Resident has no unit assigned");
            return;
        }
        setMoveOutLoadingId(resident.userId);
        try {
            const lease = await queryClient.fetchQuery({
                queryKey: ["leases", "active", selectedBuildingId, unitId],
                queryFn: () => getActiveLeaseForUnit(selectedBuildingId, unitId),
            });
            if (!lease) {
                toast.error("No active lease found for this unit");
                return;
            }
            setMoveOutContext({
                resident,
                leaseId: lease.id,
                unitId,
                unitLabel: resident.unit?.label,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load lease";
            toast.error(message);
        } finally {
            setMoveOutLoadingId(null);
        }
    };

    const openTransferDialog = async (resident: Tenant) => {
        if (!selectedBuildingId) return;
        const unitId = resident.unit?.id;
        if (!unitId) {
            toast.error("Resident has no unit assigned");
            return;
        }
        setMoveOutLoadingId(resident.userId);
        try {
            const lease = await queryClient.fetchQuery({
                queryKey: ["leases", "active", selectedBuildingId, unitId],
                queryFn: () => getActiveLeaseForUnit(selectedBuildingId, unitId),
            });
            if (!lease) {
                toast.message("No active lease found — opening transfer without move-out.");
                setTransferContext({
                    resident,
                    unitId,
                    unitLabel: resident.unit?.label,
                });
                setMoveInResident(resident);
                return;
            }
            setTransferContext({
                resident,
                leaseId: lease.id,
                unitId,
                unitLabel: resident.unit?.label,
            });
            setMoveInResident(resident);
        } catch (error) {
            toast.message("No active lease found — opening transfer without move-out.");
            setTransferContext({
                resident,
                unitId,
                unitLabel: resident.unit?.label,
            });
            setMoveInResident(resident);
        } finally {
            setMoveOutLoadingId(null);
        }
    };

    const openResetDialog = (resident: Tenant) => {
        setResetResident(resident);
        setResetResult(null);
    };


    const handleSaveResident = async () => {
        if (!editResident) return;
        try {
            const dateOfBirth =
                editProfileValues.dateOfBirth && editProfileValues.dateOfBirth.trim()
                    ? new Date(editProfileValues.dateOfBirth).toISOString()
                    : undefined;
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
            await updateResidentProfileMutation.mutateAsync({
                userId: editResident.userId,
                data: {
                    emiratesIdNumber: editProfileValues.emiratesIdNumber.trim() || undefined,
                    passportNumber: editProfileValues.passportNumber.trim() || undefined,
                    nationality: editProfileValues.nationality.trim() || undefined,
                    dateOfBirth,
                    currentAddress: editProfileValues.currentAddress.trim() || undefined,
                    emergencyContactName: editProfileValues.emergencyContactName.trim() || undefined,
                    emergencyContactPhone: editProfileValues.emergencyContactPhone.trim() || undefined,
                },
            });
            toast.success("Resident updated");
            setEditResident(null);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to update resident";
            toast.error(message);
        }
    };

    const handleMoveOutClosed = (open: boolean) => {
        if (!open) {
            setMoveOutContext(null);
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
                        <Button
                            variant="outline"
                            onClick={() => setIsAddTenantOpen(true)}
                        >
                            <UserPlus className="mr-2 h-4 w-4" /> Add Tenant
                        </Button>
                        <Button onClick={() => setIsMoveInOpen(true)} disabled={!selectedBuildingId}>
                            <UserRound className="mr-2 h-4 w-4" /> Move In Tenant
                        </Button>
                    </div>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                            <UserRound className="h-5 w-5" />
                        </div>
                        <div className="mt-3 text-2xl font-bold text-zinc-900">{activeTenantsCount}</div>
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
                        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                            <SelectTrigger className="w-full sm:w-40">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All statuses</SelectItem>
                                <SelectItem value="ACTIVE">Active</SelectItem>
                                <SelectItem value="ENDED">Ended</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
                            <SelectTrigger className="w-full sm:w-44">
                                <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="residentName">Resident name</SelectItem>
                                <SelectItem value="unitLabel">Unit</SelectItem>
                                <SelectItem value="createdAt">Created</SelectItem>
                                <SelectItem value="startAt">Start date</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as any)}>
                            <SelectTrigger className="w-full sm:w-32">
                                <SelectValue placeholder="Order" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="asc">Asc</SelectItem>
                                <SelectItem value="desc">Desc</SelectItem>
                            </SelectContent>
                        </Select>
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
                    ) : tenants.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-10 text-center text-sm text-zinc-500">
                            No residents found for this building.
                        </div>
                    ) : viewMode === "grid" ? (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {tenants.map((resident, idx) => (
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
                                                    {shouldShowMoveIn(resident) ? (
                                                        <DropdownMenuItem onClick={() => openMoveInDialog(resident)}>
                                                            Move In
                                                        </DropdownMenuItem>
                                                    ) : null}
                                                    <DropdownMenuItem
                                                        onClick={() => openTransferDialog(resident)}
                                                        disabled={moveOutLoadingId === resident.userId}
                                                    >
                                                        {moveOutLoadingId === resident.userId ? "Loading lease..." : "Transfer Unit"}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => openMoveOutDialog(resident)}
                                                        disabled={moveOutLoadingId === resident.userId}
                                                    >
                                                        {moveOutLoadingId === resident.userId ? "Loading lease..." : "Move Out"}
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
                                            <span>Lease</span>
                                            <span className="font-medium text-zinc-700">
                                                {resident.lease?.leaseStartDate
                                                    ? new Date(resident.lease.leaseStartDate).toLocaleDateString()
                                                    : "-"}
                                                {" → "}
                                                {resident.lease?.leaseEndDate
                                                    ? new Date(resident.lease.leaseEndDate).toLocaleDateString()
                                                    : "-"}
                                            </span>
                                        </div>
                                        {leaseBasePath && resident.lease?.leaseId ? (
                                            <div className="flex items-center justify-between">
                                                <span>Lease Detail</span>
                                                <Link
                                                    href={`${leaseBasePath}/${resident.lease.leaseId}`}
                                                    className="text-xs text-blue-600 hover:underline"
                                                >
                                                    View lease
                                                </Link>
                                            </div>
                                        ) : null}
                                        <div className="flex items-center justify-between">
                                            <span>Start</span>
                                            <span className="font-medium text-zinc-700">{resident.startAt ? new Date(resident.startAt).toLocaleDateString() : "-"}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span>Phone</span>
                                            <span className="font-medium text-zinc-700">{resident.phoneNumber || "-"}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span>Nationality</span>
                                            <span className="font-medium text-zinc-700">{resident.profile?.nationality || "-"}</span>
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
                                        <TableHead>Lease</TableHead>
                                        <TableHead>Rent</TableHead>
                                        <TableHead>Nationality</TableHead>
                                        <TableHead>Emirates ID</TableHead>
                                        <TableHead className="w-[60px]" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {tenants.map((resident, idx) => (
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
                                            <TableCell className="text-zinc-600">
                                                <div>
                                                    {resident.lease?.leaseStartDate
                                                        ? new Date(resident.lease.leaseStartDate).toLocaleDateString()
                                                        : "-"}
                                                    {" → "}
                                                    {resident.lease?.leaseEndDate
                                                        ? new Date(resident.lease.leaseEndDate).toLocaleDateString()
                                                        : "-"}
                                                </div>
                                                {leaseBasePath && resident.lease?.leaseId ? (
                                                    <Link
                                                        href={`${leaseBasePath}/${resident.lease.leaseId}`}
                                                        className="text-xs text-blue-600 hover:underline"
                                                    >
                                                        View lease
                                                    </Link>
                                                ) : null}
                                            </TableCell>
                                            <TableCell className="text-zinc-600">
                                                {resident.lease?.annualRent ?? "-"}
                                            </TableCell>
                                            <TableCell className="text-zinc-600">
                                                {resident.profile?.nationality || "-"}
                                            </TableCell>
                                            <TableCell className="text-zinc-600">
                                                {resident.profile?.emiratesIdNumber || "-"}
                                            </TableCell>
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
                                                    {shouldShowMoveIn(resident) ? (
                                                        <DropdownMenuItem onClick={() => openMoveInDialog(resident)}>
                                                            Move In
                                                        </DropdownMenuItem>
                                                    ) : null}
                                                    <DropdownMenuItem
                                                        onClick={() => openTransferDialog(resident)}
                                                        disabled={moveOutLoadingId === resident.userId}
                                                    >
                                                        {moveOutLoadingId === resident.userId ? "Loading lease..." : "Transfer Unit"}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => openMoveOutDialog(resident)}
                                                        disabled={moveOutLoadingId === resident.userId}
                                                    >
                                                        {moveOutLoadingId === resident.userId ? "Loading lease..." : "Move Out"}
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
                    {nextCursor ? (
                        <div className="flex justify-center">
                            <Button
                                variant="outline"
                                onClick={() => setCursor(nextCursor)}
                                disabled={isFetching}
                            >
                                {isFetching ? "Loading..." : "Load more"}
                            </Button>
                        </div>
                    ) : null}
                </CardContent>
            </Card>

            <Dialog open={Boolean(editResident)} onOpenChange={(open) => !open && setEditResident(null)}>
                <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
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
                        <div className="pt-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Resident Profile</div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Emirates ID</label>
                            <Input
                                value={editProfileValues.emiratesIdNumber}
                                onChange={(event) => setEditProfileValues((prev) => ({ ...prev, emiratesIdNumber: event.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Passport Number</label>
                            <Input
                                value={editProfileValues.passportNumber}
                                onChange={(event) => setEditProfileValues((prev) => ({ ...prev, passportNumber: event.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nationality</label>
                            <Input
                                value={editProfileValues.nationality}
                                onChange={(event) => setEditProfileValues((prev) => ({ ...prev, nationality: event.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Date of Birth</label>
                            <Input
                                type="date"
                                value={editProfileValues.dateOfBirth}
                                onChange={(event) => setEditProfileValues((prev) => ({ ...prev, dateOfBirth: event.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Current Address</label>
                            <Input
                                value={editProfileValues.currentAddress}
                                onChange={(event) => setEditProfileValues((prev) => ({ ...prev, currentAddress: event.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Emergency Contact Name</label>
                            <Input
                                value={editProfileValues.emergencyContactName}
                                onChange={(event) => setEditProfileValues((prev) => ({ ...prev, emergencyContactName: event.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Emergency Contact Phone</label>
                            <Input
                                value={editProfileValues.emergencyContactPhone}
                                onChange={(event) => setEditProfileValues((prev) => ({ ...prev, emergencyContactPhone: event.target.value }))}
                            />
                        </div>
                        <div className="pt-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Vehicles</div>
                        </div>
                        {editResident?.occupancyId ? (
                            <div className="space-y-3">
                                {occupancyVehiclesQuery.isLoading ? (
                                    <div className="text-sm text-zinc-500">Loading vehicles...</div>
                                ) : (occupancyVehiclesQuery.data || []).length === 0 ? (
                                    <div className="text-sm text-zinc-500">No vehicles registered.</div>
                                ) : (
                                    <div className="space-y-3">
                                        {(occupancyVehiclesQuery.data || []).map((vehicle) => (
                                            <div key={vehicle.id} className="flex items-center gap-2">
                                                <Input
                                                    value={vehicleEdits[vehicle.id] ?? vehicle.plateNumber}
                                                    onChange={(event) =>
                                                        setVehicleEdits((prev) => ({ ...prev, [vehicle.id]: event.target.value }))
                                                    }
                                                />
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={async () => {
                                                        const nextPlate = (vehicleEdits[vehicle.id] ?? vehicle.plateNumber).trim();
                                                        if (!nextPlate) {
                                                            toast.error("Plate number is required.");
                                                            return;
                                                        }
                                                        try {
                                                            await updateVehicleMutation.mutateAsync({
                                                                vehicleId: vehicle.id,
                                                                occupancyId: vehicle.occupancyId,
                                                                data: { plateNumber: nextPlate },
                                                            });
                                                            toast.success("Vehicle updated");
                                                            setVehicleEdits((prev) => {
                                                                const next = { ...prev };
                                                                delete next[vehicle.id];
                                                                return next;
                                                            });
                                                        } catch (error) {
                                                            toast.error(error instanceof Error ? error.message : "Failed to update vehicle");
                                                        }
                                                    }}
                                                    disabled={updateVehicleMutation.isPending}
                                                >
                                                    Save
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={async () => {
                                                        try {
                                                            await deleteVehicleMutation.mutateAsync({
                                                                vehicleId: vehicle.id,
                                                                occupancyId: vehicle.occupancyId,
                                                            });
                                                            toast.success("Vehicle removed");
                                                        } catch (error) {
                                                            toast.error(error instanceof Error ? error.message : "Failed to remove vehicle");
                                                        }
                                                    }}
                                                    disabled={deleteVehicleMutation.isPending}
                                                >
                                                    Remove
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center gap-2">
                                    <Input
                                        placeholder="Plate number"
                                        value={newVehiclePlate}
                                        onChange={(event) => setNewVehiclePlate(event.target.value)}
                                    />
                                    <Button
                                        onClick={async () => {
                                            const plate = newVehiclePlate.trim();
                                            if (!plate || !editResident?.occupancyId) {
                                                toast.error("Plate number is required.");
                                                return;
                                            }
                                            try {
                                                await createVehicleMutation.mutateAsync({
                                                    occupancyId: editResident.occupancyId,
                                                    data: { plateNumber: plate },
                                                });
                                                toast.success("Vehicle added");
                                                setNewVehiclePlate("");
                                            } catch (error) {
                                                toast.error(error instanceof Error ? error.message : "Failed to add vehicle");
                                            }
                                        }}
                                        disabled={createVehicleMutation.isPending}
                                    >
                                        Add
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-zinc-500">
                                No active occupancy found for this resident.
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditResident(null)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveResident}
                            disabled={updateUserProfileMutation.isPending || updateResidentProfileMutation.isPending}
                        >
                            {updateUserProfileMutation.isPending || updateResidentProfileMutation.isPending ? "Saving..." : "Save changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {selectedBuildingId && (moveInResident || isMoveInOpen) ? (
                transferContext && moveInResident ? (
                    <TransferUnitDialog
                        open={Boolean(moveInResident)}
                        onOpenChange={(open) => {
                            if (!open) {
                                setMoveInResident(null);
                                setTransferContext(null);
                            }
                        }}
                        buildingId={selectedBuildingId}
                        defaultResidentUserId={moveInResident.userId}
                        defaultResidentName={moveInResident.name}
                        defaultResidentEmail={moveInResident.email}
                        transferFrom={{
                            leaseId: transferContext.leaseId,
                            unitId: transferContext.unitId,
                            unitLabel: transferContext.unitLabel,
                        }}
                    />
                ) : (
                    <MoveInDialog
                        open={Boolean(moveInResident) || isMoveInOpen}
                        onOpenChange={(open) => {
                            if (!open) {
                                setMoveInResident(null);
                                setIsMoveInOpen(false);
                            }
                        }}
                        buildingId={selectedBuildingId}
                        defaultResidentUserId={moveInResident?.userId}
                        defaultResidentName={moveInResident?.name}
                        defaultResidentEmail={moveInResident?.email}
                    />
                )
            ) : null}

            <CreateTenantDialog
                open={isAddTenantOpen}
                onOpenChange={setIsAddTenantOpen}
            />

            {selectedBuildingId && moveOutContext ? (
                <MoveOutDialog
                    open={Boolean(moveOutContext)}
                    onOpenChange={handleMoveOutClosed}
                    buildingId={selectedBuildingId}
                    leaseId={moveOutContext.leaseId}
                    unitId={moveOutContext.unitId}
                    unitLabel={moveOutContext.unitLabel}
                    residentName={moveOutContext.resident.name}
                />
            ) : null}

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
