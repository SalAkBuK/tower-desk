"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { getUserPermissionSet, hasAnyPermission } from "@/lib/permissions";
import { getPortalModuleByKey } from "@/lib/portalRegistry";
import {
    useAccessibleBuildings,
    useBuildingUnits,
    useBuildingOccupancies,
    useParkingSlots,
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
import { getOccupancyParkingAllocations } from "@/lib/api/parking";
import { importBuildingUnitsCsv } from "@/lib/api/units";

const PAGE_SIZE = 50;
const formatDate = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(date);
};

// Allow both legacy spreadsheet headers and the new canonical ones during CSV import
const legacyUnitHeaderMap: Record<string, string> = {
    "unit number code": "label",
    "unit number": "label",
    "unit code": "label",
    "floor number": "floor",
    "unit type": "unitType",
    "number of bedrooms": "bedrooms",
    "bedrooms": "bedrooms",
    "number of bathrooms": "bathrooms",
    "bathrooms": "bathrooms",
    "unit size sq ft sq m": "unitSize",
    "unit size": "unitSize",
    "derived": "unitSizeUnit",
    "unit size unit": "unitSizeUnit",
    "balcony yes no": "balcony",
    "balcony": "balcony",
    "kitchen type open closed": "kitchenType",
    "kitchen type": "kitchenType",
    "furnished status unfurnished semi furnished fully furnished": "furnishedStatus",
    "furnished status": "furnishedStatus",
    "rent amount annual": "rentAnnual",
    "payment frequency payment monthly quartely semi annual": "paymentFrequency",
    "payment frequency": "paymentFrequency",
    "security deposit amount": "securityDepositAmount",
    "service charge per unit": "serviceChargePerUnit",
    "vat applicable yes no": "vatApplicable",
    "vat applicable": "vatApplicable",
    "maintenance paid by": "maintenancePayer",
    "electricity meter number": "electricityMeterNumber",
    "water meter number": "waterMeterNumber",
    "gas meter number if applicable": "gasMeterNumber",
    "gas meter number": "gasMeterNumber",
};

const preferredUnitHeaders = [
    "label",
    "floor",
    "unitType",
    "notes",
    "bedrooms",
    "bathrooms",
    "unitSize",
    "unitSizeUnit",
    "furnishedStatus",
    "balcony",
    "kitchenType",
    "rentAnnual",
    "paymentFrequency",
    "securityDepositAmount",
    "serviceChargePerUnit",
    "vatApplicable",
    "maintenancePayer",
    "electricityMeterNumber",
    "waterMeterNumber",
    "gasMeterNumber",
];

