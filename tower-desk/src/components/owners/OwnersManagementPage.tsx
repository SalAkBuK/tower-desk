"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    CheckCircle2,
    Link2,
    Mail,
    MessageCircle,
    Plus,
    Search,
    ShieldAlert,
    XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import {
    useActivateOwnerAccessGrant,
    useCreateOwner,
    useDisableOwnerAccessGrant,
    useInviteOwnerAccessGrant,
    useLinkExistingOwnerUser,
    useOwnerAccessGrantHistory,
    useOwnerAccessGrants,
    useOwners,
    useResendOwnerAccessGrantInvite,
    useResolveOwnerParty,
} from "@/lib/queries";
import { portalPath } from "@/lib/portalPaths";
import { hasPermission as hasRbacPermission } from "@/lib/rbac";
import { isOrganizationAdminRole } from "@/lib/roles";
import type { CreateOwnerPayload, Owner, OwnerAccessGrant, ResolveOwnerPartyPayload } from "@/lib/types";

const IDENTIFIER_NONE = "__none__";
const PARTY_TYPE_OPTIONS = ["INDIVIDUAL", "COMPANY"] as const;
const IDENTIFIER_TYPE_OPTIONS = ["EMIRATES_ID", "PASSPORT", "TRADE_LICENSE", "OTHER"] as const;
const ACTIVATE_METHOD_OPTIONS = ["EMAIL_MATCH", "MANUAL_REVIEW"] as const;
const DISABLE_METHOD_OPTIONS = ["MANUAL_REVOKE", "MANUAL_REVIEW"] as const;

type OwnerFormState = {
    name: string;
    partyType: string;
    displayNameEn: string;
    displayNameAr: string;
    email: string;
    phone: string;
    address: string;
    resolutionToken: string;
    identifierType: string;
    identifierValue: string;
    identifierCountryCode: string;
    identifierIssuingAuthority: string;
    displayNameOverride: string;
    contactEmailOverride: string;
    contactPhoneOverride: string;
    notes: string;
};

const initialOwnerFormState = (): OwnerFormState => ({
    name: "",
    partyType: "INDIVIDUAL",
    displayNameEn: "",
    displayNameAr: "",
    email: "",
    phone: "",
    address: "",
    resolutionToken: "",
    identifierType: IDENTIFIER_NONE,
    identifierValue: "",
    identifierCountryCode: "AE",
    identifierIssuingAuthority: "ICP",
    displayNameOverride: "",
    contactEmailOverride: "",
    contactPhoneOverride: "",
    notes: "",
});

const formatDateTime = (value?: string | null) => {
    if (!value) return "Not available";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
};

