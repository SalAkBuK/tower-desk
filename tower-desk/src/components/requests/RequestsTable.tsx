"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ServiceRequest } from "@/lib/types";
import { getStatusIcon, priorityStyles, statusLabels, statusStyles } from "@/components/requests/requestDisplay";

interface RequestsTableProps {
    requests: ServiceRequest[] | undefined;
    isLoading: boolean;
    onSelect?: (request: ServiceRequest) => void;
    buildingNameById?: Record<string, string>;
}

export function RequestsTable({
    requests,
    isLoading,
    onSelect,
    buildingNameById,
}: RequestsTableProps) {
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
                        <TableHead>Request</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Building</TableHead>
                        <TableHead>Created</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {requests?.map((req) => (
                        <TableRow
                            key={req.id}
                            className={onSelect ? "cursor-pointer" : undefined}
                            onClick={() => onSelect?.(req)}
                        >
                            <TableCell className="whitespace-normal">
                                <div className="space-y-1">
                                    <div className="font-medium text-zinc-900">{req.title}</div>
                                    <p className="text-xs text-zinc-500 line-clamp-1">{req.description}</p>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className={priorityStyles[req.priority]}>
                                    {req.priority}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className={`flex items-center gap-1 ${statusStyles[req.status]}`}>
                                    {getStatusIcon(req.status)}
                                    <span>{statusLabels[req.status]}</span>
                                </Badge>
                            </TableCell>
                            <TableCell className="text-zinc-500">
                                {buildingNameById?.[req.buildingId] || req.buildingId}
                            </TableCell>
                            <TableCell className="text-zinc-500">
                                {new Date(req.createdAt).toLocaleDateString()}
                            </TableCell>
                        </TableRow>
                    ))}
                    {(!requests || requests.length === 0) && (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-zinc-500">
                                No requests found.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
