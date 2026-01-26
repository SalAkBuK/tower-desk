"use client";

import { User, Phone, Car, Clock, Home } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Visitor } from "@/lib/types";
import { visitorTypeLabels, visitorTypeStyles, visitorStatusLabels, visitorStatusStyles } from "./visitorDisplay";

interface VisitorsTableProps {
    visitors: Visitor[] | undefined;
    isLoading: boolean;
    onSelect?: (visitor: Visitor) => void;
}

export function VisitorsTable({ visitors, isLoading, onSelect }: VisitorsTableProps) {
    if (isLoading) {
        return (
            <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                ))}
            </div>
        );
    }

    if (!visitors || visitors.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
                    <User className="h-6 w-6 text-zinc-400" />
                </div>
                <h3 className="mt-4 text-sm font-medium text-zinc-900">No visitors</h3>
                <p className="mt-1 text-sm text-zinc-500">No visitors found for the selected criteria.</p>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-zinc-200">
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[200px]">Visitor</TableHead>
                        <TableHead className="w-[120px]">Type</TableHead>
                        <TableHead className="w-[120px]">Status</TableHead>
                        <TableHead className="w-[140px]">Unit / Tenant</TableHead>
                        <TableHead className="w-[140px]">Expected</TableHead>
                        <TableHead className="w-[120px]">Contact</TableHead>
                        <TableHead className="w-[100px]">Vehicle</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {visitors.map((visitor) => (
                        <TableRow
                            key={visitor.id}
                            className="cursor-pointer hover:bg-zinc-50"
                            onClick={() => onSelect?.(visitor)}
                        >
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100">
                                        <User className="h-4 w-4 text-zinc-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-zinc-900">{visitor.visitorName}</p>
                                        {visitor.emiratesId && (
                                            <p className="text-xs text-zinc-500 truncate max-w-[150px]">
                                                ID: {visitor.emiratesId}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className={visitorTypeStyles[visitor.type]}>
                                    {visitorTypeLabels[visitor.type]}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className={visitorStatusStyles[visitor.status]}>
                                    {visitorStatusLabels[visitor.status]}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-1.5 text-sm">
                                    <Home className="h-3.5 w-3.5 text-zinc-400" />
                                    <span className="text-zinc-900">{visitor.unit?.label || '-'}</span>
                                </div>
                                {visitor.tenantName && (
                                    <p className="text-xs text-zinc-500 mt-0.5">{visitor.tenantName}</p>
                                )}
                            </TableCell>
                            <TableCell>
                                {visitor.expectedArrivalAt ? (
                                    <div className="flex items-center gap-1.5 text-sm text-zinc-600">
                                        <Clock className="h-3.5 w-3.5 text-zinc-400" />
                                        {new Date(visitor.expectedArrivalAt).toLocaleString(undefined, {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: 'numeric',
                                            minute: '2-digit'
                                        })}
                                    </div>
                                ) : (
                                    <span className="text-zinc-400">-</span>
                                )}
                            </TableCell>
                            <TableCell>
                                {visitor.phoneNumber ? (
                                    <div className="flex items-center gap-1.5 text-sm text-zinc-600">
                                        <Phone className="h-3.5 w-3.5 text-zinc-400" />
                                        {visitor.phoneNumber}
                                    </div>
                                ) : (
                                    <span className="text-zinc-400">-</span>
                                )}
                            </TableCell>
                            <TableCell>
                                {visitor.vehicleNumber ? (
                                    <div className="flex items-center gap-1.5 text-sm text-zinc-600">
                                        <Car className="h-3.5 w-3.5 text-zinc-400" />
                                        {visitor.vehicleNumber}
                                    </div>
                                ) : (
                                    <span className="text-zinc-400">-</span>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
