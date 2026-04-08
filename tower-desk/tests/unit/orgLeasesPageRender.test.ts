import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrgLeasesPage } from "../../src/components/leases/OrgLeasesPage";

let search = "";
let permissionKeys = new Set<string>(["contracts.write"]);
let authState = {
    user: { id: "user-1" },
    baseRole: "manager",
};
let moveInRequests: any[] = [];
let moveOutRequests: any[] = [];

const normalize = (value?: string | null) => String(value ?? "").trim().toLowerCase();

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
    useAuth: () => authState,
}));

vi.mock("@/lib/permissions", () => ({
    getUserPermissionSet: () => permissionKeys,
    hasAnyPermission: (permissionSet: Set<string>, options?: { keys?: string[]; prefixes?: string[] }) => {
        if (!options) return false;
        for (const key of options.keys ?? []) {
            const normalized = normalize(key);
            if (normalized && permissionSet.has(normalized)) return true;
        }
        for (const prefix of options.prefixes ?? []) {
            const normalized = normalize(prefix);
            if (!normalized) continue;
            if (permissionSet.has(normalized)) return true;
            const token = `${normalized}.`;
            for (const entry of permissionSet) {
                if (entry.startsWith(token)) return true;
            }
        }
        return false;
    },
    hasPermission: (permissionSet: Set<string>, key?: string | null) => {
        const normalized = normalize(key);
        return normalized ? permissionSet.has(normalized) : false;
    },
    hasPermissionPrefix: (permissionSet: Set<string>, prefix?: string | null) => {
        const normalized = normalize(prefix);
        if (!normalized) return false;
        if (permissionSet.has(normalized)) return true;
        const token = `${normalized}.`;
        for (const entry of permissionSet) {
            if (entry.startsWith(token)) return true;
        }
        return false;
    },
}));

vi.mock("@/components/leases/AddContractDialog", () => ({
    AddContractDialog: () => null,
}));

vi.mock("@/components/leases/EditLeaseDialog", () => ({
    EditLeaseDialog: () => null,
}));

vi.mock("@/lib/queries", () => ({
    useActivateContract: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useApproveMoveInRequest: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useApproveMoveOutRequest: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useAccessibleBuildings: () => ({ data: [{ id: "building-1", name: "Tower One" }] }),
    useCancelContract: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useCreateMoveInRequest: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useCreateMoveOutRequest: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useExecuteMoveIn: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useExecuteMoveOut: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useLatestContractForResident: () => ({ data: null, isLoading: false, refetch: vi.fn() }),
    useMoveInRequests: () => ({ data: moveInRequests, isLoading: false, isError: false, refetch: vi.fn() }),
    useMoveOutRequests: () => ({ data: moveOutRequests, isLoading: false, isError: false, refetch: vi.fn() }),
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
        permissionKeys = new Set(["contracts.write"]);
        authState = {
            user: { id: "user-1" },
            baseRole: "manager",
        };
        moveInRequests = [];
        moveOutRequests = [];
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

    it("keeps building admins able to open contract creation for an assigned building", () => {
        authState = {
            user: { id: "user-1" },
            baseRole: "building_admin",
        };
        permissionKeys = new Set();

        const markup = renderToStaticMarkup(createElement(OrgLeasesPage));

        expect(markup).toContain("Add Contract");
        expect(markup).not.toContain("Select a building to enable contract creation for that building.");
    });

    it("keeps move-request queues visible for building admins without broad contracts.write", () => {
        authState = {
            user: { id: "user-1" },
            baseRole: "building_admin",
        };
        permissionKeys = new Set();
        search = "tab=pending";

        const markup = renderToStaticMarkup(createElement(OrgLeasesPage));

        expect(markup).toContain("Move Requests Queue");
    });

    it("hides approve and reject actions when move-request review permission is missing", () => {
        authState = {
            user: { id: "user-1" },
            baseRole: "building_admin",
        };
        permissionKeys = new Set(["contracts.read"]);
        search = "tab=pending";
        moveInRequests = [{
            id: "req-1",
            residentUserId: "resident-1",
            buildingId: "building-1",
            unitId: "unit-1",
            status: "PENDING",
            requestedMoveAt: "2026-03-30T10:00:00.000Z",
            createdAt: "2026-03-30T10:00:00.000Z",
            updatedAt: "2026-03-30T10:00:00.000Z",
            resident: { name: "Resident One" },
            unit: { label: "101" },
        }];

        const markup = renderToStaticMarkup(createElement(OrgLeasesPage));

        expect(markup).toContain("Resident One");
        expect(markup).not.toContain("Approve");
        expect(markup).not.toContain("Reject");
    });

    it("shows approve and reject actions when move-request review permission is present", () => {
        permissionKeys = new Set(["contracts.move_requests.review"]);
        search = "tab=pending";
        moveInRequests = [{
            id: "req-1",
            residentUserId: "resident-1",
            buildingId: "building-1",
            unitId: "unit-1",
            status: "PENDING",
            requestedMoveAt: "2026-03-30T10:00:00.000Z",
            createdAt: "2026-03-30T10:00:00.000Z",
            updatedAt: "2026-03-30T10:00:00.000Z",
            resident: { name: "Resident One" },
            unit: { label: "101" },
        }];

        const markup = renderToStaticMarkup(createElement(OrgLeasesPage));

        expect(markup).toContain("Approve");
        expect(markup).toContain("Reject");
    });
});
