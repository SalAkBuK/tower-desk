"use client";

import { use, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { useLeaseById, useBuildingOccupancies, useOccupancyParkingAllocations, useOccupancyVehicles } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { getUserPermissionSet, hasPermission, hasPermissionPrefix } from "@/lib/permissions";
import { LeaseAccessCardsSection } from "@/components/leases/LeaseAccessCardsSection";
import { LeaseParkingStickersSection } from "@/components/leases/LeaseParkingStickersSection";
import { LeaseOccupantsSection } from "@/components/leases/LeaseOccupantsSection";
import { LeaseDocumentsSection } from "@/components/leases/LeaseDocumentsSection";
import { EditLeaseDialog } from "@/components/leases/EditLeaseDialog";
import { LeaseTimelineSection } from "@/components/leases/LeaseTimelineSection";

interface LeaseDetailPageProps {
    params: Promise<{ leaseId: string }>;
}

const formatDate = (value?: string | null) => {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(date);
};

const formatMoney = (value?: string | number | null) => {
    if (value === null || value === undefined) return "N/A";
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (Number.isNaN(num)) return String(value);
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num);
};

export default function LeaseDetailPage({ params }: LeaseDetailPageProps) {
    const { leaseId } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const [editLeaseOpen, setEditLeaseOpen] = useState(false);
    const defaultTab = searchParams.get("tab") === "history" ? "history" : "details";
    const [activeTab, setActiveTab] = useState<"details" | "history">(defaultTab);
    const { user } = useAuth();
    const permissionSet = useMemo(() => getUserPermissionSet(user), [user]);
    const canReadLease =
        hasPermission(permissionSet, "leases.read") ||
        hasPermissionPrefix(permissionSet, "leases.read") ||
        hasPermissionPrefix(permissionSet, "leases");
    const canWriteLease =
        hasPermission(permissionSet, "leases.write") ||
        hasPermissionPrefix(permissionSet, "leases.write") ||
        hasPermissionPrefix(permissionSet, "leases");
    const canReadDocuments =
        hasPermission(permissionSet, "leases.documents.read") ||
        hasPermissionPrefix(permissionSet, "leases.documents");
    const canWriteDocuments =
        hasPermission(permissionSet, "leases.documents.write") ||
        hasPermissionPrefix(permissionSet, "leases.documents.write");
    const canReadAccessItems =
        hasPermission(permissionSet, "leases.access_items.read") ||
        hasPermissionPrefix(permissionSet, "leases.access_items");
    const canWriteAccessItems =
        hasPermission(permissionSet, "leases.access_items.write") ||
        hasPermissionPrefix(permissionSet, "leases.access_items.write");
    const canReadOccupants =
        hasPermission(permissionSet, "leases.occupants.read") ||
        hasPermissionPrefix(permissionSet, "leases.occupants");
    const canWriteOccupants =
        hasPermission(permissionSet, "leases.occupants.write") ||
        hasPermissionPrefix(permissionSet, "leases.occupants.write");

    const leaseQuery = useLeaseById(leaseId);
    const { data: lease, isLoading, isError, error } = leaseQuery;
    const leaseErrorStatus =
        typeof error === "object" && error && "status" in error && typeof (error as { status?: unknown }).status === "number"
            ? ((error as { status: number }).status)
            : undefined;
    const { data: occupancies } = useBuildingOccupancies(lease?.buildingId || "", {
        enabled: Boolean(lease?.buildingId),
    });
    const activeOccupancy = useMemo(() => {
        if (!lease?.unitId) return undefined;
        const matches = (occupancies || []).filter((entry) => {
            const sameUnit = String(entry.unitId ?? "") === String(lease.unitId);
            const sameResident = lease.residentUserId
                ? String(entry.residentUserId ?? "") === String(lease.residentUserId)
                : true;
            const isActive = String(entry.status ?? "").toUpperCase() === "ACTIVE" || !entry.endAt;
            return sameUnit && sameResident && isActive;
        });
        return matches[0];
    }, [occupancies, lease?.unitId, lease?.residentUserId]);
    const { data: occupancyParkingAllocations } = useOccupancyParkingAllocations(activeOccupancy?.id || "", {
        enabled: Boolean(activeOccupancy?.id),
        active: true,
    });
    const { data: occupancyVehicles } = useOccupancyVehicles(activeOccupancy?.id || "", {
        enabled: Boolean(activeOccupancy?.id),
    });

    if (isLoading) {
        return (
            <div className="space-y-6 p-6">
                <Skeleton className="h-8 w-48" />
                <div className="grid gap-6 lg:grid-cols-2">
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                </div>
            </div>
        );
    }

    if (isError || !lease) {
        if (leaseErrorStatus === 404) {
            return (
                <div className="p-6">
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center">
                        <p className="text-zinc-700">Lease not found.</p>
                        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
                            Go Back
                        </Button>
                    </div>
                </div>
            );
        }
        return (
            <div className="p-6">
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-center">
                    <p className="text-rose-700">Failed to load lease details.</p>
                    <Button variant="outline" className="mt-4" onClick={() => router.back()}>
                        Go Back
                    </Button>
                </div>
            </div>
        );
    }

    const isActive = lease.status === "ACTIVE";

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-semibold text-zinc-900">
                            Lease - Unit {lease.unit?.label || lease.unitId}
                        </h1>
                        <p className="text-sm text-zinc-500">
                            {lease.resident?.name || lease.resident?.email || lease.residentUserId || "Unknown Resident"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {canWriteLease && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditLeaseOpen(true)}
                        >
                            Edit Lease
                        </Button>
                    )}
                    <Badge
                        variant="secondary"
                        className={isActive ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}
                    >
                        {lease.status}
                    </Badge>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "details" | "history")} className="space-y-6">
                <TabsList>
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-6">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                        <h2 className="mb-4 text-sm font-semibold text-zinc-900">Lease Details</h2>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                                <div className="text-xs uppercase tracking-wide text-zinc-400">Start Date</div>
                                <div className="text-sm font-medium text-zinc-900">{formatDate(lease.leaseStartDate)}</div>
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wide text-zinc-400">End Date</div>
                                <div className="text-sm font-medium text-zinc-900">{formatDate(lease.leaseEndDate)}</div>
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wide text-zinc-400">Annual Rent</div>
                                <div className="text-sm font-medium text-zinc-900">{formatMoney(lease.annualRent)}</div>
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wide text-zinc-400">Security Deposit</div>
                                <div className="text-sm font-medium text-zinc-900">{formatMoney(lease.securityDepositAmount)}</div>
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wide text-zinc-400">Payment Frequency</div>
                                <div className="text-sm font-medium text-zinc-900">
                                    {lease.paymentFrequency?.replace(/_/g, " ") || "N/A"}
                                </div>
                            </div>
                            {lease.tenancyRegistrationExpiry && (
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Registration Expiry</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatDate(lease.tenancyRegistrationExpiry)}</div>
                                </div>
                            )}
                            {lease.noticeGivenDate && (
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Notice Given</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatDate(lease.noticeGivenDate)}</div>
                                </div>
                            )}
                            {lease.numberOfCheques && (
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Number of Cheques</div>
                                    <div className="text-sm font-medium text-zinc-900">{lease.numberOfCheques}</div>
                                </div>
                            )}
                            {lease.serviceChargesPaidBy && (
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Service Charges Paid By</div>
                                    <div className="text-sm font-medium text-zinc-900">{lease.serviceChargesPaidBy}</div>
                                </div>
                            )}
                            {lease.actualMoveOutDate && (
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Move-Out Date</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatDate(lease.actualMoveOutDate)}</div>
                                </div>
                            )}
                        </div>

                        {lease.notes && (
                            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                                <div className="text-xs uppercase tracking-wide text-zinc-400">Notes</div>
                                <div className="mt-1 text-sm text-zinc-700">{lease.notes}</div>
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                        <h2 className="mb-4 text-sm font-semibold text-zinc-900">Resident</h2>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                                <div className="text-xs uppercase tracking-wide text-zinc-400">Name</div>
                                <div className="text-sm font-medium text-zinc-900">
                                    {lease.resident?.name || "Unknown Resident"}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wide text-zinc-400">Email</div>
                                <div className="text-sm font-medium text-zinc-900">
                                    {lease.resident?.email || "-"}
                                </div>
                            </div>
                        </div>
                    </div>

                    {lease.unit && (
                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                            <h2 className="mb-4 text-sm font-semibold text-zinc-900">Unit Specs</h2>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Unit</div>
                                    <div className="text-sm font-medium text-zinc-900">{lease.unit.label || lease.unitId}</div>
                                </div>
                                {lease.unit.floor !== undefined && (
                                    <div>
                                        <div className="text-xs uppercase tracking-wide text-zinc-400">Floor</div>
                                        <div className="text-sm font-medium text-zinc-900">{lease.unit.floor}</div>
                                    </div>
                                )}
                                {lease.unit.bedrooms !== undefined && (
                                    <div>
                                        <div className="text-xs uppercase tracking-wide text-zinc-400">Bedrooms</div>
                                        <div className="text-sm font-medium text-zinc-900">{lease.unit.bedrooms}</div>
                                    </div>
                                )}
                                {lease.unit.bathrooms !== undefined && (
                                    <div>
                                        <div className="text-xs uppercase tracking-wide text-zinc-400">Bathrooms</div>
                                        <div className="text-sm font-medium text-zinc-900">{lease.unit.bathrooms}</div>
                                    </div>
                                )}
                                {lease.unit.unitSize !== undefined && (
                                    <div>
                                        <div className="text-xs uppercase tracking-wide text-zinc-400">Unit Size</div>
                                        <div className="text-sm font-medium text-zinc-900">
                                            {lease.unit.unitSize} {lease.unit.unitSizeUnit ?? ""}
                                        </div>
                                    </div>
                                )}
                                {lease.unit.furnishedStatus && (
                                    <div>
                                        <div className="text-xs uppercase tracking-wide text-zinc-400">Furnished</div>
                                        <div className="text-sm font-medium text-zinc-900">{lease.unit.furnishedStatus}</div>
                                    </div>
                                )}
                                {lease.unit.unitType?.name && (
                                    <div>
                                        <div className="text-xs uppercase tracking-wide text-zinc-400">Unit Type</div>
                                        <div className="text-sm font-medium text-zinc-900">{lease.unit.unitType.name}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                        <h2 className="mb-4 text-sm font-semibold text-zinc-900">Parking Allocations</h2>
                        {occupancyParkingAllocations && occupancyParkingAllocations.length > 0 ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                                {occupancyParkingAllocations.map((allocation) => (
                                    <div key={allocation.id || allocation.parkingSlotId} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                                        <div className="text-sm font-semibold text-zinc-900">
                                            {allocation.slot?.code || allocation.parkingSlotId}
                                        </div>
                                        <div className="mt-2 grid gap-1 text-xs text-zinc-600">
                                            <div>
                                                <span className="uppercase tracking-wide text-zinc-400">Type </span>
                                                <span className="font-medium text-zinc-700">{allocation.slot?.type || "N/A"}</span>
                                            </div>
                                            <div>
                                                <span className="uppercase tracking-wide text-zinc-400">Level </span>
                                                <span className="font-medium text-zinc-700">{allocation.slot?.level || "N/A"}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-zinc-500">No parking allocations for the active occupancy.</div>
                        )}
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                        <h2 className="mb-4 text-sm font-semibold text-zinc-900">Vehicles</h2>
                        {occupancyVehicles && occupancyVehicles.length > 0 ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                                {occupancyVehicles.map((vehicle) => (
                                    <div key={vehicle.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                                        <div className="text-sm font-semibold text-zinc-900">{vehicle.plateNumber}</div>
                                        {vehicle.label ? (
                                            <div className="text-xs text-zinc-600 mt-1">{vehicle.label}</div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-zinc-500">No vehicles registered for this occupancy.</div>
                        )}
                    </div>

                    {canReadDocuments && (
                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                            <LeaseDocumentsSection
                                leaseId={lease.id}
                                readOnly={!isActive || !canWriteDocuments}
                            />
                        </div>
                    )}

                    {canReadAccessItems && (
                        <div className="grid gap-6 lg:grid-cols-2">
                            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                                <LeaseAccessCardsSection
                                    leaseId={lease.id}
                                    readOnly={!isActive || !canWriteAccessItems}
                                />
                            </div>

                            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                                <LeaseParkingStickersSection
                                    leaseId={lease.id}
                                    readOnly={!isActive || !canWriteAccessItems}
                                />
                            </div>
                        </div>
                    )}

                    {canReadOccupants && (
                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                            <LeaseOccupantsSection
                                leaseId={lease.id}
                                readOnly={!isActive || !canWriteOccupants}
                            />
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="history" className="space-y-6">
                    {canReadLease ? (
                        <LeaseTimelineSection leaseId={lease.id} />
                    ) : (
                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm text-sm text-zinc-600">
                            You do not have access to view lease timeline.
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {canWriteLease && (
                <EditLeaseDialog
                    open={editLeaseOpen}
                    onOpenChange={setEditLeaseOpen}
                    lease={lease}
                />
            )}
        </div>
    );
}
