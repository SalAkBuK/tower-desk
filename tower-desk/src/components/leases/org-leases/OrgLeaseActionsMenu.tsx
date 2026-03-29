"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Lease } from "@/lib/types";

interface OrgLeaseActionsMenuProps {
    canActivateContract: boolean;
    canCancelContract: boolean;
    canEditContract: boolean;
    contextLabel: string;
    isUpdatingContractStatus: boolean;
    lease: Lease;
    leaseBasePath: string;
    onActivate: (lease: Lease) => void;
    onCancel: (lease: Lease) => void;
    onEdit: (lease: Lease) => void;
}

export function OrgLeaseActionsMenu({
    canActivateContract,
    canCancelContract,
    canEditContract,
    contextLabel,
    isUpdatingContractStatus,
    lease,
    leaseBasePath,
    onActivate,
    onCancel,
    onEdit,
}: OrgLeaseActionsMenuProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-zinc-500 hover:text-zinc-900"
                    aria-label={`Contract actions for ${contextLabel}`}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                >
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                    <Link
                        href={`${leaseBasePath}/${lease.id}`}
                        onClick={(event) => event.stopPropagation()}
                    >
                        View
                    </Link>
                </DropdownMenuItem>
                {canEditContract ? (
                    <DropdownMenuItem
                        onClick={(event) => {
                            event.stopPropagation();
                            onEdit(lease);
                        }}
                    >
                        Edit Contract
                    </DropdownMenuItem>
                ) : null}
                {canActivateContract ? (
                    <DropdownMenuItem
                        disabled={isUpdatingContractStatus}
                        onClick={(event) => {
                            event.stopPropagation();
                            onActivate(lease);
                        }}
                    >
                        Activate Contract
                    </DropdownMenuItem>
                ) : null}
                {canCancelContract ? (
                    <DropdownMenuItem
                        disabled={isUpdatingContractStatus}
                        onClick={(event) => {
                            event.stopPropagation();
                            onCancel(lease);
                        }}
                    >
                        Cancel Contract
                    </DropdownMenuItem>
                ) : null}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
