"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Building2, Pencil, Plus, Search, ShieldAlert, Wrench } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Providers</h1>
                        <p className="mt-1 text-sm text-zinc-500">Manage shared provider profiles, linked buildings, and provider-admin access grants.</p>
                    </div>
                    {canWriteProviders ? (
                        <Button onClick={openCreate} className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800">
                            <Plus className="mr-2 h-4 w-4" />
                            Add provider
                        </Button>
                    ) : null}
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"><Wrench className="h-5 w-5 text-zinc-700" /><div className="mt-3 text-2xl font-bold text-zinc-900">{providers.length}</div><p className="text-xs text-zinc-500">Registered providers</p></div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"><Building2 className="h-5 w-5 text-zinc-700" /><div className="mt-3 text-2xl font-bold text-zinc-900">{providers.reduce((count, provider) => count + provider.linkedBuildings.length, 0)}</div><p className="text-xs text-zinc-500">Building links</p></div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"><ShieldAlert className="h-5 w-5 text-zinc-700" /><div className="mt-3 text-2xl font-bold text-zinc-900">{providers.filter((provider) => provider.providerProfileOwnedByProvider).length}</div><p className="text-xs text-zinc-500">Provider-owned profiles</p></div>
                </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="relative max-w-md">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search providers" className="pl-9" />
                </div>

                <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200">
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

            <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <SheetContent side="right" className="w-full gap-0 border-l border-zinc-200 bg-white sm:max-w-2xl">
                    <SheetHeader className="border-b border-zinc-100 px-6 py-5 text-left">
                        <SheetTitle>{selectedProvider?.name ?? "Provider details"}</SheetTitle>
                        <SheetDescription>Shared profile, linked buildings, and provider-admin access grants.</SheetDescription>
                    </SheetHeader>
                    <div className="space-y-6 overflow-y-auto px-6 py-6">
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
                                    ) : null}
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
                                    <div><h3 className="text-sm font-semibold text-zinc-900">Provider admin access</h3><p className="text-xs text-zinc-500">Org management can invite the initial provider admin and manage grant state.</p></div>
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
                </SheetContent>
            </Sheet>

            <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
                <SheetContent side="right" className="w-full gap-0 border-l border-zinc-200 bg-white sm:max-w-xl">
                    <SheetHeader className="border-b border-zinc-100 px-6 py-5 text-left">
                        <SheetTitle>{editingProviderId ? "Edit provider" : "Create provider"}</SheetTitle>
                        <SheetDescription>Capture the shared profile used for request assignment and initial provider-admin onboarding.</SheetDescription>
                    </SheetHeader>
                    <div className="space-y-5 overflow-y-auto px-6 py-6">
                        <div className="space-y-2"><label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Provider name *</label><Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="RapidFix Technical Services" /></div>
                        <div className="space-y-2"><label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Service category</label><Input value={form.serviceCategory} onChange={(event) => setForm((prev) => ({ ...prev, serviceCategory: event.target.value }))} placeholder="Plumbing" /></div>
                        <div className="grid gap-5 md:grid-cols-2">
                            <div className="space-y-2"><label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Contact name</label><Input value={form.contactName} onChange={(event) => setForm((prev) => ({ ...prev, contactName: event.target.value }))} placeholder="Nadia Khan" /></div>
                            <div className="space-y-2"><label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Contact phone</label><Input value={form.contactPhone} onChange={(event) => setForm((prev) => ({ ...prev, contactPhone: event.target.value }))} placeholder="+971500000000" /></div>
                        </div>
                        <div className="space-y-2"><label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Contact email</label><Input value={form.contactEmail} onChange={(event) => setForm((prev) => ({ ...prev, contactEmail: event.target.value }))} placeholder="ops@rapidfix.test" /></div>
                        {!editingProviderId ? (
                            <>
                                <div className="space-y-2"><label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Initial admin email</label><Input value={form.adminEmail} onChange={(event) => setForm((prev) => ({ ...prev, adminEmail: event.target.value }))} placeholder="admin@rapidfix.test" /></div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Initial building link</label>
                                    <Select value={form.initialBuildingId || "__none__"} onValueChange={(value) => setForm((prev) => ({ ...prev, initialBuildingId: value === "__none__" ? "" : value }))}>
                                        <SelectTrigger><SelectValue placeholder="Select building" /></SelectTrigger>
                                        <SelectContent><SelectItem value="__none__">No initial building</SelectItem>{(accessibleBuildingsQuery.data ?? []).map((building) => <SelectItem key={building.id} value={building.id}>{building.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </>
                        ) : null}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Status</label>
                            <Select value={form.isActive} onValueChange={(value) => setForm((prev) => ({ ...prev, isActive: value as "active" | "inactive" }))}>
                                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                                <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2"><label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Notes</label><Textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} rows={4} placeholder="24/7 emergency coverage" /></div>
                        <div className="flex justify-end"><Button onClick={handleSubmitProvider} disabled={createProvider.isPending || updateProvider.isPending} className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800">{editingProviderId ? "Save provider" : "Create provider"}</Button></div>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
