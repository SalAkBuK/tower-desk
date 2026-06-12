"use client";

import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    ContractDisclosureSection,
    ContractModalSection,
    ContractSummaryCard,
    useDeferredDialogReady,
} from "@/components/leases/ContractModalPrimitives";
import { useUpdateLease } from "@/lib/queries";
import type { Lease, PaymentFrequency, ServiceChargesPaidBy, UpdateLeaseDto, YesNo } from "@/lib/types";

interface EditLeaseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    lease: Lease;
    onCompleted?: () => void;
}

const paymentFrequencyOptions: Array<{ value: PaymentFrequency; label: string }> = [
    { value: "MONTHLY", label: "Monthly" },
    { value: "QUARTERLY", label: "Quarterly" },
    { value: "SEMI_ANNUAL", label: "Semi-Annual" },
    { value: "ANNUAL", label: "Annual" },
];

const nonNegativeNumberRegex = /^\d+(\.\d+)?$/;

const toDateInputValue = (value?: string | null) => {
    if (!value) return "";
    if (value.includes("T")) return value.slice(0, 10);
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString().slice(0, 10);
};

const toIsoDateTime = (value: string) => `${value}T00:00:00.000Z`;
const trimValue = (value?: string | null) => value?.trim() ?? "";
const buildSummaryMeta = (...values: Array<string | null | undefined>) =>
    Array.from(new Set(values.map((value) => trimValue(value)).filter(Boolean)));

const editLeaseSchema = z.object({
    contractPeriodFrom: z.string().min(1, "Contract period start is required"),
    contractPeriodTo: z.string().min(1, "Contract period end is required"),
    annualRent: z.string().min(1, "Annual rent is required"),
    paymentFrequency: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]),
    numberOfCheques: z.string().optional(),
    securityDepositAmount: z.string().optional(),
    contractDate: z.string().optional(),
    contractValue: z.string().optional(),
    paymentModeText: z.string().optional(),
    ijariId: z.string().optional(),
    propertyUsage: z.string().optional(),
    ownerNameSnapshot: z.string().optional(),
    landlordNameSnapshot: z.string().optional(),
    tenantNameSnapshot: z.string().optional(),
    tenantEmailSnapshot: z.string().optional(),
    tenantPhoneSnapshot: z.string().optional(),
    locationCommunity: z.string().optional(),
    propertySizeSqm: z.string().optional(),
    propertyTypeLabel: z.string().optional(),
    propertyNumber: z.string().optional(),
    premisesNoDewa: z.string().optional(),
    plotNo: z.string().optional(),
    additionalTermsText: z.string().optional(),
    tenancyRegistrationExpiry: z.string().optional(),
    noticeGivenDate: z.string().optional(),
    firstPaymentAmount: z.string().optional(),
    depositReceivedAmount: z.string().optional(),
    internetTvProvider: z.string().optional(),
    notes: z.string().optional(),
    serviceChargesPaidBy: z.enum(["", "OWNER", "TENANT"]),
    vatApplicable: z.enum(["", "true", "false"]),
    firstPaymentReceived: z.enum(["", "YES", "NO"]),
    depositReceived: z.enum(["", "YES", "NO"]),
}).superRefine((data, ctx) => {
    if (!nonNegativeNumberRegex.test(data.annualRent.trim())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["annualRent"], message: "Annual rent must be a non-negative number" });
    }

    const from = new Date(`${data.contractPeriodFrom}T00:00:00.000Z`);
    const to = new Date(`${data.contractPeriodTo}T23:59:59.000Z`);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to <= from) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["contractPeriodTo"], message: "Contract end must be after contract start" });
    }

    const numberOfCheques = data.numberOfCheques?.trim();
    if (numberOfCheques) {
        const parsed = Number(numberOfCheques);
        if (!Number.isInteger(parsed) || parsed < 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["numberOfCheques"], message: "Number of cheques must be a non-negative whole number" });
        }
    }

    ([
        ["securityDepositAmount", "Security deposit"],
        ["contractValue", "Contract value"],
        ["firstPaymentAmount", "First payment amount"],
        ["depositReceivedAmount", "Deposit received amount"],
    ] as const).forEach(([field, label]) => {
        const value = data[field]?.trim();
        if (value && !nonNegativeNumberRegex.test(value)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: `${label} must be a non-negative number` });
        }
    });
});

