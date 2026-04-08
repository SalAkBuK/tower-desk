import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Sidebar } from "../../src/components/layout/Sidebar";

let authState: any;
let pathname = "/portal/dashboard";

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
    useOrgProfile: () => ({ data: null }),
    useAccessibleBuildings: () => ({ data: [] }),
    useAdminRequests: () => ({ data: [] }),
    useConversations: () => ({ data: { items: [] } }),
    usePendingContractMoveRequestsCount: () => ({ data: 0 }),
    useProviderRuntimeContext: () => ({ data: null, isLoading: false }),
    useProviderRequestUnreadCount: () => ({ data: 0 }),
    useOwnerRequestCommentUnreadCount: () => ({ data: 4 }),
    useOwnerConversationUnreadCount: () => ({ data: 2 }),
    useOwnerNotificationUnreadCount: () => ({ data: 5 }),
}));

vi.mock("@/components/ui/button", () => ({
    Button: ({ children, ...props }: any) => createElement("button", props, children),
}));

describe("Sidebar owner rendering", () => {
    beforeEach(() => {
        authState = {
            role: "owner",
            baseRole: "owner",
            logout: vi.fn(),
            user: {
                id: "owner-user-1",
                role: "owner",
                baseRole: "owner",
                effectivePermissions: [],
            },
        };
        pathname = "/portal/dashboard";
    });

    it("shows owner routes and unread badges", () => {
        const markup = renderToStaticMarkup(createElement(Sidebar));

        expect(markup).toContain("/portal/dashboard");
        expect(markup).toContain("/portal/requests");
        expect(markup).toContain("/portal/messages");
        expect(markup).toContain("/portal/notifications");
        expect(markup).toContain(">4<");
        expect(markup).toContain(">2<");
        expect(markup).toContain(">5<");
    });
});
