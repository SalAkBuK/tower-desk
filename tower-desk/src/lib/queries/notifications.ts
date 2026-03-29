import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../api/notifications";

export function useNotifications(params?: { unreadOnly?: boolean; cursor?: string; limit?: number; enabled?: boolean }) {
    return useQuery({
        queryKey: ["notifications", params?.unreadOnly ?? false, params?.cursor ?? "", params?.limit ?? ""],
        queryFn: () => getNotifications({ unreadOnly: params?.unreadOnly, cursor: params?.cursor, limit: params?.limit }),
        enabled: params?.enabled ?? true,
    });
}

export function useMarkNotificationRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (notificationId: string) => markNotificationRead(notificationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
    });
}

export function useMarkAllNotificationsRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => markAllNotificationsRead(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
    });
}
