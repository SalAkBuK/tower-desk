import type {
    CreateProviderStaffPayload,
    CreateServiceProviderPayload,
    LinkServiceProviderBuildingPayload,
    ProviderProfile,
    ServiceProvider,
    ServiceProviderAccessGrant,
    ServiceProviderBuildingLink,
    ServiceProviderMembership,
    ProviderRuntimeContext,
    UpdateProviderStaffPayload,
    UpdateServiceProviderPayload,
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

const trimPayload = <T extends Record<string, unknown>>(payload: T) =>
    Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));

const remapProviderError = (
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

const mapServiceProviderBuilding = (value: any): ServiceProviderBuildingLink | null => {
    const buildingId = asString(value?.buildingId ?? value?.id);
    if (!buildingId) return null;
    return {
        buildingId,
        buildingName: asString(value?.buildingName ?? value?.name),
        createdAt: asString(value?.createdAt),
    };
};

const mapServiceProviderMembership = (value: any): ServiceProviderMembership | null => {
    const userId = asString(value?.userId ?? value?.id ?? value?.user?.id);
    if (!userId) return null;
    return {
        userId,
        email: asString(value?.email ?? value?.user?.email),
        name: asString(value?.name ?? value?.fullName ?? value?.user?.name ?? value?.user?.fullName),
        role: asString(value?.role) ?? "WORKER",
        membershipIsActive: value?.membershipIsActive ?? value?.isActive ?? true,
        userIsActive: typeof value?.userIsActive === "boolean"
            ? value.userIsActive
            : typeof value?.user?.isActive === "boolean"
                ? value.user.isActive
                : undefined,
        mustChangePassword: typeof value?.mustChangePassword === "boolean"
            ? value.mustChangePassword
            : typeof value?.user?.mustChangePassword === "boolean"
                ? value.user.mustChangePassword
                : undefined,
        phone: asString(value?.phone ?? value?.user?.phone),
        tempPassword: asString(value?.tempPassword),
        createdAt: asString(value?.createdAt),
        updatedAt: asString(value?.updatedAt),
    };
};

const mapServiceProviderAccessGrant = (value: any): ServiceProviderAccessGrant | null => {
    const id = asString(value?.id ?? value?.grantId);
    if (!id) return null;
    const userId = asString(value?.user?.id ?? value?.userId);
    return {
        id,
        status: asString(value?.status) ?? "PENDING",
        inviteEmail: asNullableString(value?.inviteEmail),
        invitedAt: asNullableString(value?.invitedAt),
        acceptedAt: asNullableString(value?.acceptedAt),
        disabledAt: asNullableString(value?.disabledAt),
        user: userId
            ? {
                id: userId,
                email: asString(value?.user?.email),
                name: asString(value?.user?.name ?? value?.user?.fullName),
                phone: asNullableString(value?.user?.phone),
                isActive: typeof value?.user?.isActive === "boolean" ? value.user.isActive : undefined,
                mustChangePassword: typeof value?.user?.mustChangePassword === "boolean" ? value.user.mustChangePassword : undefined,
            }
            : null,
    };
};

const mapServiceProvider = (value: any): ServiceProvider => ({
    id: String(value?.id ?? value?.providerId ?? ""),
    orgId: asNullableString(value?.orgId),
    name: value?.name ?? value?.providerName ?? "",
    serviceCategory: asString(value?.serviceCategory),
    contactName: asString(value?.contactName),
    contactEmail: asString(value?.contactEmail),
    contactPhone: asString(value?.contactPhone),
    notes: asString(value?.notes),
    isActive: typeof value?.isActive === "boolean" ? value.isActive : true,
    isLinkedToCurrentOrg: typeof value?.isLinkedToCurrentOrg === "boolean" ? value.isLinkedToCurrentOrg : undefined,
    providerProfileOwnedByProvider: typeof value?.providerProfileOwnedByProvider === "boolean"
        ? value.providerProfileOwnedByProvider
        : undefined,
    linkedBuildings: getArray(value?.linkedBuildings ?? value?.buildings).map(mapServiceProviderBuilding).filter(Boolean) as ServiceProviderBuildingLink[],
    providerAdminAccessGrants: getArray(value?.providerAdminAccessGrants ?? value?.accessGrants)
        .map(mapServiceProviderAccessGrant)
        .filter(Boolean) as ServiceProviderAccessGrant[],
    createdAt: asString(value?.createdAt),
    updatedAt: asString(value?.updatedAt),
});

const mapProviderResponseItem = (res: any) => {
    const body = res?.data ?? res ?? {};
    return mapServiceProvider(body?.provider ?? body?.serviceProvider ?? body);
};

const mapProviderProfile = (value: any): ProviderProfile => ({
    id: String(value?.id ?? value?.providerId ?? ""),
    name: value?.name ?? value?.providerName ?? "",
    serviceCategory: asString(value?.serviceCategory),
    contactName: asString(value?.contactName),
    contactEmail: asString(value?.contactEmail),
    contactPhone: asString(value?.contactPhone),
    notes: asString(value?.notes),
    isActive: typeof value?.isActive === "boolean" ? value.isActive : true,
    createdAt: asString(value?.createdAt),
    updatedAt: asString(value?.updatedAt),
});

const mapProviderRuntimeContext = (value: any): ProviderRuntimeContext => ({
    userId: String(value?.userId ?? ""),
    email: asString(value?.email),
    providers: getArray(value?.providers).map((entry) => ({
        providerId: String(entry?.providerId ?? entry?.id ?? ""),
        name: asString(entry?.name) ?? "",
        serviceCategory: asString(entry?.serviceCategory),
        role: asString(entry?.role) ?? "WORKER",
        membershipIsActive: typeof entry?.membershipIsActive === "boolean" ? entry.membershipIsActive : true,
    })).filter((entry) => entry.providerId),
});

export async function getServiceProviders(search?: string): Promise<ServiceProvider[]> {
    if (!USE_MOCK) {
        try {
            const params = new URLSearchParams();
            if (search?.trim()) {
                params.set("search", search.trim());
            }
            const suffix = params.size > 0 ? `?${params.toString()}` : "";
            const res = await fetchJson(`/org/service-providers${suffix}`);
            return getArray(res).map(mapServiceProvider).filter((provider) => provider.id);
        } catch (error) {
            remapProviderError(error, {
                forbidden: "You do not have permission to view service providers.",
                notFound: "Service providers were not found for this organization.",
            });
        }
    }
    await delay(800);
    return [];
}

export async function getServiceProvider(providerId: string): Promise<ServiceProvider> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson(`/org/service-providers/${providerId}`);
            return mapProviderResponseItem(res);
        } catch (error) {
            remapProviderError(error, {
                forbidden: "You do not have permission to view this service provider.",
                notFound: "Service provider not found in this organization.",
            });
        }
    }
    await delay(800);
    return mapServiceProvider({ id: providerId, name: "Mock Provider", isActive: true, linkedBuildings: [], providerAdminAccessGrants: [] });
}

