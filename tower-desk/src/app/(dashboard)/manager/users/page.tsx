"use client";

import { useAdminUsers, useDeleteUser, useManagerBuildings } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { UsersTable } from "@/components/users/UsersTable";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useEffect, useMemo, useState } from "react";
import { CreateUserSheet } from "@/components/users/CreateUserSheet";
import { toast } from "sonner";

export default function ManagerUsersPage() {
    const { user, login, token } = useAuth();
    const managerId = user?.id;
    const { data: buildings, isLoading: isBuildingsLoading } = useManagerBuildings(managerId);
    const buildingIds = buildings?.map((building) => building.id) || [];
    const buildingOptions = buildings?.map((building) => ({ id: building.id, name: building.name })) || [];
    const buildingNameById = useMemo(() => {
        return (buildings || []).reduce<Record<string, string>>((acc, building) => {
            acc[building.id] = building.name;
            return acc;
        }, {});
    }, [buildings]);
    const { data: users, isLoading: isUsersLoading } = useAdminUsers(buildingIds);
    const deleteUser = useDeleteUser();
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const filteredUsers = users?.filter((u) => (u.baseRole ?? u.role) !== 'superadmin');
    const getCount = (role: string) => filteredUsers?.filter((u) => (u.baseRole ?? u.role) === role).length || 0;
    const isLoading = isBuildingsLoading || isUsersLoading;
    const canDelete = (role: string) => role === 'manager' || role === 'tenant' || role === 'employee';

    useEffect(() => {
        if (!user || buildingIds.length === 0) return;
        const currentIds = user.buildingIds || [];
        const sameLength = buildingIds.length === currentIds.length;
        const hasAll = buildingIds.every((id) => currentIds.includes(id));
        if (sameLength && hasAll) return;
        login({ ...user, buildingIds: buildingIds }, token);
    }, [buildingIds, user, login, token]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Building Staff & Tenants</h1>
                    <p className="text-zinc-500 mt-1">Manage users in your building.</p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Add User
                </Button>
            </div>

            <Tabs defaultValue="manager" className="w-full">
                <TabsList className="bg-zinc-100 p-1 rounded-lg w-full justify-start h-auto flex-wrap">
                    <TabsTrigger value="manager" className="gap-2">
                        Managers <Badge variant="secondary" className="bg-zinc-200 text-zinc-700 hover:bg-zinc-300">{getCount('manager')}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="employee" className="gap-2">
                        Maintenance Staff <Badge variant="secondary" className="bg-zinc-200 text-zinc-700 hover:bg-zinc-300">{getCount('employee')}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="tenant" className="gap-2">
                        Tenants <Badge variant="secondary" className="bg-zinc-200 text-zinc-700 hover:bg-zinc-300">{getCount('tenant')}</Badge>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="manager" className="mt-6">
                    <UsersTable
                        users={filteredUsers?.filter((u) => (u.baseRole ?? u.role) === 'manager')}
                        isLoading={isLoading}
                        buildingNameById={buildingNameById}
                        onDelete={(target) =>
                            deleteUser.mutate(
                                { role: target.baseRole ?? target.role, id: target.id, buildingIds: target.buildingIds },
                                {
                                    onSuccess: () => toast.success("User deleted"),
                                    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to delete user"),
                                }
                            )
                        }
                        canDelete={(u) => canDelete(u.baseRole ?? u.role)}
                    />
                </TabsContent>
                <TabsContent value="employee" className="mt-6">
                    <UsersTable
                        users={filteredUsers?.filter((u) => (u.baseRole ?? u.role) === 'employee')}
                        isLoading={isLoading}
                        buildingNameById={buildingNameById}
                        onDelete={(target) =>
                            deleteUser.mutate(
                                { role: target.baseRole ?? target.role, id: target.id, buildingIds: target.buildingIds },
                                {
                                    onSuccess: () => toast.success("User deleted"),
                                    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to delete user"),
                                }
                            )
                        }
                        canDelete={(u) => canDelete(u.baseRole ?? u.role)}
                    />
                </TabsContent>
                <TabsContent value="tenant" className="mt-6">
                    <UsersTable
                        users={filteredUsers?.filter((u) => (u.baseRole ?? u.role) === 'tenant')}
                        isLoading={isLoading}
                        buildingNameById={buildingNameById}
                        onDelete={(target) =>
                            deleteUser.mutate(
                                { role: target.baseRole ?? target.role, id: target.id, buildingIds: target.buildingIds },
                                {
                                    onSuccess: () => toast.success("User deleted"),
                                    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to delete user"),
                                }
                            )
                        }
                        canDelete={(u) => canDelete(u.baseRole ?? u.role)}
                    />
                </TabsContent>
            </Tabs>

            <CreateUserSheet
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                defaultRole="manager"
                hideAdminRole
                buildingOptions={buildingOptions}
                requireBuildingAssignment={true}
            />
        </div>
    );
}
