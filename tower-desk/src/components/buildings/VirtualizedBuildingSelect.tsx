"use client";

import { useCallback, useMemo, useState } from "react";
import { List, type RowComponentProps } from "react-window";
import { Building2, ChevronDown, MapPin, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Building } from "@/lib/types";

interface VirtualizedBuildingSelectProps {
    buildings: Building[];
    selectedId: string;
    onSelect: (buildingId: string) => void;
    isLoading?: boolean;
    error?: Error | null;
    disabled?: boolean;
    placeholder?: string;
    emptyMessage?: string;
    triggerClassName?: string;
    searchPlaceholder?: string;
}

const ITEM_HEIGHT = 64;
const MAX_VISIBLE_ITEMS = 6;

interface RowProps {
    buildings: Building[];
    selectedId: string;
    selectBuilding: (buildingId: string) => void;
}

function getBuildingLocation(building: Building) {
    return [building.address, building.city, building.emirate, building.country]
        .filter(Boolean)
        .join(" · ");
}

function getStatusLabel(status: Building["status"]) {
    if (status === "maintenance") return "Maintenance";
    if (status === "inactive") return "Inactive";
    return "Active";
}

function getStatusClasses(status: Building["status"]) {
    if (status === "maintenance") return "bg-amber-100 text-amber-700";
    if (status === "inactive") return "bg-zinc-100 text-zinc-600";
    return "bg-emerald-100 text-emerald-700";
}

function BuildingRow({
    index,
    style,
    buildings,
    selectedId,
    selectBuilding,
}: RowComponentProps<RowProps>) {
    const building = buildings[index];
    const isSelected = building.id === selectedId;
    const location = getBuildingLocation(building);

    return (
        <div style={style} className="px-2">
            <button
                type="button"
                className={cn(
                    "flex h-[56px] w-full items-start gap-3 rounded-md border px-3 py-2 text-left",
                    isSelected
                        ? "border-blue-200 bg-blue-50/40"
                        : "border-zinc-200 bg-white hover:bg-zinc-50"
                )}
                onClick={() => selectBuilding(building.id)}
            >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                    <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <div className="truncate text-xs font-semibold text-zinc-800">
                            {building.name}
                        </div>
                        <span
                            className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                                getStatusClasses(building.status)
                            )}
                        >
                            {getStatusLabel(building.status)}
                        </span>
                    </div>
                    <div className="truncate text-[11px] text-zinc-500">
                        {location || "No location details"}
                    </div>
                </div>
            </button>
        </div>
    );
}

export function VirtualizedBuildingSelect({
    buildings,
    selectedId,
    onSelect,
    isLoading = false,
    error = null,
    disabled = false,
    placeholder = "Select building",
    emptyMessage = "No buildings available.",
    triggerClassName,
    searchPlaceholder = "Search building, city, status...",
}: VirtualizedBuildingSelectProps) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const filteredBuildings = useMemo(() => {
        if (!searchQuery.trim()) return buildings;
        const query = searchQuery.toLowerCase();
        return buildings.filter((building) => {
            const searchableText = [
                building.name,
                building.address,
                building.city,
                building.emirate,
                building.country,
                building.status,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            return searchableText.includes(query);
        });
    }, [buildings, searchQuery]);

    const selectBuilding = useCallback((buildingId: string) => {
        onSelect(buildingId);
        setOpen(false);
        setSearchQuery("");
    }, [onSelect]);

    const listHeight = useMemo(() => {
        const itemCount = filteredBuildings.length;
        return Math.min(itemCount, MAX_VISIBLE_ITEMS) * ITEM_HEIGHT;
    }, [filteredBuildings.length]);

    const rowProps: RowProps = useMemo(
        () => ({ buildings: filteredBuildings, selectedId, selectBuilding }),
        [filteredBuildings, selectedId, selectBuilding]
    );

    const triggerText = useMemo(() => {
        if (!selectedId) return placeholder;
        const building = buildings.find((item) => item.id === selectedId);
        return building?.name ?? placeholder;
    }, [buildings, placeholder, selectedId]);

    if (error) {
        return (
            <div className="text-sm text-rose-600">
                {error instanceof Error ? error.message : "Failed to load buildings."}
            </div>
        );
    }

    if (isLoading) {
        return <div className="text-sm text-zinc-500">Loading buildings...</div>;
    }

    if (buildings.length === 0) {
        return <div className="text-sm text-zinc-500">{emptyMessage}</div>;
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn("h-11 w-full justify-between font-normal", triggerClassName)}
                >
                    <span className="truncate">{triggerText}</span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0"
                align="start"
                onOpenAutoFocus={(event) => event.preventDefault()}
            >
                <div className="flex flex-col">
                    <div className="flex items-center border-b px-3 py-2">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <input
                            type="text"
                            placeholder={searchPlaceholder}
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-zinc-400"
                        />
                        {searchQuery ? (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="ml-2 rounded-sm opacity-50 hover:opacity-100"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        ) : null}
                    </div>

                    {filteredBuildings.length > 0 ? (
                        <div className="flex items-center border-b px-3 py-2 text-xs">
                            <MapPin className="mr-2 h-3.5 w-3.5 text-zinc-400" />
                            <span className="text-zinc-500">
                                {filteredBuildings.length} building{filteredBuildings.length === 1 ? "" : "s"}
                                {searchQuery ? " found" : " available"}
                            </span>
                        </div>
                    ) : null}

                    {filteredBuildings.length > 0 ? (
                        <List
                            rowComponent={BuildingRow}
                            rowCount={filteredBuildings.length}
                            rowHeight={ITEM_HEIGHT}
                            rowProps={rowProps}
                            className="py-2"
                            style={{ height: listHeight }}
                        />
                    ) : (
                        <div className="px-3 py-6 text-center text-sm text-zinc-500">
                            No buildings match your search.
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
