"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, MoreVertical, Plus, ParkingSquare, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { getUserPermissionSet, hasAnyPermission } from "@/lib/permissions";
import { getPortalModuleByKey } from "@/lib/portalRegistry";
import {
    useAccessibleBuildings,
    useBuildingUnits,
    useBuildingOccupancies,
    useBuildingResidents,
    useParkingSlots,
    useUpdateParkingSlot,
} from "@/lib/queries";
import { getOccupancyParkingAllocations, getOccupancyVehicles, getUnitParkingAllocations } from "@/lib/api/parking";
import { importParkingSlotsCsv } from "@/lib/api/units";
import type { ParkingAllocation, ParkingSlot, ParkingSlotsImportMode, ParkingSlotsImportResponse } from "@/lib/types";
import { AllocateParkingDialog } from "./AllocateParkingDialog";
import { CreateParkingSlotSheet } from "./CreateParkingSlotSheet";

const SEARCH_DEBOUNCE_MS = 300;
const ALLOCATION_CONCURRENCY = 2;
const PAGE_SIZE = 20;

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

export function ParkingPage({ title = "Parking" }: { title?: string }) {
    const { user, baseRole } = useAuth();
    const permissionSet = getUserPermissionSet(user);
    const parkingModuleRule = getPortalModuleByKey("parking")?.rule;
    const canReadParking = Boolean(parkingModuleRule && hasAnyPermission(permissionSet, parkingModuleRule));
    const accessibleBuildingsQuery = useAccessibleBuildings(user?.id, baseRole, { enabled: canReadParking });
    const buildings = accessibleBuildingsQuery.data;
    const queryClient = useQueryClient();

    const [selectedBuildingId, setSelectedBuildingId] = useState("");
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "available" | "occupied">("all");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [levelFilter, setLevelFilter] = useState<string>("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [showCreateSheet, setShowCreateSheet] = useState(false);
    const [editSlot, setEditSlot] = useState<ParkingSlot | null>(null);
    const [allocateSlotId, setAllocateSlotId] = useState<string | null>(null);
    const [isAllocateOpen, setIsAllocateOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importMode, setImportMode] = useState<ParkingSlotsImportMode>("create");
    const [validationResult, setValidationResult] = useState<ParkingSlotsImportResponse | null>(null);
    const [isValidating, setIsValidating] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    const importSummaryStats = useMemo(() => {
        if (!validationResult) return null;
        const summary = validationResult.summary ?? {};
        const errorCount = validationResult.errors.length;
        const failed = summary.failed ?? errorCount;
        const totalRows =
            summary.totalRows ??
            summary.total ??
            (summary.validRows != null ? summary.validRows + failed : undefined) ??
            0;
        const validRows =
            summary.validRows ??
            (totalRows ? Math.max(totalRows - failed, 0) : 0);
        return {
            totalRows,
            validRows,
            created: summary.created ?? 0,
            updated: summary.updated ?? 0,
            errors: errorCount,
        };
    }, [validationResult]);

    const buildingOptions = useMemo(
        () => (buildings || []).map((building) => ({ id: building.id, name: building.name })),
        [buildings]
    );

    useEffect(() => {
        if (selectedBuildingId || buildingOptions.length === 0) return;
        setSelectedBuildingId(buildingOptions[0].id);
    }, [buildingOptions, selectedBuildingId]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setDebouncedSearch(search.trim());
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timeout);
    }, [search]);

    useEffect(() => {
        resetImportState();
    }, [selectedBuildingId]);

    const resetImportState = () => {
        setImportFile(null);
        setValidationResult(null);
        setIsValidating(false);
        setIsImporting(false);
    };

    const { data: parkingSlots } = useParkingSlots(selectedBuildingId, { enabled: canReadParking && Boolean(selectedBuildingId) });
    const { data: availableSlots } = useParkingSlots(selectedBuildingId, { available: true, enabled: canReadParking && Boolean(selectedBuildingId) });
    const { data: units } = useBuildingUnits(selectedBuildingId, { enabled: canReadParking && Boolean(selectedBuildingId) });
    const { data: occupancies } = useBuildingOccupancies(selectedBuildingId, { enabled: canReadParking && Boolean(selectedBuildingId) });
    const { data: residents } = useBuildingResidents(selectedBuildingId, { enabled: canReadParking && Boolean(selectedBuildingId) });

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

    const availableTypes = useMemo(() => {
        if (!parkingSlots) return [];
        const types = new Set<string>();
        parkingSlots.forEach((slot) => {
            if (slot.type) types.add(slot.type);
        });
        return Array.from(types).sort();
    }, [parkingSlots]);

    const availableLevels = useMemo(() => {
        if (!parkingSlots) return [];
        const levels = new Set<string>();
        parkingSlots.forEach((slot) => {
            if (slot.level) levels.add(slot.level);
        });
        return Array.from(levels).sort();
    }, [parkingSlots]);
    const activeBuildingLabel = useMemo(
        () => buildingOptions.find((building) => building.id === selectedBuildingId)?.name ?? "Select building",
        [buildingOptions, selectedBuildingId]
    );

    const handleValidateImport = async () => {
        if (!selectedBuildingId) {
            toast.error("Select a building first");
            return;
        }
        if (!importFile) {
            toast.error("Choose a CSV file to validate");
            return;
        }
        try {
            setIsValidating(true);
            const result = await importParkingSlotsCsv(selectedBuildingId, importFile, {
                dryRun: true,
                mode: importMode,
            });
            setValidationResult(result);
            if (result.errors.length > 0) {
                toast.error(`Validation found ${result.errors.length} error(s)`);
            } else {
                toast.success("Validation passed. Ready to import.");
            }
        } catch (error: any) {
            toast.error(error?.message || "Failed to validate import");
        } finally {
            setIsValidating(false);
        }
    };

    const handleConfirmImport = async () => {
        if (!selectedBuildingId || !importFile) return;
        if (!validationResult || validationResult.errors.length > 0) return;
        try {
            setIsImporting(true);
            const result = await importParkingSlotsCsv(selectedBuildingId, importFile, {
                mode: importMode,
            });
            await queryClient.invalidateQueries({ queryKey: ["parking-slots", selectedBuildingId] });
            const created = result.summary.created ?? 0;
            const updated = result.summary.updated ?? 0;
            toast.success(`Import complete. Created: ${created}, Updated: ${updated}`);
            setIsImportOpen(false);
            resetImportState();
        } catch (error: any) {
            toast.error(error?.message || "Failed to import slots");
        } finally {
            setIsImporting(false);
        }
    };

    const availableSlotIds = useMemo(() => {
        return new Set((availableSlots || []).map((slot) => slot.id));
    }, [availableSlots]);

    const normalizeUnitKey = (value?: string) => {
        if (!value) return "";
        return value.toLowerCase().replace(/[^a-z0-9]/g, "");
    };

    const unitById = useMemo(() => {
        return new Map((units || []).map((unit) => [unit.id, unit]));
    }, [units]);

    const unitIdByLabelKey = useMemo(() => {
        const map = new Map<string, string>();
        (units || []).forEach((unit) => {
            const key = normalizeUnitKey(unit.label);
            if (key) map.set(key, unit.id);
        });
        return map;
    }, [units]);

    const occupancyById = useMemo(() => {
        return new Map((occupancies || []).map((occupancy) => [occupancy.id, occupancy]));
    }, [occupancies]);

    const residentById = useMemo(() => {
        const map = new Map<string, { name?: string; email?: string }>();
        (residents || []).forEach((resident) => {
            if (!resident.userId) return;
            map.set(resident.userId, { name: resident.name, email: resident.email });
        });
        return map;
    }, [residents]);

    const residentByEmail = useMemo(() => {
        const map = new Map<string, { name?: string; email?: string }>();
        (residents || []).forEach((resident) => {
            if (!resident.email) return;
            map.set(resident.email.toLowerCase(), { name: resident.name, email: resident.email });
        });
        return map;
    }, [residents]);

    const activeOccupancies = useMemo(() => {
        return (occupancies || []).filter((occ) => occ.status === "ACTIVE" || !occ.endAt);
    }, [occupancies]);

    const activeOccupanciesByUnitId = useMemo(() => {
        const map = new Map<string, typeof activeOccupancies>();
        activeOccupancies.forEach((occ) => {
            if (!occ.unitId) return;
            const list = map.get(occ.unitId) ?? [];
            list.push(occ);
            map.set(occ.unitId, list);
        });
        return map;
    }, [activeOccupancies]);

    const unitIdsForUnitAllocations = useMemo(() => {
        // Only fetch unit allocations for units with active occupancies to reduce API calls
        return Array.from(activeOccupanciesByUnitId.keys());
    }, [activeOccupanciesByUnitId]);

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

    const fetchAllocationsForUnits = useCallback(
        async (unitIds: string[]) => {
            const allocationsByUnit = new Map<string, ParkingAllocation[]>();
            const missing: string[] = [];

            unitIds.forEach((unitId) => {
                const cached = queryClient.getQueryData([
                    "unit-parking-allocations",
                    unitId,
                ]) as ParkingAllocation[] | undefined;
                if (cached) {
                    allocationsByUnit.set(unitId, cached);
                } else {
                    missing.push(unitId);
                }
            });

            for (let i = 0; i < missing.length; i += ALLOCATION_CONCURRENCY) {
                const chunk = missing.slice(i, i + ALLOCATION_CONCURRENCY);
                const chunkResults = await Promise.all(chunk.map((unitId) => getUnitParkingAllocations(unitId)));
                chunk.forEach((unitId, index) => {
                    const list = chunkResults[index] ?? [];
                    allocationsByUnit.set(unitId, list);
                    queryClient.setQueryData([
                        "unit-parking-allocations",
                        unitId,
                    ], list);
                });
            }

            return allocationsByUnit;
        },
        [queryClient]
    );

    const slotUnitLabelsQuery = useQuery({
        queryKey: [
            "parking-slot-unit-labels",
            selectedBuildingId,
            activeOccupancies.length,
            units?.length ?? 0,
            occupancies?.length ?? 0,
            parkingSlots?.length ?? 0,
            residents?.length ?? 0,
        ],
        queryFn: async () => {
            if (!selectedBuildingId || !units || !occupancies || !parkingSlots) {
                return {
                    slotUnitLabelsMap: new Map<string, string[]>(),
                    slotResidentLabelsMap: new Map<string, string[]>(),
                    slotAllocationMetaMap: new Map<string, { occupancyId?: string; unitId?: string }>(),
                    occupancyIds: [] as string[],
                };
            }
            const occupancyIds = activeOccupancies.map((occ) => occ.id).filter(Boolean);
            const allocationsByOccupancy = await fetchAllocationsForOccupancies(occupancyIds);
            const allocationsByUnit = unitIdsForUnitAllocations.length
                ? await fetchAllocationsForUnits(unitIdsForUnitAllocations)
                : new Map<string, ParkingAllocation[]>();

            const slotToUnits = new Map<string, Set<string>>();
            const slotToResidents = new Map<string, Set<string>>();
            const addLabel = (slotId: string | undefined, label: string | undefined) => {
                if (!slotId || !label) return;
                const next = slotToUnits.get(slotId) ?? new Set<string>();
                next.add(label);
                slotToUnits.set(slotId, next);
            };
            const addResident = (slotId: string | undefined, label: string | undefined) => {
                if (!slotId || !label) return;
                const next = slotToResidents.get(slotId) ?? new Set<string>();
                next.add(label);
                slotToResidents.set(slotId, next);
            };
            const slotAllocationMetaMap = new Map<string, { occupancyId?: string; unitId?: string }>();
            const occupancyIdsWithAllocations = new Set<string>();
            const addMeta = (slotId: string | undefined, meta: { occupancyId?: string; unitId?: string }) => {
                if (!slotId) return;
                const existing = slotAllocationMetaMap.get(slotId) ?? {};
                if (meta.occupancyId) {
                    existing.occupancyId = meta.occupancyId;
                }
                if (meta.unitId && !existing.unitId) {
                    existing.unitId = meta.unitId;
                }
                slotAllocationMetaMap.set(slotId, existing);
            };

            allocationsByOccupancy.forEach((allocations, occupancyId) => {
                const occupancy = occupancyById.get(occupancyId);
                const unitId = occupancy?.unitId;
                // Use nested unit object first, then fall back to lookup
                const unitLabel = occupancy?.unit?.label || occupancy?.unitLabel || (unitId ? unitById.get(unitId)?.label : undefined);
                const residentFromId = occupancy?.residentUserId ? residentById.get(occupancy.residentUserId) : undefined;
                const residentFromEmail = occupancy?.residentEmail
                    ? residentByEmail.get(occupancy.residentEmail.toLowerCase())
                    : undefined;
                // Use nested resident object first, then fall back to flat fields and lookups
                const residentLabel =
                    occupancy?.resident?.name ||
                    occupancy?.residentName ||
                    residentFromId?.name ||
                    residentFromEmail?.name ||
                    occupancy?.resident?.email ||
                    occupancy?.residentEmail ||
                    residentFromId?.email ||
                    residentFromEmail?.email;
                allocations.forEach((allocation) => {
                    const slotId = allocation.slot?.id ?? allocation.parkingSlotId;
                    addLabel(slotId, unitLabel);
                    addResident(slotId, residentLabel);
                    addMeta(slotId, { occupancyId, unitId });
                    occupancyIdsWithAllocations.add(occupancyId);
                });
            });

            allocationsByUnit.forEach((allocations, unitId) => {
                const occupanciesForUnit = activeOccupanciesByUnitId.get(unitId) ?? [];
                const primaryOccupancy = occupanciesForUnit[0];
                // Use nested unit object first, then fall back to lookup
                const unitLabel = primaryOccupancy?.unit?.label || primaryOccupancy?.unitLabel || unitById.get(unitId)?.label;
                const residentFromId = primaryOccupancy?.residentUserId
                    ? residentById.get(primaryOccupancy.residentUserId)
                    : undefined;
                const residentFromEmail = primaryOccupancy?.residentEmail
                    ? residentByEmail.get(primaryOccupancy.residentEmail.toLowerCase())
                    : undefined;
                // Use nested resident object first, then fall back to flat fields and lookups
                const residentLabel =
                    primaryOccupancy?.resident?.name ||
                    primaryOccupancy?.residentName ||
                    residentFromId?.name ||
                    residentFromEmail?.name ||
                    primaryOccupancy?.resident?.email ||
                    primaryOccupancy?.residentEmail ||
                    residentFromId?.email ||
                    residentFromEmail?.email;
                allocations.forEach((allocation) => {
                    const slotId = allocation.slot?.id ?? allocation.parkingSlotId;
                    addLabel(slotId, unitLabel);
                    addResident(slotId, residentLabel);
                    addMeta(slotId, { unitId, occupancyId: primaryOccupancy?.id });
                });
                occupanciesForUnit.forEach((occ) => {
                    occupancyIdsWithAllocations.add(occ.id);
                });
            });

            parkingSlots.forEach((slot) => {
                if (slotToUnits.has(slot.id) || slotToResidents.has(slot.id)) return;
                const normalizedCode = normalizeUnitKey(slot.code);
                const match = normalizedCode.match(/^(.+)p\d+/);
                const unitKey = match && match[1] ? match[1] : normalizedCode;
                const unitId = unitIdByLabelKey.get(unitKey);
                if (!unitId) return;
                const occupanciesForUnit = activeOccupanciesByUnitId.get(unitId) ?? [];
                const primaryOccupancy = occupanciesForUnit[0];
                // Use nested unit object first, then fall back to lookup
                const unitLabel = primaryOccupancy?.unit?.label || primaryOccupancy?.unitLabel || unitById.get(unitId)?.label;
                addLabel(slot.id, unitLabel);
                const residentFromId = primaryOccupancy?.residentUserId
                    ? residentById.get(primaryOccupancy.residentUserId)
                    : undefined;
                const residentFromEmail = primaryOccupancy?.residentEmail
                    ? residentByEmail.get(primaryOccupancy.residentEmail.toLowerCase())
                    : undefined;
                // Use nested resident object first, then fall back to flat fields and lookups
                const residentLabel =
                    primaryOccupancy?.resident?.name ||
                    primaryOccupancy?.residentName ||
                    residentFromId?.name ||
                    residentFromEmail?.name ||
                    primaryOccupancy?.resident?.email ||
                    primaryOccupancy?.residentEmail ||
                    residentFromId?.email ||
                    residentFromEmail?.email;
                addResident(slot.id, residentLabel);
                addMeta(slot.id, { unitId, occupancyId: primaryOccupancy?.id });
                if (primaryOccupancy?.id) occupancyIdsWithAllocations.add(primaryOccupancy.id);
            });

            const result = new Map<string, string[]>();
            slotToUnits.forEach((labels, slotId) => {
                result.set(slotId, Array.from(labels));
            });
            const residentResult = new Map<string, string[]>();
            slotToResidents.forEach((labels, slotId) => {
                residentResult.set(slotId, Array.from(labels));
            });
            return {
                slotUnitLabelsMap: result,
                slotResidentLabelsMap: residentResult,
                slotAllocationMetaMap,
                occupancyIds: Array.from(occupancyIdsWithAllocations),
            };
        },
        enabled: canReadParking && Boolean(selectedBuildingId && units && occupancies && parkingSlots),
        staleTime: 60_000,
    });

    const slotUnitLabelsMap = slotUnitLabelsQuery.data?.slotUnitLabelsMap ?? new Map<string, string[]>();
    const slotResidentLabelsMap = slotUnitLabelsQuery.data?.slotResidentLabelsMap ?? new Map<string, string[]>();
    const slotAllocationMetaMap = slotUnitLabelsQuery.data?.slotAllocationMetaMap ?? new Map<string, { occupancyId?: string; unitId?: string }>();
    const occupancyIdsForVehicles = slotUnitLabelsQuery.data?.occupancyIds ?? [];

    const vehicleQueries = useQueries({
        queries: occupancyIdsForVehicles.map((occupancyId) => ({
            queryKey: ["occupancy-vehicles", occupancyId],
            queryFn: () => getOccupancyVehicles(occupancyId),
            enabled: canReadParking && Boolean(selectedBuildingId && occupancyId),
            staleTime: 60_000,
        })),
    });

    const occupancyVehicleCounts = useMemo(() => {
        const map = new Map<string, { count: number; isLoading: boolean }>();
        occupancyIdsForVehicles.forEach((occupancyId, index) => {
            const query = vehicleQueries[index];
            const count = query?.data?.length ?? 0;
            map.set(occupancyId, { count, isLoading: Boolean(query?.isLoading) });
        });
        return map;
    }, [occupancyIdsForVehicles, vehicleQueries]);

    const vehiclesByOccupancyId = useMemo(() => {
        const map = new Map<string, string[]>();
        occupancyIdsForVehicles.forEach((occupancyId, index) => {
            const vehicles = vehicleQueries[index]?.data || [];
            const plates = vehicles.map((vehicle) => vehicle.plateNumber?.trim()).filter(Boolean) as string[];
            map.set(occupancyId, plates);
        });
        return map;
    }, [occupancyIdsForVehicles, vehicleQueries]);

    const slotVehicleLabels = useMemo(() => {
        const map = new Map<string, string>();
        slotAllocationMetaMap.forEach((meta, slotId) => {
            if (!meta.occupancyId) return;
            const plates = vehiclesByOccupancyId.get(meta.occupancyId) || [];
            if (plates.length > 0) {
                map.set(slotId, plates.join(", "));
            }
        });
        return map;
    }, [slotAllocationMetaMap, vehiclesByOccupancyId]);

    const filteredSlots = useMemo(() => {
        const term = debouncedSearch.trim().toLowerCase();
        const allSlots = parkingSlots || [];
        return allSlots
            .filter((slot) => {
                // Status filter
                if (statusFilter !== "all") {
                    const isAvailable = availableSlotIds.has(slot.id);
                    if (statusFilter === "available" && !isAvailable) return false;
                    if (statusFilter === "occupied" && isAvailable) return false;
                }
                // Type filter
                if (typeFilter !== "all" && slot.type !== typeFilter) return false;
                // Level filter
                if (levelFilter !== "all" && slot.level !== levelFilter) return false;
                // Search filter
                if (term) {
                    const unitLabels = slotUnitLabelsMap.get(slot.id) ?? [];
                    const residentLabels = slotResidentLabelsMap.get(slot.id) ?? [];
                    const vehicleLabels = slotVehicleLabels.get(slot.id) ?? "";
                    const haystack = `${slot.code} ${slot.level ?? ""} ${slot.type} ${slot.isActive ? "active" : "inactive"} ${unitLabels.join(" ")} ${residentLabels.join(" ")} ${vehicleLabels}`.toLowerCase();
                    const availability = availableSlotIds.has(slot.id) ? "available vacant" : "occupied allocated";
                    if (!haystack.includes(term) && !availability.includes(term)) return false;
                }
                return true;
            })
            .sort((a, b) => a.code.localeCompare(b.code));
    }, [debouncedSearch, parkingSlots, availableSlotIds, slotUnitLabelsMap, slotResidentLabelsMap, slotVehicleLabels, statusFilter, typeFilter, levelFilter]);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, statusFilter, typeFilter, levelFilter, selectedBuildingId]);

    // Pagination
    const totalPages = Math.ceil(filteredSlots.length / PAGE_SIZE);
    const paginatedSlots = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredSlots.slice(start, start + PAGE_SIZE);
    }, [filteredSlots, currentPage]);

    if (!canReadParking) {
        return (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                        <ParkingSquare className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-zinc-900">{title}</h1>
                        <p className="text-sm text-zinc-500">You do not have permission to view parking.</p>
                    </div>
                </div>
            </div>
        );
    }

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

    return (
        <div className="space-y-6">
            <section className="relative overflow-hidden rounded-[30px] border border-zinc-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.08),_transparent_34%),radial-gradient(circle_at_right_center,_rgba(15,23,42,0.03),_transparent_30%),linear-gradient(180deg,_#ffffff,_rgba(250,250,250,0.98))] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_16px_40px_rgba(0,0,0,0.04)]">
                <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.1),_transparent_68%)] lg:block" />
                <div className="relative flex flex-col gap-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="max-w-2xl">
                            <div className="inline-flex items-center rounded-full border border-emerald-200/70 bg-white/85 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-emerald-700 backdrop-blur">
                                Portfolio Operations
                            </div>
                            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-zinc-950 sm:text-[2rem]">
                                {title}
                            </h1>
                            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">
                                Manage parking slots, allocations, and availability across the building.
                            </p>
                        </div>

                        <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[340px]">
                            <div className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                                        <Building2 className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                                            Building Scope
                                        </div>
                                        <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId}>
                                            <SelectTrigger className="mt-2 h-11 border-zinc-200 bg-white text-sm text-zinc-900 shadow-none">
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
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <Button className="h-11 rounded-xl bg-zinc-950 px-5 text-white hover:bg-zinc-800" onClick={() => setShowCreateSheet(true)} disabled={!selectedBuildingId}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Slot
                                </Button>
                                <Button variant="outline" className="h-11 rounded-xl border-zinc-200 bg-white px-4" onClick={() => setIsImportOpen(true)} disabled={!selectedBuildingId}>
                                    Import Slots (CSV)
                                </Button>
                                <Button variant="outline" className="h-11 rounded-xl border-zinc-200 bg-white px-4" asChild>
                                    <a href="/parking_slots_import_template.csv" download>
                                        Download Template
                                    </a>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                        <ParkingSquare className="h-5 w-5" />
                    </div>
                    <div className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-zinc-950">{stats.total}</div>
                    <p className="mt-1 text-sm text-zinc-500">Total slots in scope</p>
                </div>
                <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                        <ParkingSquare className="h-5 w-5" />
                    </div>
                    <div className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-zinc-950">{stats.available}</div>
                    <p className="mt-1 text-sm text-zinc-500">Available slots</p>
                </div>
                <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-700">
                        <ParkingSquare className="h-5 w-5" />
                    </div>
                    <div className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-zinc-950">{stats.occupied}</div>
                    <p className="mt-1 text-sm text-zinc-500">Occupied slots</p>
                </div>
                <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
                        <Building2 className="h-5 w-5" />
                    </div>
                    <div className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-zinc-950">{buildingOptions.length}</div>
                    <p className="mt-1 text-sm text-zinc-500">Accessible buildings</p>
                </div>
            </section>

            <section className="rounded-[30px] border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="space-y-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <h2 className="text-xl font-semibold tracking-[-0.02em] text-zinc-950">Parking Slots</h2>
                            <p className="mt-1 text-sm text-zinc-500">Browse, allocate, and manage parking slots in the selected building.</p>
                        </div>
                        <div className="relative w-full lg:w-80">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                            <Input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search slot code, level, type, status"
                                className="h-11 rounded-xl border-zinc-200 bg-white pl-9"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <div className="min-w-[280px] flex-1">
                            <FilterField label="Availability">
                                <div className="flex flex-wrap gap-2">
                                    {(["all", "available", "occupied"] as const).map((status) => (
                                        <Button
                                            key={status}
                                            type="button"
                                            variant={statusFilter === status ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setStatusFilter(status)}
                                            className={statusFilter === status ? "h-9 rounded-full bg-zinc-950 px-4 text-white hover:bg-zinc-800" : "h-9 rounded-full border-zinc-200 px-4"}
                                        >
                                            {status === "all" ? "All" : status === "available" ? "Available" : "Occupied"}
                                        </Button>
                                    ))}
                                </div>
                            </FilterField>
                        </div>

                        {availableTypes.length > 0 ? (
                            <div className="min-w-[220px] flex-1">
                                <FilterField label="Slot Type">
                                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                                        <SelectTrigger className="h-11 rounded-xl border-zinc-200 bg-white">
                                            <SelectValue placeholder="All types" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All types</SelectItem>
                                            {availableTypes.map((type) => (
                                                <SelectItem key={type} value={type}>
                                                    {type}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FilterField>
                            </div>
                        ) : null}

                        {availableLevels.length > 0 ? (
                            <div className="min-w-[220px] flex-1">
                                <FilterField label="Level">
                                    <Select value={levelFilter} onValueChange={setLevelFilter}>
                                        <SelectTrigger className="h-11 rounded-xl border-zinc-200 bg-white">
                                            <SelectValue placeholder="All levels" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All levels</SelectItem>
                                            {availableLevels.map((level) => (
                                                <SelectItem key={level} value={level}>
                                                    {level}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FilterField>
                            </div>
                        ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                        <span className="text-zinc-400">Summary</span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-700">
                            Building
                            <span className="font-medium text-zinc-900">{activeBuildingLabel}</span>
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-700">
                            Available
                            <span className="font-medium text-zinc-900">{stats.available}</span>
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-700">
                            Occupied
                            <span className="font-medium text-zinc-900">{stats.occupied}</span>
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-900 bg-zinc-950 px-3 py-1.5 font-medium text-white">
                            Showing
                            <span>{filteredSlots.length} slot{filteredSlots.length === 1 ? "" : "s"}</span>
                        </span>
                    </div>

                    {selectedBuildingId && !parkingSlots ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4].map((item) => (
                                <div key={item} className="rounded-xl border border-zinc-200 bg-white p-4">
                                    <Skeleton className="h-5 w-1/3" />
                                    <Skeleton className="mt-2 h-4 w-1/2" />
                                </div>
                            ))}
                        </div>
                    ) : !selectedBuildingId ? (
                        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-10 text-center text-sm text-zinc-500">
                            Select a building to view parking slots.
                        </div>
                    ) : filteredSlots.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-10 text-center text-sm text-zinc-500">
                            No slots found.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,1.4fr)_auto] gap-3 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 md:grid">
                                <div>Slot</div>
                                <div>Availability</div>
                                <div>Status</div>
                                <div>Details</div>
                                <div className="text-right">Actions</div>
                            </div>
                            {paginatedSlots.map((slot) => {
                                const isAvailable = availableSlotIds.has(slot.id);
                                const unitLabels = slotUnitLabelsMap.get(slot.id) ?? [];
                                const residentLabels = slotResidentLabelsMap.get(slot.id) ?? [];
                                const vehicleLabels = slotVehicleLabels.get(slot.id);
                                const slotMeta = slotAllocationMetaMap.get(slot.id);
                                const vehicleMeta = slotMeta?.occupancyId ? occupancyVehicleCounts.get(slotMeta.occupancyId) : undefined;
                                const residentStatus = isAvailable
                                    ? null
                                    : slotMeta?.occupancyId
                                        ? vehicleMeta?.isLoading
                                            ? { label: "Resident", className: "bg-blue-50 text-blue-700" }
                                            : (vehicleMeta?.count ?? 0) > 0
                                                ? { label: "Resident + vehicle", className: "bg-emerald-50 text-emerald-700" }
                                                : { label: "Resident, no vehicle", className: "bg-amber-50 text-amber-700" }
                                        : { label: "No resident", className: "bg-zinc-100 text-zinc-700" };
                                return (
                                    <div key={slot.id} className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
                                        <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,1.4fr)_auto] md:items-start md:gap-3">
                                            <div className="min-w-0">
                                                <div className="text-sm font-semibold text-zinc-900">{slot.code}</div>
                                            </div>
                                            <div className="min-w-0">
                                                <Badge variant="secondary" className={isAvailable ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}>
                                                    {isAvailable ? "Available" : "Occupied"}
                                                </Badge>
                                            </div>
                                            <div className="min-w-0 space-y-1">
                                                {residentStatus ? (
                                                    <Badge variant="secondary" className={residentStatus.className}>
                                                        {residentStatus.label}
                                                    </Badge>
                                                ) : (
                                                    <div className="text-xs text-zinc-500">—</div>
                                                )}
                                                {!slot.isActive ? (
                                                    <Badge variant="destructive">Inactive</Badge>
                                                ) : null}
                                            </div>
                                            <div className="min-w-0 space-y-1 text-xs text-zinc-600">
                                                <div className="text-zinc-700">
                                                    {slot.level ? `${slot.level} • ` : ""}{slot.type}{slot.isCovered ? " • Covered" : ""}
                                                </div>
                                                {unitLabels.length > 0 ? (
                                                    <div>
                                                        Unit: {unitLabels.join(", ")}
                                                    </div>
                                                ) : null}
                                                {residentLabels.length > 0 ? (
                                                    <div>
                                                        Resident: {residentLabels.join(", ")}
                                                    </div>
                                                ) : null}
                                                {vehicleLabels ? (
                                                    <div>
                                                        Vehicle: {vehicleLabels}
                                                    </div>
                                                ) : null}
                                            </div>
                                            <div className="flex items-start justify-end">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem
                                                            onClick={() => {
                                                                setAllocateSlotId(slot.id);
                                                                setIsAllocateOpen(true);
                                                            }}
                                                            disabled={!selectedBuildingId || !slot.isActive}
                                                        >
                                                            Allocate
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => setEditSlot(slot)}>
                                                            Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => handleToggleActive(slot)}
                                                            disabled={updateSlotMutation.isPending}
                                                        >
                                                            {slot.isActive ? "Deactivate" : "Activate"}
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Pagination controls */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between border-t border-zinc-200 pt-4 mt-4">
                                    <div className="text-sm text-zinc-500">
                                        Page {currentPage} of {totalPages}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            Previous
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </section>

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

            <Dialog
                open={isImportOpen}
                onOpenChange={(open) => {
                    setIsImportOpen(open);
                    if (!open) {
                        resetImportState();
                    }
                }}
            >
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Import Parking Slots (CSV)</DialogTitle>
                        <DialogDescription>
                            Upload a CSV, validate it, then confirm the import.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Mode</p>
                                <Select value={importMode} onValueChange={(value) => setImportMode(value as ParkingSlotsImportMode)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select mode" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="create">Create only</SelectItem>
                                        <SelectItem value="upsert">Upsert (create/update)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">CSV File</p>
                                <Input
                                    type="file"
                                    accept=".csv,text/csv"
                                    onChange={(event) => {
                                        const file = event.target.files?.[0] ?? null;
                                        setImportFile(file);
                                        setValidationResult(null);
                                    }}
                                />
                            </div>
                        </div>

                        {importSummaryStats && (
                            <div className="grid gap-3 sm:grid-cols-5">
                                {[
                                    { label: "Total Rows", value: importSummaryStats.totalRows },
                                    { label: "Valid Rows", value: importSummaryStats.validRows },
                                    { label: "Created", value: importSummaryStats.created },
                                    { label: "Updated", value: importSummaryStats.updated },
                                    { label: "Errors", value: importSummaryStats.errors },
                                ].map((item) => (
                                    <div key={item.label} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                                        <p className="text-[11px] uppercase tracking-wide text-zinc-500">{item.label}</p>
                                        <p className="text-lg font-semibold text-zinc-900">{item.value}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {validationResult && validationResult.errors.length > 0 && (
                            <div className="rounded-lg border border-zinc-200">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-20">Row</TableHead>
                                            <TableHead className="w-40">Field</TableHead>
                                            <TableHead>Message</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {validationResult.errors.map((error, index) => (
                                            <TableRow key={`${error.row}-${error.field ?? "field"}-${index}`}>
                                                <TableCell className="font-medium text-zinc-900">{error.row}</TableCell>
                                                <TableCell>{error.field ?? "-"}</TableCell>
                                                <TableCell className="text-zinc-700">{error.message}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {validationResult && validationResult.errors.length === 0 && (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                                Validation passed. You can confirm the import.
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                        <div className="text-xs text-zinc-500">
                            Step 1: Upload → Step 2: Validate → Step 3: Import
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleValidateImport}
                                disabled={!importFile || isValidating || isImporting}
                            >
                                {isValidating ? "Validating..." : "Validate"}
                            </Button>
                            <Button
                                type="button"
                                onClick={handleConfirmImport}
                                disabled={
                                    !importFile ||
                                    !validationResult ||
                                    validationResult.errors.length > 0 ||
                                    isValidating ||
                                    isImporting
                                }
                            >
                                {isImporting ? "Importing..." : "Confirm Import"}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                units={units || []}
                allowUnitTargeting
            />
        </div>
    );
}
