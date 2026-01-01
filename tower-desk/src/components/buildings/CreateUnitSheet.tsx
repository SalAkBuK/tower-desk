"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { SlideOver } from "@/components/common/SlideOver";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBuildingAmenities, useCreateBuildingUnit, useCreateOwner, useCreateUnitType, useOwners, useUnitTypes } from "@/lib/queries";
import type { FurnishedStatus, KitchenType, MaintenancePayer, PaymentFrequency, UnitSizeUnit } from "@/lib/types";
import { toast } from "sonner";
import { useEffect, useState } from "react";

const maintenancePayerOptions = ["OWNER", "TENANT"] as const;
const unitSizeUnitOptions = ["SQ_FT", "SQ_M"] as const;
const kitchenTypeOptions = ["OPEN", "CLOSED"] as const;
const furnishedStatusOptions = ["UNFURNISHED", "SEMI_FURNISHED", "FULLY_FURNISHED"] as const;
const paymentFrequencyOptions = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL"] as const;

const normalizeText = (value?: string) => {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed.length || trimmed.toLowerCase() === "none") {
        return undefined;
    }
    return trimmed;
};

const parseFromOptions = <T extends string>(value: string | undefined, options: readonly T[]): T | undefined => {
    const normalized = normalizeText(value);
    return normalized && options.includes(normalized as T) ? (normalized as T) : undefined;
};

const parseMaintenancePayer = (value?: string): MaintenancePayer | undefined =>
    parseFromOptions<MaintenancePayer>(value, maintenancePayerOptions);

const parseUnitSizeUnit = (value?: string): UnitSizeUnit | undefined =>
    parseFromOptions<UnitSizeUnit>(value, unitSizeUnitOptions);

const parseKitchenType = (value?: string): KitchenType | undefined =>
    parseFromOptions<KitchenType>(value, kitchenTypeOptions);

const parseFurnishedStatus = (value?: string): FurnishedStatus | undefined =>
    parseFromOptions<FurnishedStatus>(value, furnishedStatusOptions);

const parsePaymentFrequency = (value?: string): PaymentFrequency | undefined =>
    parseFromOptions<PaymentFrequency>(value, paymentFrequencyOptions);

const unitSchema = z.object({
    label: z.string().trim().min(1, "Unit label is required"),
    floor: z.number().int().min(1, "Floor must be at least 1").optional(),
    notes: z.string().trim().optional().or(z.literal("")),
    unitTypeId: z.string().trim().optional().or(z.literal("")).or(z.literal("none")),
    ownerId: z.string().trim().optional().or(z.literal("")).or(z.literal("none")),
    maintenancePayer: z.enum(maintenancePayerOptions).optional().or(z.literal("")).or(z.literal("none")),
    unitSize: z.number().min(0, "Unit size must be positive").optional(),
    unitSizeUnit: z.enum(unitSizeUnitOptions).optional().or(z.literal("")).or(z.literal("none")),
    bedrooms: z.number().min(0, "Bedrooms must be 0 or more").optional(),
    bathrooms: z.number().min(0, "Bathrooms must be 0 or more").optional(),
    balcony: z.boolean().optional(),
    kitchenType: z.enum(kitchenTypeOptions).optional().or(z.literal("")).or(z.literal("none")),
    furnishedStatus: z.enum(furnishedStatusOptions).optional().or(z.literal("")).or(z.literal("none")),
    rentAnnual: z.number().min(0, "Annual rent must be positive").optional(),
    paymentFrequency: z.enum(paymentFrequencyOptions).optional().or(z.literal("")).or(z.literal("none")),
    securityDepositAmount: z.number().min(0, "Security deposit must be positive").optional(),
    serviceChargePerUnit: z.number().min(0, "Service charge must be positive").optional(),
    vatApplicable: z.boolean().optional(),
    electricityMeterNumber: z.string().trim().optional().or(z.literal("")),
    waterMeterNumber: z.string().trim().optional().or(z.literal("")),
    gasMeterNumber: z.string().trim().optional().or(z.literal("")),
});

type UnitFormValues = z.infer<typeof unitSchema>;

interface CreateUnitSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    buildingId: string;
}

