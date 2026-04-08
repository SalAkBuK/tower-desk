"use client";

import { User } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Edit, Trash, ChevronDown, ChevronUp } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Fragment, useState, type ReactNode } from "react";
import { getUserDirectorySummary } from "@/lib/userDirectoryPresentation";

interface UsersTableProps {
    users: User[] | undefined;
    isLoading: boolean;
    onDelete?: (user: User) => void;
    canDelete?: (user: User) => boolean;
    buildingNameById?: Record<string, string>;
    emptyMessage?: string;
    actions?: {
        label: string;
        icon?: ReactNode;
        onSelect: (user: User) => void;
        className?: string;
        disabled?: (user: User) => boolean;
    }[];
}

export function UsersTable({ users, isLoading, onDelete, canDelete, buildingNameById, emptyMessage, actions }: UsersTableProps) {
    const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

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
        <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Primary Access</TableHead>
                        <TableHead>Scope</TableHead>
                        <TableHead className="w-[96px] text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users?.map((user) => {
                        const summary = getUserDirectorySummary(user, buildingNameById);
                        const isExpanded = expandedUserId === user.id;
                        return (
                            <Fragment key={user.id}>
                                <TableRow key={user.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={user.avatarUrl} />
                                                <AvatarFallback className="bg-zinc-100 text-zinc-500">
                                                    {user.name.slice(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <div className="font-medium text-zinc-900">{user.name}</div>
                                                {user.phoneNumber ? (
                                                    <div className="truncate text-xs text-zinc-500">{user.phoneNumber}</div>
                                                ) : null}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-zinc-600">
                                        {user.email || <span className="text-sm text-zinc-400">No email</span>}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className={summary.status.tone}>{summary.status.label}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium text-zinc-900">{summary.primaryAccess}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm text-zinc-600">{summary.scope}</div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-zinc-400 hover:text-zinc-900"
                                                onClick={() => setExpandedUserId((current) => current === user.id ? null : user.id)}
                                                aria-label={isExpanded ? `Hide access details for ${user.name}` : `Show access details for ${user.name}`}
                                            >
                                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </Button>
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
                                        </div>
                                    </TableCell>
                                </TableRow>
                                {isExpanded ? (
                                    <TableRow className="bg-zinc-50/80">
                                        <TableCell colSpan={6} className="p-4">
                                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                                <div className="space-y-2">
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Org role(s)</p>
                                                    {summary.detailOrgRoles.length > 0 ? (
                                                        <div className="flex flex-wrap gap-2">
                                                            {summary.detailOrgRoles.map((role) => (
                                                                <Badge key={role} variant="secondary" className="bg-white text-zinc-700">
                                                                    {role}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-zinc-500">No org-wide roles.</p>
                                                    )}
                                                </div>
                                                <div className="space-y-2">
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Building assignment(s)</p>
                                                    {summary.detailBuildingAssignments.length > 0 ? (
                                                        <ul className="space-y-1 text-sm text-zinc-600">
                                                            {summary.detailBuildingAssignments.map((assignment) => (
                                                                <li key={assignment}>{assignment}</li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <p className="text-sm text-zinc-500">No building assignments.</p>
                                                    )}
                                                </div>
                                                <div className="space-y-2">
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Resident linkage</p>
                                                    <p className="text-sm text-zinc-600">{summary.detailResidentLink ?? "No resident linkage."}</p>
                                                </div>
                                                <div className="space-y-2">
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Account state</p>
                                                    <p className="text-sm text-zinc-600">{summary.detailSetupState}</p>
                                                    {user.createdAt ? (
                                                        <p className="text-xs text-zinc-500">Created {new Date(user.createdAt).toLocaleDateString()}</p>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                            </Fragment>
                        );
                    })}
                    {(!users || users.length === 0) && (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-zinc-500">
                                {emptyMessage ?? "No users found."}
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
