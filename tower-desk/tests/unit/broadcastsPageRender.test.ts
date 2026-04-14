import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type AuthState = {
    user: {
        id: string;
        effectivePermissions: string[];
        buildingAccess?: Array<Record<string, string | null>>;
        orgAccess?: Array<Record<string, string | null>>;
    };
    baseRole: string;
};

type BroadcastStateOverrides = Partial<{
    selectedBroadcastId: string;
    filterBuildingId: string;
    filterAudience: string;
    isBuildingFilterOpen: boolean;
    isAudienceFilterOpen: boolean;
    searchText: string;
    renderCap: string;
    isComposerOpen: boolean;
    title: string;
    body: string;
    sendToAll: boolean;
    selectedBuildingIds: string[];
    selectedAudiences: string[];
    isLoadingMore: boolean;
    selectedTemplateId: string;
}>;

let authState: AuthState;
let accessibleBuildingsEnabled: boolean | undefined;
let broadcastsQueryArgs: { buildingId?: string; limit?: number; enabled?: boolean } | undefined;
let broadcastDetailArgs: { id: string; enabled?: boolean } | undefined;
let refetchMock: ReturnType<typeof vi.fn>;
type BroadcastItem = (typeof baseBroadcasts)[number];

const baseBroadcasts = [
    {
        id: "broadcast-1",
        title: "Water maintenance notice",
        body: "Water supply will pause from 10 AM to 12 PM.",
        buildingIds: ["building-1"],
        audiences: ["tenants"],
        metadata: {
            audiences: ["tenants"],
            scope: "single_building",
            buildingCount: 1,
            audienceSummary: "Tenants",
        },
        recipientCount: 42,
        sender: { id: "user-1", name: "Ahmed" },
        createdAt: "2026-04-11T10:00:00.000Z",
    },
    {
        id: "broadcast-2",
        title: "Staff security drill",
        body: "Staff should report to the lobby at 2 PM.",
        buildingIds: ["building-2"],
        audiences: ["staff"],
        metadata: {
            audiences: ["staff"],
            scope: "single_building",
            buildingCount: 1,
            audienceSummary: "Staff",
        },
        recipientCount: 9,
        sender: { id: "user-2", name: "Sara" },
        createdAt: "2026-04-10T09:00:00.000Z",
    },
    {
        id: "broadcast-3",
        title: "Portfolio update",
        body: "All users receive this general update.",
        buildingIds: [],
        audiences: ["all_users"],
        metadata: {
            audiences: ["all_users"],
            scope: "org_wide",
            buildingCount: 0,
            audienceSummary: "All users",
        },
        recipientCount: 60,
        sender: { id: "user-3", name: "Ops" },
        createdAt: "2026-04-09T08:00:00.000Z",
    },
];

let listQueryState: {
    data?: { items: BroadcastItem[]; nextCursor: string | null };
    isLoading: boolean;
    isError: boolean;
    isFetching: boolean;
    error?: Error;
};
let detailQueryState: {
    data: BroadcastItem | null;
    isLoading: boolean;
    isError: boolean;
};