type EditLeaseFormValues = z.infer<typeof editLeaseSchema>;

const toErrorStatus = (error: unknown): number | undefined => {
    if (typeof error !== "object" || !error) return undefined;
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
};

function FieldError({ message }: { message?: string }) {
    return message ? <p className="text-xs text-rose-500">{message}</p> : null;
}

function EditLeaseDialogLoadingState() {
    return (
        <div className="space-y-5">
            <div className="rounded-[24px] border border-zinc-200/80 bg-white p-5 shadow-[0_18px_40px_-32px_rgba(24,24,27,0.35)]">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="mt-3 h-4 w-72 max-w-full" />
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <Skeleton className="h-28 rounded-[20px]" />
                    <Skeleton className="h-28 rounded-[20px]" />
                </div>
            </div>
            <div className="rounded-[24px] border border-zinc-200/80 bg-white p-5 shadow-[0_18px_40px_-32px_rgba(24,24,27,0.35)]">
                <Skeleton className="h-6 w-44" />
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <Skeleton className="h-20 rounded-xl" />
                    <Skeleton className="h-20 rounded-xl" />
                    <Skeleton className="h-20 rounded-xl" />
                </div>
            </div>
        </div>
    );
}

export function EditLeaseDialog({ open, onOpenChange, lease, onCompleted }: EditLeaseDialogProps) {
    const updateLeaseMutation = useUpdateLease();
    const bodyReady = useDeferredDialogReady(open);

    const initialValues = useMemo<EditLeaseFormValues>(() => ({
        contractPeriodFrom: toDateInputValue(lease.contractPeriodFrom ?? lease.leaseStartDate),
        contractPeriodTo: toDateInputValue(lease.contractPeriodTo ?? lease.leaseEndDate),
        annualRent: lease.annualRent ?? "",
        paymentFrequency: lease.paymentFrequency ?? "QUARTERLY",
        numberOfCheques: lease.numberOfCheques != null ? String(lease.numberOfCheques) : "",
        securityDepositAmount: lease.securityDepositAmount ?? "",
        contractDate: toDateInputValue(lease.contractDate),
        contractValue: lease.contractValue ?? "",
        paymentModeText: lease.paymentModeText ?? "",
        ijariId: lease.ijariId ?? "",
        propertyUsage: lease.propertyUsage ?? "",
        ownerNameSnapshot: lease.ownerNameSnapshot ?? "",
        landlordNameSnapshot: lease.landlordNameSnapshot ?? "",
        tenantNameSnapshot: lease.tenantNameSnapshot ?? lease.resident?.name ?? "",
        tenantEmailSnapshot: lease.tenantEmailSnapshot ?? lease.resident?.email ?? "",
        tenantPhoneSnapshot: lease.tenantPhoneSnapshot ?? "",
        locationCommunity: lease.locationCommunity ?? "",
        propertySizeSqm: lease.propertySizeSqm ?? "",
        propertyTypeLabel: lease.propertyTypeLabel ?? "",
        propertyNumber: lease.propertyNumber ?? "",
        premisesNoDewa: lease.premisesNoDewa ?? "",
        plotNo: lease.plotNo ?? "",
        additionalTermsText: lease.additionalTerms?.join("\n") ?? "",
        tenancyRegistrationExpiry: toDateInputValue(lease.tenancyRegistrationExpiry),
        noticeGivenDate: toDateInputValue(lease.noticeGivenDate),
        firstPaymentAmount: lease.firstPaymentAmount ?? "",
        depositReceivedAmount: lease.depositReceivedAmount ?? "",
        internetTvProvider: lease.internetTvProvider ?? "",
        notes: lease.notes ?? "",
        serviceChargesPaidBy: (lease.serviceChargesPaidBy ?? "") as "" | ServiceChargesPaidBy,
        vatApplicable: lease.vatApplicable === true ? "true" : lease.vatApplicable === false ? "false" : "",
        firstPaymentReceived: (lease.firstPaymentReceived ?? "") as "" | YesNo,
        depositReceived: (lease.depositReceived ?? "") as "" | YesNo,
    }), [lease]);

    const form = useForm<EditLeaseFormValues>({
        resolver: zodResolver(editLeaseSchema),
        defaultValues: initialValues,
    });

    const paymentFrequencyValue = useWatch({ control: form.control, name: "paymentFrequency" });
    const serviceChargesPaidByValue = useWatch({ control: form.control, name: "serviceChargesPaidBy" });
    const vatApplicableValue = useWatch({ control: form.control, name: "vatApplicable" });
    const firstPaymentReceivedValue = useWatch({ control: form.control, name: "firstPaymentReceived" });
    const depositReceivedValue = useWatch({ control: form.control, name: "depositReceived" });

    useEffect(() => {
        if (!open || !bodyReady) return;
        form.reset(initialValues);
    }, [bodyReady, open, form, initialValues]);

    const residentLabel = lease.resident?.name || lease.tenantNameSnapshot || lease.resident?.email || "Resident linked";
    const unitLabel = lease.unit?.label
        ? `Unit ${lease.unit.label}`
        : trimValue(lease.propertyNumber)
            ? `Unit ${trimValue(lease.propertyNumber)}`
            : "Assigned unit";
    const residentSummaryMeta = buildSummaryMeta(
        lease.resident?.email,
        lease.tenantEmailSnapshot,
        lease.tenantPhoneSnapshot
    );
    const unitSummaryMeta = buildSummaryMeta(
        lease.buildingNameSnapshot,
        lease.unit?.floor != null ? `Floor ${lease.unit.floor}` : null,
        lease.locationCommunity,
        lease.propertyTypeLabel
    );

    const onSubmit = async (values: EditLeaseFormValues) => {
        const patch: UpdateLeaseDto = {};

        const setRequiredDecimalField = (key: "annualRent", label: string) => {
            const currentValue = trimValue(values[key]);
            const initialValue = trimValue(initialValues[key]);
            if (currentValue === initialValue) return true;
            if (!currentValue) {
                form.setError(key, { type: "manual", message: `${label} is required` });
                return false;
            }
            patch[key] = currentValue;
            return true;
        };

        const setOptionalDecimalField = (key: "securityDepositAmount" | "contractValue" | "firstPaymentAmount" | "depositReceivedAmount", label: string) => {
            const currentValue = trimValue(values[key]);
            const initialValue = trimValue(initialValues[key]);
            if (currentValue === initialValue) return true;
            if (!currentValue) {
                if (initialValue) {
                    form.setError(key, { type: "manual", message: `${label} cannot be empty` });
                    return false;
                }
                return true;
            }
            patch[key] = currentValue;
            return true;
        };

        const setNullableTextField = (key: "ijariId" | "propertyUsage" | "ownerNameSnapshot" | "landlordNameSnapshot" | "tenantNameSnapshot" | "tenantEmailSnapshot" | "tenantPhoneSnapshot" | "locationCommunity" | "propertySizeSqm" | "propertyTypeLabel" | "propertyNumber" | "premisesNoDewa" | "plotNo" | "internetTvProvider" | "notes") => {
            const currentValue = trimValue(values[key]);
            const initialValue = trimValue(initialValues[key]);
            if (currentValue !== initialValue) patch[key] = currentValue || null;
        };

        const setOptionalTextField = (key: "paymentModeText") => {
            const currentValue = trimValue(values[key]);
            const initialValue = trimValue(initialValues[key]);
            if (currentValue !== initialValue) patch[key] = currentValue;
        };

        if (!setRequiredDecimalField("annualRent", "Annual rent")) return;
        if (!setOptionalDecimalField("securityDepositAmount", "Security deposit")) return;
        if (!setOptionalDecimalField("contractValue", "Contract value")) return;
        if (!setOptionalDecimalField("firstPaymentAmount", "First payment amount")) return;
        if (!setOptionalDecimalField("depositReceivedAmount", "Deposit received amount")) return;

        if (values.contractPeriodFrom !== initialValues.contractPeriodFrom) patch.contractPeriodFrom = toIsoDateTime(values.contractPeriodFrom);
        if (values.contractPeriodTo !== initialValues.contractPeriodTo) patch.contractPeriodTo = toIsoDateTime(values.contractPeriodTo);
        if (values.contractDate !== initialValues.contractDate) patch.contractDate = values.contractDate ? toIsoDateTime(values.contractDate) : null;
        if (values.tenancyRegistrationExpiry !== initialValues.tenancyRegistrationExpiry) patch.tenancyRegistrationExpiry = values.tenancyRegistrationExpiry ? toIsoDateTime(values.tenancyRegistrationExpiry) : null;
        if (values.noticeGivenDate !== initialValues.noticeGivenDate) patch.noticeGivenDate = values.noticeGivenDate ? toIsoDateTime(values.noticeGivenDate) : null;
        if (values.paymentFrequency !== initialValues.paymentFrequency) patch.paymentFrequency = values.paymentFrequency;

        if (values.numberOfCheques !== initialValues.numberOfCheques) {
            const trimmed = trimValue(values.numberOfCheques);
            if (!trimmed && trimValue(initialValues.numberOfCheques)) {
                form.setError("numberOfCheques", { type: "manual", message: "Number of cheques cannot be empty" });
                return;
            }
            if (trimmed) patch.numberOfCheques = Number(trimmed);
        }

        setOptionalTextField("paymentModeText");
        setNullableTextField("ijariId");
        setNullableTextField("propertyUsage");
        setNullableTextField("ownerNameSnapshot");
        setNullableTextField("landlordNameSnapshot");
        setNullableTextField("tenantNameSnapshot");
        setNullableTextField("tenantEmailSnapshot");
        setNullableTextField("tenantPhoneSnapshot");
        setNullableTextField("locationCommunity");
        setNullableTextField("propertySizeSqm");
        setNullableTextField("propertyTypeLabel");
        setNullableTextField("propertyNumber");
        setNullableTextField("premisesNoDewa");
        setNullableTextField("plotNo");
        setNullableTextField("internetTvProvider");
        setNullableTextField("notes");

        const nextTerms = (values.additionalTermsText || "").split("\n").map((term) => term.trim()).filter(Boolean);
        const prevTerms = (initialValues.additionalTermsText || "").split("\n").map((term) => term.trim()).filter(Boolean);
        if (nextTerms.join("\n") !== prevTerms.join("\n")) patch.additionalTerms = nextTerms;

        if (values.serviceChargesPaidBy !== initialValues.serviceChargesPaidBy && values.serviceChargesPaidBy) patch.serviceChargesPaidBy = values.serviceChargesPaidBy as ServiceChargesPaidBy;
        if (values.vatApplicable !== initialValues.vatApplicable) patch.vatApplicable = values.vatApplicable === "" ? null : values.vatApplicable === "true";
        if (values.firstPaymentReceived !== initialValues.firstPaymentReceived && values.firstPaymentReceived) patch.firstPaymentReceived = values.firstPaymentReceived as YesNo;
        if (values.depositReceived !== initialValues.depositReceived && values.depositReceived) patch.depositReceived = values.depositReceived as YesNo;

        if (Object.keys(patch).length === 0) {
            toast.error("No fields changed");
            return;
        }

        try {
            await updateLeaseMutation.mutateAsync({ leaseId: lease.id, dto: patch });
            toast.success("Contract updated successfully");
            onCompleted?.();
            onOpenChange(false);
        } catch (error) {
            const status = toErrorStatus(error);
            if (status === 403) {
                return void toast.error("You don't have access to edit contracts");
            }
            if (status === 404) return void toast.error("Contract not found");
            if (status === 400) return void toast.error("Invalid contract update. Please review the entered values.");
            if (status === 409) {
                if (lease.status === "ACTIVE" && lease.ijariId) {
                    return void toast.error("Legal fields are locked for active Ejari contracts. Use amendment or renewal flow.");
                }
                return void toast.error("Contract update is blocked by a conflict. Refresh and try again.");
            }
            toast.error(error instanceof Error ? error.message : "Failed to update contract");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent hideOverlay className="max-h-[92vh] overflow-hidden border-zinc-200/80 bg-transparent p-0 shadow-[0_32px_90px_-38px_rgba(24,24,27,0.55)] sm:max-w-5xl">
                <div className="flex max-h-[92vh] flex-col overflow-hidden rounded-[28px] bg-zinc-50">
                    <DialogHeader className="sticky top-0 z-10 border-b border-zinc-200/80 bg-white px-6 py-5 text-left">
                        <div className="flex flex-wrap items-start gap-3 pr-10">
                            <div className="space-y-1">
                                <DialogTitle className="text-[1.65rem] font-semibold tracking-tight text-zinc-950">Edit Contract</DialogTitle>
                                <DialogDescription className="max-w-3xl text-sm text-zinc-500">
                                    Review the same contract fields used during creation, then save only the values you changed.
                                </DialogDescription>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Badge className="bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                                    {lease.status}
                                </Badge>
                                {lease.ijariId ? (
                                    <Badge variant="outline" className="border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                                        Ejari linked
                                    </Badge>
                                ) : null}
                            </div>
                        </div>
                    </DialogHeader>

                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
                        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
                            {bodyReady ? (
                                <>
                            <ContractModalSection
                                title="Assignment"
                                description="Resident and unit linkage are fixed for this contract. Edit the legal and operational details below."
                                badge="Read only linkage"
                            >
                                <div className="grid gap-3 md:grid-cols-2">
                                    <ContractSummaryCard
                                        label="Resident"
                                        title={residentLabel}
                                        description="Linked resident for this contract."
                                        meta={residentSummaryMeta}
                                        tone="accent"
                                    />
                                    <ContractSummaryCard
                                        label="Unit"
                                        title={unitLabel}
                                        description="Assigned unit for this contract."
                                        meta={unitSummaryMeta}
                                        tone="accent"
                                    />
                                </div>
                            </ContractModalSection>

                            <ContractModalSection
                                title="Contract Essentials"
                                description="Update the primary dates and payment terms used to manage the live contract."
                            >
                                <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2"><Label htmlFor="contractPeriodFrom">Contract Period From</Label><Input id="contractPeriodFrom" type="date" {...form.register("contractPeriodFrom")} /><FieldError message={form.formState.errors.contractPeriodFrom?.message} /></div>
                        <div className="space-y-2"><Label htmlFor="contractPeriodTo">Contract Period To</Label><Input id="contractPeriodTo" type="date" {...form.register("contractPeriodTo")} /><FieldError message={form.formState.errors.contractPeriodTo?.message} /></div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2"><Label htmlFor="annualRent">Annual Rent</Label><Input id="annualRent" placeholder="48000.00" {...form.register("annualRent")} /><FieldError message={form.formState.errors.annualRent?.message} /></div>
                        <div className="space-y-2">
                            <Label>Payment Frequency</Label>
                            <Select value={paymentFrequencyValue} onValueChange={(value) => form.setValue("paymentFrequency", value as PaymentFrequency, { shouldDirty: true, shouldValidate: true })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{paymentFrequencyOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2"><Label htmlFor="numberOfCheques">Number Of Cheques</Label><Input id="numberOfCheques" placeholder="4" {...form.register("numberOfCheques")} /><FieldError message={form.formState.errors.numberOfCheques?.message} /></div>
                                </div>
                            </ContractModalSection>

                            <ContractDisclosureSection
                                title="Commercial / Legal"
                                description="Keep commercial values, contract references, and terms aligned with the signed agreement."
                            >
                                <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2"><Label htmlFor="securityDepositAmount">Security Deposit</Label><Input id="securityDepositAmount" placeholder="5000.00" {...form.register("securityDepositAmount")} /><FieldError message={form.formState.errors.securityDepositAmount?.message} /></div>
                        <div className="space-y-2"><Label htmlFor="contractValue">Contract Value</Label><Input id="contractValue" placeholder="48000.00" {...form.register("contractValue")} /><FieldError message={form.formState.errors.contractValue?.message} /></div>
                        <div className="space-y-2"><Label htmlFor="paymentModeText">Payment Mode Text</Label><Input id="paymentModeText" placeholder="4 cheques" {...form.register("paymentModeText")} /></div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2"><Label htmlFor="ijariId">Ijari ID</Label><Input id="ijariId" placeholder="EJARI-123" {...form.register("ijariId")} /></div>
                        <div className="space-y-2"><Label htmlFor="propertyUsage">Property Usage</Label><Input id="propertyUsage" placeholder="RESIDENTIAL" {...form.register("propertyUsage")} /></div>
                    </div>

                                <div className="space-y-2">
                                    <Label htmlFor="contractDate">Contract Date</Label>
                                    <Input id="contractDate" type="date" {...form.register("contractDate")} />
                                    <p className="text-xs text-zinc-500">Date the contract was signed or issued.</p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="additionalTermsText">Additional Terms (one term per line)</Label>
                                    <Textarea id="additionalTermsText" rows={4} placeholder={"No subletting\nPets allowed with approval"} {...form.register("additionalTermsText")} />
                                </div>
                            </ContractDisclosureSection>

                            <ContractDisclosureSection
                                title="Advanced Snapshot Details"
                                description="Editable snapshot fields from the original resident, owner, and property context."
                            >
                                <div className="space-y-5">
                                    <div className="grid gap-4 md:grid-cols-3">
                                        <div className="space-y-2"><Label htmlFor="tenantNameSnapshot">Tenant Name</Label><Input id="tenantNameSnapshot" {...form.register("tenantNameSnapshot")} /></div>
                                        <div className="space-y-2"><Label htmlFor="tenantEmailSnapshot">Tenant Email</Label><Input id="tenantEmailSnapshot" {...form.register("tenantEmailSnapshot")} /></div>
                                        <div className="space-y-2"><Label htmlFor="tenantPhoneSnapshot">Tenant Phone</Label><Input id="tenantPhoneSnapshot" {...form.register("tenantPhoneSnapshot")} /></div>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2"><Label htmlFor="ownerNameSnapshot">Owner Name</Label><Input id="ownerNameSnapshot" {...form.register("ownerNameSnapshot")} /></div>
                                        <div className="space-y-2"><Label htmlFor="landlordNameSnapshot">Landlord Name</Label><Input id="landlordNameSnapshot" {...form.register("landlordNameSnapshot")} /></div>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2"><Label htmlFor="locationCommunity">Community</Label><Input id="locationCommunity" {...form.register("locationCommunity")} /></div>
                                        <div className="space-y-2"><Label htmlFor="propertyTypeLabel">Property Type Label</Label><Input id="propertyTypeLabel" {...form.register("propertyTypeLabel")} /></div>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-4">
                                        <div className="space-y-2"><Label htmlFor="propertySizeSqm">Property Size (sqm)</Label><Input id="propertySizeSqm" {...form.register("propertySizeSqm")} /></div>
                                        <div className="space-y-2"><Label htmlFor="propertyNumber">Property Number</Label><Input id="propertyNumber" {...form.register("propertyNumber")} /></div>
                                        <div className="space-y-2"><Label htmlFor="premisesNoDewa">Premises No Dewa</Label><Input id="premisesNoDewa" {...form.register("premisesNoDewa")} /></div>
                                        <div className="space-y-2"><Label htmlFor="plotNo">Plot No</Label><Input id="plotNo" {...form.register("plotNo")} /></div>
                                    </div>
                                </div>
                            </ContractDisclosureSection>

                            <ContractDisclosureSection
                                title="Operational Details"
                                description="Track downstream payment, Ejari, and service-charge details without crowding the main contract form."
                            >
                                <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 space-y-3">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Additional Details</div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-2"><Label htmlFor="tenancyRegistrationExpiry">Ejari Expiry Date</Label><Input id="tenancyRegistrationExpiry" type="date" {...form.register("tenancyRegistrationExpiry")} /></div>
                                        <div className="space-y-2"><Label htmlFor="noticeGivenDate">Notice Given Date</Label><Input id="noticeGivenDate" type="date" {...form.register("noticeGivenDate")} /></div>
                                        <div className="space-y-2"><Label htmlFor="firstPaymentAmount">First Payment Amount</Label><Input id="firstPaymentAmount" inputMode="decimal" {...form.register("firstPaymentAmount")} /><FieldError message={form.formState.errors.firstPaymentAmount?.message} /></div>
                                        <div className="space-y-2"><Label htmlFor="depositReceivedAmount">Deposit Received Amount</Label><Input id="depositReceivedAmount" inputMode="decimal" {...form.register("depositReceivedAmount")} /><FieldError message={form.formState.errors.depositReceivedAmount?.message} /></div>
                                        <div className="space-y-2"><Label htmlFor="internetTvProvider">Internet/TV Provider</Label><Input id="internetTvProvider" {...form.register("internetTvProvider")} /></div>
                                        <div className="space-y-2">
                                            <Label>Service Charges Paid By</Label>
                                            <Select value={serviceChargesPaidByValue || "__unset__"} onValueChange={(value) => form.setValue("serviceChargesPaidBy", value === "__unset__" ? "" : (value as ServiceChargesPaidBy), { shouldDirty: true })}>
                                                <SelectTrigger><SelectValue placeholder="Not set" /></SelectTrigger>
                                                <SelectContent><SelectItem value="__unset__">Not set</SelectItem><SelectItem value="OWNER">Owner</SelectItem><SelectItem value="TENANT">Tenant</SelectItem></SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>VAT Applicable</Label>
                                            <Select value={vatApplicableValue || "__unset__"} onValueChange={(value) => form.setValue("vatApplicable", value === "__unset__" ? "" : (value as "true" | "false"), { shouldDirty: true })}>
                                                <SelectTrigger><SelectValue placeholder="Not set" /></SelectTrigger>
                                                <SelectContent><SelectItem value="__unset__">Not set</SelectItem><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>First Payment Received</Label>
                                            <Select value={firstPaymentReceivedValue || "__unset__"} onValueChange={(value) => form.setValue("firstPaymentReceived", value === "__unset__" ? "" : (value as YesNo), { shouldDirty: true })}>
                                                <SelectTrigger><SelectValue placeholder="Not set" /></SelectTrigger>
                                                <SelectContent><SelectItem value="__unset__">Not set</SelectItem><SelectItem value="YES">Yes</SelectItem><SelectItem value="NO">No</SelectItem></SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Deposit Received</Label>
                                            <Select value={depositReceivedValue || "__unset__"} onValueChange={(value) => form.setValue("depositReceived", value === "__unset__" ? "" : (value as YesNo), { shouldDirty: true })}>
                                                <SelectTrigger><SelectValue placeholder="Not set" /></SelectTrigger>
                                                <SelectContent><SelectItem value="__unset__">Not set</SelectItem><SelectItem value="YES">Yes</SelectItem><SelectItem value="NO">No</SelectItem></SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2 sm:col-span-2"><Label htmlFor="notes">Notes</Label><Textarea id="notes" rows={3} {...form.register("notes")} /></div>
                                    </div>
                                </div>
                            </ContractDisclosureSection>
                                </>
                            ) : (
                                <EditLeaseDialogLoadingState />
                            )}

                        </div>

                        <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-3 border-t border-zinc-200/80 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-zinc-500">
                                Only changed fields will be sent in the update payload.
                            </p>
                            <div className="flex items-center justify-end gap-3">
                                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                                <Button type="submit" disabled={!bodyReady || updateLeaseMutation.isPending}>{updateLeaseMutation.isPending ? "Saving..." : bodyReady ? "Save changes" : "Loading contract form..."}</Button>
                            </div>
                        </div>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
}
