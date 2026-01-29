"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { List, type RowComponentProps } from "react-window";
import { ChevronDown, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { ParkingSlot } from "@/lib/types";

interface VirtualizedParkingSlotSelectProps {
    slots: ParkingSlot[];
    selectedIds: string[];
    onSelectedIdsChange: Dispatch<SetStateAction<string[]>>;
    isEditMode?: boolean;
    currentUnitAllocationSlotIds?: Set<string>;
    slotVehicleLabels?: Map<string, string>;
    isLoading?: boolean;
    error?: Error | null;
    disabled?: boolean;
}

const ITEM_HEIGHT = 64;
const MAX_VISIBLE_ITEMS = 6;

interface RowProps {
    filteredSlots: ParkingSlot[];
    selectedIds: string[];
    slotVehicleLabels: Map<string, string>;
    isEditMode: boolean;
    currentUnitAllocationSlotIds: Set<string>;
    toggleSlot: (slotId: string) => void;
}

function SlotRow({
    index,
    style,
    filteredSlots,
    selectedIds,
    slotVehicleLabels,
    isEditMode,
    currentUnitAllocationSlotIds,
    toggleSlot,
}: RowComponentProps<RowProps>) {
    const slot = filteredSlots[index];
    const checked = selectedIds.includes(slot.id);
    const vehicleLabel = slotVehicleLabels.get(slot.id);
    const isAllocated = isEditMode && currentUnitAllocationSlotIds.has(slot.id);

    return (
        <div style={style} className="px-2">
            <label
                className={cn(
                    "flex items-start gap-3 rounded-md border px-3 py-2 cursor-pointer h-[56px]",
                    checked ? "border-blue-200 bg-blue-50/40" : "border-zinc-200 bg-white hover:bg-zinc-50"
                )}
                onClick={(e) => {
                    e.preventDefault();
                    toggleSlot(slot.id);
                }}
            >
                <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleSlot(slot.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <div className="text-xs font-semibold text-zinc-800 truncate">
                            {slot.code}
                        </div>
                        {isAllocated && (
                            <span className="rounded-full bg-zinc-900/5 px-2 py-0.5 text-[10px] font-medium text-zinc-700">
                                Allocated
                            </span>
                        )}
                    </div>
                    <div className="text-[11px] text-zinc-500 truncate">
                        {slot.type}
                        {slot.level ? ` - ${slot.level}` : ""}
                        {slot.isCovered ? " (Covered)" : ""}
                    </div>
                    {isAllocated && vehicleLabel && (
                        <div className="text-[11px] text-zinc-600 truncate">
                            {vehicleLabel}
                        </div>
                    )}
                </div>
            </label>
        </div>
    );
}

export function VirtualizedParkingSlotSelect({
    slots,
    selectedIds,
    onSelectedIdsChange,
    isEditMode = false,
    currentUnitAllocationSlotIds = new Set(),
    slotVehicleLabels = new Map(),
    isLoading = false,
    error = null,
    disabled = false,
}: VirtualizedParkingSlotSelectProps) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Filter slots based on search query
    const filteredSlots = useMemo(() => {
        if (!searchQuery.trim()) return slots;
        const query = searchQuery.toLowerCase();
        return slots.filter((slot) => {
            const searchableText = [
                slot.code,
                slot.type,
                slot.level,
                slot.isCovered ? "covered" : "",
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            return searchableText.includes(query);
        });
    }, [slots, searchQuery]);

    // Toggle slot selection
    const toggleSlot = (slotId: string) => {
        onSelectedIdsChange((prev) => {
            if (prev.includes(slotId)) {
                return prev.filter((id) => id !== slotId);
            }
            return [...prev, slotId];
        });
    };

    // Select all filtered slots
    const selectAll = () => {
        onSelectedIdsChange((prev) => {
            const filteredIds = new Set(filteredSlots.map((s) => s.id));
            const newIds = new Set(prev);
            filteredIds.forEach((id) => newIds.add(id));
            return Array.from(newIds);
        });
    };

    // Deselect all filtered slots
    const deselectAll = () => {
        onSelectedIdsChange((prev) => {
            const filteredIds = new Set(filteredSlots.map((s) => s.id));
            return prev.filter((id) => !filteredIds.has(id));
        });
    };

    // Calculate list height
    const listHeight = useMemo(() => {
        const itemCount = filteredSlots.length;
        return Math.min(itemCount, MAX_VISIBLE_ITEMS) * ITEM_HEIGHT;
    }, [filteredSlots.length]);

    // Row props for react-window v2
    const rowProps: RowProps = useMemo(() => ({
        filteredSlots,
        selectedIds,
        slotVehicleLabels,
        isEditMode,
        currentUnitAllocationSlotIds,
        toggleSlot,
    }), [filteredSlots, selectedIds, slotVehicleLabels, isEditMode, currentUnitAllocationSlotIds]);

    // Trigger button text
    const triggerText = useMemo(() => {
        if (selectedIds.length === 0) return "Select parking slots";
        if (selectedIds.length === 1) {
            const slot = slots.find((s) => s.id === selectedIds[0]);
            return slot ? slot.code : "1 slot selected";
        }
        return `${selectedIds.length} slots selected`;
    }, [selectedIds, slots]);

    // Check if all filtered are selected
    const allFilteredSelected = useMemo(() => {
        if (filteredSlots.length === 0) return false;
        return filteredSlots.every((slot) => selectedIds.includes(slot.id));
    }, [filteredSlots, selectedIds]);

    if (error) {
        return (
            <div className="text-sm text-rose-600">
                {error instanceof Error ? error.message : "Failed to load vacant slots."}
            </div>
        );
    }

    if (isLoading) {
        return <div className="text-sm text-zinc-500">Loading vacant slots...</div>;
    }

    if (slots.length === 0) {
        return <div className="text-sm text-zinc-500">No vacant slots available.</div>;
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
                            placeholder="Search slots..."
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

                    {/* Select/Deselect all */}
                    {filteredSlots.length > 0 && (
                        <div className="flex items-center justify-between border-b px-3 py-2 text-xs">
                            <span className="text-zinc-500">
                                {filteredSlots.length} slot{filteredSlots.length !== 1 ? "s" : ""}
                                {searchQuery ? " found" : " available"}
                            </span>
                            <button
                                type="button"
                                onClick={allFilteredSelected ? deselectAll : selectAll}
                                className="text-blue-600 hover:text-blue-700 font-medium"
                            >
                                {allFilteredSelected ? "Deselect all" : "Select all"}
                            </button>
                        </div>
                    )}

                    {/* Virtualized list */}
                    {filteredSlots.length > 0 ? (
                        <List
                            rowComponent={SlotRow}
                            rowCount={filteredSlots.length}
                            rowHeight={ITEM_HEIGHT}
                            rowProps={rowProps}
                            className="py-2"
                            style={{ height: listHeight }}
                        />
                    ) : (
                        <div className="px-3 py-6 text-center text-sm text-zinc-500">
                            No slots match your search.
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
