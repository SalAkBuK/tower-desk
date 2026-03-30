import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { UsersTable } from "../../src/components/users/UsersTable";

describe("UsersTable", () => {
    it("shows only the assigned template name when present", () => {
        const markup = renderToStaticMarkup(
            createElement(UsersTable, {
                users: [
                    {
                        id: "user-1",
                        name: "Taylor User",
                        email: "taylor@example.com",
                        role: "manager",
                        baseRole: "manager",
                        buildingIds: ["building-1"],
                        assignedRoles: [
                            {
                                id: "role-1",
                                key: "custom_role_key",
                                name: "Custom Role",
                            },
                        ],
                    },
                ],
                isLoading: false,
                buildingNameById: {
                    "building-1": "Tower One",
                },
            })
        );

        expect(markup).toContain("Custom Role");
        expect(markup).toContain("Tower One");
        expect(markup).not.toContain(">Manager<");
    });
});
