import { useQuery } from "@tanstack/react-query";

import { getDashboardActivity, getDashboardOverview } from "../api/dashboard";
import { IS_PROD } from "./shared";

export function useDashboardOverview(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["dashboard-overview"],
        queryFn: getDashboardOverview,
        enabled: options?.enabled ?? true,
        refetchOnWindowFocus: !IS_PROD,
        staleTime: IS_PROD ? 60_000 : 0,
    });
}

export function useDashboardActivity(limit = 20, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["dashboard-activity", limit],
        queryFn: () => getDashboardActivity(limit),
        enabled: options?.enabled ?? true,
        refetchOnWindowFocus: !IS_PROD,
        staleTime: IS_PROD ? 60_000 : 0,
    });
}
