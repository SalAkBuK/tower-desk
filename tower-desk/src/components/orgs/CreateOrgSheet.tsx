"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { SlideOver } from "@/components/common/SlideOver";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreatePlatformOrg } from "@/lib/queries";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Building2, Shield, PhoneCall } from "lucide-react";
import { cn } from "@/lib/utils";

const orgSchema = z.object({
    name: z.string().trim().min(2, "Organization name must be at least 2 characters"),
    businessName: z.string().trim().min(2, "Business name must be at least 2 characters").optional().or(z.literal("")),
    businessType: z.enum(["OWNER", "PROPERTY_MANAGEMENT", "FACILITY_MANAGEMENT", "DEVELOPER", "UNSPECIFIED"]).optional().or(z.literal("")),
    tradeLicenseNumber: z.string().trim().min(3, "Trade license number must be at least 3 characters").optional().or(z.literal("")),
    vatRegistrationNumber: z.string().trim().min(3, "VAT registration number must be at least 3 characters").optional().or(z.literal("")),
    registeredOfficeAddress: z.string().trim().min(5, "Registered office address must be at least 5 characters").optional().or(z.literal("")),
    city: z.string().trim().min(2, "City must be at least 2 characters").optional().or(z.literal("")),
    officePhoneNumber: z.string().trim().min(6, "Office phone number must be at least 6 characters").optional().or(z.literal("")),
    businessEmailAddress: z.string().trim().email("Enter a valid business email").optional().or(z.literal("")),
    website: z.string().trim().url("Enter a valid website URL").optional().or(z.literal("")),
    ownerName: z.string().trim().min(2, "Owner name must be at least 2 characters").optional().or(z.literal("")),
});

type OrgFormValues = z.infer<typeof orgSchema>;

const businessTypeOptions = [
    { value: "OWNER", label: "Owner" },
    { value: "PROPERTY_MANAGEMENT", label: "Property Management" },
    { value: "FACILITY_MANAGEMENT", label: "Facility Management" },
    { value: "DEVELOPER", label: "Developer" },
];

export type CreatedOrg = {
    id: string;
    name: string;
    createdAt?: string;
};

interface CreateOrgSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated?: (org: CreatedOrg) => void;
}

const steps = [
    {
        key: "basics",
        title: "Basics",
        description: "Organization name and business type",
        icon: Building2,
        fields: ["name", "businessName", "businessType"],
    },
    {
        key: "compliance",
        title: "Compliance",
        description: "License and VAT details",
        icon: Shield,
        fields: ["tradeLicenseNumber", "vatRegistrationNumber"],
    },
    {
        key: "contact",
        title: "Contact",
        description: "Address and contact channels",
        icon: PhoneCall,
        fields: ["registeredOfficeAddress", "city", "officePhoneNumber", "businessEmailAddress", "website", "ownerName"],
    },
] as const;

