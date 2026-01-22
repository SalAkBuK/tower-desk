"use client";

import { User, Role } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Edit, Trash } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useState, type ReactNode } from "react";

interface UsersTableProps {
    users: User[] | undefined;
    isLoading: boolean;
    onDelete?: (user: User) => void;
    canDelete?: (user: User) => boolean;
    buildingNameById?: Record<string, string>;
    actions?: {
        label: string;
        icon?: ReactNode;
        onSelect: (user: User) => void;
        className?: string;
        disabled?: (user: User) => boolean;
    }[];
}

export function UsersTable({ users, isLoading, onDelete, canDelete, buildingNameById, actions }: UsersTableProps) {
    const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

    if (isLoading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                ))}
            </div>
        );
    }

    const roleColors: Record<Role, string> = {
        superadmin: "bg-indigo-100 text-indigo-700 border-indigo-200",
        admin: "bg-blue-100 text-blue-700 border-blue-200",
        org_admin: "bg-sky-100 text-sky-700 border-sky-200",
        manager: "bg-purple-100 text-purple-700 border-purple-200",
        service_provider: "bg-orange-100 text-orange-700 border-orange-200",
        employee: "bg-green-100 text-green-700 border-green-200",
        tenant: "bg-gray-100 text-gray-700 border-gray-200",
    };
    const roleLabels: Record<Role, string> = {
        superadmin: "Superadmin",
        admin: "Admin",
        org_admin: "Org Admin",
        manager: "Manager",
        service_provider: "Service Provider",
        employee: "Maintenance Staff",
        tenant: "Tenant",
    };

    return (
        <div className="rounded-md border border-zinc-200 bg-white">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Buildings</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users?.map((user) => (
                        <TableRow key={user.id}>
                            <TableCell className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={user.avatarUrl} />
                                    <AvatarFallback className="bg-zinc-100 text-zinc-500">
                                        {user.name.slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="font-medium">{user.name}</div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className={roleColors[user.role]}>
                                    {roleLabels[user.role]}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-zinc-500">{user.email}</TableCell>
                            <TableCell>
                                {user.buildingIds.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                        {user.buildingIds.map((bid) => (
                                            <Badge key={bid} variant="secondary" className="text-xs bg-zinc-100 text-zinc-600">
                                                {buildingNameById?.[bid] ?? bid.toUpperCase()}
                                            </Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-zinc-400 text-sm">Global</span>
                                )}
                            </TableCell>
                            <TableCell>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-900">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem>
                                            <Edit className="w-4 h-4 mr-2" />
                                            Edit
                                        </DropdownMenuItem>
                                        {actions?.map((action) => (
                                            <DropdownMenuItem
                                                key={action.label}
                                                className={action.className}
                                                onClick={() => action.onSelect(user)}
                                                disabled={action.disabled?.(user)}
                                            >
                                                {action.icon}
                                                {action.label}
                                            </DropdownMenuItem>
                                        ))}
                                        {onDelete && (!canDelete || canDelete(user)) && (
                                            <DropdownMenuItem
                                                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                                onClick={() => setDeleteTarget(user)}
                                            >
                                                <Trash className="w-4 h-4 mr-2" />
                                                Delete
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                    {(!users || users.length === 0) && (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-zinc-500">
                                No users found.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            {onDelete && (
                <ConfirmDialog
                    open={!!deleteTarget}
                    onOpenChange={(open) => !open && setDeleteTarget(null)}
                    title="Delete user?"
                    description={`This will remove ${deleteTarget?.name || "this user"} from their assigned building.`}
                    confirmText="Delete"
                    variant="destructive"
                    onConfirm={() => {
                        if (deleteTarget) {
                            onDelete(deleteTarget);
                        }
                    }}
                />
            )}
        </div>
    );
}
