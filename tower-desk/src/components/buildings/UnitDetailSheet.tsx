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
    if (value === null || value === undefined || value === "") return "N/A";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
};

const formatMoney = (value?: number | null) => {
    if (value === null || value === undefined) return "N/A";
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
            width="w-full sm:w-[720px] lg:w-[920px]"
        >
            <div className="px-2 sm:px-4">
                {isLoading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                    </div>
                ) : unit ? (
                    <div className="space-y-6">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-wrap items-center gap-3">
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
                        <div className="mt-4 grid gap-4 sm:grid-cols-3">
                            <div>
                                <div className="text-xs uppercase tracking-wide text-zinc-400">Type</div>
                                <div className="text-sm font-semibold text-zinc-900">{formatValue(unitTypeName || unit.unitTypeId)}</div>
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wide text-zinc-400">Floor</div>
                                <div className="text-sm font-semibold text-zinc-900">{formatValue(unit.floor)}</div>
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wide text-zinc-400">Size</div>
                                <div className="text-sm font-semibold text-zinc-900">
                                    {formatValue(unit.unitSize)}
                                    {unit.unitSizeUnit ? ` ${unitSizeUnitLabels[unit.unitSizeUnit] || unit.unitSizeUnit}` : ""}
                                </div>
                            </div>
                        </div>
                        {unit.notes ? (
                            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                                <span className="text-xs uppercase tracking-wide text-zinc-400">Notes</span>
                                <div className="mt-1 text-sm text-zinc-700">{unit.notes}</div>
                            </div>
                        ) : null}
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                            <div className="mb-4">
                                <h3 className="text-sm font-semibold text-zinc-900">Unit Specs</h3>
                                <p className="text-xs text-zinc-400">Layout and finishes.</p>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Beds</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(unit.bedrooms)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Baths</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(unit.bathrooms)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Kitchen</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(unit.kitchenType)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Furnished</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(unit.furnishedStatus)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Balcony</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(unit.balcony)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Maintenance</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(unit.maintenancePayer)}</div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                            <div className="mb-4">
                                <h3 className="text-sm font-semibold text-zinc-900">Financials</h3>
                                <p className="text-xs text-zinc-400">Rental terms and charges.</p>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Annual Rent</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatMoney(unit.rentAnnual)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Payment Frequency</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(unit.paymentFrequency)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Security Deposit</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatMoney(unit.securityDepositAmount)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Service Charge</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatMoney(unit.serviceChargePerUnit)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">VAT Applicable</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(unit.vatApplicable)}</div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                            <div className="mb-4">
                                <h3 className="text-sm font-semibold text-zinc-900">Ownership</h3>
                                <p className="text-xs text-zinc-400">Primary owner details.</p>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Owner</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(owner?.name || unit.ownerId)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Email</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(owner?.email)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Phone</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(owner?.phone)}</div>
                                </div>
                                <div className="sm:col-span-2">
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Address</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(owner?.address)}</div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                            <div className="mb-4">
                                <h3 className="text-sm font-semibold text-zinc-900">Utilities</h3>
                                <p className="text-xs text-zinc-400">Meter tracking.</p>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Electricity</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(unit.electricityMeterNumber)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Water</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(unit.waterMeterNumber)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Gas</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(unit.gasMeterNumber)}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                        <div className="mb-4">
                            <h3 className="text-sm font-semibold text-zinc-900">Amenities</h3>
                            <p className="text-xs text-zinc-400">Assigned amenities for this unit.</p>
                        </div>
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
            </div>
        </SlideOver>
    );
}
