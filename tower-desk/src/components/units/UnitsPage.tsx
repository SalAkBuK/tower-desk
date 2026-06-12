"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Search, LayoutGrid, Home, Plus, Check, List, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import { CreateUnitSheet } from "@/components/buildings/CreateUnitSheet";
import { UnitDetailSheet } from "@/components/buildings/UnitDetailSheet";
import { ManageAllocationsDialog } from "@/components/parking/ManageAllocationsDialog";
import { useAuth } from "@/lib/auth";
import { inspectUnitsCsvFile, canonicalUnitTypeValue, normalizeUnitsCsvFile } from "@/lib/unitsImportCsv";
import { getUserPermissionSet, hasAnyPermission } from "@/lib/permissions";
import { getPortalModuleByKey } from "@/lib/portalRegistry";
import {
    useAccessibleBuildings,
    useBuildingUnits,
    useBuildingOccupancies,
    useCreateUnitType,
    useUnitTypes,
} from "@/lib/queries";
import type {
    BuildingOccupancy,
    BuildingUnit,
    ParkingAllocation,
    UnitsImportMode,
    UnitsImportResponse,
    UnitStatus,
} from "@/lib/types";
import { getOccupancyParkingAllocations, getOccupancyVehicles } from "@/lib/api/parking";
import { importBuildingUnitsCsv } from "@/lib/api/units";

