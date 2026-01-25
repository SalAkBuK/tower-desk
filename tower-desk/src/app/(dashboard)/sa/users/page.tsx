"use client";

import { useUsers } from "@/lib/queries";
import { UsersTable } from "@/components/users/UsersTable";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import { useState } from "react";
import { CreateUserSheet } from "@/components/users/CreateUserSheet";

export default function SuperadminUsersPage() {
    const { data: users, isLoading } = useUsers();
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const getCount = (role: string) => users?.filter((u) => (u.baseRole ?? u.role) === role).length || 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Users</h1>
                    <p className="text-zinc-500 mt-1">Manage all system users.</p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Add User
                </Button>
            </div>

            <Tabs defaultValue="admin" className="w-full">
                <TabsList className="bg-zinc-100 p-1 rounded-lg w-full justify-start h-auto flex-wrap">
                    <TabsTrigger value="admin" className="gap-2">
                        Admins <Badge variant="secondary" className="bg-zinc-200 text-zinc-700 hover:bg-zinc-300">{getCount('admin')}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="manager" className="gap-2">
                        Managers <Badge variant="secondary" className="bg-zinc-200 text-zinc-700 hover:bg-zinc-300">{getCount('manager')}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="employee" className="gap-2">
                        Maintenance Staff <Badge variant="secondary" className="bg-zinc-200 text-zinc-700 hover:bg-zinc-300">{getCount('employee')}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="service_provider" className="gap-2">
                        Service Providers <Badge variant="secondary" className="bg-zinc-200 text-zinc-700 hover:bg-zinc-300">{getCount('service_provider')}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="tenant" className="gap-2">
                        Tenants <Badge variant="secondary" className="bg-zinc-200 text-zinc-700 hover:bg-zinc-300">{getCount('tenant')}</Badge>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="admin" className="mt-6">
                    <UsersTable users={users?.filter((u) => (u.baseRole ?? u.role) === 'admin')} isLoading={isLoading} />
                </TabsContent>
                <TabsContent value="manager" className="mt-6">
                    <UsersTable users={users?.filter((u) => (u.baseRole ?? u.role) === 'manager')} isLoading={isLoading} />
                </TabsContent>
                <TabsContent value="employee" className="mt-6">
                    <UsersTable users={users?.filter((u) => (u.baseRole ?? u.role) === 'employee')} isLoading={isLoading} />
                </TabsContent>
                <TabsContent value="service_provider" className="mt-6">
                    <UsersTable users={users?.filter((u) => (u.baseRole ?? u.role) === 'service_provider')} isLoading={isLoading} />
                </TabsContent>
                <TabsContent value="tenant" className="mt-6">
                    <UsersTable users={users?.filter((u) => (u.baseRole ?? u.role) === 'tenant')} isLoading={isLoading} />
                </TabsContent>
            </Tabs>

            <CreateUserSheet open={isCreateOpen} onOpenChange={setIsCreateOpen} defaultRole="admin" />
        </div>
    );
}
