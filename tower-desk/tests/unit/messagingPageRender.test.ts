import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadMessagingPage() {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:3001/api");
    return import("../../src/components/messaging/MessagingPage");
}

let authState: any = {
    user: {
        id: "user-1",
        effectivePermissions: ["messaging.write"],
        buildingAccess: [{ assignmentId: "assignment-1", roleTemplateKey: "building_admin", scopeType: "BUILDING", scopeId: "building-1" }],
    },
    token: "token-1",
    baseRole: "building_admin",
    selectedOrgId: "org-1",
};
let orgResidentsEnabled: boolean | undefined;
let conversationsEnabled: boolean | undefined;
let buildingResidentsEnabled: boolean | undefined;
let accessibleBuildingsEnabled: boolean | undefined;

vi.mock("@tanstack/react-query", () => ({
    useQueries: () => [],
    useQueryClient: () => ({
        invalidateQueries: vi.fn(),
        setQueryData: vi.fn(),
    }),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
    }),
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock("@/lib/auth", () => ({
    useAuth: () => authState,
}));

vi.mock("@/lib/permissions", () => ({
    getUserPermissionSet: () => new Set(["messaging.write"]),
    hasPermission: (permissionSet: Set<string>, key?: string | null) => Boolean(key && permissionSet.has(String(key).toLowerCase())),
    hasPermissionPrefix: (permissionSet: Set<string>, prefix?: string | null) => {
        const normalized = String(prefix ?? "").toLowerCase();
        if (!normalized) return false;
        if (permissionSet.has(normalized)) return true;
        const token = `${normalized}.`;
        for (const entry of permissionSet) {
            if (entry.startsWith(token)) return true;
        }
        return false;
    },
}));

vi.mock("@/lib/notificationsSocket", () => ({
    connectNotificationsSocket: () => null,
}));

vi.mock("@/lib/api/communications", () => ({
    getConversations: vi.fn(),
}));

vi.mock("@/lib/queries", () => ({
    useAccessibleBuildings: (_userId?: string, _baseRole?: string, options?: { enabled?: boolean }) => {
        accessibleBuildingsEnabled = options?.enabled;
        return {
        data: [{ id: "building-1", name: "Tower One" }],
        isLoading: false,
        };
    },
    useBuildingResidents: (_buildingId?: string, options?: { enabled?: boolean }) => {
        buildingResidentsEnabled = options?.enabled;
        return { data: [], isLoading: false };
    },
    useConversations: (options?: { enabled?: boolean }) => {
        conversationsEnabled = options?.enabled;
        return { data: { items: [], nextCursor: null }, isLoading: false, refetch: vi.fn() };
    },
    useConversation: () => ({ data: null, isLoading: false }),
    useCreateConversation: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useSendConversationMessage: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useOwnerAccessGrants: () => ({ data: [], isLoading: false, isFetching: false }),
    useOwners: () => ({ data: [], isLoading: false }),
    useOrgResidents: (_params?: unknown, options?: { enabled?: boolean }) => {
        orgResidentsEnabled = options?.enabled;
        return { data: { items: [] }, isLoading: false };
    },
    useMarkConversationRead: () => ({ isPending: false, mutate: vi.fn() }),
}));

describe("MessagingPage scope", () => {
    beforeEach(() => {
        authState = {
            user: {
                id: "user-1",
                effectivePermissions: ["messaging.write"],
                buildingAccess: [{ assignmentId: "assignment-1", roleTemplateKey: "building_admin", scopeType: "BUILDING", scopeId: "building-1" }],
            },
            token: "token-1",
            baseRole: "building_admin",
            selectedOrgId: "org-1",
        };
        orgResidentsEnabled = undefined;
        conversationsEnabled = undefined;
        buildingResidentsEnabled = undefined;
        accessibleBuildingsEnabled = undefined;
    });

    it("disables org-wide resident search for building admins", async () => {
        const { MessagingPage } = await loadMessagingPage();
        renderToStaticMarkup(createElement(MessagingPage));

        expect(orgResidentsEnabled).toBe(false);
        expect(buildingResidentsEnabled).toBe(false);
        expect(accessibleBuildingsEnabled).toBe(true);
        expect(conversationsEnabled).toBe(true);
    }, 10000);

    it("defers org-wide resident search until the composer opens for org admins", async () => {
        authState = {
            user: {
                id: "user-1",
                effectivePermissions: ["messaging.write"],
                orgAccess: [{ assignmentId: "assignment-org-1", roleTemplateKey: "org_admin", scopeType: "ORG", scopeId: null }],
                buildingAccess: [],
            },
            token: "token-1",
            baseRole: "org_admin",
            selectedOrgId: "org-1",
        };

        const { MessagingPage } = await loadMessagingPage();
        renderToStaticMarkup(createElement(MessagingPage));

        expect(orgResidentsEnabled).toBe(false);
    }, 10000);

    it("disables messaging queries when the user has no messaging permissions", async () => {
        authState = {
            user: {
                id: "user-2",
                effectivePermissions: [],
                orgAccess: [],
                buildingAccess: [],
            },
            token: "token-2",
            baseRole: "manager",
            selectedOrgId: "org-1",
        };

        const { MessagingPage } = await loadMessagingPage();
        renderToStaticMarkup(createElement(MessagingPage));

        expect(conversationsEnabled).toBe(false);
        expect(orgResidentsEnabled).toBe(false);
        expect(buildingResidentsEnabled).toBe(false);
        expect(accessibleBuildingsEnabled).toBe(false);
    }, 10000);
});
