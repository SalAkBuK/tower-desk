"use client";

import { useAdminUsers, useBuilding, useBuildingAmenities, useBuildingUnits, useRequests, useCreateBuildingAmenity, useUpdateBuildingAmenity } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Building2, MapPin, Users, ArrowLeft, UserPlus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CreateUnitSheet } from "@/components/buildings/CreateUnitSheet";
import { CreateResidentSheet } from "@/components/buildings/CreateResidentSheet";
import { UnitDetailSheet } from "@/components/buildings/UnitDetailSheet";
import { formatBuildingLocation } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

interface BuildingDetailsProps {
    buildingId: string;
    backHref: string;
    showAddTenant?: boolean;
}

export function BuildingDetails({ buildingId, backHref, showAddTenant = true }: BuildingDetailsProps) {
    const { role } = useAuth();
    const { data: building, isLoading: buildingLoading } = useBuilding(buildingId);
    const { data: requests } = useRequests(buildingId);
    const { data: users } = useAdminUsers([buildingId]);
    const { data: units, isLoading: unitsLoading } = useBuildingUnits(buildingId);
    const { data: availableUnits } = useBuildingUnits(buildingId, { available: true });
    const { data: amenities, isLoading: amenitiesLoading } = useBuildingAmenities(buildingId);
    const createAmenity = useCreateBuildingAmenity();
    const updateAmenity = useUpdateBuildingAmenity();
    const [isAddTenantOpen, setIsAddTenantOpen] = useState(false);
    const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
    const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
    const [isAmenityDialogOpen, setIsAmenityDialogOpen] = useState(false);
    const [amenityName, setAmenityName] = useState("");
    const [amenityDefault, setAmenityDefault] = useState(false);
    const [amenityActive, setAmenityActive] = useState(true);
    const [amenityError, setAmenityError] = useState<string | null>(null);
    const [editingAmenityId, setEditingAmenityId] = useState<string | null>(null);
    const requestsHref = backHref.replace('/buildings', '/requests');
    const availableUnitIds = useMemo(() => new Set((availableUnits || []).map((unit) => unit.id)), [availableUnits]);
    const canManageAmenities = role === 'admin' || role === 'org_admin' || role === 'superadmin';

    const assignedManagers = users?.filter(u => u.role === 'manager' && u.buildingIds.includes(buildingId)) || [];
    const assignedMaintenanceStaff = users?.filter(u => u.role === 'employee' && u.buildingIds.includes(buildingId)) || [];
    const assignedTenants = users?.filter(u => u.role === 'tenant' && u.buildingIds.includes(buildingId)) || [];

    const openAmenityDialog = (amenity?: { id: string; name: string; isDefault?: boolean; isActive?: boolean }) => {
        setAmenityError(null);
        if (amenity) {
            setEditingAmenityId(amenity.id);
            setAmenityName(amenity.name);
            setAmenityDefault(Boolean(amenity.isDefault));
            setAmenityActive(amenity.isActive ?? true);
        } else {
            setEditingAmenityId(null);
            setAmenityName("");
            setAmenityDefault(false);
            setAmenityActive(true);
        }
        setIsAmenityDialogOpen(true);
    };

    const handleAmenitySave = async () => {
        const trimmed = amenityName.trim();
        if (!trimmed) {
            setAmenityError("Amenity name is required.");
            return;
        }
        setAmenityError(null);
        try {
            if (editingAmenityId) {
                await updateAmenity.mutateAsync({
                    buildingId,
                    amenityId: editingAmenityId,
                    data: { name: trimmed, isDefault: amenityDefault, isActive: amenityActive }
                });
            } else {
                await createAmenity.mutateAsync({
                    buildingId,
                    data: { name: trimmed, isDefault: amenityDefault, isActive: amenityActive }
                });
            }
            setIsAmenityDialogOpen(false);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to save amenity.";
            setAmenityError(message);
        }
    };

    const renderNameList = (names: string[], emptyLabel: string) => {
        if (names.length === 0) {
            return <p className="text-xs text-zinc-400 mt-2">{emptyLabel}</p>;
        }
        return (
            <div className="flex flex-wrap gap-2 mt-3">
                {names.map((name, index) => (
                    <Badge key={`${name}-${index}`} variant="secondary" className="bg-zinc-100 text-zinc-700">
                        {name}
                    </Badge>
                ))}
            </div>
        );
    };

    if (buildingLoading) {
        return <div className="space-y-4"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-64 w-full" /></div>;
    }

    if (!building) {
        return <div>Building not found</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <Link href={backHref}>
                        <Button variant="ghost" size="icon" className="hover:bg-zinc-100 rounded-full">
                            <ArrowLeft className="w-5 h-5 text-zinc-500" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 flex items-center gap-3">
                            {building.name}
                            <Badge variant="outline" className={building.status === 'active' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : ''}>
                                {building.status}
                            </Badge>
                    </h1>
                    <div className="flex items-center text-zinc-500 mt-1">
                        <MapPin className="w-4 h-4 mr-1" />
                        {formatBuildingLocation(building) || "Location not set"}
                    </div>
                </div>
                </div>
                {showAddTenant ? (
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" onClick={() => setIsAddUnitOpen(true)} className="gap-2">
                            Add Unit
                        </Button>
                        <Button onClick={() => setIsAddTenantOpen(true)} className="gap-2">
                            <UserPlus className="h-4 w-4" />
                            Add Resident
                        </Button>
                    </div>
                ) : null}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Occupancy</CardTitle>
                        <Users className="w-4 h-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-zinc-900">{assignedTenants.length}</div>
                        <p className="text-xs text-zinc-500 mt-1">Total tenants assigned</p>
                        {renderNameList(assignedTenants.map((u) => u.name), "No tenants assigned")}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Staff</CardTitle>
                        <Users className="w-4 h-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-zinc-900">{assignedMaintenanceStaff.length}</div>
                        <p className="text-xs text-zinc-500 mt-1">Maintenance staff assigned</p>
                        {renderNameList(assignedMaintenanceStaff.map((u) => u.name), "No maintenance staff assigned")}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Managers</CardTitle>
                        <Building2 className="w-4 h-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-zinc-900">{assignedManagers.length}</div>
                        <p className="text-xs text-zinc-500 mt-1">Managers assigned</p>
                        {renderNameList(assignedManagers.map((u) => u.name), "No managers assigned")}
                    </CardContent>
                </Card>
            </div>

            {/* Latest Requests Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="h-full">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Building Requests</CardTitle>
                        <Link href={`${requestsHref}?buildingId=${buildingId}`}>
                            <Button variant="link" className="text-xs">View All</Button>
                        </Link>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {requests?.slice(0, 5).map(req => (
                                <div key={req.id} className="flex items-center justify-between border-b border-zinc-50 last:border-0 pb-3 last:pb-0">
                                    <div>
                                        <p className="font-medium text-zinc-900">{req.title}</p>
                                        <p className="text-xs text-zinc-500 truncate max-w-[200px]">{req.description}</p>
                                    </div>
                                    <Badge variant={req.priority === 'urgent' ? 'destructive' : 'secondary'}>
                                        {req.status}
                                    </Badge>
                                </div>
                            ))}
                            {(!requests || requests.length === 0) && (
                                <p className="text-zinc-500 text-sm">No requests found.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
                <Card className="h-full">
                    <CardHeader>
                        <CardTitle>Units</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {unitsLoading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-6 w-full" />
                            </div>
                        ) : !units || units.length === 0 ? (
                            <p className="text-zinc-500 text-sm">No units created yet.</p>
                        ) : (
                            <div className="space-y-3">
                                <div className="text-xs text-zinc-500">
                                    {(availableUnits?.length ?? units.filter((unit) => unit.isAvailable).length)} available · {units.length} total
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {units.slice(0, 10).map((unit) => {
                                        const isVacant = unit.isAvailable ?? availableUnitIds.has(unit.id);
                                        return (
                                            <Badge
                                                key={unit.id}
                                                variant="secondary"
                                                onClick={() => setSelectedUnitId(unit.id)}
                                                role="button"
                                                className={`${isVacant ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"} cursor-pointer`}
                                            >
                                                {unit.label} • {isVacant ? "Vacant" : "Occupied"}
                                            </Badge>
                                        );
                                    })}
                                    {units.length > 10 ? (
                                        <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">
                                            +{units.length - 10}
                                        </Badge>
                                    ) : null}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Amenities</CardTitle>
                    {canManageAmenities ? (
                        <Button size="sm" onClick={() => openAmenityDialog()}>
                            Add Amenity
                        </Button>
                    ) : null}
                </CardHeader>
                <CardContent className="space-y-3">
                    {amenitiesLoading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-5 w-40" />
                            <Skeleton className="h-5 w-64" />
                        </div>
                    ) : !amenities || amenities.length === 0 ? (
                        <div className="text-sm text-zinc-500">No amenities configured.</div>
                    ) : (
                        <div className="space-y-2">
                            {amenities.map((amenity) => (
                                <div key={amenity.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-zinc-900">{amenity.name}</span>
                                        {amenity.isDefault ? (
                                            <Badge variant="secondary" className="bg-zinc-100 text-zinc-700 text-xs">
                                                Default
                                            </Badge>
                                        ) : null}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(amenity.isDefault)}
                                                disabled={!canManageAmenities || updateAmenity.isPending}
                                                onChange={(event) =>
                                                    updateAmenity.mutate({
                                                        buildingId,
                                                        amenityId: amenity.id,
                                                        data: { isDefault: event.target.checked }
                                                    })
                                                }
                                            />
                                            Default
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={amenity.isActive ?? true}
                                                disabled={!canManageAmenities || updateAmenity.isPending}
                                                onChange={(event) =>
                                                    updateAmenity.mutate({
                                                        buildingId,
                                                        amenityId: amenity.id,
                                                        data: { isActive: event.target.checked }
                                                    })
                                                }
                                            />
                                            Active
                                        </label>
                                        {canManageAmenities ? (
                                            <Button variant="ghost" size="sm" onClick={() => openAmenityDialog(amenity)}>
                                                Edit
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {showAddTenant ? (
                <>
                    <CreateUnitSheet
                        open={isAddUnitOpen}
                        onOpenChange={setIsAddUnitOpen}
                        buildingId={buildingId}
                    />
                    <CreateResidentSheet
                        open={isAddTenantOpen}
                        onOpenChange={setIsAddTenantOpen}
                        buildingId={buildingId}
                    />
                </>
            ) : null}
            <UnitDetailSheet
                open={Boolean(selectedUnitId)}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen) setSelectedUnitId(null);
                }}
                buildingId={buildingId}
                unitId={selectedUnitId}
            />
            <Dialog open={isAmenityDialogOpen} onOpenChange={setIsAmenityDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingAmenityId ? "Edit Amenity" : "Add Amenity"}</DialogTitle>
                        <DialogDescription>Configure amenities for this building.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-900">Amenity Name</label>
                            <Input
                                value={amenityName}
                                onChange={(event) => setAmenityName(event.target.value)}
                                placeholder="Balcony"
                            />
                        </div>
                        <label className="flex items-center gap-2 text-sm text-zinc-700">
                            <input
                                type="checkbox"
                                checked={amenityDefault}
                                onChange={(event) => setAmenityDefault(event.target.checked)}
                            />
                            Default for new units
                        </label>
                        <label className="flex items-center gap-2 text-sm text-zinc-700">
                            <input
                                type="checkbox"
                                checked={amenityActive}
                                onChange={(event) => setAmenityActive(event.target.checked)}
                            />
                            Active
                        </label>
                        {amenityError ? (
                            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                                {amenityError}
                            </div>
                        ) : null}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAmenityDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleAmenitySave} disabled={createAmenity.isPending || updateAmenity.isPending}>
                            {createAmenity.isPending || updateAmenity.isPending ? "Saving..." : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
