"use client";

import { type ReactNode, useDeferredValue, useMemo, useState } from "react";
import { Building2, ClipboardList, Mail, Pencil, Phone, Plus, Search, ShieldAlert, UserRound, Wrench } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import {
    useAccessibleBuildings,
    useCreateServiceProvider,
    useCreateServiceProviderAccessGrant,
    useDisableServiceProviderAccessGrant,
    useLinkServiceProviderBuilding,
    useResendServiceProviderAccessGrantInvite,
    useServiceProvider,
    useServiceProviderAccessGrants,
    useServiceProviders,
    useUnlinkServiceProviderBuilding,
    useUpdateServiceProvider,
} from "@/lib/queries";
import { hasPermission as hasRbacPermission } from "@/lib/rbac";
import type { CreateServiceProviderPayload, ServiceProvider } from "@/lib/types";

type ProviderFormState = {
    name: string;
    serviceCategory: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    notes: string;
    isActive: "active" | "inactive";
    adminEmail: string;
    initialBuildingId: string;
};

const PROVIDER_SERVICE_CATEGORY_OPTIONS = [
    "General Maintenance",
    "HVAC",
    "Plumbing",
    "Electrical",
    "Cleaning",
    "Security",
    "Landscaping",
    "Pest Control",
    "Pool Maintenance",
    "Elevator Maintenance",
    "Fire & Life Safety",
    "Civil Works",
    "Waste Management",
    "Access Control",
] as const;

const initialProviderFormState = (): ProviderFormState => ({
    name: "",
    serviceCategory: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    notes: "",
    isActive: "active",
    adminEmail: "",
    initialBuildingId: "",
});

const formatProviderFormState = (provider?: ServiceProvider | null): ProviderFormState => ({
    name: provider?.name ?? "",
    serviceCategory: provider?.serviceCategory ?? "",
    contactName: provider?.contactName ?? "",
    contactEmail: provider?.contactEmail ?? "",
    contactPhone: provider?.contactPhone ?? "",
    notes: provider?.notes ?? "",
    isActive: provider?.isActive === false ? "inactive" : "active",
    adminEmail: "",
    initialBuildingId: "",
});

const toProviderPayload = (form: ProviderFormState): CreateServiceProviderPayload => ({
    name: form.name.trim(),
    serviceCategory: form.serviceCategory.trim() || undefined,
    contactName: form.contactName.trim() || undefined,
    contactEmail: form.contactEmail.trim() || undefined,
    contactPhone: form.contactPhone.trim() || undefined,
    notes: form.notes.trim() || undefined,
    isActive: form.isActive === "active",
    adminEmail: form.adminEmail.trim() || undefined,
    buildingIds: form.initialBuildingId ? [form.initialBuildingId] : undefined,
});

function FilterField({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <div className="rounded-[22px] border border-zinc-200 bg-white p-3 shadow-xs">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">{label}</div>
            <div className="mt-2">{children}</div>
        </div>
    );
}

function ProviderFormSection({
    icon: Icon,
    title,
    description,
    children,
}: {
    icon: typeof Wrench;
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="mb-5 flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600">
                    <Icon className="h-4 w-4" />
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-zinc-950">{title}</h3>
                    <p className="mt-1 text-sm text-zinc-500">{description}</p>
                </div>
            </div>
            {children}
        </section>
    );
}