export async function getServiceProviderAccessGrants(providerId: string): Promise<ServiceProviderAccessGrant[]> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson(`/org/service-providers/${providerId}/access-grants`);
            return getArray(res).map(mapServiceProviderAccessGrant).filter(Boolean) as ServiceProviderAccessGrant[];
        } catch (error) {
            remapProviderError(error, {
                forbidden: "You do not have permission to view provider access grants.",
                notFound: "Provider access grants were not found in this organization.",
            });
        }
    }
    await delay(400);
    return [];
}

export async function getProviderRuntimeContext(): Promise<ProviderRuntimeContext> {
    if (!USE_MOCK) {
        const res = await fetchJson("/provider/me");
        return mapProviderRuntimeContext(res?.data ?? res ?? {});
    }

    await delay(400);
    return {
        userId: "mock-provider-user",
        email: "provider@example.test",
        providers: [],
    };
}

export async function getProviderProfile(): Promise<ProviderProfile> {
    if (!USE_MOCK) {
        const res = await fetchJson("/provider/profile");
        return mapProviderProfile(res?.data ?? res ?? {});
    }

    await delay(300);
    return mapProviderProfile({
        id: "mock-provider",
        name: "Mock Provider",
        isActive: true,
    });
}

export async function updateProviderProfile(payload: Partial<ProviderProfile>): Promise<ProviderProfile> {
    if (!USE_MOCK) {
        const res = await fetchJson("/provider/profile", {
            method: "PATCH",
            body: JSON.stringify(trimPayload({
                name: payload.name,
                serviceCategory: payload.serviceCategory,
                contactName: payload.contactName,
                contactEmail: payload.contactEmail,
                contactPhone: payload.contactPhone,
                notes: payload.notes,
                isActive: payload.isActive,
            })),
        });
        return mapProviderProfile(res?.data ?? res ?? {});
    }

    await delay(300);
    return mapProviderProfile({
        id: "mock-provider",
        ...payload,
        isActive: payload.isActive ?? true,
    });
}

