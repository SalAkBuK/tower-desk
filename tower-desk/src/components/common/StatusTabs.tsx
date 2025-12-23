"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface StatusTabsProps<T extends string> {
    value: T | 'all';
    onValueChange: (value: T | 'all') => void;
    options: { label: string; value: T }[];
    showAll?: boolean;
}

export function StatusTabs<T extends string>({
    value,
    onValueChange,
    options,
    showAll = true
}: StatusTabsProps<T>) {
    return (
        <Tabs value={value} onValueChange={(val) => onValueChange(val as T | 'all')} className="w-full">
            <TabsList className="bg-zinc-100 p-1 rounded-lg">
                {showAll && <TabsTrigger value="all">All</TabsTrigger>}
                {options.map((option) => (
                    <TabsTrigger key={option.value} value={option.value}>
                        {option.label}
                    </TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
    );
}
