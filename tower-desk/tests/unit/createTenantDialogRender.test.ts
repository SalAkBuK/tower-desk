import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock("@/components/ui/dialog", () => ({
    Dialog: ({ children }: { children: ReactNode }) => createElement("div", null, children),
    DialogContent: ({ children, className }: { children: ReactNode; className?: string }) => createElement("div", { className }, children),
    DialogFooter: ({ children, className }: { children: ReactNode; className?: string }) => createElement("div", { className }, children),
    DialogHeader: ({ children, className }: { children: ReactNode; className?: string }) => createElement("div", { className }, children),
    DialogTitle: ({ children, className }: { children: ReactNode; className?: string }) => createElement("h2", { className }, children),
    DialogDescription: ({ children, className }: { children: ReactNode; className?: string }) => createElement("p", { className }, children),
}));

vi.mock("@/lib/queries", () => ({
    useCreateResidentWithProfile: () => ({
        isPending: false,
        mutateAsync: vi.fn(),
    }),
}));

const { CreateTenantDialog } = await import("../../src/components/residents/CreateTenantDialog");

describe("CreateTenantDialog render", () => {
    it("marks the tenant creation form to avoid browser credential autofill", () => {
        const markup = renderToStaticMarkup(createElement(CreateTenantDialog, {
            open: true,
            onOpenChange: vi.fn(),
        }));

        expect(markup).toContain('<form class="space-y-4" autoComplete="off">');
        expect(markup).toContain('placeholder="OptionalPassword123"');
        expect(markup).toContain('autoComplete="new-password"');
        expect(markup).toContain('autoComplete="current-password"');
    });
});
