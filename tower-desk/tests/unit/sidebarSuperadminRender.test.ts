import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Sidebar } from "../../src/components/layout/Sidebar";

let authState: any;
let pathname = "/platform/orgs";

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
    useOwnerRequestCommentUnreadCount: () => ({ data: 0 }),
    useOwnerConversationUnreadCount: () => ({ data: 0 }),
    useOwnerNotificationUnreadCount: () => ({ data: 0 }),
}));

vi.mock("@/components/ui/button", () => ({
    Button: ({ children, ...props }: any) => createElement("button", props, children),
}));

describe("Sidebar superadmin rendering", () => {
    beforeEach(() => {
        authState = {
            role: "superadmin",
            baseRole: "superadmin",
            logout: vi.fn(),
            user: {
                id: "superadmin-1",
                role: "superadmin",
                baseRole: "superadmin",
                effectivePermissions: ["platform.delivery_tasks.read"],
            },
        };
        pathname = "/platform/delivery-tasks";
    });

    it("shows delivery tasks when the read permission exists", () => {
        const markup = renderToStaticMarkup(createElement(Sidebar));

        expect(markup).toContain(">Main<");
        expect(markup).toContain("/platform/orgs");
        expect(markup).toContain("/platform/delivery-tasks");
        expect(markup).toContain("/platform/permissions");
        expect(markup).not.toContain("/platform/users");
        expect(markup).not.toContain("/platform/requests");
        expect(markup).not.toContain("/platform/buildings");
    });

    it("hides delivery tasks when the read permission is missing", () => {
        authState.user.effectivePermissions = [];

        const markup = renderToStaticMarkup(createElement(Sidebar));

        expect(markup).toContain("/platform/orgs");
        expect(markup).not.toContain("/platform/delivery-tasks");
        expect(markup).toContain("/platform/permissions");
        expect(markup).not.toContain("/platform/users");
        expect(markup).not.toContain("/platform/requests");
        expect(markup).not.toContain("/platform/buildings");
    });

    it("renders a collapsed rail with accessible labels instead of visible nav text", () => {
        const markup = renderToStaticMarkup(createElement(Sidebar, {
            collapsed: true,
            allowCollapse: true,
            onToggleCollapse: vi.fn(),
        }));

        expect(markup).toContain('aria-label="Organizations"');
        expect(markup).toContain('title="Organizations"');
        expect(markup).toContain('aria-label="Expand sidebar"');
        expect(markup).not.toContain(">Organizations<");
        expect(markup).not.toContain(">Main<");
    });
});
