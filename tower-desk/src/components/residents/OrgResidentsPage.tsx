"use client";

import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Search, UserPlus, UserRound } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateTenantDialog } from "@/components/residents/CreateTenantDialog";
import { MoveInDialog } from "@/components/leases/MoveInDialog";
import { MoveOutDialog } from "@/components/leases/MoveOutDialog";
import { TransferUnitDialog } from "@/components/leases/TransferUnitDialog";
import { useAuth } from "@/lib/auth";
import { getActiveLeaseForUnit } from "@/lib/api";
import {
    useAdminBuildings,
    useBuildingOccupancies,
    useManagerBuildings,
    useOrgResidents,
    useOccupancyParkingAllocations,
    useOccupancyVehicles,
    useCreateVehicle,
    useUpdateVehicle,
    useDeleteVehicle,
    useResidentDirectory,
    useUpsertResidentProfile,
    useUserById,
} from "@/lib/queries";
import type { OrgResidentListItem, OrgResidentsResponse, ResidentDirectoryRow } from "@/lib/types";
import { useQueryClient } from "@tanstack/react-query";

type OrgResidentsTab = "ACTIVE" | "NEW" | "FORMER";

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

const tabConfig: Record<
    OrgResidentsTab,
    { label: string; status: "WITH_OCCUPANCY" | "NEW" | "FORMER"; emptyLabel: string }
> = {
    ACTIVE: {
        label: "Active",
        status: "WITH_OCCUPANCY",
        emptyLabel: "No active residents found.",
    },
    NEW: {
        label: "New",
        status: "NEW",
        emptyLabel: "No new residents found.",
    },
    FORMER: {
        label: "Former",
        status: "FORMER",
        emptyLabel: "No former residents found.",
    },
};

const formatDate = (value?: string | null) => {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    }).format(date);
};

const mergeByUserId = (prev: OrgResidentListItem[], next: OrgResidentListItem[]) => {
    const map = new Map(prev.map((item) => [item.user.id, item]));
    next.forEach((item) => map.set(item.user.id, item));
    return Array.from(map.values());
};

const getCurrentOccupancySummary = (
    resident: OrgResidentListItem,
    directoryRow?: ResidentDirectoryRow | null,
    buildingName?: string
) => {
    const current = resident.activeOccupancy
        ?? (resident as any)?.currentOccupancy
        ?? (resident as any)?.activeOccupancy
        ?? (resident as any)?.occupancy
        ?? null;
    const currentBuilding = current?.buildingName ?? current?.building ?? "";
    const currentUnit = current?.unitLabel ?? current?.unit ?? "";
    if (currentBuilding || currentUnit) {
        const parts = [currentBuilding, currentUnit ? `Unit ${currentUnit}` : ""].filter(Boolean);
        return parts.join(", ");
    }
    if (directoryRow?.unitLabel) {
        const parts = [buildingName, `Unit ${directoryRow.unitLabel}`].filter(Boolean);
        return parts.join(", ");
    }
    return resident.hasActiveOccupancy ? "Active occupancy" : "No active occupancy";
};

const getFormerOccupancySummary = (resident: OrgResidentListItem) => {
    const last = resident.lastOccupancy;
    if (!last) return "No previous occupancy";
    const label = [last.buildingName, last.unitLabel ? `Unit ${last.unitLabel}` : ""]
        .filter(Boolean)
        .join(", ");
    const ended = last.endAt ? ` - ended ${formatDate(last.endAt)}` : "";
    return `${label || "Previous occupancy"}${ended}`;
};

const getActiveOccupancyContext = (
    resident: OrgResidentListItem,
    directoryRow?: ResidentDirectoryRow | null,
    fallbackBuildingId?: string
) => {
    const current = resident.activeOccupancy
        ?? (resident as any)?.currentOccupancy
        ?? (resident as any)?.activeOccupancy
        ?? (resident as any)?.occupancy
        ?? null;
    if (current?.unitId || current?.unit?.id) {
        return {
            buildingId: current?.buildingId ?? current?.building_id ?? current?.building?.id ?? fallbackBuildingId,
            unitId: current?.unitId ?? current?.unit_id ?? current?.unit?.id ?? undefined,
            unitLabel: current?.unitLabel ?? current?.unit?.label ?? current?.unit ?? undefined,
        };
    }
    if (directoryRow?.unitId) {
        return {
            buildingId: fallbackBuildingId,
            unitId: directoryRow.unitId ?? undefined,
            unitLabel: directoryRow.unitLabel ?? undefined,
        };
    }
    return null;
};

