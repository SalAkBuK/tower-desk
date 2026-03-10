"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Search, LayoutGrid, Home, Plus, Check, List, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
    useAdminBuildings,
    useManagerBuildings,
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
import { getOccupancyParkingAllocations, importBuildingUnitsCsv } from "@/lib/api";

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
    const isManager = baseRole === "manager";
    const leaseBasePath = "/portal/contracts";
    const adminBuildingsQuery = useAdminBuildings(isManager ? undefined : user?.id);
    const managerBuildingsQuery = useManagerBuildings(isManager ? user?.id : undefined);
    const buildings = isManager ? managerBuildingsQuery.data : adminBuildingsQuery.data;
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

    const { data: unitTypes } = useUnitTypes();

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

    const { data: units, isLoading } = useBuildingUnits(selectedBuildingId, { includeOccupancy: true, enabled: Boolean(selectedBuildingId) });
    const { data: availableUnits } = useBuildingUnits(selectedBuildingId, { available: true, enabled: Boolean(selectedBuildingId) });
    const { data: occupancies } = useBuildingOccupancies(selectedBuildingId, { enabled: Boolean(selectedBuildingId) });
    const { data: parkingSlots } = useParkingSlots(selectedBuildingId, { enabled: Boolean(selectedBuildingId) });
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
        enabled: Boolean(selectedBuildingId) && activeOccupancyIds.length > 0,
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
                    
                        <Button variant="outline" onClick={() => setIsImportOpen(true)} disabled={!selectedBuildingId}>
                            Import Units (CSV)
                        </Button>
                        <Button variant="outline" asChild>
                            <a href="/units_template_fixed.csv" download>
                                Download Template
                            </a>
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
                <CardHeader className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <CardTitle>{directoryTitle}</CardTitle>
                        <p className="text-sm text-zinc-500">{directoryDescription}</p>
                    </div>
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search unit, resident, or type"
                            className="pl-9"
                        />
                    </div>
                    </div>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Status filter */}
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

                            <Select value={unitStatusFilter} onValueChange={(value) => setUnitStatusFilter(value as "all" | UnitStatus)}>
                                <SelectTrigger className="w-[190px] h-9">
                                    <SelectValue placeholder="Unit Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="AVAILABLE">Available</SelectItem>
                                    <SelectItem value="OCCUPIED">Occupied</SelectItem>
                                    <SelectItem value="UNDER_MAINTENANCE">Under Maintenance</SelectItem>
                                    <SelectItem value="BLOCKED">Blocked</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Floor filter */}
                            {availableFloors.length > 0 && (
                                <Select value={floorFilter} onValueChange={setFloorFilter}>
                                    <SelectTrigger className="w-[120px] h-9">
                                        <SelectValue placeholder="Floor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Floors</SelectItem>
                                        {availableFloors.map((floor) => (
                                            <SelectItem key={floor} value={floor.toString()}>
                                                Floor {floor}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}

                            {/* Unit Type filter */}
                            {availableUnitTypeIds.length > 0 && (
                                <Select value={unitTypeFilter} onValueChange={setUnitTypeFilter}>
                                    <SelectTrigger className="w-[140px] h-9">
                                        <SelectValue placeholder="Unit Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Types</SelectItem>
                                        {availableUnitTypeIds.map((typeId) => (
                                            <SelectItem key={typeId} value={typeId}>
                                                {getUnitTypeName(typeId)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}

                            {/* Parking filter */}
                            <div className="flex items-center gap-2 bg-zinc-100/50 p-1 rounded-lg border border-zinc-200/50">
                                <Button
                                    variant={parkingFilter === "all" ? "white" : "ghost"}
                                    size="sm"
                                    onClick={() => setParkingFilter("all")}
                                    className={parkingFilter === "all" ? "bg-white shadow-sm" : ""}
                                >
                                    Any
                                </Button>
                                <Button
                                    variant={parkingFilter === "withParking" ? "white" : "ghost"}
                                    size="sm"
                                    onClick={() => setParkingFilter("withParking")}
                                    className={parkingFilter === "withParking" ? "bg-white shadow-sm" : ""}
                                >
                                    With Parking
                                </Button>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 bg-zinc-100/50 p-1 rounded-lg border border-zinc-200/50">
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
                </CardContent>
            </Card>

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
