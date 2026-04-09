"use client";

import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
    Building2,
    CheckCircle2,
    Fingerprint,
    Link2,
    Mail,
    MapPin,
    MessageCircle,
    Phone,
    Plus,
    Search,
    Settings2,
    ShieldAlert,
    UserRound,
    XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    useUpdateOwner,
} from "@/lib/queries";
import { portalPath } from "@/lib/portalPaths";
import { hasPermission as hasRbacPermission } from "@/lib/rbac";
import { isOrganizationAdminRole } from "@/lib/roles";
import type { CreateOwnerPayload, Owner, OwnerAccessGrant, ResolveOwnerPartyPayload, UpdateOwnerPayload } from "@/lib/types";

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

type OwnerEditFormState = {
    name: string;
    email: string;
    phone: string;
    address: string;
    isActive: boolean;
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

const initialOwnerEditFormState = (owner?: Owner | null): OwnerEditFormState => ({
    name: owner?.name ?? "",
    email: owner?.email ?? "",
    phone: owner?.phone ?? "",
    address: owner?.address ?? "",
    isActive: owner?.isActive ?? true,
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
    if (!owner?.identifier?.type) return "No legal ID";
    const identifierValue = owner.identifier.maskedValue ?? owner.identifier.value;
    if (!identifierValue) return `${formatEnumLabel(owner.identifier.type)} on file`;
    return `${formatEnumLabel(owner.identifier.type)}: ${identifierValue}`;
};

const getOwnerDisplayName = (owner?: Owner | null) =>
    owner?.name || owner?.party?.displayNameEn || owner?.displayNameEn || owner?.id || "Unknown owner";

const getOwnerSecondaryNames = (owner?: Owner | null) => {
    const values = [
        owner?.party?.displayNameAr ?? owner?.displayNameAr,
        (owner?.party?.displayNameEn ?? owner?.displayNameEn) && (owner?.party?.displayNameEn ?? owner?.displayNameEn) !== owner?.name
            ? (owner?.party?.displayNameEn ?? owner?.displayNameEn)
            : null,
    ]
        .filter(Boolean)
        .map((value) => String(value).trim())
        .filter(Boolean);
    return values.length > 0 ? values.join(" / ") : null;
};

const getOwnerRecordStatus = (owner?: Owner | null) => ({
    label: owner?.isActive === false ? "Inactive" : "Active",
    className: owner?.isActive === false ? "bg-zinc-100 text-zinc-700" : "bg-emerald-50 text-emerald-700",
});

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

function CreateOwnerSection({
    icon: Icon,
    title,
    description,
    children,
}: {
    icon: typeof UserRound;
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
    const [isEditOwnerOpen, setIsEditOwnerOpen] = useState(false);
    const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
    const [selectedOwnerFallback, setSelectedOwnerFallback] = useState<Owner | null>(null);
    const [grantAccessOwner, setGrantAccessOwner] = useState<Owner | null>(null);
    const [grantAccessEmail, setGrantAccessEmail] = useState("");
    const [grantAccessError, setGrantAccessError] = useState<string | null>(null);
    const [ownerForm, setOwnerForm] = useState<OwnerFormState>(initialOwnerFormState);
    const [ownerFormError, setOwnerFormError] = useState<string | null>(null);
    const [ownerEditForm, setOwnerEditForm] = useState<OwnerEditFormState>(initialOwnerEditFormState);
    const [ownerEditError, setOwnerEditError] = useState<string | null>(null);
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
    const updateOwner = useUpdateOwner();
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
                if (owner.identifier?.value || owner.identifier?.maskedValue || owner.identifier?.type) acc.withIdentifier += 1;
                return acc;
            },
            { total: 0, withEmail: 0, withPhone: 0, withIdentifier: 0 }
        );
    }, [owners]);

    const setOwnerField = (field: keyof OwnerFormState, value: string) => {
        setOwnerForm((current) => ({ ...current, [field]: value }));
    };

    const setOwnerEditField = (field: keyof OwnerEditFormState, value: string | boolean) => {
        setOwnerEditForm((current) => ({ ...current, [field]: value }));
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

    const openEditOwnerDialog = () => {
        if (!selectedOwner) return;
        setOwnerEditForm(initialOwnerEditFormState(selectedOwner));
        setOwnerEditError(null);
        setIsEditOwnerOpen(true);
    };

    const closeEditOwnerDialog = () => {
        setIsEditOwnerOpen(false);
        setOwnerEditError(null);
    };

    const handleUpdateOwner = async () => {
        if (!selectedOwner?.id) return;
        const name = ownerEditForm.name.trim();
        if (!name) {
            setOwnerEditError("Owner name is required.");
            return;
        }

        const payload: UpdateOwnerPayload = {
            name,
            email: ownerEditForm.email.trim() || null,
            phone: ownerEditForm.phone.trim() || null,
            address: ownerEditForm.address.trim() || null,
            isActive: ownerEditForm.isActive,
        };

        try {
            setOwnerEditError(null);
            const updated = await updateOwner.mutateAsync({
                ownerId: selectedOwner.id,
                data: payload,
            });
            setSelectedOwnerFallback(updated);
            setIsEditOwnerOpen(false);
            toast.success("Owner updated");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to update owner";
            setOwnerEditError(message);
            toast.error(message);
        }
    };

    const handleUseExistingOwnerIdentity = (owner: Owner) => {
        setSelectedOwnerId(owner.id);
        setSelectedOwnerFallback(owner);
        setIsCreateOpen(false);
        toast.success("Existing owner identity opened");
    };

    const openGrantAccessDialog = (owner: Owner) => {
        setGrantAccessOwner(owner);
        setGrantAccessEmail(owner.email ?? "");
        setGrantAccessError(null);
    };

    const closeGrantAccessDialog = () => {
        setGrantAccessOwner(null);
        setGrantAccessEmail("");
        setGrantAccessError(null);
    };

    const handleInviteGrant = async () => {
        if (!grantAccessOwner?.id) return;
        const email = grantAccessEmail.trim();
        if (!email) {
            setGrantAccessError("Owner email is required.");
            return;
        }
        try {
            setGrantAccessError(null);
            const result = await inviteOwnerAccessGrant.mutateAsync({ ownerId: grantAccessOwner.id, email });
            const normalizedStatus = String(result.grant?.status ?? "").trim().toUpperCase();
            toast.success(
                normalizedStatus === "ACTIVE"
                    ? "Access granted."
                    : normalizedStatus === "PENDING"
                        ? "Invite sent."
                        : "Access updated."
            );
            closeGrantAccessDialog();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to grant owner access";
            setGrantAccessError(message);
            if (!/active representative|conflict|409/i.test(message)) {
                toast.error(message);
            }
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

    const ownerRows = owners ?? [];
    const renderOwnerActions = (owner: Owner) => (
        <div className="flex flex-wrap items-center justify-end gap-2">
            {canWriteAccessGrants ? (
                <Button
                    variant="outline"
                    size="sm"
                    className="border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                    onClick={() => openGrantAccessDialog(owner)}
                >
                    Grant Access
                </Button>
            ) : null}
            <Button
                size="sm"
                className="bg-zinc-900 text-white hover:bg-zinc-800"
                onClick={() => {
                    setSelectedOwnerId(owner.id);
                    setSelectedOwnerFallback(owner);
                }}
            >
                Open
            </Button>
        </div>
    );

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
                                Owners
                            </h1>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                                Manage the org-scoped owner registry. Owner access is usually granted by email, while manual link and activate actions stay available as fallback admin tools.
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
                                            Registry Scope
                                        </div>
                                        <div className="mt-2 text-sm font-medium text-zinc-950">Organization-wide</div>
                                        <div className="mt-1 text-xs text-zinc-500">Owner profiles are managed at org level.</div>
                                    </div>
                                </div>
                            </div>
                            {canWriteOwners ? (
                                <div className="flex flex-wrap items-center gap-3">
                                    <Button className="h-11 rounded-xl bg-zinc-950 px-5 text-white hover:bg-zinc-800" onClick={() => setIsCreateOpen(true)}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Owner
                                    </Button>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    { label: "Total owners", value: stats.total, tone: "bg-blue-50 text-blue-700", icon: <UserRound className="h-5 w-5" /> },
                    { label: "With email", value: stats.withEmail, tone: "bg-emerald-50 text-emerald-700", icon: <Mail className="h-5 w-5" /> },
                    { label: "With phone", value: stats.withPhone, tone: "bg-amber-50 text-amber-700", icon: <Phone className="h-5 w-5" /> },
                    { label: "With identifier", value: stats.withIdentifier, tone: "bg-zinc-100 text-zinc-700", icon: <Fingerprint className="h-5 w-5" /> },
                ].map((stat) => (
                    <div key={stat.label} className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${stat.tone}`}>
                            {stat.icon}
                        </div>
                        <div className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-zinc-950">{stat.value}</div>
                        <p className="mt-1 text-sm text-zinc-500">{stat.label}</p>
                    </div>
                ))}
            </section>

            <section className="rounded-[30px] border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="space-y-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <h2 className="text-xl font-semibold tracking-[-0.02em] text-zinc-950">Owner Directory</h2>
                            <p className="mt-1 text-sm text-zinc-500">Search by owner name, email, phone, or address.</p>
                        </div>
                        <div className="relative w-full lg:w-80">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search owners" className="h-11 rounded-xl border-zinc-200 bg-white pl-9" />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <div className="min-w-[240px] flex-1">
                            <FilterField label="Directory Scope">
                                <div className="text-sm text-zinc-700">Organization owner registry</div>
                            </FilterField>
                        </div>
                        <div className="min-w-[240px] flex-1">
                            <FilterField label="Search Coverage">
                                <div className="text-sm text-zinc-700">Name, email, phone, and address</div>
                            </FilterField>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                        <span className="text-zinc-400">Summary</span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-700">
                            Registry
                            <span className="font-medium text-zinc-900">Organization</span>
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-700">
                            With email
                            <span className="font-medium text-zinc-900">{stats.withEmail}</span>
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-700">
                            With identifier
                            <span className="font-medium text-zinc-900">{stats.withIdentifier}</span>
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-900 bg-zinc-950 px-3 py-1.5 font-medium text-white">
                            Showing
                            <span>{ownerRows.length} owner{ownerRows.length === 1 ? "" : "s"}</span>
                        </span>
                    </div>

                {ownersError ? (
                    <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {ownersError instanceof Error ? ownersError.message : "Failed to load owners."}
                    </div>
                ) : null}

                    <div className="mt-6">
                        {isOwnersLoading ? (
                            <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-12 text-center text-sm text-zinc-500">
                                Loading owners...
                            </div>
                        ) : ownerRows.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-12 text-center text-sm text-zinc-500">
                                No owners found.
                            </div>
                        ) : (
                            <>
                                <div className="hidden lg:block">
                                    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/40">
                                        <Table className="bg-white">
                                            <TableHeader>
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Owner</TableHead>
                                                    <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Contact</TableHead>
                                                    <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Address</TableHead>
                                                    <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {ownerRows.map((owner) => {
                                                    const status = getOwnerRecordStatus(owner);
                                                    const secondaryNames = getOwnerSecondaryNames(owner);
                                                    return (
                                                        <TableRow key={owner.id} className="border-zinc-200/80 bg-white hover:bg-zinc-50/80">
                                                            <TableCell className="px-4 py-4 align-top whitespace-normal">
                                                                <div className="space-y-3">
                                                                    <div className="space-y-1.5">
                                                                        <div className="font-semibold text-zinc-950">{getOwnerDisplayName(owner)}</div>
                                                                        {secondaryNames ? (
                                                                            <div className="text-xs text-zinc-500">{secondaryNames}</div>
                                                                        ) : null}
                                                                    </div>
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <Badge className="bg-zinc-100 text-zinc-700">{formatPartyTypeLabel(owner.party?.type ?? owner.partyType)}</Badge>
                                                                        <Badge className={status.className}>{status.label}</Badge>
                                                                    </div>
                                                                    <div className="text-xs text-zinc-500">{formatOwnerIdentifier(owner)}</div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="px-4 py-4 align-top whitespace-normal">
                                                                <div className="space-y-2 text-sm">
                                                                    <div className="flex items-start gap-2 text-zinc-700">
                                                                        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                                                                        <span className={owner.email ? "break-all" : "text-zinc-400"}>{owner.email || "No email"}</span>
                                                                    </div>
                                                                    <div className="flex items-start gap-2 text-zinc-700">
                                                                        <Phone className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                                                                        <span className={owner.phone ? "break-all" : "text-zinc-400"}>{owner.phone || "No phone"}</span>
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="px-4 py-4 align-top whitespace-normal">
                                                                <div className="flex items-start gap-2 text-sm text-zinc-700">
                                                                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                                                                    <span className={owner.address ? "line-clamp-2" : "text-zinc-400"}>{owner.address || "No address"}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="px-4 py-4 text-right align-top whitespace-normal">
                                                                {renderOwnerActions(owner)}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>

                                <div className="space-y-3 lg:hidden">
                                    {ownerRows.map((owner) => {
                                        const status = getOwnerRecordStatus(owner);
                                        const secondaryNames = getOwnerSecondaryNames(owner);
                                        return (
                                            <div key={owner.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-100/60">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="truncate text-base font-semibold text-zinc-950">{getOwnerDisplayName(owner)}</div>
                                                        {secondaryNames ? (
                                                            <div className="mt-1 text-xs text-zinc-500">{secondaryNames}</div>
                                                        ) : null}
                                                    </div>
                                                    <Badge className={status.className}>{status.label}</Badge>
                                                </div>

                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <Badge className="bg-zinc-100 text-zinc-700">{formatPartyTypeLabel(owner.party?.type ?? owner.partyType)}</Badge>
                                                </div>

                                                <div className="mt-4 space-y-3">
                                                    <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-2">
                                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Identifier</div>
                                                        <div className="mt-1 text-sm text-zinc-700">{formatOwnerIdentifier(owner)}</div>
                                                    </div>
                                                    <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-3 text-sm">
                                                        <div className="flex items-start gap-2 text-zinc-700">
                                                            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                                                            <span className={owner.email ? "break-all" : "text-zinc-400"}>{owner.email || "No email"}</span>
                                                        </div>
                                                        <div className="flex items-start gap-2 text-zinc-700">
                                                            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                                                            <span className={owner.phone ? "break-all" : "text-zinc-400"}>{owner.phone || "No phone"}</span>
                                                        </div>
                                                        <div className="flex items-start gap-2 text-zinc-700">
                                                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                                                            <span className={owner.address ? "line-clamp-2" : "text-zinc-400"}>{owner.address || "No address"}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                                                    {renderOwnerActions(owner)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </section>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="w-[98vw] max-w-[98vw] sm:max-w-[1400px] overflow-hidden p-0">
                    <DialogHeader className="border-b border-zinc-200 px-6 py-5 text-left">
                        <DialogTitle>Create Owner</DialogTitle>
                        <DialogDescription>
                            Start with the owner&apos;s basic details. If you have a strong legal identifier, you can check for an existing owner identity first.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex max-h-[85vh] flex-col">
                        <div className="flex-1 overflow-x-hidden overflow-y-auto bg-zinc-50/40 p-6">
                            <div className="space-y-6">
                                <div className="rounded-3xl border border-zinc-200 bg-white p-5">
                                    <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
                                        <Plus className="h-3.5 w-3.5 text-zinc-500" />
                                        Owner registry
                                    </div>
                                    <h2 className="mt-4 text-xl font-semibold tracking-tight text-zinc-950">Add an owner profile</h2>
                                    <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                                        Capture core contact details first, then add identity data and org-specific overrides only when they are actually available.
                                    </p>
                                </div>

                        <CreateOwnerSection
                            icon={UserRound}
                            title="Basic details"
                            description="This matches the primary create flow: name first, then optional contact information."
                        >
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
                            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-500">
                                Required: owner name. Email, phone, and owner type refinement can be added later.
                            </div>
                        </CreateOwnerSection>

                        <CreateOwnerSection
                            icon={Fingerprint}
                            title="Identity check"
                            description="Use a legal identifier to check whether this owner already exists before creating a duplicate profile."
                        >
                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-zinc-900">Check existing owner identity</p>
                                        <p className="mt-1 text-sm text-zinc-500">
                                            Supported identifiers include Emirates ID, passport, trade license, and similar legal records.
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
                            </div>

                            <div className="mt-5 grid gap-4 lg:grid-cols-2">
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
                                {ownerForm.resolutionToken ? (
                                    <div className="lg:col-span-2">
                                        <label className="mb-1 block text-xs text-zinc-500">Resolved identity token</label>
                                        <Input value={ownerForm.resolutionToken} readOnly className="font-mono text-xs" />
                                        <p className="mt-1 text-xs text-zinc-500">
                                            Captured automatically after identity check and sent only when a resolved match/token exists.
                                        </p>
                                    </div>
                                ) : null}
                            </div>

                            {resolveOwnerParty.data ? (
                                <div className={`mt-5 rounded-2xl border px-4 py-4 text-sm ${resolveOwnerParty.data.matchedOwner ? "border-emerald-200 bg-emerald-50/70" : "border-zinc-200 bg-zinc-50"}`}>
                                    <p className="font-semibold text-zinc-900">
                                        {resolveOwnerParty.data.matchedOwner ? "Matching owner identity found" : "No existing owner identity found"}
                                    </p>
                                    <p className="mt-1 text-zinc-600">
                                        {resolveOwnerParty.data.matchedOwner
                                            ? `${resolveOwnerParty.data.matchedOwner.name || resolveOwnerParty.data.matchedOwner.party?.displayNameEn || resolveOwnerParty.data.matchedOwner.displayNameEn || resolveOwnerParty.data.matchedOwner.id} | ${formatOwnerIdentifier(resolveOwnerParty.data.matchedOwner)}`
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
                        </CreateOwnerSection>

                        <CreateOwnerSection
                            icon={Mail}
                            title="Profile details"
                            description="Add public-facing names, address details, and internal notes when they are needed."
                        >
                            <div className="grid gap-4 lg:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-xs text-zinc-500">Display name (EN)</label>
                                    <Input value={ownerForm.displayNameEn} onChange={(event) => setOwnerField("displayNameEn", event.target.value)} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs text-zinc-500">Arabic name</label>
                                    <Input value={ownerForm.displayNameAr} onChange={(event) => setOwnerField("displayNameAr", event.target.value)} />
                                </div>
                                <div className="lg:col-span-2">
                                    <label className="mb-1 block text-xs text-zinc-500">Address</label>
                                    <Textarea value={ownerForm.address} onChange={(event) => setOwnerField("address", event.target.value)} />
                                </div>
                                <div className="lg:col-span-2">
                                    <label className="mb-1 block text-xs text-zinc-500">Notes</label>
                                    <Textarea value={ownerForm.notes} onChange={(event) => setOwnerField("notes", event.target.value)} />
                                </div>
                            </div>
                        </CreateOwnerSection>

                        <CreateOwnerSection
                            icon={Settings2}
                            title="Org-specific overrides"
                            description="Only use overrides when this organization needs labels or contact details different from the legal owner record."
                        >
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
                        </CreateOwnerSection>

                        {ownerFormError ? (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                {ownerFormError}
                            </div>
                        ) : null}
                            </div>
                        </div>

                        <div className="border-t border-zinc-200 bg-white px-6 py-4">
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
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(grantAccessOwner)} onOpenChange={(open) => {
                if (!open) closeGrantAccessDialog();
            }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Grant Owner Access</DialogTitle>
                        <DialogDescription>
                            {grantAccessOwner
                                ? `Use ${grantAccessOwner.name || "this owner"}'s email to create or refresh an owner access grant.`
                                : "Create an owner access grant by email."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                            Existing active user: grant becomes <span className="font-semibold text-zinc-900">ACTIVE</span>.
                            <br />
                            New user: grant becomes <span className="font-semibold text-zinc-900">PENDING</span> and onboarding email is sent.
                        </div>
                        <div className="space-y-2">
                            <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">Owner email</label>
                            <Input
                                type="email"
                                value={grantAccessEmail}
                                onChange={(event) => {
                                    setGrantAccessEmail(event.target.value);
                                    if (grantAccessError) setGrantAccessError(null);
                                }}
                                placeholder="owner@example.com"
                            />
                            <p className="text-xs text-zinc-500">
                                Prefilled from the owner profile when available. Editing this value will not change the saved owner record.
                            </p>
                        </div>
                        {grantAccessError ? (
                            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                                {grantAccessError}
                            </div>
                        ) : null}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeGrantAccessDialog}>Cancel</Button>
                        <Button
                            onClick={() => {
                                void handleInviteGrant();
                            }}
                            disabled={!canWriteAccessGrants || inviteOwnerAccessGrant.isPending}
                        >
                            {inviteOwnerAccessGrant.isPending ? "Granting..." : "Grant Access"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditOwnerOpen} onOpenChange={(open) => {
                if (!open) closeEditOwnerDialog();
            }}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Edit Owner Profile</DialogTitle>
                        <DialogDescription>
                            Update org-local owner fields only. Party identity and access grants stay unchanged.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Owner name</label>
                                <Input
                                    value={ownerEditForm.name}
                                    onChange={(event) => setOwnerEditField("name", event.target.value)}
                                    placeholder="Jane Owner"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Email</label>
                                <Input
                                    type="email"
                                    value={ownerEditForm.email}
                                    onChange={(event) => setOwnerEditField("email", event.target.value)}
                                    placeholder="owner@example.com"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Phone</label>
                                <Input
                                    value={ownerEditForm.phone}
                                    onChange={(event) => setOwnerEditField("phone", event.target.value)}
                                    placeholder="+971..."
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Address</label>
                                <Textarea
                                    value={ownerEditForm.address}
                                    onChange={(event) => setOwnerEditField("address", event.target.value)}
                                    placeholder="Building, street, city"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                            <Checkbox
                                id="owner-is-active"
                                checked={ownerEditForm.isActive}
                                onCheckedChange={(checked) => setOwnerEditField("isActive", checked === true)}
                            />
                            <div>
                                <label htmlFor="owner-is-active" className="text-sm font-medium text-zinc-900">Owner is active</label>
                                <p className="text-xs text-zinc-500">Controls the organization-local active state for this owner record.</p>
                            </div>
                        </div>

                        {ownerEditError ? (
                            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                                {ownerEditError}
                            </div>
                        ) : null}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeEditOwnerDialog}>Cancel</Button>
                        <Button onClick={() => { void handleUpdateOwner(); }} disabled={!canWriteOwners || updateOwner.isPending}>
                            {updateOwner.isPending ? "Saving..." : "Save changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(selectedOwner)}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedOwnerId(null);
                        setSelectedOwnerFallback(null);
                    }
                }}
            >
                <DialogContent className="w-[98vw] max-w-[98vw] sm:max-w-[1400px] overflow-hidden p-0">
                    <DialogHeader className="border-b border-zinc-200 px-6 py-5 text-left">
                        <DialogTitle>{selectedOwner?.name ?? "Owner details"}</DialogTitle>
                        <DialogDescription>
                            Review owner details and manage access grants separately from the owner record itself.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedOwner ? (
                        <div className="max-h-[85vh] overflow-x-hidden overflow-y-auto p-6">
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                                <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
                                    <p className="text-xs uppercase tracking-wide text-zinc-400">Party</p>
                                    <p className="mt-2 text-sm font-semibold text-zinc-900">{formatPartyTypeLabel(selectedOwner.party?.type ?? selectedOwner.partyType)}</p>
                                </div>
                                <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
                                    <p className="text-xs uppercase tracking-wide text-zinc-400">Status</p>
                                    <p className="mt-2 text-sm font-semibold text-zinc-900">{selectedOwner.isActive === false ? "Inactive" : "Active"}</p>
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
                                    <div className="flex items-start justify-between gap-3">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Owner Details</p>
                                        {canWriteOwners ? (
                                            <Button variant="outline" size="sm" onClick={openEditOwnerDialog}>
                                                Edit profile
                                            </Button>
                                        ) : null}
                                    </div>
                                    <div className="space-y-3 text-sm text-zinc-700">
                                        <div>
                                            <div className="text-xs text-zinc-400">Org-local owner name</div>
                                            <div className="mt-1">{selectedOwner.name || "Not set"}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-zinc-400">Display names</div>
                                            <div className="mt-1">{[selectedOwner.party?.displayNameEn ?? selectedOwner.displayNameEn, selectedOwner.party?.displayNameAr ?? selectedOwner.displayNameAr].filter(Boolean).join(" / ") || "Not set"}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-zinc-400">Address</div>
                                            <div className="mt-1">{selectedOwner.address ?? "Not set"}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-zinc-400">Updated</div>
                                            <div className="mt-1">{formatDateTime(selectedOwner.updatedAt)}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-zinc-400">Created</div>
                                            <div className="mt-1">{formatDateTime(selectedOwner.createdAt)}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                                    <Tabs defaultValue="access">
                                        <TabsList>
                                            <TabsTrigger value="access">Grant Access</TabsTrigger>
                                            <TabsTrigger value="existing">Existing Grants</TabsTrigger>
                                            <TabsTrigger value="history">Grant History</TabsTrigger>
                                        </TabsList>
                                        <TabsContent value="access" className="mt-4 space-y-6">
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
                                                                        Use the owner&apos;s saved email as the default, or adjust it before sending. Existing active users grant immediately, while new users receive onboarding and stay pending until password setup completes.
                                                                    </p>
                                                                    <div className="mt-3 flex flex-wrap items-center gap-3">
                                                                        <div className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs text-zinc-600">
                                                                            Default email: {selectedOwner.email ?? "No saved owner email"}
                                                                        </div>
                                                                        <Button
                                                                            onClick={() => openGrantAccessDialog(selectedOwner)}
                                                                            disabled={!canWriteAccessGrants}
                                                                        >
                                                                            Grant Access
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {!canWriteAccessGrants ? (
                                                        <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-3 text-sm text-zinc-500">
                                                            Missing `owner_access_grants.write` permission. Grant creation is unavailable.
                                                        </div>
                                                    ) : null}
                                                </>
                                            )}
                                        </TabsContent>

                                        <TabsContent value="existing" className="mt-4 space-y-6">
                                            {!canReadAccessGrants ? (
                                                <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-sm text-zinc-500">
                                                    Missing `owner_access_grants.read` permission.
                                                </div>
                                            ) : (
                                                <>
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
                                                                    <div className="space-y-4">
                                                                        <div className="min-w-0 space-y-3">
                                                                            <div className="flex flex-wrap items-center gap-2">
                                                                                <p className="text-sm font-semibold text-zinc-900">{getGrantHeadline(grant)}</p>
                                                                                <Badge variant="secondary" className={statusToneClassName(grant.status)}>{grant.status}</Badge>
                                                                            </div>
                                                                            <div className="grid gap-3 text-xs text-zinc-500 lg:grid-cols-2">
                                                                                <div className="space-y-1">
                                                                                    <div className="font-medium uppercase tracking-wide text-zinc-400">Grant ID</div>
                                                                                    <div className="break-all text-zinc-600">{grant.id}</div>
                                                                                </div>
                                                                                <div className="space-y-1">
                                                                                    <div className="font-medium uppercase tracking-wide text-zinc-400">User ID</div>
                                                                                    <div className="break-all text-zinc-600">{grant.userId ?? grant.linkedUser?.id ?? "Not linked"}</div>
                                                                                </div>
                                                                                <div className="space-y-1">
                                                                                    <div className="font-medium uppercase tracking-wide text-zinc-400">Invite email</div>
                                                                                    <div className="break-all text-zinc-600">{grant.inviteEmail ?? "Not set"}</div>
                                                                                </div>
                                                                                <div className="space-y-1">
                                                                                    <div className="font-medium uppercase tracking-wide text-zinc-400">Verification</div>
                                                                                    <div className="text-zinc-600">{grant.verificationMethod ?? "Not set"}</div>
                                                                                </div>
                                                                                <div className="space-y-1">
                                                                                    <div className="font-medium uppercase tracking-wide text-zinc-400">Invited</div>
                                                                                    <div className="text-zinc-600">{formatDateTime(grant.invitedAt)}</div>
                                                                                </div>
                                                                                <div className="space-y-1">
                                                                                    <div className="font-medium uppercase tracking-wide text-zinc-400">Accepted</div>
                                                                                    <div className="text-zinc-600">{formatDateTime(grant.acceptedAt)}</div>
                                                                                </div>
                                                                            </div>
                                                                            <p className="text-sm text-zinc-600">{getGrantStatusSummary(grant)}</p>
                                                                        </div>

                                                                        {canWriteAccessGrants ? (
                                                                            <div className="space-y-3 border-t border-zinc-200 pt-4">
                                                                                {String(grant.status).toUpperCase() === "PENDING" ? (
                                                                                    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/70 p-3">
                                                                                        <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                                                                                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                                                                            Fallback activation
                                                                                        </div>
                                                                                        <p className="mt-2 text-xs text-zinc-500">
                                                                                            Only use this if automatic onboarding cannot complete and support needs to attach a known user manually.
                                                                                        </p>
                                                                                        <div className="mt-3 flex flex-col gap-2 xl:flex-row xl:items-center">
                                                                                            <Input
                                                                                                value={activateUserIds[grant.id] ?? grant.userId ?? grant.linkedUser?.id ?? ""}
                                                                                                onChange={(event) => setActivateUserIds((current) => ({ ...current, [grant.id]: event.target.value }))}
                                                                                                placeholder="user_uuid"
                                                                                                className="xl:flex-1"
                                                                                            />
                                                                                            <Select value={activateMethods[grant.id] ?? "EMAIL_MATCH"} onValueChange={(value) => setActivateMethods((current) => ({ ...current, [grant.id]: value }))}>
                                                                                                <SelectTrigger><SelectValue placeholder="Method" /></SelectTrigger>
                                                                                                <SelectContent>
                                                                                                    {ACTIVATE_METHOD_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                                                                                                </SelectContent>
                                                                                            </Select>
                                                                                            <Button className="xl:shrink-0" onClick={() => { void handleActivateGrant(grant.id); }} disabled={activateOwnerAccessGrant.isPending}>Activate</Button>
                                                                                        </div>
                                                                                    </div>
                                                                                ) : null}

                                                                                <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3">
                                                                                    <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                                                                                        <XCircle className="h-4 w-4 text-rose-600" />
                                                                                        Disable grant
                                                                                    </div>
                                                                                    <div className="mt-3 flex flex-col gap-2 xl:flex-row xl:items-center">
                                                                                        <Select value={disableMethods[grant.id] ?? "MANUAL_REVOKE"} onValueChange={(value) => setDisableMethods((current) => ({ ...current, [grant.id]: value }))}>
                                                                                            <SelectTrigger><SelectValue placeholder="Verification method" /></SelectTrigger>
                                                                                            <SelectContent>
                                                                                                {DISABLE_METHOD_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                                                                                            </SelectContent>
                                                                                        </Select>
                                                                                        <Button className="xl:shrink-0" variant="outline" onClick={() => { void handleDisableGrant(grant.id); }} disabled={disableOwnerAccessGrant.isPending}>Disable</Button>
                                                                                    </div>
                                                                                </div>

                                                                                {canWriteMessages && String(grant.status).toUpperCase() === "ACTIVE" && grant.userId ? (
                                                                                    <Button variant="outline" className="w-full sm:w-auto" onClick={() => handleMessageOwner(grant)}>
                                                                                        <MessageCircle className="mr-2 h-4 w-4" />
                                                                                        Message owner
                                                                                    </Button>
                                                                                ) : null}

                                                                                {grant.inviteEmail && String(grant.status).toUpperCase() === "PENDING" ? (
                                                                                    <Button variant="ghost" className="w-full justify-start text-left" onClick={() => { void handleResendInvite(grant.id); }} disabled={resendOwnerAccessGrantInvite.isPending}>
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
                </DialogContent>
            </Dialog>
        </div>
    );
}
