import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const API_BASE_URL = "https://example.test/api";

async function loadOwnersApi() {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", API_BASE_URL);
    return import("../../src/lib/api/owners");
}

describe("owners management api", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("creates an owner with the owner management payload", async () => {
        const ownersApi = await loadOwnersApi();

        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            expect(String(input)).toBe(`${API_BASE_URL}/org/owners`);
            const body = JSON.parse(String(init?.body ?? "{}"));
            expect(body).toMatchObject({
                name: "Jane Owner",
                partyType: "INDIVIDUAL",
                displayNameEn: "Jane Owner",
                email: "owner@example.com",
                phone: "+971500000000",
                address: "Dubai Marina",
                resolutionToken: "resolution-token-1",
                identifier: {
                    type: "EMIRATES_ID",
                    value: "784-xxxx",
                    countryCode: "AE",
                    issuingAuthority: "ICP",
                },
                ownerOverrides: {
                    displayNameOverride: "Jane A. Owner",
                    contactEmailOverride: "alt@example.com",
                    contactPhoneOverride: "+971511111111",
                    notes: "VIP owner",
                },
            });

            return new Response(JSON.stringify({
                owner: {
                    id: "owner-uuid",
                    name: "Jane Owner",
                    partyType: "INDIVIDUAL",
                    email: "owner@example.com",
                    phone: "+971500000000",
                    address: "Dubai Marina",
                },
            }), {
                status: 200,
                headers: { "content-type": "application/json" },
            });
        });

        vi.stubGlobal("fetch", fetchMock);

        const owner = await ownersApi.createOwner({
            name: "Jane Owner",
            partyType: "INDIVIDUAL",
            displayNameEn: "Jane Owner",
            email: "owner@example.com",
            phone: "+971500000000",
            address: "Dubai Marina",
            resolutionToken: "resolution-token-1",
            identifier: {
                type: "EMIRATES_ID",
                value: "784-xxxx",
                countryCode: "AE",
                issuingAuthority: "ICP",
            },
            ownerOverrides: {
                displayNameOverride: "Jane A. Owner",
                contactEmailOverride: "alt@example.com",
                contactPhoneOverride: "+971511111111",
                notes: "VIP owner",
            },
        });

        expect(owner).toMatchObject({
            id: "owner-uuid",
            name: "Jane Owner",
            partyType: "INDIVIDUAL",
            email: "owner@example.com",
        });
    });

    it("resolves owner party with the optional resolve endpoint", async () => {
        const ownersApi = await loadOwnersApi();

        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            expect(String(input)).toBe(`${API_BASE_URL}/org/owners/resolve-party`);
            const body = JSON.parse(String(init?.body ?? "{}"));
            expect(body).toMatchObject({
                identifierType: "EMIRATES_ID",
                identifierValue: "784-xxxx",
                countryCode: "AE",
                issuingAuthority: "ICP",
            });

            return new Response(JSON.stringify({
                resolutionToken: "resolution-token-2",
                status: "MATCHED",
                matchedOwner: {
                    id: "owner-uuid",
                    name: "Jane Owner",
                },
            }), {
                status: 200,
                headers: { "content-type": "application/json" },
            });
        });

        vi.stubGlobal("fetch", fetchMock);

        const result = await ownersApi.resolveOwnerParty({
            identifierType: "EMIRATES_ID",
            identifierValue: "784-xxxx",
            countryCode: "AE",
            issuingAuthority: "ICP",
        });

        expect(result).toMatchObject({
            resolutionToken: "resolution-token-2",
            status: "MATCHED",
            matchedOwner: {
                id: "owner-uuid",
                name: "Jane Owner",
            },
        });
    });

    it("sends owner access grant action payloads to the expected endpoints", async () => {
        const ownersApi = await loadOwnersApi();

        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const body = JSON.parse(String(init?.body ?? "{}"));

            if (url.endsWith("/org/owners/owner-uuid/access-grants")) {
                expect(body).toEqual({ email: "owner@example.com" });
                return new Response(JSON.stringify({
                    grant: {
                        id: "grant-invite-uuid",
                        ownerId: "owner-uuid",
                        status: "PENDING",
                        inviteEmail: "owner@example.com",
                    },
                }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            } else if (url.endsWith("/org/owners/owner-uuid/access-grants/link-existing-user")) {
                expect(body).toEqual({ userId: "user-uuid" });
            } else if (url.endsWith("/org/owners/owner-uuid/access-grants/grant-uuid/activate")) {
                expect(body).toEqual({ userId: "user-uuid", verificationMethod: "EMAIL_MATCH" });
            } else if (url.endsWith("/org/owners/owner-uuid/access-grants/grant-uuid/disable")) {
                expect(body).toEqual({ verificationMethod: "MANUAL_REVOKE" });
            } else if (url.endsWith("/org/owners/owner-uuid/access-grants/grant-uuid/resend-invite")) {
                expect(body).toEqual({});
            } else {
                throw new Error(`Unexpected URL ${url}`);
            }

            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { "content-type": "application/json" },
            });
        });

        vi.stubGlobal("fetch", fetchMock);

        const inviteResult = await ownersApi.inviteOwnerAccessGrant("owner-uuid", { email: "owner@example.com" });
        await ownersApi.linkExistingOwnerUser("owner-uuid", { userId: "user-uuid" });
        await ownersApi.activateOwnerAccessGrant("owner-uuid", "grant-uuid", {
            userId: "user-uuid",
            verificationMethod: "EMAIL_MATCH",
        });
        await ownersApi.disableOwnerAccessGrant("owner-uuid", "grant-uuid", {
            verificationMethod: "MANUAL_REVOKE",
        });
        await ownersApi.resendOwnerAccessGrantInvite("owner-uuid", "grant-uuid");

        expect(inviteResult).toMatchObject({
            success: true,
            grant: {
                id: "grant-invite-uuid",
                ownerId: "owner-uuid",
                status: "PENDING",
                inviteEmail: "owner@example.com",
            },
        });
        expect(fetchMock).toHaveBeenCalledTimes(5);
    });
});
