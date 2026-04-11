"use client";

import { use, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { useLeaseById, useBuildingOccupancies, useOccupancyParkingAllocations } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { formatLeaseDisplayStatus, getLeaseDisplayStatus, getLeaseStatusBadgeClassName } from "@/lib/leaseStatus";
import { getUserPermissionSet, hasPermission, hasPermissionPrefix } from "@/lib/permissions";
import { LeaseAccessCardsSection } from "@/components/leases/LeaseAccessCardsSection";
import { LeaseParkingStickersSection } from "@/components/leases/LeaseParkingStickersSection";
import { LeaseOccupantsSection } from "@/components/leases/LeaseOccupantsSection";
import { LeaseDocumentsSection } from "@/components/leases/LeaseDocumentsSection";
import { EditLeaseDialog } from "@/components/leases/EditLeaseDialog";
import { LeaseTimelineSection } from "@/components/leases/LeaseTimelineSection";
import { AllocateParkingDialog } from "@/components/parking/AllocateParkingDialog";
import { ManageAllocationsDialog } from "@/components/parking/ManageAllocationsDialog";
import { OccupancyVehicles } from "@/components/residents/OccupancyVehicles";

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

const hasValue = (value?: string | number | null) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    return true;
};

const formatBooleanValue = (value?: boolean | null) => {
    if (value === null || value === undefined) return "N/A";
    return value ? "Yes" : "No";
};

