import type {
    CreateOwnerPayload,
    Owner,
    OwnerAccessGrant,
    OwnerAccessGrantHistoryItem,
    OwnerIdentifier,
    OwnerOverrides,
    OwnerPartyResolution,
    ResolveOwnerPartyPayload,
} from "../types";
import { fetchJson } from "./client";
import { delay, USE_MOCK } from "./config";
import { getArray } from "./shared";

type ApiErrorWithStatus = Error & { status?: number };

const asString = (value: unknown) => {
    if (value === undefined || value === null) return undefined;
    const normalized = String(value).trim();
    return normalized ? normalized : undefined;
};

const asNullableString = (value: unknown) => {
    if (value === null) return null;
    return asString(value);
};

const remapOwnerError = (
    error: unknown,
    options: { forbidden: string; notFound: string }
): never => {
    const status = (error as ApiErrorWithStatus)?.status;
    if (status === 403 || status === 404) {
        const remapped = new Error(status === 403 ? options.forbidden : options.notFound) as ApiErrorWithStatus;
        remapped.status = status;
        throw remapped;
    }
    throw error;
};

const mapOwnerIdentifier = (value: any): OwnerIdentifier | null => {
    if (!value || typeof value !== "object") return null;
    const type = asString(value.type ?? value.identifierType ?? value.idType);
    const identifierValue = asString(value.value ?? value.identifierValue ?? value.number ?? value.idNumber);
    if (!type || !identifierValue) return null;
    return {
        type,
        value: identifierValue,
        countryCode: asNullableString(value.countryCode ?? value.country),
        issuingAuthority: asNullableString(value.issuingAuthority ?? value.authority),
    };
};

const mapOwnerOverrides = (value: any): OwnerOverrides | null => {
    if (!value || typeof value !== "object") return null;
    const displayNameOverride = asNullableString(value.displayNameOverride);
    const contactEmailOverride = asNullableString(value.contactEmailOverride);
    const contactPhoneOverride = asNullableString(value.contactPhoneOverride);
    const notes = asNullableString(value.notes);
    if (!displayNameOverride && !contactEmailOverride && !contactPhoneOverride && !notes) return null;
    return {
        displayNameOverride,
        contactEmailOverride,
        contactPhoneOverride,
        notes,
    };
};

const mapOwner = (value: any): Owner => ({
    id: String(value?.id ?? value?.ownerId ?? ""),
    orgId: asNullableString(value?.orgId),
    name: value?.name ?? value?.fullName ?? value?.ownerName ?? value?.displayNameEn ?? "",
    partyType: asString(value?.partyType ?? value?.type),
    displayNameEn: asNullableString(value?.displayNameEn),
    displayNameAr: asNullableString(value?.displayNameAr),
    email: asString(value?.email ?? value?.contactEmail),
    phone: asString(value?.phone ?? value?.phoneNumber ?? value?.contactPhone),
    address: asString(value?.address),
    identifier: mapOwnerIdentifier(value?.identifier),
    ownerOverrides: mapOwnerOverrides(value?.ownerOverrides ?? value?.overrides),
    resolutionToken: asNullableString(value?.resolutionToken),
    createdAt: asString(value?.createdAt),
    updatedAt: asString(value?.updatedAt),
});

const mapOwnerAccessGrant = (value: any): OwnerAccessGrant => ({
    id: String(value?.id ?? value?.grantId ?? ""),
    userId: asNullableString(value?.userId),
    ownerId: String(value?.ownerId ?? ""),
    status: String(value?.status ?? "UNKNOWN"),
    inviteEmail: asNullableString(value?.inviteEmail ?? value?.email),
    invitedAt: asNullableString(value?.invitedAt),
    acceptedAt: asNullableString(value?.acceptedAt),
    grantedByUserId: asNullableString(value?.grantedByUserId),
    disabledAt: asNullableString(value?.disabledAt),
    disabledByUserId: asNullableString(value?.disabledByUserId),
    verificationMethod: asNullableString(value?.verificationMethod),
    linkedUser: value?.linkedUser
        ? {
            id: String(value.linkedUser.id ?? value.linkedUser.userId ?? ""),
            email: asString(value.linkedUser.email),
            orgId: asNullableString(value.linkedUser.orgId),
            isActive: typeof value.linkedUser.isActive === "boolean" ? value.linkedUser.isActive : undefined,
            name: asString(value.linkedUser.name ?? value.linkedUser.fullName),
        }
        : null,
    createdAt: asString(value?.createdAt),
    updatedAt: asString(value?.updatedAt),
});

