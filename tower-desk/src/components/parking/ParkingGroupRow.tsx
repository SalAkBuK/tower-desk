"use client";

import { ChevronDown, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ParkingGroupMode, ParkingGroupSummary } from "./parkingGroups.types";

interface ParkingGroupRowProps {
    summary: ParkingGroupSummary;
    mode: ParkingGroupMode;
    expanded: boolean;
    onToggle: () => void;
}

export function ParkingGroupRow({ summary, mode, expanded, onToggle }: ParkingGroupRowProps) {
    const secondaryCountLabel = mode === "unit" ? "resident" : "unit";
    const secondaryCountValue = mode === "unit" ? summary.residentsCount : summary.unitsCount;
    const secondaryCount = typeof secondaryCountValue === "number" ? secondaryCountValue : null;

    return (
        <button
            type="button"
            onClick={onToggle}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onToggle();
                }
            }}
            aria-expanded={expanded}
            className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left transition hover:border-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-zinc-600">
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-900">{summary.label}</div>
                {summary.isVacant ? (
                    <Badge variant="secondary" className="mt-1 bg-zinc-100 text-zinc-600">
                        Vacant
                    </Badge>
                ) : null}
            </div>
            <div className="ml-auto flex items-center gap-4 text-xs text-zinc-500">
                <span className="rounded-full bg-blue-50 px-2 py-1 font-medium text-blue-700">
                    {summary.allocatedSlotsCount} slot{summary.allocatedSlotsCount === 1 ? "" : "s"}
                </span>
                {secondaryCount !== null ? (
                    <span className="rounded-full bg-zinc-100 px-2 py-1 font-medium text-zinc-600">
                        {secondaryCount} {secondaryCountLabel}{secondaryCount === 1 ? "" : "s"}
                    </span>
                ) : null}
            </div>
        </button>
    );
}