export function ProvidersManagementPage() {
    const { user, baseRole } = useAuth();
    const canReadProviders =
        baseRole === "superadmin"
        || hasRbacPermission(user, "serviceProviders.read")
        || hasRbacPermission(user, "service_providers.read");
    const canWriteProviders =
        baseRole === "superadmin"
        || hasRbacPermission(user, "serviceProviders.write")
        || hasRbacPermission(user, "service_providers.write");

    const [search, setSearch] = useState("");
    const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
    const [form, setForm] = useState<ProviderFormState>(initialProviderFormState);
    const [buildingToLink, setBuildingToLink] = useState("");
    const [accessGrantEmail, setAccessGrantEmail] = useState("");

    const deferredSearch = useDeferredValue(search);
    const currentServiceCategory = form.serviceCategory.trim();
    const hasCustomServiceCategory = Boolean(
        currentServiceCategory
        && !PROVIDER_SERVICE_CATEGORY_OPTIONS.some((option) => option.toLowerCase() === currentServiceCategory.toLowerCase())
    );
    const providersQuery = useServiceProviders({ enabled: canReadProviders });
    const selectedProviderQuery = useServiceProvider(selectedProviderId, {
        enabled: canReadProviders && isDetailOpen && Boolean(selectedProviderId),
    });
    const accessGrantsQuery = useServiceProviderAccessGrants(selectedProviderId, {
        enabled: canReadProviders && isDetailOpen && Boolean(selectedProviderId),
    });
    const accessibleBuildingsQuery = useAccessibleBuildings(user?.id, baseRole, { enabled: canReadProviders });

    const createProvider = useCreateServiceProvider();
    const updateProvider = useUpdateServiceProvider();
    const linkBuilding = useLinkServiceProviderBuilding();
    const unlinkBuilding = useUnlinkServiceProviderBuilding();
    const createAccessGrant = useCreateServiceProviderAccessGrant();
    const resendInvite = useResendServiceProviderAccessGrantInvite();
    const disableAccessGrant = useDisableServiceProviderAccessGrant();

    const providers = providersQuery.data ?? [];
    const selectedProvider = selectedProviderQuery.data ?? providers.find((provider) => provider.id === selectedProviderId) ?? null;
    const accessGrants = accessGrantsQuery.data ?? selectedProvider?.providerAdminAccessGrants ?? [];
    const providerOwnershipPending = Boolean(selectedProvider && !selectedProvider.providerProfileOwnedByProvider);

    const filteredProviders = useMemo(() => {
        const term = deferredSearch.trim().toLowerCase();
        if (!term) return providers;
        return providers.filter((provider) =>
            [provider.name, provider.serviceCategory, provider.contactName, provider.contactEmail, provider.contactPhone]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(term))
        );
    }, [deferredSearch, providers]);

    const availableBuildings = useMemo(() => {
        const linked = new Set((selectedProvider?.linkedBuildings ?? []).map((entry) => entry.buildingId));
        return (accessibleBuildingsQuery.data ?? []).filter((building) => !linked.has(building.id));
    }, [accessibleBuildingsQuery.data, selectedProvider?.linkedBuildings]);
    const totalBuildingLinks = useMemo(
        () => providers.reduce((count, provider) => count + provider.linkedBuildings.length, 0),
        [providers]
    );
    const ownedProfilesCount = useMemo(
        () => providers.filter((provider) => provider.providerProfileOwnedByProvider).length,
        [providers]
    );

    const openDetail = (providerId: string) => {
        setSelectedProviderId(providerId);
        setIsDetailOpen(true);
    };

    const openCreate = () => {
        setEditingProviderId(null);
        setForm(initialProviderFormState());
        setIsDetailOpen(false);
        setIsFormOpen(true);
    };

    const openEdit = (provider: ServiceProvider) => {
        setEditingProviderId(provider.id);
        setForm(formatProviderFormState(provider));
        setIsDetailOpen(false);
        setIsFormOpen(true);
    };

    const handleSubmitProvider = async () => {
        const payload = toProviderPayload(form);
        if (!payload.name) return toast.error("Provider name is required.");
        if (editingProviderId && selectedProvider?.providerProfileOwnedByProvider) {
            return toast.error("This provider profile is now owned by the provider and can no longer be edited from org management.");
        }
        try {
            const provider = editingProviderId
                ? await updateProvider.mutateAsync({ providerId: editingProviderId, payload })
                : await createProvider.mutateAsync(payload);
            toast.success(editingProviderId ? "Provider updated" : "Provider created");
            setIsFormOpen(false);
            openDetail(provider.id);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to save provider");
        }
    };

    const handleLinkBuilding = async () => {
        if (!selectedProvider?.id || !buildingToLink) return;
        try {
            await linkBuilding.mutateAsync({ providerId: selectedProvider.id, payload: { buildingId: buildingToLink } });
            toast.success("Provider linked to building");
            setBuildingToLink("");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to link provider to building");
        }
    };

    const handleCreateAccessGrant = async () => {
        const email = accessGrantEmail.trim();
        if (!selectedProvider?.id || !email) return;
        try {
            await createAccessGrant.mutateAsync({ providerId: selectedProvider.id, email });
            toast.success("Provider admin invite sent");
            setAccessGrantEmail("");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to send invite");
        }
    };

    if (!canReadProviders) {
        return (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                        <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-zinc-900">Providers</h1>
                        <p className="text-sm text-zinc-500">You do not have permission to view service providers.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <section className="relative overflow-hidden rounded-[30px] border border-zinc-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.08),_transparent_34%),radial-gradient(circle_at_right_center,_rgba(15,23,42,0.03),_transparent_30%),linear-gradient(180deg,_#ffffff,_rgba(250,250,250,0.98))] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_16px_40px_rgba(0,0,0,0.04)]">
                <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.1),_transparent_68%)] lg:block" />
                <div className="relative flex flex-col gap-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="max-w-2xl">
                            <div className="inline-flex items-center rounded-full border border-emerald-200/70 bg-white/85 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-emerald-700 backdrop-blur">
                                Portfolio Operations
                            </div>
                            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-zinc-950 sm:text-[2rem]">
                                Providers
                            </h1>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                                Manage shared provider profiles, linked buildings, and provider-admin access grants.
                            </p>
                        </div>

                        <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[340px]">
                            <div className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                                        <Building2 className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                                            Directory Scope
                                        </div>
                                        <div className="mt-2 text-sm font-medium text-zinc-950">Organization-wide</div>
                                        <div className="mt-1 text-xs text-zinc-500">Providers can be linked across multiple buildings.</div>
                                    </div>
                                </div>
                            </div>
                            {canWriteProviders ? (
                                <div className="flex flex-wrap items-center gap-3">
                                    <Button onClick={openCreate} className="h-11 rounded-xl bg-zinc-950 px-5 text-white hover:bg-zinc-800">
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Provider
                                    </Button>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                        <Wrench className="h-5 w-5" />
                    </div>
                    <div className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-zinc-950">{providers.length}</div>
                    <p className="mt-1 text-sm text-zinc-500">Registered providers</p>
                </div>
                <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                        <Building2 className="h-5 w-5" />
                    </div>
                    <div className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-zinc-950">{totalBuildingLinks}</div>
                    <p className="mt-1 text-sm text-zinc-500">Building links</p>
                </div>
                <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                        <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-zinc-950">{ownedProfilesCount}</div>
                    <p className="mt-1 text-sm text-zinc-500">Provider-owned profiles</p>
                </div>
            </section>

            <section className="rounded-[30px] border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="space-y-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <h2 className="text-xl font-semibold tracking-[-0.02em] text-zinc-950">Provider Directory</h2>
                            <p className="mt-1 text-sm text-zinc-500">Search providers by company, category, or contact details.</p>
                        </div>
                        <div className="relative w-full lg:w-80">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search providers" className="h-11 rounded-xl border-zinc-200 bg-white pl-9" />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <div className="min-w-[240px] flex-1">
                            <FilterField label="Directory Scope">
                                <div className="text-sm text-zinc-700">Shared provider profiles across the organization</div>
                            </FilterField>
                        </div>
                        <div className="min-w-[240px] flex-1">
                            <FilterField label="Search Coverage">
                                <div className="text-sm text-zinc-700">Name, category, contact name, email, and phone</div>
                            </FilterField>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                        <span className="text-zinc-400">Summary</span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-700">
                            Providers
                            <span className="font-medium text-zinc-900">{providers.length}</span>
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-700">
                            Building links
                            <span className="font-medium text-zinc-900">{totalBuildingLinks}</span>
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-700">
                            Provider-owned
                            <span className="font-medium text-zinc-900">{ownedProfilesCount}</span>
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-900 bg-zinc-950 px-3 py-1.5 font-medium text-white">
                            Showing
                            <span>{filteredProviders.length} provider{filteredProviders.length === 1 ? "" : "s"}</span>
                        </span>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-zinc-200">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Provider</TableHead>
                                <TableHead>Service</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Buildings</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {providersQuery.isLoading ? (
                                <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-zinc-500">Loading providers...</TableCell></TableRow>
                            ) : providersQuery.isError ? (
                                <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-zinc-500">{providersQuery.error instanceof Error ? providersQuery.error.message : "Failed to load providers."}</TableCell></TableRow>
                            ) : filteredProviders.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-zinc-500">No providers found.</TableCell></TableRow>
                            ) : (
                                filteredProviders.map((provider) => (
                                    <TableRow key={provider.id}>
                                        <TableCell>
                                            <div className="space-y-1">
                                                <div className="font-medium text-zinc-900">{provider.name}</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {provider.providerProfileOwnedByProvider ? <Badge className="bg-amber-50 text-amber-700">Provider-owned</Badge> : null}
                                                    {!provider.providerProfileOwnedByProvider ? <Badge className="bg-sky-50 text-sky-700">Provider admin pending</Badge> : null}
                                                    {provider.notes ? <span className="text-xs text-zinc-500 line-clamp-1">{provider.notes}</span> : null}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>{provider.serviceCategory || "Not set"}</TableCell>
                                        <TableCell><Badge className={provider.isActive ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-700"}>{provider.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                                        <TableCell>{provider.linkedBuildings.length}</TableCell>
                                        <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => openDetail(provider.id)}>Open</Button></TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                    </div>
                </div>
            </section>

            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="w-[96vw] max-w-[96vw] overflow-hidden p-0 sm:max-w-4xl lg:max-w-5xl">
                    <DialogHeader className="border-b border-zinc-100 bg-zinc-50/70 px-6 py-5 text-left">
                        <DialogTitle className="text-base text-zinc-950">{selectedProvider?.name ?? "Provider details"}</DialogTitle>
                        <DialogDescription className="text-sm text-zinc-500">Shared profile, linked buildings, and provider-admin access grants.</DialogDescription>
                    </DialogHeader>
                    <div className="flex max-h-[85vh] flex-col">
                        <div className="flex-1 overflow-x-hidden overflow-y-auto bg-zinc-50/40 px-6 py-6">
                            <div className="space-y-6">
                        {!selectedProvider ? (
                            <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-sm text-zinc-500">Provider details are unavailable.</div>
                        ) : (
                            <>
                                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h2 className="text-xl font-semibold text-zinc-900">{selectedProvider.name}</h2>
                                            <p className="mt-1 text-sm text-zinc-500">{selectedProvider.serviceCategory || "Service category not set"}</p>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <Badge className={selectedProvider.isActive ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-700"}>{selectedProvider.isActive ? "Active provider" : "Inactive provider"}</Badge>
                                                {selectedProvider.providerProfileOwnedByProvider ? <Badge className="bg-amber-50 text-amber-700">Provider-owned</Badge> : null}
                                                {!selectedProvider.providerProfileOwnedByProvider ? <Badge className="bg-sky-50 text-sky-700">Provider admin access pending</Badge> : null}
                                            </div>
                                        </div>
                                        {canWriteProviders ? (
                                            <Button variant="outline" size="sm" onClick={() => openEdit(selectedProvider)} disabled={selectedProvider.providerProfileOwnedByProvider}>
                                                <Pencil className="mr-2 h-4 w-4" />
                                                Edit
                                            </Button>
                                        ) : null}
                                    </div>
                                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                                        <div><div className="text-xs uppercase tracking-wide text-zinc-400">Contact</div><div className="mt-1 text-sm text-zinc-700">{[selectedProvider.contactName, selectedProvider.contactEmail, selectedProvider.contactPhone].filter(Boolean).join(" | ") || "Not set"}</div></div>
                                        <div><div className="text-xs uppercase tracking-wide text-zinc-400">Notes</div><div className="mt-1 text-sm text-zinc-700">{selectedProvider.notes || "No operational notes"}</div></div>
                                    </div>
                                    {selectedProvider.providerProfileOwnedByProvider ? (
                                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                            Org-side profile editing is disabled because provider ownership has started.
                                        </div>
                                    ) : providerOwnershipPending ? (
                                        <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                                            Provider ownership has not started yet. If the provider-owned badge is not visible, the provider admin access is still pending and org management remains responsible for this shared profile.
                                        </div>
                                    ) : null}
                                </div>

                                <div className="grid gap-4 md:grid-cols-3">
                                    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                                        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Ownership state</div>
                                        <div className="mt-2 text-sm font-medium text-zinc-900">
                                            {selectedProvider.providerProfileOwnedByProvider ? "Provider-owned" : "Provider admin pending"}
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                                        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Linked buildings</div>
                                        <div className="mt-2 text-sm font-medium text-zinc-900">{selectedProvider.linkedBuildings.length}</div>
                                    </div>
                                    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                                        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Admin grants</div>
                                        <div className="mt-2 text-sm font-medium text-zinc-900">{accessGrants.length}</div>
                                    </div>
                                </div>

                                <div className="space-y-4 rounded-2xl border border-zinc-200 p-5">
                                    <div><h3 className="text-sm font-semibold text-zinc-900">Linked buildings</h3><p className="text-xs text-zinc-500">Providers can only be assigned to requests in linked buildings.</p></div>
                                    <div className="space-y-2">
                                        {selectedProvider.linkedBuildings.length === 0 ? (
                                            <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-sm text-zinc-500">No linked buildings yet.</div>
                                        ) : (
                                            selectedProvider.linkedBuildings.map((link) => (
                                                <div key={link.buildingId} className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3">
                                                    <div><div className="font-medium text-zinc-900">{link.buildingName || link.buildingId}</div><div className="text-xs text-zinc-500">{link.buildingId}</div></div>
                                                    {canWriteProviders ? <Button variant="outline" size="sm" onClick={() => unlinkBuilding.mutateAsync({ providerId: selectedProvider.id, buildingId: link.buildingId }).then(() => toast.success("Provider unlinked from building")).catch((error) => toast.error(error instanceof Error ? error.message : "Failed to unlink provider from building"))}>Unlink</Button> : null}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    {canWriteProviders ? (
                                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                                            <Select value={buildingToLink} onValueChange={setBuildingToLink}>
                                                <SelectTrigger><SelectValue placeholder="Select building to link" /></SelectTrigger>
                                                <SelectContent>{availableBuildings.length === 0 ? <SelectItem value="__none__" disabled>No more buildings available</SelectItem> : availableBuildings.map((building) => <SelectItem key={building.id} value={building.id}>{building.name}</SelectItem>)}</SelectContent>
                                            </Select>
                                            <Button onClick={handleLinkBuilding} disabled={!buildingToLink}>Link building</Button>
                                        </div>
                                    ) : null}
                                </div>

                                <div className="space-y-4 rounded-2xl border border-zinc-200 p-5">
                                    <div><h3 className="text-sm font-semibold text-zinc-900">Provider admin access</h3><p className="text-xs text-zinc-500">Org management can invite the initial provider admin and manage grant state. The provider-owned badge appears after the provider admin completes onboarding.</p></div>
                                    <div className="space-y-2">
                                        {accessGrants.length === 0 ? (
                                            <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-sm text-zinc-500">No provider-admin access grants yet.</div>
                                        ) : (
                                            accessGrants.map((grant) => (
                                                <div key={grant.id} className="rounded-xl border border-zinc-200 px-4 py-3">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div>
                                                            <div className="font-medium text-zinc-900">{grant.user?.name ?? grant.user?.email ?? grant.inviteEmail ?? "Access grant"}</div>
                                                            <div className="mt-1 text-xs text-zinc-500">{grant.user?.email ?? grant.inviteEmail ?? "No email available"}</div>
                                                        </div>
                                                        <Badge className={grant.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : grant.status === "PENDING" ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-700"}>{grant.status}</Badge>
                                                    </div>
                                                    {canWriteProviders ? (
                                                        <div className="mt-3 flex gap-2">
                                                            {grant.status === "PENDING" ? <Button variant="outline" size="sm" onClick={() => resendInvite.mutateAsync({ providerId: selectedProvider.id, grantId: grant.id }).then(() => toast.success("Invite resent")).catch((error) => toast.error(error instanceof Error ? error.message : "Failed to resend invite"))}>Resend invite</Button> : null}
                                                            {grant.status !== "DISABLED" ? <Button variant="outline" size="sm" onClick={() => disableAccessGrant.mutateAsync({ providerId: selectedProvider.id, grantId: grant.id, verificationMethod: "MANUAL_REVIEW" }).then(() => toast.success("Access disabled")).catch((error) => toast.error(error instanceof Error ? error.message : "Failed to disable access"))}>Disable access</Button> : null}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    {canWriteProviders ? (
                                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                                            <Input value={accessGrantEmail} onChange={(event) => setAccessGrantEmail(event.target.value)} placeholder="admin@provider.test" />
                                            <Button onClick={handleCreateAccessGrant} disabled={!accessGrantEmail.trim()}>Invite admin</Button>
                                        </div>
                                    ) : null}
                                </div>
                            </>
                        )}
                            </div>
                        </div>
                        <div className="border-t border-zinc-100 bg-white px-6 py-4">
                            <DialogFooter className="flex-row justify-end gap-3 sm:space-x-0">
                                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsDetailOpen(false)}>
                                    Close
                                </Button>
                            </DialogFooter>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="w-[96vw] max-w-[96vw] overflow-hidden p-0 sm:max-w-4xl lg:max-w-5xl">
                    <DialogHeader className="border-b border-zinc-100 bg-zinc-50/70 px-6 py-5 text-left">
                        <DialogTitle className="text-base text-zinc-950">
                            {editingProviderId ? "Edit provider" : "Create provider"}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-zinc-500">
                            Capture the shared provider profile, operational contact, and initial onboarding details.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex max-h-[85vh] flex-col">
                        <div className="flex-1 overflow-x-hidden overflow-y-auto bg-zinc-50/40 px-6 py-6">
                            <div className="space-y-6">
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-zinc-900">
                                    {editingProviderId ? "Update provider profile" : "Create shared provider profile"}
                                </h3>
                                <p className="mt-1 text-sm text-zinc-500">
                                    {editingProviderId
                                        ? "Adjust the shared provider record used across building assignments and request routing."
                                        : "This creates the org-side provider record before the provider begins managing its own profile."}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary" className="bg-white text-zinc-700">
                                    {editingProviderId ? "Editing" : "New profile"}
                                </Badge>
                                <Badge variant="secondary" className={form.isActive === "active" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-700"}>
                                    {form.isActive === "active" ? "Active" : "Inactive"}
                                </Badge>
                            </div>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <div className="rounded-xl border border-zinc-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Provider</p>
                                <p className="mt-2 text-sm font-medium text-zinc-900">{form.name.trim() || "Not named yet"}</p>
                            </div>
                            <div className="rounded-xl border border-zinc-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Category</p>
                                <p className="mt-2 text-sm font-medium text-zinc-900">{form.serviceCategory.trim() || "Not set"}</p>
                            </div>
                            <div className="rounded-xl border border-zinc-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Onboarding</p>
                                <p className="mt-2 text-sm font-medium text-zinc-900">
                                    {editingProviderId ? "Profile update only" : form.adminEmail.trim() ? "Admin invite ready" : "Admin invite optional"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <ProviderFormSection
                        icon={Wrench}
                        title="Provider profile"
                        description="Define the shared provider identity used across requests and directory views."
                    >
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Provider name *</label>
                                <Input
                                    value={form.name}
                                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                                    placeholder="RapidFix Technical Services"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Service category</label>
                                <Select
                                    value={currentServiceCategory || "__none__"}
                                    onValueChange={(value) => setForm((prev) => ({ ...prev, serviceCategory: value === "__none__" ? "" : value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">Not set</SelectItem>
                                        {hasCustomServiceCategory ? (
                                            <SelectItem value={currentServiceCategory}>{currentServiceCategory}</SelectItem>
                                        ) : null}
                                        {PROVIDER_SERVICE_CATEGORY_OPTIONS.map((option) => (
                                            <SelectItem key={option} value={option}>
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Status</label>
                                <Select value={form.isActive} onValueChange={(value) => setForm((prev) => ({ ...prev, isActive: value as "active" | "inactive" }))}>
                                    <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Notes</label>
                                <Textarea
                                    value={form.notes}
                                    onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                                    rows={4}
                                    placeholder="24/7 emergency coverage"
                                />
                            </div>
                        </div>
                    </ProviderFormSection>

                    <ProviderFormSection
                        icon={UserRound}
                        title="Primary contact"
                        description="Add the main operational contact used for coordination and fallback communication."
                    >
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Contact name</label>
                                <div className="relative">
                                    <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                    <Input
                                        value={form.contactName}
                                        onChange={(event) => setForm((prev) => ({ ...prev, contactName: event.target.value }))}
                                        placeholder="Nadia Khan"
                                        className="pl-9"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Contact phone</label>
                                <div className="relative">
                                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                    <Input
                                        value={form.contactPhone}
                                        onChange={(event) => setForm((prev) => ({ ...prev, contactPhone: event.target.value }))}
                                        placeholder="+971500000000"
                                        className="pl-9"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Contact email</label>
                                <div className="relative">
                                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                    <Input
                                        value={form.contactEmail}
                                        onChange={(event) => setForm((prev) => ({ ...prev, contactEmail: event.target.value }))}
                                        placeholder="ops@rapidfix.test"
                                        className="pl-9"
                                    />
                                </div>
                            </div>
                        </div>
                    </ProviderFormSection>

                    {!editingProviderId ? (
                        <ProviderFormSection
                            icon={ClipboardList}
                            title="Initial onboarding"
                            description="Optionally attach the first provider admin and first building link during creation."
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Initial admin email</label>
                                    <div className="relative">
                                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                        <Input
                                            value={form.adminEmail}
                                            onChange={(event) => setForm((prev) => ({ ...prev, adminEmail: event.target.value }))}
                                            placeholder="admin@rapidfix.test"
                                            className="pl-9"
                                        />
                                    </div>
                                    <p className="text-xs text-zinc-500">Leave blank if the provider admin will be invited later from the detail sheet.</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Initial building link</label>
                                    <Select value={form.initialBuildingId || "__none__"} onValueChange={(value) => setForm((prev) => ({ ...prev, initialBuildingId: value === "__none__" ? "" : value }))}>
                                        <SelectTrigger><SelectValue placeholder="Select building" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">No initial building</SelectItem>
                                            {(accessibleBuildingsQuery.data ?? []).map((building) => (
                                                <SelectItem key={building.id} value={building.id}>{building.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-zinc-500">This can also be added later from the provider details panel.</p>
                                </div>
                            </div>
                        </ProviderFormSection>
                    ) : null}
                            </div>
                        </div>
                        <div className="border-t border-zinc-100 bg-white px-6 py-4">
                            <DialogFooter className="flex-row justify-end gap-3 sm:space-x-0">
                                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsFormOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSubmitProvider}
                                    disabled={createProvider.isPending || updateProvider.isPending}
                                    className="h-11 rounded-xl bg-zinc-900 px-5 text-white hover:bg-zinc-800"
                                >
                                    {editingProviderId
                                        ? updateProvider.isPending
                                            ? "Saving..."
                                            : "Save provider"
                                        : createProvider.isPending
                                            ? "Creating..."
                                            : "Create provider"}
                                </Button>
                            </DialogFooter>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
