import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const API_BASE_URL = "https://example.test/api";

async function loadAuthApi() {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", API_BASE_URL);
    return import("../../src/lib/api/auth");
}

describe("auth api login role hydration", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("detects service provider role from /provider/me when login payload has no role", async () => {
        const authApi = await loadAuthApi();

        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);

            if (url.endsWith("/auth/login")) {
                return new Response(JSON.stringify({
                    accessToken: "access-token",
                    refreshToken: "refresh-token",
                    user: {
                        id: "provider-1",
                        email: "provider@example.com",
                        name: "Clean Provider",
                        orgId: null,
                        orgAccess: [],
                        buildingAccess: [],
                        effectivePermissions: [],
                    },
                }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            if (url.endsWith("/users/me")) {
                return new Response(JSON.stringify({
                    id: "provider-1",
                    email: "provider@example.com",
                    name: "Clean Provider",
                    orgId: null,
                    orgAccess: [],
                    buildingAccess: [],
                    effectivePermissions: [],
                }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            if (url.endsWith("/users/me/roles")) {
                return new Response(JSON.stringify({ roles: [] }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            if (url.endsWith("/provider/me")) {
                return new Response(JSON.stringify({
                    userId: "provider-1",
                    providers: [
                        {
                            providerId: "service-provider-1",
                            name: "RapidFix Technical Services",
                            role: "ADMIN",
                            membershipIsActive: true,
                        },
                    ],
                }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            if (url.endsWith("/owner/portfolio/summary")) {
                return new Response(JSON.stringify({ message: "forbidden" }), {
                    status: 403,
                    headers: { "content-type": "application/json" },
                });
            }

            throw new Error(`Unexpected URL ${url}`);
        });

        vi.stubGlobal("fetch", fetchMock);

        const result = await authApi.login("provider@example.com", "password");

        expect(result.user.baseRole).toBe("service_provider");
        expect(result.user.role).toBe("service_provider");
    });

    it("recognizes platform persona users and skips org-scoped role hydration", async () => {
        const authApi = await loadAuthApi();

        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);

            if (url.endsWith("/auth/login")) {
                return new Response(JSON.stringify({
                    accessToken: "access-token",
                    refreshToken: "refresh-token",
                    user: {
                        id: "platform-1",
                        email: "superadmin@towerdesk.com",
                        name: "Platform Admin",
                        orgId: null,
                        persona: {
                            isPlatformAdmin: true,
                        },
                        orgAccess: [],
                        buildingAccess: [],
                        effectivePermissions: [],
                    },
                }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            if (url.endsWith("/users/me")) {
                return new Response(JSON.stringify({
                    id: "platform-1",
                    email: "superadmin@towerdesk.com",
                    name: "Platform Admin",
                    orgId: null,
                    persona: {
                        isPlatformAdmin: true,
                    },
                    orgAccess: [],
                    buildingAccess: [],
                    effectivePermissions: [],
                }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            if (url.endsWith("/users/me/roles")) {
                throw new Error("platform login should not call /users/me/roles without org context");
            }

            if (url.endsWith("/provider/me") || url.endsWith("/owner/portfolio/summary")) {
                throw new Error(`Unexpected runtime role probe ${url}`);
            }

            throw new Error(`Unexpected URL ${url}`);
        });

        vi.stubGlobal("fetch", fetchMock);

        const result = await authApi.login("superadmin@towerdesk.com", "password");

        expect(result.user.baseRole).toBe("superadmin");
        expect(result.user.role).toBe("superadmin");
        expect(fetchMock).not.toHaveBeenCalledWith(`${API_BASE_URL}/users/me/roles`, expect.anything());
    });
});
