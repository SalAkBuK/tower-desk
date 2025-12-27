"use client";

import { useBuildings } from "@/lib/queries";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Building2, MapPin, Users, Activity, Layers } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateBuildingSheet } from "@/components/buildings/CreateBuildingSheet";
import { AssignAdminSheet } from "@/components/buildings/AssignAdminSheet";
import { useState } from "react";
import { formatBuildingLocation } from "@/lib/utils";

export default function BuildingsListPage() {
    const { data: buildings, isLoading } = useBuildings();

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [assignBuilding, setAssignBuilding] = useState<{ id: string, name: string } | null>(null);

    if (isLoading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Buildings</h1>
                    <p className="text-zinc-500 mt-1">Manage your properties and their status.</p>
                </div>
                <Button className="bg-zinc-900 text-white hover:bg-zinc-800" onClick={() => setIsCreateOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Building
                </Button>
            </div>

            <div className="space-y-3">
                {buildings?.map((building) => (
                    <div key={building.id} className="bg-white border border-zinc-200 rounded-lg p-5 hover:shadow-md hover:border-zinc-300 transition-all duration-200 group">
                        <div className="flex items-start justify-between gap-4">
                            {/* Left Section - Building Info */}
                            <Link href={`/sa/buildings/${building.id}`} className="flex items-start gap-4 flex-1 min-w-0 cursor-pointer">
                                <div className="bg-zinc-100 p-3 rounded-lg group-hover:bg-primary/10 transition-colors shrink-0">
                                    <Building2 className="w-5 h-5 text-zinc-600 group-hover:text-primary transition-colors" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-semibold text-zinc-900 group-hover:text-primary transition-colors">
                                            {building.name}
                                        </h3>
                                        <Badge
                                            variant={building.status === 'active' ? 'default' : 'secondary'}
                                            className={building.status === 'active' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                                        >
                                            {building.status}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center text-sm text-zinc-500">
                                        <MapPin className="w-4 h-4 mr-1.5 shrink-0" />
                                        <span className="truncate">{formatBuildingLocation(building) || "Location not set"}</span>
                                    </div>
                                </div>
                            </Link>

                            {/* Right Section - Stats and Actions */}
                            <div className="flex items-center gap-6 shrink-0">
                                <div className="text-center">
                                    <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-1">Units</p>
                                    <div className="flex items-center justify-center gap-1.5">
                                        <Layers className="w-4 h-4 text-zinc-400" />
                                        <span className="font-semibold text-zinc-700">{building.unitsCount || 0}</span>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-1">Tenants</p>
                                    <div className="flex items-center justify-center gap-1.5">
                                        <Users className="w-4 h-4 text-zinc-400" />
                                        <span className="font-semibold text-zinc-700">{building.stats?.totalTenants || 0}</span>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-1">Active Requests</p>
                                    <div className="flex items-center justify-center gap-1.5">
                                        <Activity className="w-4 h-4 text-orange-400" />
                                        <span className="font-semibold text-zinc-700">{building.stats?.activeRequests || 0}</span>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setAssignBuilding({ id: building.id, name: building.name });
                                    }}
                                >
                                    Assign Admin
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

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
