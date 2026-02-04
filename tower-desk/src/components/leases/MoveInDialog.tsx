"use client";

import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
    User,
    Home,
    Calendar,
    Shield,
    Car,
    Key,
    FileText,
    Users,
    ChevronLeft,
    CheckCircle2,
    ChevronDown,
} from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { VirtualizedParkingSlotSelect } from "@/components/buildings/VirtualizedParkingSlotSelect";
import { VirtualizedUnitSelect } from "@/components/buildings/VirtualizedUnitSelect";
import { useBuildingResidents, useBuildingUnits, useMoveIn, useMoveOut, useOrgResidents, useParkingSlots } from "@/lib/queries";
import { uploadToCloudinary } from "@/lib/cloudinary";
import type { BuildingUnit, LeaseDocumentType, PaymentFrequency } from "@/lib/types";

interface MoveInDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    buildingId: string;
    unitId?: string;
    unitLabel?: string;
    defaultResidentUserId?: string;
    defaultResidentName?: string;
    defaultResidentEmail?: string;
    transferFrom?: {
        leaseId?: string;
        unitId?: string;
        unitLabel?: string;
    };
    mode?: "moveIn" | "transfer";
}

/* ------------------------------------------------------------------ */
/*  Schemas                                                            */
/* ------------------------------------------------------------------ */

const documentSchema = z.object({
    type: z.enum(["EMIRATES_ID_COPY", "PASSPORT_COPY", "SIGNED_TENANCY_CONTRACT", "CHEQUE_COPY", "OTHER"]),
    fileName: z.string().optional(),
    url: z.string().optional(),
    mimeType: z.string().optional(),
    sizeBytes: z.number().optional(),
});

const moveInSchema = z
    .object({
        residentMode: z.enum(["new", "existing"]),
        residentUserId: z.string().optional(),
        residentName: z.string().optional(),
        residentEmail: z.string().optional(),
        residentPhone: z.string().optional(),
        residentPassword: z.string().optional(),
        unitId: z.string().min(1, "Unit is required"),
        leaseStartDate: z.string().min(1, "Start date is required"),
        leaseEndDate: z.string().min(1, "End date is required"),
        annualRent: z.string().min(1, "Annual rent is required"),
        paymentFrequency: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]),
        securityDepositAmount: z.string().min(1, "Security deposit is required"),
        tenancyRegistrationExpiry: z.string().optional(),
        noticeGivenDate: z.string().optional(),
        residentProfile: z
            .object({
                emiratesIdNumber: z.string().optional(),
                passportNumber: z.string().optional(),
                nationality: z.string().optional(),
                dateOfBirth: z.string().optional(),
                currentAddress: z.string().optional(),
                emergencyContactName: z.string().optional(),
                emergencyContactPhone: z.string().optional(),
            })
            .optional(),
        occupants: z
            .array(
                z.object({
                    name: z.string().trim().min(1, "Occupant name is required"),
                })
            )
            .optional(),
        parkingSlotIds: z.array(z.string()).optional(),
        vehiclePlateNumbers: z.array(z.string().optional()).optional(),
        accessCardNumbers: z.array(z.string().optional()).optional(),
        parkingStickerNumbers: z.array(z.string().optional()).optional(),
        documents: z.array(documentSchema).optional(),
    })
    .superRefine((data, ctx) => {
        if (data.residentMode === "existing") {
            if (!data.residentUserId || data.residentUserId.trim().length === 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["residentUserId"],
                    message: "Select a resident to link",
                });
            }
            return;
        }

        if (!data.residentName || data.residentName.trim().length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["residentName"],
                message: "Resident name is required",
            });
        }
        if (!data.residentEmail || data.residentEmail.trim().length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["residentEmail"],
                message: "Resident email is required",
            });
        }

        const occupantNames = (data.occupants || [])
            .map((entry) => entry?.name?.trim())
            .filter(Boolean) as string[];
        if (occupantNames.length > 0) {
            const seen = new Set<string>();
            occupantNames.forEach((name, idx) => {
                const key = name.toLowerCase();
                if (seen.has(key)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["occupants", idx, "name"],
                        message: "Duplicate occupant name",
                    });
                } else {
                    seen.add(key);
                }
            });
        }
    });

type MoveInFormData = z.infer<typeof moveInSchema>;

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PAYMENT_FREQUENCIES: { value: PaymentFrequency; label: string }[] = [
    { value: "MONTHLY", label: "Monthly" },
    { value: "QUARTERLY", label: "Quarterly" },
    { value: "SEMI_ANNUAL", label: "Semi-Annual" },
    { value: "ANNUAL", label: "Annual" },
];

const DOCUMENT_TYPES: { value: LeaseDocumentType; label: string }[] = [
    { value: "EMIRATES_ID_COPY", label: "Emirates ID Copy" },
    { value: "PASSPORT_COPY", label: "Passport Copy" },
    { value: "SIGNED_TENANCY_CONTRACT", label: "Signed Tenancy Contract" },
    { value: "CHEQUE_COPY", label: "Cheque Copy" },
    { value: "OTHER", label: "Other" },
];

const parseMultiline = (value?: string) =>
    (value ?? "")
        .split("\n")
        .map((entry) => entry.trim())
        .filter(Boolean);

const dedupeCaseInsensitive = (values: string[]) =>
    values.filter(
        (value, index, arr) =>
            arr.findIndex((entry) => entry.toLowerCase() === value.toLowerCase()) === index
    );

/* ------------------------------------------------------------------ */
/*  Helper components                                                  */
/* ------------------------------------------------------------------ */

function SectionCard({
    icon: Icon,
    title,
    children,
}: {
    icon: React.ElementType;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-zinc-400" />
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {title}
                </div>
            </div>
            <Separator />
            <div className="space-y-4">{children}</div>
        </div>
    );
}

function SummaryRow({ label, value }: { label: string; value?: string | null }) {
    if (!value || !value.trim()) return null;
    return (
        <div className="flex justify-between gap-4 text-sm">
            <span className="text-zinc-500 shrink-0">{label}</span>
            <span className="text-zinc-900 text-right">{value}</span>
        </div>
    );
}

