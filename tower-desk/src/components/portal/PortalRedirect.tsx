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
import AdminDashboardPage from "@/app/(dashboard)/admin/dashboard/page";
import ManagerDashboardPage from "@/app/(dashboard)/manager/dashboard/page";
import AdminRequestsPage from "@/app/(dashboard)/admin/requests/page";
import AdminResidentsPage from "@/app/(dashboard)/admin/residents/page";
import ManagerResidentsPage from "@/app/(dashboard)/manager/residents/page";
import AdminContractsPage from "@/app/(dashboard)/admin/contracts/page";
import AdminContractMoveInPage from "@/app/(dashboard)/admin/contracts/move-in/page";
import AdminContractDetailPage from "@/app/(dashboard)/admin/contracts/[contractId]/page";
import ManagerContractDetailPage from "@/app/(dashboard)/manager/contracts/[contractId]/page";
import AdminLeasesPage from "@/app/(dashboard)/admin/leases/page";
import ManagerLeasesPage from "@/app/(dashboard)/manager/leases/page";
import AdminLeaseMoveInPage from "@/app/(dashboard)/admin/leases/move-in/page";
import ManagerLeaseMoveInPage from "@/app/(dashboard)/manager/leases/move-in/page";
import AdminLeaseDetailPage from "@/app/(dashboard)/admin/leases/[leaseId]/page";
import ManagerLeaseDetailPage from "@/app/(dashboard)/manager/leases/[leaseId]/page";
import AdminOccupancyPage from "@/app/(dashboard)/admin/occupancy/page";
import AdminVisitorsPage from "@/app/(dashboard)/admin/visitors/page";
import ManagerVisitorsPage from "@/app/(dashboard)/manager/visitors/page";
import AdminMessagesPage from "@/app/(dashboard)/admin/messages/page";
import AdminBroadcastsPage from "@/app/(dashboard)/admin/broadcasts/page";
import AdminBuildingsPage from "@/app/(dashboard)/admin/buildings/page";
import AdminAmenitiesPage from "@/app/(dashboard)/admin/amenities/page";
import AdminUnitsPage from "@/app/(dashboard)/admin/units/page";
import ManagerUnitsPage from "@/app/(dashboard)/manager/units/page";
import AdminParkingPage from "@/app/(dashboard)/admin/parking/page";
import AdminOwnersPage from "@/app/(dashboard)/admin/owners/page";
import AdminProvidersPage from "@/app/(dashboard)/admin/providers/page";
import AdminUsersPage from "@/app/(dashboard)/admin/users/page";
import AdminPermissionsPage from "@/app/(dashboard)/admin/permissions/page";
import ManagerPermissionsPage from "@/app/(dashboard)/manager/permissions/page";
import AdminAccessPage from "@/app/(dashboard)/admin/access/page";
import ManagerAccessPage from "@/app/(dashboard)/manager/access/page";
import AdminReportsPage from "@/app/(dashboard)/admin/reports/page";
import ManagerOwnersPage from "@/app/(dashboard)/manager/owners/page";
import ManagerProvidersPage from "@/app/(dashboard)/manager/providers/page";
import ManagerAmenitiesPage from "@/app/(dashboard)/manager/amenities/page";
import OwnerDashboardRoute from "@/app/(dashboard)/owner/dashboard/page";
import OwnerMessagesRoute from "@/app/(dashboard)/owner/messages/page";
import OwnerNotificationsRoute from "@/app/(dashboard)/owner/notifications/page";
import OwnerRequestsRoute from "@/app/(dashboard)/owner/requests/page";
import ProviderDashboardRoute from "@/app/(dashboard)/provider/dashboard/page";
import ProviderProfileRoute from "@/app/(dashboard)/provider/profile/page";
import ProviderRequestsRoute from "@/app/(dashboard)/provider/requests/page";
import ProviderStaffRoute from "@/app/(dashboard)/provider/staff/page";

type PortalVariant = "admin" | "manager" | "provider" | "owner";

function PortalBuildingDetailsPage({ buildingId }: { buildingId: string }) {
    return <BuildingDetails buildingId={buildingId} backHref="/portal/buildings" />;
}

function renderPortalRoute(
    routeId: string,
    variant: PortalVariant,
    params: Record<string, string>
) {
    const adminLike = variant === "admin";
    const providerLike = variant === "provider";
    const ownerLike = variant === "owner";

    switch (routeId) {
        case "dashboard-index":
            return ownerLike ? <OwnerDashboardRoute /> : providerLike ? <ProviderDashboardRoute /> : adminLike ? <AdminDashboardPage /> : <ManagerDashboardPage />;
        case "requests-index":
            return ownerLike ? <OwnerRequestsRoute /> : providerLike ? <ProviderRequestsRoute /> : <AdminRequestsPage />;
        case "provider-profile-index":
            return <ProviderProfileRoute />;
        case "provider-staff-index":
            return <ProviderStaffRoute />;
        case "residents-index":
            return adminLike ? <AdminResidentsPage /> : <ManagerResidentsPage />;
        case "contracts-index":
            return <AdminContractsPage />;
        case "contracts-move-in":
            return <AdminContractMoveInPage />;
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
            return <AdminOccupancyPage />;
        case "visitors-index":
            return adminLike ? <AdminVisitorsPage /> : <ManagerVisitorsPage />;
        case "messages-index":
            return ownerLike ? <OwnerMessagesRoute /> : <AdminMessagesPage />;
        case "notifications-index":
            return <OwnerNotificationsRoute />;
        case "broadcasts-index":
            return <AdminBroadcastsPage />;
        case "buildings-index":
            return <AdminBuildingsPage />;
        case "amenities-index":
            return adminLike ? <AdminAmenitiesPage /> : <ManagerAmenitiesPage />;
        case "buildings-detail":
            return <PortalBuildingDetailsPage buildingId={params.buildingId} />;
        case "units-index":
            return adminLike ? <AdminUnitsPage /> : <ManagerUnitsPage />;
        case "parking-index":
            return <AdminParkingPage />;
        case "owners-index":
            return adminLike ? <AdminOwnersPage /> : <ManagerOwnersPage />;
        case "providers-index":
            return adminLike ? <AdminProvidersPage /> : <ManagerProvidersPage />;
        case "users-index":
            return <AdminUsersPage />;
        case "permissions-index":
            return adminLike ? <AdminPermissionsPage /> : <ManagerPermissionsPage />;
        case "access-index":
            return adminLike ? <AdminAccessPage /> : <ManagerAccessPage />;
        case "reports-index":
            return <AdminReportsPage />;
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
