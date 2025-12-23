"use client";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

export function AppLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen bg-zinc-50 overflow-hidden">
            {/* Desktop Sidebar */}
            <div className="hidden md:block w-64 flex-shrink-0">
                <Sidebar />
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">

                <div className="md:hidden flex items-center p-4 bg-zinc-950 text-white">
                    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-zinc-200">
                                <Menu className="w-6 h-6" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="p-0 border-r-zinc-800 bg-zinc-950 w-64 text-zinc-100">
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
