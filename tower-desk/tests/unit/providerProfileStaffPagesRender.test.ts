import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProviderProfilePage } from "../../src/components/provider-portal/ProviderProfilePage";
import { ProviderStaffPage } from "../../src/components/provider-portal/ProviderStaffPage";

let authState: any;
let providerRuntimeContext: any = null;
let providerProfile: any = null;
let providerStaff: any[] = [];

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock("@/lib/auth", () => ({
    useAuth: () => authState,
}));

vi.mock("@/lib/queries", () => ({
    useProviderRuntimeContext: () => ({
        data: providerRuntimeContext,
        isLoading: false,
    }),
    useProviderProfile: () => ({
        data: providerProfile,
        isLoading: false,
    }),
    useUpdateProviderProfile: () => ({
        isPending: false,
        mutateAsync: vi.fn(),
    }),
    useProviderStaff: () => ({
        data: providerStaff,
        isLoading: false,
    }),
    useCreateProviderStaff: () => ({
        isPending: false,
        mutateAsync: vi.fn(),
    }),
    useUpdateProviderStaff: () => ({
        isPending: false,
        mutateAsync: vi.fn(),
    }),
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
    SelectTrigger: ({ children }: any) => createElement("button", { "data-slot": "select-trigger" }, children),
    SelectValue: ({ placeholder }: any) => createElement("span", null, placeholder ?? ""),
    SelectContent: ({ children }: any) => createElement("div", { "data-slot": "select-content" }, children),
    SelectItem: ({ children, value }: any) => createElement("div", { "data-value": value }, children),
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

describe("provider profile and staff pages", () => {
    beforeEach(() => {
        authState = { baseRole: "service_provider" };
        providerRuntimeContext = {
            userId: "provider-admin-1",
            email: "admin@rapidfix.test",
            providers: [{ providerId: "provider-1", name: "RapidFix Technical Services", role: "ADMIN", membershipIsActive: true }],
        };
        providerProfile = {
            id: "provider-1",
            name: "RapidFix Technical Services",
            serviceCategory: "Plumbing",
            contactEmail: "ops@rapidfix.test",
            isActive: true,
        };
        providerStaff = [
            {
                userId: "worker-1",
                email: "worker@rapidfix.test",
                name: "Provider Worker",
                role: "WORKER",
                membershipIsActive: true,
                userIsActive: true,
                mustChangePassword: true,
            },
        ];
    });

    it("renders the provider profile form for a single provider context", () => {
        const markup = renderToStaticMarkup(createElement(ProviderProfilePage));

        expect(markup).toContain("Provider profile");
        expect(markup).toContain("RapidFix Technical Services");
        expect(markup).toContain("Save profile");
    });

    it("renders the provider staff list and create action for provider admins", () => {
        const markup = renderToStaticMarkup(createElement(ProviderStaffPage));

        expect(markup).toContain("Provider staff");
        expect(markup).toContain("Add staff");
        expect(markup).toContain("Provider Worker");
        expect(markup).toContain("Make admin");
    });

    it("shows the provider-selection block when multiple providers are accessible", () => {
        providerRuntimeContext = {
            userId: "provider-admin-1",
            providers: [
                { providerId: "provider-1", name: "RapidFix", role: "ADMIN", membershipIsActive: true },
                { providerId: "provider-2", name: "SparkFix", role: "ADMIN", membershipIsActive: true },
            ],
        };

        const profileMarkup = renderToStaticMarkup(createElement(ProviderProfilePage));
        const staffMarkup = renderToStaticMarkup(createElement(ProviderStaffPage));

        expect(profileMarkup).toContain("Provider selection required");
        expect(staffMarkup).toContain("Provider selection required");
    });
});
