"use client";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { readSidebarCollapsedPreference, writeSidebarCollapsedPreference } from "./sidebarState";

export function AppLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
        readSidebarCollapsedPreference(typeof window === "undefined" ? null : window.localStorage)
    );

    useEffect(() => {
        writeSidebarCollapsedPreference(typeof window === "undefined" ? null : window.localStorage, sidebarCollapsed);
    }, [sidebarCollapsed]);

    return (
        <div className="flex h-screen bg-zinc-50 overflow-hidden">
            {/* Desktop Sidebar */}
            <div
                className={cn(
                    "hidden flex-shrink-0 transition-[width] duration-200 md:block",
                    sidebarCollapsed ? "w-[88px]" : "w-72"
                )}
            >
                <Sidebar
                    collapsed={sidebarCollapsed}
                    allowCollapse
                    onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
                />
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">

                <div className="md:hidden flex items-center p-4 bg-zinc-950 text-white">
                    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-zinc-200">
                                <Menu className="w-6 h-6" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-72 border-r-zinc-200 bg-transparent p-0 shadow-none">
                            <SheetTitle className="sr-only">Navigation</SheetTitle>
                            <Sidebar />
                        </SheetContent>
                    </Sheet>
                    <span className="ml-4 font-bold">TowerDesk</span>
                </div>

                <Topbar />

                <main className="flex-1 overflow-auto p-6 md:p-8">
                    <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
