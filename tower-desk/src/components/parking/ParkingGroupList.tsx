"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { List } from "react-window";

import { ParkingGroupDetails } from "./ParkingGroupDetails";
import { ParkingGroupRow } from "./ParkingGroupRow";
import type { ParkingGroupDetailsData, ParkingGroupMode, ParkingGroupSummary } from "./parkingGroups.types";
import type { ParkingSlot } from "@/lib/types";

const ROW_HEIGHT = 64;
const DETAILS_HEIGHT = 280;

interface ParkingGroupListProps {
    groups: ParkingGroupSummary[];
    mode: ParkingGroupMode;
    expandedIds: Set<string>;
    onToggle: (groupId: string) => void;
    getDetailsState: (groupId: string) => {
        data?: ParkingGroupDetailsData;
        isLoading: boolean;
        error?: Error | null;
        onRetry: () => void;
    };
    onAllocate: () => void;
    onEditSlot: (slot: ParkingSlot) => void;
    onManageAllocations: (occupancyId: string, label?: string) => void;
    onToggleActive: (slot: ParkingSlot) => void;
    slotById: Map<string, ParkingSlot>;
    isUpdating?: boolean;
}

export function ParkingGroupList({
    groups,
    mode,
    expandedIds,
    onToggle,
    getDetailsState,
    onAllocate,
    onEditSlot,
    onManageAllocations,
    onToggleActive,
    slotById,
    isUpdating,
}: ParkingGroupListProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [height, setHeight] = useState(560);

    useEffect(() => {
        if (!containerRef.current) return;
        const update = () => {
            const nextHeight = containerRef.current?.clientHeight ?? 560;
            setHeight(nextHeight);
        };
        update();
        const observer = new ResizeObserver(update);
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const getItemSize = (index: number) => {
        const group = groups[index];
        if (!group) return ROW_HEIGHT;
        return expandedIds.has(group.id) ? ROW_HEIGHT + DETAILS_HEIGHT : ROW_HEIGHT;
    };

    const listKey = useMemo(() => {
        return `${groups.length}-${Array.from(expandedIds).sort().join("|")}`;
    }, [expandedIds, groups.length]);

    const Row = useMemo(() => {
        function RowRenderer({
            index,
            style,
            ariaAttributes,
        }: {
            index: number;
            style: CSSProperties;
            ariaAttributes: { "aria-posinset": number; "aria-setsize": number; role: "listitem" };
        }) {
            const group = groups[index];
            if (!group) return null;
            const isExpanded = expandedIds.has(group.id);
            const detailsState = getDetailsState(group.id);

            return (
                <div style={style} className="px-1 py-2" {...ariaAttributes}>
                    <ParkingGroupRow
                        summary={group}
                        mode={mode}
                        expanded={isExpanded}
                        onToggle={() => onToggle(group.id)}
                    />
                    {isExpanded ? (
                        <div className="mt-3 max-h-[240px] overflow-y-auto">
                            <ParkingGroupDetails
                                mode={mode}
                                details={detailsState.data}
                                isLoading={detailsState.isLoading}
                                error={detailsState.error}
                                onRetry={detailsState.onRetry}
                                onAllocate={onAllocate}
                                onEditSlot={onEditSlot}
                                onManageAllocations={onManageAllocations}
                                onToggleActive={onToggleActive}
                                slotById={slotById}
                                isUpdating={isUpdating}
                            />
                        </div>
                    ) : null}
                </div>
            );
        }
        RowRenderer.displayName = "ParkingGroupRowRenderer";
        return RowRenderer;
    }, [
        expandedIds,
        getDetailsState,
        groups,
        mode,
        onAllocate,
        onEditSlot,
        onManageAllocations,
        onToggle,
        onToggleActive,
        slotById,
        isUpdating,
    ]);

    return (
        <div ref={containerRef} className="h-[60vh] min-h-[360px]">
            <List
                key={listKey}
                defaultHeight={height}
                rowCount={groups.length}
                rowHeight={getItemSize}
                rowComponent={Row}
                rowProps={{}}
                style={{ height, width: "100%" }}
            />
        </div>
    );
}