function SummaryList({ label, items }: { label: string; items: string[] }) {
    if (items.length === 0) return null;
    return (
        <div className="space-y-1">
            <span className="text-xs text-zinc-500">{label}</span>
            <div className="flex flex-wrap gap-1">
                {items.map((item, i) => (
                    <span key={i} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                        {item}
                    </span>
                ))}
            </div>
        </div>
    );
}

function getDocUploadErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) return error.message;
    return "Failed to upload document";
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function MoveInDialog({
    open,
    onOpenChange,
    buildingId,
    unitId,
    unitLabel,
    defaultResidentUserId,
    defaultResidentName,
    defaultResidentEmail,
    transferFrom,
    mode = "moveIn",
}: MoveInDialogProps) {
    const moveIn = useMoveIn();
    const moveOut = useMoveOut();
    const canSelectUnit = !unitId;
    const isTransfer = mode === "transfer";

    const [phase, setPhase] = useState<"form" | "review">("form");
    const [selectedParkingSlotIds, setSelectedParkingSlotIds] = useState<string[]>([]);
    const [showOccupants, setShowOccupants] = useState(false);
    const [showParkingVehicles, setShowParkingVehicles] = useState(false);
    const [uploadingDocs, setUploadingDocs] = useState<Record<number, boolean>>({});

    /* ---- Queries ---- */

    const { data: availableUnits, isLoading: isUnitsLoading } = useBuildingUnits(buildingId, {
        available: true,
        enabled: open && canSelectUnit,
    });

    const { data: residents, isLoading: isResidentsLoading } = useBuildingResidents(buildingId, {
        enabled: open,
    });
    const { data: orgResidents, isLoading: isOrgResidentsLoading } = useOrgResidents(
        {
            status: "ALL",
            limit: 200,
        },
        { enabled: open }
    );

    const {
        data: vacantSlotsRaw,
        isLoading: isVacantSlotsLoading,
        error: vacantSlotsError,
    } = useParkingSlots(buildingId, {
        available: true,
        enabled: open && Boolean(buildingId),
    });

    const vacantSlots = useMemo(
        () => (vacantSlotsRaw || []).filter((slot) => slot.isActive !== false),
        [vacantSlotsRaw]
    );

    /* ---- Derived data ---- */

    const unitList: BuildingUnit[] = useMemo(() => availableUnits || [], [availableUnits]);

    const unitOptions = useMemo(
        () => unitList.map((entry) => ({ id: entry.id, label: entry.label })),
        [unitList]
    );

    const residentOptions = useMemo(() => {
        const orgOptions = (orgResidents?.items || [])
            .filter((resident) => (isTransfer ? resident.hasActiveOccupancy : !resident.hasActiveOccupancy))
            .map((resident) => ({
                id: resident.user.id,
                label: `${resident.user.name || resident.user.email} ${resident.user.email ? `(${resident.user.email})` : ""}`.trim(),
            }));
        const buildingOptions = (residents || []).map((resident) => ({
            id: resident.userId,
            label: `${resident.name || resident.email} ${resident.email ? `(${resident.email})` : ""}`.trim(),
        }));
        const uniqueById = new Map<string, (typeof buildingOptions)[number]>();
        const source = orgOptions.length > 0 ? orgOptions : buildingOptions;
        source.forEach((option) => {
            if (!uniqueById.has(option.id)) {
                uniqueById.set(option.id, option);
            }
        });
        if (defaultResidentUserId && !uniqueById.has(defaultResidentUserId)) {
            uniqueById.set(defaultResidentUserId, {
                id: defaultResidentUserId,
                label: `${defaultResidentName || defaultResidentEmail || defaultResidentUserId}`,
            });
        }
        return Array.from(uniqueById.values());
    }, [
        orgResidents?.items,
        residents,
        isTransfer,
        defaultResidentUserId,
        defaultResidentName,
        defaultResidentEmail,
    ]);
    const isResidentOptionsLoading = isOrgResidentsLoading || isResidentsLoading;

    /* ---- Form ---- */

    const form = useForm<MoveInFormData>({
        resolver: zodResolver(moveInSchema),
        defaultValues: {
            residentMode: isTransfer ? "existing" : (defaultResidentUserId ? "existing" : "new"),
            residentUserId: defaultResidentUserId ?? "",
            residentName: "",
            residentEmail: defaultResidentEmail ?? "",
            residentPhone: "",
            residentPassword: "",
            unitId: unitId ?? "",
            leaseStartDate: "",
            leaseEndDate: "",
            annualRent: "",
            paymentFrequency: "MONTHLY",
            securityDepositAmount: "",
            tenancyRegistrationExpiry: "",
            noticeGivenDate: "",
            residentProfile: {
                emiratesIdNumber: "",
                passportNumber: "",
                nationality: "",
                dateOfBirth: "",
                currentAddress: "",
                emergencyContactName: "",
                emergencyContactPhone: "",
            },
            occupants: [],
            parkingSlotIds: [],
            vehiclePlateNumbers: [],
            accessCardNumbers: [],
            parkingStickerNumbers: [],
            documents: [],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "documents",
    });
    const {
        fields: occupantFields,
        append: appendOccupant,
        remove: removeOccupant,
    } = useFieldArray({
        control: form.control,
        name: "occupants",
    });

    const residentMode = form.watch("residentMode");
    const selectedUnitId = form.watch("unitId");

    const selectedUnit = useMemo(
        () => unitList.find((u) => u.id === selectedUnitId) ?? null,
        [unitList, selectedUnitId]
    );

    /* ---- Sync parking slot IDs to form ---- */

    useEffect(() => {
        form.setValue("parkingSlotIds", selectedParkingSlotIds);
    }, [selectedParkingSlotIds, form]);

    useEffect(() => {
        const current = form.getValues("vehiclePlateNumbers") || [];
        const targetLength = selectedParkingSlotIds.length;
        if (targetLength === 0) {
            if (current.length > 0) {
                form.setValue("vehiclePlateNumbers", []);
            }
            return;
        }
        if (current.length === targetLength) return;
        const next = Array.from({ length: targetLength }, (_, idx) => current[idx] ?? "");
        form.setValue("vehiclePlateNumbers", next);
    }, [selectedParkingSlotIds, form]);

    useEffect(() => {
        const current = form.getValues("parkingStickerNumbers") || [];
        const targetLength = selectedParkingSlotIds.length;
        if (targetLength === 0) {
            if (current.length > 0) {
                form.setValue("parkingStickerNumbers", []);
            }
            return;
        }
        if (current.length === targetLength) return;
        const next = Array.from({ length: targetLength }, (_, idx) => current[idx] ?? "");
        form.setValue("parkingStickerNumbers", next);
    }, [selectedParkingSlotIds, form]);

    /* ---- Reset effects ---- */

    useEffect(() => {
        if (!open) return;
        setPhase("form");
        setSelectedParkingSlotIds([]);
        form.reset({
            residentMode: isTransfer ? "existing" : (defaultResidentUserId ? "existing" : "new"),
            residentUserId: defaultResidentUserId ?? "",
            residentName: "",
            residentEmail: defaultResidentEmail ?? "",
            residentPhone: "",
            residentPassword: "",
            unitId: unitId ?? "",
            leaseStartDate: "",
            leaseEndDate: "",
            annualRent: "",
            paymentFrequency: "MONTHLY",
            securityDepositAmount: "",
            tenancyRegistrationExpiry: "",
            noticeGivenDate: "",
            residentProfile: {
                emiratesIdNumber: "",
                passportNumber: "",
                nationality: "",
                dateOfBirth: "",
                currentAddress: "",
                emergencyContactName: "",
                emergencyContactPhone: "",
            },
            occupants: [],
            parkingSlotIds: [],
            vehiclePlateNumbers: [],
            accessCardNumbers: [],
            parkingStickerNumbers: [],
            documents: [],
        });
    }, [open, form, unitId, defaultResidentUserId, defaultResidentEmail, isTransfer]);

    useEffect(() => {
        if (!open || !unitId) return;
        form.setValue("unitId", unitId);
    }, [open, unitId, form]);

    useEffect(() => {
        if (!open || !canSelectUnit || unitOptions.length === 0) return;
        if (!form.getValues("unitId")) {
            form.setValue("unitId", unitOptions[0].id);
        }
    }, [open, canSelectUnit, unitOptions, form]);

    useEffect(() => {
        if (!open || isTransfer) return;
        if (residentMode === "existing") {
            form.setValue("residentName", "");
            form.setValue("residentEmail", "");
            form.setValue("residentPhone", "");
            form.setValue("residentPassword", "");
        } else {
            form.setValue("residentUserId", "");
        }
    }, [residentMode, open, form, isTransfer]);

    useEffect(() => {
        if (!open || residentMode !== "existing" || residentOptions.length === 0) return;
        if (!form.getValues("residentUserId")) {
            form.setValue("residentUserId", residentOptions[0].id);
        }
    }, [open, residentMode, residentOptions, form]);

    useEffect(() => {
        if (!open || !isTransfer) return;
        form.setValue("residentMode", "existing");
        if (defaultResidentUserId) {
            form.setValue("residentUserId", defaultResidentUserId);
        }
    }, [open, isTransfer, form, defaultResidentUserId]);

    /* ---- Auto-fill from selected unit ---- */

    useEffect(() => {
        if (!selectedUnit) return;
        if (selectedUnit.rentAnnual != null) {
            form.setValue("annualRent", String(selectedUnit.rentAnnual));
        }
        if (selectedUnit.securityDepositAmount != null) {
            form.setValue("securityDepositAmount", String(selectedUnit.securityDepositAmount));
        }
        if (selectedUnit.paymentFrequency) {
            form.setValue("paymentFrequency", selectedUnit.paymentFrequency);
        }
    }, [selectedUnit, form]);

    /* ---- Derived labels ---- */

    const selectedUnitLabel = useMemo(() => {
        if (unitLabel) return unitLabel;
        const match = unitOptions.find((option) => option.id === selectedUnitId);
        return match?.label || selectedUnitId || unitId || "";
    }, [unitLabel, unitOptions, selectedUnitId, unitId]);

    /* ---- Handlers ---- */

    const handleReview = async (_data: MoveInFormData) => {
        setPhase("review");
    };

    useEffect(() => {
        if (!open) return;
        setShowOccupants(false);
        setShowParkingVehicles(false);
    }, [open]);

    const onSubmit = async (data: MoveInFormData) => {
        const occupantNames = dedupeCaseInsensitive(
            (data.occupants || [])
                .map((entry) => (entry?.name ?? "").trim())
                .filter(Boolean)
        );
        const parkingSlotIds = data.parkingSlotIds ?? [];
        const vehiclePlateNumbers = (data.vehiclePlateNumbers || [])
            .map((entry) => (entry ?? "").trim())
            .filter(Boolean);
        const accessCardNumbers = (data.accessCardNumbers || [])
            .map((entry) => (entry ?? "").trim())
            .filter(Boolean);
        const parkingStickerNumbers = (data.parkingStickerNumbers || [])
            .map((entry) => (entry ?? "").trim())
            .filter(Boolean);

        const documents = (data.documents || [])
            .map((doc) => ({
                type: doc.type,
                fileName: (doc.fileName ?? "").trim(),
                url: (doc.url ?? "").trim(),
                mimeType: (doc.mimeType ?? "").trim(),
                sizeBytes: doc.sizeBytes,
            }))
            .filter((doc) => doc.fileName && doc.url && doc.mimeType && typeof doc.sizeBytes === "number");

        const profile = data.residentProfile ?? {};
        const hasProfile = Object.values(profile).some((value) => Boolean(value && String(value).trim()));

        const dto: any = {
            unitId: unitId ?? data.unitId,
            leaseStartDate: data.leaseStartDate,
            leaseEndDate: data.leaseEndDate,
            annualRent: data.annualRent,
            paymentFrequency: data.paymentFrequency,
            securityDepositAmount: data.securityDepositAmount,
        };

        if (data.residentMode === "existing") {
            dto.residentUserId = data.residentUserId?.trim();
        } else {
            dto.resident = {
                name: data.residentName?.trim(),
                email: data.residentEmail?.trim(),
                phone: data.residentPhone?.trim() || undefined,
                password: data.residentPassword?.trim() || undefined,
            };
        }

        if (hasProfile) {
            dto.residentProfile = {
                emiratesIdNumber: profile.emiratesIdNumber?.trim() || undefined,
                passportNumber: profile.passportNumber?.trim() || undefined,
                nationality: profile.nationality?.trim() || undefined,
                dateOfBirth: profile.dateOfBirth || undefined,
                currentAddress: profile.currentAddress?.trim() || undefined,
                emergencyContactName: profile.emergencyContactName?.trim() || undefined,
                emergencyContactPhone: profile.emergencyContactPhone?.trim() || undefined,
            };
        }

        if (occupantNames.length > 0) dto.occupantNames = occupantNames;
        if (parkingSlotIds.length > 0) dto.parkingSlotIds = parkingSlotIds;
        if (vehiclePlateNumbers.length > 0) dto.vehiclePlateNumbers = vehiclePlateNumbers;
        if (accessCardNumbers.length > 0) dto.accessCardNumbers = accessCardNumbers;
        if (parkingStickerNumbers.length > 0) dto.parkingStickerNumbers = parkingStickerNumbers;
        if (documents.length > 0) dto.documents = documents;
        if (data.tenancyRegistrationExpiry?.trim()) {
            dto.tenancyRegistrationExpiry = data.tenancyRegistrationExpiry;
        }
        if (data.noticeGivenDate?.trim()) {
            dto.noticeGivenDate = data.noticeGivenDate;
        }

        try {
            if (transferFrom?.leaseId && transferFrom?.unitId) {
                await moveOut.mutateAsync({
                    buildingId,
                    leaseId: transferFrom.leaseId,
                    unitId: transferFrom.unitId,
                    dto: {
                        actualMoveOutDate: data.leaseStartDate,
                        adminNotes: "Transferred to another unit",
                        markAllAccessCardsReturned: true,
                        markAllParkingStickersReturned: true,
                    },
                });
            }
            await moveIn.mutateAsync({
                buildingId,
                dto,
            });
            toast.success("Move-in completed successfully");
            form.reset();
            onOpenChange(false);
        } catch (err) {
            const status = (err as { status?: number })?.status;
            const rawMessage = err instanceof Error ? err.message : "Failed to complete move-in";
            let message = rawMessage;

            if (status === 409) {
                if (/unit/i.test(rawMessage) && /(active|occupancy|occupied)/i.test(rawMessage)) {
                    message = "This unit was just occupied by someone else. Refresh and pick another unit.";
                } else if (/resident/i.test(rawMessage) && /(active|occupancy)/i.test(rawMessage)) {
                    message = "This tenant is already assigned to a unit. Use Transfer Unit.";
                } else if (/lease/i.test(rawMessage)) {
                    message = "A lease already exists for this occupancy. Refresh.";
                } else if (/duplicate value/i.test(rawMessage)) {
                    message = "Conflict detected. Refresh and try again.";
                } else {
                    message = "Conflict detected. Refresh and try again.";
                }
            } else if (status === 400) {
                message = "Something is inconsistent. Contact support.";
            }

            toast.error(message);
            setPhase("form");
        }
    };

    /* ---- Review data ---- */

    const reviewValues = form.getValues();
    const reviewOccupants = dedupeCaseInsensitive(
        (reviewValues.occupants || [])
            .map((entry) => (entry?.name ?? "").trim())
            .filter(Boolean)
    );
    const reviewVehicles = (reviewValues.vehiclePlateNumbers || [])
        .map((entry) => (entry ?? "").trim())
        .filter(Boolean);
    const reviewAccessCards = (reviewValues.accessCardNumbers || [])
        .map((entry) => (entry ?? "").trim())
        .filter(Boolean);
    const reviewParkingStickers = (reviewValues.parkingStickerNumbers || [])
        .map((entry) => (entry ?? "").trim())
        .filter(Boolean);
    const reviewProfile = reviewValues.residentProfile ?? {};
    const hasReviewProfile = Object.values(reviewProfile).some((v) => Boolean(v && String(v).trim()));
    const reviewDocs = (reviewValues.documents || []).filter((d) => d.fileName?.trim() || d.url?.trim());
    const hasLeaseExtras = Boolean(reviewValues.tenancyRegistrationExpiry?.trim() || reviewValues.noticeGivenDate?.trim());
    const isUploadingDocs = useMemo(
        () => Object.values(uploadingDocs).some(Boolean),
        [uploadingDocs]
    );

    /* ================================================================ */
    /*  RENDER                                                          */
    /* ================================================================ */

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[920px] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>
                        {isTransfer ? "Transfer Unit" : "Move In"}{selectedUnitLabel ? ` - Unit ${selectedUnitLabel}` : ""}
                    </DialogTitle>
                    <DialogDescription>
                        {isTransfer
                            ? "Move this resident to another unit. The current lease will be ended and a new lease will be created."
                            : "Create a new lease for this unit. Enter the resident and lease details."}
                    </DialogDescription>
                </DialogHeader>

                {/* ============================================= */}
                {/*  FORM PHASE                                    */}
                {/* ============================================= */}
                {phase === "form" ? (
                    <form onSubmit={form.handleSubmit(handleReview)} className="flex-1 overflow-y-auto space-y-4 pr-1">

                        {/* ---- Section 1: Resident ---- */}
                        <SectionCard icon={User} title="Resident">
                            {isTransfer ? (
                                <div className="rounded-lg border border-zinc-200 bg-white p-3 text-sm">
                                    <div className="font-medium text-zinc-800">
                                        {defaultResidentName || defaultResidentEmail || "Selected resident"}
                                    </div>
                                    {defaultResidentEmail ? (
                                        <div className="text-xs text-zinc-500">{defaultResidentEmail}</div>
                                    ) : null}
                                    {transferFrom?.unitLabel || transferFrom?.unitId ? (
                                        <div className="mt-2 text-xs text-zinc-500">
                                            Current Unit {transferFrom?.unitLabel || transferFrom?.unitId}
                                        </div>
                                    ) : null}
                                    {!transferFrom?.leaseId ? (
                                        <div className="mt-2 text-xs text-amber-600">
                                            No active lease found. This will create a new lease without moving out.
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            variant={residentMode === "new" ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => form.setValue("residentMode", "new")}
                                        >
                                            Create new resident
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={residentMode === "existing" ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => form.setValue("residentMode", "existing")}
                                        >
                                            Link existing resident
                                        </Button>
                                    </div>

                                    {residentMode === "existing" ? (
                                        <div className="space-y-2">
                                            <Label htmlFor="residentUserId">Resident *</Label>
                                            <Select
                                                value={form.watch("residentUserId")}
                                                onValueChange={(value) => form.setValue("residentUserId", value)}
                                                disabled={isResidentOptionsLoading}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder={isResidentOptionsLoading ? "Loading residents..." : "Select resident"} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {residentOptions.length === 0 && !isResidentOptionsLoading ? (
                                                        <SelectItem value="none" disabled>
                                                            No residents found
                                                        </SelectItem>
                                                    ) : (
                                                        residentOptions.map((resident) => (
                                                            <SelectItem key={resident.id} value={resident.id}>
                                                                {resident.label}
                                                            </SelectItem>
                                                        ))
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            {form.formState.errors.residentUserId && (
                                                <p className="text-xs text-rose-500">{form.formState.errors.residentUserId.message}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label htmlFor="residentName">Name *</Label>
                                                    <Input
                                                        id="residentName"
                                                        placeholder="Full name"
                                                        {...form.register("residentName")}
                                                    />
                                                    {form.formState.errors.residentName && (
                                                        <p className="text-xs text-rose-500">{form.formState.errors.residentName.message}</p>
                                                    )}
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="residentEmail">Email *</Label>
                                                    <Input
                                                        id="residentEmail"
                                                        type="email"
                                                        placeholder="email@example.com"
                                                        {...form.register("residentEmail")}
                                                    />
                                                    {form.formState.errors.residentEmail && (
                                                        <p className="text-xs text-rose-500">{form.formState.errors.residentEmail.message}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label htmlFor="residentPhone">Phone</Label>
                                                    <Input
                                                        id="residentPhone"
                                                        placeholder="+971..."
                                                        {...form.register("residentPhone")}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="residentPassword">Password</Label>
                                                    <Input
                                                        id="residentPassword"
                                                        type="password"
                                                        placeholder="Set initial password"
                                                        {...form.register("residentPassword")}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </SectionCard>

                        {/* ---- Section 2: Lease Details ---- */}
                        <SectionCard icon={Calendar} title="Lease Details">
                            {canSelectUnit ? (
                                <div className="space-y-2">
                                    <Label>{isTransfer ? "Transfer To Unit *" : "Unit *"}</Label>
                                    <VirtualizedUnitSelect
                                        units={unitList}
                                        selectedId={selectedUnitId}
                                        onSelect={(id) => form.setValue("unitId", id)}
                                        isLoading={isUnitsLoading}
                                        placeholder={isTransfer ? "Select destination unit" : "Select unit"}
                                    />
                                    {form.formState.errors.unitId && (
                                        <p className="text-xs text-rose-500">{form.formState.errors.unitId.message}</p>
                                    )}
                                </div>
                            ) : null}

                            {/* Unit details card */}
                            {selectedUnit && (
                                <div className="rounded-lg border border-zinc-200 bg-white p-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Home className="h-3.5 w-3.5 text-zinc-400" />
                                        <span className="text-xs font-semibold text-zinc-700">Unit Details</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                                        {selectedUnit.floor != null && (
                                            <div><span className="text-zinc-400">Floor</span> <span className="text-zinc-700">{selectedUnit.floor}</span></div>
                                        )}
                                        {selectedUnit.bedrooms != null && (
                                            <div><span className="text-zinc-400">Bedrooms</span> <span className="text-zinc-700">{selectedUnit.bedrooms}</span></div>
                                        )}
                                        {selectedUnit.bathrooms != null && (
                                            <div><span className="text-zinc-400">Bathrooms</span> <span className="text-zinc-700">{selectedUnit.bathrooms}</span></div>
                                        )}
                                        {selectedUnit.unitSize != null && (
                                            <div><span className="text-zinc-400">Size</span> <span className="text-zinc-700">{selectedUnit.unitSize} {selectedUnit.unitSizeUnit === "SQ_FT" ? "sqft" : "sqm"}</span></div>
                                        )}
                                        {selectedUnit.furnishedStatus && (
                                            <div><span className="text-zinc-400">Furnished</span> <span className="text-zinc-700">{
                                                ({ UNFURNISHED: "No", SEMI_FURNISHED: "Semi", FULLY_FURNISHED: "Yes" } as Record<string, string>)[selectedUnit.furnishedStatus] ?? selectedUnit.furnishedStatus
                                            }</span></div>
                                        )}
                                        {selectedUnit.status && (
                                            <div><span className="text-zinc-400">Status</span> <span className="text-zinc-700">{selectedUnit.status.charAt(0) + selectedUnit.status.slice(1).toLowerCase().replace(/_/g, " ")}</span></div>
                                        )}
                                        {selectedUnit.balcony != null && (
                                            <div><span className="text-zinc-400">Balcony</span> <span className="text-zinc-700">{selectedUnit.balcony ? "Yes" : "No"}</span></div>
                                        )}
                                        {selectedUnit.kitchenType && (
                                            <div><span className="text-zinc-400">Kitchen</span> <span className="text-zinc-700">{selectedUnit.kitchenType.charAt(0) + selectedUnit.kitchenType.slice(1).toLowerCase()}</span></div>
                                        )}
                                    </div>
                                    {(selectedUnit.rentAnnual != null || selectedUnit.securityDepositAmount != null) && (
                                        <div className="border-t border-zinc-100 pt-2 mt-1 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                                            {selectedUnit.rentAnnual != null && (
                                                <div><span className="text-zinc-400">Rent/yr</span> <span className="text-zinc-700">AED {selectedUnit.rentAnnual.toLocaleString()}</span></div>
                                            )}
                                            {selectedUnit.securityDepositAmount != null && (
                                                <div><span className="text-zinc-400">Deposit</span> <span className="text-zinc-700">AED {selectedUnit.securityDepositAmount.toLocaleString()}</span></div>
                                            )}
                                            {selectedUnit.paymentFrequency && (
                                                <div><span className="text-zinc-400">Frequency</span> <span className="text-zinc-700">{PAYMENT_FREQUENCIES.find((f) => f.value === selectedUnit.paymentFrequency)?.label ?? selectedUnit.paymentFrequency}</span></div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="leaseStartDate">Start Date *</Label>
                                    <Input id="leaseStartDate" type="date" {...form.register("leaseStartDate")} />
                                    {form.formState.errors.leaseStartDate && (
                                        <p className="text-xs text-rose-500">{form.formState.errors.leaseStartDate.message}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="leaseEndDate">End Date *</Label>
                                    <Input id="leaseEndDate" type="date" {...form.register("leaseEndDate")} />
                                    {form.formState.errors.leaseEndDate && (
                                        <p className="text-xs text-rose-500">{form.formState.errors.leaseEndDate.message}</p>
                                    )}
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="annualRent">Annual Rent *</Label>
                                    <Input
                                        id="annualRent"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        {...form.register("annualRent")}
                                    />
                                    {form.formState.errors.annualRent && (
                                        <p className="text-xs text-rose-500">{form.formState.errors.annualRent.message}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="securityDepositAmount">Security Deposit *</Label>
                                    <Input
                                        id="securityDepositAmount"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        {...form.register("securityDepositAmount")}
                                    />
                                    {form.formState.errors.securityDepositAmount && (
                                        <p className="text-xs text-rose-500">{form.formState.errors.securityDepositAmount.message}</p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="paymentFrequency">Payment Frequency *</Label>
                                <Select
                                    value={form.watch("paymentFrequency")}
                                    onValueChange={(value) => form.setValue("paymentFrequency", value as PaymentFrequency)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select frequency" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PAYMENT_FREQUENCIES.map((freq) => (
                                            <SelectItem key={freq.value} value={freq.value}>
                                                {freq.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </SectionCard>

                        {/* ---- Section 3: Lease Extras ---- */}
                        <SectionCard icon={Shield} title="Lease Extras">
                            <div className="grid gap-4 sm:grid-cols-2">
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
                                    <Input
                                        id="noticeGivenDate"
                                        type="date"
                                        {...form.register("noticeGivenDate")}
                                    />
                                </div>
                            </div>
                        </SectionCard>

                        {/* ---- Section 4: Resident Profile ---- */}
                        <SectionCard icon={User} title="Resident Profile">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="residentProfile.emiratesIdNumber">Emirates ID</Label>
                                    <Input id="residentProfile.emiratesIdNumber" {...form.register("residentProfile.emiratesIdNumber")} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="residentProfile.passportNumber">Passport Number</Label>
                                    <Input id="residentProfile.passportNumber" {...form.register("residentProfile.passportNumber")} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="residentProfile.nationality">Nationality</Label>
                                    <Input id="residentProfile.nationality" {...form.register("residentProfile.nationality")} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="residentProfile.dateOfBirth">Date of Birth</Label>
                                    <Input id="residentProfile.dateOfBirth" type="date" {...form.register("residentProfile.dateOfBirth")} />
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label htmlFor="residentProfile.currentAddress">Current Address</Label>
                                    <Input id="residentProfile.currentAddress" {...form.register("residentProfile.currentAddress")} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="residentProfile.emergencyContactName">Emergency Contact Name</Label>
                                    <Input id="residentProfile.emergencyContactName" {...form.register("residentProfile.emergencyContactName")} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="residentProfile.emergencyContactPhone">Emergency Contact Phone</Label>
                                    <Input id="residentProfile.emergencyContactPhone" {...form.register("residentProfile.emergencyContactPhone")} />
                                </div>
                            </div>
                        </SectionCard>

                        {/* ---- Section 5: Occupants ---- */}
                        <SectionCard icon={Users} title="Occupants">
                            <button
                                type="button"
                                className="flex w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                                onClick={() => {
                                    const next = !showOccupants;
                                    setShowOccupants(next);
                                    if (next && occupantFields.length === 0) {
                                        appendOccupant({ name: "" });
                                    }
                                }}
                            >
                                <span>{showOccupants ? "Hide occupants" : "Add occupants"}</span>
                                <ChevronDown className={showOccupants ? "h-4 w-4 rotate-180" : "h-4 w-4"} />
                            </button>

                            {showOccupants ? (
                                <div className="space-y-3">
                                    {occupantFields.length === 0 ? (
                                        <div className="text-xs text-zinc-500">No occupants added yet.</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {occupantFields.map((field, index) => (
                                                <div key={field.id} className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            placeholder={`Occupant ${index + 1} name`}
                                                            {...form.register(`occupants.${index}.name` as const)}
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => removeOccupant(index)}
                                                        >
                                                            Remove
                                                        </Button>
                                                    </div>
                                                    {form.formState.errors.occupants?.[index]?.name ? (
                                                        <div className="text-xs text-rose-500">
                                                            {form.formState.errors.occupants[index]?.name?.message}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => appendOccupant({ name: "" })}
                                        >
                                            Add Occupant
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setShowOccupants(false);
                                                if (occupantFields.length > 0) {
                                                    removeOccupant(occupantFields.map((_, idx) => idx));
                                                }
                                            }}
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                </div>
                            ) : null}
                        </SectionCard>

                        {/* ---- Section 6: Parking & Vehicles ---- */}
                        <SectionCard icon={Car} title="Parking & Vehicles">
                            <button
                                type="button"
                                className="flex w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                                onClick={() => {
                                    const next = !showParkingVehicles;
                                    setShowParkingVehicles(next);
                                }}
                            >
                                <span>{showParkingVehicles ? "Hide parking & vehicles" : "Add parking & vehicles"}</span>
                                <ChevronDown className={showParkingVehicles ? "h-4 w-4 rotate-180" : "h-4 w-4"} />
                            </button>

                            {showParkingVehicles ? (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Parking Slots</Label>
                                        <VirtualizedParkingSlotSelect
                                            slots={vacantSlots}
                                            selectedIds={selectedParkingSlotIds}
                                            onSelectedIdsChange={setSelectedParkingSlotIds}
                                            isLoading={isVacantSlotsLoading}
                                            error={vacantSlotsError instanceof Error ? vacantSlotsError : null}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Vehicle Plate Numbers</Label>
                                        {selectedParkingSlotIds.length === 0 ? (
                                            <div className="text-xs text-zinc-500">Select parking slots to add vehicle plates.</div>
                                        ) : (
                                            <div className="space-y-2">
                                                {selectedParkingSlotIds.map((slotId, index) => (
                                                    <div key={slotId} className="flex items-center gap-2">
                                                        <div className="w-16 text-xs text-zinc-500">
                                                            #{index + 1}
                                                        </div>
                                                        <Input
                                                            placeholder={`Plate for slot ${index + 1}`}
                                                            {...form.register(`vehiclePlateNumbers.${index}` as const)}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : null}
                        </SectionCard>

                        {/* ---- Section 7: Access Items ---- */}
                        <SectionCard icon={Key} title="Access Items">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Access Card Numbers</Label>
                                    <div className="space-y-2">
                                        {(form.watch("accessCardNumbers") || []).length === 0 ? (
                                            <div className="text-xs text-zinc-500">No access cards added yet.</div>
                                        ) : null}
                                        {(form.watch("accessCardNumbers") || []).map((_, index) => (
                                            <div key={index} className="flex items-center gap-2">
                                                <Input
                                                    placeholder={`Card ${index + 1} number`}
                                                    {...form.register(`accessCardNumbers.${index}` as const)}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        const current = form.getValues("accessCardNumbers") || [];
                                                        const next = current.filter((_, idx) => idx !== index);
                                                        form.setValue("accessCardNumbers", next);
                                                    }}
                                                >
                                                    Remove
                                                </Button>
                                            </div>
                                        ))}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                const current = form.getValues("accessCardNumbers") || [];
                                                form.setValue("accessCardNumbers", [...current, ""]);
                                            }}
                                        >
                                            Add Access Card
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Parking Sticker Numbers</Label>
                                    {selectedParkingSlotIds.length === 0 ? (
                                        <div className="text-xs text-zinc-500">Select parking slots to add sticker numbers.</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {selectedParkingSlotIds.map((slotId, index) => (
                                                <div key={slotId} className="flex items-center gap-2">
                                                    <div className="w-16 text-xs text-zinc-500">#{index + 1}</div>
                                                    <Input
                                                        placeholder={`Sticker for slot ${index + 1}`}
                                                        {...form.register(`parkingStickerNumbers.${index}` as const)}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </SectionCard>

                        {/* ---- Section 8: Documents ---- */}
                        <SectionCard icon={FileText} title="Documents">
                            <div className="flex items-center justify-between">
                                <div className="text-xs text-zinc-500">
                                    {fields.length === 0 ? "No documents added yet." : `${fields.length} document${fields.length !== 1 ? "s" : ""}`}
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => append({ type: "OTHER", fileName: "", url: "" })}
                                >
                                    Add Document
                                </Button>
                            </div>

                            {fields.length > 0 && (
                                <div className="space-y-3">
                                    {fields.map((field, index) => (
                                        <div key={field.id} className="rounded-lg border border-zinc-200 bg-white p-3 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="text-sm font-medium text-zinc-700">Document #{index + 1}</div>
                                                <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                                                    Remove
                                                </Button>
                                            </div>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label>Type</Label>
                                                    <Select
                                                        value={form.watch(`documents.${index}.type`)}
                                                        onValueChange={(value) =>
                                                            form.setValue(`documents.${index}.type`, value as LeaseDocumentType)
                                                        }
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select type" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {DOCUMENT_TYPES.map((docType) => (
                                                                <SelectItem key={docType.value} value={docType.value}>
                                                                    {docType.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Upload File</Label>
                                                    <Input
                                                        type="file"
                                                        onChange={async (event) => {
                                                            const file = event.target.files?.[0];
                                                            if (!file) return;
                                                            setUploadingDocs((prev) => ({ ...prev, [index]: true }));
                                                            try {
                                                                const result = await uploadToCloudinary(file, "raw");
                                                                form.setValue(`documents.${index}.fileName`, file.name);
                                                                form.setValue(`documents.${index}.url`, result.url);
                                                                form.setValue(`documents.${index}.mimeType`, file.type || "application/octet-stream");
                                                                form.setValue(`documents.${index}.sizeBytes`, file.size);
                                                                toast.success("Document uploaded");
                                                            } catch (error) {
                                                                toast.error(getDocUploadErrorMessage(error));
                                                            } finally {
                                                                setUploadingDocs((prev) => ({ ...prev, [index]: false }));
                                                            }
                                                        }}
                                                        disabled={uploadingDocs[index]}
                                                    />
                                                    {uploadingDocs[index] ? (
                                                        <div className="text-xs text-zinc-500">Uploading...</div>
                                                    ) : null}
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>File Name</Label>
                                                    <Input {...form.register(`documents.${index}.fileName`)} placeholder="contract.pdf" />
                                                </div>
                                                <div className="space-y-2 sm:col-span-2">
                                                    <Label>URL</Label>
                                                    <Input {...form.register(`documents.${index}.url`)} placeholder="https://..." />
                                                    <div className="text-[11px] text-zinc-500">
                                                        Upload a file to auto-fill URL, MIME type, and size.
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </SectionCard>

                        {/* ---- Form Footer ---- */}
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">
                                Review
                            </Button>
                        </DialogFooter>
                    </form>
                ) : (
                    /* ============================================= */
                    /*  REVIEW PHASE                                  */
                    /* ============================================= */
                    <>
                        <div className="flex-1 overflow-y-auto space-y-4 pr-1">

                            {/* Resident summary */}
                            <SectionCard icon={User} title="Resident">
                                {reviewValues.residentMode === "existing" ? (
                                    <SummaryRow
                                        label="Linked Resident"
                                        value={residentOptions.find((r) => r.id === reviewValues.residentUserId)?.label ?? reviewValues.residentUserId}
                                    />
                                ) : (
                                    <>
                                        <SummaryRow label="Name" value={reviewValues.residentName} />
                                        <SummaryRow label="Email" value={reviewValues.residentEmail} />
                                        <SummaryRow label="Phone" value={reviewValues.residentPhone} />
                                    </>
                                )}
                            </SectionCard>

                            {/* Lease Details summary */}
                            <SectionCard icon={Calendar} title="Lease Details">
                                <SummaryRow label="Unit" value={selectedUnitLabel} />
                                <SummaryRow label="Start Date" value={reviewValues.leaseStartDate} />
                                <SummaryRow label="End Date" value={reviewValues.leaseEndDate} />
                                <SummaryRow label="Annual Rent" value={reviewValues.annualRent ? `AED ${reviewValues.annualRent}` : undefined} />
                                <SummaryRow label="Security Deposit" value={reviewValues.securityDepositAmount ? `AED ${reviewValues.securityDepositAmount}` : undefined} />
                                <SummaryRow
                                    label="Payment Frequency"
                                    value={PAYMENT_FREQUENCIES.find((f) => f.value === reviewValues.paymentFrequency)?.label}
                                />
                            </SectionCard>

                            {/* Lease Extras (conditional) */}
                            {hasLeaseExtras && (
                                <SectionCard icon={Shield} title="Lease Extras">
                                    <SummaryRow label="Tenancy Registration Expiry" value={reviewValues.tenancyRegistrationExpiry} />
                                    <SummaryRow label="Notice Given Date" value={reviewValues.noticeGivenDate} />
                                </SectionCard>
                            )}

                            {/* Resident Profile (conditional) */}
                            {hasReviewProfile && (
                                <SectionCard icon={User} title="Resident Profile">
                                    <SummaryRow label="Emirates ID" value={reviewProfile.emiratesIdNumber} />
                                    <SummaryRow label="Passport" value={reviewProfile.passportNumber} />
                                    <SummaryRow label="Nationality" value={reviewProfile.nationality} />
                                    <SummaryRow label="Date of Birth" value={reviewProfile.dateOfBirth} />
                                    <SummaryRow label="Address" value={reviewProfile.currentAddress} />
                                    <SummaryRow label="Emergency Contact" value={reviewProfile.emergencyContactName} />
                                    <SummaryRow label="Emergency Phone" value={reviewProfile.emergencyContactPhone} />
                                </SectionCard>
                            )}

                            {/* Occupants (conditional) */}
                            {reviewOccupants.length > 0 && (
                                <SectionCard icon={Users} title="Occupants">
                                    <SummaryList label="Names" items={reviewOccupants} />
                                </SectionCard>
                            )}

                            {/* Parking & Vehicles (conditional) */}
                            {(selectedParkingSlotIds.length > 0 || reviewVehicles.length > 0) && (
                                <SectionCard icon={Car} title="Parking & Vehicles">
                                    {selectedParkingSlotIds.length > 0 && (
                                        <SummaryList
                                            label="Parking Slots"
                                            items={selectedParkingSlotIds.map((id) => {
                                                const slot = vacantSlots.find((s) => s.id === id);
                                                return slot ? `${slot.code} (${slot.type})` : id;
                                            })}
                                        />
                                    )}
                                    {reviewVehicles.length > 0 && (
                                        <SummaryList label="Vehicle Plates" items={reviewVehicles} />
                                    )}
                                </SectionCard>
                            )}

                            {/* Access Items (conditional) */}
                            {(reviewAccessCards.length > 0 || reviewParkingStickers.length > 0) && (
                                <SectionCard icon={Key} title="Access Items">
                                    {reviewAccessCards.length > 0 && (
                                        <SummaryList label="Access Cards" items={reviewAccessCards} />
                                    )}
                                    {reviewParkingStickers.length > 0 && (
                                        <SummaryList label="Parking Stickers" items={reviewParkingStickers} />
                                    )}
                                </SectionCard>
                            )}

                            {/* Documents (conditional) */}
                            {reviewDocs.length > 0 && (
                                <SectionCard icon={FileText} title="Documents">
                                    {reviewDocs.map((doc, i) => (
                                        <div key={i} className="flex items-center gap-3 text-sm">
                                            <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium">
                                                {DOCUMENT_TYPES.find((t) => t.value === doc.type)?.label ?? doc.type}
                                            </span>
                                            <span className="text-zinc-700 truncate">{doc.fileName}</span>
                                            {doc.url?.trim() && (
                                                <a
                                                    href={doc.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:underline text-xs shrink-0"
                                                >
                                                    Link
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </SectionCard>
                            )}
                        </div>

                        {/* ---- Review Footer ---- */}
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setPhase("form")}>
                                <ChevronLeft className="mr-1 h-4 w-4" />
                                Edit
                            </Button>
                            <Button
                                type="button"
                                onClick={() => form.handleSubmit(onSubmit)()}
                                disabled={moveIn.isPending || moveOut.isPending || isUploadingDocs}
                            >
                                {moveIn.isPending || moveOut.isPending ? "Processing..." : (
                                    <>
                                        <CheckCircle2 className="mr-1 h-4 w-4" />
                                        {isUploadingDocs ? "Uploading..." : "Confirm Move In"}
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