export function OrgResidentsPage({ title = "Residents" }: { title?: string }) {
    const { user, baseRole } = useAuth();
    const isManager = baseRole === "manager";
    const leaseBasePath = isManager ? "" : "/admin/leases";
    const adminBuildingsQuery = useAdminBuildings(isManager ? undefined : user?.id);
    const managerBuildingsQuery = useManagerBuildings(isManager ? user?.id : undefined);
    const buildings = isManager ? managerBuildingsQuery.data : adminBuildingsQuery.data;
    const queryClient = useQueryClient();
    const updateResidentProfileMutation = useUpsertResidentProfile();

    const [selectedBuildingId, setSelectedBuildingId] = useState("");
    const [activeTab, setActiveTab] = useState<OrgResidentsTab>("ACTIVE");
    const [search, setSearch] = useState("");
    const [isAddTenantOpen, setIsAddTenantOpen] = useState(false);
    const [isMoveInOpen, setIsMoveInOpen] = useState(false);
    const [moveInResident, setMoveInResident] = useState<OrgResidentListItem | null>(null);
    const [transferContext, setTransferContext] = useState<{
        resident: OrgResidentListItem;
        leaseId?: string;
        unitId?: string;
        unitLabel?: string;
        buildingId: string;
    } | null>(null);
    const [moveOutContext, setMoveOutContext] = useState<{
        resident: OrgResidentListItem;
        leaseId: string;
        unitId: string;
        unitLabel?: string;
        buildingId: string;
    } | null>(null);
    const [moveOutLoadingId, setMoveOutLoadingId] = useState<string | null>(null);
    const [editResident, setEditResident] = useState<OrgResidentListItem | null>(null);
    const [editValues, setEditValues] = useState(emptyForm);
    const [editProfileValues, setEditProfileValues] = useState(emptyProfileForm);
    const residentUserQuery = useUserById(editResident?.user.id, { enabled: Boolean(editResident?.user.id) });
    const [vehicleEdits, setVehicleEdits] = useState<Record<string, string>>({});
    const [newVehiclePlate, setNewVehiclePlate] = useState("");
    const buildingOccupanciesQuery = useBuildingOccupancies(selectedBuildingId, {
        enabled: Boolean(editResident) && Boolean(selectedBuildingId) && Boolean(editResident?.hasActiveOccupancy),
    });
    const resolvedOccupancy = useMemo(() => {
        if (!editResident || !buildingOccupanciesQuery.data) return null;
        return buildingOccupanciesQuery.data.find((occupancy) => {
            const residentId = occupancy.residentUserId ?? occupancy.resident?.id;
            const residentEmail = occupancy.residentEmail ?? occupancy.resident?.email;
            const status = String(occupancy.status ?? "").toUpperCase();
            const isActive = !occupancy.endAt || status === "ACTIVE";
            return isActive && (
                residentId === editResident.user.id
                || (residentEmail && residentEmail === editResident.user.email)
            );
        }) ?? null;
    }, [buildingOccupanciesQuery.data, editResident]);
    const occupancyIdForVehicles = editResident?.occupancyId ?? resolvedOccupancy?.id ?? "";
    const occupancyVehiclesQuery = useOccupancyVehicles(occupancyIdForVehicles, { enabled: Boolean(occupancyIdForVehicles) });
    const occupancyAllocationsQuery = useOccupancyParkingAllocations(occupancyIdForVehicles, {
        active: true,
        enabled: Boolean(occupancyIdForVehicles),
    });
    const createVehicleMutation = useCreateVehicle();
    const updateVehicleMutation = useUpdateVehicle();
    const deleteVehicleMutation = useDeleteVehicle();
    const isOccupancyLookupLoading =
        Boolean(editResident)
        && editResident?.hasActiveOccupancy
        && !editResident?.occupancyId
        && buildingOccupanciesQuery.isLoading;
    const buildingNameById = useMemo(() => {
        return (buildings || []).reduce<Record<string, string>>((acc, building) => {
            acc[building.id] = building.name;
            return acc;
        }, {});
    }, [buildings]);

    const buildingOptions = useMemo(
        () => (buildings || []).map((building) => ({ id: building.id, name: building.name })),
        [buildings]
    );

    useEffect(() => {
        if (selectedBuildingId || buildingOptions.length === 0) return;
        setSelectedBuildingId(buildingOptions[0].id);
    }, [buildingOptions, selectedBuildingId]);

    const trimmedSearch = search.trim();

    const residentDirectoryQuery = useResidentDirectory(selectedBuildingId, {
        q: trimmedSearch || undefined,
        status: "ACTIVE",
        limit: 100,
        includeProfile: false,
        enabled: activeTab === "ACTIVE" && Boolean(selectedBuildingId),
    });
    const residentDirectoryByUserId = useMemo(() => {
        const map = new Map<string, ResidentDirectoryRow>();
        (residentDirectoryQuery.data?.items || []).forEach((row) => {
            if (!row.residentUserId) return;
            if (!map.has(row.residentUserId)) {
                map.set(row.residentUserId, row);
            }
        });
        return map;
    }, [residentDirectoryQuery.data]);

    const [activeCursor, setActiveCursor] = useState<string | null>(null);
    const [activeResidents, setActiveResidents] = useState<OrgResidentListItem[]>([]);
    const [activeNextCursor, setActiveNextCursor] = useState<string | null>(null);

    const [newCursor, setNewCursor] = useState<string | null>(null);
    const [newResidents, setNewResidents] = useState<OrgResidentListItem[]>([]);
    const [newNextCursor, setNewNextCursor] = useState<string | null>(null);

    const [formerCursor, setFormerCursor] = useState<string | null>(null);
    const [formerResidents, setFormerResidents] = useState<OrgResidentListItem[]>([]);
    const [formerNextCursor, setFormerNextCursor] = useState<string | null>(null);

    useEffect(() => {
        setActiveCursor(null);
        setActiveResidents([]);
        setActiveNextCursor(null);
        setNewCursor(null);
        setNewResidents([]);
        setNewNextCursor(null);
        setFormerCursor(null);
        setFormerResidents([]);
        setFormerNextCursor(null);
    }, [trimmedSearch]);

    const activeQuery = useOrgResidents(
        {
            status: tabConfig.ACTIVE.status,
            q: trimmedSearch || undefined,
            limit: 50,
            cursor: activeCursor ?? undefined,
            includeProfile: true,
        },
        { enabled: activeTab === "ACTIVE" }
    );

    const newQuery = useOrgResidents(
        {
            status: tabConfig.NEW.status,
            q: trimmedSearch || undefined,
            limit: 50,
            cursor: newCursor ?? undefined,
            includeProfile: true,
        },
        { enabled: activeTab === "NEW" }
    );

    const formerQuery = useOrgResidents(
        {
            status: tabConfig.FORMER.status,
            q: trimmedSearch || undefined,
            limit: 50,
            cursor: formerCursor ?? undefined,
            includeProfile: true,
        },
        { enabled: activeTab === "FORMER" }
    );

    useEffect(() => {
        const data = activeQuery.data as OrgResidentsResponse | undefined;
        if (!data) return;
        setActiveNextCursor(data.nextCursor ?? null);
        if (!activeCursor) {
            setActiveResidents(data.items || []);
            return;
        }
        setActiveResidents((prev) => mergeByUserId(prev, data.items || []));
    }, [activeQuery.data, activeCursor]);

    useEffect(() => {
        const data = newQuery.data as OrgResidentsResponse | undefined;
        if (!data) return;
        setNewNextCursor(data.nextCursor ?? null);
        if (!newCursor) {
            setNewResidents(data.items || []);
            return;
        }
        setNewResidents((prev) => mergeByUserId(prev, data.items || []));
    }, [newQuery.data, newCursor]);

    useEffect(() => {
        const data = formerQuery.data as OrgResidentsResponse | undefined;
        if (!data) return;
        setFormerNextCursor(data.nextCursor ?? null);
        if (!formerCursor) {
            setFormerResidents(data.items || []);
            return;
        }
        setFormerResidents((prev) => mergeByUserId(prev, data.items || []));
    }, [formerQuery.data, formerCursor]);

    useEffect(() => {
        if (!editResident) {
            setEditValues(emptyForm);
            setEditProfileValues(emptyProfileForm);
            return;
        }
        const profile = residentUserQuery.data;
        const residentProfile = editResident.residentProfile;
        setEditValues({
            name: profile?.name ?? editResident.user.name ?? "",
            email: profile?.email ?? editResident.user.email ?? "",
            phoneNumber: profile?.phoneNumber ?? editResident.user.phoneNumber ?? "",
            avatarUrl: profile?.avatarUrl ?? editResident.user.avatarUrl ?? "",
            isActive: typeof profile?.isActive === "boolean"
                ? profile.isActive
                : (typeof editResident.user.isActive === "boolean" ? editResident.user.isActive : true),
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

    const openMoveInDialog = (resident?: OrgResidentListItem | null) => {
        if (!selectedBuildingId) {
            toast.error("Select a building before moving in a resident.");
            return;
        }
        setIsMoveInOpen(!resident);
        setMoveInResident(resident ?? null);
    };

    const closeMoveIn = (open: boolean) => {
        if (!open) {
            setIsMoveInOpen(false);
            setMoveInResident(null);
        }
    };

    const openMoveOutDialog = async (resident: OrgResidentListItem) => {
        const directoryRow = residentDirectoryByUserId.get(resident.user.id);
        const context = getActiveOccupancyContext(resident, directoryRow, selectedBuildingId);
        const buildingId = context?.buildingId ?? selectedBuildingId;
        const unitId = context?.unitId;
        if (!buildingId || !unitId) {
            toast.error("Resident has no unit assigned");
            return;
        }
        setMoveOutLoadingId(resident.user.id);
        try {
            const lease = await queryClient.fetchQuery({
                queryKey: ["leases", "active", buildingId, unitId],
                queryFn: () => getActiveLeaseForUnit(buildingId, unitId),
            });
            if (!lease) {
                toast.error("No active lease found for this unit");
                return;
            }
            setMoveOutContext({
                resident,
                leaseId: lease.id,
                unitId,
                unitLabel: context?.unitLabel,
                buildingId,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load lease";
            toast.error(message);
        } finally {
            setMoveOutLoadingId(null);
        }
    };

    const openTransferDialog = async (resident: OrgResidentListItem) => {
        const directoryRow = residentDirectoryByUserId.get(resident.user.id);
        const context = getActiveOccupancyContext(resident, directoryRow, selectedBuildingId);
        const buildingId = context?.buildingId ?? selectedBuildingId;
        const unitId = context?.unitId;
        if (!buildingId || !unitId) {
            toast.error("Resident has no unit assigned");
            return;
        }
        setMoveOutLoadingId(resident.user.id);
        try {
            const lease = await queryClient.fetchQuery({
                queryKey: ["leases", "active", buildingId, unitId],
                queryFn: () => getActiveLeaseForUnit(buildingId, unitId),
            });
            if (!lease) {
                toast.message("No active lease found — opening transfer without move-out.");
                setTransferContext({
                    resident,
                    unitId,
                    unitLabel: context?.unitLabel,
                    buildingId,
                });
                setMoveInResident(resident);
                return;
            }
            setTransferContext({
                resident,
                leaseId: lease.id,
                unitId,
                unitLabel: context?.unitLabel,
                buildingId,
            });
            setMoveInResident(resident);
        } catch (error) {
            toast.message("No active lease found — opening transfer without move-out.");
            setTransferContext({
                resident,
                unitId,
                unitLabel: context?.unitLabel,
                buildingId,
            });
            setMoveInResident(resident);
        } finally {
            setMoveOutLoadingId(null);
        }
    };

    const handleSaveResident = async () => {
        if (!editResident) return;
        try {
            const dateOfBirth =
                editProfileValues.dateOfBirth && editProfileValues.dateOfBirth.trim()
                    ? new Date(editProfileValues.dateOfBirth).toISOString()
                    : undefined;
            await updateResidentProfileMutation.mutateAsync({
                userId: editResident.user.id,
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
            await queryClient.invalidateQueries({ queryKey: ["org-residents"] });
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

    const renderTable = (
        tab: OrgResidentsTab,
        residents: OrgResidentListItem[],
        isLoading: boolean,
        isFetching: boolean,
        nextCursor: string | null,
        onLoadMore: () => void
    ) => {
        if (isLoading) {
            return (
                <div className="space-y-3">
                    {[1, 2, 3, 4].map((item) => (
                        <div key={item} className="rounded-lg border border-zinc-200 bg-white p-4">
                            <Skeleton className="h-4 w-1/3" />
                            <Skeleton className="mt-2 h-3 w-1/2" />
                            <Skeleton className="mt-3 h-3 w-2/3" />
                        </div>
                    ))}
                </div>
            );
        }

        if (residents.length === 0) {
            return (
                <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-10 text-center text-sm text-zinc-500">
                    {tabConfig[tab].emptyLabel}
                </div>
            );
        }

        return (
            <div className="space-y-4">
                <div className="rounded-lg border border-zinc-200 bg-white">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead>Resident</TableHead>
                                <TableHead>Occupancy</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {residents.map((resident) => {
                                const status = resident.residentStatus ?? tab;
                                const directoryRow = residentDirectoryByUserId.get(resident.user.id);
                                const occupancy =
                                    tab === "ACTIVE"
                                        ? getCurrentOccupancySummary(resident, directoryRow, buildingNameById[selectedBuildingId])
                                        : tab === "FORMER"
                                            ? getFormerOccupancySummary(resident)
                                            : "Not moved in yet";
                                const formerActiveLeaseNote =
                                    tab === "FORMER" && directoryRow
                                        ? `Active lease in ${buildingNameById[selectedBuildingId] || "selected building"}${directoryRow.unitLabel ? ` - Unit ${directoryRow.unitLabel}` : ""}`
                                        : "";
                                const leaseSummary = directoryRow?.lease
                                    ? `${formatDate(directoryRow.lease.leaseStartDate)} → ${formatDate(directoryRow.lease.leaseEndDate)}`
                                    : "";
                                return (
                                    <TableRow key={resident.user.id}>
                                        <TableCell>
                                            <div className="text-sm font-medium text-zinc-900">{resident.user.name}</div>
                                            <div className="text-xs text-zinc-500">{resident.user.email}</div>
                                        </TableCell>
                                        <TableCell className="text-sm text-zinc-700">
                                            <div>{occupancy}</div>
                                            {tab === "ACTIVE" && leaseSummary ? (
                                                <div className="text-xs text-zinc-500">
                                                    Lease: {leaseSummary}
                                                    {leaseBasePath && directoryRow?.lease?.leaseId ? (
                                                        <>
                                                            {" · "}
                                                            <Link
                                                                href={`${leaseBasePath}/${directoryRow.lease.leaseId}`}
                                                                className="text-blue-600 hover:underline"
                                                            >
                                                                View lease
                                                            </Link>
                                                        </>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                            {formerActiveLeaseNote ? (
                                                <div className="text-xs font-medium text-amber-600">
                                                    {formerActiveLeaseNote}
                                                    {leaseBasePath && directoryRow?.lease?.leaseId ? (
                                                        <>
                                                            {" · "}
                                                            <Link
                                                                href={`${leaseBasePath}/${directoryRow.lease.leaseId}`}
                                                                className="text-amber-600 hover:underline"
                                                            >
                                                                View lease
                                                            </Link>
                                                        </>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">
                                                {String(status).toUpperCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-zinc-600">
                                            {resident.user.phoneNumber || "-"}
                                        </TableCell>
                                        <TableCell className="text-sm text-zinc-600">
                                            {formatDate(resident.user.createdAt)}
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
                                                    {tab === "ACTIVE" ? (
                                                        <>
                                                            <DropdownMenuItem
                                                                onClick={() => openTransferDialog(resident)}
                                                                disabled={moveOutLoadingId === resident.user.id}
                                                            >
                                                                {moveOutLoadingId === resident.user.id ? "Loading lease..." : "Transfer Unit"}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => openMoveOutDialog(resident)}
                                                                disabled={moveOutLoadingId === resident.user.id}
                                                            >
                                                                {moveOutLoadingId === resident.user.id ? "Loading lease..." : "Move Out"}
                                                            </DropdownMenuItem>
                                                        </>
                                                    ) : (
                                                        <DropdownMenuItem
                                                            onClick={() => openMoveInDialog(resident)}
                                                            disabled={!selectedBuildingId}
                                                        >
                                                            Move In
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
                {nextCursor ? (
                    <div className="flex justify-center">
                        <Button variant="outline" onClick={onLoadMore} disabled={isFetching}>
                            {isFetching ? "Loading..." : "Load more"}
                        </Button>
                    </div>
                ) : null}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{title}</h1>
                        <p className="mt-1 text-sm text-zinc-500">
                            Manage resident profiles and occupancy status across your organization.
                        </p>
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
                        <Button variant="outline" onClick={() => setIsAddTenantOpen(true)}>
                            <UserPlus className="mr-2 h-4 w-4" /> Add Tenant
                        </Button>
                        <Button onClick={() => openMoveInDialog(null)} disabled={!selectedBuildingId}>
                            <UserRound className="mr-2 h-4 w-4" /> Move In Tenant
                        </Button>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as OrgResidentsTab)} className="w-full">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-sm font-semibold text-zinc-900">Residents</h2>
                            <p className="text-xs text-zinc-400">Filter by residency status.</p>
                        </div>
                        <TabsList className="rounded-lg bg-zinc-100 p-1">
                            {Object.entries(tabConfig).map(([key, config]) => (
                                <TabsTrigger key={key} value={key}>
                                    {config.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                            <Input
                                placeholder="Search residents..."
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>

                    <TabsContent value="ACTIVE" className="mt-6">
                        {renderTable(
                            "ACTIVE",
                            activeResidents,
                            activeQuery.isLoading,
                            activeQuery.isFetching,
                            activeNextCursor,
                            () => setActiveCursor(activeNextCursor)
                        )}
                    </TabsContent>
                    <TabsContent value="NEW" className="mt-6">
                        {renderTable(
                            "NEW",
                            newResidents,
                            newQuery.isLoading,
                            newQuery.isFetching,
                            newNextCursor,
                            () => setNewCursor(newNextCursor)
                        )}
                    </TabsContent>
                    <TabsContent value="FORMER" className="mt-6">
                        {renderTable(
                            "FORMER",
                            formerResidents,
                            formerQuery.isLoading,
                            formerQuery.isFetching,
                            formerNextCursor,
                            () => setFormerCursor(formerNextCursor)
                        )}
                    </TabsContent>
                </Tabs>
            </div>

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
                        buildingId={transferContext.buildingId}
                        defaultResidentUserId={moveInResident.user.id}
                        defaultResidentName={moveInResident.user.name}
                        defaultResidentEmail={moveInResident.user.email}
                        transferFrom={{
                            leaseId: transferContext.leaseId,
                            unitId: transferContext.unitId,
                            unitLabel: transferContext.unitLabel,
                        }}
                    />
                ) : (
                    <MoveInDialog
                        open={Boolean(moveInResident) || isMoveInOpen}
                        onOpenChange={closeMoveIn}
                        buildingId={selectedBuildingId}
                        defaultResidentUserId={moveInResident?.user.id}
                        defaultResidentName={moveInResident?.user.name}
                        defaultResidentEmail={moveInResident?.user.email}
                    />
                )
            ) : null}

            <CreateTenantDialog open={isAddTenantOpen} onOpenChange={setIsAddTenantOpen} />

            {moveOutContext ? (
                <MoveOutDialog
                    open={Boolean(moveOutContext)}
                    onOpenChange={handleMoveOutClosed}
                    buildingId={moveOutContext.buildingId}
                    leaseId={moveOutContext.leaseId}
                    unitId={moveOutContext.unitId}
                    unitLabel={moveOutContext.unitLabel}
                    residentName={moveOutContext.resident.user.name}
                />
            ) : null}

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
                                disabled
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Email</label>
                            <Input
                                type="email"
                                value={editValues.email}
                                onChange={(event) => setEditValues((prev) => ({ ...prev, email: event.target.value }))}
                                disabled
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Phone</label>
                            <Input
                                value={editValues.phoneNumber}
                                onChange={(event) => setEditValues((prev) => ({ ...prev, phoneNumber: event.target.value }))}
                                disabled
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Avatar URL</label>
                            <Input
                                value={editValues.avatarUrl}
                                onChange={(event) => setEditValues((prev) => ({ ...prev, avatarUrl: event.target.value }))}
                                placeholder="https://..."
                                disabled
                            />
                        </div>
                        <label className="flex items-center gap-2 text-sm text-zinc-500">
                            <input
                                type="checkbox"
                                checked={editValues.isActive}
                                onChange={(event) => setEditValues((prev) => ({ ...prev, isActive: event.target.checked }))}
                                className="rounded border-zinc-300"
                                disabled
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
                                onChange={(event) =>
                                    setEditProfileValues((prev) => ({ ...prev, emiratesIdNumber: event.target.value }))
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Passport Number</label>
                            <Input
                                value={editProfileValues.passportNumber}
                                onChange={(event) =>
                                    setEditProfileValues((prev) => ({ ...prev, passportNumber: event.target.value }))
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nationality</label>
                            <Input
                                value={editProfileValues.nationality}
                                onChange={(event) =>
                                    setEditProfileValues((prev) => ({ ...prev, nationality: event.target.value }))
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Date of Birth</label>
                            <Input
                                type="date"
                                value={editProfileValues.dateOfBirth}
                                onChange={(event) =>
                                    setEditProfileValues((prev) => ({ ...prev, dateOfBirth: event.target.value }))
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Current Address</label>
                            <Input
                                value={editProfileValues.currentAddress}
                                onChange={(event) =>
                                    setEditProfileValues((prev) => ({ ...prev, currentAddress: event.target.value }))
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Emergency Contact Name</label>
                            <Input
                                value={editProfileValues.emergencyContactName}
                                onChange={(event) =>
                                    setEditProfileValues((prev) => ({ ...prev, emergencyContactName: event.target.value }))
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Emergency Contact Phone</label>
                            <Input
                                value={editProfileValues.emergencyContactPhone}
                                onChange={(event) =>
                                    setEditProfileValues((prev) => ({ ...prev, emergencyContactPhone: event.target.value }))
                                }
                            />
                        </div>
                        <div className="pt-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Vehicles</div>
                        </div>
                        {occupancyIdForVehicles ? (
                            <div className="space-y-3">
                                {occupancyVehiclesQuery.isLoading || occupancyAllocationsQuery.isLoading ? (
                                    <div className="text-sm text-zinc-500">Loading vehicles...</div>
                                ) : (occupancyVehiclesQuery.data || []).length > 0 ? (
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
                                ) : null}

                                {(occupancyVehiclesQuery.data || []).length === 0 && (occupancyAllocationsQuery.data || []).length === 0 ? (
                                    <div className="text-sm text-zinc-500">No vehicles registered.</div>
                                ) : null}

                                <div className="flex items-center gap-2">
                                    <Input
                                        placeholder="Plate number"
                                        value={newVehiclePlate}
                                        onChange={(event) => setNewVehiclePlate(event.target.value)}
                                    />
                                    <Button
                                        onClick={async () => {
                                            const plate = newVehiclePlate.trim();
                                            if (!plate) {
                                                toast.error("Plate number is required.");
                                                return;
                                            }
                                            if (!occupancyIdForVehicles) {
                                                toast.error("No active occupancy found for this resident.");
                                                return;
                                            }
                                            try {
                                                await createVehicleMutation.mutateAsync({
                                                    occupancyId: occupancyIdForVehicles,
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

                                {(occupancyAllocationsQuery.data || []).length > 0 ? (
                                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                                        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                            Allocated Parking Slots
                                        </div>
                                        <div className="mt-2 space-y-2">
                                            {(occupancyAllocationsQuery.data || []).map((allocation) => (
                                                <div key={allocation.id} className="flex items-center justify-between text-sm text-zinc-700">
                                                    <span className="font-medium text-zinc-900">{allocation.slot.code}</span>
                                                    <span className="text-xs text-zinc-500">
                                                        {allocation.slot.level || "No level"} &middot; {allocation.slot.type}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <div className="text-sm text-zinc-500">
                                {isOccupancyLookupLoading ? "Loading occupancy..." : "No active occupancy found for this resident."}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditResident(null)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveResident}
                            disabled={updateResidentProfileMutation.isPending}
                        >
                            {updateResidentProfileMutation.isPending ? "Saving..." : "Save changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
