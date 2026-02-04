"use client";

import { useMemo, useState } from "react";
import { List, type RowComponentProps } from "react-window";
import { ChevronDown, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BuildingUnit } from "@/lib/types";

interface VirtualizedUnitSelectProps {
    units: BuildingUnit[];
    selectedId: string;
    onSelect: (unitId: string) => void;
    isLoading?: boolean;
    error?: Error | null;
    disabled?: boolean;
    placeholder?: string;
}

const ITEM_HEIGHT = 56;
const MAX_VISIBLE_ITEMS = 6;

interface RowProps {
    filteredUnits: BuildingUnit[];
    selectedId: string;
    selectUnit: (unitId: string) => void;
}

function UnitRow({
    index,
    style,
    filteredUnits,
    selectedId,
    selectUnit,
}: RowComponentProps<RowProps>) {
    const unit = filteredUnits[index];
    const isSelected = unit.id === selectedId;

    const details: string[] = [];
    if (unit.floor != null) details.push(`Floor ${unit.floor}`);
    if (unit.bedrooms != null) details.push(`${unit.bedrooms} BR`);
    if (unit.bathrooms != null) details.push(`${unit.bathrooms} BA`);
    if (unit.furnishedStatus) {
        const map: Record<string, string> = {
            UNFURNISHED: "Unfurnished",
            SEMI_FURNISHED: "Semi-Furn.",
            FULLY_FURNISHED: "Furnished",
        };
        details.push(map[unit.furnishedStatus] ?? unit.furnishedStatus);
    }

    return (
        <div style={style} className="px-2">
            <button
                type="button"
                className={cn(
                    "flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left h-[48px]",
                    isSelected
                        ? "border-blue-200 bg-blue-50/40"
                        : "border-zinc-200 bg-white hover:bg-zinc-50 cursor-pointer"
                )}
                onClick={() => selectUnit(unit.id)}
            >
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <div className="text-xs font-semibold text-zinc-800 truncate">
                            {unit.label}
                        </div>
                        {unit.status && (
                            <span
                                className={cn(
                                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                                    unit.status === "AVAILABLE"
                                        ? "bg-green-100 text-green-700"
                                        : unit.status === "OCCUPIED"
                                            ? "bg-amber-100 text-amber-700"
                                            : "bg-zinc-100 text-zinc-600"
                                )}
                            >
                                {unit.status === "UNDER_MAINTENANCE" ? "Maintenance" : unit.status?.charAt(0) + unit.status?.slice(1).toLowerCase()}
                            </span>
                        )}
                    </div>
                    <div className="text-[11px] text-zinc-500 truncate">
                        {details.length > 0 ? details.join(" \u00b7 ") : "No details"}
                        {unit.rentAnnual ? ` \u00b7 AED ${unit.rentAnnual.toLocaleString()}/yr` : ""}
                    </div>
                </div>
            </button>
        </div>
    );
}

export function VirtualizedUnitSelect({
    units,
    selectedId,
    onSelect,
    isLoading = false,
    error = null,
    disabled = false,
    placeholder = "Select unit",
}: VirtualizedUnitSelectProps) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const filteredUnits = useMemo(() => {
        if (!searchQuery.trim()) return units;
        const query = searchQuery.toLowerCase();
        return units.filter((unit) => {
            const searchableText = [
                unit.label,
                unit.floor != null ? `floor ${unit.floor}` : "",
                unit.bedrooms != null ? `${unit.bedrooms} br` : "",
                unit.status,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            return searchableText.includes(query);
        });
    }, [units, searchQuery]);

    const selectUnit = (unitId: string) => {
        onSelect(unitId);
        setOpen(false);
        setSearchQuery("");
    };

    const listHeight = useMemo(() => {
        const itemCount = filteredUnits.length;
        return Math.min(itemCount, MAX_VISIBLE_ITEMS) * ITEM_HEIGHT;
    }, [filteredUnits.length]);

    const rowProps: RowProps = useMemo(
        () => ({ filteredUnits, selectedId, selectUnit }),
        [filteredUnits, selectedId]
    );

    const triggerText = useMemo(() => {
        if (!selectedId) return placeholder;
        const unit = units.find((u) => u.id === selectedId);
        return unit ? unit.label : placeholder;
    }, [selectedId, units, placeholder]);

    if (error) {
        return (
            <div className="text-sm text-rose-600">
                {error instanceof Error ? error.message : "Failed to load units."}
            </div>
        );
    }

    if (isLoading) {
        return <div className="text-sm text-zinc-500">Loading units...</div>;
    }

    if (units.length === 0) {
        return <div className="text-sm text-zinc-500">No available units.</div>;
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className="w-full justify-between h-11 font-normal"
                >
                    <span className="truncate">{triggerText}</span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <div className="flex flex-col">
                    {/* Search input */}
                    <div className="flex items-center border-b px-3 py-2">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <input
                            type="text"
                            placeholder="Search by unit, floor..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-zinc-400"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="ml-2 rounded-sm opacity-50 hover:opacity-100"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Count */}
                    {filteredUnits.length > 0 && (
                        <div className="flex items-center border-b px-3 py-2 text-xs">
                            <span className="text-zinc-500">
                                {filteredUnits.length} unit{filteredUnits.length !== 1 ? "s" : ""}
                                {searchQuery ? " found" : " available"}
                            </span>
                        </div>
                    )}

                    {/* Virtualized list */}
                    {filteredUnits.length > 0 ? (
                        <List
                            rowComponent={UnitRow}
                            rowCount={filteredUnits.length}
                            rowHeight={ITEM_HEIGHT}
                            rowProps={rowProps}
                            className="py-2"
                            style={{ height: listHeight }}
                        />
                    ) : (
                        <div className="px-3 py-6 text-center text-sm text-zinc-500">
                            No units match your search.
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
