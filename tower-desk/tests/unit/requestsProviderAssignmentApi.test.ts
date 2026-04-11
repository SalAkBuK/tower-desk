import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const API_BASE_URL = "https://example.test/api";

async function loadRequestsApi() {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", API_BASE_URL);
    return import("../../src/lib/api/requests");
}

const buildRequestDetailResponse = (overrides?: Record<string, unknown>) => ({
    request: {
        id: "request-1",
        title: "Fix lobby leak",
        description: "Pipe leak near the front desk.",
        status: "ASSIGNED",
        priority: "HIGH",
        buildingId: "building-1",
        createdByTenantId: "tenant-1",
        serviceProvider: {
            id: "provider-1",
            name: "RapidFix Technical Services",
            serviceCategory: "Plumbing",
        },
        ownerApproval: {
            status: "PENDING",
            estimatedAmount: "150.00",
            estimatedCurrency: "AED",
        },
        requesterContext: {
            isResident: true,
            residentOccupancyStatus: "ACTIVE",
            residentInviteStatus: "ACCEPTED",
            isFormerResident: false,
            currentUnitOccupiedByRequester: true,
            currentUnitOccupant: {
                userId: "resident-1",
                name: "Resident User",
            },
        },
        requestTenancyContext: {
            occupancyIdAtCreation: "occupancy-1",
            leaseIdAtCreation: "lease-1",
            currentOccupancyId: "occupancy-1",
            currentLeaseId: "lease-1",
            isCurrentOccupancy: true,
            isCurrentLease: true,
            label: "CURRENT_OCCUPANCY",
            leaseLabel: "CURRENT_LEASE",
            tenancyContextSource: "SNAPSHOT",
            leaseContextSource: "SNAPSHOT",
        },
        ownerApprovalStatus: "PENDING",
        policy: {
            recommendation: "REQUEST_OWNER_APPROVAL",
        },
        isEmergency: true,
        isLikeForLike: false,
        isUpgrade: true,
        isMajorReplacement: false,
        isResponsibilityDisputed: false,
        queue: "AWAITING_OWNER",
        ...overrides,
    },
});