async function loadBroadcastsPage(stateOverrides: BroadcastStateOverrides = {}) {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:3001/api");

    const actualReact = await vi.importActual<typeof import("react")>("react");
    const stateValues = [
        stateOverrides.selectedBroadcastId ?? "",
        stateOverrides.filterBuildingId ?? "all",
        stateOverrides.filterAudience ?? "all",
        stateOverrides.isBuildingFilterOpen ?? false,
        stateOverrides.isAudienceFilterOpen ?? false,
        stateOverrides.searchText ?? "",
        stateOverrides.renderCap ?? "12",
        stateOverrides.isComposerOpen ?? false,
        stateOverrides.title ?? "",
        stateOverrides.body ?? "",
        stateOverrides.sendToAll ?? true,
        stateOverrides.selectedBuildingIds ?? [],
        stateOverrides.selectedAudiences ?? ["tenants"],
        stateOverrides.isLoadingMore ?? false,
        stateOverrides.selectedTemplateId ?? "",
    ];
    let stateIndex = 0;

    vi.doMock("react", () => ({
        ...actualReact,
        useState: (initial: unknown) => {
            const actualState = actualReact.useState(initial);
            if (stateIndex < stateValues.length) {
                const value = stateValues[stateIndex++];
                return [value, vi.fn()] as const;
            }
            return actualState;
        },
    }));

    vi.doMock("@tanstack/react-query", () => ({
        useQueryClient: () => ({
            setQueryData: vi.fn(),
        }),
    }));

    vi.doMock("sonner", () => ({
        toast: {
            success: vi.fn(),
            error: vi.fn(),
        },
    }));

    vi.doMock("@/lib/auth", () => ({
        useAuth: () => authState,
    }));

    vi.doMock("@/lib/queries", () => ({
        useAccessibleBuildings: (_userId?: string, _baseRole?: string, options?: { enabled?: boolean }) => {
            accessibleBuildingsEnabled = options?.enabled;
            return {
                data: [
                    { id: "building-1", name: "Tower One" },
                    { id: "building-2", name: "Tower Two" },
                ],
            };
        },
        useBroadcasts: (options?: { buildingId?: string; limit?: number; enabled?: boolean }) => {
            broadcastsQueryArgs = options;
            return {
                data: listQueryState.data,
                isLoading: listQueryState.isLoading,
                isError: listQueryState.isError,
                isFetching: listQueryState.isFetching,
                error: listQueryState.error,
                refetch: refetchMock,
            };
        },
        useBroadcast: (id: string, options?: { enabled?: boolean }) => {
            broadcastDetailArgs = { id, enabled: options?.enabled };
            return detailQueryState;
        },
        useCreateBroadcast: () => ({
            isPending: false,
            mutateAsync: vi.fn(),
        }),
    }));

    return import("../../src/components/broadcasts/BroadcastsPage");
}