export function CreateOrgSheet({ open, onOpenChange, onCreated }: CreateOrgSheetProps) {
    const createOrg = useCreatePlatformOrg();
    const [error, setError] = useState<string | null>(null);
    const [stepIndex, setStepIndex] = useState(0);
    const [direction, setDirection] = useState(0);
    const stepHeaderRef = useRef<HTMLDivElement | null>(null);
    const totalSteps = steps.length;
    const currentStep = steps[stepIndex];

    const form = useForm<OrgFormValues>({
        resolver: zodResolver(orgSchema),
        defaultValues: {
            name: "",
            businessName: "",
            businessType: "UNSPECIFIED",
            tradeLicenseNumber: "",
            vatRegistrationNumber: "",
            registeredOfficeAddress: "",
            city: "",
            officePhoneNumber: "",
            businessEmailAddress: "",
            website: "",
            ownerName: "",
        },
    });

    useEffect(() => {
        if (open) {
            setError(null);
            setStepIndex(0);
            setDirection(0);
            form.reset({
                name: "",
                businessName: "",
                businessType: "UNSPECIFIED",
                tradeLicenseNumber: "",
                vatRegistrationNumber: "",
                registeredOfficeAddress: "",
                city: "",
                officePhoneNumber: "",
                businessEmailAddress: "",
                website: "",
                ownerName: "",
            });
        }
    }, [open, form]);

    useEffect(() => {
        if (!open) return;
        stepHeaderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [stepIndex, open]);

    const onSubmit = async (data: OrgFormValues) => {
        setError(null);
        try {
            const normalize = (value?: string) => {
                if (!value) return undefined;
                const trimmed = value.trim();
                return trimmed.length > 0 ? trimmed : undefined;
            };
            const created = await createOrg.mutateAsync({
                name: data.name.trim(),
                businessName: normalize(data.businessName),
                businessType: data.businessType && data.businessType !== "UNSPECIFIED" ? data.businessType : undefined,
                tradeLicenseNumber: normalize(data.tradeLicenseNumber),
                vatRegistrationNumber: normalize(data.vatRegistrationNumber),
                registeredOfficeAddress: normalize(data.registeredOfficeAddress),
                city: normalize(data.city),
                officePhoneNumber: normalize(data.officePhoneNumber),
                businessEmailAddress: normalize(data.businessEmailAddress),
                website: normalize(data.website),
                ownerName: normalize(data.ownerName),
            });
            onCreated?.(created);
            toast.success("Organization created");
            onOpenChange(false);
            form.reset();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to create organization";
            setError(message);
            toast.error(message);
        }
    };

    const handleNextStep = async () => {
        const fields = [...currentStep.fields];
        const isValid = fields.length ? await form.trigger(fields) : true;
        if (isValid) {
            setDirection(1);
            setStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
        }
    };

    const handlePrevStep = () => {
        setDirection(-1);
        setStepIndex((prev) => Math.max(prev - 1, 0));
    };

    const variants = {
        enter: (dir: number) => ({
            x: dir > 0 ? 20 : -20,
            opacity: 0,
        }),
        center: {
            x: 0,
            opacity: 1,
        },
        exit: (dir: number) => ({
            x: dir < 0 ? 20 : -20,
            opacity: 0,
        }),
    };

    return (
        <SlideOver
            open={open}
            onOpenChange={onOpenChange}
            title="Create Organization"
            description="Set up a new organization before creating its admin."
            width="w-full sm:w-[720px] lg:w-[860px]"
        >
            <div className="flex h-full flex-col">
                <div className="border-b bg-zinc-50/50 px-6 py-4 backdrop-blur-xl">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-zinc-900">{currentStep.title}</h3>
                            <p className="text-sm text-zinc-500">{currentStep.description}</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-zinc-400">
                            <span className="font-medium text-zinc-900">{stepIndex + 1}</span>
                            <span>/</span>
                            <span>{totalSteps}</span>
                        </div>
                    </div>
                    <div className="relative flex items-center justify-between">
                        <div className="absolute left-0 top-1/2 -z-10 h-0.5 w-full -translate-y-1/2 bg-zinc-200" />
                        <div
                            className="absolute left-0 top-1/2 -z-10 h-0.5 -translate-y-1/2 bg-zinc-900 transition-all duration-500 ease-in-out"
                            style={{ width: `${(stepIndex / (totalSteps - 1)) * 100}%` }}
                        />
                        {steps.map((step, index) => {
                            const Icon = step.icon;
                            const isActive = index === stepIndex;
                            const isCompleted = index < stepIndex;
                            return (
                                <div key={step.key} className="relative flex flex-col items-center gap-2">
                                    <div
                                        className={cn(
                                            "flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white transition-all duration-300",
                                            isActive ? "border-zinc-900 text-zinc-900 scale-110 shadow-sm" :
                                                isCompleted ? "border-zinc-900 bg-zinc-900 text-white" :
                                                    "border-zinc-200 text-zinc-300"
                                        )}
                                    >
                                        {isCompleted ? (
                                            <Check className="h-4 w-4" strokeWidth={3} />
                                        ) : (
                                            <Icon className="h-4 w-4" />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6" ref={stepHeaderRef}>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <AnimatePresence mode="wait" initial={false} custom={direction}>
                                <motion.div
                                    key={stepIndex}
                                    custom={direction}
                                    variants={variants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    className="space-y-6"
                                >
                                    {stepIndex === 0 && (
                                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                                            <div className="mb-4">
                                                <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Organization</h3>
                                                <p className="mt-1 text-sm text-zinc-500">Start with a clear organization name for reporting and invoices.</p>
                                            </div>
                                            <div className="grid gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="name"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Organization Name</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="TowerDesk Holdings" {...field} className="h-11" />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <div className="grid gap-4 md:grid-cols-2">
                                                    <FormField
                                                        control={form.control}
                                                        name="businessName"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>
                                                                    Business Name <span className="text-zinc-400 font-normal">(Optional)</span>
                                                                </FormLabel>
                                                                <FormControl>
                                                                    <Input placeholder="TowerDesk Management LLC" {...field} className="h-11" />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name="businessType"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>
                                                                    Business Type <span className="text-zinc-400 font-normal">(Optional)</span>
                                                                </FormLabel>
                                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                    <FormControl>
                                                                        <SelectTrigger className="h-11">
                                                                            <SelectValue placeholder="Select a business type" />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        <SelectItem value="UNSPECIFIED">Not specified</SelectItem>
                                                                        {businessTypeOptions.map((option) => (
                                                                            <SelectItem key={option.value} value={option.value}>
                                                                                {option.label}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {stepIndex === 1 && (
                                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                                            <div className="mb-4">
                                                <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Compliance</h3>
                                                <p className="mt-1 text-sm text-zinc-500">Keep regulatory details ready for audits and billing.</p>
                                            </div>
                                            <div className="grid gap-4 md:grid-cols-2">
                                                <FormField
                                                    control={form.control}
                                                    name="tradeLicenseNumber"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>
                                                                Trade License Number <span className="text-zinc-400 font-normal">(Optional)</span>
                                                            </FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="TL-12345" {...field} className="h-11" />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="vatRegistrationNumber"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>
                                                                VAT Registration Number <span className="text-zinc-400 font-normal">(Optional)</span>
                                                            </FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="VAT-12345" {...field} className="h-11" />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {stepIndex === 2 && (
                                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                                            <div className="mb-4">
                                                <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Contact</h3>
                                                <p className="mt-1 text-sm text-zinc-500">Use public-facing details for outreach and contracts.</p>
                                            </div>
                                            <div className="grid gap-4 md:grid-cols-2">
                                                <FormField
                                                    control={form.control}
                                                    name="registeredOfficeAddress"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>
                                                                Registered Office Address <span className="text-zinc-400 font-normal">(Optional)</span>
                                                            </FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="123 Main St" {...field} className="h-11" />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="city"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>
                                                                City <span className="text-zinc-400 font-normal">(Optional)</span>
                                                            </FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Dubai" {...field} className="h-11" />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>

                                            <div className="grid gap-4 md:grid-cols-2">
                                                <FormField
                                                    control={form.control}
                                                    name="officePhoneNumber"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>
                                                                Office Phone Number <span className="text-zinc-400 font-normal">(Optional)</span>
                                                            </FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="+971-4-555-0100" {...field} className="h-11" />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="businessEmailAddress"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>
                                                                Business Email <span className="text-zinc-400 font-normal">(Optional)</span>
                                                            </FormLabel>
                                                            <FormControl>
                                                                <Input type="email" placeholder="info@towerdesk.com" {...field} className="h-11" />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>

                                            <div className="grid gap-4 md:grid-cols-2">
                                                <FormField
                                                    control={form.control}
                                                    name="website"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>
                                                                Website <span className="text-zinc-400 font-normal">(Optional)</span>
                                                            </FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="https://towerdesk.com" {...field} className="h-11" />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="ownerName"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>
                                                                Owner Name <span className="text-zinc-400 font-normal">(Optional)</span>
                                                            </FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Jane Founder" {...field} className="h-11" />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {error ? (
                                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                            {error}
                                        </div>
                                    ) : null}
                                </motion.div>
                            </AnimatePresence>
                        </form>
                    </Form>
                </div>

                <div className="border-t bg-white px-6 py-4">
                    <div className="flex items-center justify-between">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={handlePrevStep}
                            disabled={stepIndex === 0}
                            className="gap-2"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Back
                        </Button>
                        <div className="flex items-center gap-3">
                            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            {stepIndex === totalSteps - 1 ? (
                                <Button onClick={form.handleSubmit(onSubmit)} disabled={createOrg.isPending} className="gap-2">
                                    {createOrg.isPending ? "Creating..." : "Create Org"}
                                </Button>
                            ) : (
                                <Button type="button" onClick={handleNextStep} className="gap-2">
                                    Next
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </SlideOver>
    );
}