const formatEnumLabel = (value?: string | null) => {
    const source = String(value ?? "").trim();
    if (!source) return "Not set";
    return source
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatPartyTypeLabel = (value?: string | null) => {
    const normalized = String(value ?? "").trim().toUpperCase();
    if (normalized === "INDIVIDUAL") return "Individual";
    if (normalized === "COMPANY") return "Company";
    return formatEnumLabel(value);
};

const formatOwnerIdentifier = (owner?: Owner | null) => {
    if (!owner?.identifier?.type || !owner?.identifier?.value) return "Not set";
    return `${formatEnumLabel(owner.identifier.type)}: ${owner.identifier.value}`;
};

const statusToneClassName = (status?: string | null) => {
    const normalized = String(status ?? "").trim().toUpperCase();
    if (normalized === "ACTIVE") return "bg-emerald-50 text-emerald-700";
    if (normalized === "PENDING") return "bg-amber-50 text-amber-700";
    if (normalized === "DISABLED") return "bg-zinc-100 text-zinc-700";
    return "bg-zinc-100 text-zinc-700";
};

const getGrantHeadline = (grant: OwnerAccessGrant) =>
    grant.linkedUser?.name
    ?? grant.linkedUser?.email
    ?? grant.inviteEmail
    ?? grant.userId
    ?? "Unlinked owner access grant";

const getInviteGrantSuccessMessage = (grant?: OwnerAccessGrant | null) => {
    const normalized = String(grant?.status ?? "").trim().toUpperCase();
    if (normalized === "ACTIVE") {
        return "Owner access linked immediately. This email already belongs to an active user.";
    }
    if (normalized === "PENDING") {
        return "Onboarding email sent. Access will activate automatically after password setup.";
    }
    return "Owner access grant created.";
};

const getGrantStatusSummary = (grant: OwnerAccessGrant) => {
    const normalized = String(grant.status ?? "").trim().toUpperCase();
    if (normalized === "ACTIVE") {
        return "This owner email is linked to an active portal user.";
    }
    if (normalized === "PENDING") {
        return "Onboarding email sent. The grant activates automatically after password setup.";
    }
    if (normalized === "DISABLED") {
        return "This grant is disabled and does not provide owner portal access.";
    }
    return "Grant state reported by the backend.";
};

export function OwnersManagementPage() {
    const router = useRouter();
    const { user, baseRole } = useAuth();
    const isOrgAdmin = isOrganizationAdminRole(baseRole);
    const canReadOwners = baseRole === "superadmin" || isOrgAdmin || hasRbacPermission(user, "owners.read");
    const canWriteOwners = baseRole === "superadmin" || isOrgAdmin || hasRbacPermission(user, "owners.write");
    const canResolveParty = baseRole === "superadmin" || hasRbacPermission(user, "owner_registry.resolve");
    const canReadAccessGrants = baseRole === "superadmin" || hasRbacPermission(user, "owner_access_grants.read");
    const canWriteAccessGrants = baseRole === "superadmin" || hasRbacPermission(user, "owner_access_grants.write");
    const canWriteMessages = hasRbacPermission(user, "messaging.write");

    const [search, setSearch] = useState("");
    const deferredSearch = useDeferredValue(search);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
    const [selectedOwnerFallback, setSelectedOwnerFallback] = useState<Owner | null>(null);
    const [ownerForm, setOwnerForm] = useState<OwnerFormState>(initialOwnerFormState);
    const [ownerFormError, setOwnerFormError] = useState<string | null>(null);
    const [inviteEmail, setInviteEmail] = useState("");
    const [existingUserId, setExistingUserId] = useState("");
    const [activateUserIds, setActivateUserIds] = useState<Record<string, string>>({});
    const [activateMethods, setActivateMethods] = useState<Record<string, string>>({});
    const [disableMethods, setDisableMethods] = useState<Record<string, string>>({});

    const { data: owners, isLoading: isOwnersLoading, error: ownersError } = useOwners({
        enabled: canReadOwners,
        search: deferredSearch.trim() || undefined,
    });
    const createOwner = useCreateOwner();
    const resolveOwnerParty = useResolveOwnerParty();
    const inviteOwnerAccessGrant = useInviteOwnerAccessGrant();
    const linkExistingOwnerUser = useLinkExistingOwnerUser();
    const activateOwnerAccessGrant = useActivateOwnerAccessGrant();
    const disableOwnerAccessGrant = useDisableOwnerAccessGrant();
    const resendOwnerAccessGrantInvite = useResendOwnerAccessGrantInvite();

    const selectedOwner = useMemo(
        () => (owners ?? []).find((owner) => owner.id === selectedOwnerId) ?? selectedOwnerFallback,
        [owners, selectedOwnerFallback, selectedOwnerId]
    );

    useEffect(() => {
        if (!selectedOwner) return;
        setSelectedOwnerFallback(selectedOwner);
    }, [selectedOwner]);

    useEffect(() => {
        if (!isCreateOpen) return;
        setOwnerForm(initialOwnerFormState());
        setOwnerFormError(null);
    }, [isCreateOpen]);

    const {
        data: accessGrants,
        isLoading: isAccessGrantsLoading,
        error: accessGrantsError,
    } = useOwnerAccessGrants(selectedOwner?.id, {
        enabled: Boolean(selectedOwner?.id) && canReadAccessGrants,
    });
    const {
        data: accessGrantHistory,
        isLoading: isHistoryLoading,
        error: historyError,
    } = useOwnerAccessGrantHistory(selectedOwner?.id, {
        enabled: Boolean(selectedOwner?.id) && canReadAccessGrants,
    });

    const stats = useMemo(() => {
        const items = owners ?? [];
        return items.reduce(
            (acc, owner) => {
                acc.total += 1;
                if (owner.email) acc.withEmail += 1;
                if (owner.phone) acc.withPhone += 1;
                if (owner.identifier?.value) acc.withIdentifier += 1;
                return acc;
            },
            { total: 0, withEmail: 0, withPhone: 0, withIdentifier: 0 }
        );
    }, [owners]);

    const setOwnerField = (field: keyof OwnerFormState, value: string) => {
        setOwnerForm((current) => ({ ...current, [field]: value }));
    };

    const buildCreateOwnerPayload = (): CreateOwnerPayload | null => {
        const name = ownerForm.name.trim();
        if (!name) {
            setOwnerFormError("Owner name is required.");
            return null;
        }

        const hasIdentifierValue = Boolean(ownerForm.identifierValue.trim());
        const hasIdentifierType = ownerForm.identifierType !== IDENTIFIER_NONE;
        if (hasIdentifierValue !== hasIdentifierType) {
            setOwnerFormError("Legal identifier type and value must both be provided.");
            return null;
        }

        const identifier = hasIdentifierType
            ? {
                type: ownerForm.identifierType,
                value: ownerForm.identifierValue.trim(),
                countryCode: ownerForm.identifierCountryCode.trim() || undefined,
                issuingAuthority: ownerForm.identifierIssuingAuthority.trim() || undefined,
            }
            : undefined;

        const hasOverrides = [
            ownerForm.displayNameOverride,
            ownerForm.contactEmailOverride,
            ownerForm.contactPhoneOverride,
            ownerForm.notes,
        ].some((value) => value.trim().length > 0);

        setOwnerFormError(null);
        return {
            name,
            partyType: ownerForm.partyType,
            displayNameEn: ownerForm.displayNameEn.trim() || undefined,
            displayNameAr: ownerForm.displayNameAr.trim() || undefined,
            email: ownerForm.email.trim() || undefined,
            phone: ownerForm.phone.trim() || undefined,
            address: ownerForm.address.trim() || undefined,
            resolutionToken: ownerForm.resolutionToken.trim() || undefined,
            identifier,
            ownerOverrides: hasOverrides
                ? {
                    displayNameOverride: ownerForm.displayNameOverride.trim() || undefined,
                    contactEmailOverride: ownerForm.contactEmailOverride.trim() || undefined,
                    contactPhoneOverride: ownerForm.contactPhoneOverride.trim() || undefined,
                    notes: ownerForm.notes.trim() || undefined,
                }
                : undefined,
        };
    };

    const handleResolveParty = async () => {
        if (ownerForm.identifierType === IDENTIFIER_NONE || !ownerForm.identifierValue.trim()) {
            setOwnerFormError("Identity check requires a legal identifier type and value.");
            return;
        }

        const payload: ResolveOwnerPartyPayload = {
            identifierType: ownerForm.identifierType,
            identifierValue: ownerForm.identifierValue.trim(),
            countryCode: ownerForm.identifierCountryCode.trim() || undefined,
            issuingAuthority: ownerForm.identifierIssuingAuthority.trim() || undefined,
        };

        try {
            const result = await resolveOwnerParty.mutateAsync(payload);
            setOwnerForm((current) => ({
                ...current,
                resolutionToken: result.resolutionToken || current.resolutionToken,
                displayNameAr: current.displayNameAr || result.matchedOwner?.displayNameAr || "",
            }));
            toast.success(result.matchedOwner ? "Existing owner identity found" : "No existing owner identity found");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to check existing owner identity";
            setOwnerFormError(message);
            toast.error(message);
        }
    };

    const handleCreateOwner = async () => {
        const payload = buildCreateOwnerPayload();
        if (!payload) return;

        try {
            const created = await createOwner.mutateAsync(payload);
            toast.success("Owner created");
            setSelectedOwnerId(created.id);
            setSelectedOwnerFallback(created);
            setIsCreateOpen(false);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to create owner";
            setOwnerFormError(message);
            toast.error(message);
        }
    };

    const handleUseExistingOwnerIdentity = (owner: Owner) => {
        setSelectedOwnerId(owner.id);
        setSelectedOwnerFallback(owner);
        setIsCreateOpen(false);
        toast.success("Existing owner identity opened");
    };

    const handleInviteGrant = async () => {
        if (!selectedOwner?.id) return;
        const email = inviteEmail.trim();
        if (!email) {
            toast.error("Invite email is required.");
            return;
        }
        try {
            const result = await inviteOwnerAccessGrant.mutateAsync({ ownerId: selectedOwner.id, email });
            setInviteEmail("");
            toast.success(getInviteGrantSuccessMessage(result.grant));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to grant owner access");
        }
    };

    const handleLinkExistingUser = async () => {
        if (!selectedOwner?.id) return;
        const userId = existingUserId.trim();
        if (!userId) {
            toast.error("Existing user ID is required.");
            return;
        }
        try {
            await linkExistingOwnerUser.mutateAsync({ ownerId: selectedOwner.id, userId });
            setExistingUserId("");
            toast.success("Existing user linked via fallback admin tool");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to link existing user");
        }
    };

    const handleActivateGrant = async (grantId: string) => {
        if (!selectedOwner?.id) return;
        const userId = (activateUserIds[grantId] ?? "").trim();
        if (!userId) {
            toast.error("User ID is required to activate this grant.");
            return;
        }
        try {
            await activateOwnerAccessGrant.mutateAsync({
                ownerId: selectedOwner.id,
                grantId,
                userId,
                verificationMethod: activateMethods[grantId] ?? "EMAIL_MATCH",
            });
            toast.success("Owner access grant activated via fallback admin tool");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to activate owner access grant");
        }
    };

    const handleDisableGrant = async (grantId: string) => {
        if (!selectedOwner?.id) return;
        try {
            await disableOwnerAccessGrant.mutateAsync({
                ownerId: selectedOwner.id,
                grantId,
                verificationMethod: disableMethods[grantId] ?? "MANUAL_REVOKE",
            });
            toast.success("Owner access grant disabled");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to disable owner access grant");
        }
    };

    const handleResendInvite = async (grantId: string) => {
        if (!selectedOwner?.id) return;
        try {
            await resendOwnerAccessGrantInvite.mutateAsync({ ownerId: selectedOwner.id, grantId });
            toast.success("Onboarding email resent");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to resend onboarding email");
        }
    };

    const handleMessageOwner = (grant: OwnerAccessGrant) => {
        const ownerId = selectedOwner?.id;
        if (!ownerId) return;
        const participantUserId = grant.userId ?? "";
        if (!participantUserId) {
            toast.error("This owner grant is not linked to a messageable user account.");
            return;
        }
        const params = new URLSearchParams({
            compose: "1",
            ownerId,
            participantUserId,
        });
        if (grant.linkedUser?.name) params.set("participantName", grant.linkedUser.name);
        if (grant.linkedUser?.email) params.set("participantEmail", grant.linkedUser.email);
        router.push(`${portalPath("messages")}?${params.toString()}`);
    };

    if (!canReadOwners) {
        return (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                        <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-zinc-900">Owners</h1>
                        <p className="text-sm text-zinc-500">You do not have permission to view owners.</p>
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
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Owners</h1>
                        <p className="mt-1 text-sm text-zinc-500">
                            Manage the org-scoped owner registry. Owner access is usually granted by email, while manual link and activate actions stay available as fallback admin tools.
                        </p>
                    </div>
                    {canWriteOwners ? (
                        <Button onClick={() => setIsCreateOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Owner
                        </Button>
                    ) : null}
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                        { label: "Total Owners", value: stats.total },
                        { label: "With Email", value: stats.withEmail },
                        { label: "With Phone", value: stats.withPhone },
                        { label: "With Identifier", value: stats.withIdentifier },
                    ].map((stat) => (
                        <div key={stat.label} className="rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{stat.label}</p>
                            <p className="mt-2 text-2xl font-semibold text-zinc-900">{stat.value}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-zinc-900">Owner Directory</h2>
                        <p className="text-xs text-zinc-400">Search by owner name, email, phone, or address.</p>
                    </div>
                    <div className="relative w-full sm:max-w-sm">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search owners" className="pl-9" />
                    </div>
                </div>

                {ownersError ? (
                    <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {ownersError instanceof Error ? ownersError.message : "Failed to load owners."}
                    </div>
                ) : null}

                <div className="mt-6">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Owner</TableHead>
                                <TableHead>Contact</TableHead>
                                <TableHead>Address</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isOwnersLoading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="py-10 text-center text-sm text-zinc-500">
                                        Loading owners...
                                    </TableCell>
                                </TableRow>
                            ) : (owners ?? []).length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="py-10 text-center text-sm text-zinc-500">
                                        No owners found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                (owners ?? []).map((owner) => (
                                    <TableRow key={owner.id}>
                                        <TableCell>
                                            <div>
                                                <div className="font-medium text-zinc-900">{owner.name || owner.displayNameEn || owner.id}</div>
                                                {owner.displayNameAr || (owner.displayNameEn && owner.displayNameEn !== owner.name) ? (
                                                    <div className="text-xs text-zinc-500">
                                                        {[owner.displayNameAr, owner.displayNameEn && owner.displayNameEn !== owner.name ? owner.displayNameEn : null].filter(Boolean).join(" / ")}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {owner.email || owner.phone ? (
                                                <div className="space-y-1 text-xs text-zinc-600">
                                                    {owner.email ? <div>{owner.email}</div> : null}
                                                    {owner.phone ? <div>{owner.phone}</div> : null}
                                                </div>
                                            ) : (
                                                <div className="text-xs text-zinc-500">No contact details</div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm text-zinc-700">{owner.address || "No address"}</div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedOwnerId(owner.id);
                                                    setSelectedOwnerFallback(owner);
                                                }}
                                            >
                                                Open
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <SheetContent side="right" className="w-[96vw] sm:max-w-3xl">
                    <SheetHeader className="border-b border-zinc-200">
                        <SheetTitle>Create Owner</SheetTitle>
                        <SheetDescription>
                            Start with the owner&apos;s basic details. If you have a strong legal identifier, you can check for an existing owner identity first.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="flex-1 space-y-6 overflow-y-auto p-6">
                        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                            <div className="mb-4">
                                <p className="text-sm font-semibold text-zinc-900">Basic details</p>
                                <p className="mt-1 text-sm text-zinc-500">Normal users should be able to create an owner with just name, optional email, and optional phone.</p>
                            </div>
                            <div className="grid gap-4 lg:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-xs text-zinc-500">Owner name</label>
                                    <Input
                                        value={ownerForm.name}
                                        onChange={(event) => setOwnerField("name", event.target.value)}
                                        placeholder="Jane Owner"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs text-zinc-500">Owner type</label>
                                    <Select value={ownerForm.partyType} onValueChange={(value) => setOwnerField("partyType", value)}>
                                        <SelectTrigger><SelectValue placeholder="Select owner type" /></SelectTrigger>
                                        <SelectContent>
                                            {PARTY_TYPE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{formatPartyTypeLabel(option)}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs text-zinc-500">Email</label>
                                    <Input
                                        value={ownerForm.email}
                                        onChange={(event) => setOwnerField("email", event.target.value)}
                                        type="email"
                                        placeholder="owner@example.com"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs text-zinc-500">Phone</label>
                                    <Input
                                        value={ownerForm.phone}
                                        onChange={(event) => setOwnerField("phone", event.target.value)}
                                        placeholder="+971..."
                                    />
                                </div>
                            </div>
                            <p className="mt-3 text-xs text-zinc-500">
                                Required: owner name. Everything else here is optional.
                            </p>
                        </div>

                        <details className="rounded-2xl border border-zinc-200 bg-zinc-50/70">
                            <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-zinc-900">
                                Optional identity check
                            </summary>
                            <div className="space-y-6 border-t border-zinc-200 px-5 py-5">
                                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <p className="text-sm font-semibold text-zinc-900">Check existing owner identity</p>
                                            <p className="mt-1 text-sm text-zinc-500">
                                                If you have Emirates ID, passport, trade license, or VAT TRN, check first to avoid duplicate owners.
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={!canResolveParty || resolveOwnerParty.isPending}
                                            onClick={() => {
                                                void handleResolveParty();
                                            }}
                                        >
                                            {resolveOwnerParty.isPending ? "Checking..." : "Check existing owner identity"}
                                        </Button>
                                    </div>
                                    {!canResolveParty ? (
                                        <p className="mt-3 text-xs text-zinc-500">Missing `owner_registry.resolve` permission.</p>
                                    ) : null}
                                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                                        <div>
                                            <label className="mb-1 block text-xs text-zinc-500">Legal identifier type</label>
                                                <Select value={ownerForm.identifierType} onValueChange={(value) => setOwnerField("identifierType", value)}>
                                                    <SelectTrigger><SelectValue placeholder="Optional legal identifier" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value={IDENTIFIER_NONE}>None</SelectItem>
                                                        {IDENTIFIER_TYPE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-xs text-zinc-500">Legal identifier value</label>
                                                <Input value={ownerForm.identifierValue} onChange={(event) => setOwnerField("identifierValue", event.target.value)} />
                                        </div>
                                        {ownerForm.identifierType !== IDENTIFIER_NONE ? (
                                            <>
                                                <div>
                                                    <label className="mb-1 block text-xs text-zinc-500">Country code</label>
                                                    <Input value={ownerForm.identifierCountryCode} onChange={(event) => setOwnerField("identifierCountryCode", event.target.value)} />
                                                </div>
                                                <div>
                                                    <label className="mb-1 block text-xs text-zinc-500">Issuing authority</label>
                                                    <Input value={ownerForm.identifierIssuingAuthority} onChange={(event) => setOwnerField("identifierIssuingAuthority", event.target.value)} />
                                                </div>
                                            </>
                                        ) : null}
                                    </div>
                                    {resolveOwnerParty.data ? (
                                        <div className={`rounded-2xl border px-4 py-4 text-sm ${resolveOwnerParty.data.matchedOwner ? "border-emerald-200 bg-emerald-50/70" : "border-zinc-200 bg-zinc-50"}`}>
                                            <p className="font-semibold text-zinc-900">
                                                {resolveOwnerParty.data.matchedOwner ? "Matching owner identity found" : "No existing owner identity found"}
                                            </p>
                                            <p className="mt-1 text-zinc-600">
                                                {resolveOwnerParty.data.matchedOwner
                                                    ? `${resolveOwnerParty.data.matchedOwner.name || resolveOwnerParty.data.matchedOwner.displayNameEn || resolveOwnerParty.data.matchedOwner.id} | ${formatOwnerIdentifier(resolveOwnerParty.data.matchedOwner)}`
                                                    : "You can continue and create a new owner identity with the details above."}
                                            </p>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {resolveOwnerParty.data.matchedOwner ? (
                                                    <Button type="button" variant="outline" onClick={() => handleUseExistingOwnerIdentity(resolveOwnerParty.data!.matchedOwner as Owner)}>
                                                        Use existing owner identity
                                                    </Button>
                                                ) : (
                                                    <Button type="button" variant="outline" onClick={() => toast.success("Continue creating a new owner identity.")}>
                                                        Create new owner identity
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </details>

                        <details className="rounded-2xl border border-zinc-200 bg-zinc-50/70">
                            <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-zinc-900">
                                More details
                            </summary>
                            <div className="space-y-4 border-t border-zinc-200 px-5 py-5">
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block text-xs text-zinc-500">Arabic name</label>
                                        <Input value={ownerForm.displayNameAr} onChange={(event) => setOwnerField("displayNameAr", event.target.value)} />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs text-zinc-500">Address</label>
                                        <Textarea value={ownerForm.address} onChange={(event) => setOwnerField("address", event.target.value)} />
                                    </div>
                                    <div className="lg:col-span-2">
                                        <label className="mb-1 block text-xs text-zinc-500">Notes</label>
                                        <Textarea value={ownerForm.notes} onChange={(event) => setOwnerField("notes", event.target.value)} />
                                    </div>
                                </div>
                            </div>
                        </details>

                        <details className="rounded-2xl border border-zinc-200 bg-zinc-50/70">
                            <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-zinc-900">
                                Org-specific overrides
                            </summary>
                            <div className="space-y-4 border-t border-zinc-200 px-5 py-5">
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block text-xs text-zinc-500">Display name override</label>
                                        <Input value={ownerForm.displayNameOverride} onChange={(event) => setOwnerField("displayNameOverride", event.target.value)} />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs text-zinc-500">Contact email override</label>
                                        <Input value={ownerForm.contactEmailOverride} onChange={(event) => setOwnerField("contactEmailOverride", event.target.value)} />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs text-zinc-500">Contact phone override</label>
                                        <Input value={ownerForm.contactPhoneOverride} onChange={(event) => setOwnerField("contactPhoneOverride", event.target.value)} />
                                    </div>
                                </div>
                            </div>
                        </details>

                        {ownerFormError ? (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                {ownerFormError}
                            </div>
                        ) : null}

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                            <Button
                                onClick={() => {
                                    void handleCreateOwner();
                                }}
                                disabled={!canWriteOwners || createOwner.isPending}
                            >
                                {createOwner.isPending ? "Creating..." : "Create owner"}
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            <Sheet
                open={Boolean(selectedOwner)}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedOwnerId(null);
                        setSelectedOwnerFallback(null);
                    }
                }}
            >
                <SheetContent side="right" className="w-[96vw] sm:max-w-4xl">
                    <SheetHeader className="border-b border-zinc-200">
                        <SheetTitle>{selectedOwner?.name ?? "Owner details"}</SheetTitle>
                        <SheetDescription>
                            Review owner details and manage access grants separately from the owner record itself.
                        </SheetDescription>
                    </SheetHeader>

                    {selectedOwner ? (
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
                                    <p className="text-xs uppercase tracking-wide text-zinc-400">Party</p>
                                    <p className="mt-2 text-sm font-semibold text-zinc-900">{selectedOwner.partyType ?? "Not set"}</p>
                                </div>
                                <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
                                    <p className="text-xs uppercase tracking-wide text-zinc-400">Email</p>
                                    <p className="mt-2 text-sm font-semibold text-zinc-900">{selectedOwner.email ?? "Not set"}</p>
                                </div>
                                <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
                                    <p className="text-xs uppercase tracking-wide text-zinc-400">Phone</p>
                                    <p className="mt-2 text-sm font-semibold text-zinc-900">{selectedOwner.phone ?? "Not set"}</p>
                                </div>
                                <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
                                    <p className="text-xs uppercase tracking-wide text-zinc-400">Identifier</p>
                                    <p className="mt-2 text-sm font-semibold text-zinc-900">{formatOwnerIdentifier(selectedOwner)}</p>
                                </div>
                            </div>

                            <div className="mt-6 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
                                <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Owner Details</p>
                                    <div className="space-y-3 text-sm text-zinc-700">
                                        <div>
                                            <div className="text-xs text-zinc-400">Display names</div>
                                            <div className="mt-1">{[selectedOwner.displayNameEn, selectedOwner.displayNameAr].filter(Boolean).join(" / ") || "Not set"}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-zinc-400">Address</div>
                                            <div className="mt-1">{selectedOwner.address ?? "Not set"}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-zinc-400">Resolution token</div>
                                            <div className="mt-1 break-all">{selectedOwner.resolutionToken ?? "Not set"}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-zinc-400">Created</div>
                                            <div className="mt-1">{formatDateTime(selectedOwner.createdAt)}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                                    <Tabs defaultValue="grants">
                                        <TabsList>
                                            <TabsTrigger value="grants">Access Grants</TabsTrigger>
                                            <TabsTrigger value="history">Grant History</TabsTrigger>
                                        </TabsList>
                                        <TabsContent value="grants" className="mt-4 space-y-6">
                                            {!canReadAccessGrants ? (
                                                <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-sm text-zinc-500">
                                                    Missing `owner_access_grants.read` permission.
                                                </div>
                                            ) : (
                                                <>
                                                <div className="grid gap-4 lg:grid-cols-2">
                                                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 lg:col-span-2">
                                                            <div className="flex items-start gap-3">
                                                                <div className="mt-1 rounded-lg bg-white p-2 text-emerald-600"><Mail className="h-4 w-4" /></div>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-sm font-semibold text-zinc-900">Grant owner access by email</p>
                                                                    <p className="mt-1 text-sm text-zinc-600">
                                                                        Primary flow. If the email already belongs to an active user, the backend links it immediately and returns an ACTIVE grant. If it is a new user, the backend sends onboarding email and returns PENDING until password setup completes.
                                                                    </p>
                                                                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                                                        <Input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="owner@example.com" />
                                                                        <Button onClick={() => { void handleInviteGrant(); }} disabled={!canWriteAccessGrants || inviteOwnerAccessGrant.isPending}>Grant Access</Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {!canWriteAccessGrants ? (
                                                        <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-3 text-sm text-zinc-500">
                                                            Missing `owner_access_grants.write` permission. Existing grants are read-only.
                                                        </div>
                                                    ) : null}

                                                    {accessGrantsError ? (
                                                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                                            {accessGrantsError instanceof Error ? accessGrantsError.message : "Failed to load owner access grants."}
                                                        </div>
                                                    ) : null}

                                                    {isAccessGrantsLoading ? (
                                                        <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-sm text-zinc-500">Loading owner access grants...</div>
                                                    ) : (accessGrants ?? []).length === 0 ? (
                                                        <div className="space-y-4">
                                                            <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-sm text-zinc-500">No access grants found for this owner. Use the email flow above to create the first one.</div>
                                                            {canWriteAccessGrants ? (
                                                                <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/70 p-4">
                                                                    <div className="flex items-start gap-3">
                                                                        <div className="mt-1 rounded-lg bg-white p-2 text-zinc-500"><Link2 className="h-4 w-4" /></div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <p className="text-sm font-semibold text-zinc-900">Fallback admin tools</p>
                                                                            <p className="mt-1 text-sm text-zinc-500">
                                                                                Manual link-existing-user remains available for support cases. Normal product flow should start from the email field above.
                                                                            </p>
                                                                            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                                                                <Input value={existingUserId} onChange={(event) => setExistingUserId(event.target.value)} placeholder="user_uuid" />
                                                                                <Button variant="outline" onClick={() => { void handleLinkExistingUser(); }} disabled={linkExistingOwnerUser.isPending}>Link User</Button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-4">
                                                            {(accessGrants ?? []).map((grant) => (
                                                                <div key={grant.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                                                                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                                                        <div className="min-w-0">
                                                                            <div className="flex flex-wrap items-center gap-2">
                                                                                <p className="text-sm font-semibold text-zinc-900">{getGrantHeadline(grant)}</p>
                                                                                <Badge variant="secondary" className={statusToneClassName(grant.status)}>{grant.status}</Badge>
                                                                            </div>
                                                                            <div className="mt-2 grid gap-2 text-xs text-zinc-500 sm:grid-cols-2">
                                                                                <div>Grant ID: {grant.id}</div>
                                                                                <div>User ID: {grant.userId ?? grant.linkedUser?.id ?? "Not linked"}</div>
                                                                                <div>Invite email: {grant.inviteEmail ?? "Not set"}</div>
                                                                                <div>Verification: {grant.verificationMethod ?? "Not set"}</div>
                                                                                <div>Invited: {formatDateTime(grant.invitedAt)}</div>
                                                                                <div>Accepted: {formatDateTime(grant.acceptedAt)}</div>
                                                                            </div>
                                                                            <p className="mt-3 text-sm text-zinc-600">{getGrantStatusSummary(grant)}</p>
                                                                        </div>

                                                                        {canWriteAccessGrants ? (
                                                                            <div className="w-full xl:max-w-md space-y-3">
                                                                                {String(grant.status).toUpperCase() === "PENDING" ? (
                                                                                    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/70 p-3">
                                                                                        <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                                                                                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                                                                            Fallback activation
                                                                                        </div>
                                                                                        <p className="mt-2 text-xs text-zinc-500">
                                                                                            Only use this if automatic onboarding cannot complete and support needs to attach a known user manually.
                                                                                        </p>
                                                                                        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_170px_auto]">
                                                                                            <Input
                                                                                                value={activateUserIds[grant.id] ?? grant.userId ?? grant.linkedUser?.id ?? ""}
                                                                                                onChange={(event) => setActivateUserIds((current) => ({ ...current, [grant.id]: event.target.value }))}
                                                                                                placeholder="user_uuid"
                                                                                            />
                                                                                            <Select value={activateMethods[grant.id] ?? "EMAIL_MATCH"} onValueChange={(value) => setActivateMethods((current) => ({ ...current, [grant.id]: value }))}>
                                                                                                <SelectTrigger><SelectValue placeholder="Method" /></SelectTrigger>
                                                                                                <SelectContent>
                                                                                                    {ACTIVATE_METHOD_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                                                                                                </SelectContent>
                                                                                            </Select>
                                                                                            <Button onClick={() => { void handleActivateGrant(grant.id); }} disabled={activateOwnerAccessGrant.isPending}>Activate</Button>
                                                                                        </div>
                                                                                    </div>
                                                                                ) : null}

                                                                                <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3">
                                                                                    <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                                                                                        <XCircle className="h-4 w-4 text-rose-600" />
                                                                                        Disable grant
                                                                                    </div>
                                                                                    <div className="mt-3 flex flex-col gap-2">
                                                                                        <Select value={disableMethods[grant.id] ?? "MANUAL_REVOKE"} onValueChange={(value) => setDisableMethods((current) => ({ ...current, [grant.id]: value }))}>
                                                                                            <SelectTrigger><SelectValue placeholder="Verification method" /></SelectTrigger>
                                                                                            <SelectContent>
                                                                                                {DISABLE_METHOD_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                                                                                            </SelectContent>
                                                                                        </Select>
                                                                                        <Button className="sm:self-start" variant="outline" onClick={() => { void handleDisableGrant(grant.id); }} disabled={disableOwnerAccessGrant.isPending}>Disable</Button>
                                                                                    </div>
                                                                                </div>

                                                                                {canWriteMessages && String(grant.status).toUpperCase() === "ACTIVE" && grant.userId ? (
                                                                                    <Button variant="outline" onClick={() => handleMessageOwner(grant)}>
                                                                                        <MessageCircle className="mr-2 h-4 w-4" />
                                                                                        Message owner
                                                                                    </Button>
                                                                                ) : null}

                                                                                {grant.inviteEmail && String(grant.status).toUpperCase() === "PENDING" ? (
                                                                                    <Button variant="ghost" onClick={() => { void handleResendInvite(grant.id); }} disabled={resendOwnerAccessGrantInvite.isPending}>
                                                                                        Resend onboarding email
                                                                                    </Button>
                                                                                ) : null}
                                                                            </div>
                                                                        ) : null}
                                                                    </div>
                                                                </div>
                                                            ))}

                                                            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/70 p-4">
                                                                <div className="flex items-start gap-3">
                                                                    <div className="mt-1 rounded-lg bg-white p-2 text-zinc-500"><Link2 className="h-4 w-4" /></div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-sm font-semibold text-zinc-900">Fallback admin tools</p>
                                                                        <p className="mt-1 text-sm text-zinc-500">
                                                                            Manual link-existing-user remains available for support cases. Normal product flow should start from the email field above.
                                                                        </p>
                                                                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                                                            <Input value={existingUserId} onChange={(event) => setExistingUserId(event.target.value)} placeholder="user_uuid" />
                                                                            <Button variant="outline" onClick={() => { void handleLinkExistingUser(); }} disabled={!canWriteAccessGrants || linkExistingOwnerUser.isPending}>Link User</Button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </TabsContent>

                                        <TabsContent value="history" className="mt-4">
                                            {!canReadAccessGrants ? (
                                                <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-sm text-zinc-500">Missing `owner_access_grants.read` permission.</div>
                                            ) : historyError ? (
                                                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                                    {historyError instanceof Error ? historyError.message : "Failed to load owner access grant history."}
                                                </div>
                                            ) : isHistoryLoading ? (
                                                <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-sm text-zinc-500">Loading access grant history...</div>
                                            ) : (accessGrantHistory ?? []).length === 0 ? (
                                                <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-sm text-zinc-500">No access grant history found for this owner.</div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {(accessGrantHistory ?? []).map((item) => (
                                                        <div key={item.id} className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
                                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">{item.action}</Badge>
                                                                    {item.fromStatus || item.toStatus ? (
                                                                        <span className="text-sm text-zinc-600">{[item.fromStatus, item.toStatus].filter(Boolean).join(" -> ")}</span>
                                                                    ) : null}
                                                                </div>
                                                                <div className="text-xs text-zinc-500">{formatDateTime(item.createdAt)}</div>
                                                            </div>
                                                            <div className="mt-3 grid gap-2 text-sm text-zinc-600 sm:grid-cols-2">
                                                                <div>Grant ID: {item.grantId ?? "Not available"}</div>
                                                                <div>Invite email: {item.inviteEmail ?? "Not set"}</div>
                                                                <div>Actor: {item.actorUser?.name ?? item.actorUser?.email ?? item.actorUserId ?? "System"}</div>
                                                                <div>Verification: {item.verificationMethod ?? "Not set"}</div>
                                                                <div>User ID: {item.userId ?? "Not set"}</div>
                                                                <div>Owner ID: {item.ownerId}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </TabsContent>
                                    </Tabs>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </SheetContent>
            </Sheet>
        </div>
    );
}