const mapOwnerAccessGrantHistoryItem = (value: any): OwnerAccessGrantHistoryItem => ({
    id: String(value?.id ?? value?.auditId ?? ""),
    grantId: asNullableString(value?.grantId),
    ownerId: String(value?.ownerId ?? ""),
    action: String(value?.action ?? "UNKNOWN"),
    fromStatus: asNullableString(value?.fromStatus),
    toStatus: asNullableString(value?.toStatus),
    actorUserId: asNullableString(value?.actorUserId),
    userId: asNullableString(value?.userId),
    inviteEmail: asNullableString(value?.inviteEmail),
    verificationMethod: asNullableString(value?.verificationMethod),
    actorUser: value?.actorUser
        ? {
            id: String(value.actorUser.id ?? value.actorUser.userId ?? ""),
            email: asString(value.actorUser.email),
            name: asString(value.actorUser.name ?? value.actorUser.fullName),
        }
        : null,
    createdAt: asString(value?.createdAt),
});

const trimPayload = <T extends Record<string, unknown>>(payload: T) =>
    Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== undefined)
    );

const mapOwnerMutationResult = (value: any) => {
    const payload = value?.data ?? value ?? {};
    const grantSource = payload?.grant ?? payload?.accessGrant ?? payload;
    if (grantSource?.id || grantSource?.grantId) {
        return { success: true, grant: mapOwnerAccessGrant(grantSource) };
    }
    return { success: Boolean(payload?.success ?? true) };
};

export async function getOwners(search?: string): Promise<Owner[]> {
    if (!USE_MOCK) {
        try {
            const query = search ? `?search=${encodeURIComponent(search)}` : "";
            const res = await fetchJson(`/org/owners${query}`);
            return getArray(res).map(mapOwner).filter((owner) => owner.id);
        } catch (error) {
            remapOwnerError(error, {
                forbidden: "You do not have permission to view owners.",
                notFound: "Owner records were not found for this organization.",
            });
        }
    }
    await delay(800);
    return [];
}

export async function createOwner(payload: CreateOwnerPayload): Promise<Owner> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson("/org/owners", {
                method: "POST",
                body: JSON.stringify(trimPayload({
                    name: payload.name,
                    partyType: payload.partyType,
                    displayNameEn: payload.displayNameEn ?? undefined,
                    displayNameAr: payload.displayNameAr ?? undefined,
                    email: payload.email ?? undefined,
                    phone: payload.phone ?? undefined,
                    address: payload.address ?? undefined,
                    resolutionToken: payload.resolutionToken ?? undefined,
                    identifier: payload.identifier ?? undefined,
                    ownerOverrides: payload.ownerOverrides ?? undefined,
                })),
            });
            const body = res?.data ?? res ?? {};
            return mapOwner(body?.owner ?? body);
        } catch (error) {
            remapOwnerError(error, {
                forbidden: "You do not have permission to create owners.",
                notFound: "Owner could not be created in this organization.",
            });
        }
    }
    await delay(800);
    return mapOwner({ id: String(Date.now()), ...payload });
}

export async function resolveOwnerParty(payload: ResolveOwnerPartyPayload): Promise<OwnerPartyResolution> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson("/org/owners/resolve-party", {
                method: "POST",
                body: JSON.stringify(trimPayload({
                    identifierType: payload.identifierType,
                    identifierValue: payload.identifierValue,
                    countryCode: payload.countryCode ?? undefined,
                    issuingAuthority: payload.issuingAuthority ?? undefined,
                })),
            });
            const body = res?.data ?? res ?? {};
            const matchedOwnerSource = body?.matchedOwner ?? body?.owner ?? body?.match ?? null;
            const resolutionToken = asString(body?.resolutionToken ?? body?.token ?? body?.id) ?? "";
            return {
                resolutionToken,
                status: asString(body?.status ?? body?.matchStatus),
                message: asString(body?.message ?? body?.summary),
                matchedOwner: matchedOwnerSource ? mapOwner(matchedOwnerSource) : null,
            };
        } catch (error) {
            remapOwnerError(error, {
                forbidden: "You do not have permission to resolve owner parties.",
                notFound: "Party resolution is unavailable for this owner in the current organization.",
            });
        }
    }
    await delay(800);
    return {
        resolutionToken: `resolution-${Date.now()}`,
        status: "UNVERIFIED",
        message: "Mock party resolution",
        matchedOwner: null,
    };
}

