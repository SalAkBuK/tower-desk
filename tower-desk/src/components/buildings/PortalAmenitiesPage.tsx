"use client";

import { Fragment, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Building2, ChevronDown, ChevronUp, MapPin, Plus, Search, Settings, Star } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { getBuildingAmenities } from "@/lib/api/units";
import { getUserPermissionSet, hasAnyPermission } from "@/lib/permissions";
import { getPortalModuleByKey } from "@/lib/portalRegistry";
import { useAccessibleBuildings, useCreateBuildingAmenity, useUpdateBuildingAmenity } from "@/lib/queries";
import type { Amenity, Building } from "@/lib/types";
import { formatBuildingLocation } from "@/lib/utils";

type AmenityDialogState = {
    buildingId: string;
    buildingName: string;
    amenity?: Amenity;
} | null;

type AmenitiesView = "catalog" | "by_building" | "gaps";

type AmenityCatalogEntry = {
    key: string;
    name: string;
    buildings: {
        buildingId: string;
        buildingName: string;
        amenity: Amenity;
    }[];
    buildingCount: number;
    activeCount: number;
    inactiveCount: number;
    defaultCount: number;
};

type BuildingAmenityRow = {
    building: Building;
    amenities: Amenity[];
    totalAmenities: number;
    activeAmenities: number;
    defaultAmenities: number;
};

type AmenityGapRow = BuildingAmenityRow & {
    missingCommonAmenities: string[];
};

type AmenitiesSummary = {
    buildings: number;
    totalAmenities: number;
    activeAmenities: number;
    defaultAmenities: number;
    inactiveAmenities: number;
    uniqueAmenities: number;
};

const normalizeAmenityKey = (value?: string | null) =>
    String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

const AMENITY_CATEGORY_RULES = [
    { label: "Security", keywords: ["security", "cctv", "surveillance", "access control", "fire", "concierge", "reception"] },
    { label: "Parking", keywords: ["parking", "valet", "charging"] },
    { label: "Wellness", keywords: ["gym", "fitness", "spa", "sauna", "steam", "jacuzzi", "yoga", "pool", "swimming"] },
    { label: "Leisure", keywords: ["play", "bbq", "cinema", "games", "sports", "jogging", "garden", "lounge"] },
    { label: "Community", keywords: ["meeting", "multipurpose", "business center", "community", "prayer", "lobby", "waiting"] },
    { label: "Services", keywords: ["internet", "retail", "supermarket", "restaurant", "cafe", "maintenance", "smart home", "elevator"] },
] as const;

const getAmenityCategoryLabel = (amenityName?: string | null) => {
    const normalized = normalizeAmenityKey(amenityName);
    const matchedRule = AMENITY_CATEGORY_RULES.find((rule) =>
        rule.keywords.some((keyword) => normalized.includes(keyword))
    );
    return matchedRule?.label ?? "Other";
};

const groupAmenitiesByCategory = (amenities: Amenity[]) => {
    const groups = new Map<string, Amenity[]>();

    amenities.forEach((amenity) => {
        const label = getAmenityCategoryLabel(amenity.name);
        const current = groups.get(label) ?? [];
        current.push(amenity);
        groups.set(label, current);
    });

    return Array.from(groups.entries())
        .map(([label, items]) => ({
            label,
            items: items.sort((a, b) => a.name.localeCompare(b.name)),
        }))
        .sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));
};

