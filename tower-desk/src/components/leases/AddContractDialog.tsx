"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Check, ChevronDown, Search, X } from "lucide-react";

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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBuildingUnits, useCreateContract, useResidentDirectory } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { CreateContractDto, PaymentFrequency } from "@/lib/types";

interface AddContractDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    buildingId: string;
    onCompleted?: () => void;
}

const paymentFrequencyOptions: Array<{ value: PaymentFrequency; label: string }> = [
    { value: "MONTHLY", label: "Monthly" },
    { value: "QUARTERLY", label: "Quarterly" },
    { value: "SEMI_ANNUAL", label: "Semi-Annual" },
    { value: "ANNUAL", label: "Annual" },
];

const nonNegativeNumberRegex = /^\d+(\.\d+)?$/;

const addContractSchema = z
    .object({
        residentUserId: z.string().min(1, "Resident is required"),
        unitId: z.string().min(1, "Unit is required"),
        contractPeriodFrom: z.string().min(1, "Contract period start is required"),
        contractPeriodTo: z.string().min(1, "Contract period end is required"),
        annualRent: z.string().min(1, "Annual rent is required"),
        paymentFrequency: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]),
        numberOfCheques: z.string().optional(),
        securityDepositAmount: z.string().optional(),
        ijariId: z.string().optional(),
        contractDate: z.string().optional(),
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
        contractValue: z.string().optional(),
        paymentModeText: z.string().optional(),
        additionalTermsText: z.string().optional(),
    })
    .superRefine((data, ctx) => {
        if (!nonNegativeNumberRegex.test(data.annualRent.trim())) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["annualRent"],
                message: "Annual rent must be a non-negative number",
            });
        }

        const from = new Date(`${data.contractPeriodFrom}T00:00:00.000Z`);
        const to = new Date(`${data.contractPeriodTo}T23:59:59.000Z`);
        if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to <= from) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["contractPeriodTo"],
                message: "Contract end must be after contract start",
            });
        }

        const numberOfCheques = data.numberOfCheques?.trim();
        if (numberOfCheques) {
            const parsed = Number(numberOfCheques);
            if (!Number.isInteger(parsed) || parsed < 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["numberOfCheques"],
                    message: "Number of cheques must be a non-negative whole number",
                });
            }
        }

        const securityDepositAmount = data.securityDepositAmount?.trim();
        if (securityDepositAmount && !nonNegativeNumberRegex.test(securityDepositAmount)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["securityDepositAmount"],
                message: "Security deposit must be a non-negative number",
            });
        }

        const contractValue = data.contractValue?.trim();
        if (contractValue && !nonNegativeNumberRegex.test(contractValue)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["contractValue"],
                message: "Contract value must be a non-negative number",
            });
        }
    });

type AddContractFormValues = z.infer<typeof addContractSchema>;

const defaultValues: AddContractFormValues = {
    residentUserId: "",
    unitId: "",
    contractPeriodFrom: "",
    contractPeriodTo: "",
    annualRent: "",
    paymentFrequency: "QUARTERLY",
    numberOfCheques: "",
    securityDepositAmount: "",
    ijariId: "",
    contractDate: "",
    propertyUsage: "RESIDENTIAL",
    ownerNameSnapshot: "",
    landlordNameSnapshot: "",
    tenantNameSnapshot: "",
    tenantEmailSnapshot: "",
    tenantPhoneSnapshot: "",
    locationCommunity: "",
    propertySizeSqm: "",
    propertyTypeLabel: "",
    propertyNumber: "",
    premisesNoDewa: "",
    plotNo: "",
    contractValue: "",
    paymentModeText: "",
    additionalTermsText: "",
};

const trimOrUndefined = (value?: string) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
};

const toDateStartIso = (value: string) => `${value}T00:00:00.000Z`;
const toDateEndIso = (value: string) => `${value}T23:59:59.000Z`;

const toErrorStatus = (error: unknown): number | undefined => {
    if (typeof error !== "object" || !error) return undefined;
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
};

