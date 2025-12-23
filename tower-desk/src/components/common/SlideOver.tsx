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
}

export function SlideOver({
    open,
    onOpenChange,
    title,
    description,
    children,
    width = "w-[400px] sm:w-[540px]",
}: SlideOverProps) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className={width}>
                <SheetHeader>
                    <SheetTitle>{title}</SheetTitle>
                    {description && <SheetDescription>{description}</SheetDescription>}
                </SheetHeader>
                <div className="mt-6 h-full overflow-y-auto pb-20">
                    {children}
                </div>
            </SheetContent>
        </Sheet>
    );
}
