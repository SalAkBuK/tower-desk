"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { BuildingDetails } from "@/components/buildings/BuildingDetails";
import { resolvePortalRoute } from "@/lib/portalRoute";
import { getPortalRenderDescriptor } from "@/lib/portalRegistry";
import { normalizeToPortalPath } from "@/lib/portalPaths";
import { logPortalEvent } from "@/lib/portalTelemetry";
import AdminRequestsPage from "@/app/(dashboard)/admin/requests/page";
import ManagerRequestsPage from "@/app/(dashboard)/manager/requests/page";
import AdminResidentsPage from "@/app/(dashboard)/admin/residents/page";
import ManagerResidentsPage from "@/app/(dashboard)/manager/residents/page";
import AdminContractsPage from "@/app/(dashboard)/admin/contracts/page";
import ManagerContractsPage from "@/app/(dashboard)/manager/contracts/page";
import AdminContractMoveInPage from "@/app/(dashboard)/admin/contracts/move-in/page";
import ManagerContractMoveInPage from "@/app/(dashboard)/manager/contracts/move-in/page";
import AdminContractDetailPage from "@/app/(dashboard)/admin/contracts/[contractId]/page";
import ManagerContractDetailPage from "@/app/(dashboard)/manager/contracts/[contractId]/page";
import AdminLeasesPage from "@/app/(dashboard)/admin/leases/page";
import ManagerLeasesPage from "@/app/(dashboard)/manager/leases/page";
import AdminLeaseMoveInPage from "@/app/(dashboard)/admin/leases/move-in/page";
import ManagerLeaseMoveInPage from "@/app/(dashboard)/manager/leases/move-in/page";
import AdminLeaseDetailPage from "@/app/(dashboard)/admin/leases/[leaseId]/page";
import ManagerLeaseDetailPage from "@/app/(dashboard)/manager/leases/[leaseId]/page";
import AdminOccupancyPage from "@/app/(dashboard)/admin/occupancy/page";
import ManagerOccupancyPage from "@/app/(dashboard)/manager/occupancy/page";
import AdminVisitorsPage from "@/app/(dashboard)/admin/visitors/page";
import ManagerVisitorsPage from "@/app/(dashboard)/manager/visitors/page";
import AdminMessagesPage from "@/app/(dashboard)/admin/messages/page";
import ManagerMessagesPage from "@/app/(dashboard)/manager/messages/page";
import AdminBroadcastsPage from "@/app/(dashboard)/admin/broadcasts/page";
import ManagerBroadcastsPage from "@/app/(dashboard)/manager/broadcasts/page";
import AdminBuildingsPage from "@/app/(dashboard)/admin/buildings/page";
import ManagerBuildingsPage from "@/app/(dashboard)/manager/buildings/page";
import AdminUnitsPage from "@/app/(dashboard)/admin/units/page";
import ManagerUnitsPage from "@/app/(dashboard)/manager/units/page";
import AdminParkingPage from "@/app/(dashboard)/admin/parking/page";
import ManagerParkingPage from "@/app/(dashboard)/manager/parking/page";
import AdminUsersPage from "@/app/(dashboard)/admin/users/page";
import ManagerUsersPage from "@/app/(dashboard)/manager/users/page";
import AdminPermissionsPage from "@/app/(dashboard)/admin/permissions/page";
import ManagerPermissionsPage from "@/app/(dashboard)/manager/permissions/page";
import AdminAccessPage from "@/app/(dashboard)/admin/access/page";
import ManagerAccessPage from "@/app/(dashboard)/manager/access/page";
import AdminReportsPage from "@/app/(dashboard)/admin/reports/page";
import ManagerReportsPage from "@/app/(dashboard)/manager/reports/page";

type PortalVariant = "admin" | "manager";

function PortalBuildingDetailsPage({ buildingId }: { buildingId: string }) {
    return <BuildingDetails buildingId={buildingId} backHref="/portal/buildings" />;
}

