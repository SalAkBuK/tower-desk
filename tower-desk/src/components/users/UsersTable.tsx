"use client";

import { User } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Edit, Trash } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useState, type ReactNode } from "react";
import { getUserAccessView } from "@/lib/userAccess";

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

    return (
        <div className="rounded-md border border-zinc-200 bg-white">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Org Access</TableHead>
                        <TableHead>Building / Resident Access</TableHead>
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
                            <TableCell className="text-zinc-500">{user.email}</TableCell>
                            <TableCell>
                                {user.isActive === false ? (
                                    <Badge variant="secondary" className="bg-rose-50 text-rose-700">Inactive</Badge>
                                ) : user.mustChangePassword ? (
                                    <Badge variant="secondary" className="bg-amber-50 text-amber-700">Pending setup</Badge>
                                ) : (
                                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">Active</Badge>
                                )}
                            </TableCell>
                            <TableCell>
                                {(() => {
                                    const access = getUserAccessView(user);
                                    const primaryOrgAssignment = access.orgAccess[0];
                                    const primaryOrgLabel =
                                        access.primaryOrgAccess?.roleName ??
                                        primaryOrgAssignment?.roleTemplateName ??
                                        primaryOrgAssignment?.roleTemplateKey;
                                    return primaryOrgLabel ? (
                                        <span className="font-medium text-zinc-900">{primaryOrgLabel}</span>
                                    ) : (
                                        <span className="text-sm text-zinc-400">None</span>
                                    );
                                })()}
                            </TableCell>
                            <TableCell>
                                {(() => {
                                    const access = getUserAccessView(user);
                                    const fallbackBadges = access.buildingAccess.map((assignment) => ({
                                        key: `${assignment.roleTemplateKey}:${assignment.scopeId ?? ""}`,
                                        label: [
                                            assignment.roleTemplateName ?? assignment.roleTemplateKey,
                                            assignment.scopeId
                                                ? (buildingNameById?.[assignment.scopeId] ?? assignment.buildingName ?? assignment.scopeId)
                                                : undefined,
                                        ]
                                                .filter(Boolean)
                                                .join(" / "),
                                    }));
                                    const badges = [
                                        ...fallbackBadges,
                                        ...(access.resident ? [{ key: "resident", label: "Resident" }] : []),
                                    ].map((badge) => {
                                        if (!badge.key?.includes(":")) return badge;
                                        const [, buildingId] = badge.key.split(":");
                                        const buildingName = buildingId ? buildingNameById?.[buildingId] : undefined;
                                        if (!buildingName) return badge;
                                        const labelPrefix = badge.label.split(" / ")[0] ?? badge.label;
                                        return {
                                            ...badge,
                                            label: `${labelPrefix} / ${buildingName}`,
                                        };
                                    });
                                    return badges.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {badges.map((badge) => (
                                                <Badge key={`${badge.key ?? badge.label}-${badge.label}`} variant="secondary" className="text-xs bg-zinc-100 text-zinc-600">
                                                    {badge.label}
                                                </Badge>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-sm text-zinc-400">No Building / Resident Access</span>
                                    );
                                })()}
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
                            <TableCell colSpan={6} className="text-center py-8 text-zinc-500">
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