export function CreateUnitSheet({ open, onOpenChange, buildingId }: CreateUnitSheetProps) {
    const createUnit = useCreateBuildingUnit();
    const { data: unitTypes, isLoading: isUnitTypesLoading } = useUnitTypes({ enabled: open });
    const createUnitType = useCreateUnitType();
    const createOwner = useCreateOwner();
    const { data: owners, isLoading: isOwnersLoading } = useOwners({ enabled: open });
    const { data: amenities, isLoading: isAmenitiesLoading } = useBuildingAmenities(buildingId, { enabled: open });
    const [error, setError] = useState<string | null>(null);
    const [isUnitTypeOpen, setIsUnitTypeOpen] = useState(false);
    const [unitTypeName, setUnitTypeName] = useState("");
    const [unitTypeError, setUnitTypeError] = useState<string | null>(null);
    const [amenityMode, setAmenityMode] = useState<"default" | "custom" | "none">("default");
    const [selectedAmenityIds, setSelectedAmenityIds] = useState<string[]>([]);
    const [isOwnerOpen, setIsOwnerOpen] = useState(false);
    const [ownerName, setOwnerName] = useState("");
    const [ownerEmail, setOwnerEmail] = useState("");
    const [ownerPhone, setOwnerPhone] = useState("");
    const [ownerAddress, setOwnerAddress] = useState("");
    const [ownerError, setOwnerError] = useState<string | null>(null);

    const form = useForm<UnitFormValues>({
        resolver: zodResolver(unitSchema),
        defaultValues: {
            label: "",
            floor: undefined,
            notes: "",
            unitTypeId: "",
            ownerId: "",
            maintenancePayer: "",
            unitSize: undefined,
            unitSizeUnit: "",
            bedrooms: undefined,
            bathrooms: undefined,
            balcony: false,
            kitchenType: "",
            furnishedStatus: "",
            rentAnnual: undefined,
            paymentFrequency: "",
            securityDepositAmount: undefined,
            serviceChargePerUnit: undefined,
            vatApplicable: false,
            electricityMeterNumber: "",
            waterMeterNumber: "",
            gasMeterNumber: "",
        },
    });

    useEffect(() => {
        if (open) {
            setError(null);
            setUnitTypeError(null);
            setUnitTypeName("");
            setAmenityMode("default");
            setSelectedAmenityIds([]);
            setOwnerError(null);
            setOwnerName("");
            setOwnerEmail("");
            setOwnerPhone("");
            setOwnerAddress("");
            form.reset({
                label: "",
                floor: undefined,
                notes: "",
                unitTypeId: "",
                ownerId: "",
                maintenancePayer: "",
                unitSize: undefined,
                unitSizeUnit: "",
                bedrooms: undefined,
                bathrooms: undefined,
                balcony: false,
                kitchenType: "",
                furnishedStatus: "",
                rentAnnual: undefined,
                paymentFrequency: "",
                securityDepositAmount: undefined,
                serviceChargePerUnit: undefined,
                vatApplicable: false,
                electricityMeterNumber: "",
                waterMeterNumber: "",
                gasMeterNumber: "",
            });
        }
    }, [open, form]);

    const onSubmit = async (data: UnitFormValues) => {
        setError(null);
        try {
            await createUnit.mutateAsync({
                buildingId,
                data: {
                    label: data.label.trim(),
                    floor: data.floor,
                    notes: normalizeText(data.notes),
                    unitTypeId: normalizeText(data.unitTypeId),
                    ownerId: normalizeText(data.ownerId),
                    maintenancePayer: parseMaintenancePayer(data.maintenancePayer),
                    unitSize: data.unitSize,
                    unitSizeUnit: parseUnitSizeUnit(data.unitSizeUnit),
                    bedrooms: data.bedrooms,
                    bathrooms: data.bathrooms,
                    balcony: data.balcony,
                    kitchenType: parseKitchenType(data.kitchenType),
                    furnishedStatus: parseFurnishedStatus(data.furnishedStatus),
                    rentAnnual: data.rentAnnual,
                    paymentFrequency: parsePaymentFrequency(data.paymentFrequency),
                    securityDepositAmount: data.securityDepositAmount,
                    serviceChargePerUnit: data.serviceChargePerUnit,
                    vatApplicable: data.vatApplicable,
                    electricityMeterNumber: normalizeText(data.electricityMeterNumber),
                    waterMeterNumber: normalizeText(data.waterMeterNumber),
                    gasMeterNumber: normalizeText(data.gasMeterNumber),
                    amenityIds: amenityMode === "custom"
                        ? selectedAmenityIds
                        : amenityMode === "none"
                            ? []
                            : undefined,
                },
            });
            toast.success("Unit added");
            onOpenChange(false);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to add unit";
            setError(message);
            toast.error(message);
        }
    };

    const handleCreateUnitType = async () => {
        const trimmed = unitTypeName.trim();
        if (!trimmed) {
            setUnitTypeError("Unit type name is required.");
            return;
        }
        setUnitTypeError(null);
        try {
            const created = await createUnitType.mutateAsync({ name: trimmed, isActive: true });
            toast.success("Unit type created");
            form.setValue("unitTypeId", created.id);
            setIsUnitTypeOpen(false);
            setUnitTypeName("");
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to create unit type";
            setUnitTypeError(message);
            toast.error(message);
        }
    };

    const handleCreateOwner = async () => {
        const trimmed = ownerName.trim();
        if (!trimmed) {
            setOwnerError("Owner name is required.");
            return;
        }
        setOwnerError(null);
        try {
            const created = await createOwner.mutateAsync({
                name: trimmed,
                email: ownerEmail.trim() || undefined,
                phone: ownerPhone.trim() || undefined,
                address: ownerAddress.trim() || undefined
            });
            toast.success("Owner created");
            form.setValue("ownerId", created.id);
            setIsOwnerOpen(false);
            setOwnerName("");
            setOwnerEmail("");
            setOwnerPhone("");
            setOwnerAddress("");
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to create owner";
            setOwnerError(message);
            toast.error(message);
        }
    };

    return (
        <SlideOver
            open={open}
            onOpenChange={onOpenChange}
            title="Add Unit"
            description="Create a new unit for this building."
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-1">
                    <FormField
                        control={form.control}
                        name="label"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Unit Label</FormLabel>
                                <FormControl>
                                    <Input placeholder="101" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="floor"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Floor (Optional)</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        {...field}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            field.onChange(value === "" ? undefined : Number(value));
                                        }}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="unitTypeId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Unit Type (Optional)</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder={isUnitTypesLoading ? "Loading unit types..." : "Select a unit type"} />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        {(unitTypes || []).map((type) => (
                                            <SelectItem key={type.id} value={type.id}>
                                                {type.name || type.id}
                                            </SelectItem>
                                        ))}
                                        {(!unitTypes || unitTypes.length === 0) && !isUnitTypesLoading ? (
                                            <SelectItem value="none" disabled>
                                                No unit types found
                                            </SelectItem>
                                        ) : null}
                                    </SelectContent>
                                </Select>
                                <div className="pt-2">
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setIsUnitTypeOpen(true)}>
                                        + Add unit type
                                    </Button>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="ownerId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Owner (Optional)</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder={isOwnersLoading ? "Loading owners..." : "Select an owner"} />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        {(owners || []).map((owner) => (
                                            <SelectItem key={owner.id} value={owner.id}>
                                                {owner.name || owner.email || owner.id}
                                            </SelectItem>
                                        ))}
                                        {(!owners || owners.length === 0) && !isOwnersLoading ? (
                                            <SelectItem value="none" disabled>
                                                No owners found
                                            </SelectItem>
                                        ) : null}
                                    </SelectContent>
                                </Select>
                                <div className="pt-2">
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setIsOwnerOpen(true)}>
                                        + Add owner
                                    </Button>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Notes (Optional)</FormLabel>
                                <FormControl>
                                    <Input placeholder="Corner unit" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="maintenancePayer"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Maintenance Payer (Optional)</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select payer" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">None</SelectItem>
                                            {maintenancePayerOptions.map((option) => (
                                                <SelectItem key={option} value={option}>
                                                    {option}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="unitSize"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Unit Size (Optional)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            {...field}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                field.onChange(value === "" ? undefined : Number(value));
                                            }}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="unitSizeUnit"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Unit Size Unit (Optional)</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select unit" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">None</SelectItem>
                                            {unitSizeUnitOptions.map((option) => (
                                                <SelectItem key={option} value={option}>
                                                    {option}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="kitchenType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Kitchen Type (Optional)</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">None</SelectItem>
                                            {kitchenTypeOptions.map((option) => (
                                                <SelectItem key={option} value={option}>
                                                    {option}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="bedrooms"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Bedrooms (Optional)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            {...field}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                field.onChange(value === "" ? undefined : Number(value));
                                            }}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="bathrooms"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Bathrooms (Optional)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            {...field}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                field.onChange(value === "" ? undefined : Number(value));
                                            }}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="furnishedStatus"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Furnished Status (Optional)</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select status" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">None</SelectItem>
                                            {furnishedStatusOptions.map((option) => (
                                                <SelectItem key={option} value={option}>
                                                    {option}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="paymentFrequency"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Payment Frequency (Optional)</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select frequency" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">None</SelectItem>
                                            {paymentFrequencyOptions.map((option) => (
                                                <SelectItem key={option} value={option}>
                                                    {option}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="rentAnnual"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Annual Rent (Optional)</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        {...field}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            field.onChange(value === "" ? undefined : Number(value));
                                            }}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="securityDepositAmount"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Security Deposit (Optional)</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        {...field}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            field.onChange(value === "" ? undefined : Number(value));
                                            }}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <FormField
                        control={form.control}
                        name="serviceChargePerUnit"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Service Charge Per Unit (Optional)</FormLabel>
                            <FormControl>
                                <Input
                                    type="number"
                                    step="0.01"
                                    {...field}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        field.onChange(value === "" ? undefined : Number(value));
                                        }}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="electricityMeterNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Electricity Meter (Optional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="ELEC-123" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="waterMeterNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Water Meter (Optional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="WATER-456" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <FormField
                        control={form.control}
                        name="gasMeterNumber"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Gas Meter (Optional)</FormLabel>
                                <FormControl>
                                    <Input placeholder="GAS-789" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="balcony"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Balcony (Optional)</FormLabel>
                                    <FormControl>
                                        <input
                                            type="checkbox"
                                            checked={!!field.value}
                                            onChange={(e) => field.onChange(e.target.checked)}
                                            className="h-4 w-4 rounded border border-zinc-300"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="vatApplicable"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>VAT Applicable (Optional)</FormLabel>
                                    <FormControl>
                                        <input
                                            type="checkbox"
                                            checked={!!field.value}
                                            onChange={(e) => field.onChange(e.target.checked)}
                                            className="h-4 w-4 rounded border border-zinc-300"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="text-sm font-semibold text-zinc-900">Amenities</div>
                        <div className="flex flex-wrap gap-4 text-sm text-zinc-600">
                            <label className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    name="amenityMode"
                                    value="default"
                                    checked={amenityMode === "default"}
                                    onChange={() => setAmenityMode("default")}
                                />
                                Use defaults
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    name="amenityMode"
                                    value="custom"
                                    checked={amenityMode === "custom"}
                                    onChange={() => setAmenityMode("custom")}
                                />
                                Select amenities
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    name="amenityMode"
                                    value="none"
                                    checked={amenityMode === "none"}
                                    onChange={() => setAmenityMode("none")}
                                />
                                None
                            </label>
                        </div>
                        {amenityMode === "custom" ? (
                            <div className="grid gap-2 rounded-lg border border-zinc-200 p-3">
                                {isAmenitiesLoading ? (
                                    <div className="text-xs text-zinc-500">Loading amenities...</div>
                                ) : amenities && amenities.length > 0 ? (
                                    amenities.map((amenity) => (
                                        <label key={amenity.id} className="flex items-center gap-2 text-sm text-zinc-700">
                                            <input
                                                type="checkbox"
                                                checked={selectedAmenityIds.includes(amenity.id)}
                                                onChange={(event) => {
                                                    const next = event.target.checked
                                                        ? [...selectedAmenityIds, amenity.id]
                                                        : selectedAmenityIds.filter((id) => id !== amenity.id);
                                                    setSelectedAmenityIds(next);
                                                }}
                                            />
                                            {amenity.name || amenity.id}
                                            {amenity.isDefault ? (
                                                <span className="text-[10px] uppercase text-zinc-400">default</span>
                                            ) : null}
                                        </label>
                                    ))
                                ) : (
                                    <div className="text-xs text-zinc-500">No amenities found.</div>
                                )}
                            </div>
                        ) : null}
                    </div>

                    {error ? (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                            {error}
                        </div>
                    ) : null}

                    <div className="pt-4 flex justify-end gap-2">
                        <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={createUnit.isPending}>
                            {createUnit.isPending ? "Adding..." : "Add Unit"}
                        </Button>
                    </div>
                </form>
            </Form>
            <Dialog open={isUnitTypeOpen} onOpenChange={setIsUnitTypeOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Unit Type</DialogTitle>
                        <DialogDescription>Use this to create a new unit type for your organization.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-900">Unit Type Name</label>
                        <Input
                            value={unitTypeName}
                            onChange={(event) => setUnitTypeName(event.target.value)}
                            placeholder="Studio"
                        />
                        {unitTypeError ? (
                            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                                {unitTypeError}
                            </div>
                        ) : null}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsUnitTypeOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={handleCreateUnitType} disabled={createUnitType.isPending}>
                            {createUnitType.isPending ? "Creating..." : "Create Unit Type"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isOwnerOpen} onOpenChange={setIsOwnerOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Owner</DialogTitle>
                        <DialogDescription>Create a new owner for your organization.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-900">Owner Name</label>
                            <Input
                                value={ownerName}
                                onChange={(event) => setOwnerName(event.target.value)}
                                placeholder="Owner name"
                            />
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-900">Email (Optional)</label>
                                <Input
                                    type="email"
                                    value={ownerEmail}
                                    onChange={(event) => setOwnerEmail(event.target.value)}
                                    placeholder="owner@email.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-900">Phone (Optional)</label>
                                <Input
                                    value={ownerPhone}
                                    onChange={(event) => setOwnerPhone(event.target.value)}
                                    placeholder="+971-..."
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-900">Address (Optional)</label>
                            <Input
                                value={ownerAddress}
                                onChange={(event) => setOwnerAddress(event.target.value)}
                                placeholder="Owner address"
                            />
                        </div>
                        {ownerError ? (
                            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                                {ownerError}
                            </div>
                        ) : null}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsOwnerOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={handleCreateOwner} disabled={createOwner.isPending}>
                            {createOwner.isPending ? "Creating..." : "Create Owner"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </SlideOver>
    );
}