export async function getOwnerAccessGrants(ownerId: string): Promise<OwnerAccessGrant[]> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson(`/org/owners/${ownerId}/access-grants`);
            return getArray(res).map(mapOwnerAccessGrant).filter((grant) => grant.id);
        } catch (error) {
            remapOwnerError(error, {
                forbidden: "You do not have permission to view owner access grants.",
                notFound: "Owner access grants were not found for this organization.",
            });
        }
    }
    await delay(800);
    return [];
}

export async function getOwnerAccessGrantHistory(ownerId: string): Promise<OwnerAccessGrantHistoryItem[]> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson(`/org/owners/${ownerId}/access-grants/history`);
            return getArray(res).map(mapOwnerAccessGrantHistoryItem).filter((entry) => entry.id);
        } catch (error) {
            remapOwnerError(error, {
                forbidden: "You do not have permission to view owner access grant history.",
                notFound: "Owner access grant history was not found for this organization.",
            });
        }
    }
    await delay(800);
    return [];
}

export async function inviteOwnerAccessGrant(ownerId: string, payload: { email: string }) {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson(`/org/owners/${ownerId}/access-grants`, {
                method: "POST",
                body: JSON.stringify({ email: payload.email }),
            });
            return mapOwnerMutationResult(res);
        } catch (error) {
            remapOwnerError(error, {
                forbidden: "You do not have permission to invite owner access grants.",
                notFound: "Owner was not found in this organization.",
            });
        }
    }
    await delay(800);
    return { success: true };
}

export async function linkExistingOwnerUser(ownerId: string, payload: { userId: string }) {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson(`/org/owners/${ownerId}/access-grants/link-existing-user`, {
                method: "POST",
                body: JSON.stringify({ userId: payload.userId }),
            });
            return mapOwnerMutationResult(res);
        } catch (error) {
            remapOwnerError(error, {
                forbidden: "You do not have permission to link an existing owner user.",
                notFound: "Owner was not found in this organization.",
            });
        }
    }
    await delay(800);
    return { success: true };
}

export async function activateOwnerAccessGrant(
    ownerId: string,
    grantId: string,
    payload: { userId: string; verificationMethod: string }
) {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson(`/org/owners/${ownerId}/access-grants/${grantId}/activate`, {
                method: "POST",
                body: JSON.stringify({
                    userId: payload.userId,
                    verificationMethod: payload.verificationMethod,
                }),
            });
            return mapOwnerMutationResult(res);
        } catch (error) {
            remapOwnerError(error, {
                forbidden: "You do not have permission to activate owner access grants.",
                notFound: "Owner access grant was not found in this organization.",
            });
        }
    }
    await delay(800);
    return { success: true };
}

export async function disableOwnerAccessGrant(
    ownerId: string,
    grantId: string,
    payload: { verificationMethod: string }
) {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson(`/org/owners/${ownerId}/access-grants/${grantId}/disable`, {
                method: "POST",
                body: JSON.stringify({
                    verificationMethod: payload.verificationMethod,
                }),
            });
            return mapOwnerMutationResult(res);
        } catch (error) {
            remapOwnerError(error, {
                forbidden: "You do not have permission to disable owner access grants.",
                notFound: "Owner access grant was not found in this organization.",
            });
        }
    }
    await delay(800);
    return { success: true };
}

export async function resendOwnerAccessGrantInvite(ownerId: string, grantId: string) {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson(`/org/owners/${ownerId}/access-grants/${grantId}/resend-invite`, {
                method: "POST",
                body: JSON.stringify({}),
            });
            return mapOwnerMutationResult(res);
        } catch (error) {
            remapOwnerError(error, {
                forbidden: "You do not have permission to resend owner access grant invites.",
                notFound: "Owner access grant was not found in this organization.",
            });
        }
    }
    await delay(800);
    return { success: true };
}