export async function getProviderStaff(): Promise<ServiceProviderMembership[]> {
    if (!USE_MOCK) {
        const res = await fetchJson("/provider/staff");
        return getArray(res).map(mapServiceProviderMembership).filter(Boolean) as ServiceProviderMembership[];
    }

    await delay(300);
    return [];
}

export async function createProviderStaff(payload: CreateProviderStaffPayload): Promise<ServiceProviderMembership> {
    if (!USE_MOCK) {
        const res = await fetchJson("/provider/staff", {
            method: "POST",
            body: JSON.stringify(trimPayload({
                email: payload.email,
                name: payload.name,
                phone: payload.phone,
                role: payload.role,
                isActive: payload.isActive,
            })),
        });
        return mapServiceProviderMembership(res?.data ?? res) as ServiceProviderMembership;
    }

    await delay(300);
    return mapServiceProviderMembership({
        userId: String(Date.now()),
        ...payload,
        membershipIsActive: payload.isActive ?? true,
        userIsActive: payload.isActive ?? true,
        mustChangePassword: true,
        tempPassword: "generated_temp_password",
    }) as ServiceProviderMembership;
}

export async function updateProviderStaff(userId: string, payload: UpdateProviderStaffPayload): Promise<ServiceProviderMembership> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/provider/staff/${userId}`, {
            method: "PATCH",
            body: JSON.stringify(trimPayload({
                role: payload.role,
                isActive: payload.isActive,
            })),
        });
        return mapServiceProviderMembership(res?.data ?? res) as ServiceProviderMembership;
    }

    await delay(300);
    return mapServiceProviderMembership({
        userId,
        role: payload.role ?? "WORKER",
        membershipIsActive: payload.isActive ?? true,
        userIsActive: payload.isActive ?? true,
    }) as ServiceProviderMembership;
}

export async function createServiceProvider(payload: CreateServiceProviderPayload): Promise<ServiceProvider> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson("/org/service-providers", {
                method: "POST",
                body: JSON.stringify(trimPayload({
                    name: payload.name,
                    serviceCategory: payload.serviceCategory ?? undefined,
                    contactName: payload.contactName ?? undefined,
                    contactEmail: payload.contactEmail ?? undefined,
                    contactPhone: payload.contactPhone ?? undefined,
                    notes: payload.notes ?? undefined,
                    isActive: payload.isActive ?? undefined,
                    buildingIds: payload.buildingIds?.length ? payload.buildingIds : undefined,
                    adminEmail: payload.adminEmail ?? undefined,
                })),
            });
            return mapProviderResponseItem(res);
        } catch (error) {
            remapProviderError(error, {
                forbidden: "You do not have permission to create service providers.",
                notFound: "Service provider could not be created in this organization.",
            });
        }
    }
    await delay(800);
    return mapServiceProvider({ id: String(Date.now()), ...payload, linkedBuildings: [], providerAdminAccessGrants: [] });
}

export async function updateServiceProvider(
    providerId: string,
    payload: UpdateServiceProviderPayload
): Promise<ServiceProvider> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson(`/org/service-providers/${providerId}`, {
                method: "PATCH",
                body: JSON.stringify(trimPayload({
                    name: payload.name,
                    serviceCategory: payload.serviceCategory,
                    contactName: payload.contactName,
                    contactEmail: payload.contactEmail,
                    contactPhone: payload.contactPhone,
                    notes: payload.notes,
                    isActive: payload.isActive,
                })),
            });
            return mapProviderResponseItem(res);
        } catch (error) {
            remapProviderError(error, {
                forbidden: "You do not have permission to update service providers.",
                notFound: "Service provider not found in this organization.",
            });
        }
    }
    await delay(800);
    return mapServiceProvider({ id: providerId, ...payload, buildings: [], users: [] });
}

export async function linkServiceProviderBuilding(
    providerId: string,
    payload: LinkServiceProviderBuildingPayload
): Promise<ServiceProvider> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson(`/org/service-providers/${providerId}/buildings`, {
                method: "POST",
                body: JSON.stringify({ buildingId: payload.buildingId }),
            });
            return mapProviderResponseItem(res);
        } catch (error) {
            remapProviderError(error, {
                forbidden: "You do not have permission to link service providers to buildings.",
                notFound: "Service provider or building not found in this organization.",
            });
        }
    }
    await delay(800);
    return mapServiceProvider({ id: providerId, name: "Mock Provider", isActive: true, linkedBuildings: [payload], providerAdminAccessGrants: [] });
}

export async function unlinkServiceProviderBuilding(providerId: string, buildingId: string): Promise<ServiceProvider> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson(`/org/service-providers/${providerId}/buildings/${buildingId}`, {
                method: "DELETE",
            });
            return mapProviderResponseItem(res);
        } catch (error) {
            remapProviderError(error, {
                forbidden: "You do not have permission to unlink service providers from buildings.",
                notFound: "Service provider or building link not found in this organization.",
            });
        }
    }
    await delay(800);
    return mapServiceProvider({ id: providerId, name: "Mock Provider", isActive: true, linkedBuildings: [], providerAdminAccessGrants: [] });
}

export async function createServiceProviderAccessGrant(providerId: string, email: string): Promise<ServiceProviderAccessGrant> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/service-providers/${providerId}/access-grants`, {
            method: "POST",
            body: JSON.stringify({ email }),
        });
        return mapServiceProviderAccessGrant(res?.data ?? res) as ServiceProviderAccessGrant;
    }

    await delay(400);
    return {
        id: String(Date.now()),
        status: "PENDING",
        inviteEmail: email,
        invitedAt: new Date().toISOString(),
        acceptedAt: null,
        disabledAt: null,
        user: null,
    };
}

export async function resendServiceProviderAccessGrantInvite(providerId: string, grantId: string): Promise<ServiceProviderAccessGrant> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/service-providers/${providerId}/access-grants/${grantId}/resend-invite`, {
            method: "POST",
        });
        return mapServiceProviderAccessGrant(res?.data ?? res) as ServiceProviderAccessGrant;
    }

    await delay(300);
    return {
        id: grantId,
        status: "PENDING",
        invitedAt: new Date().toISOString(),
    };
}

export async function disableServiceProviderAccessGrant(
    providerId: string,
    grantId: string,
    verificationMethod = "MANUAL_REVIEW"
): Promise<ServiceProviderAccessGrant> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/service-providers/${providerId}/access-grants/${grantId}/disable`, {
            method: "POST",
            body: JSON.stringify({ verificationMethod }),
        });
        return mapServiceProviderAccessGrant(res?.data ?? res) as ServiceProviderAccessGrant;
    }

    await delay(300);
    return {
        id: grantId,
        status: "DISABLED",
        disabledAt: new Date().toISOString(),
    };
}
