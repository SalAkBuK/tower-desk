"use client";

import { useBuildings } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Building2, MapPin, Users, Activity, Layers, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateBuildingSheet } from "@/components/buildings/CreateBuildingSheet";
import { AssignAdminSheet } from "@/components/buildings/AssignAdminSheet";
import { useState } from "react";
import { formatBuildingLocation } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function BuildingsListPage() {
    const { data: buildings, isLoading } = useBuildings();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [assignBuilding, setAssignBuilding] = useState<{ id: string, name: string } | null>(null);

    return (
        <div className="space-y-8 max-w-7xl mx-auto p-6 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Buildings Directory</h1>
                    <p className="text-zinc-500 mt-2 text-base max-w-2xl">
                        Manage all property entities, track their status, and assign administrative access.
                    </p>
                </div>
                <Button
                    size="lg"
                    className="bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm"
                    onClick={() => setIsCreateOpen(true)}
                >
                    <Plus className="w-5 h-5 mr-2" />
                    New Building
                </Button>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Skeleton key={i} className="h-64 rounded-2xl" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {buildings?.map((building) => (
                        <div
                            key={building.id}
                            className="group relative flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-300 hover:shadow-lg"
                        >
                            <div className="flex items-start justify-between mb-6">
                                <div className="rounded-xl bg-zinc-100 p-3 group-hover:bg-zinc-900 group-hover:text-white transition-colors duration-300">
                                    <Building2 className="w-6 h-6" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge
                                        variant="secondary"
                                        className={building.status === 'active'
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                            : 'bg-zinc-100 text-zinc-600'}
                                    >
                                        {building.status}
                                    </Badge>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                                                <MoreHorizontal className="h-4 w-4 text-zinc-400" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => setAssignBuilding({ id: building.id, name: building.name })}>
                                                Assign Admin
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>

                            <div className="flex-1 mb-6">
                                <Link href={`/platform/buildings/${building.id}`} className="block group-hover:opacity-80 transition-opacity">
                                    <h3 className="text-xl font-bold text-zinc-900 mb-2 truncate">
                                        {building.name}
                                    </h3>
                                    <div className="flex items-center text-sm text-zinc-500">
                                        <MapPin className="w-4 h-4 mr-1.5 text-zinc-400" />
                                        <span className="truncate">{formatBuildingLocation(building) || "Location not set"}</span>
                                    </div>
                                </Link>
                            </div>

                            <div className="grid grid-cols-3 gap-2 border-t border-zinc-100 pt-4">
                                <div className="text-center">
                                    <div className="flex items-center justify-center gap-1.5 text-zinc-900 font-semibold">
                                        <Layers className="h-4 w-4 text-zinc-400" />
                                        {building.unitsCount || 0}
                                    </div>
                                    <p className="text-[10px] uppercase font-medium tracking-wider text-zinc-400 mt-1">Units</p>
                                </div>
                                <div className="text-center border-l border-zinc-100">
                                    <div className="flex items-center justify-center gap-1.5 text-zinc-900 font-semibold">
                                        <Users className="h-4 w-4 text-zinc-400" />
                                        {building.stats?.totalTenants || 0}
                                    </div>
                                    <p className="text-[10px] uppercase font-medium tracking-wider text-zinc-400 mt-1">Tenants</p>
                                </div>
                                <div className="text-center border-l border-zinc-100">
                                    <div className="flex items-center justify-center gap-1.5 text-zinc-900 font-semibold">
                                        <Activity className="h-4 w-4 text-orange-500" />
                                        {building.stats?.activeRequests || 0}
                                    </div>
                                    <p className="text-[10px] uppercase font-medium tracking-wider text-zinc-400 mt-1">Issues</p>
                                </div>
                            </div>
                        </div>
                    ))}
                    {(!buildings || buildings.length === 0) && (
                        <div className="col-span-full py-16 text-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50">
                            <Building2 className="w-10 h-10 text-zinc-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-zinc-900">No buildings found</h3>
                            <p className="text-zinc-500 mt-1 max-w-sm mx-auto">Get started by creating your first building entity in the system.</p>
                            <Button
                                variant="outline"
                                className="mt-6"
                                onClick={() => setIsCreateOpen(true)}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Create Building
                            </Button>
                        </div>
                    )}
                </div>
            )}

            <CreateBuildingSheet open={isCreateOpen} onOpenChange={setIsCreateOpen} />
            {assignBuilding && (
                <AssignAdminSheet
                    buildingId={assignBuilding.id}
                    buildingName={assignBuilding.name}
                    open={!!assignBuilding}
                    onOpenChange={(open) => !open && setAssignBuilding(null)}
                />
            )}
        </div>
    );
}
