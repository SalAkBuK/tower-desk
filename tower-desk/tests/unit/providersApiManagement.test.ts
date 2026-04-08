import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const API_BASE_URL = "https://example.test/api";

async function loadProvidersApi() {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", API_BASE_URL);
    return import("../../src/lib/api/providers");
}

describe("service providers management api", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("maps service providers from the registry endpoints", async () => {
        const providersApi = await loadProvidersApi();

        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith("/org/service-providers")) {
                return new Response(JSON.stringify([
                    {
                        id: "provider-uuid",
                        name: "RapidFix Technical Services",
                        serviceCategory: "Plumbing",
                        contactName: "Nadia Khan",
                        contactEmail: "ops@rapidfix.test",
                        contactPhone: "+971500000000",
                        notes: "24/7 emergency coverage",
                        isActive: true,
                        linkedBuildings: [{ buildingId: "building-1", buildingName: "Central Tower" }],
                        providerAdminAccessGrants: [{ id: "grant-1", status: "ACTIVE", user: { id: "user-1", email: "admin@test.com", name: "Vendor Admin" } }],
                    },
                ]), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }
            return new Response(JSON.stringify({
                provider: {
                    id: "provider-uuid",
                    name: "RapidFix Technical Services",
                    isActive: true,
                    linkedBuildings: [{ buildingId: "building-1", buildingName: "Central Tower" }],
                    providerAdminAccessGrants: [{ id: "grant-1", status: "ACTIVE", user: { id: "user-1", email: "admin@test.com" } }],
                },
            }), {
                status: 200,
                headers: { "content-type": "application/json" },
            });
        });

        vi.stubGlobal("fetch", fetchMock);

        const providers = await providersApi.getServiceProviders();
        const provider = await providersApi.getServiceProvider("provider-uuid");

        expect(providers[0]).toMatchObject({
            id: "provider-uuid",
            name: "RapidFix Technical Services",
            serviceCategory: "Plumbing",
            linkedBuildings: [{ buildingId: "building-1", buildingName: "Central Tower" }],
            providerAdminAccessGrants: [{ id: "grant-1", status: "ACTIVE" }],
        });
        expect(provider).toMatchObject({
            id: "provider-uuid",
            name: "RapidFix Technical Services",
        });
    });

    it("sends provider create, update, and building link payloads to the expected endpoints", async () => {
        const providersApi = await loadProvidersApi();

        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const body = init?.body ? JSON.parse(String(init.body)) : undefined;

            if (url.endsWith("/org/service-providers") && init?.method === "POST") {
                expect(body).toEqual({
                    name: "RapidFix Technical Services",
                    serviceCategory: "Plumbing",
                    contactName: "Nadia Khan",
                    contactEmail: "ops@rapidfix.test",
                    contactPhone: "+971500000000",
                    notes: "24/7 emergency coverage",
                    isActive: true,
                });
            } else if (url.endsWith("/org/service-providers/provider-uuid") && init?.method === "PATCH") {
                expect(body).toEqual({
                    contactPhone: "+971511111111",
                    isActive: false,
                });
            } else if (url.endsWith("/org/service-providers/provider-uuid/buildings")) {
                expect(body).toEqual({ buildingId: "building-1" });
            } else if (url.endsWith("/org/service-providers/provider-uuid/buildings/building-1")) {
                expect(init?.method).toBe("DELETE");
            } else {
                throw new Error(`Unexpected URL ${url}`);
            }

            return new Response(JSON.stringify({
                provider: {
                    id: "provider-uuid",
                    name: "RapidFix Technical Services",
                    isActive: true,
                    linkedBuildings: [],
                    providerAdminAccessGrants: [],
                },
                success: true,
            }), {
                status: 200,
                headers: { "content-type": "application/json" },
            });
        });

        vi.stubGlobal("fetch", fetchMock);

        await providersApi.createServiceProvider({
            name: "RapidFix Technical Services",
            serviceCategory: "Plumbing",
            contactName: "Nadia Khan",
            contactEmail: "ops@rapidfix.test",
            contactPhone: "+971500000000",
            notes: "24/7 emergency coverage",
            isActive: true,
        });
        await providersApi.updateServiceProvider("provider-uuid", {
            contactPhone: "+971511111111",
            isActive: false,
        });
        await providersApi.linkServiceProviderBuilding("provider-uuid", { buildingId: "building-1" });
        await providersApi.unlinkServiceProviderBuilding("provider-uuid", "building-1");

        expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it("uses provider portal profile and staff endpoints", async () => {
        const providersApi = await loadProvidersApi();

        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const body = init?.body ? JSON.parse(String(init.body)) : undefined;

            if (url.endsWith("/provider/profile") && !init?.method) {
                return new Response(JSON.stringify({
                    id: "provider-uuid",
                    name: "RapidFix Technical Services",
                    serviceCategory: "Plumbing",
                    isActive: true,
                }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }
            if (url.endsWith("/provider/profile") && init?.method === "PATCH") {
                expect(body).toEqual({
                    serviceCategory: "Electrical",
                    contactPhone: "+971511111111",
                });
                return new Response(JSON.stringify({
                    id: "provider-uuid",
                    name: "RapidFix Technical Services",
                    serviceCategory: "Electrical",
                    contactPhone: "+971511111111",
                    isActive: true,
                }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }
            if (url.endsWith("/provider/staff") && !init?.method) {
                return new Response(JSON.stringify([
                    {
                        userId: "worker-1",
                        email: "worker@test.com",
                        name: "Provider Worker",
                        role: "WORKER",
                        membershipIsActive: true,
                        userIsActive: true,
                    },
                ]), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }
            if (url.endsWith("/provider/staff") && init?.method === "POST") {
                expect(body).toEqual({
                    email: "worker2@test.com",
                    name: "Provider Worker 2",
                    phone: "+971500000111",
                    role: "WORKER",
                    isActive: true,
                });
                return new Response(JSON.stringify({
                    userId: "worker-2",
                    email: "worker2@test.com",
                    name: "Provider Worker 2",
                    phone: "+971500000111",
                    role: "WORKER",
                    membershipIsActive: true,
                    userIsActive: true,
                    tempPassword: "generated_temp_password",
                }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }
            if (url.endsWith("/provider/staff/worker-1") && init?.method === "PATCH") {
                expect(body).toEqual({ role: "ADMIN", isActive: false });
                return new Response(JSON.stringify({
                    userId: "worker-1",
                    email: "worker@test.com",
                    name: "Provider Worker",
                    role: "ADMIN",
                    membershipIsActive: false,
                    userIsActive: false,
                }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            throw new Error(`Unexpected URL ${url}`);
        });

        vi.stubGlobal("fetch", fetchMock);

        const profile = await providersApi.getProviderProfile();
        const updatedProfile = await providersApi.updateProviderProfile({
            serviceCategory: "Electrical",
            contactPhone: "+971511111111",
        });
        const staff = await providersApi.getProviderStaff();
        const createdStaff = await providersApi.createProviderStaff({
            email: "worker2@test.com",
            name: "Provider Worker 2",
            phone: "+971500000111",
            role: "WORKER",
            isActive: true,
        });
        const updatedStaff = await providersApi.updateProviderStaff("worker-1", {
            role: "ADMIN",
            isActive: false,
        });

        expect(profile).toMatchObject({ id: "provider-uuid", name: "RapidFix Technical Services" });
        expect(updatedProfile).toMatchObject({ serviceCategory: "Electrical", contactPhone: "+971511111111" });
        expect(staff[0]).toMatchObject({ userId: "worker-1", role: "WORKER" });
        expect(createdStaff).toMatchObject({ userId: "worker-2", tempPassword: "generated_temp_password" });
        expect(updatedStaff).toMatchObject({ userId: "worker-1", role: "ADMIN", membershipIsActive: false });
    });
});
