import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProvidersManagementPage } from "../../src/components/providers/ProvidersManagementPage";

let authState: any;
let providersData: any[] = [];
let selectedProviderData: any = null;
let accessibleBuildingsData: any[] = [];

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock("@/lib/auth", () => ({
    useAuth: () => authState,
}));

vi.mock("@/lib/rbac", () => ({
    hasPermission: (user: any, key: string) => Boolean(user?.effectivePermissions?.includes(key)),
}));

vi.mock("@/lib/queries", () => ({
    useServiceProviders: () => ({
        data: providersData,
        isLoading: false,
        isError: false,
        error: null,
    }),
    useServiceProvider: () => ({
        data: selectedProviderData,
        isLoading: false,
    }),
    useServiceProviderAccessGrants: () => ({
        data: selectedProviderData?.providerAdminAccessGrants ?? [],
        isLoading: false,
    }),
    useAccessibleBuildings: () => ({
        data: accessibleBuildingsData,
        isLoading: false,
    }),
    useCreateServiceProvider: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useUpdateServiceProvider: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useLinkServiceProviderBuilding: () => ({ mutateAsync: vi.fn() }),
    useUnlinkServiceProviderBuilding: () => ({ mutateAsync: vi.fn() }),
    useCreateServiceProviderAccessGrant: () => ({ mutateAsync: vi.fn() }),
    useResendServiceProviderAccessGrantInvite: () => ({ mutateAsync: vi.fn() }),
    useDisableServiceProviderAccessGrant: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/components/ui/button", () => ({
    Button: ({ children, disabled, ...props }: any) =>
        createElement("button", { ...props, "data-disabled": disabled ? "true" : "false" }, children),
}));

vi.mock("@/components/ui/badge", () => ({
    Badge: ({ children, ...props }: any) => createElement("span", props, children),
}));

vi.mock("@/components/ui/input", () => ({
    Input: (props: any) => createElement("input", props),
}));

vi.mock("@/components/ui/textarea", () => ({
    Textarea: (props: any) => createElement("textarea", props),
}));

vi.mock("@/components/ui/select", () => ({
    Select: ({ children }: any) => createElement("div", { "data-slot": "select" }, children),
    SelectTrigger: ({ children, disabled }: any) =>
        createElement("button", { "data-slot": "select-trigger", "data-disabled": disabled ? "true" : "false" }, children),
    SelectValue: ({ placeholder }: any) => createElement("span", null, placeholder ?? ""),
    SelectContent: ({ children }: any) => createElement("div", { "data-slot": "select-content" }, children),
    SelectItem: ({ children, disabled, value }: any) =>
        createElement("div", { "data-slot": "select-item", "data-disabled": disabled ? "true" : "false", "data-value": value }, children),
}));

vi.mock("@/components/ui/sheet", () => ({
    Sheet: ({ children }: any) => createElement("div", { "data-slot": "sheet" }, children),
    SheetContent: ({ children }: any) => createElement("div", { "data-slot": "sheet-content" }, children),
    SheetHeader: ({ children }: any) => createElement("div", { "data-slot": "sheet-header" }, children),
    SheetTitle: ({ children }: any) => createElement("h2", null, children),
    SheetDescription: ({ children }: any) => createElement("p", null, children),
}));

vi.mock("@/components/ui/table", () => ({
    Table: ({ children }: any) => createElement("table", null, children),
    TableHeader: ({ children }: any) => createElement("thead", null, children),
    TableBody: ({ children }: any) => createElement("tbody", null, children),
    TableRow: ({ children }: any) => createElement("tr", null, children),
    TableHead: ({ children }: any) => createElement("th", null, children),
    TableCell: ({ children, colSpan }: any) => createElement("td", { colSpan }, children),
}));

describe("ProvidersManagementPage render", () => {
    beforeEach(() => {
        authState = {
            user: {
                id: "user-1",
                effectivePermissions: ["serviceProviders.read", "serviceProviders.write"],
            },
            baseRole: "admin",
        };
        providersData = [];
        selectedProviderData = null;
        accessibleBuildingsData = [{ id: "building-1", name: "Tower One" }];
    });

    it("renders the empty state for providers list", () => {
        const markup = renderToStaticMarkup(createElement(ProvidersManagementPage));

        expect(markup).toContain("Providers");
        expect(markup).toContain("No providers found.");
    });

    it("renders the primary providers management actions", () => {
        const markup = renderToStaticMarkup(createElement(ProvidersManagementPage));

        expect(markup).toContain("Add Provider");
        expect(markup).toContain("Provider Directory");
        expect(markup).toContain("Search providers");
    });

    it("renders provider directory rows", () => {
        providersData = [{
            id: "provider-1",
            name: "RapidFix Technical Services",
            serviceCategory: "Plumbing",
            contactName: "Nadia Khan",
            contactEmail: "ops@rapidfix.test",
            contactPhone: "+971500000000",
            notes: "24/7 emergency coverage",
            isActive: true,
            linkedBuildings: [{ buildingId: "building-1", buildingName: "Tower One" }],
            providerAdminAccessGrants: [],
        }];
        selectedProviderData = providersData[0];

        const markup = renderToStaticMarkup(createElement(ProvidersManagementPage));

        expect(markup).toContain("RapidFix Technical Services");
        expect(markup).toContain("Plumbing");
        expect(markup).toContain("24/7 emergency coverage");
        expect(markup).toContain("Open");
    });

    it("renders the missing-permission state", () => {
        authState = {
            user: {
                id: "user-1",
                effectivePermissions: [],
            },
            baseRole: "manager",
        };

        const markup = renderToStaticMarkup(createElement(ProvidersManagementPage));

        expect(markup).toContain("You do not have permission to view service providers.");
    });
});