const PAGE_SIZE = 50;
const formatDate = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(date);
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
    const permissionSet = getUserPermissionSet(user);
    const unitsModuleRule = getPortalModuleByKey("units")?.rule;
    const canReadUnits = Boolean(unitsModuleRule && hasAnyPermission(permissionSet, unitsModuleRule));
    const leaseBasePath = "/portal/contracts";
    const accessibleBuildingsQuery = useAccessibleBuildings(user?.id, baseRole, { enabled: canReadUnits });
    const buildings = accessibleBuildingsQuery.data;
    const queryClient = useQueryClient();

    const [selectedBuildingId, setSelectedBuildingId] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
    const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
    const [unitFilter, setUnitFilter] = useState<"all" | "vacant" | "occupied">("all");
    const [unitStatusFilter, setUnitStatusFilter] = useState<"all" | UnitStatus>("all");
    const [parkingFilter, setParkingFilter] = useState<"all" | "withParking">("all");
    const [floorFilter, setFloorFilter] = useState<string>("all");
    const [unitTypeFilter, setUnitTypeFilter] = useState<string>("all");
    const [viewMode, setViewMode] = useState<"grid" | "list">("list");
    const [manageAllocations, setManageAllocations] = useState<{ occupancyId: string; label?: string } | null>(null);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importMode, setImportMode] = useState<UnitsImportMode>("create");
    const [validationResult, setValidationResult] = useState<UnitsImportResponse | null>(null);
    const [unitTypeCheckResult, setUnitTypeCheckResult] = useState<{ detected: string[]; missing: string[] } | null>(null);
    const [isCheckingUnitTypes, setIsCheckingUnitTypes] = useState(false);
    const [isCreatingMissingUnitTypes, setIsCreatingMissingUnitTypes] = useState(false);
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

    useEffect(() => {
        const handle = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300);
        return () => clearTimeout(handle);
    }, [search]);

    // Reset to page 1 when filters or search change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, unitFilter, unitStatusFilter, parkingFilter, floorFilter, unitTypeFilter, selectedBuildingId]);

    // Reset filters when building changes
    useEffect(() => {
        setFloorFilter("all");
        setUnitTypeFilter("all");
        setUnitFilter("all");
        setUnitStatusFilter("all");
        setParkingFilter("all");
        setSearch("");
        setSelectedUnitId(null);
        setEditingUnitId(null);
    }, [selectedBuildingId]);

    const resetImportState = () => {
        setImportFile(null);
        setValidationResult(null);
        setUnitTypeCheckResult(null);
        setIsCheckingUnitTypes(false);
        setIsCreatingMissingUnitTypes(false);
        setIsValidating(false);
        setIsImporting(false);
    };

    const createUnitType = useCreateUnitType();
    const { data: unitTypes, refetch: refetchUnitTypes } = useUnitTypes({ enabled: canReadUnits });
    const activeUnitTypeNames = useMemo(
        () =>
            (unitTypes ?? [])
                .map((type) => type.name?.trim())
                .filter((name): name is string => Boolean(name)),
        [unitTypes]
    );
    const visibleUnitTypeNames = activeUnitTypeNames.slice(0, 6);
    const remainingUnitTypeCount = Math.max(activeUnitTypeNames.length - visibleUnitTypeNames.length, 0);
    const canManageUnitTypes = baseRole === "superadmin"
        || baseRole === "org_admin"
        || hasAnyPermission(permissionSet, { keys: ["unittypes.write"], prefixes: ["unittypes"] });

    const buildingOptions = useMemo(
        () => (buildings || []).map((building) => ({ id: building.id, name: building.name })),
        [buildings]
    );

    useEffect(() => {
        if (selectedBuildingId || buildingOptions.length === 0) return;
        setSelectedBuildingId(buildingOptions[0].id);
    }, [buildingOptions, selectedBuildingId]);

    useEffect(() => {
        resetImportState();
    }, [selectedBuildingId]);

    const backendUnitStatusFilter: UnitStatus | undefined =
        unitStatusFilter !== "all"
            ? unitStatusFilter
            : unitFilter === "vacant"
                ? "AVAILABLE"
                : unitFilter === "occupied"
                    ? "OCCUPIED"
                    : undefined;
    const { data: units, isLoading } = useBuildingUnits(selectedBuildingId, {
        includeOccupancy: true,
        search: debouncedSearch || undefined,
        status: backendUnitStatusFilter,
        floor: floorFilter === "all" ? undefined : floorFilter,
        enabled: canReadUnits && Boolean(selectedBuildingId),
    });
    const { data: availableUnits } = useBuildingUnits(selectedBuildingId, { available: true, enabled: canReadUnits && Boolean(selectedBuildingId) });
    const { data: occupancies } = useBuildingOccupancies(selectedBuildingId, { enabled: canReadUnits && Boolean(selectedBuildingId) });
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

    const residentSearchByUnitId = useMemo(() => {
        const map = new Map<string, string>();
        (occupancies || []).forEach((entry) => {
            if (!entry.unitId) return;
            const current = map.get(entry.unitId) ?? "";
            const label = `${entry.residentName ?? ""} ${entry.residentEmail ?? ""}`.trim();
            map.set(entry.unitId, `${current} ${label}`.trim());
        });
        return map;
    }, [occupancies]);

    const getEffectiveUnitStatus = (unit: BuildingUnit, isVacant: boolean): UnitStatus => {
        if (unit.status === "UNDER_MAINTENANCE" || unit.status === "BLOCKED") {
            return unit.status;
        }
        if (!isVacant) return "OCCUPIED";
        return unit.status ?? "AVAILABLE";
    };

    const formatStatusLabel = (status: UnitStatus) =>
        status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

    const getStatusClasses = (status: UnitStatus) => {
        switch (status) {
            case "AVAILABLE":
                return "bg-emerald-50 text-emerald-700 border-emerald-200";
            case "OCCUPIED":
                return "bg-blue-50 text-blue-700 border-blue-200";
            case "UNDER_MAINTENANCE":
                return "bg-amber-50 text-amber-700 border-amber-200";
            case "BLOCKED":
                return "bg-rose-50 text-rose-700 border-rose-200";
            default:
                return "bg-zinc-100 text-zinc-700 border-zinc-200";
        }
    };

    const activeOccupancies = useMemo(() => {
        return (occupancies || []).filter((o) => o.status === "ACTIVE" || !o.endAt);
    }, [occupancies]);

    const activeOccupancyByUnitId = useMemo(() => {
        const map = new Map<string, BuildingOccupancy>();
        activeOccupancies.forEach((occ) => {
            if (!occ.unitId || map.has(occ.unitId)) return;
            map.set(occ.unitId, occ);
        });
        return map;
    }, [activeOccupancies]);

    const activeOccupancyIds = useMemo(() => {
        return activeOccupancies.map((occupancy) => occupancy.id).filter(Boolean);
    }, [activeOccupancies]);

    const activeOccupancyById = useMemo(() => {
        return new Map(activeOccupancies.map((occupancy) => [occupancy.id, occupancy]));
    }, [activeOccupancies]);

    const occupancyAllocationKey = useMemo(() => activeOccupancyIds.join("|"), [activeOccupancyIds]);
    const allocationsQuery = useQuery({
        queryKey: ["units-page-occupancy-parking-allocations", selectedBuildingId, occupancyAllocationKey],
        queryFn: async () => {
            const results: Array<{ occupancyId: string; allocations: ParkingAllocation[] }> = [];
            const concurrency = 6;
            const missing: string[] = [];

            activeOccupancyIds.forEach((occupancyId) => {
                const cached = queryClient.getQueryData([
                    "occupancy-parking-allocations",
                    occupancyId,
                    true,
                ]) as ParkingAllocation[] | undefined;
                if (cached) {
                    if (cached.length > 0) {
                        results.push({ occupancyId, allocations: cached });
                    }
                } else {
                    missing.push(occupancyId);
                }
            });

            for (let i = 0; i < missing.length; i += concurrency) {
                const chunk = missing.slice(i, i + concurrency);
                const chunkResults = await Promise.all(
                    chunk.map(async (occupancyId) => ({
                        occupancyId,
                        allocations: await getOccupancyParkingAllocations(occupancyId, { active: true }),
                    }))
                );
                chunkResults.forEach((entry) => {
                    queryClient.setQueryData([
                        "occupancy-parking-allocations",
                        entry.occupancyId,
                        true,
                    ], entry.allocations);
                    if (entry.allocations.length > 0) {
                        results.push(entry);
                    }
                });
            }
            return results;
        },
        enabled: canReadUnits && Boolean(selectedBuildingId) && activeOccupancyIds.length > 0,
        staleTime: 60_000,
    });

    const parkingAllocationsByUnitId = useMemo(() => {
        const map = new Map<string, ParkingAllocation[]>();
        (allocationsQuery.data || []).forEach(({ occupancyId, allocations }) => {
            const unitId = activeOccupancyById.get(occupancyId)?.unitId;
            if (unitId && allocations.length > 0) {
                map.set(unitId, allocations);
            }
        });
        return map;
    }, [activeOccupancyById, allocationsQuery.data]);

    const parkingCountByUnitId = useMemo(() => {
        const counts = new Map<string, number>();
        parkingAllocationsByUnitId.forEach((allocations, unitId) => {
            counts.set(unitId, allocations.length);
        });
        return counts;
    }, [parkingAllocationsByUnitId]);

    const parkingLabelsByUnitId = useMemo(() => {
        const labels = new Map<string, string[]>();
        parkingAllocationsByUnitId.forEach((allocations, unitId) => {
            const unique = Array.from(new Set(
                allocations
                    .map((allocation) => allocation.slot?.code || allocation.parkingSlotId)
                    .filter((value): value is string => Boolean(value))
            )).sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }));
            if (unique.length > 0) {
                labels.set(unitId, unique);
            }
        });
        return labels;
    }, [parkingAllocationsByUnitId]);

    const getParkingLabelsForUnit = (unitId: string) => parkingLabelsByUnitId.get(unitId) ?? [];

    const occupancyIdsForVehicles = useMemo(() => {
        const ids = new Set<string>();
        parkingAllocationsByUnitId.forEach((_, unitId) => {
            const occupancyId = activeOccupancyByUnitId.get(unitId)?.id;
            if (occupancyId) {
                ids.add(occupancyId);
            }
        });
        return Array.from(ids);
    }, [activeOccupancyByUnitId, parkingAllocationsByUnitId]);

    const vehicleQueries = useQueries({
        queries: occupancyIdsForVehicles.map((occupancyId) => ({
            queryKey: ["occupancy-vehicles", occupancyId],
            queryFn: () => getOccupancyVehicles(occupancyId),
            enabled: canReadUnits && Boolean(selectedBuildingId && occupancyId),
            staleTime: 60_000,
        })),
    });

    const vehiclesByOccupancyId = useMemo(() => {
        const map = new Map<string, string[]>();
        occupancyIdsForVehicles.forEach((occupancyId, index) => {
            const vehicles = vehicleQueries[index]?.data || [];
            const plates = Array.from(new Set(
                vehicles
                    .map((vehicle) => vehicle.plateNumber?.trim())
                    .filter((value): value is string => Boolean(value))
            )).sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }));
            map.set(occupancyId, plates);
        });
        return map;
    }, [occupancyIdsForVehicles, vehicleQueries]);

    const vehicleLoadingByOccupancyId = useMemo(() => {
        const map = new Map<string, boolean>();
        occupancyIdsForVehicles.forEach((occupancyId, index) => {
            map.set(occupancyId, Boolean(vehicleQueries[index]?.isLoading));
        });
        return map;
    }, [occupancyIdsForVehicles, vehicleQueries]);

    const vehicleLabelsByUnitId = useMemo(() => {
        const map = new Map<string, string[]>();
        parkingAllocationsByUnitId.forEach((_, unitId) => {
            const occupancyId = activeOccupancyByUnitId.get(unitId)?.id;
            if (!occupancyId) return;
            const plates = vehiclesByOccupancyId.get(occupancyId) ?? [];
            if (plates.length > 0) {
                map.set(unitId, plates);
            }
        });
        return map;
    }, [activeOccupancyByUnitId, parkingAllocationsByUnitId, vehiclesByOccupancyId]);

    const getVehicleLabelsForUnit = (unitId: string) => vehicleLabelsByUnitId.get(unitId) ?? [];
    const isVehicleLoadingForUnit = (unitId: string) => {
        const occupancyId = activeOccupancyByUnitId.get(unitId)?.id;
        return occupancyId ? (vehicleLoadingByOccupancyId.get(occupancyId) ?? false) : false;
    };

    const isUnitOccupied = (unit: BuildingUnit) => {
        if (activeOccupancyByUnitId.has(unit.id)) return true;
        const status = unit.occupancy?.status;
        if (status) return String(status).toUpperCase() === "ACTIVE";
        return Boolean(unit.occupancy?.id);
    };

    // Get unique floors from units for filter dropdown
    const availableFloors = useMemo(() => {
        if (!units) return [];
        const floors = new Set<number>();
        units.forEach((unit) => {
            if (unit.floor != null) floors.add(unit.floor);
        });
        return Array.from(floors).sort((a, b) => a - b);
    }, [units]);

    // Get unique unit types from units for filter dropdown
    const availableUnitTypeIds = useMemo(() => {
        if (!units) return [];
        const typeIds = new Set<string>();
        units.forEach((unit) => {
            if (unit.unitTypeId) typeIds.add(unit.unitTypeId);
        });
        return Array.from(typeIds);
    }, [units]);

    const unitTypeNameById = useMemo(() => {
        return new Map((unitTypes || []).map((type) => [type.id, type.name || "-"]));
    }, [unitTypes]);

    const filteredUnits = useMemo(() => {
        if (!units) return [];
        return units.filter((unit) => {
            const occupied = activeOccupancyByUnitId.has(unit.id)
                || String(unit.occupancy?.status ?? "").toUpperCase() === "ACTIVE"
                || Boolean(unit.occupancy?.id);
            const isVacant = occupied ? false : (unit.isAvailable ?? availableUnitIds.has(unit.id));
            const effectiveStatus = getEffectiveUnitStatus(unit, isVacant);
            const passesVacancy =
                unitFilter === "all" ? true : unitFilter === "vacant" ? isVacant : !isVacant;
            const parkingCount = parkingCountByUnitId.get(unit.id) ?? 0;
            const passesParking = parkingFilter === "all" ? true : parkingCount > 0;
            const passesFloor = floorFilter === "all" ? true : unit.floor?.toString() === floorFilter;
            const passesUnitType = unitTypeFilter === "all" ? true : unit.unitTypeId === unitTypeFilter;
            const passesStatus = unitStatusFilter === "all" ? true : effectiveStatus === unitStatusFilter;
            const residentSearch = residentSearchByUnitId.get(unit.id) ?? "";
            const vehicleSearch = (vehicleLabelsByUnitId.get(unit.id) ?? []).join(" ");
            const haystack = [
                unit.label,
                unit.id,
                unit.floor ? `floor ${unit.floor}` : "",
                unit.unitTypeId ? (unitTypeNameById.get(unit.unitTypeId) ?? "-") : "",
                effectiveStatus,
                residentSearch,
                vehicleSearch,
            ]
                .join(" ")
                .toLowerCase();
            const matchesSearch = !debouncedSearch || haystack.includes(debouncedSearch);
            return passesVacancy && passesStatus && passesParking && passesFloor && passesUnitType && matchesSearch;
        });
    }, [
        units,
        unitFilter,
        unitStatusFilter,
        availableUnitIds,
        parkingFilter,
        floorFilter,
        unitTypeFilter,
        debouncedSearch,
        residentSearchByUnitId,
        activeOccupancyByUnitId,
        parkingCountByUnitId,
        unitTypeNameById,
        vehicleLabelsByUnitId,
    ]);

    const totalPages = Math.ceil(filteredUnits.length / PAGE_SIZE);
    const paginatedUnits = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredUnits.slice(start, start + PAGE_SIZE);
    }, [filteredUnits, currentPage]);

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
            setValidationResult(null);
            let currentUnitTypes = unitTypes ?? [];
            let unitTypeResult = await evaluateImportUnitTypes(importFile, activeUnitTypeNames);
            setUnitTypeCheckResult(unitTypeResult);

            if (unitTypeResult.missing.length > 0) {
                if (!canManageUnitTypes) {
                    toast.error(`${unitTypeResult.missing.length} unit type(s) are missing and you cannot create them`);
                    return;
                }

                setIsCreatingMissingUnitTypes(true);
                const creationResults = await Promise.allSettled(
                    unitTypeResult.missing.map((name) => createUnitType.mutateAsync({ name: name.trim(), isActive: true }))
                );
                const failedCount = creationResults.filter((result) => result.status === "rejected").length;
                const refreshed = await refetchUnitTypes();
                currentUnitTypes = refreshed.data ?? currentUnitTypes;
                const refreshedNames = currentUnitTypes
                    .map((type) => type.name?.trim())
                    .filter((name): name is string => Boolean(name));
                unitTypeResult = await evaluateImportUnitTypes(importFile, refreshedNames);
                setUnitTypeCheckResult(unitTypeResult);

                if (unitTypeResult.missing.length > 0) {
                    toast.error(
                        failedCount > 0
                            ? `${unitTypeResult.missing.length} unit type(s) are still missing after the auto-create attempt`
                            : "Some unit types are still missing after refresh"
                    );
                    return;
                }

                toast.success(
                    failedCount > 0
                        ? "Missing unit types were resolved during validation."
                        : `Created ${creationResults.length} missing unit type(s).`
                );
            }

            const normalizedFile = await normalizeUnitsCsvFile(importFile, currentUnitTypes);
            const result = await importBuildingUnitsCsv(selectedBuildingId, normalizedFile, {
                dryRun: true,
                mode: importMode,
            });
            setValidationResult(result);
            if (result.errors.length > 0) {
                toast.error(`Validation found ${result.errors.length} error(s)`);
            } else {
                toast.success("Validation passed. Ready to import.");
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to validate import");
        } finally {
            setIsCreatingMissingUnitTypes(false);
            setIsValidating(false);
        }
    };

    const handleConfirmImport = async () => {
        if (!selectedBuildingId || !importFile) return;
        if (!validationResult || validationResult.errors.length > 0) return;
        try {
            setIsImporting(true);
            const normalizedFile = await normalizeUnitsCsvFile(importFile, unitTypes);
            const result = await importBuildingUnitsCsv(selectedBuildingId, normalizedFile, {
                mode: importMode,
            });
            await queryClient.invalidateQueries({ queryKey: ["building-units", selectedBuildingId] });
            await queryClient.invalidateQueries({ queryKey: ["building-occupancies", selectedBuildingId] });
            const created = result.summary.created ?? 0;
            const updated = result.summary.updated ?? 0;
            toast.success(`Import complete. Created: ${created}, Updated: ${updated}`);
            setIsImportOpen(false);
            resetImportState();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to import units");
        } finally {
            setIsImporting(false);
        }
    };

    const availableCount = useMemo(() => {
        return (units || []).filter((unit) => (
            !activeOccupancyByUnitId.has(unit.id)
            && String(unit.occupancy?.status ?? "").toUpperCase() !== "ACTIVE"
            && !unit.occupancy?.id
        )).length;
    }, [units, activeOccupancyByUnitId]);

    const occupiedCount = useMemo(() => {
        return (units || []).filter((unit) => (
            activeOccupancyByUnitId.has(unit.id)
            || String(unit.occupancy?.status ?? "").toUpperCase() === "ACTIVE"
            || Boolean(unit.occupancy?.id)
        )).length;
    }, [units, activeOccupancyByUnitId]);

    const getUnitTypeName = (typeId?: string) => {
        if (!typeId || !unitTypes) return "-";
        return unitTypeNameById.get(typeId) ?? "-";
    };
    const activeBuildingLabel = useMemo(
        () => buildingOptions.find((building) => building.id === selectedBuildingId)?.name ?? "Select building",
        [buildingOptions, selectedBuildingId]
    );
    const canValidateImport = Boolean(importFile)
        && !isCheckingUnitTypes
        && !isCreatingMissingUnitTypes;

    const evaluateImportUnitTypes = async (file: File, availableUnitTypeNames: string[]) => {
        const detected = await inspectUnitsCsvFile(file);
        const available = new Set(
            availableUnitTypeNames
                .map((name) => canonicalUnitTypeValue(name))
                .filter(Boolean)
        );
        const missing = detected.filter((name) => !available.has(canonicalUnitTypeValue(name)));
        return { detected, missing };
    };

    const handleCheckUnitTypes = async () => {
        if (!importFile) {
            toast.error("Choose a CSV file first");
            return;
        }

        try {
            setIsCheckingUnitTypes(true);
            setValidationResult(null);
            const result = await evaluateImportUnitTypes(importFile, activeUnitTypeNames);
            setUnitTypeCheckResult(result);
            if (result.missing.length > 0) {
                toast.error(`${result.missing.length} unit type(s) are missing`);
            } else {
                toast.success("Unit type check passed. You can validate the import.");
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to inspect CSV unit types");
        } finally {
            setIsCheckingUnitTypes(false);
        }
    };

    if (!canReadUnits) {
        return (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                        <LayoutGrid className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-zinc-900">{title}</h1>
                        <p className="text-sm text-zinc-500">You do not have permission to view units.</p>
                    </div>
                </div>
            </div>
        );
    }

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
                            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">{subtitle}</p>
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
                                <Button className="h-11 rounded-xl bg-zinc-950 px-5 text-white hover:bg-zinc-800" onClick={() => setIsCreateOpen(true)} disabled={!selectedBuildingId}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Unit
                                </Button>
                                <Button variant="outline" className="h-11 rounded-xl border-zinc-200 bg-white px-4" onClick={() => setIsImportOpen(true)} disabled={!selectedBuildingId}>
                                    Import Units (CSV)
                                </Button>
                                <Button variant="outline" className="h-11 rounded-xl border-zinc-200 bg-white px-4" asChild>
                                    <a href="/units_template_fixed.csv" download>
                                        Download Template
                                    </a>
                                </Button>
                                <Button variant="outline" className="h-11 rounded-xl border-zinc-200 bg-white px-4" asChild>
                                    <a href="/units_import_reference.csv" download>
                                        Download Import Reference
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
                        <LayoutGrid className="h-5 w-5" />
                    </div>
                    <div className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-zinc-950">{units?.length || 0}</div>
                    <p className="mt-1 text-sm text-zinc-500">Total units in scope</p>
                </div>
                <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                        <Check className="h-5 w-5" />
                    </div>
                    <div className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-zinc-950">{availableCount}</div>
                    <p className="mt-1 text-sm text-zinc-500">Available units</p>
                </div>
                <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                        <Home className="h-5 w-5" />
                    </div>
                    <div className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-zinc-950">{occupiedCount}</div>
                    <p className="mt-1 text-sm text-zinc-500">Occupied units</p>
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
                <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <h2 className="text-xl font-semibold tracking-[-0.02em] text-zinc-950">{directoryTitle}</h2>
                            <p className="mt-1 text-sm text-zinc-500">{directoryDescription}</p>
                        </div>
                        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
                            <div className="relative w-full sm:w-80">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                <Input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Search unit, resident, or type"
                                    className="h-11 rounded-xl border-zinc-200 bg-white pl-9"
                                />
                            </div>
                            <div className="flex items-center gap-2 rounded-[22px] border border-zinc-200 bg-white p-2 shadow-xs">
                                <Button
                                    variant={viewMode === "grid" ? "default" : "outline"}
                                    size="icon"
                                    onClick={() => setViewMode("grid")}
                                    className={viewMode === "grid" ? "h-10 w-10 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800" : "h-10 w-10 rounded-xl border-zinc-200"}
                                >
                                    <LayoutGrid className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant={viewMode === "list" ? "default" : "outline"}
                                    size="icon"
                                    onClick={() => setViewMode("list")}
                                    className={viewMode === "list" ? "h-10 w-10 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800" : "h-10 w-10 rounded-xl border-zinc-200"}
                                >
                                    <List className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <div className="min-w-[300px] flex-1">
                            <FilterField label="Availability">
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        variant={unitFilter === "all" ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setUnitFilter("all")}
                                        className={unitFilter === "all" ? "h-9 rounded-full bg-zinc-950 px-4 text-white hover:bg-zinc-800" : "h-9 rounded-full border-zinc-200 px-4"}
                                    >
                                        All
                                    </Button>
                                    <Button
                                        variant={unitFilter === "vacant" ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setUnitFilter("vacant")}
                                        className={unitFilter === "vacant" ? "h-9 rounded-full bg-zinc-950 px-4 text-white hover:bg-zinc-800" : "h-9 rounded-full border-zinc-200 px-4"}
                                    >
                                        Vacant
                                    </Button>
                                    <Button
                                        variant={unitFilter === "occupied" ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setUnitFilter("occupied")}
                                        className={unitFilter === "occupied" ? "h-9 rounded-full bg-zinc-950 px-4 text-white hover:bg-zinc-800" : "h-9 rounded-full border-zinc-200 px-4"}
                                    >
                                        Occupied
                                    </Button>
                                </div>
                            </FilterField>
                        </div>

                        <div className="min-w-[220px] flex-1">
                            <FilterField label="Unit Status">
                                <Select value={unitStatusFilter} onValueChange={(value) => setUnitStatusFilter(value as "all" | UnitStatus)}>
                                    <SelectTrigger className="h-11 rounded-xl border-zinc-200 bg-white">
                                        <SelectValue placeholder="Unit status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All statuses</SelectItem>
                                        <SelectItem value="AVAILABLE">Available</SelectItem>
                                        <SelectItem value="OCCUPIED">Occupied</SelectItem>
                                        <SelectItem value="UNDER_MAINTENANCE">Under maintenance</SelectItem>
                                        <SelectItem value="BLOCKED">Blocked</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FilterField>
                        </div>

                        {availableFloors.length > 0 ? (
                            <div className="min-w-[180px] flex-1">
                                <FilterField label="Floor">
                                    <Select value={floorFilter} onValueChange={setFloorFilter}>
                                        <SelectTrigger className="h-11 rounded-xl border-zinc-200 bg-white">
                                            <SelectValue placeholder="All floors" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All floors</SelectItem>
                                            {availableFloors.map((floor) => (
                                                <SelectItem key={floor} value={floor.toString()}>
                                                    Floor {floor}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FilterField>
                            </div>
                        ) : null}

                        {availableUnitTypeIds.length > 0 ? (
                            <div className="min-w-[220px] flex-1">
                                <FilterField label="Unit Type">
                                    <Select value={unitTypeFilter} onValueChange={setUnitTypeFilter}>
                                        <SelectTrigger className="h-11 rounded-xl border-zinc-200 bg-white">
                                            <SelectValue placeholder="All types" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All types</SelectItem>
                                            {availableUnitTypeIds.map((typeId) => (
                                                <SelectItem key={typeId} value={typeId}>
                                                    {getUnitTypeName(typeId)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FilterField>
                            </div>
                        ) : null}

                        <div className="min-w-[220px] flex-1">
                            <FilterField label="Parking">
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        variant={parkingFilter === "all" ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setParkingFilter("all")}
                                        className={parkingFilter === "all" ? "h-9 rounded-full bg-zinc-950 px-4 text-white hover:bg-zinc-800" : "h-9 rounded-full border-zinc-200 px-4"}
                                    >
                                        Any
                                    </Button>
                                    <Button
                                        variant={parkingFilter === "withParking" ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setParkingFilter("withParking")}
                                        className={parkingFilter === "withParking" ? "h-9 rounded-full bg-zinc-950 px-4 text-white hover:bg-zinc-800" : "h-9 rounded-full border-zinc-200 px-4"}
                                    >
                                        With parking
                                    </Button>
                                </div>
                            </FilterField>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                        <span className="text-zinc-400">Summary</span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-700">
                            Building
                            <span className="font-medium text-zinc-900">{activeBuildingLabel}</span>
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-700">
                            Available
                            <span className="font-medium text-zinc-900">{availableCount}</span>
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-700">
                            Occupied
                            <span className="font-medium text-zinc-900">{occupiedCount}</span>
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-700">
                            View
                            <span className="font-medium capitalize text-zinc-900">{viewMode}</span>
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-900 bg-zinc-950 px-3 py-1.5 font-medium text-white">
                            Showing
                            <span>{filteredUnits.length} units</span>
                        </span>
                    </div>
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
                            {paginatedUnits.map((unit) => {
                                const isVacant = !isUnitOccupied(unit);
                                const effectiveStatus = getEffectiveUnitStatus(unit, isVacant);
                                const unitOccupancies = occupanciesByUnitId.get(unit.id) ?? [];
                                const residentNames = unitOccupancies
                                    .map((entry) => entry.residentName)
                                    .filter((name): name is string => Boolean(name && name.trim()));
                                const residentPreview = residentNames.slice(0, 2).join(", ");
                                const residentRemainder = residentNames.length > 2 ? ` +${residentNames.length - 2}` : "";
                                const parkingLabels = getParkingLabelsForUnit(unit.id);
                                const parkingPreview = parkingLabels.slice(0, 2).join(", ");
                                const parkingRemainder = parkingLabels.length > 2 ? ` +${parkingLabels.length - 2}` : "";
                                const vehicleLabels = getVehicleLabelsForUnit(unit.id);
                                const vehiclePreview = vehicleLabels.slice(0, 2).join(", ");
                                const vehicleRemainder = vehicleLabels.length > 2 ? ` +${vehicleLabels.length - 2}` : "";
                                const isVehicleLoading = isVehicleLoadingForUnit(unit.id);
                                const leaseSummary = unit.occupancy?.lease;
                                const leaseId = leaseSummary?.id;
                                const canViewLease = Boolean(leaseBasePath && leaseId);
                                return (
                                    <div
                                        key={unit.id}
                                        onClick={() => setSelectedUnitId(unit.id)}
                                        className={`
                                            group cursor-pointer rounded-xl border p-4 transition-all hover:shadow-md
                                            ${effectiveStatus === "AVAILABLE"
                                                ? "border-emerald-100 bg-emerald-50/30 hover:border-emerald-200"
                                                : effectiveStatus === "OCCUPIED"
                                                    ? "border-zinc-200 bg-white hover:border-blue-200"
                                                    : "border-amber-100 bg-amber-50/30 hover:border-amber-200"
                                            }
                                        `}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-semibold text-lg text-zinc-900">{unit.label}</span>
                                            <div className={`h-2 w-2 rounded-full ${
                                                effectiveStatus === "AVAILABLE"
                                                    ? "bg-emerald-500"
                                                    : effectiveStatus === "OCCUPIED"
                                                        ? "bg-blue-500"
                                                        : effectiveStatus === "BLOCKED"
                                                            ? "bg-rose-500"
                                                            : "bg-amber-500"
                                            }`} />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] uppercase font-medium tracking-wider text-zinc-500">
                                                {formatStatusLabel(effectiveStatus)}
                                            </p>
                                            {unit.floor ? (
                                                <p className="text-xs text-zinc-500">Floor {unit.floor}</p>
                                            ) : null}
                                            {unit.unitTypeId ? (
                                                <p className="text-xs text-zinc-500">{getUnitTypeName(unit.unitTypeId)}</p>
                                            ) : null}
                                            {leaseSummary?.leaseEndDate ? (
                                                <p className="text-xs text-zinc-500">
                                                    Contract ends {formatDate(leaseSummary.leaseEndDate)}
                                                    {canViewLease ? (
                                                        <>
                                                            {" | "}
                                                            <Link
                                                                href={`${leaseBasePath}/${leaseId}`}
                                                                className="text-blue-600 hover:underline"
                                                                onClick={(event) => event.stopPropagation()}
                                                            >
                                                                View contract
                                                            </Link>
                                                        </>
                                                    ) : null}
                                                </p>
                                            ) : canViewLease ? (
                                                <p className="text-xs text-zinc-500">
                                                    <Link
                                                        href={`${leaseBasePath}/${leaseId}`}
                                                        className="text-blue-600 hover:underline"
                                                        onClick={(event) => event.stopPropagation()}
                                                    >
                                                        View contract
                                                    </Link>
                                                </p>
                                            ) : null}
                                            {residentNames.length > 0 ? (
                                                <p className="text-xs text-zinc-600">
                                                    Residents: {residentPreview}{residentRemainder}
                                                </p>
                                            ) : (
                                                <p className="text-xs text-zinc-400">No resident assigned</p>
                                            )}
                                            {allocationsQuery.isLoading ? (
                                                <p className="text-xs text-zinc-400">Loading parking...</p>
                                            ) : parkingLabels.length > 0 ? (
                                                <>
                                                    <p className="text-xs text-zinc-600">
                                                        Parking: {parkingPreview}{parkingRemainder}
                                                    </p>
                                                    {isVehicleLoading ? (
                                                        <p className="text-xs text-zinc-400">Vehicle: Loading...</p>
                                                    ) : vehicleLabels.length > 0 ? (
                                                        <p className="text-xs text-zinc-600">
                                                            Vehicle: {vehiclePreview}{vehicleRemainder}
                                                        </p>
                                                    ) : (
                                                        <p className="text-xs text-zinc-400">Vehicle: No vehicle</p>
                                                    )}
                                                </>
                                            ) : (
                                                <p className="text-xs text-zinc-400">No parking allocated</p>
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
                                        <TableHead>Parking</TableHead>
                                        <TableHead>Contract End</TableHead>
                                        <TableHead>Registration Expiry</TableHead>
                                        <TableHead>Notice Given</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedUnits.map((unit) => {
                                        const isVacant = !isUnitOccupied(unit);
                                        const effectiveStatus = getEffectiveUnitStatus(unit, isVacant);
                                        const unitOccupancies = occupanciesByUnitId.get(unit.id) ?? [];
                                        const residentNames = unitOccupancies
                                            .map((entry) => entry.residentName)
                                            .filter((name): name is string => Boolean(name && name.trim()));
                                        const residentPreview = residentNames.slice(0, 2).join(", ");
                                        const residentRemainder = residentNames.length > 2 ? ` +${residentNames.length - 2}` : "";
                                        const parkingLabels = getParkingLabelsForUnit(unit.id);
                                        const parkingPreview = parkingLabels.slice(0, 2).join(", ");
                                        const parkingRemainder = parkingLabels.length > 2 ? ` +${parkingLabels.length - 2}` : "";
                                        const vehicleLabels = getVehicleLabelsForUnit(unit.id);
                                        const vehiclePreview = vehicleLabels.slice(0, 2).join(", ");
                                        const vehicleRemainder = vehicleLabels.length > 2 ? ` +${vehicleLabels.length - 2}` : "";
                                        const isVehicleLoading = isVehicleLoadingForUnit(unit.id);
                                        const leaseSummary = unit.occupancy?.lease;
                                        const leaseId = leaseSummary?.id;
                                        const canViewLease = Boolean(leaseBasePath && leaseId);
                                        return (
                                            <TableRow key={unit.id} className="cursor-pointer" onClick={() => setSelectedUnitId(unit.id)}>
                                                <TableCell className="font-medium text-zinc-900">{unit.label}</TableCell>
                                                <TableCell>{unit.floor ?? "-"}</TableCell>
                                                <TableCell>{getUnitTypeName(unit.unitTypeId)}</TableCell>
                                                <TableCell>
                                                    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${getStatusClasses(effectiveStatus)}`}>
                                                        {formatStatusLabel(effectiveStatus)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-zinc-600">
                                                    <div className="flex flex-col gap-1">
                                                        <span>{residentNames.length > 0 ? `${residentPreview}${residentRemainder}` : "No resident assigned"}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-zinc-600">
                                                    {allocationsQuery.isLoading ? (
                                                        <span>Loading parking...</span>
                                                    ) : parkingLabels.length > 0 ? (
                                                        <div className="flex flex-col gap-1">
                                                            <span>{parkingPreview}{parkingRemainder}</span>
                                                            {isVehicleLoading ? (
                                                                <span className="text-xs text-zinc-400">Vehicle: Loading...</span>
                                                            ) : vehicleLabels.length > 0 ? (
                                                                <span className="text-xs text-zinc-500">{vehiclePreview}{vehicleRemainder}</span>
                                                            ) : (
                                                                <span className="text-xs text-zinc-400">No vehicle</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span>No parking allocated</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-zinc-600">
                                                    <div className="flex flex-col gap-1">
                                                        <span>{formatDate(leaseSummary?.leaseEndDate)}</span>
                                                        {canViewLease ? (
                                                            <Link
                                                                href={`${leaseBasePath}/${leaseId}`}
                                                                className="text-xs text-blue-600 hover:underline"
                                                                onClick={(event) => event.stopPropagation()}
                                                            >
                                                                View contract
                                                            </Link>
                                                        ) : null}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-zinc-600">{formatDate(leaseSummary?.tenancyRegistrationExpiry)}</TableCell>
                                                <TableCell className="text-zinc-600">{formatDate(leaseSummary?.noticeGivenDate)}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {/* Pagination Controls */}
                    {filteredUnits.length > PAGE_SIZE && (
                        <div className="flex items-center justify-between border-t border-zinc-200 pt-4 mt-4">
                            <div className="text-sm text-zinc-500">
                                Showing {((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, filteredUnits.length)} of {filteredUnits.length} units
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Previous
                                </Button>
                                <div className="flex items-center gap-1 px-2">
                                    <span className="text-sm text-zinc-700">Page {currentPage} of {totalPages}</span>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </section>

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
                        <DialogTitle>Import Units (CSV)</DialogTitle>
                        <DialogDescription>
                            Upload a CSV, validate it, then confirm the import. Missing unit types will be created during validation when your permissions allow it.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                            <p className="font-medium">Backend import contract</p>
                            <p className="mt-1">Use the backend template and field reference. Do not invent enum values.</p>
                            <p className="mt-1"><span className="font-medium">unitSizeUnit</span> must be <span className="font-mono">SQ_FT</span>.</p>
                            <p className="mt-1"><span className="font-medium">paymentFrequency</span> must be <span className="font-mono">MONTHLY</span>, <span className="font-mono">QUARTERLY</span>, <span className="font-mono">SEMI_ANNUAL</span>, or <span className="font-mono">ANNUAL</span>.</p>
                            <p className="mt-1"><span className="font-medium">maintenancePayer</span> must be <span className="font-mono">OWNER</span>, <span className="font-mono">TENANT</span>, or <span className="font-mono">BUILDING</span>.</p>
                            <p className="mt-1"><span className="font-medium">unitType</span> must match an active org unit type name.</p>
                            {activeUnitTypeNames.length > 0 ? (
                                <p className="mt-1">
                                    Active unit types loaded for this org: {visibleUnitTypeNames.join(", ")}
                                    {remainingUnitTypeCount > 0 ? ` +${remainingUnitTypeCount} more` : ""}.
                                </p>
                            ) : (
                                <p className="mt-1">
                                    No active unit types are loaded for this org yet. Validation can create them if you have permission.
                                </p>
                            )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Mode</p>
                                <Select value={importMode} onValueChange={(value) => setImportMode(value as UnitsImportMode)}>
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
                                        setUnitTypeCheckResult(null);
                                    }}
                                />
                            </div>
                        </div>

                        {unitTypeCheckResult ? (
                            <div className={`rounded-lg border px-4 py-3 text-sm ${unitTypeCheckResult.missing.length > 0 ? "border-amber-200 bg-amber-50 text-amber-950" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
                                <p className="font-medium">
                                    {unitTypeCheckResult.missing.length > 0 ? "Unit type review required" : "Unit type check passed"}
                                </p>
                                <p className="mt-1">
                                    Detected in CSV: {unitTypeCheckResult.detected.length > 0 ? unitTypeCheckResult.detected.join(", ") : "none"}.
                                </p>
                                {unitTypeCheckResult.missing.length > 0 ? (
                                    <p className="mt-1">
                                        Missing in this org: {unitTypeCheckResult.missing.join(", ")}.
                                    </p>
                                ) : null}
                                {!canManageUnitTypes && unitTypeCheckResult.missing.length > 0 ? (
                                    <p className="mt-1">You cannot auto-create missing unit types with your current permissions.</p>
                                ) : null}
                            </div>
                        ) : importFile ? (
                            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                                You can check unit types first, or go straight to validation. Validation will create missing unit types automatically when permitted.
                            </div>
                        ) : null}

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
                            Step 1: Upload → Step 2: Check unit types → Step 3: Validate → Step 4: Import
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCheckUnitTypes}
                                disabled={!importFile || isCheckingUnitTypes || isCreatingMissingUnitTypes || isValidating || isImporting}
                            >
                                {isCheckingUnitTypes ? "Checking..." : "Check Unit Types"}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleValidateImport}
                                disabled={!canValidateImport || isValidating || isImporting}
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
                                    isCheckingUnitTypes ||
                                    isCreatingMissingUnitTypes ||
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

            {selectedBuildingId ? (
                <UnitDetailSheet
                    open={Boolean(selectedUnitId)}
                    onOpenChange={(open) => !open && setSelectedUnitId(null)}
                    buildingId={selectedBuildingId}
                    unitId={selectedUnitId}
                    onEdit={() => {
                        if (!selectedUnitId) return;
                        setEditingUnitId(selectedUnitId);
                        setSelectedUnitId(null);
                    }}
                />
            ) : null}

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

            {manageAllocations && (
                <ManageAllocationsDialog
                    open={Boolean(manageAllocations)}
                    onOpenChange={(open) => !open && setManageAllocations(null)}
                    buildingId={selectedBuildingId}
                    occupancyId={manageAllocations.occupancyId}
                    occupancyLabel={manageAllocations.label}
                />
            )}
        </div>
    );
}
