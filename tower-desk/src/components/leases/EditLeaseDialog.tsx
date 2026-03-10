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
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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

const toDateInputValue = (value?: string | null) => {
    if (!value) return "";
    if (value.includes("T")) return value.slice(0, 10);
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString().slice(0, 10);
};

const toIsoDateTime = (value: string) => `${value}T00:00:00.000Z`;

const editLeaseSchema = z
    .object({
        leaseStartDate: z.string().min(1, "Start date is required"),
        leaseEndDate: z.string().min(1, "End date is required"),
        tenancyRegistrationExpiry: z.string().optional(),
        noticeGivenDate: z.string().optional(),
        annualRent: z.string().min(1, "Annual rent is required"),
        securityDepositAmount: z.string().min(1, "Security deposit is required"),
        firstPaymentAmount: z.string().optional(),
        depositReceivedAmount: z.string().optional(),
        paymentFrequency: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]),
        numberOfCheques: z.string().optional(),
        internetTvProvider: z.string().optional(),
        notes: z.string().optional(),
        serviceChargesPaidBy: z.enum(["", "OWNER", "TENANT"]),
        vatApplicable: z.enum(["", "true", "false"]),
        firstPaymentReceived: z.enum(["", "YES", "NO"]),
        depositReceived: z.enum(["", "YES", "NO"]),
    })
    .superRefine((data, ctx) => {
        const start = new Date(data.leaseStartDate);
        const end = new Date(data.leaseEndDate);
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end <= start) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["leaseEndDate"],
                message: "End date must be after start date",
            });
        }

        const chequesValue = data.numberOfCheques?.trim();
        if (chequesValue) {
            const parsed = Number(chequesValue);
            if (!Number.isInteger(parsed) || parsed < 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["numberOfCheques"],
                    message: "Number of cheques must be a non-negative whole number",
                });
            }
        }
    });

type EditLeaseFormValues = z.infer<typeof editLeaseSchema>;

const toErrorStatus = (error: unknown): number | undefined => {
    if (typeof error !== "object" || !error) return undefined;
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number") return status;
    return undefined;
};

