"use client";

import { useBuildings } from "@/lib/queries";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Building2, MapPin, Users, Activity } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateBuildingSheet } from "@/components/buildings/CreateBuildingSheet";
import { AssignAdminSheet } from "@/components/buildings/AssignAdminSheet";
import { useState } from "react";

export default function BuildingsListPage() {
    const { data: buildings, isLoading } = useBuildings();

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [assignBuilding, setAssignBuilding] = useState<{ id: string, name: string } | null>(null);

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-64 rounded-xl" />
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {buildings?.map((building) => (
                    <Link key={building.id} href={`/sa/buildings/${building.id}`}>
                        <Card className="hover:shadow-lg transition-all duration-300 hover:border-zinc-300 group cursor-pointer h-full flex flex-col relative">
                            <CardHeader className="pb-4">
                                <div className="flex justify-between items-start">
                                    <div className="bg-zinc-100 p-2 rounded-lg group-hover:bg-primary/10 transition-colors">
                                        <Building2 className="w-6 h-6 text-zinc-600 group-hover:text-primary transition-colors" />
                                    </div>
                                    <Badge variant={building.status === 'active' ? 'default' : 'secondary'} className={building.status === 'active' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
                                        {building.status}
                                    </Badge>
                                </div>
                                <CardTitle className="mt-4 text-xl truncate">{building.name}</CardTitle>
                                <div className="flex items-center text-sm text-zinc-500 mt-2 min-w-0" title={building.address}>
                                    <MapPin className="w-4 h-4 mr-1 shrink-0" />
                                    <span className="truncate">
                                        {building.address}
                                    </span>
                                </div>
                                <div className="flex items-center text-sm text-zinc-500 mt-1 min-w-0">
                                    <span className="truncate">City: {building.city || 'N/A'}</span>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-100">
                                    <div>
                                        <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Tenants</p>
                                        <div className="flex items-center mt-1">
                                            <Users className="w-4 h-4 mr-2 text-zinc-400" />
                                            <span className="font-semibold text-zinc-700">{building.stats?.totalTenants || 0}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Requests</p>
                                        <div className="flex items-center mt-1">
                                            <Activity className="w-4 h-4 mr-2 text-orange-400" />
                                            <span className="font-semibold text-zinc-700">{building.stats?.activeRequests || 0} active</span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-2">
                                <Button
                                    variant="outline"
                                    className="w-full z-10 relative"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setAssignBuilding({ id: building.id, name: building.name });
                                    }}
                                >
                                    Assign Admin
                                </Button>
                            </CardFooter>
                        </Card>
                    </Link>
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