export function PortalAmenitiesPage() {
    const { user, baseRole } = useAuth();
    const [search, setSearch] = useState("");
    const [activeView, setActiveView] = useState<AmenitiesView>("catalog");
    const [expandedCatalogKey, setExpandedCatalogKey] = useState<string | null>(null);
    const [amenityDialog, setAmenityDialog] = useState<AmenityDialogState>(null);
    const [amenityName, setAmenityName] = useState("");
    const [amenityDefault, setAmenityDefault] = useState(false);
    const [amenityActive, setAmenityActive] = useState(true);
    const [amenityError, setAmenityError] = useState<string | null>(null);
    const permissionSet = getUserPermissionSet(user);
    const amenitiesModuleRule = getPortalModuleByKey("amenities")?.rule;
    const canReadAmenities = Boolean(amenitiesModuleRule && hasAnyPermission(permissionSet, amenitiesModuleRule));
    const sessionPermissionKeys = (user?.effectivePermissions ?? []).map((key) => String(key).toLowerCase());
    const canManageAmenities = baseRole === "admin"
        || baseRole === "org_admin"
        || baseRole === "superadmin"
        || sessionPermissionKeys.includes("buildings.write")
        || sessionPermissionKeys.includes("amenities.write")
        || sessionPermissionKeys.includes("building.amenities.write")
        || sessionPermissionKeys.some((key) => key.includes("amenit") && key.includes("write"));
    const accessibleBuildingsQuery = useAccessibleBuildings(user?.id, baseRole, { enabled: canReadAmenities });
    const buildings = useMemo(() => accessibleBuildingsQuery.data ?? [], [accessibleBuildingsQuery.data]);
    const createAmenityMutation = useCreateBuildingAmenity();
    const updateAmenityMutation = useUpdateBuildingAmenity();
    const amenitiesQueries = useQueries({
        queries: buildings.map((building) => ({
            queryKey: ["building-amenities", building.id],
            queryFn: () => getBuildingAmenities(building.id),
            enabled: canReadAmenities && Boolean(building.id),
            staleTime: 60_000,
        })),
    });

    const buildingRows = useMemo(() => {
        return buildings.map((building, index) => {
            const amenities = amenitiesQueries[index]?.data ?? [];
            return {
                building,
                amenities,
                totalAmenities: amenities.length,
                activeAmenities: amenities.filter((entry) => entry.isActive !== false).length,
                defaultAmenities: amenities.filter((entry) => entry.isDefault).length,
            };
        });
    }, [amenitiesQueries, buildings]);

    const filteredRows = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return buildingRows;
        return buildingRows.filter(({ building, amenities }) => {
            const location = formatBuildingLocation(building).toLowerCase();
            return building.name.toLowerCase().includes(term)
                || location.includes(term)
                || amenities.some((entry) => entry.name.toLowerCase().includes(term));
        });
    }, [buildingRows, search]);

    const catalogEntries = useMemo<AmenityCatalogEntry[]>(() => {
        const catalog = new Map<string, AmenityCatalogEntry>();

        buildingRows.forEach(({ building, amenities }) => {
            amenities.forEach((amenity) => {
                const key = normalizeAmenityKey(amenity.name);
                if (!key) return;

                const existing = catalog.get(key) ?? {
                    key,
                    name: amenity.name.trim() || "Unnamed amenity",
                    buildings: [],
                    buildingCount: 0,
                    activeCount: 0,
                    inactiveCount: 0,
                    defaultCount: 0,
                };

                existing.buildings.push({
                    buildingId: building.id,
                    buildingName: building.name,
                    amenity,
                });

                catalog.set(key, existing);
            });
        });

        return Array.from(catalog.values())
            .map((entry) => ({
                ...entry,
                buildings: entry.buildings.sort((a, b) => a.buildingName.localeCompare(b.buildingName)),
                buildingCount: entry.buildings.length,
                activeCount: entry.buildings.filter((item) => item.amenity.isActive !== false).length,
                inactiveCount: entry.buildings.filter((item) => item.amenity.isActive === false).length,
                defaultCount: entry.buildings.filter((item) => item.amenity.isDefault).length,
            }))
            .sort((a, b) => b.buildingCount - a.buildingCount || a.name.localeCompare(b.name));
    }, [buildingRows]);

    const filteredCatalogEntries = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return catalogEntries;
        return catalogEntries.filter((entry) =>
            entry.name.toLowerCase().includes(term)
            || entry.buildings.some((item) => item.buildingName.toLowerCase().includes(term))
        );
    }, [catalogEntries, search]);

    const commonAmenityThreshold = useMemo(
        () => Math.max(2, Math.ceil(buildingRows.length / 2)),
        [buildingRows.length]
    );

    const commonAmenityEntries = useMemo(
        () => catalogEntries.filter((entry) => entry.buildingCount >= commonAmenityThreshold),
        [catalogEntries, commonAmenityThreshold]
    );

    const gapRows = useMemo(() => {
        return buildingRows
            .map((row) => {
                const amenityKeys = new Set(row.amenities.map((amenity) => normalizeAmenityKey(amenity.name)));
                const missingCommonAmenities = commonAmenityEntries
                    .filter((entry) => !amenityKeys.has(entry.key))
                    .map((entry) => entry.name);
                return {
                    ...row,
                    missingCommonAmenities,
                };
            })
            .filter((row) => row.missingCommonAmenities.length > 0)
            .sort((a, b) => b.missingCommonAmenities.length - a.missingCommonAmenities.length || a.building.name.localeCompare(b.building.name));
    }, [buildingRows, commonAmenityEntries]);

    const filteredGapRows = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return gapRows;
        return gapRows.filter((row) =>
            row.building.name.toLowerCase().includes(term)
            || formatBuildingLocation(row.building).toLowerCase().includes(term)
            || row.missingCommonAmenities.some((name) => name.toLowerCase().includes(term))
        );
    }, [gapRows, search]);

    const inactiveCatalogEntries = useMemo(
        () => filteredCatalogEntries.filter((entry) => entry.inactiveCount > 0),
        [filteredCatalogEntries]
    );

    const singleBuildingCatalogEntries = useMemo(
        () => filteredCatalogEntries.filter((entry) => entry.buildingCount === 1),
        [filteredCatalogEntries]
    );

    const summary = useMemo(() => {
        return buildingRows.reduce(
            (acc, row) => {
                acc.buildings += 1;
                acc.totalAmenities += row.totalAmenities;
                acc.activeAmenities += row.activeAmenities;
                acc.defaultAmenities += row.defaultAmenities;
                acc.inactiveAmenities += row.totalAmenities - row.activeAmenities;
                return acc;
            },
            {
                buildings: 0,
                totalAmenities: 0,
                activeAmenities: 0,
                defaultAmenities: 0,
                inactiveAmenities: 0,
                uniqueAmenities: catalogEntries.length,
            }
        );
    }, [buildingRows, catalogEntries.length]);

    const isLoading = accessibleBuildingsQuery.isLoading || amenitiesQueries.some((query) => query.isLoading);
    const isSavingAmenity = createAmenityMutation.isPending || updateAmenityMutation.isPending;

    const openAmenityDialog = (buildingId: string, buildingName: string, amenity?: Amenity) => {
        setAmenityDialog({ buildingId, buildingName, amenity });
        setAmenityName(amenity?.name ?? "");
        setAmenityDefault(Boolean(amenity?.isDefault));
        setAmenityActive(amenity?.isActive ?? true);
        setAmenityError(null);
    };

    const closeAmenityDialog = () => {
        setAmenityDialog(null);
        setAmenityName("");
        setAmenityDefault(false);
        setAmenityActive(true);
        setAmenityError(null);
    };

    const handleAmenitySave = async () => {
        if (!amenityDialog) return;
        const trimmed = amenityName.trim();
        if (!trimmed) {
            setAmenityError("Amenity name is required.");
            return;
        }

        setAmenityError(null);

        try {
            if (amenityDialog.amenity) {
                await updateAmenityMutation.mutateAsync({
                    buildingId: amenityDialog.buildingId,
                    amenityId: amenityDialog.amenity.id,
                    data: { name: trimmed, isDefault: amenityDefault, isActive: amenityActive },
                });
                toast.success("Amenity updated.");
            } else {
                await createAmenityMutation.mutateAsync({
                    buildingId: amenityDialog.buildingId,
                    data: { name: trimmed, isDefault: amenityDefault, isActive: amenityActive },
                });
                toast.success("Amenity created.");
            }
            closeAmenityDialog();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to save amenity.";
            setAmenityError(message);
        }
    };

    if (!canReadAmenities) {
        return (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                        <Star className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-zinc-900">Amenities</h1>
                        <p className="text-sm text-zinc-500">You do not have permission to view amenities.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto flex max-w-7xl flex-col gap-8 p-6 md:p-8">
            <section className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03),0_16px_40px_rgba(0,0,0,0.04)]">
                <div className="border-b border-zinc-100 bg-[radial-gradient(circle_at_top_left,_rgba(24,24,27,0.06),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(5,150,105,0.08),_transparent_34%),linear-gradient(180deg,_rgba(250,250,250,0.95),_#ffffff)] px-6 py-6 md:px-8 md:py-8">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl">
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/90 px-3 py-1 text-xs font-medium text-zinc-600 shadow-sm">
                                <Star className="h-3.5 w-3.5 text-emerald-600" />
                                Standalone settings workspace
                            </div>
                            <h1 className="text-3xl font-bold tracking-tight text-zinc-950 md:text-4xl">Amenities</h1>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 md:text-base">
                                Review, create, and edit amenities across your accessible buildings from one dedicated settings page.
                            </p>
                        </div>
                        <div className="w-full max-w-md">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                <Input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Search buildings or amenities"
                                    className="h-11 rounded-xl bg-white pl-9"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <SummaryCard label="Buildings" value={summary.buildings} detail="Buildings in scope" icon={Building2} tone="bg-zinc-900 text-white" />
                        <SummaryCard label="Unique Amenities" value={summary.uniqueAmenities} detail="Portfolio-wide amenity types" icon={Star} tone="bg-zinc-100 text-zinc-700" />
                        <SummaryCard label="Inactive Entries" value={summary.inactiveAmenities} detail="Assignments currently disabled" icon={Settings} tone="bg-emerald-50 text-emerald-700" />
                        <SummaryCard label="Default Coverage" value={summary.defaultAmenities} detail="Marked default for new units" icon={Star} tone="bg-amber-50 text-amber-700" />
                    </div>
                </div>
            </section>

            <AmenitiesWorkspace
                activeView={activeView}
                canManageAmenities={canManageAmenities}
                commonAmenityThreshold={commonAmenityThreshold}
                expandedCatalogKey={expandedCatalogKey}
                filteredCatalogEntries={filteredCatalogEntries}
                filteredGapRows={filteredGapRows}
                filteredRows={filteredRows}
                inactiveCatalogEntries={inactiveCatalogEntries}
                isLoading={isLoading}
                onOpenAmenityDialog={openAmenityDialog}
                onSetActiveView={setActiveView}
                onSetExpandedCatalogKey={setExpandedCatalogKey}
                singleBuildingCatalogEntries={singleBuildingCatalogEntries}
                summary={summary}
            />

            <Dialog open={Boolean(amenityDialog)} onOpenChange={(open) => {
                if (!open) closeAmenityDialog();
            }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{amenityDialog?.amenity ? "Edit Amenity" : "Add Amenity"}</DialogTitle>
                        <DialogDescription>
                            {amenityDialog ? `Manage amenities for ${amenityDialog.buildingName}.` : "Manage building amenities."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-900">Amenity name</label>
                            <Input
                                value={amenityName}
                                onChange={(event) => setAmenityName(event.target.value)}
                                placeholder="e.g. Swimming Pool"
                            />
                        </div>
                        <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                            <label className="flex items-center gap-3 text-sm text-zinc-700">
                                <Checkbox checked={amenityDefault} onCheckedChange={(checked) => setAmenityDefault(Boolean(checked))} />
                                Default for new units
                            </label>
                            <label className="flex items-center gap-3 text-sm text-zinc-700">
                                <Checkbox checked={amenityActive} onCheckedChange={(checked) => setAmenityActive(Boolean(checked))} />
                                Active enabled
                            </label>
                        </div>
                        {amenityError ? (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                {amenityError}
                            </div>
                        ) : null}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeAmenityDialog}>Cancel</Button>
                        <Button onClick={() => { void handleAmenitySave(); }} disabled={isSavingAmenity}>
                            {isSavingAmenity ? "Saving..." : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function SummaryCard({
    label,
    value,
    detail,
    icon: Icon,
    tone,
}: {
    label: string;
    value: number;
    detail: string;
    icon: typeof Building2;
    tone: string;
}) {
    return (
        <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] backdrop-blur">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
                <Icon className="h-4 w-4" />
            </div>
            <div className="mt-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">{label}</div>
                <div className="mt-1 text-3xl font-bold tracking-tight text-zinc-950">{value}</div>
            </div>
            <p className="mt-2 text-xs text-zinc-500">{detail}</p>
        </div>
    );
}

type AmenitiesWorkspaceProps = {
    activeView: AmenitiesView;
    canManageAmenities: boolean;
    commonAmenityThreshold: number;
    expandedCatalogKey: string | null;
    filteredCatalogEntries: AmenityCatalogEntry[];
    filteredGapRows: AmenityGapRow[];
    filteredRows: BuildingAmenityRow[];
    inactiveCatalogEntries: AmenityCatalogEntry[];
    isLoading: boolean;
    onOpenAmenityDialog: (buildingId: string, buildingName: string, amenity?: Amenity) => void;
    onSetActiveView: (value: AmenitiesView) => void;
    onSetExpandedCatalogKey: (value: string | null) => void;
    singleBuildingCatalogEntries: AmenityCatalogEntry[];
    summary: AmenitiesSummary;
};

function AmenitiesWorkspace({
    activeView,
    canManageAmenities,
    commonAmenityThreshold,
    expandedCatalogKey,
    filteredCatalogEntries,
    filteredGapRows,
    filteredRows,
    inactiveCatalogEntries,
    isLoading,
    onOpenAmenityDialog,
    onSetActiveView,
    onSetExpandedCatalogKey,
    singleBuildingCatalogEntries,
    summary,
}: AmenitiesWorkspaceProps) {
    return (
        <Tabs
            value={activeView}
            onValueChange={(value) => {
                onSetActiveView(value as AmenitiesView);
                if (value !== "catalog") {
                    onSetExpandedCatalogKey(null);
                }
            }}
            className="space-y-5"
        >
            <div className="flex justify-start">
                <TabsList className="h-auto flex-wrap justify-start rounded-2xl border border-zinc-200 bg-white p-1 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                    <TabsTrigger value="catalog" className="rounded-xl px-4 py-2 text-sm">Catalog</TabsTrigger>
                    <TabsTrigger value="by_building" className="rounded-xl px-4 py-2 text-sm">By Building</TabsTrigger>
                    <TabsTrigger value="gaps" className="rounded-xl px-4 py-2 text-sm">Gaps</TabsTrigger>
                </TabsList>
            </div>

            {isLoading ? (
                <div className="space-y-5">
                    {[1, 2, 3].map((index) => <Skeleton key={index} className="h-72 rounded-[24px]" />)}
                </div>
            ) : (
                <>
                    <AmenitiesCatalogTab
                        canManageAmenities={canManageAmenities}
                        entries={filteredCatalogEntries}
                        expandedCatalogKey={expandedCatalogKey}
                        inactiveCatalogEntries={inactiveCatalogEntries}
                        onOpenAmenityDialog={onOpenAmenityDialog}
                        onSetExpandedCatalogKey={onSetExpandedCatalogKey}
                        singleBuildingCatalogEntries={singleBuildingCatalogEntries}
                        summary={summary}
                    />
                    <AmenitiesByBuildingTab
                        canManageAmenities={canManageAmenities}
                        rows={filteredRows}
                        onOpenAmenityDialog={onOpenAmenityDialog}
                    />
                    <AmenitiesGapsTab
                        commonAmenityThreshold={commonAmenityThreshold}
                        gapRows={filteredGapRows}
                        inactiveCatalogEntries={inactiveCatalogEntries}
                        singleBuildingCatalogEntries={singleBuildingCatalogEntries}
                    />
                </>
            )}
        </Tabs>
    );
}

type AmenitiesCatalogTabProps = {
    canManageAmenities: boolean;
    entries: AmenityCatalogEntry[];
    expandedCatalogKey: string | null;
    inactiveCatalogEntries: AmenityCatalogEntry[];
    onOpenAmenityDialog: (buildingId: string, buildingName: string, amenity?: Amenity) => void;
    onSetExpandedCatalogKey: (value: string | null) => void;
    singleBuildingCatalogEntries: AmenityCatalogEntry[];
    summary: AmenitiesSummary;
};

function AmenitiesCatalogTab({
    canManageAmenities,
    entries,
    expandedCatalogKey,
    inactiveCatalogEntries,
    onOpenAmenityDialog,
    onSetExpandedCatalogKey,
    singleBuildingCatalogEntries,
    summary,
}: AmenitiesCatalogTabProps) {
    return (
        <TabsContent value="catalog" className="mt-0">
            {entries.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-zinc-200 bg-zinc-50/80 px-6 py-16 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-200 bg-white shadow-sm">
                        <Star className="h-6 w-6 text-zinc-300" />
                    </div>
                    <h3 className="text-lg font-semibold tracking-tight text-zinc-900">No matching amenities found</h3>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">
                        Try a different amenity name or building search to find the coverage record you need.
                    </p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                    <div className="border-b border-zinc-100 px-6 py-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                            <div>
                                <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Amenity catalog</h3>
                                <p className="mt-1 text-sm text-zinc-500">
                                    Each row represents one amenity across the portfolio. Expand a row to inspect exact building coverage.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <SummaryBadge label="Unique amenities" value={entries.length} />
                                <SummaryBadge label="Inactive entries" value={inactiveCatalogEntries.length} />
                                <SummaryBadge label="Single-building" value={singleBuildingCatalogEntries.length} />
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="w-[260px] px-6 py-4">Amenity</TableHead>
                                    <TableHead className="w-[150px] py-4">Buildings</TableHead>
                                    <TableHead className="w-[140px] py-4">Default In</TableHead>
                                    <TableHead className="w-[140px] py-4">Inactive In</TableHead>
                                    <TableHead className="min-w-[320px] py-4">Coverage</TableHead>
                                    <TableHead className="w-[130px] px-6 py-4 text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {entries.map((entry) => {
                                    const isExpanded = expandedCatalogKey === entry.key;

                                    return (
                                        <Fragment key={entry.key}>
                                            <TableRow className="align-top">
                                                <TableCell className="px-6 py-5">
                                                    <div className="space-y-2">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <div className="text-sm font-semibold text-zinc-950">{entry.name}</div>
                                                            {entry.defaultCount > 0 ? (
                                                                <Badge variant="secondary" className="border border-amber-200 bg-amber-50 text-amber-700">
                                                                    Default in {entry.defaultCount}
                                                                </Badge>
                                                            ) : null}
                                                            {entry.inactiveCount > 0 ? (
                                                                <Badge variant="secondary" className="border border-zinc-200 bg-zinc-100 text-zinc-600">
                                                                    {entry.inactiveCount} inactive
                                                                </Badge>
                                                            ) : null}
                                                        </div>
                                                        <p className="text-sm text-zinc-500">
                                                            {entry.buildingCount === summary.buildings
                                                                ? "Configured in every accessible building."
                                                                : `Configured in ${entry.buildingCount} of ${summary.buildings} accessible buildings.`}
                                                        </p>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-5">
                                                    <StatPill label="Using" value={entry.buildingCount} tone="zinc" />
                                                </TableCell>
                                                <TableCell className="py-5">
                                                    <StatPill label="Default" value={entry.defaultCount} tone="amber" />
                                                </TableCell>
                                                <TableCell className="py-5">
                                                    <StatPill label="Inactive" value={entry.inactiveCount} tone="zinc" />
                                                </TableCell>
                                                <TableCell className="py-5">
                                                    <div className="flex flex-wrap gap-2">
                                                        {entry.buildings.slice(0, 3).map((item) => (
                                                            <button
                                                                key={item.amenity.id}
                                                                type="button"
                                                                onClick={() => onOpenAmenityDialog(item.buildingId, item.buildingName, item.amenity)}
                                                                disabled={!canManageAmenities}
                                                                className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-white disabled:cursor-default disabled:hover:border-zinc-200 disabled:hover:bg-zinc-50"
                                                            >
                                                                <span>{item.buildingName}</span>
                                                                {item.amenity.isActive === false ? (
                                                                    <span className="text-zinc-400">Inactive</span>
                                                                ) : null}
                                                            </button>
                                                        ))}
                                                        {entry.buildings.length > 3 ? (
                                                            <div className="inline-flex items-center rounded-full border border-dashed border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500">
                                                                +{entry.buildings.length - 3} more
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-6 py-5">
                                                    <div className="flex justify-end">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={() => onSetExpandedCatalogKey(isExpanded ? null : entry.key)}
                                                            className="rounded-xl"
                                                        >
                                                            {isExpanded ? "Hide" : "Review"}
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                            {isExpanded ? (
                                                <TableRow className="bg-zinc-50/60 hover:bg-zinc-50/60">
                                                    <TableCell colSpan={6} className="px-6 py-5">
                                                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                                            {entry.buildings.map((item) => (
                                                                <div key={item.amenity.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                                                                    <div className="flex items-start justify-between gap-3">
                                                                        <div>
                                                                            <div className="text-sm font-semibold text-zinc-950">{item.buildingName}</div>
                                                                            <div className="mt-1 text-sm text-zinc-500">
                                                                                {item.amenity.isDefault ? "Default for new units" : "Custom assignment"}
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex flex-wrap justify-end gap-2">
                                                                            <Badge variant="secondary" className={item.amenity.isActive === false ? "border border-zinc-200 bg-zinc-100 text-zinc-600" : "border border-emerald-200 bg-emerald-50 text-emerald-700"}>
                                                                                {item.amenity.isActive === false ? "Inactive" : "Active"}
                                                                            </Badge>
                                                                            {item.amenity.isDefault ? (
                                                                                <Badge variant="secondary" className="border border-amber-200 bg-amber-50 text-amber-700">
                                                                                    Default
                                                                                </Badge>
                                                                            ) : null}
                                                                        </div>
                                                                    </div>
                                                                    {canManageAmenities ? (
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            onClick={() => onOpenAmenityDialog(item.buildingId, item.buildingName, item.amenity)}
                                                                            className="mt-4 w-full rounded-xl"
                                                                        >
                                                                            Edit Amenity
                                                                        </Button>
                                                                    ) : null}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : null}
                                        </Fragment>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}
        </TabsContent>
    );
}

type AmenitiesByBuildingTabProps = {
    canManageAmenities: boolean;
    rows: BuildingAmenityRow[];
    onOpenAmenityDialog: (buildingId: string, buildingName: string, amenity?: Amenity) => void;
};

function AmenitiesByBuildingTab({ canManageAmenities, rows, onOpenAmenityDialog }: AmenitiesByBuildingTabProps) {
    const [expandedBuildingId, setExpandedBuildingId] = useState<string | null>(null);

    return (
        <TabsContent value="by_building" className="mt-0">
            {rows.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-zinc-200 bg-zinc-50/80 px-6 py-16 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-200 bg-white shadow-sm">
                        <Building2 className="h-6 w-6 text-zinc-300" />
                    </div>
                    <h3 className="text-lg font-semibold tracking-tight text-zinc-900">No matching buildings found</h3>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">
                        Adjust the search term to review amenities by building again.
                    </p>
                </div>
            ) : (
                <div className="space-y-5">
                    <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:p-7">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                            <div>
                                <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Building amenities</h3>
                                <p className="mt-1 text-sm text-zinc-500">
                                    Each building keeps its own amenity set. Use this view when you want to edit one building in place.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <SummaryBadge label="Buildings" value={rows.length} />
                                <SummaryBadge label="Amenities" value={rows.reduce((count, row) => count + row.totalAmenities, 0)} />
                                <SummaryBadge label="Active" value={rows.reduce((count, row) => count + row.activeAmenities, 0)} />
                            </div>
                        </div>
                    </section>

                    <div className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="w-[280px] px-6 py-4">Building</TableHead>
                                        <TableHead className="w-[190px] py-4">Coverage</TableHead>
                                        <TableHead className="min-w-[320px] py-4">Summary</TableHead>
                                        <TableHead className="w-[220px] px-6 py-4 text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.map(({ building, amenities, totalAmenities, activeAmenities, defaultAmenities }) => {
                                        const isExpanded = expandedBuildingId === building.id;
                                        const groupedAmenities = groupAmenitiesByCategory(amenities);
                                        const previewAmenities = amenities
                                            .slice()
                                            .sort((a, b) => a.name.localeCompare(b.name))
                                            .slice(0, 3);

                                        return (
                                            <Fragment key={building.id}>
                                                <TableRow className="align-top">
                                                    <TableCell className="px-6 py-5">
                                                        <div className="flex items-start gap-3">
                                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-zinc-700">
                                                                <Building2 className="h-4.5 w-4.5" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <div className="text-sm font-semibold text-zinc-950">{building.name}</div>
                                                                    <Badge variant="secondary" className="border border-zinc-200 bg-zinc-50 text-zinc-600">
                                                                        {building.status}
                                                                    </Badge>
                                                                </div>
                                                                <div className="mt-1 flex items-center text-sm text-zinc-500">
                                                                    <MapPin className="mr-1.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
                                                                    <span className="truncate">{formatBuildingLocation(building) || "Location not set"}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-5">
                                                        <div className="flex flex-wrap gap-2">
                                                            <StatPill label="Total" value={totalAmenities} tone="zinc" />
                                                            <StatPill label="Active" value={activeAmenities} tone="emerald" />
                                                            <StatPill label="Default" value={defaultAmenities} tone="amber" />
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-5">
                                                        {amenities.length > 0 ? (
                                                            <div className="space-y-3">
                                                                <div className="flex flex-wrap gap-2">
                                                                    {groupedAmenities.slice(0, 3).map((group) => (
                                                                        <Badge key={`${building.id}-${group.label}`} variant="secondary" className="border border-zinc-200 bg-zinc-50 text-zinc-700">
                                                                            {group.label} ({group.items.length})
                                                                        </Badge>
                                                                    ))}
                                                                    {groupedAmenities.length > 3 ? (
                                                                        <Badge variant="secondary" className="border border-zinc-200 bg-white text-zinc-500">
                                                                            +{groupedAmenities.length - 3} more
                                                                        </Badge>
                                                                    ) : null}
                                                                </div>
                                                                <div className="text-sm text-zinc-500">
                                                                    {previewAmenities.map((amenity) => amenity.name).join(", ")}
                                                                    {amenities.length > previewAmenities.length ? `, +${amenities.length - previewAmenities.length} more` : ""}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-4 text-sm text-zinc-500">
                                                                No amenities configured yet.
                                                                {canManageAmenities ? " Use Add Amenity to create the first one." : ""}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="px-6 py-5">
                                                        <div className="flex justify-end gap-2">
                                                            {amenities.length > 0 ? (
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    onClick={() => setExpandedBuildingId(isExpanded ? null : building.id)}
                                                                    className="rounded-xl"
                                                                >
                                                                    {isExpanded ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                                                                    {isExpanded ? "Hide" : "View"}
                                                                </Button>
                                                            ) : null}
                                                            {canManageAmenities ? (
                                                                <Button
                                                                    type="button"
                                                                    onClick={() => onOpenAmenityDialog(building.id, building.name)}
                                                                    className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
                                                                >
                                                                    <Plus className="mr-2 h-4 w-4" />
                                                                    Add Amenity
                                                                </Button>
                                                            ) : null}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                                {isExpanded ? (
                                                    <TableRow className="bg-zinc-50/60 hover:bg-zinc-50/60">
                                                        <TableCell colSpan={4} className="px-6 py-5">
                                                            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                                                                {groupedAmenities.map((group) => (
                                                                    <div key={`${building.id}-${group.label}`} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                                                                        <div className="flex items-center justify-between gap-3">
                                                                            <div className="text-sm font-semibold text-zinc-950">{group.label}</div>
                                                                            <Badge variant="secondary" className="border border-zinc-200 bg-zinc-50 text-zinc-600">
                                                                                {group.items.length}
                                                                            </Badge>
                                                                        </div>
                                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                                            {group.items.map((amenity) => {
                                                                                const chip = (
                                                                                    <>
                                                                                        <span className="font-medium">{amenity.name}</span>
                                                                                        {amenity.isDefault ? <Badge variant="secondary" className="border border-amber-200 bg-amber-50 px-1.5 py-0 text-[10px] text-amber-700">Default</Badge> : null}
                                                                                        {amenity.isActive === false ? <Badge variant="secondary" className="border border-zinc-200 bg-zinc-100 px-1.5 py-0 text-[10px] text-zinc-600">Inactive</Badge> : null}
                                                                                    </>
                                                                                );

                                                                                return canManageAmenities ? (
                                                                                    <button
                                                                                        key={amenity.id}
                                                                                        type="button"
                                                                                        onClick={() => onOpenAmenityDialog(building.id, building.name, amenity)}
                                                                                        className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-700 transition hover:border-zinc-300 hover:bg-white"
                                                                                    >
                                                                                        {chip}
                                                                                    </button>
                                                                                ) : (
                                                                                    <div
                                                                                        key={amenity.id}
                                                                                        className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-700"
                                                                                    >
                                                                                        {chip}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ) : null}
                                            </Fragment>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            )}
        </TabsContent>
    );
}

type AmenitiesGapsTabProps = {
    commonAmenityThreshold: number;
    gapRows: AmenityGapRow[];
    inactiveCatalogEntries: AmenityCatalogEntry[];
    singleBuildingCatalogEntries: AmenityCatalogEntry[];
};

function AmenitiesGapsTab({
    commonAmenityThreshold,
    gapRows,
    inactiveCatalogEntries,
    singleBuildingCatalogEntries,
}: AmenitiesGapsTabProps) {
    return (
        <TabsContent value="gaps" className="mt-0">
            <div className="grid gap-5 xl:grid-cols-3">
                <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Missing common amenities</h3>
                            <p className="mt-1 text-sm text-zinc-500">
                                Buildings missing amenities found in at least {commonAmenityThreshold} buildings.
                            </p>
                        </div>
                        <SummaryBadge label="Buildings" value={gapRows.length} />
                    </div>
                    <div className="mt-5 space-y-3">
                        {gapRows.length > 0 ? gapRows.map((row) => (
                            <div key={row.building.id} className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
                                <div className="text-sm font-semibold text-zinc-950">{row.building.name}</div>
                                <div className="mt-1 text-sm text-zinc-500">{formatBuildingLocation(row.building) || "Location not set"}</div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {row.missingCommonAmenities.map((name) => (
                                        <Badge key={`${row.building.id}-${name}`} variant="secondary" className="border border-rose-200 bg-rose-50 text-rose-700">
                                            {name}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )) : (
                            <EmptyInsightCard
                                title="No common coverage gaps"
                                description="The current search does not show any buildings missing common amenities."
                            />
                        )}
                    </div>
                </div>

                <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Inactive amenities</h3>
                            <p className="mt-1 text-sm text-zinc-500">
                                Amenities that exist in the portfolio but are disabled in at least one building.
                            </p>
                        </div>
                        <SummaryBadge label="Amenities" value={inactiveCatalogEntries.length} />
                    </div>
                    <div className="mt-5 space-y-3">
                        {inactiveCatalogEntries.length > 0 ? inactiveCatalogEntries.map((entry) => (
                            <div key={entry.key} className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="text-sm font-semibold text-zinc-950">{entry.name}</div>
                                    <Badge variant="secondary" className="border border-zinc-200 bg-zinc-100 text-zinc-600">
                                        {entry.inactiveCount} inactive
                                    </Badge>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {entry.buildings.filter((item) => item.amenity.isActive === false).map((item) => (
                                        <Badge key={item.amenity.id} variant="secondary" className="border border-zinc-200 bg-white text-zinc-700">
                                            {item.buildingName}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )) : (
                            <EmptyInsightCard
                                title="No inactive amenities"
                                description="Everything visible in the current result set is marked active."
                            />
                        )}
                    </div>
                </div>

                <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Single-building amenities</h3>
                            <p className="mt-1 text-sm text-zinc-500">
                                Amenities that only appear once across the current portfolio scope.
                            </p>
                        </div>
                        <SummaryBadge label="Amenities" value={singleBuildingCatalogEntries.length} />
                    </div>
                    <div className="mt-5 space-y-3">
                        {singleBuildingCatalogEntries.length > 0 ? singleBuildingCatalogEntries.map((entry) => {
                            const singleBuilding = entry.buildings[0];

                            return (
                                <div key={entry.key} className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="text-sm font-semibold text-zinc-950">{entry.name}</div>
                                        {entry.defaultCount > 0 ? (
                                            <Badge variant="secondary" className="border border-amber-200 bg-amber-50 text-amber-700">
                                                Default
                                            </Badge>
                                        ) : null}
                                    </div>
                                    <div className="mt-2 text-sm text-zinc-500">
                                        Only configured in {singleBuilding?.buildingName ?? "one building"}.
                                    </div>
                                </div>
                            );
                        }) : (
                            <EmptyInsightCard
                                title="No single-building amenities"
                                description="Amenities in the current scope are shared across multiple buildings."
                            />
                        )}
                    </div>
                </div>
            </div>
        </TabsContent>
    );
}

function EmptyInsightCard({ title, description }: { title: string; description: string }) {
    return (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-10 text-center">
            <div className="text-sm font-semibold text-zinc-900">{title}</div>
            <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
        </div>
    );
}

function SummaryBadge({ label, value }: { label: string; value: number }) {
    return (
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600">
            <span className="text-zinc-400">{label}</span>
            <span className="text-zinc-900">{value}</span>
        </div>
    );
}

function StatPill({
    label,
    value,
    tone,
}: {
    label: string;
    value: number;
    tone: "zinc" | "emerald" | "amber";
}) {
    const toneClassName =
        tone === "emerald"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : tone === "amber"
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-zinc-200 bg-zinc-50 text-zinc-700";

    return (
        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${toneClassName}`}>
            <span className="opacity-75">{label}</span>
            <span>{value}</span>
        </div>
    );
}
