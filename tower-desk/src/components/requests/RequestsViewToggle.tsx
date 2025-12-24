"use client";

import { LayoutGrid, List } from "lucide-react";

import { Button } from "@/components/ui/button";

type ViewMode = "table" | "grid";

interface RequestsViewToggleProps {
    value: ViewMode;
    onChange: (value: ViewMode) => void;
}

export function RequestsViewToggle({ value, onChange }: RequestsViewToggleProps) {
    const activeClass = "bg-zinc-100 text-zinc-900";
    const inactiveClass = "text-zinc-500 hover:text-zinc-900";

    return (
        <div className="inline-flex items-center rounded-md border border-zinc-200 bg-white p-1">
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`h-8 px-2 ${value === "table" ? activeClass : inactiveClass}`}
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
                className={`h-8 px-2 ${value === "grid" ? activeClass : inactiveClass}`}
                onClick={() => onChange("grid")}
                aria-pressed={value === "grid"}
            >
                <LayoutGrid className="h-4 w-4" />
                <span className="text-xs">Grid</span>
            </Button>
        </div>
    );
}
