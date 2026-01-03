"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { SlideOver } from "@/components/common/SlideOver";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrgProfile, useUpdateOrgProfile } from "@/lib/queries";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Building2, Mail, Loader2, MapPin, Phone, Upload } from "lucide-react";
import { toast } from "sonner";

const orgProfileSchema = z.object({
    name: z.string().trim().min(2, "Organization name must be at least 2 characters"),
    logoUrl: z.string().trim().url("Enter a valid logo URL").optional().or(z.literal("")),
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

type OrgProfileFormValues = z.infer<typeof orgProfileSchema>;

const businessTypeOptions = [
    { value: "OWNER", label: "Owner" },
    { value: "PROPERTY_MANAGEMENT", label: "Property Management" },
    { value: "FACILITY_MANAGEMENT", label: "Facility Management" },
    { value: "DEVELOPER", label: "Developer" },
];

interface OrgProfileSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function OrgProfileSheet({ open, onOpenChange }: OrgProfileSheetProps) {
    const { data: profile, isLoading, error } = useOrgProfile({ enabled: open });
    const updateProfile = useUpdateOrgProfile();
    const [formError, setFormError] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const form = useForm<OrgProfileFormValues>({
        resolver: zodResolver(orgProfileSchema),
        defaultValues: {
            name: "",
            logoUrl: "",
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
        if (!open) return;
        if (!profile) return;
        setFormError(null);
        form.reset({
            name: profile.name ?? "",
            logoUrl: profile.logoUrl ?? "",
            businessName: profile.businessName ?? "",
            businessType: profile.businessType ?? "UNSPECIFIED",
            tradeLicenseNumber: profile.tradeLicenseNumber ?? "",
            vatRegistrationNumber: profile.vatRegistrationNumber ?? "",
            registeredOfficeAddress: profile.registeredOfficeAddress ?? "",
            city: profile.city ?? "",
            officePhoneNumber: profile.officePhoneNumber ?? "",
            businessEmailAddress: profile.businessEmailAddress ?? "",
            website: profile.website ?? "",
            ownerName: profile.ownerName ?? "",
        });
    }, [open, profile, form]);

    useEffect(() => {
        if (open) {
            setFormError(null);
        }
    }, [open]);

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            setFormError("Please select an image file.");
            return;
        }
        setIsUploading(true);
        setFormError(null);
        try {
            const result = await uploadToCloudinary(file, "image");
            if (!result.url) {
                throw new Error("Upload failed to return a URL.");
            }
            form.setValue("logoUrl", result.url, { shouldDirty: true, shouldValidate: true });
            toast.success("Logo uploaded");
        } catch (err) {
            const message = err instanceof Error ? err.message : "Upload failed.";
            setFormError(message);
            toast.error(message);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const onSubmit = async (data: OrgProfileFormValues) => {
        setFormError(null);
        const normalize = (value?: string) => {
            if (!value) return undefined;
            const trimmed = value.trim();
            return trimmed.length > 0 ? trimmed : undefined;
        };
        try {
            await updateProfile.mutateAsync({
                name: data.name.trim(),
                logoUrl: normalize(data.logoUrl),
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
            toast.success("Organization profile updated");
            onOpenChange(false);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to update organization profile.";
            setFormError(message);
            toast.error(message);
        }
    };

    return (
        <SlideOver
            open={open}
            onOpenChange={onOpenChange}
            title="Organization Profile"
            description="Manage your organization's business details."
            width="w-full sm:w-[720px] lg:w-[900px]"
        >
            <div className="px-2 sm:px-4">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-1">
                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                            <div className="mb-4 flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                                    <Building2 className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-zinc-900">Organization Identity</h3>
                                    <p className="text-xs text-zinc-500">Core profile details used across invoices and reports.</p>
                                </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem className="md:col-span-2">
                                            <FormLabel>Organization Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="TowerDesk Holdings" {...field} className="h-11" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

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

                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                            <div className="mb-4 flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                                    <Upload className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-zinc-900">Branding</h3>
                                    <p className="text-xs text-zinc-500">Upload a logo for documents and dashboards.</p>
                                </div>
                            </div>
                            <FormField
                                control={form.control}
                                name="logoUrl"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Logo URL <span className="text-zinc-400 font-normal">(Optional)</span>
                                        </FormLabel>
                                        <FormControl>
                                            <Input placeholder="https://example.com/logo.png" {...field} className="h-11" />
                                        </FormControl>
                                        <div className="mt-3 flex flex-wrap items-center gap-3">
                                            <Input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={handleFileChange}
                                                disabled={isUploading}
                                                className="h-10"
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isUploading}
                                            >
                                                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                            </Button>
                                            {field.value ? (
                                                <div className="text-xs text-zinc-500 break-all">Preview: {field.value}</div>
                                            ) : null}
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                            <div className="mb-4 flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                                    <MapPin className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-zinc-900">Compliance & Address</h3>
                                    <p className="text-xs text-zinc-500">Regulatory details and registered location.</p>
                                </div>
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
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                            <div className="mb-4 flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                                    <Phone className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-zinc-900">Contact Channels</h3>
                                    <p className="text-xs text-zinc-500">Public-facing points of contact.</p>
                                </div>
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
                                                <div className="relative">
                                                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                                    <Input type="email" placeholder="info@towerdesk.com" {...field} className="h-11 pl-9" />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
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

                        {error ? (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                {error instanceof Error ? error.message : "Failed to load organization profile."}
                            </div>
                        ) : null}

                        {formError ? (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                {formError}
                            </div>
                        ) : null}

                        <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
                            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={updateProfile.isPending || isLoading || isUploading}>
                                {updateProfile.isPending ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </div>
        </SlideOver>
    );
}
