"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useProviderProfile, useProviderRuntimeContext, useUpdateProviderProfile } from "@/lib/queries";

type ProfileFormState = {
    name: string;
    serviceCategory: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    notes: string;
    isActive: boolean;
};

const emptyForm: ProfileFormState = {
    name: "",
    serviceCategory: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    notes: "",
    isActive: true,
};

export function ProviderProfilePage() {
    const { baseRole } = useAuth();
    const [form, setForm] = useState<ProfileFormState>(emptyForm);
    const providerContextQuery = useProviderRuntimeContext({ enabled: baseRole === "service_provider" });
    const providerAccess = providerContextQuery.data?.providers ?? [];
    const singleProvider = providerAccess.length === 1 ? providerAccess[0] : null;
    const profileQuery = useProviderProfile({ enabled: baseRole === "service_provider" && Boolean(singleProvider) });
    const updateProfile = useUpdateProviderProfile();

    useEffect(() => {
        const profile = profileQuery.data;
        if (!profile) return;
        setForm({
            name: profile.name ?? "",
            serviceCategory: profile.serviceCategory ?? "",
            contactName: profile.contactName ?? "",
            contactEmail: profile.contactEmail ?? "",
            contactPhone: profile.contactPhone ?? "",
            notes: profile.notes ?? "",
            isActive: profile.isActive,
        });
    }, [profileQuery.data]);

    const isAdmin = String(singleProvider?.role ?? "").toUpperCase() === "ADMIN";

    const handleSave = async () => {
        try {
            await updateProfile.mutateAsync({
                name: form.name.trim(),
                serviceCategory: form.serviceCategory.trim() || undefined,
                contactName: form.contactName.trim() || undefined,
                contactEmail: form.contactEmail.trim() || undefined,
                contactPhone: form.contactPhone.trim() || undefined,
                notes: form.notes.trim() || undefined,
                isActive: form.isActive,
            });
            toast.success("Provider profile updated");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to update provider profile");
        }
    };

    if (baseRole !== "service_provider") {
        return <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500">This portal surface is limited to provider users.</div>;
    }
    if (providerContextQuery.isLoading && !providerContextQuery.data) {
        return <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500">Loading provider access...</div>;
    }
    if (providerAccess.length === 0) {
        return <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500">No provider access. `GET /provider/me` returned no active provider memberships.</div>;
    }
    if (providerAccess.length > 1) {
        return (
            <div className="rounded-3xl border border-zinc-200 bg-white p-8">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500">
                        <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-zinc-950">Provider selection required</h1>
                        <p className="mt-2 text-sm text-zinc-500">The current backend does not support explicit provider selection for `/provider/profile` yet.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <section className="rounded-[28px] border border-zinc-200 bg-white p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                            Provider profile
                        </div>
                        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950">{profileQuery.data?.name ?? singleProvider?.name}</h1>
                        <p className="mt-2 max-w-2xl text-sm text-zinc-500">Shared provider profile used across all linked orgs and buildings.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Badge className="bg-zinc-100 text-zinc-700">{singleProvider?.role}</Badge>
                        <Badge className={form.isActive ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-700"}>{form.isActive ? "Active" : "Inactive"}</Badge>
                    </div>
                </div>
            </section>

            <section className="rounded-[28px] border border-zinc-200 bg-white p-6">
                <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2"><label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Provider name</label><Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} disabled={!isAdmin} /></div>
                    <div className="space-y-2"><label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Service category</label><Input value={form.serviceCategory} onChange={(event) => setForm((prev) => ({ ...prev, serviceCategory: event.target.value }))} disabled={!isAdmin} /></div>
                    <div className="space-y-2"><label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Contact name</label><Input value={form.contactName} onChange={(event) => setForm((prev) => ({ ...prev, contactName: event.target.value }))} disabled={!isAdmin} /></div>
                    <div className="space-y-2"><label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Contact phone</label><Input value={form.contactPhone} onChange={(event) => setForm((prev) => ({ ...prev, contactPhone: event.target.value }))} disabled={!isAdmin} /></div>
                    <div className="space-y-2 md:col-span-2"><label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Contact email</label><Input value={form.contactEmail} onChange={(event) => setForm((prev) => ({ ...prev, contactEmail: event.target.value }))} disabled={!isAdmin} /></div>
                    <div className="space-y-2 md:col-span-2"><label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Notes</label><Textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} rows={5} disabled={!isAdmin} /></div>
                </div>

                {isAdmin ? (
                    <div className="mt-6 flex justify-end">
                        <Button onClick={handleSave} disabled={updateProfile.isPending || !form.name.trim()}>
                            {updateProfile.isPending ? "Saving..." : "Save profile"}
                        </Button>
                    </div>
                ) : (
                    <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                        Profile editing is limited to provider admins.
                    </div>
                )}
            </section>
        </div>
    );
}
