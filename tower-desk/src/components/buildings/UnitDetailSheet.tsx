"use client";

import { SlideOver } from "@/components/common/SlideOver";
import { useBuildingUnit, useOwners, useUnitTypes } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface UnitDetailSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    buildingId: string;
    unitId: string | null;
}

const formatValue = (value?: string | number | boolean | null) => {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
};

const formatMoney = (value?: number | null) => {
    if (value === null || value === undefined) return "—";
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
};

const unitSizeUnitLabels: Record<string, string> = {
    SQ_FT: "sq ft",
    SQ_M: "sq m",
};

export function UnitDetailSheet({ open, onOpenChange, buildingId, unitId }: UnitDetailSheetProps) {
    const isEnabled = open && Boolean(unitId);
    const { data: unit, isLoading } = useBuildingUnit(buildingId, unitId || "", { enabled: isEnabled });
    const { data: unitTypes } = useUnitTypes({ enabled: isEnabled });
    const { data: owners } = useOwners({ enabled: isEnabled });

    const unitTypeName = unit?.unitTypeId
        ? unitTypes?.find((type) => type.id === unit.unitTypeId)?.name
        : undefined;
    const owner = unit?.ownerId ? owners?.find((entry) => entry.id === unit.ownerId) : undefined;

    return (
        <SlideOver
            open={open}
            onOpenChange={onOpenChange}
            title={unit?.label ? `Unit ${unit.label}` : "Unit Details"}
            description="Review unit details and specifications."
        >
            {isLoading ? (
                <div className="space-y-4">
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                </div>
            ) : unit ? (
                <div className="space-y-6">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">
                            {unit.label}
                        </Badge>
                        {unit.isAvailable !== undefined ? (
                            <Badge
                                variant="secondary"
                                className={unit.isAvailable ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}
                            >
                                {unit.isAvailable ? "Vacant" : "Occupied"}
                            </Badge>
                        ) : null}
                    </div>

                    <div className="space-y-2">
                        <div className="text-sm font-semibold text-zinc-900">Unit Specs</div>
                        <div className="grid gap-3 text-sm text-zinc-600 md:grid-cols-2">
                            <div>Type: {formatValue(unitTypeName || unit.unitTypeId)}</div>
                            <div>
                                Size: {formatValue(unit.unitSize)}
                                {unit.unitSizeUnit ? ` ${unitSizeUnitLabels[unit.unitSizeUnit] || unit.unitSizeUnit}` : ""}
                            </div>
                            <div>Beds: {formatValue(unit.bedrooms)}</div>
                            <div>Baths: {formatValue(unit.bathrooms)}</div>
                            <div>Kitchen: {formatValue(unit.kitchenType)}</div>
                            <div>Furnished: {formatValue(unit.furnishedStatus)}</div>
                            <div>Balcony: {formatValue(unit.balcony)}</div>
                            <div>Floor: {formatValue(unit.floor)}</div>
                        </div>
                        {unit.notes ? <div className="text-xs text-zinc-500">Notes: {unit.notes}</div> : null}
                    </div>

                    <div className="space-y-2">
                        <div className="text-sm font-semibold text-zinc-900">Financials</div>
                        <div className="grid gap-3 text-sm text-zinc-600 md:grid-cols-2">
                            <div>Annual Rent: {formatMoney(unit.rentAnnual)}</div>
                            <div>Payment Frequency: {formatValue(unit.paymentFrequency)}</div>
                            <div>Security Deposit: {formatMoney(unit.securityDepositAmount)}</div>
                            <div>Service Charge: {formatMoney(unit.serviceChargePerUnit)}</div>
                            <div>VAT Applicable: {formatValue(unit.vatApplicable)}</div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="text-sm font-semibold text-zinc-900">Ownership</div>
                        <div className="grid gap-3 text-sm text-zinc-600 md:grid-cols-2">
                            <div>Owner: {formatValue(owner?.name || unit.ownerId)}</div>
                            <div>Maintenance Payer: {formatValue(unit.maintenancePayer)}</div>
                            <div>Email: {formatValue(owner?.email)}</div>
                            <div>Phone: {formatValue(owner?.phone)}</div>
                            <div className="md:col-span-2">Address: {formatValue(owner?.address)}</div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="text-sm font-semibold text-zinc-900">Utilities</div>
                        <div className="grid gap-3 text-sm text-zinc-600 md:grid-cols-2">
                            <div>Electricity: {formatValue(unit.electricityMeterNumber)}</div>
                            <div>Water: {formatValue(unit.waterMeterNumber)}</div>
                            <div>Gas: {formatValue(unit.gasMeterNumber)}</div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="text-sm font-semibold text-zinc-900">Amenities</div>
                        {unit.amenities && unit.amenities.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {unit.amenities.map((amenity) => (
                                    <Badge key={amenity.id} variant="secondary" className="bg-zinc-100 text-zinc-700">
                                        {amenity.name || amenity.id}
                                    </Badge>
                                ))}
                            </div>
                        ) : unit.amenityIds && unit.amenityIds.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {unit.amenityIds.map((amenityId) => (
                                    <Badge key={amenityId} variant="secondary" className="bg-zinc-100 text-zinc-700">
                                        {amenityId}
                                    </Badge>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-zinc-500">No amenities assigned.</div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="text-sm text-zinc-500">Unit details unavailable.</div>
            )}
        </SlideOver>
    );
}