export function EditLeaseDialog({ open, onOpenChange, lease, onCompleted }: EditLeaseDialogProps) {
    const updateLeaseMutation = useUpdateLease();

    const initialValues = useMemo<EditLeaseFormValues>(
        () => ({
            leaseStartDate: toDateInputValue(lease.leaseStartDate),
            leaseEndDate: toDateInputValue(lease.leaseEndDate),
            tenancyRegistrationExpiry: toDateInputValue(lease.tenancyRegistrationExpiry),
            noticeGivenDate: toDateInputValue(lease.noticeGivenDate),
            annualRent: lease.annualRent ?? "",
            securityDepositAmount: lease.securityDepositAmount ?? "",
            firstPaymentAmount: lease.firstPaymentAmount ?? "",
            depositReceivedAmount: lease.depositReceivedAmount ?? "",
            paymentFrequency: lease.paymentFrequency ?? "MONTHLY",
            numberOfCheques:
                lease.numberOfCheques !== undefined && lease.numberOfCheques !== null
                    ? String(lease.numberOfCheques)
                    : "",
            internetTvProvider: lease.internetTvProvider ?? "",
            notes: lease.notes ?? "",
            serviceChargesPaidBy: (lease.serviceChargesPaidBy ?? "") as "" | ServiceChargesPaidBy,
            vatApplicable:
                lease.vatApplicable === true
                    ? "true"
                    : lease.vatApplicable === false
                        ? "false"
                        : "",
            firstPaymentReceived: (lease.firstPaymentReceived ?? "") as "" | YesNo,
            depositReceived: (lease.depositReceived ?? "") as "" | YesNo,
        }),
        [lease]
    );

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
        if (!open) return;
        form.reset(initialValues);
    }, [open, form, initialValues]);

    const onSubmit = async (values: EditLeaseFormValues) => {
        const patch: UpdateLeaseDto = {};

        const setDecimalField = (
            key: "annualRent" | "securityDepositAmount" | "firstPaymentAmount" | "depositReceivedAmount",
            isRequired: boolean
        ) => {
            const currentValue = values[key] ?? "";
            const initialValue = initialValues[key] ?? "";
            if (currentValue === initialValue) return true;
            const trimmed = currentValue.trim();
            if (!trimmed) {
                form.setError(key, {
                    type: "manual",
                    message: isRequired ? "This amount is required" : "Amount cannot be empty",
                });
                return false;
            }
            patch[key] = trimmed;
            return true;
        };

        if (!setDecimalField("annualRent", true)) return;
        if (!setDecimalField("securityDepositAmount", true)) return;
        if (!setDecimalField("firstPaymentAmount", false)) return;
        if (!setDecimalField("depositReceivedAmount", false)) return;

        if (values.leaseStartDate !== initialValues.leaseStartDate) {
            patch.leaseStartDate = toIsoDateTime(values.leaseStartDate);
        }
        if (values.leaseEndDate !== initialValues.leaseEndDate) {
            patch.leaseEndDate = toIsoDateTime(values.leaseEndDate);
        }
        if (values.tenancyRegistrationExpiry !== initialValues.tenancyRegistrationExpiry) {
            patch.tenancyRegistrationExpiry = values.tenancyRegistrationExpiry
                ? toIsoDateTime(values.tenancyRegistrationExpiry)
                : null;
        }
        if (values.noticeGivenDate !== initialValues.noticeGivenDate) {
            patch.noticeGivenDate = values.noticeGivenDate ? toIsoDateTime(values.noticeGivenDate) : null;
        }
        if (values.paymentFrequency !== initialValues.paymentFrequency) {
            patch.paymentFrequency = values.paymentFrequency;
        }

        if (values.numberOfCheques !== initialValues.numberOfCheques) {
            const trimmed = values.numberOfCheques?.trim() ?? "";
            if (!trimmed) {
                form.setError("numberOfCheques", { type: "manual", message: "Number of cheques cannot be empty" });
                return;
            }
            const parsed = Number(trimmed);
            if (!Number.isInteger(parsed) || parsed < 0) {
                form.setError("numberOfCheques", {
                    type: "manual",
                    message: "Number of cheques must be a non-negative whole number",
                });
                return;
            }
            patch.numberOfCheques = parsed;
        }

        if (values.internetTvProvider !== initialValues.internetTvProvider) {
            patch.internetTvProvider = (values.internetTvProvider ?? "").trim() || null;
        }
        if (values.notes !== initialValues.notes) {
            patch.notes = (values.notes ?? "").trim() || null;
        }
        if (
            values.serviceChargesPaidBy !== initialValues.serviceChargesPaidBy &&
            values.serviceChargesPaidBy
        ) {
            patch.serviceChargesPaidBy = values.serviceChargesPaidBy as ServiceChargesPaidBy;
        }
        if (values.vatApplicable !== initialValues.vatApplicable) {
            patch.vatApplicable =
                values.vatApplicable === ""
                    ? null
                    : values.vatApplicable === "true";
        }
        if (
            values.firstPaymentReceived !== initialValues.firstPaymentReceived &&
            values.firstPaymentReceived
        ) {
            patch.firstPaymentReceived = values.firstPaymentReceived as YesNo;
        }
        if (
            values.depositReceived !== initialValues.depositReceived &&
            values.depositReceived
        ) {
            patch.depositReceived = values.depositReceived as YesNo;
        }

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
                toast.error("You don't have access to edit contracts");
                return;
            }
            if (status === 404) {
                toast.error("Contract not found");
                return;
            }
            if (status === 400) {
                toast.error("Invalid contract update. Please review the entered values.");
                return;
            }
            if (status === 409) {
                if (lease.status === "ACTIVE" && Boolean(lease.ijariId)) {
                    toast.error("Legal fields are locked for active Ejari contracts. Use amendment or renewal flow.");
                    return;
                }
                toast.error("Contract update is blocked by a conflict. Refresh and try again.");
                return;
            }
            const message = error instanceof Error ? error.message : "Failed to update contract";
            toast.error(message);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Contract</DialogTitle>
                    <DialogDescription>
                        Update contract terms and financial fields. Only changed values will be submitted.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Dates</div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="leaseStartDate">Contract Start Date</Label>
                                <Input id="leaseStartDate" type="date" {...form.register("leaseStartDate")} />
                                {form.formState.errors.leaseStartDate && (
                                    <p className="text-xs text-rose-500">{form.formState.errors.leaseStartDate.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="leaseEndDate">Contract End Date</Label>
                                <Input id="leaseEndDate" type="date" {...form.register("leaseEndDate")} />
                                {form.formState.errors.leaseEndDate && (
                                    <p className="text-xs text-rose-500">{form.formState.errors.leaseEndDate.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="tenancyRegistrationExpiry">Tenancy Registration Expiry</Label>
                                <Input
                                    id="tenancyRegistrationExpiry"
                                    type="date"
                                    {...form.register("tenancyRegistrationExpiry")}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="noticeGivenDate">Notice Given Date</Label>
                                <Input id="noticeGivenDate" type="date" {...form.register("noticeGivenDate")} />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Financials</div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="annualRent">Annual Rent</Label>
                                <Input id="annualRent" inputMode="decimal" {...form.register("annualRent")} />
                                {form.formState.errors.annualRent && (
                                    <p className="text-xs text-rose-500">{form.formState.errors.annualRent.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="securityDepositAmount">Security Deposit</Label>
                                <Input
                                    id="securityDepositAmount"
                                    inputMode="decimal"
                                    {...form.register("securityDepositAmount")}
                                />
                                {form.formState.errors.securityDepositAmount && (
                                    <p className="text-xs text-rose-500">{form.formState.errors.securityDepositAmount.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="firstPaymentAmount">First Payment Amount</Label>
                                <Input
                                    id="firstPaymentAmount"
                                    inputMode="decimal"
                                    {...form.register("firstPaymentAmount")}
                                />
                                {form.formState.errors.firstPaymentAmount && (
                                    <p className="text-xs text-rose-500">{form.formState.errors.firstPaymentAmount.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="depositReceivedAmount">Deposit Received Amount</Label>
                                <Input
                                    id="depositReceivedAmount"
                                    inputMode="decimal"
                                    {...form.register("depositReceivedAmount")}
                                />
                                {form.formState.errors.depositReceivedAmount && (
                                    <p className="text-xs text-rose-500">{form.formState.errors.depositReceivedAmount.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label>Payment Frequency</Label>
                                <Select
                                    value={paymentFrequencyValue}
                                    onValueChange={(value) =>
                                        form.setValue("paymentFrequency", value as PaymentFrequency, {
                                            shouldDirty: true,
                                            shouldValidate: true,
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select frequency" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {paymentFrequencyOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="numberOfCheques">Number of Cheques</Label>
                                <Input id="numberOfCheques" type="number" min={0} {...form.register("numberOfCheques")} />
                                {form.formState.errors.numberOfCheques && (
                                    <p className="text-xs text-rose-500">{form.formState.errors.numberOfCheques.message}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Additional Details</div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="internetTvProvider">Internet/TV Provider</Label>
                                <Input id="internetTvProvider" {...form.register("internetTvProvider")} />
                            </div>
                            <div className="space-y-2">
                                <Label>Service Charges Paid By</Label>
                                <Select
                                    value={serviceChargesPaidByValue || "__unset__"}
                                    onValueChange={(value) =>
                                        form.setValue(
                                            "serviceChargesPaidBy",
                                            value === "__unset__" ? "" : (value as ServiceChargesPaidBy),
                                            { shouldDirty: true }
                                        )
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Not set" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__unset__">Not set</SelectItem>
                                        <SelectItem value="OWNER">Owner</SelectItem>
                                        <SelectItem value="TENANT">Tenant</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>VAT Applicable</Label>
                                <Select
                                    value={vatApplicableValue || "__unset__"}
                                    onValueChange={(value) =>
                                        form.setValue(
                                            "vatApplicable",
                                            value === "__unset__" ? "" : (value as "true" | "false"),
                                            { shouldDirty: true }
                                        )
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Not set" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__unset__">Not set</SelectItem>
                                        <SelectItem value="true">Yes</SelectItem>
                                        <SelectItem value="false">No</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>First Payment Received</Label>
                                <Select
                                    value={firstPaymentReceivedValue || "__unset__"}
                                    onValueChange={(value) =>
                                        form.setValue(
                                            "firstPaymentReceived",
                                            value === "__unset__" ? "" : (value as YesNo),
                                            { shouldDirty: true }
                                        )
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Not set" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__unset__">Not set</SelectItem>
                                        <SelectItem value="YES">Yes</SelectItem>
                                        <SelectItem value="NO">No</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Deposit Received</Label>
                                <Select
                                    value={depositReceivedValue || "__unset__"}
                                    onValueChange={(value) =>
                                        form.setValue(
                                            "depositReceived",
                                            value === "__unset__" ? "" : (value as YesNo),
                                            { shouldDirty: true }
                                        )
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Not set" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__unset__">Not set</SelectItem>
                                        <SelectItem value="YES">Yes</SelectItem>
                                        <SelectItem value="NO">No</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="notes">Notes</Label>
                                <Textarea id="notes" rows={3} {...form.register("notes")} />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={updateLeaseMutation.isPending}>
                            {updateLeaseMutation.isPending ? "Saving..." : "Save changes"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