describe("BroadcastsPage workspace", () => {
    beforeEach(() => {
        authState = {
            user: {
                id: "user-1",
                effectivePermissions: ["broadcasts.read", "broadcasts.write"],
                buildingAccess: [{ assignmentId: "assignment-1", roleTemplateKey: "building_admin", scopeType: "BUILDING", scopeId: "building-1" }],
                orgAccess: [{ assignmentId: "assignment-org-1", roleTemplateKey: "org_admin", scopeType: "ORG", scopeId: null }],
            },
            baseRole: "org_admin",
        };
        accessibleBuildingsEnabled = undefined;
        broadcastsQueryArgs = undefined;
        broadcastDetailArgs = undefined;
        refetchMock = vi.fn();
        listQueryState = {
            data: { items: baseBroadcasts, nextCursor: null },
            isLoading: false,
            isError: false,
            isFetching: false,
        };
        detailQueryState = {
            data: null,
            isLoading: false,
            isError: false,
        };
    });

    it("renders the broadcast feed with the default empty detail state", async () => {
        const { BroadcastsPage } = await loadBroadcastsPage();
        const markup = renderToStaticMarkup(createElement(BroadcastsPage));

        expect(markup).toContain("Filter broadcasts");
        expect(markup).toContain("Bulletin log");
        expect(markup).toContain("Showing 3 of 3 announcements");
        expect(markup).toContain("Select an announcement to inspect delivery details.");
        expect(markup).toContain("New broadcast");
        expect(accessibleBuildingsEnabled).toBe(true);
        expect(broadcastsQueryArgs).toMatchObject({ buildingId: undefined, enabled: true, limit: 20 });
    }, 10000);

    it("renders the selected broadcast detail through the detail query", async () => {
        detailQueryState = {
            data: baseBroadcasts[1],
            isLoading: false,
            isError: false,
        };

        const { BroadcastsPage } = await loadBroadcastsPage({ selectedBroadcastId: "broadcast-2" });
        const markup = renderToStaticMarkup(createElement(BroadcastsPage));

        expect(markup).toContain("Announcement detail");
        expect(markup).toContain("Staff security drill");
        expect(markup).toContain("Staff should report to the lobby at 2 PM.");
        expect(markup).toContain("Tower Two");
        expect(markup).toContain("Sara");
        expect(markup).toContain("Single building");
        expect(markup).toContain("1 building");
        expect(broadcastDetailArgs).toEqual({ id: "broadcast-2", enabled: true });
    });

    it("applies the building filter to the list query and audience filter to the rendered feed", async () => {
        const { BroadcastsPage } = await loadBroadcastsPage({
            filterBuildingId: "building-1",
            filterAudience: "tenants",
        });
        const markup = renderToStaticMarkup(createElement(BroadcastsPage));

        expect(broadcastsQueryArgs).toMatchObject({ buildingId: "building-1", enabled: true });
        expect(markup).toContain("Tower One");
        expect(markup).toContain("Showing 1 of 1");
        expect(markup).not.toContain("Staff security drill");
    });

    it("applies local search and visible item cap states", async () => {
        listQueryState = {
            data: {
                items: [
                    ...baseBroadcasts,
                    ...Array.from({ length: 12 }, (_, index) => ({
                        id: `broadcast-extra-${index}`,
                        title: `Water follow-up ${index}`,
                        body: "Water update",
                        buildingIds: ["building-1"],
                        audiences: ["tenants"],
                        metadata: {
                            audiences: ["tenants"],
                            scope: "single_building",
                            buildingCount: 1,
                            audienceSummary: "Tenants",
                        },
                        recipientCount: 5,
                        sender: { id: `user-${index}`, name: "Ahmed" },
                        createdAt: "2026-04-08T08:00:00.000Z",
                    })),
                ],
                nextCursor: null,
            },
            isLoading: false,
            isError: false,
            isFetching: false,
        };

        const { BroadcastsPage } = await loadBroadcastsPage({
            searchText: "water",
            renderCap: "12",
        });
        const markup = renderToStaticMarkup(createElement(BroadcastsPage));

        expect(markup).toContain("Showing 12 of 13 announcements");
        expect(markup).toContain("1 hidden by display cap");
        expect(markup).not.toContain("Staff security drill");
        expect(markup).toContain("announcement");
    });

    it("renders no-results and detail error states", async () => {
        detailQueryState = {
            data: null,
            isLoading: false,
            isError: true,
        };

        const { BroadcastsPage } = await loadBroadcastsPage({
            selectedBroadcastId: "broadcast-404",
            searchText: "missing-topic",
        });
        const markup = renderToStaticMarkup(createElement(BroadcastsPage));

        expect(markup).toContain("No announcements match this search.");
        expect(markup).toContain("Announcement not found or not visible to this user.");
    });

    it("preserves permission gating for read-only and no-access users", async () => {
        authState = {
            user: {
                id: "user-2",
                effectivePermissions: ["broadcasts.read"],
                buildingAccess: [],
                orgAccess: [],
            },
            baseRole: "manager",
        };

        const { BroadcastsPage: ReadOnlyPage } = await loadBroadcastsPage();
        const readOnlyMarkup = renderToStaticMarkup(createElement(ReadOnlyPage));
        expect(readOnlyMarkup).not.toContain("New broadcast");

        authState = {
            user: {
                id: "user-3",
                effectivePermissions: [],
                buildingAccess: [],
                orgAccess: [],
            },
            baseRole: "manager",
        };

        const { BroadcastsPage: NoAccessPage } = await loadBroadcastsPage();
        const noAccessMarkup = renderToStaticMarkup(createElement(NoAccessPage));
        expect(noAccessMarkup).toContain("You do not have permission to view broadcasts.");
        expect(accessibleBuildingsEnabled).toBe(false);
        expect(broadcastsQueryArgs).toMatchObject({ enabled: false });
    });
});
