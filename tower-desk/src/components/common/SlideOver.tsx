"use client";

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";

interface SlideOverProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    children: React.ReactNode;
    width?: string; // Optional width class
    side?: "top" | "right" | "bottom" | "left" | "center";
}

export function SlideOver({
    open,
    onOpenChange,
    title,
    description,
    children,
    width = "w-[400px] sm:w-[540px]",
    side = "center",
}: SlideOverProps) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className={width} side={side}>
                <SheetHeader>
                    <SheetTitle>{title}</SheetTitle>
                    {description && <SheetDescription>{description}</SheetDescription>}
                </SheetHeader>
                <div className="mt-6 min-h-0 flex-1 overflow-y-auto pb-20">
                    {children}
                </div>
            </SheetContent>
        </Sheet>
    );
}