function renderPortalRoute(
    routeId: string,
    variant: PortalVariant,
    params: Record<string, string>
) {
    const adminLike = variant === "admin";

    switch (routeId) {
        case "requests-index":
            return adminLike ? <AdminRequestsPage /> : <ManagerRequestsPage />;
        case "residents-index":
            return adminLike ? <AdminResidentsPage /> : <ManagerResidentsPage />;
        case "contracts-index":
            return adminLike ? <AdminContractsPage /> : <ManagerContractsPage />;
        case "contracts-move-in":
            return adminLike ? <AdminContractMoveInPage /> : <ManagerContractMoveInPage />;
        case "contracts-detail":
            return adminLike
                ? <AdminContractDetailPage params={Promise.resolve({ contractId: params.contractId })} />
                : <ManagerContractDetailPage params={Promise.resolve({ contractId: params.contractId })} />;
        case "leases-index":
            return adminLike ? <AdminLeasesPage /> : <ManagerLeasesPage />;
        case "leases-move-in":
            return adminLike ? <AdminLeaseMoveInPage /> : <ManagerLeaseMoveInPage />;
        case "leases-detail":
            return adminLike
                ? <AdminLeaseDetailPage params={Promise.resolve({ leaseId: params.leaseId })} />
                : <ManagerLeaseDetailPage params={Promise.resolve({ leaseId: params.leaseId })} />;
        case "occupancy-index":
            return adminLike ? <AdminOccupancyPage /> : <ManagerOccupancyPage />;
        case "visitors-index":
            return adminLike ? <AdminVisitorsPage /> : <ManagerVisitorsPage />;
        case "messages-index":
            return adminLike ? <AdminMessagesPage /> : <ManagerMessagesPage />;
        case "broadcasts-index":
            return adminLike ? <AdminBroadcastsPage /> : <ManagerBroadcastsPage />;
        case "buildings-index":
            return adminLike ? <AdminBuildingsPage /> : <ManagerBuildingsPage />;
        case "buildings-detail":
            return <PortalBuildingDetailsPage buildingId={params.buildingId} />;
        case "units-index":
            return adminLike ? <AdminUnitsPage /> : <ManagerUnitsPage />;
        case "parking-index":
            return adminLike ? <AdminParkingPage /> : <ManagerParkingPage />;
        case "users-index":
            return adminLike ? <AdminUsersPage /> : <ManagerUsersPage />;
        case "permissions-index":
            return adminLike ? <AdminPermissionsPage /> : <ManagerPermissionsPage />;
        case "access-index":
            return adminLike ? <AdminAccessPage /> : <ManagerAccessPage />;
        case "reports-index":
            return adminLike ? <AdminReportsPage /> : <ManagerReportsPage />;
        default:
            return null;
    }
}

export function PortalRedirect({ slug }: { slug?: string[] }) {
    const { user, baseRole, status, permissionsReady } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const slugKey = (slug ?? []).join("/");
    const normalizedPathname = normalizeToPortalPath(pathname);
    const normalizedSlug = slug ?? [];
    const resolution = resolvePortalRoute({ user, baseRole, slug: normalizedSlug });
    const descriptor = getPortalRenderDescriptor(baseRole, normalizedSlug);
    const shouldRenderRoute =
        resolution.destination === normalizedPathname &&
        resolution.destination !== "/403" &&
        Boolean(descriptor);

    useEffect(() => {
        if (status === "unknown" || status === "restoring") return;
        if (status === "unauthenticated") {
            router.replace("/login");
            return;
        }
        if (status !== "authenticated" || !permissionsReady) return;

        const query = searchParams?.toString();
        const destination = query ? `${resolution.destination}?${query}` : resolution.destination;

        if (resolution.destination === normalizedPathname && resolution.destination !== "/403" && descriptor) {
            return;
        }

        logPortalEvent("route_resolution", {
            from: pathname ?? "/portal",
            to: destination,
            reason: resolution.reason,
            segment: resolution.segment ?? null,
            role: baseRole ?? null,
            userId: user?.id ?? null,
        });
        router.replace(destination);
    }, [
        baseRole,
        descriptor,
        normalizedPathname,
        pathname,
        permissionsReady,
        resolution.destination,
        resolution.reason,
        resolution.segment,
        router,
        searchParams,
        slug,
        slugKey,
        status,
        user,
    ]);

    if (status === "unknown" || status === "restoring" || (status === "authenticated" && !permissionsReady)) {
        return (
            <div className="h-full min-h-[50vh] w-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
        );
    }

    if (!shouldRenderRoute || !descriptor) {
        return (
            <div className="h-full min-h-[50vh] w-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
        );
    }

    return renderPortalRoute(descriptor.routeId, descriptor.variant, descriptor.params);
}
