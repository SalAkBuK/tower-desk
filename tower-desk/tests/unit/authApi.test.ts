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
});