const canonicalUnitHeader = (header: string) =>
    header
        .replace(/^\uFEFF/, "") // strip BOM if present
        .replace(/"/g, "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const preferredHeaderLookup = new Map(preferredUnitHeaders.map((name) => [canonicalUnitHeader(name), name]));

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

const normalizeUnitsCsvFile = async (file: File, unitTypes?: { id: string; name: string }[]) => {
    const content = await file.text();
    const lines = content.split(/\r?\n/);
    if (lines.length === 0 || !lines[0]) return file;

    // detect delimiter (support tab-exported sheets too)
    const firstLine = lines[0];
    const delimiter =
        firstLine.includes("\t") && (!firstLine.includes(",") || firstLine.split("\t").length >= firstLine.split(",").length)
            ? "\t"
            : ",";
    const splitRow = (row: string) => row.split(delimiter);

    const originalHeaderCells = splitRow(firstLine);
    const keepIndexes = originalHeaderCells
        .map((h, idx) => (h.trim() === "" ? -1 : idx))
        .filter((idx) => idx >= 0);

    const originalHeaders = keepIndexes.map((idx) => originalHeaderCells[idx].trim());

    const normalizedHeaders = originalHeaders.map((header) => {
        const canonical = canonicalUnitHeader(header);
        if (legacyUnitHeaderMap[canonical]) return legacyUnitHeaderMap[canonical];
        const preferred = preferredHeaderLookup.get(canonical);
        return preferred ?? header;
    });

    const canonicalUnitType = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
    const unitTypeLookup =
        unitTypes && unitTypes.length
            ? new Map(unitTypes.map((t) => [t.name.trim().toLowerCase(), t.id]))
            : null;
    const unitTypeCanonicalLookup =
        unitTypes && unitTypes.length
            ? new Map(unitTypes.map((t) => [canonicalUnitType(t.name), t.id]))
            : null;
    const unitTypeIndex = normalizedHeaders.findIndex((h) => h === "unitType");
    const unitSizeIndex = normalizedHeaders.findIndex((h) => h === "unitSize");

    // ensure required derived headers exist even if missing (e.g., unitSizeUnit column absent)
    const normalizedHeaderSet = new Set(normalizedHeaders.map(canonicalUnitHeader));
    const requiredIfMissing = ["unitSizeUnit"];
    requiredIfMissing.forEach((required) => {
        if (!normalizedHeaderSet.has(canonicalUnitHeader(required))) {
            normalizedHeaders.push(required);
            normalizedHeaderSet.add(canonicalUnitHeader(required));
        }
    });
    const unitSizeUnitIndex = normalizedHeaders.findIndex((h) => h === "unitSizeUnit");

    const normalizeUnitSizeUnit = (value: string) => {
        const raw = value.trim();
        if (!raw) return { unit: "SQ_FT", isSqM: false, recognized: true };
        const normalized = raw
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");
        if (normalized === "SQ_FT" || normalized === "SQFT" || normalized === "FT2" || normalized === "FT") {
            return { unit: "SQ_FT", isSqM: false, recognized: true };
        }
        if (
            normalized === "SQ_M" ||
            normalized === "SQM" ||
            normalized === "M2" ||
            normalized === "M_2" ||
            normalized === "SQUARE_METER" ||
            normalized === "SQUARE_METERS"
        ) {
            return { unit: "SQ_M", isSqM: true, recognized: true };
        }
        return { unit: raw, isSqM: false, recognized: false };
    };

    const changed = normalizedHeaders.some((header, index) => header !== originalHeaders[index]);
    const needsPad = normalizedHeaders.length !== originalHeaders.length;
    if (!changed && !needsPad) return file;

    const normalizedRows = lines.slice(1).map((line) => {
        if (!line.trim()) return ""; // keep blank trailing lines
        const rawCells = splitRow(line);
        const cells = keepIndexes.map((idx) => rawCells[idx] ?? "");

        if (unitTypeLookup && unitTypeIndex >= 0 && cells[unitTypeIndex]) {
            const rawValue = cells[unitTypeIndex].trim();
            const lower = rawValue.toLowerCase();
            const canonical = canonicalUnitType(rawValue);
            const matchId =
                unitTypeLookup.get(lower) ??
                unitTypeCanonicalLookup?.get(canonical) ??
                Array.from(unitTypes ?? []).find((t) => canonicalUnitType(t.name).startsWith(canonical))?.id ??
                null;
            if (matchId) cells[unitTypeIndex] = matchId;
        }

        if (unitSizeUnitIndex >= 0) {
            const { isSqM } = normalizeUnitSizeUnit(cells[unitSizeUnitIndex] ?? "");
            if (isSqM && unitSizeIndex >= 0 && cells[unitSizeIndex]) {
                const parsedSize = parseFloat(cells[unitSizeIndex].replace(/,/g, ""));
                if (Number.isFinite(parsedSize)) {
                    const converted = Math.round(parsedSize * 10.7639 * 100) / 100;
                    cells[unitSizeIndex] = converted.toString();
                }
            }
            // Backend only accepts SQ_FT; default to SQ_FT even if input is missing/invalid.
            cells[unitSizeUnitIndex] = "SQ_FT";
        }

        // drop empty trailing cells caused by consecutive delimiters
        while (cells.length && cells[cells.length - 1] === "") cells.pop();
        // pad any newly added headers
        while (cells.length < normalizedHeaders.length) cells.push("");
        return cells.slice(0, normalizedHeaders.length).join(",");
    });

    const normalizedCsv = [normalizedHeaders.join(","), ...normalizedRows].join("\n");
    return new File([normalizedCsv], file.name, { type: file.type || "text/csv" });
};

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
        setIsValidating(false);
        setIsImporting(false);
    };

    const { data: unitTypes } = useUnitTypes({ enabled: canReadUnits });

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

    const { data: units, isLoading } = useBuildingUnits(selectedBuildingId, { includeOccupancy: true, enabled: canReadUnits && Boolean(selectedBuildingId) });
    const { data: availableUnits } = useBuildingUnits(selectedBuildingId, { available: true, enabled: canReadUnits && Boolean(selectedBuildingId) });
    const { data: occupancies } = useBuildingOccupancies(selectedBuildingId, { enabled: canReadUnits && Boolean(selectedBuildingId) });
    const { data: parkingSlots } = useParkingSlots(selectedBuildingId, { enabled: canReadUnits && Boolean(selectedBuildingId) });
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

    const activeOccupancyIds = useMemo(() => {
        return activeOccupancies.map((o) => o.id).filter(Boolean);
    }, [activeOccupancies]);

    const activeOccupancyByUnitId = useMemo(() => {
        const map = new Map<string, BuildingOccupancy>();
        activeOccupancies.forEach((occ) => {
            if (!occ.unitId || map.has(occ.unitId)) return;
            map.set(occ.unitId, occ);
        });
        return map;
    }, [activeOccupancies]);

    const activeOccupancyById = useMemo(() => {
        return new Map(activeOccupancies.map((occ) => [occ.id, occ]));
    }, [activeOccupancies]);

    const allocationKey = useMemo(() => activeOccupancyIds.join("|"), [activeOccupancyIds]);
    const allocationsQuery = useQuery({
        queryKey: ["unit-parking-allocations", selectedBuildingId, allocationKey],
        queryFn: async () => {
            const results: ParkingAllocation[] = [];
            const concurrency = 4;
            for (let i = 0; i < activeOccupancyIds.length; i += concurrency) {
                const chunk = activeOccupancyIds.slice(i, i + concurrency);
                const chunkResults = await Promise.all(
                    chunk.map((occupancyId) => getOccupancyParkingAllocations(occupancyId, { active: true }))
                );
                chunkResults.forEach((list) => {
                    if (list?.length) results.push(...list);
                });
            }
            return results;
        },
        enabled: canReadUnits && Boolean(selectedBuildingId) && activeOccupancyIds.length > 0,
        staleTime: 60_000,
    });

    const allocations = allocationsQuery.data || [];

    const parkingCountByUnitId = useMemo(() => {
        const counts = new Map<string, number>();
        allocations.forEach((allocation) => {
            if (!allocation.occupancyId) return;
            const occupancy = activeOccupancyById.get(allocation.occupancyId);
            const unitId = occupancy?.unitId;
            if (!unitId) return;
            counts.set(unitId, (counts.get(unitId) ?? 0) + 1);
        });
        return counts;
    }, [allocations, activeOccupancyById]);

    const normalizeUnitKey = (value?: string) => {
        if (!value) return "";
        return value.toLowerCase().replace(/[^a-z0-9]/g, "");
    };

    const slotCountByUnitLabel = useMemo(() => {
        const counts = new Map<string, number>();
        (parkingSlots || []).forEach((slot) => {
            const normalizedCode = normalizeUnitKey(slot.code);
            if (!normalizedCode) return;
            const match = normalizedCode.match(/^(.+)p\d+/);
            if (!match || !match[1]) return;
            const labelKey = match[1];
            counts.set(labelKey, (counts.get(labelKey) ?? 0) + 1);
        });
        return counts;
    }, [parkingSlots]);

    const getParkingCountForUnit = (unit: Pick<BuildingUnit, "id" | "label">) => {
        const allocatedCount = parkingCountByUnitId.get(unit.id) ?? 0;
        const labelKey = normalizeUnitKey(unit.label);
        const prefixCount = labelKey ? (slotCountByUnitLabel.get(labelKey) ?? 0) : 0;
        return Math.max(allocatedCount, prefixCount);
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

    const filteredUnits = useMemo(() => {
        if (!units) return [];
        return units.filter((unit) => {
            const occupied = isUnitOccupied(unit);
            const isVacant = occupied ? false : (unit.isAvailable ?? availableUnitIds.has(unit.id));
            const effectiveStatus = getEffectiveUnitStatus(unit, isVacant);
            const passesVacancy =
                unitFilter === "all" ? true : unitFilter === "vacant" ? isVacant : !isVacant;
            const parkingCount = getParkingCountForUnit(unit);
            const passesParking = parkingFilter === "all" ? true : parkingCount > 0;
            const passesFloor = floorFilter === "all" ? true : unit.floor?.toString() === floorFilter;
            const passesUnitType = unitTypeFilter === "all" ? true : unit.unitTypeId === unitTypeFilter;
            const passesStatus = unitStatusFilter === "all" ? true : effectiveStatus === unitStatusFilter;
            const residentSearch = residentSearchByUnitId.get(unit.id) ?? "";
            const haystack = [
                unit.label,
                unit.id,
                unit.floor ? `floor ${unit.floor}` : "",
                unit.unitTypeId ? getUnitTypeName(unit.unitTypeId) : "",
                effectiveStatus,
                residentSearch,
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
        parkingCountByUnitId,
        slotCountByUnitLabel,
        debouncedSearch,
        residentSearchByUnitId,
        activeOccupancyByUnitId,
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
            const normalizedFile = await normalizeUnitsCsvFile(importFile, unitTypes);
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
        } catch (error: any) {
            toast.error(error?.message || "Failed to import units");
        } finally {
            setIsImporting(false);
        }
    };

    const availableCount = useMemo(() => {
        return (units || []).filter((u) => !isUnitOccupied(u)).length;
    }, [units, activeOccupancyByUnitId]);

    const occupiedCount = useMemo(() => {
        return (units || []).filter((u) => isUnitOccupied(u)).length;
    }, [units, activeOccupancyByUnitId]);

    const getUnitTypeName = (typeId?: string) => {
        if (!typeId || !unitTypes) return "-";
        const type = unitTypes.find((t) => t.id === typeId);
        return type?.name || "-";
    };
    const activeBuildingLabel = useMemo(
        () => buildingOptions.find((building) => building.id === selectedBuildingId)?.name ?? "Select building",
        [buildingOptions, selectedBuildingId]
    );

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
                                    <a href="/units_template.csv" download>
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
                            Upload a CSV, validate it, then confirm the import.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
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