export function AddContractDialog({
    open,
    onOpenChange,
    buildingId,
    onCompleted,
}: AddContractDialogProps) {
    const createContractMutation = useCreateContract();
    const [residentPickerOpen, setResidentPickerOpen] = useState(false);
    const [residentSearchInput, setResidentSearchInput] = useState("");
    const [residentSearchTerm, setResidentSearchTerm] = useState("");
    const [unitPickerOpen, setUnitPickerOpen] = useState(false);
    const [unitSearchInput, setUnitSearchInput] = useState("");
    const [unitSearchTerm, setUnitSearchTerm] = useState("");
    const [unitAvailableOnly, setUnitAvailableOnly] = useState(true);
    const handleDialogOpenChange = (nextOpen: boolean) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
            setResidentSearchInput("");
            setResidentSearchTerm("");
            setResidentPickerOpen(false);
            setUnitSearchInput("");
            setUnitSearchTerm("");
            setUnitAvailableOnly(true);
            setUnitPickerOpen(false);
        }
    };

    const unitsQuery = useBuildingUnits(buildingId, {
        available: unitAvailableOnly,
        includeOccupancy: true,
        search: unitSearchTerm || undefined,
        enabled: open && Boolean(buildingId),
    });
    const residentsQuery = useResidentDirectory(
        buildingId,
        {
            status: "ALL",
            q: residentSearchTerm || undefined,
            limit: residentSearchTerm ? 100 : 50,
            enabled: open && Boolean(buildingId),
        }
    );

    const form = useForm<AddContractFormValues>({
        resolver: zodResolver(addContractSchema),
        defaultValues,
    });

    const selectedResidentUserId = useWatch({
        control: form.control,
        name: "residentUserId",
    });
    const selectedUnitId = useWatch({
        control: form.control,
        name: "unitId",
    });
    const selectedPaymentFrequency = useWatch({
        control: form.control,
        name: "paymentFrequency",
    });
    const tenantNameSnapshot = useWatch({
        control: form.control,
        name: "tenantNameSnapshot",
    });
    const tenantEmailSnapshot = useWatch({
        control: form.control,
        name: "tenantEmailSnapshot",
    });

    const residentOptions = useMemo(() => {
        const rows = residentsQuery.data?.items ?? [];
        return [...rows].sort((a, b) => {
            const aLabel = a.residentName || a.residentEmail || a.residentUserId;
            const bLabel = b.residentName || b.residentEmail || b.residentUserId;
            return aLabel.localeCompare(bLabel);
        }).filter((row) => {
            if (row.canAddContract === true) return true;
            if (row.canAddContract === false) return false;
            return row.lease?.status !== "ACTIVE";
        });
    }, [residentsQuery.data?.items]);

    const selectedResident = useMemo(
        () => residentOptions.find((row) => row.residentUserId === selectedResidentUserId),
        [residentOptions, selectedResidentUserId]
    );
    const selectedResidentLabel = useMemo(() => {
        if (!selectedResidentUserId) return "Select resident";
        if (selectedResident?.residentName) return selectedResident.residentName;
        if (selectedResident?.residentEmail) return selectedResident.residentEmail;
        if (tenantNameSnapshot) return tenantNameSnapshot;
        if (tenantEmailSnapshot) return tenantEmailSnapshot;
        return "Selected resident";
    }, [selectedResident, selectedResidentUserId, tenantEmailSnapshot, tenantNameSnapshot]);

    const unitOptions = useMemo(() => {
        const rows = unitsQuery.data ?? [];
        return [...rows].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    }, [unitsQuery.data]);
    const selectedUnit = useMemo(
        () => unitOptions.find((unit) => unit.id === selectedUnitId),
        [selectedUnitId, unitOptions]
    );
    const filteredUnitOptions = useMemo(() => {
        const query = unitSearchInput.trim().toLowerCase();
        if (!query) return unitOptions;
        return unitOptions.filter((unit) => {
            const searchable = [
                unit.label,
                unit.status,
                unit.occupancy?.status,
                unit.floor != null ? `floor ${unit.floor}` : "",
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            return searchable.includes(query);
        });
    }, [unitOptions, unitSearchInput]);
    const selectedUnitLabel = useMemo(() => {
        if (!selectedUnitId) return "Select unit";
        if (!selectedUnit) return selectedUnitId;
        const occupancyStatus = selectedUnit.occupancy?.status ? ` (${selectedUnit.occupancy.status})` : "";
        return `Unit ${selectedUnit.label}${occupancyStatus}`;
    }, [selectedUnit, selectedUnitId]);

    useEffect(() => {
        if (!open) return;
        form.reset(defaultValues);
    }, [open, form]);

    useEffect(() => {
        if (!selectedResident) return;
        if (!form.getValues("tenantNameSnapshot") && selectedResident.residentName) {
            form.setValue("tenantNameSnapshot", selectedResident.residentName);
        }
        if (!form.getValues("tenantEmailSnapshot") && selectedResident.residentEmail) {
            form.setValue("tenantEmailSnapshot", selectedResident.residentEmail);
        }
        if (!form.getValues("tenantPhoneSnapshot") && selectedResident.residentPhone) {
            form.setValue("tenantPhoneSnapshot", selectedResident.residentPhone);
        }
    }, [selectedResident, form]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setResidentSearchTerm(residentSearchInput.trim());
        }, 250);
        return () => clearTimeout(timeoutId);
    }, [residentSearchInput]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setUnitSearchTerm(unitSearchInput.trim());
        }, 250);
        return () => clearTimeout(timeoutId);
    }, [unitSearchInput]);

    const onSubmit = async (values: AddContractFormValues) => {
        const dto: CreateContractDto = {
            residentUserId: values.residentUserId,
            unitId: values.unitId,
            contractPeriodFrom: toDateStartIso(values.contractPeriodFrom),
            contractPeriodTo: toDateEndIso(values.contractPeriodTo),
            annualRent: values.annualRent.trim(),
            paymentFrequency: values.paymentFrequency,
        };

        const numberOfCheques = values.numberOfCheques?.trim();
        if (numberOfCheques) {
            dto.numberOfCheques = Number(numberOfCheques);
        }

        const securityDepositAmount = trimOrUndefined(values.securityDepositAmount);
        if (securityDepositAmount) dto.securityDepositAmount = securityDepositAmount;

        const contractDate = trimOrUndefined(values.contractDate);
        if (contractDate) dto.contractDate = toDateStartIso(contractDate);

        const ijariId = trimOrUndefined(values.ijariId);
        if (ijariId) dto.ijariId = ijariId;

        const propertyUsage = trimOrUndefined(values.propertyUsage);
        if (propertyUsage) dto.propertyUsage = propertyUsage;

        const ownerNameSnapshot = trimOrUndefined(values.ownerNameSnapshot);
        if (ownerNameSnapshot) dto.ownerNameSnapshot = ownerNameSnapshot;

        const landlordNameSnapshot = trimOrUndefined(values.landlordNameSnapshot);
        if (landlordNameSnapshot) dto.landlordNameSnapshot = landlordNameSnapshot;

        const tenantNameSnapshot = trimOrUndefined(values.tenantNameSnapshot);
        if (tenantNameSnapshot) dto.tenantNameSnapshot = tenantNameSnapshot;

        const tenantEmailSnapshot = trimOrUndefined(values.tenantEmailSnapshot);
        if (tenantEmailSnapshot) dto.tenantEmailSnapshot = tenantEmailSnapshot;

        const tenantPhoneSnapshot = trimOrUndefined(values.tenantPhoneSnapshot);
        if (tenantPhoneSnapshot) dto.tenantPhoneSnapshot = tenantPhoneSnapshot;

        const locationCommunity = trimOrUndefined(values.locationCommunity);
        if (locationCommunity) dto.locationCommunity = locationCommunity;

        const propertySizeSqm = trimOrUndefined(values.propertySizeSqm);
        if (propertySizeSqm) dto.propertySizeSqm = propertySizeSqm;

        const propertyTypeLabel = trimOrUndefined(values.propertyTypeLabel);
        if (propertyTypeLabel) dto.propertyTypeLabel = propertyTypeLabel;

        const propertyNumber = trimOrUndefined(values.propertyNumber);
        if (propertyNumber) dto.propertyNumber = propertyNumber;

        const premisesNoDewa = trimOrUndefined(values.premisesNoDewa);
        if (premisesNoDewa) dto.premisesNoDewa = premisesNoDewa;

        const plotNo = trimOrUndefined(values.plotNo);
        if (plotNo) dto.plotNo = plotNo;

        const contractValue = trimOrUndefined(values.contractValue);
        if (contractValue) dto.contractValue = contractValue;

        const paymentModeText = trimOrUndefined(values.paymentModeText);
        if (paymentModeText) dto.paymentModeText = paymentModeText;

        const additionalTerms = (values.additionalTermsText || "")
            .split("\n")
            .map((term) => term.trim())
            .filter(Boolean);
        if (additionalTerms.length > 0) dto.additionalTerms = additionalTerms;

        try {
            await createContractMutation.mutateAsync({ buildingId, dto });
            toast.success("Draft contract created");
            onCompleted?.();
            handleDialogOpenChange(false);
        } catch (error) {
            const status = toErrorStatus(error);
            if (status === 403) {
                toast.error("You do not have permission to create contracts.");
                return;
            }
            if (status === 400) {
                toast.error("Invalid contract details. Review the form and try again.");
                return;
            }
            if (status === 409) {
                toast.error("Contract conflict. The resident or unit may already have an active contract.");
                return;
            }
            const message = error instanceof Error ? error.message : "Failed to create contract";
            toast.error(message);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleDialogOpenChange}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add Contract</DialogTitle>
                    <DialogDescription>
                        Create a draft contract first, then activate it when legal details are complete.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Resident</Label>
                            <Popover open={residentPickerOpen} onOpenChange={setResidentPickerOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={residentPickerOpen}
                                        className="w-full justify-between font-normal"
                                    >
                                        <span className="truncate">{selectedResidentLabel}</span>
                                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-[var(--radix-popover-trigger-width)] p-0"
                                    align="start"
                                    onOpenAutoFocus={(event) => event.preventDefault()}
                                >
                                    <div className="flex items-center border-b px-3 py-2">
                                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                        <input
                                            type="text"
                                            placeholder="Search by resident name/email/phone..."
                                            value={residentSearchInput}
                                            onChange={(event) => setResidentSearchInput(event.target.value)}
                                            className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-zinc-400"
                                        />
                                        {residentSearchInput ? (
                                            <button
                                                type="button"
                                                onClick={() => setResidentSearchInput("")}
                                                className="ml-2 rounded-sm opacity-50 hover:opacity-100"
                                                aria-label="Clear resident search"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        ) : null}
                                    </div>
                                    <div className="border-b px-3 py-2 text-xs text-zinc-500">
                                        {residentsQuery.isFetching
                                            ? "Searching residents..."
                                            : `${residentOptions.length} resident${residentOptions.length === 1 ? "" : "s"} ${residentSearchTerm ? "found" : "loaded"}`}
                                        {!residentSearchTerm ? " (type to narrow results)" : ""}
                                    </div>
                                    <div className="max-h-64 overflow-y-auto p-2">
                                        {residentsQuery.isLoading && residentOptions.length === 0 ? (
                                            <div className="px-2 py-4 text-sm text-zinc-500">Loading residents...</div>
                                        ) : residentOptions.length === 0 ? (
                                            <div className="px-2 py-4 text-sm text-zinc-500">
                                                {residentSearchTerm ? "No eligible residents match your search." : "No eligible residents available for a new contract."}
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                {residentOptions.map((resident) => {
                                                    const isSelected = resident.residentUserId === selectedResidentUserId;
                                                    const primaryLabel = resident.residentName || resident.residentEmail || resident.residentUserId;
                                                    const metaParts = [resident.residentEmail, resident.residentPhone].filter(Boolean);
                                                    return (
                                                        <button
                                                            key={resident.residentUserId}
                                                            type="button"
                                                            className={cn(
                                                                "flex w-full items-start justify-between gap-3 rounded-md border px-3 py-2 text-left",
                                                                isSelected
                                                                    ? "border-blue-200 bg-blue-50/40"
                                                                    : "border-zinc-200 bg-white hover:bg-zinc-50"
                                                            )}
                                                            onClick={() => {
                                                                form.setValue("residentUserId", resident.residentUserId, {
                                                                    shouldDirty: true,
                                                                    shouldValidate: true,
                                                                });
                                                                setResidentPickerOpen(false);
                                                            }}
                                                        >
                                                            <div className="min-w-0">
                                                                <div className="truncate text-sm font-medium text-zinc-900">
                                                                    {primaryLabel}
                                                                </div>
                                                                <div className="truncate text-xs text-zinc-500">
                                                                    {metaParts.join(" | ") || resident.residentUserId}
                                                                </div>
                                                            </div>
                                                            {isSelected ? <Check className="mt-0.5 h-4 w-4 text-blue-600" /> : null}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </PopoverContent>
                            </Popover>
                            {form.formState.errors.residentUserId ? (
                                <p className="text-xs text-rose-500">{form.formState.errors.residentUserId.message}</p>
                            ) : null}
                            {residentsQuery.isError ? (
                                <p className="text-xs text-rose-500">Failed to load residents.</p>
                            ) : null}
                        </div>

                        <div className="space-y-2">
                            <Label>Unit</Label>
                            <Popover open={unitPickerOpen} onOpenChange={setUnitPickerOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={unitPickerOpen}
                                        className="w-full justify-between font-normal"
                                    >
                                        <span className="truncate">{selectedUnitLabel}</span>
                                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-[var(--radix-popover-trigger-width)] p-0"
                                    align="start"
                                    onOpenAutoFocus={(event) => event.preventDefault()}
                                >
                                    <div className="flex items-center border-b px-3 py-2">
                                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                        <input
                                            type="text"
                                            placeholder="Search by unit, floor, or status..."
                                            value={unitSearchInput}
                                            onChange={(event) => setUnitSearchInput(event.target.value)}
                                            className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-zinc-400"
                                        />
                                        {unitSearchInput ? (
                                            <button
                                                type="button"
                                                onClick={() => setUnitSearchInput("")}
                                                className="ml-2 rounded-sm opacity-50 hover:opacity-100"
                                                aria-label="Clear unit search"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        ) : null}
                                    </div>
                                    <div className="border-b px-3 py-2 text-xs text-zinc-500">
                                        {unitsQuery.isFetching
                                            ? "Loading units..."
                                            : `${filteredUnitOptions.length} unit${filteredUnitOptions.length === 1 ? "" : "s"} ${unitSearchInput.trim() ? "found" : unitAvailableOnly ? "available" : "loaded"}`}
                                    </div>
                                    <div className="flex items-center gap-2 border-b px-3 py-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={unitAvailableOnly ? "default" : "outline"}
                                            className="h-7 px-2 text-xs"
                                            onClick={() => setUnitAvailableOnly(true)}
                                        >
                                            Available only
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={!unitAvailableOnly ? "default" : "outline"}
                                            className="h-7 px-2 text-xs"
                                            onClick={() => setUnitAvailableOnly(false)}
                                        >
                                            All units
                                        </Button>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto p-2">
                                        {unitsQuery.isLoading && filteredUnitOptions.length === 0 ? (
                                            <div className="px-2 py-4 text-sm text-zinc-500">Loading units...</div>
                                        ) : filteredUnitOptions.length === 0 ? (
                                            <div className="px-2 py-4 text-sm text-zinc-500">
                                                {unitSearchInput.trim() ? "No units match your search." : "No units available."}
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                {filteredUnitOptions.map((unit) => {
                                                    const isSelected = unit.id === selectedUnitId;
                                                    const occupancyStatus = unit.occupancy?.status ? `Occupancy: ${unit.occupancy.status}` : "No occupancy";
                                                    const floorText = unit.floor != null ? `Floor ${unit.floor}` : null;
                                                    return (
                                                        <button
                                                            key={unit.id}
                                                            type="button"
                                                            className={cn(
                                                                "flex w-full items-start justify-between gap-3 rounded-md border px-3 py-2 text-left",
                                                                isSelected
                                                                    ? "border-blue-200 bg-blue-50/40"
                                                                    : "border-zinc-200 bg-white hover:bg-zinc-50"
                                                            )}
                                                            onClick={() => {
                                                                form.setValue("unitId", unit.id, {
                                                                    shouldDirty: true,
                                                                    shouldValidate: true,
                                                                });
                                                                setUnitPickerOpen(false);
                                                            }}
                                                        >
                                                            <div className="min-w-0">
                                                                <div className="truncate text-sm font-medium text-zinc-900">
                                                                    Unit {unit.label}
                                                                </div>
                                                                <div className="truncate text-xs text-zinc-500">
                                                                    {[floorText, occupancyStatus].filter(Boolean).join(" | ")}
                                                                </div>
                                                            </div>
                                                            {isSelected ? <Check className="mt-0.5 h-4 w-4 text-blue-600" /> : null}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </PopoverContent>
                            </Popover>
                            {form.formState.errors.unitId ? (
                                <p className="text-xs text-rose-500">{form.formState.errors.unitId.message}</p>
                            ) : null}
                            {unitsQuery.isError ? (
                                <p className="text-xs text-rose-500">Failed to load units for this building.</p>
                            ) : null}
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                            <Label htmlFor="contractPeriodFrom">Contract Start</Label>
                            <Input id="contractPeriodFrom" type="date" {...form.register("contractPeriodFrom")} />
                            {form.formState.errors.contractPeriodFrom ? (
                                <p className="text-xs text-rose-500">{form.formState.errors.contractPeriodFrom.message}</p>
                            ) : null}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="contractPeriodTo">Contract End</Label>
                            <Input id="contractPeriodTo" type="date" {...form.register("contractPeriodTo")} />
                            {form.formState.errors.contractPeriodTo ? (
                                <p className="text-xs text-rose-500">{form.formState.errors.contractPeriodTo.message}</p>
                            ) : null}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="contractDate">Contract Date</Label>
                            <Input id="contractDate" type="date" {...form.register("contractDate")} />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                            <Label htmlFor="annualRent">Annual Rent</Label>
                            <Input id="annualRent" placeholder="48000.00" {...form.register("annualRent")} />
                            {form.formState.errors.annualRent ? (
                                <p className="text-xs text-rose-500">{form.formState.errors.annualRent.message}</p>
                            ) : null}
                        </div>
                        <div className="space-y-2">
                            <Label>Payment Frequency</Label>
                            <Select
                                value={selectedPaymentFrequency}
                                onValueChange={(value) =>
                                    form.setValue("paymentFrequency", value as PaymentFrequency, { shouldValidate: true })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
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
                            <Label htmlFor="numberOfCheques">Number Of Cheques</Label>
                            <Input id="numberOfCheques" placeholder="4" {...form.register("numberOfCheques")} />
                            {form.formState.errors.numberOfCheques ? (
                                <p className="text-xs text-rose-500">{form.formState.errors.numberOfCheques.message}</p>
                            ) : null}
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                            <Label htmlFor="securityDepositAmount">Security Deposit</Label>
                            <Input id="securityDepositAmount" placeholder="5000.00" {...form.register("securityDepositAmount")} />
                            {form.formState.errors.securityDepositAmount ? (
                                <p className="text-xs text-rose-500">{form.formState.errors.securityDepositAmount.message}</p>
                            ) : null}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="contractValue">Contract Value</Label>
                            <Input id="contractValue" placeholder="48000.00" {...form.register("contractValue")} />
                            {form.formState.errors.contractValue ? (
                                <p className="text-xs text-rose-500">{form.formState.errors.contractValue.message}</p>
                            ) : null}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="paymentModeText">Payment Mode Text</Label>
                            <Input id="paymentModeText" placeholder="4 cheques" {...form.register("paymentModeText")} />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="ijariId">Ijari ID</Label>
                            <Input id="ijariId" placeholder="EJARI-123" {...form.register("ijariId")} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="propertyUsage">Property Usage</Label>
                            <Input id="propertyUsage" placeholder="RESIDENTIAL" {...form.register("propertyUsage")} />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                            <Label htmlFor="tenantNameSnapshot">Tenant Name Snapshot</Label>
                            <Input id="tenantNameSnapshot" {...form.register("tenantNameSnapshot")} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="tenantEmailSnapshot">Tenant Email Snapshot</Label>
                            <Input id="tenantEmailSnapshot" {...form.register("tenantEmailSnapshot")} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="tenantPhoneSnapshot">Tenant Phone Snapshot</Label>
                            <Input id="tenantPhoneSnapshot" {...form.register("tenantPhoneSnapshot")} />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="ownerNameSnapshot">Owner Name Snapshot</Label>
                            <Input id="ownerNameSnapshot" {...form.register("ownerNameSnapshot")} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="landlordNameSnapshot">Landlord Name Snapshot</Label>
                            <Input id="landlordNameSnapshot" {...form.register("landlordNameSnapshot")} />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="locationCommunity">Community</Label>
                            <Input id="locationCommunity" {...form.register("locationCommunity")} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="propertyTypeLabel">Property Type Label</Label>
                            <Input id="propertyTypeLabel" {...form.register("propertyTypeLabel")} />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-4">
                        <div className="space-y-2">
                            <Label htmlFor="propertySizeSqm">Property Size (sqm)</Label>
                            <Input id="propertySizeSqm" {...form.register("propertySizeSqm")} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="propertyNumber">Property Number</Label>
                            <Input id="propertyNumber" {...form.register("propertyNumber")} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="premisesNoDewa">Premises No Dewa</Label>
                            <Input id="premisesNoDewa" {...form.register("premisesNoDewa")} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="plotNo">Plot No</Label>
                            <Input id="plotNo" {...form.register("plotNo")} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="additionalTermsText">Additional Terms (one term per line)</Label>
                        <Textarea
                            id="additionalTermsText"
                            rows={4}
                            placeholder={"No subletting\nPets allowed with approval"}
                            {...form.register("additionalTermsText")}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={createContractMutation.isPending}>
                            {createContractMutation.isPending ? "Creating..." : "Create Draft Contract"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
