import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Sidebar } from "../../src/components/layout/Sidebar";

let authState: any;
let pathname = "/portal/dashboard";
let providerRuntimeContext: any = null;
let providerUnreadCount = 0;

vi.mock("next/link", () => ({
    default: ({ children, href, ...props }: any) => createElement("a", { href, ...props }, children),
}));

vi.mock("next/navigation", () => ({
    usePathname: () => pathname,
}));

vi.mock("@/lib/auth", () => ({
    useAuth: () => authState,
}));

vi.mock("@/lib/queries", () => ({
    useOrgProfile: () => ({
        data: { name: "TowerDesk" },
    }),
    useAccessibleBuildings: () => ({
        data: [],
    }),
    useAdminRequests: () => ({
        data: [],
    }),
    useConversations: () => ({
        data: { items: [] },
    }),
    usePendingContractMoveRequestsCount: () => ({
        data: 0,
    }),
    useProviderRuntimeContext: () => ({
        data: providerRuntimeContext,
        isLoading: false,
    }),
    useProviderRequestUnreadCount: (options?: { enabled?: boolean }) => ({
        data: options?.enabled === false ? undefined : providerUnreadCount,
    }),
    useOwnerRequestCommentUnreadCount: () => ({
        data: 0,
    }),
    useOwnerConversationUnreadCount: () => ({
        data: 0,
    }),
    useOwnerNotificationUnreadCount: () => ({
        data: 0,
    }),
}));

vi.mock("@/components/ui/button", () => ({
    Button: ({ children, ...props }: any) => createElement("button", props, children),
}));

describe("Sidebar provider rendering", () => {
    beforeEach(() => {
        authState = {
            role: "service_provider",
            baseRole: "service_provider",
            logout: vi.fn(),
            user: {
                id: "provider-user-1",
                role: "service_provider",
                baseRole: "service_provider",
                effectivePermissions: ["dashboard.read", "requests.write"],
            },
        };
        pathname = "/portal/dashboard";
        providerUnreadCount = 4;
        providerRuntimeContext = {
            userId: "provider-user-1",
            providers: [
                {
                    providerId: "provider-1",
                    name: "RapidFix Technical Services",
                    role: "ADMIN",
                    membershipIsActive: true,
                },
            ],
        };
    });

    it("shows provider profile, staff, and unread badge for single-provider users", () => {
        const markup = renderToStaticMarkup(createElement(Sidebar));

        expect(markup).toContain("/portal/dashboard");
        expect(markup).toContain("/portal/requests");
        expect(markup).toContain("/portal/profile");
        expect(markup).toContain("/portal/staff");
        expect(markup).toContain(">4<");
    });

    it("hides provider profile and staff for multi-provider users", () => {
        providerRuntimeContext = {
            userId: "provider-user-1",
            providers: [
                { providerId: "provider-1", name: "RapidFix", role: "ADMIN", membershipIsActive: true },
                { providerId: "provider-2", name: "SparkFix", role: "ADMIN", membershipIsActive: true },
            ],
        };
        providerUnreadCount = 99;

        const markup = renderToStaticMarkup(createElement(Sidebar));

        expect(markup).toContain("/portal/dashboard");
        expect(markup).toContain("/portal/requests");
        expect(markup).not.toContain("/portal/profile");
        expect(markup).not.toContain("/portal/staff");
        expect(markup).not.toContain(">99<");
    });
});