describe("request provider assignment api", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("maps provider assignment fields from request detail", async () => {
        const requestsApi = await loadRequestsApi();

        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith("/org/buildings/building-1/requests/request-1/comments")) {
                return new Response(JSON.stringify([]), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            return new Response(JSON.stringify(buildRequestDetailResponse()), {
                status: 200,
                headers: { "content-type": "application/json" },
            });
        });

        vi.stubGlobal("fetch", fetchMock);

        const request = await requestsApi.getRequest("request-1", "building-1");

        expect(request).toMatchObject({
            id: "request-1",
            serviceProvider: {
                id: "provider-1",
                name: "RapidFix Technical Services",
                serviceCategory: "Plumbing",
            },
            ownerApproval: {
                status: "PENDING",
                estimatedAmount: "150.00",
                estimatedCurrency: "AED",
            },
            ownerApprovalStatus: "PENDING",
            policy: {
                recommendation: "REQUEST_OWNER_APPROVAL",
            },
            requesterContext: {
                isResident: true,
                residentOccupancyStatus: "ACTIVE",
                residentInviteStatus: "ACCEPTED",
                currentUnitOccupiedByRequester: true,
                currentUnitOccupant: {
                    userId: "resident-1",
                    name: "Resident User",
                },
            },
            requestTenancyContext: {
                occupancyIdAtCreation: "occupancy-1",
                leaseIdAtCreation: "lease-1",
                currentOccupancyId: "occupancy-1",
                currentLeaseId: "lease-1",
                isCurrentOccupancy: true,
                isCurrentLease: true,
                label: "CURRENT_OCCUPANCY",
                leaseLabel: "CURRENT_LEASE",
                tenancyContextSource: "SNAPSHOT",
                leaseContextSource: "SNAPSHOT",
            },
            isEmergency: true,
            isUpgrade: true,
            queue: "AWAITING_OWNER",
        });
    });

    it("sends provider assignment mutation payloads to the expected endpoints", async () => {
        const requestsApi = await loadRequestsApi();

        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const body = init?.body ? JSON.parse(String(init.body)) : undefined;

            if (url.endsWith("/org/buildings/building-1/requests/request-1/assign-provider")) {
                expect(init?.method).toBe("POST");
                expect(body).toEqual({ serviceProviderId: "provider-1" });
                return new Response(JSON.stringify({ success: true }), {
                    status: 201,
                    headers: { "content-type": "application/json" },
                });
            }

            if (url.endsWith("/org/buildings/building-1/requests/request-1/unassign-provider")) {
                expect(init?.method).toBe("POST");
                expect(body).toBeUndefined();
                return new Response(JSON.stringify({ success: true }), {
                    status: 201,
                    headers: { "content-type": "application/json" },
                });
            }

            if (url.endsWith("/org/buildings/building-1/requests/request-1/comments")) {
                return new Response(JSON.stringify([]), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            if (url.endsWith("/org/buildings/building-1/requests/request-1")) {
                return new Response(JSON.stringify(buildRequestDetailResponse()), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            throw new Error(`Unexpected URL ${url}`);
        });

        vi.stubGlobal("fetch", fetchMock);

        await requestsApi.assignRequestProvider("request-1", "provider-1", "building-1");
        await requestsApi.unassignRequestProvider("request-1", "building-1");

        expect(fetchMock).toHaveBeenCalled();
    });

    it("sends policy triage and request-now mutations to the expected endpoints", async () => {
        const requestsApi = await loadRequestsApi();

        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const body = init?.body ? JSON.parse(String(init.body)) : undefined;

            if (url.endsWith("/org/buildings/building-1/requests/request-1/policy-triage")) {
                expect(init?.method).toBe("POST");
                expect(body).toEqual({
                    estimatedAmount: 450,
                    estimatedCurrency: "AED",
                    isEmergency: false,
                    isLikeForLike: true,
                    isUpgrade: false,
                    isMajorReplacement: true,
                    isResponsibilityDisputed: false,
                });
                return new Response(JSON.stringify({ success: true }), {
                    status: 201,
                    headers: { "content-type": "application/json" },
                });
            }

            if (url.endsWith("/org/buildings/building-1/requests/request-1/owner-approval/request-now")) {
                expect(init?.method).toBe("POST");
                expect(body).toBeUndefined();
                return new Response(JSON.stringify({ success: true }), {
                    status: 201,
                    headers: { "content-type": "application/json" },
                });
            }

            if (url.endsWith("/org/buildings/building-1/requests/request-1/comments")) {
                return new Response(JSON.stringify([]), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            if (url.endsWith("/org/buildings/building-1/requests/request-1")) {
                return new Response(JSON.stringify(buildRequestDetailResponse()), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            throw new Error(`Unexpected URL ${url}`);
        });

        vi.stubGlobal("fetch", fetchMock);

        await requestsApi.triageRequestPolicy("request-1", "building-1", {
            estimatedAmount: 450,
            estimatedCurrency: "AED",
            isEmergency: false,
            isLikeForLike: true,
            isUpgrade: false,
            isMajorReplacement: true,
            isResponsibilityDisputed: false,
        });
        await requestsApi.requestOwnerApprovalNow("request-1", "building-1");

        expect(fetchMock).toHaveBeenCalled();
    });

    it("sends workflow payloads for estimate, provider worker, approval reminder, override, comments, and attachments", async () => {
        const requestsApi = await loadRequestsApi();

        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const body = init?.body ? JSON.parse(String(init.body)) : undefined;

            if (url.endsWith("/org/buildings/building-1/requests/request-1/request-estimate")) {
                expect(init?.method).toBe("POST");
                expect(body).toEqual({ serviceProviderId: "provider-9" });
                return new Response(JSON.stringify({ success: true }), { status: 201, headers: { "content-type": "application/json" } });
            }

            if (url.endsWith("/org/buildings/building-1/requests/request-1/assign-provider-worker")) {
                expect(init?.method).toBe("POST");
                expect(body).toEqual({ userId: "worker-2" });
                return new Response(JSON.stringify({ success: true }), { status: 201, headers: { "content-type": "application/json" } });
            }

            if (url.endsWith("/org/buildings/building-1/requests/request-1/estimate")) {
                expect(init?.method).toBe("POST");
                expect(body).toEqual({
                    estimatedAmount: 725,
                    estimatedCurrency: "AED",
                    approvalRequiredReason: "Quote exceeds discretionary spend",
                    isEmergency: false,
                    isLikeForLike: true,
                    isUpgrade: false,
                    isMajorReplacement: false,
                    isResponsibilityDisputed: false,
                });
                return new Response(JSON.stringify({ success: true }), { status: 201, headers: { "content-type": "application/json" } });
            }

            if (url.endsWith("/org/buildings/building-1/requests/request-1/owner-approval/resend")) {
                expect(init?.method).toBe("POST");
                expect(body).toBeUndefined();
                return new Response(JSON.stringify({ success: true }), { status: 201, headers: { "content-type": "application/json" } });
            }

            if (url.endsWith("/org/buildings/building-1/requests/request-1/owner-approval/override")) {
                expect(init?.method).toBe("POST");
                expect(body).toEqual({
                    decisionSource: "EMERGENCY_OVERRIDE",
                    ownerApprovalOverrideReason: "Leak escalation after hours",
                });
                return new Response(JSON.stringify({ success: true }), { status: 201, headers: { "content-type": "application/json" } });
            }

            if (url.endsWith("/org/buildings/building-1/requests/request-1/comments")) {
                if (init?.method === "POST") {
                    expect(body).toEqual({ message: "Internal ops update", visibility: "INTERNAL" });
                    return new Response(JSON.stringify({ success: true }), { status: 201, headers: { "content-type": "application/json" } });
                }
                return new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } });
            }

            if (url.endsWith("/org/buildings/building-1/requests/request-1/attachments")) {
                expect(init?.method).toBe("POST");
                expect(body).toEqual({
                    attachments: [
                        {
                            fileName: "estimate.pdf",
                            mimeType: "application/pdf",
                            sizeBytes: 1024,
                            url: "https://files.test/estimate.pdf",
                        },
                    ],
                });
                return new Response(JSON.stringify({ success: true }), { status: 201, headers: { "content-type": "application/json" } });
            }

            if (url.endsWith("/org/buildings/building-1/requests/request-1")) {
                return new Response(JSON.stringify(buildRequestDetailResponse()), { status: 200, headers: { "content-type": "application/json" } });
            }

            throw new Error(`Unexpected URL ${url}`);
        });

        vi.stubGlobal("fetch", fetchMock);

        await requestsApi.requestEstimate("request-1", "building-1", "provider-9");
        await requestsApi.assignRequestProviderWorker("request-1", "worker-2", "building-1");
        await requestsApi.submitRequestEstimate("request-1", "building-1", {
            estimatedAmount: 725,
            estimatedCurrency: "AED",
            approvalRequiredReason: "Quote exceeds discretionary spend",
            isEmergency: false,
            isLikeForLike: true,
            isUpgrade: false,
            isMajorReplacement: false,
            isResponsibilityDisputed: false,
        });
        await requestsApi.sendOwnerApprovalReminder("request-1", "building-1");
        await requestsApi.overrideOwnerApproval("request-1", "building-1", {
            decisionSource: "EMERGENCY_OVERRIDE",
            ownerApprovalOverrideReason: "Leak escalation after hours",
        });
        await requestsApi.addRequestComment("request-1", "Internal ops update", "building-1", "INTERNAL");
        await requestsApi.addRequestAttachments("request-1", "building-1", [
            {
                fileName: "estimate.pdf",
                mimeType: "application/pdf",
                sizeBytes: 1024,
                url: "https://files.test/estimate.pdf",
            },
        ]);

        expect(fetchMock).toHaveBeenCalled();
    });
});
