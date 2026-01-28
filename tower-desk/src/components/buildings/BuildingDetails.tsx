"use client";

import { useAdminUsers, useBuilding, useBuildingAmenities, useBuildingUnits, useRequests, useCreateBuildingAmenity, useUpdateBuildingAmenity, useEffectivePermissions, useRoles, useUserPermissionOverrides } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, MapPin, Users, ArrowLeft, UserPlus, Home, LayoutDashboard, Settings, Wrench, Shield, Search, Filter } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CreateUnitSheet } from "@/components/buildings/CreateUnitSheet";
import { CreateResidentSheet } from "@/components/buildings/CreateResidentSheet";
import { UnitDetailSheet } from "@/components/buildings/UnitDetailSheet";
import { formatBuildingLocation } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DEBUG_AUTH } from "@/lib/debugAuth";

interface BuildingDetailsProps {
    buildingId: string;
    backHref: string;
    showAddTenant?: boolean;
}

export function BuildingDetails({ buildingId, backHref, showAddTenant = true }: BuildingDetailsProps) {
    const { role, baseRole, user, buildingScope, selectedOrgId, selectedBuildingId } = useAuth();
    const { data: building, isLoading: buildingLoading } = useBuilding(buildingId);
    const { data: requests } = useRequests(buildingId);
    const { data: users } = useAdminUsers([buildingId]);
    const { data: units, isLoading: unitsLoading } = useBuildingUnits(buildingId);
    const { data: availableUnits } = useBuildingUnits(buildingId, { available: true });
    const { data: amenities, isLoading: amenitiesLoading } = useBuildingAmenities(buildingId);
    const userId = user?.id ?? "";
    const canViewPermissionDebug = baseRole === 'admin' || baseRole === 'org_admin' || baseRole === 'superadmin';
    const { data: roleDefinitions } = useRoles({ enabled: DEBUG_AUTH && canViewPermissionDebug && Boolean(userId) });
    const { data: permissionOverrides } = useUserPermissionOverrides(userId, { enabled: DEBUG_AUTH && canViewPermissionDebug && Boolean(userId) });
    const { data: effectivePermissions } = useEffectivePermissions(userId ? [userId] : [], { enabled: DEBUG_AUTH && canViewPermissionDebug && Boolean(userId) });
    const createAmenity = useCreateBuildingAmenity();
    const updateAmenity = useUpdateBuildingAmenity();

    // UI State
    const [isAddTenantOpen, setIsAddTenantOpen] = useState(false);
    const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
    const [isEditUnitOpen, setIsEditUnitOpen] = useState(false);
    const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
    const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
    const [unitFilter, setUnitFilter] = useState<"all" | "vacant" | "occupied">("all");

    // Amenity Dialog State
    const [isAmenityDialogOpen, setIsAmenityDialogOpen] = useState(false);
    const [amenityName, setAmenityName] = useState("");
    const [amenityDefault, setAmenityDefault] = useState(false);
    const [amenityActive, setAmenityActive] = useState(true);
    const [amenityError, setAmenityError] = useState<string | null>(null);
    const [editingAmenityId, setEditingAmenityId] = useState<string | null>(null);

    const requestsHref = backHref.replace('/buildings', '/requests');
    const availableUnitIds = useMemo(() => new Set((availableUnits || []).map((unit) => unit.id)), [availableUnits]);
    const sessionPermissionKeys = (user?.effectivePermissions ?? []).map((key) => String(key).toLowerCase());
    const hasAmenityWritePermission = sessionPermissionKeys.includes('buildings.write')
        || sessionPermissionKeys.includes('amenities.write')
        || sessionPermissionKeys.includes('building.amenities.write')
        || sessionPermissionKeys.some((key) => key.includes('amenit') && key.includes('write'));
    const canManageAmenities = baseRole === 'admin' || baseRole === 'org_admin' || baseRole === 'superadmin' || hasAmenityWritePermission;
    const normalizedRole = role ? role.toLowerCase() : "";
    const matchedRole = roleDefinitions?.find((entry) => {
        const key = String(entry.key ?? entry.name ?? '').toLowerCase();
        return key === normalizedRole;
    });
    const rolePermissionKeys = matchedRole?.permissionKeys ?? [];
    const effectivePermissionKeys = effectivePermissions?.find((entry) => entry.userId === userId)?.permissions ?? [];

    useEffect(() => {
        if (process.env.NODE_ENV === 'production') return;
        if (baseRole !== 'manager') return;
        console.log('[Manager Portal] Building details context', {
            buildingId,
            userId: user?.id ?? null,
            orgId: selectedOrgId ?? user?.orgId ?? null,
            role,
            buildingScope: buildingScope ?? [],
            selectedBuildingId: selectedBuildingId ?? null
        });
    }, [buildingId, role, user?.id, user?.orgId, selectedOrgId, buildingScope, selectedBuildingId]);

    useEffect(() => {
        if (!DEBUG_AUTH) return;
        if (!userId) return;
        console.log('[Auth Debug] Permissions snapshot', {
            userId,
            role,
            rolePermissions: rolePermissionKeys,
            overrides: permissionOverrides ?? [],
            effectivePermissions: effectivePermissionKeys
        });
    }, [userId, role, rolePermissionKeys, permissionOverrides, effectivePermissionKeys]);

    // Derived Data
    const assignedManagers = users?.filter((u) => (u.baseRole ?? u.role) === 'manager' && u.buildingIds.includes(buildingId)) || [];
    const assignedMaintenanceStaff = users?.filter((u) => (u.baseRole ?? u.role) === 'employee' && u.buildingIds.includes(buildingId)) || [];
    const assignedTenants = users?.filter((u) => (u.baseRole ?? u.role) === 'tenant' && u.buildingIds.includes(buildingId)) || [];

    const stats = [
        {
            label: "Occupancy",
            value: units && units.length > 0 ? `${Math.round(((units.length - (availableUnits?.length || 0)) / units.length) * 100)}%` : "0%",
            subtext: `${assignedTenants.length} Active Tenants`,
            icon: Users,
            color: "text-blue-600",
            bg: "bg-blue-50",
        },
        {
            label: "Maintenance",
            value: requests?.filter(r => r.status !== 'completed' && r.status !== 'cancelled').length || 0,
            subtext: "Active Requests",
            icon: Wrench,
            color: "text-orange-600",
            bg: "bg-orange-50",
        },
        {
            label: "Staffing",
            value: assignedManagers.length + assignedMaintenanceStaff.length,
            subtext: "Total Staff",
            icon: Shield,
            color: "text-purple-600",
            bg: "bg-purple-50",
        },
    ];

    const filteredUnits = useMemo(() => {
        if (!units) return [];
        if (unitFilter === "all") return units;
        return units.filter(u => {
            const isVacant = u.isAvailable ?? availableUnitIds.has(u.id);
            return unitFilter === "vacant" ? isVacant : !isVacant;
        });
    }, [units, unitFilter, availableUnitIds]);

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

    if (buildingLoading) {
        return <div className="space-y-6 max-w-7xl mx-auto p-6"><Skeleton className="h-24 w-full rounded-2xl" /><Skeleton className="h-96 w-full rounded-2xl" /></div>;
    }

    if (!building) {
        return <div className="p-6">Building not found</div>;
    }

    return (
        <div className="min-h-screen bg-zinc-50/50">
            {/* Header Section */}
            <div className="bg-white border-b border-zinc-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                            <Link href={backHref}>
                                <Button variant="ghost" size="icon" className="rounded-full hover:bg-zinc-100 -ml-2">
                                    <ArrowLeft className="h-5 w-5 text-zinc-500" />
                                </Button>
                            </Link>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
                                        {building.name}
                                    </h1>
                                    <Badge
                                        variant="outline"
                                        className={building.status === 'active' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : ''}
                                    >
                                        {building.status}
                                    </Badge>
                                </div>
                                <div className="mt-1 flex items-center text-sm text-zinc-500">
                                    <MapPin className="mr-1.5 h-3.5 w-3.5" />
                                    {formatBuildingLocation(building) || "Location not set"}
                                </div>
                            </div>
                        </div>
                        {showAddTenant ? (
                            <div className="flex items-center gap-2">
                                <Button variant="outline" onClick={() => setIsAddUnitOpen(true)} className="gap-2 h-9 text-sm">
                                    <Home className="h-3.5 w-3.5" />
                                    Add Unit
                                </Button>
                                <Button onClick={() => setIsAddTenantOpen(true)} className="gap-2 h-9 text-sm">
                                    <UserPlus className="h-3.5 w-3.5" />
                                    Add Tenant
                                </Button>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* Stats Overview */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {stats.map((stat, i) => (
                        <Card key={i} className="border-zinc-200/60 shadow-sm transition-all hover:shadow-md">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-zinc-500">{stat.label}</CardTitle>
                                <div className={`p-2 rounded-lg ${stat.bg}`}>
                                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-zinc-900">{stat.value}</div>
                                <p className="text-xs text-zinc-500 mt-1">{stat.subtext}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Main Content Tabs */}
                <Tabs defaultValue="overview" className="space-y-6">
                    <TabsList className="bg-zinc-100/50 p-1 border border-zinc-200/50 h-11">
                        <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:shadow-sm h-9">
                            <LayoutDashboard className="h-4 w-4 mr-2" />
                            Overview
                        </TabsTrigger>
                        <TabsTrigger value="units" className="data-[state=active]:bg-white data-[state=active]:shadow-sm h-9">
                            <Home className="h-4 w-4 mr-2" />
                            Units
                        </TabsTrigger>
                        <TabsTrigger value="people" className="data-[state=active]:bg-white data-[state=active]:shadow-sm h-9">
                            <Users className="h-4 w-4 mr-2" />
                            People
                        </TabsTrigger>
                        <TabsTrigger value="settings" className="data-[state=active]:bg-white data-[state=active]:shadow-sm h-9">
                            <Settings className="h-4 w-4 mr-2" />
                            Configuration
                        </TabsTrigger>
                    </TabsList>

                    {/* Overview Tab */}
                    <TabsContent value="overview" className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card className="border-zinc-200">
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="text-base">Recent Requests</CardTitle>
                                        <CardDescription>Latest maintenance and support tickets</CardDescription>
                                    </div>
                                    <Link href={`${requestsHref}?buildingId=${buildingId}`}>
                                        <Button variant="ghost" size="sm" className="text-xs">View All</Button>
                                    </Link>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-1">
                                        {requests?.slice(0, 5).map((req) => (
                                            <div key={req.id} className="flex items-center justify-between p-3 hover:bg-zinc-50 rounded-lg transition-colors group">
                                                <div className="min-w-0 flex-1 pr-4">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-medium text-sm text-zinc-900">{req.title}</span>
                                                        <Badge variant={req.priority === 'urgent' ? 'destructive' : 'secondary'} className="h-5 px-1.5 text-[10px]">
                                                            {req.priority}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-zinc-500 truncate">{req.description}</p>
                                                </div>
                                                <Badge variant="outline" className="text-zinc-600 bg-white">
                                                    {req.status}
                                                </Badge>
                                            </div>
                                        ))}
                                        {(!requests || requests.length === 0) && (
                                            <div className="text-center py-8 text-sm text-zinc-500">No active requests</div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-zinc-200">
                                <CardHeader>
                                    <div className="space-y-1">
                                        <CardTitle className="text-base">Quick Access</CardTitle>
                                        <CardDescription>Frequently used actions</CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent className="grid grid-cols-2 gap-4">
                                    <Button variant="outline" className="h-24 flex-col gap-3 hover:border-zinc-300 hover:bg-zinc-50" onClick={() => setIsAddUnitOpen(true)}>
                                        <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center">
                                            <Home className="h-4 w-4 text-blue-600" />
                                        </div>
                                        <span className="text-sm font-medium">Add Unit</span>
                                    </Button>
                                    <Button variant="outline" className="h-24 flex-col gap-3 hover:border-zinc-300 hover:bg-zinc-50" onClick={() => setIsAddTenantOpen(true)}>
                                        <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center">
                                            <UserPlus className="h-4 w-4 text-emerald-600" />
                                        </div>
                                        <span className="text-sm font-medium">Add Tenant</span>
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* Units Tab */}
                    <TabsContent value="units" className="space-y-6">
                        <Card className="border-zinc-200">
                            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <CardTitle>Units Directory</CardTitle>
                                    <CardDescription>Manage residential and commercial units</CardDescription>
                                </div>
                                <div className="flex items-center gap-2 bg-zinc-100/50 p-1 rounded-lg border border-zinc-200/50">
                                    <Button
                                        variant={unitFilter === "all" ? "white" : "ghost"}
                                        size="sm"
                                        onClick={() => setUnitFilter("all")}
                                        className={unitFilter === "all" ? "bg-white shadow-sm" : ""}
                                    >
                                        All
                                    </Button>
                                    <Button
                                        variant={unitFilter === "vacant" ? "white" : "ghost"}
                                        size="sm"
                                        onClick={() => setUnitFilter("vacant")}
                                        className={unitFilter === "vacant" ? "bg-white shadow-sm" : ""}
                                    >
                                        Vacant
                                    </Button>
                                    <Button
                                        variant={unitFilter === "occupied" ? "white" : "ghost"}
                                        size="sm"
                                        onClick={() => setUnitFilter("occupied")}
                                        className={unitFilter === "occupied" ? "bg-white shadow-sm" : ""}
                                    >
                                        Occupied
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {unitsLoading ? (
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
                                    </div>
                                ) : !filteredUnits || filteredUnits.length === 0 ? (
                                    <div className="text-center py-12">
                                        <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-3">
                                            <Search className="h-5 w-5 text-zinc-400" />
                                        </div>
                                        <h3 className="text-sm font-medium text-zinc-900">No units found</h3>
                                        <p className="text-xs text-zinc-500 mt-1">Try adjusting the filter or add a new unit</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                                        {filteredUnits.map((unit) => {
                                            const isVacant = unit.isAvailable ?? availableUnitIds.has(unit.id);
                                            return (
                                                <div
                                                    key={unit.id}
                                                    onClick={() => setSelectedUnitId(unit.id)}
                                                    className={`
                                                        group cursor-pointer rounded-xl border p-4 transition-all hover:shadow-md
                                                        ${isVacant
                                                            ? "border-emerald-100 bg-emerald-50/30 hover:border-emerald-200"
                                                            : "border-zinc-200 bg-white hover:border-blue-200"
                                                        }
                                                    `}
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="font-semibold text-lg text-zinc-900">{unit.label}</span>
                                                        <div className={`h-2 w-2 rounded-full ${isVacant ? "bg-emerald-500" : "bg-blue-500"}`} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] uppercase font-medium tracking-wider text-zinc-500">
                                                            {isVacant ? "Vacant" : "Occupied"}
                                                        </p>
                                                        {itemDetail(unit)}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* People Tab */}
                    <TabsContent value="people" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <StaffCard title="Managers" icon={Building2} users={assignedManagers} emptyLabel="No managers assigned" />
                            <StaffCard title="Maintenance Staff" icon={Wrench} users={assignedMaintenanceStaff} emptyLabel="No staff assigned" />
                            <StaffCard title="Tenants" icon={Users} users={assignedTenants} emptyLabel="No tenants assigned" />
                        </div>
                    </TabsContent>

                    {/* Settings Tab */}
                    <TabsContent value="settings" className="space-y-6">
                        <Card className="border-zinc-200">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div className="space-y-1">
                                    <CardTitle>Building Amenities</CardTitle>
                                    <CardDescription>Features and facilities available in this building</CardDescription>
                                </div>
                                {canManageAmenities && (
                                    <Button size="sm" onClick={() => openAmenityDialog()}>Add Amenity</Button>
                                )}
                            </CardHeader>
                            <CardContent>
                                {amenitiesLoading ? <Skeleton className="h-12 w-full" /> : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {amenities?.map((amenity) => (
                                            <div key={amenity.id} className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 bg-white shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${amenity.isActive ? 'bg-zinc-100 text-zinc-700' : 'bg-red-50 text-red-600'}`}>
                                                        <StarIcon className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-zinc-900">{amenity.name}</p>
                                                        {amenity.isDefault && <p className="text-[10px] text-zinc-500">Default Amenity</p>}
                                                    </div>
                                                </div>
                                                {canManageAmenities && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openAmenityDialog(amenity)}>
                                                        <Settings className="h-3.5 w-3.5 text-zinc-400" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {DEBUG_AUTH && user ? (
                            <Card className="border-amber-200 bg-amber-50/40">
                                <CardHeader>
                                    <CardTitle className="text-base">Debug: Permissions</CardTitle>
                                    <CardDescription>Role permissions, overrides, and effective permissions for the current user.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4 text-sm">
                                        <div>
                                            <div className="text-xs uppercase tracking-wide text-zinc-400">User</div>
                                            <div className="text-sm font-medium text-zinc-900">{user.name ?? user.email ?? user.id}</div>
                                            <div className="text-xs text-zinc-500">Role: {role ?? "unknown"}</div>
                                        </div>

                                        <div>
                                            <div className="text-xs uppercase tracking-wide text-zinc-400">Role Permissions</div>
                                            {rolePermissionKeys && rolePermissionKeys.length > 0 ? (
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {rolePermissionKeys.map((key) => (
                                                        <Badge key={key} variant="secondary" className="bg-white text-zinc-700">
                                                            {key}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="mt-2 text-xs text-zinc-500">No role permissions found.</div>
                                            )}
                                        </div>

                                        <div>
                                            <div className="text-xs uppercase tracking-wide text-zinc-400">Overrides</div>
                                            {permissionOverrides && permissionOverrides.length > 0 ? (
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {permissionOverrides.map((override) => (
                                                        <Badge
                                                            key={`${override.permissionKey}-${override.effect}`}
                                                            variant="secondary"
                                                            className={override.effect === "DENY" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}
                                                        >
                                                            {override.permissionKey}:{override.effect}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="mt-2 text-xs text-zinc-500">No overrides for this user.</div>
                                            )}
                                        </div>

                                        <div>
                                            <div className="text-xs uppercase tracking-wide text-zinc-400">Effective Permissions</div>
                                            {effectivePermissionKeys && effectivePermissionKeys.length > 0 ? (
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {effectivePermissionKeys.map((key) => (
                                                        <Badge key={key} variant="secondary" className="bg-zinc-100 text-zinc-700">
                                                            {key}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="mt-2 text-xs text-zinc-500">No effective permissions returned.</div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : null}
                    </TabsContent>
                </Tabs>
            </div>

            {/* Modals */}
            {showAddTenant ? (
                <>
                    <CreateUnitSheet open={isAddUnitOpen} onOpenChange={setIsAddUnitOpen} buildingId={buildingId} />
                    <CreateResidentSheet open={isAddTenantOpen} onOpenChange={setIsAddTenantOpen} buildingId={buildingId} />
                </>
            ) : null}

            <CreateUnitSheet
                open={isEditUnitOpen}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen) {
                        setIsEditUnitOpen(false);
                        setEditingUnitId(null);
                    }
                }}
                buildingId={buildingId}
                mode="edit"
                unitId={editingUnitId}
            />

            <UnitDetailSheet
                open={Boolean(selectedUnitId)}
                onOpenChange={(nextOpen) => !nextOpen && setSelectedUnitId(null)}
                buildingId={buildingId}
                unitId={selectedUnitId}
                onEdit={() => {
                    if (!selectedUnitId) return;
                    setEditingUnitId(selectedUnitId);
                    setSelectedUnitId(null);
                    setIsEditUnitOpen(true);
                }}
            />

            <Dialog open={isAmenityDialogOpen} onOpenChange={setIsAmenityDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingAmenityId ? "Edit Amenity" : "Add Amenity"}</DialogTitle>
                        <DialogDescription>Configure amenities for this building.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Name</label>
                            <Input value={amenityName} onChange={(e) => setAmenityName(e.target.value)} placeholder="e.g. Swimming Pool" />
                        </div>
                        <div className="flex flex-col gap-3 bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="checkbox" checked={amenityDefault} onChange={(e) => setAmenityDefault(e.target.checked)} className="rounded border-zinc-300" />
                                <span>Default for new units</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="checkbox" checked={amenityActive} onChange={(e) => setAmenityActive(e.target.checked)} className="rounded border-zinc-300" />
                                <span>Active enabled</span>
                            </label>
                        </div>
                        {amenityError && <p className="text-sm text-red-600">{amenityError}</p>}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsAmenityDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleAmenitySave} disabled={createAmenity.isPending || updateAmenity.isPending}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Helper Components
function StaffCard({ title, icon: Icon, users, emptyLabel }: { title: string, icon: any, users: any[], emptyLabel: string }) {
    return (
        <Card className="border-zinc-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">{title}</CardTitle>
                <Icon className="h-4 w-4 text-zinc-400" />
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-2">
                    {users.length === 0 ? (
                        <p className="text-sm text-zinc-500 py-2">{emptyLabel}</p>
                    ) : (
                        users.slice(0, 5).map(u => (
                            <div key={u.id} className="flex items-center gap-3 py-1">
                                <Avatar className="h-8 w-8 border border-zinc-100">
                                    <AvatarFallback className="bg-zinc-100 text-xs text-zinc-700">
                                        {u.name.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-zinc-900 truncate">{u.name}</p>
                                    <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                                </div>
                            </div>
                        ))
                    )}
                    {users.length > 5 && (
                        <Button variant="link" size="sm" className="w-full text-zinc-500">
                            View All {users.length} Users
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

function StarIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    )
}

function itemDetail(unit: any) {
    if (unit.floor) {
        return <p className="text-xs text-zinc-500">Floor {unit.floor}</p>
    }
    return null;
}