export default function LeaseDetailPage({ params }: LeaseDetailPageProps) {
    const { leaseId } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const [editLeaseOpen, setEditLeaseOpen] = useState(false);
    const [allocateDialogOpen, setAllocateDialogOpen] = useState(false);
    const [manageDialogOpen, setManageDialogOpen] = useState(false);
    const [leaseContextBlockedMessage, setLeaseContextBlockedMessage] = useState<string | null>(null);
    const defaultTab = searchParams.get("tab") === "history" ? "history" : "details";
    const [activeTab, setActiveTab] = useState<"details" | "history">(defaultTab);
    const { user } = useAuth();
    const permissionSet = useMemo(() => getUserPermissionSet(user), [user]);
    const canReadLease =
        hasPermission(permissionSet, "contracts.read") ||
        hasPermissionPrefix(permissionSet, "contracts.read") ||
        hasPermissionPrefix(permissionSet, "contracts") ||
        hasPermission(permissionSet, "leases.read") ||
        hasPermissionPrefix(permissionSet, "leases.read") ||
        hasPermissionPrefix(permissionSet, "leases");
    const canWriteLease =
        hasPermission(permissionSet, "contracts.write") ||
        hasPermissionPrefix(permissionSet, "contracts.write") ||
        hasPermission(permissionSet, "contracts.create") ||
        hasPermissionPrefix(permissionSet, "contracts.create") ||
        hasPermission(permissionSet, "leases.write") ||
        hasPermissionPrefix(permissionSet, "leases.write") ||
        hasPermission(permissionSet, "leases.create") ||
        hasPermissionPrefix(permissionSet, "leases.create");
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
    const canReadParkingAllocations =
        hasPermission(permissionSet, "parkingAllocations.read") ||
        hasPermissionPrefix(permissionSet, "parkingAllocations.read") ||
        hasPermissionPrefix(permissionSet, "parkingAllocations");
    const canCreateParkingAllocations =
        hasPermission(permissionSet, "parkingAllocations.create") ||
        hasPermissionPrefix(permissionSet, "parkingAllocations.create") ||
        hasPermissionPrefix(permissionSet, "parkingAllocations");
    const canEndParkingAllocations =
        hasPermission(permissionSet, "parkingAllocations.end") ||
        hasPermissionPrefix(permissionSet, "parkingAllocations.end") ||
        hasPermissionPrefix(permissionSet, "parkingAllocations");
    const canReadVehicles =
        hasPermission(permissionSet, "vehicles.read") ||
        hasPermissionPrefix(permissionSet, "vehicles.read") ||
        hasPermissionPrefix(permissionSet, "vehicles");
    const canCreateVehicles =
        hasPermission(permissionSet, "vehicles.create") ||
        hasPermissionPrefix(permissionSet, "vehicles.create") ||
        hasPermissionPrefix(permissionSet, "vehicles");
    const canUpdateVehicles =
        hasPermission(permissionSet, "vehicles.update") ||
        hasPermissionPrefix(permissionSet, "vehicles.update") ||
        hasPermissionPrefix(permissionSet, "vehicles");
    const canDeleteVehicles =
        hasPermission(permissionSet, "vehicles.delete") ||
        hasPermissionPrefix(permissionSet, "vehicles.delete") ||
        hasPermissionPrefix(permissionSet, "vehicles");
    const canEditVehicles = canCreateVehicles && canUpdateVehicles && canDeleteVehicles;

    const leaseQuery = useLeaseById(leaseId);
    const { data: lease, isLoading, isError, error } = leaseQuery;
    const leaseErrorStatus =
        typeof error === "object" && error && "status" in error && typeof (error as { status?: unknown }).status === "number"
            ? ((error as { status: number }).status)
            : undefined;
    const { data: occupancies } = useBuildingOccupancies(lease?.buildingId || "", {
        enabled: Boolean(lease?.buildingId),
    });
    const leaseOccupancyId = lease?.occupancyId ? String(lease.occupancyId) : null;
    const activeOccupancy = (() => {
        if (!lease?.unitId) return undefined;
        if (leaseOccupancyId) {
            const byId = (occupancies || []).find((entry) => String(entry.id) === leaseOccupancyId);
            if (byId) return byId;
        }
        const matches = (occupancies || []).filter((entry) => {
            const sameUnit = String(entry.unitId ?? "") === String(lease.unitId);
            const sameResident = lease.residentUserId
                ? String(entry.residentUserId ?? "") === String(lease.residentUserId)
                : true;
            const isActive = String(entry.status ?? "").toUpperCase() === "ACTIVE" || !entry.endAt;
            return sameUnit && sameResident && isActive;
        });
        return matches[0];
    })();
    const resolvedOccupancyId = leaseOccupancyId ?? activeOccupancy?.id ?? "";
    const isResolvedOccupancyActive = useMemo(() => {
        if (!resolvedOccupancyId) return false;
        if (activeOccupancy && String(activeOccupancy.id) === String(resolvedOccupancyId)) {
            return String(activeOccupancy.status ?? "").toUpperCase() === "ACTIVE" || !activeOccupancy.endAt;
        }
        return true;
    }, [activeOccupancy, resolvedOccupancyId]);
    const occupancyOptions = useMemo(() => {
        if (!lease || !resolvedOccupancyId) return [];
        return [{
            id: resolvedOccupancyId,
            unitId: lease.unitId,
            unitLabel: lease.unit?.label ?? activeOccupancy?.unitLabel,
            residentUserId: lease.residentUserId,
            residentName: lease.resident?.name ?? activeOccupancy?.residentName,
            residentEmail: lease.resident?.email ?? activeOccupancy?.residentEmail,
            status: "ACTIVE",
        }];
    }, [activeOccupancy?.residentEmail, activeOccupancy?.residentName, activeOccupancy?.unitLabel, lease, resolvedOccupancyId]);
    const { data: occupancyParkingAllocations } = useOccupancyParkingAllocations(resolvedOccupancyId, {
        enabled: canReadParkingAllocations && Boolean(resolvedOccupancyId),
        active: true,
    });
    const isActive = lease?.status === "ACTIVE";
    const hasLeaseContext = Boolean(lease?.buildingId && resolvedOccupancyId);
    const residentDisplayName = lease?.resident?.name || lease?.tenantNameSnapshot || "Unknown Resident";
    const residentDisplayEmail = lease?.resident?.email || lease?.tenantEmailSnapshot || "-";
    const isLeaseContextEditable = Boolean(
        isActive && hasLeaseContext && isResolvedOccupancyActive && !leaseContextBlockedMessage
    );
    const leaseContextReadOnlyReason = !isActive
        ? "Parking and vehicles can only be edited for active contracts."
        : !hasLeaseContext
            ? "Move-in has not been executed for this contract yet, so parking and vehicles are unavailable."
            : !isResolvedOccupancyActive
                ? "Occupancy is not active."
                : leaseContextBlockedMessage;

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
                        <p className="text-zinc-700">Contract not found.</p>
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
                    <p className="text-rose-700">Failed to load contract details.</p>
                    <Button variant="outline" className="mt-4" onClick={() => router.back()}>
                        Go Back
                    </Button>
                </div>
            </div>
        );
    }

    const leaseDisplayStatus = getLeaseDisplayStatus(lease);

    const handleLeaseContextBlocked = (message: string) => {
        setLeaseContextBlockedMessage(message);
        setAllocateDialogOpen(false);
        setManageDialogOpen(false);
    };

    const residentSnapshotItems = [
        { label: "Tenant Snapshot Name", value: lease.tenantNameSnapshot },
        { label: "Tenant Snapshot Email", value: lease.tenantEmailSnapshot },
        { label: "Tenant Snapshot Phone", value: lease.tenantPhoneSnapshot },
        { label: "Owner Snapshot", value: lease.ownerNameSnapshot },
        { label: "Landlord Snapshot", value: lease.landlordNameSnapshot },
    ].filter((item) => hasValue(item.value));

    const propertySnapshotItems = [
        { label: "Building Snapshot", value: lease.buildingNameSnapshot },
        { label: "Property Usage", value: lease.propertyUsage },
        { label: "Community", value: lease.locationCommunity },
        { label: "Property Type", value: lease.propertyTypeLabel },
        { label: "Property Number", value: lease.propertyNumber },
        { label: "Property Size (sqm)", value: lease.propertySizeSqm },
        { label: "Premises No Dewa", value: lease.premisesNoDewa },
        { label: "Plot No", value: lease.plotNo },
    ].filter((item) => hasValue(item.value));

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
                            Contract - Unit {lease.unit?.label || lease.unitId}
                        </h1>
                        <p className="text-sm text-zinc-500">
                            {residentDisplayName || residentDisplayEmail || lease.residentUserId || "Unknown Resident"}
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
                            Edit Contract
                        </Button>
                    )}
                    <Badge
                        variant="secondary"
                        className={getLeaseStatusBadgeClassName(leaseDisplayStatus)}
                    >
                        {formatLeaseDisplayStatus(leaseDisplayStatus)}
                    </Badge>
                </div>
            </div>

            {leaseContextReadOnlyReason ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {leaseContextReadOnlyReason}
                </div>
            ) : null}

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "details" | "history")} className="space-y-6">
                <TabsList>
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-6">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                        <h2 className="mb-4 text-sm font-semibold text-zinc-900">Contract Details</h2>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                                <div className="text-xs uppercase tracking-wide text-zinc-400">Contract Date</div>
                                <div className="text-sm font-medium text-zinc-900">{lease.contractDate ? formatDate(lease.contractDate) : "Not provided"}</div>
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wide text-zinc-400">Contract Period</div>
                                <div className="text-sm font-medium text-zinc-900">{`${formatDate(lease.leaseStartDate)} - ${formatDate(lease.leaseEndDate)}`}</div>
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
                            {lease.ijariId && (
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Ijari ID</div>
                                    <div className="text-sm font-medium text-zinc-900">{lease.ijariId}</div>
                                </div>
                            )}
                            {lease.tenancyRegistrationExpiry && (
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Ejari Expiry Date</div>
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
                            {lease.contractValue && (
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Contract Value</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatMoney(lease.contractValue)}</div>
                                </div>
                            )}
                            {lease.paymentModeText && (
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Payment Mode Text</div>
                                    <div className="text-sm font-medium text-zinc-900">{lease.paymentModeText}</div>
                                </div>
                            )}
                            {lease.serviceChargesPaidBy && (
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Service Charges Paid By</div>
                                    <div className="text-sm font-medium text-zinc-900">{lease.serviceChargesPaidBy}</div>
                                </div>
                            )}
                            {lease.internetTvProvider && (
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Internet / TV Provider</div>
                                    <div className="text-sm font-medium text-zinc-900">{lease.internetTvProvider}</div>
                                </div>
                            )}
                            {lease.firstPaymentReceived && (
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">First Payment Received</div>
                                    <div className="text-sm font-medium text-zinc-900">{lease.firstPaymentReceived}</div>
                                </div>
                            )}
                            {lease.firstPaymentAmount && (
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">First Payment Amount</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatMoney(lease.firstPaymentAmount)}</div>
                                </div>
                            )}
                            {lease.depositReceived && (
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Deposit Received</div>
                                    <div className="text-sm font-medium text-zinc-900">{lease.depositReceived}</div>
                                </div>
                            )}
                            {lease.depositReceivedAmount && (
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Deposit Received Amount</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatMoney(lease.depositReceivedAmount)}</div>
                                </div>
                            )}
                            {lease.vatApplicable !== undefined && lease.vatApplicable !== null && (
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">VAT Applicable</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatBooleanValue(lease.vatApplicable)}</div>
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
                                    {residentDisplayName}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wide text-zinc-400">Email</div>
                                <div className="text-sm font-medium text-zinc-900">
                                    {residentDisplayEmail}
                                </div>
                            </div>
                        </div>
                    </div>

                    {residentSnapshotItems.length > 0 && (
                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                            <h2 className="mb-4 text-sm font-semibold text-zinc-900">Contract Snapshots</h2>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {residentSnapshotItems.map((item) => (
                                    <div key={item.label}>
                                        <div className="text-xs uppercase tracking-wide text-zinc-400">{item.label}</div>
                                        <div className="text-sm font-medium text-zinc-900">{item.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

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

                    {(propertySnapshotItems.length > 0 || (lease.additionalTerms?.length ?? 0) > 0) && (
                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                            <h2 className="mb-4 text-sm font-semibold text-zinc-900">Property And Registration</h2>
                            {propertySnapshotItems.length > 0 && (
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                    {propertySnapshotItems.map((item) => (
                                        <div key={item.label}>
                                            <div className="text-xs uppercase tracking-wide text-zinc-400">{item.label}</div>
                                            <div className="text-sm font-medium text-zinc-900">{item.value}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {(lease.additionalTerms?.length ?? 0) > 0 && (
                                <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Additional Terms</div>
                                    <div className="mt-2 space-y-1 text-sm text-zinc-700">
                                        {lease.additionalTerms?.map((term, index) => (
                                            <div key={`${index}-${term}`}>{term}</div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {canReadParkingAllocations && (
                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                <h2 className="text-sm font-semibold text-zinc-900">Parking Allocations</h2>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setAllocateDialogOpen(true)}
                                        disabled={!canCreateParkingAllocations || !isLeaseContextEditable}
                                    >
                                        Allocate parking
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setManageDialogOpen(true)}
                                        disabled={!canEndParkingAllocations || !isLeaseContextEditable}
                                    >
                                        Manage allocations
                                    </Button>
                                </div>
                            </div>
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
                    )}

                    {canReadVehicles && (
                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                            <div className="mb-4">
                                <h2 className="text-sm font-semibold text-zinc-900">Vehicles</h2>
                                {!canEditVehicles ? (
                                    <p className="text-xs text-zinc-500 mt-1">
                                        You have read access only. Vehicle updates require full vehicle permissions.
                                    </p>
                                ) : null}
                            </div>
                            <OccupancyVehicles
                                occupancyId={resolvedOccupancyId}
                                leaseId={lease.id}
                                readOnly={!isLeaseContextEditable || !canEditVehicles}
                                noOccupancyMessage="No occupancy context found for this contract."
                                onLeaseContextBlocked={handleLeaseContextBlocked}
                            />
                        </div>
                    )}

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
                            You do not have access to view contract timeline.
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {canReadParkingAllocations && hasLeaseContext ? (
                <AllocateParkingDialog
                    open={allocateDialogOpen}
                    onOpenChange={setAllocateDialogOpen}
                    buildingId={lease.buildingId}
                    leaseId={lease.id}
                    preSelectedOccupancyId={resolvedOccupancyId}
                    occupancies={occupancyOptions}
                    readOnly={!isLeaseContextEditable}
                    onLeaseContextBlocked={handleLeaseContextBlocked}
                />
            ) : null}

            {canReadParkingAllocations && hasLeaseContext ? (
                <ManageAllocationsDialog
                    open={manageDialogOpen}
                    onOpenChange={setManageDialogOpen}
                    occupancyId={resolvedOccupancyId}
                    buildingId={lease.buildingId}
                    leaseId={lease.id}
                    occupancyLabel={lease.unit?.label || lease.unitId}
                    readOnly={!isLeaseContextEditable}
                    onLeaseContextBlocked={handleLeaseContextBlocked}
                />
            ) : null}

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
