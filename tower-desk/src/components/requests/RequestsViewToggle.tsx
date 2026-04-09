"use client";

import { LayoutGrid, List } from "lucide-react";

import { Button } from "@/components/ui/button";

type ViewMode = "table" | "grid";

interface RequestsViewToggleProps {
    value: ViewMode;
    onChange: (value: ViewMode) => void;
}

export function RequestsViewToggle({ value, onChange }: RequestsViewToggleProps) {
    const activeClass = "bg-zinc-950 text-white shadow-sm";
    const inactiveClass = "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900";

    return (
        <div className="inline-flex items-center rounded-[22px] border border-white/70 bg-white/85 p-1 shadow-sm backdrop-blur">
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`h-9 rounded-2xl px-3 ${value === "table" ? activeClass : inactiveClass}`}
                onClick={() => onChange("table")}
                aria-pressed={value === "table"}
            >
                <List className="h-4 w-4" />
                <span className="text-xs">List</span>
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`h-9 rounded-2xl px-3 ${value === "grid" ? activeClass : inactiveClass}`}
                onClick={() => onChange("grid")}
                aria-pressed={value === "grid"}
            >
                <LayoutGrid className="h-4 w-4" />
                <span className="text-xs">Grid</span>
            </Button>
        </div>
    );
}
