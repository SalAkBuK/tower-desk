import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrgLeasesPage } from "../../src/components/leases/OrgLeasesPage";

let search = "";

vi.mock("next/link", () => ({
    default: ({ children, href }: { children: unknown; href: string }) => createElement("a", { href }, children as any),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
    }),
    usePathname: () => "/portal/contracts",
    useSearchParams: () => new URLSearchParams(search),
}));

vi.mock("@/lib/auth", () => ({
    useAuth: () => ({
        user: { id: "user-1" },
        baseRole: "manager",
    }),
}));

vi.mock("@/lib/permissions", () => ({
    getUserPermissionSet: () => ["contracts.write"],
    hasPermission: () => true,
    hasPermissionPrefix: () => true,
}));

vi.mock("@/components/leases/AddContractDialog", () => ({
    AddContractDialog: () => null,
}));

vi.mock("@/components/leases/EditLeaseDialog", () => ({
    EditLeaseDialog: () => null,
}));

vi.mock("@/lib/queries", () => ({
    useActivateContract: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useAdminBuildings: () => ({ data: [{ id: "building-1", name: "Tower One" }] }),
    useApproveMoveInRequest: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useApproveMoveOutRequest: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useCancelContract: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useCreateMoveInRequest: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useCreateMoveOutRequest: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useExecuteMoveIn: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useExecuteMoveOut: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useLatestContractForResident: () => ({ data: null, isLoading: false, refetch: vi.fn() }),
    useManagerBuildings: () => ({ data: [{ id: "building-1", name: "Tower One" }] }),
    useMoveInRequests: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
    useMoveOutRequests: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
    useOrgLeases: () => ({
        data: { items: [], nextCursor: null },
        isLoading: false,
        isError: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
    }),
    useRejectMoveInRequest: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useRejectMoveOutRequest: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

describe("OrgLeasesPage render paths", () => {
    beforeEach(() => {
        search = "";
    });

    it("renders the leases tab empty state for /portal/contracts", () => {
        const markup = renderToStaticMarkup(createElement(OrgLeasesPage));

        expect(markup).toContain("No contracts match the current filters.");
    });

    it("renders the pending tab empty state when tab=pending", () => {
        search = "tab=pending";
        const markup = renderToStaticMarkup(createElement(OrgLeasesPage));

        expect(markup).toContain("Move Requests Queue");
        expect(markup).toContain("No move-in requests found for the selected filters.");
    });

    it("renders the execute move-in tab empty state when tab=execute-move-in", () => {
        search = "tab=execute-move-in";
        const markup = renderToStaticMarkup(createElement(OrgLeasesPage));

        expect(markup).toContain("Execute Move-In Queue");
        expect(markup).toContain("No approved move-in requests are waiting for execution.");
    });
});
