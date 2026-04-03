import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PortalBuildingsPage } from "../../src/components/buildings/PortalBuildingsPage";

let authState = {
    user: { id: "user-1", buildingIds: ["building-1"] },
    baseRole: "building_admin",
    login: vi.fn(),
    token: "token-1",
};

vi.mock("next/link", () => ({
    default: ({ children, href }: { children: unknown; href: string }) => createElement("a", { href }, children as any),
}));

vi.mock("@tanstack/react-query", () => ({
    useQueries: () => [
        { data: [{ id: "unit-1" }, { id: "unit-2" }, { id: "unit-3" }], isLoading: false },
    ],
}));

vi.mock("@/lib/api/units", () => ({
    getBuildingUnits: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
    useAuth: () => authState,
}));

vi.mock("@/components/buildings/CreateBuildingSheet", () => ({
    CreateBuildingSheet: () => null,
}));

vi.mock("@/lib/queries", () => ({
    useAccessibleBuildings: () => ({
        data: [{ id: "building-1", name: "Tower One", status: "active", unitsCount: 12 }],
        isLoading: false,
    }),
    useAdminRequests: () => ({ data: [] }),
    useAdminUsers: () => ({ data: [] }),
}));

describe("PortalBuildingsPage", () => {
    beforeEach(() => {
        authState = {
            user: { id: "user-1", buildingIds: ["building-1"] },
            baseRole: "building_admin",
            login: vi.fn(),
            token: "token-1",
        };
    });

    it("hides building creation for building-scoped roles", () => {
        const markup = renderToStaticMarkup(createElement(PortalBuildingsPage));

        expect(markup).not.toContain("Create Building");
    });

    it("shows building creation for org admins", () => {
        authState = {
            ...authState,
            baseRole: "org_admin",
        };

        const markup = renderToStaticMarkup(createElement(PortalBuildingsPage));

        expect(markup).toContain("Create Building");
    });
});
