"use client";

import { toast } from "sonner";
import { User, Phone, Car, Clock, Home, LogIn, LogOut, XCircle, Calendar, CreditCard, CheckCircle } from "lucide-react";

import { SlideOver } from "@/components/common/SlideOver";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useUpdateVisitor } from "@/lib/queries";
import { Visitor, VisitorStatus } from "@/lib/types";
import { visitorTypeLabels, visitorTypeStyles, visitorStatusLabels, visitorStatusStyles } from "./visitorDisplay";

function formatDateTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

interface VisitorDetailSheetProps {
    visitor: Visitor | null;
    buildingId: string;
    onClose: () => void;
}

export function VisitorDetailSheet({ visitor, buildingId, onClose }: VisitorDetailSheetProps) {
    const updateMutation = useUpdateVisitor();

    const handleStatusChange = async (newStatus: VisitorStatus) => {
        if (!visitor) return;

        try {
            await updateMutation.mutateAsync({
                buildingId,
                visitorId: visitor.id,
                data: { status: newStatus }
            });
            const statusLabels: Record<VisitorStatus, string> = {
                EXPECTED: "marked as expected",
                ARRIVED: "checked in",
                COMPLETED: "checked out",
                CANCELLED: "cancelled"
            };
            toast.success(`Visitor ${statusLabels[newStatus]}`);
        } catch (error) {
            toast.error("Failed to update visitor status");
            console.error(error);
        }
    };

    const canCheckOut = visitor?.status === "ARRIVED";
    const canCancel = visitor?.status === "EXPECTED" || visitor?.status === "ARRIVED";

    return (
        <SlideOver
            open={!!visitor}
            onOpenChange={(open) => !open && onClose()}
            title="Visitor Details"
            description={visitor ? `Viewing ${visitor.visitorName}` : ""}
            width="w-[400px] sm:w-[480px]"
        >
            {visitor && (
                <div className="flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100">
                                <User className="h-7 w-7 text-zinc-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-zinc-900">{visitor.visitorName}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className={visitorTypeStyles[visitor.type]}>
                                        {visitorTypeLabels[visitor.type]}
                                    </Badge>
                                    <Badge variant="outline" className={visitorStatusStyles[visitor.status]}>
                                        {visitorStatusLabels[visitor.status]}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 mb-6">
                            {canCheckOut && (
                                <Button
                                    onClick={() => handleStatusChange("COMPLETED")}
                                    disabled={updateMutation.isPending}
                                    variant="outline"
                                    className="flex-1"
                                >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Complete
                                </Button>
                            )}
                            {canCancel && (
                                <Button
                                    onClick={() => handleStatusChange("CANCELLED")}
                                    disabled={updateMutation.isPending}
                                    variant="outline"
                                    className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Cancel
                                </Button>
                            )}
                        </div>

                        <Separator className="my-4" />

                        <div className="space-y-4">
                            <div>
                                <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
                                    Visit Information
                                </h4>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100">
                                            <Home className="h-4 w-4 text-zinc-500" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-zinc-500">Unit</p>
                                            <p className="text-sm font-medium text-zinc-900">
                                                {visitor.unit?.label || '-'}
                                            </p>
                                        </div>
                                    </div>

                                    {visitor.tenantName && (
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100">
                                                <User className="h-4 w-4 text-zinc-500" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-zinc-500">Tenant</p>
                                                <p className="text-sm font-medium text-zinc-900">{visitor.tenantName}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <Separator />

                            <div>
                                <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
                                    Contact Information
                                </h4>
                                <div className="space-y-3">
                                    {visitor.phoneNumber && (
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100">
                                                <Phone className="h-4 w-4 text-zinc-500" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-zinc-500">Phone</p>
                                                <p className="text-sm font-medium text-zinc-900">{visitor.phoneNumber}</p>
                                            </div>
                                        </div>
                                    )}

                                    {visitor.emiratesId && (
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100">
                                                <CreditCard className="h-4 w-4 text-zinc-500" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-zinc-500">Emirates ID</p>
                                                <p className="text-sm font-medium text-zinc-900">{visitor.emiratesId}</p>
                                            </div>
                                        </div>
                                    )}

                                    {visitor.vehicleNumber && (
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100">
                                                <Car className="h-4 w-4 text-zinc-500" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-zinc-500">Vehicle Number</p>
                                                <p className="text-sm font-medium text-zinc-900">{visitor.vehicleNumber}</p>
                                            </div>
                                        </div>
                                    )}

                                    {!visitor.phoneNumber && !visitor.emiratesId && !visitor.vehicleNumber && (
                                        <p className="text-sm text-zinc-400">No additional contact information</p>
                                    )}
                                </div>
                            </div>

                            <Separator />

                            <div>
                                <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
                                    Timeline
                                </h4>
                                <div className="space-y-3">
                                    {visitor.expectedArrivalAt && (
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                                                <Clock className="h-4 w-4 text-blue-500" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-zinc-500">Expected Arrival</p>
                                                <p className="text-sm font-medium text-zinc-900">
                                                    {formatDateTime(visitor.expectedArrivalAt)}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100">
                                            <Calendar className="h-4 w-4 text-zinc-500" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-zinc-500">Registered</p>
                                            <p className="text-sm font-medium text-zinc-900">
                                                {formatDateTime(visitor.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {visitor.notes && (
                                <>
                                    <Separator />
                                    <div>
                                        <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
                                            Notes
                                        </h4>
                                        <p className="text-sm text-zinc-600 bg-zinc-50 rounded-lg p-3">
                                            {visitor.notes}
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="border-t border-zinc-200 p-4">
                        <Button variant="outline" className="w-full" onClick={onClose}>
                            Close
                        </Button>
                    </div>
                </div>
            )}
        </SlideOver>
    );
}
