"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useResendResidentInvite, useResidentInvites } from "@/lib/queries";
import type { ResidentInviteFilterStatus, ResidentInviteListItem, ResidentInvitesResponse, ResidentInviteStatus } from "@/lib/types";

const FILTER_OPTIONS: { value: ResidentInviteFilterStatus; label: string }[] = [
    { value: "PENDING", label: "Pending" },
    { value: "FAILED", label: "Failed" },
    { value: "EXPIRED", label: "Expired" },
    { value: "ACCEPTED", label: "Accepted" },
    { value: "ALL", label: "All" },
];

const RESENDABLE_STATUSES = new Set<ResidentInviteStatus>(["PENDING", "FAILED", "EXPIRED"]);

const STATUS_DISPLAY: Record<ResidentInviteStatus, { label: string; className: string }> = {
    PENDING: { label: "Pending", className: "bg-blue-50 text-blue-700 border-blue-200" },
    ACCEPTED: { label: "Accepted", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    FAILED: { label: "Failed", className: "bg-rose-50 text-rose-700 border-rose-200" },
    EXPIRED: { label: "Expired", className: "bg-amber-50 text-amber-700 border-amber-200" },
};

interface InviteCursorState {
    cursor: string | null;
    items: ResidentInviteListItem[];
    nextCursor: string | null;
}

type InviteCursorAction =
    | { type: "reset" }
    | { type: "setCursor"; cursor: string | null }
    | { type: "append"; cursor: string | null; items: ResidentInviteListItem[]; nextCursor: string | null };

const initialCursorState = (): InviteCursorState => ({
    cursor: null,
    items: [],
    nextCursor: null,
});

const inviteKey = (invite: ResidentInviteListItem) =>
    invite.inviteId || `${invite.user.id}:${invite.sentAt ?? ""}:${invite.status}`;

const mergeInvites = (prev: ResidentInviteListItem[], next: ResidentInviteListItem[]) => {
    const map = new Map(prev.map((item) => [inviteKey(item), item]));
    next.forEach((item) => map.set(inviteKey(item), item));
    return Array.from(map.values());
};

const cursorReducer = (state: InviteCursorState, action: InviteCursorAction): InviteCursorState => {
    switch (action.type) {
        case "reset":
            return initialCursorState();
        case "setCursor":
            return {
                ...state,
                cursor: action.cursor,
            };
        case "append":
            return {
                cursor: state.cursor,
                nextCursor: action.nextCursor,
                items: action.cursor ? mergeInvites(state.items, action.items) : action.items,
            };
        default:
            return state;
    }
};

const formatDateTime = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
};

const renderFailureText = (invite: ResidentInviteListItem) => {
    const reason = invite.failureReason?.trim();
    const failedAt = invite.failedAt ? formatDateTime(invite.failedAt) : "";
    if (!reason && !failedAt) return "-";
    if (reason && failedAt) return `${reason} (${failedAt})`;
    return reason || failedAt;
};

export function ResidentInviteMonitor() {
    const [statusFilter, setStatusFilter] = useState<ResidentInviteFilterStatus>("PENDING");
    const [search, setSearch] = useState("");
    const [inviteForResend, setInviteForResend] = useState<ResidentInviteListItem | null>(null);
    const [inviteState, dispatchInviteState] = useReducer(cursorReducer, undefined, initialCursorState);
    const resendInvite = useResendResidentInvite();

    const trimmedSearch = search.trim();

    useEffect(() => {
        dispatchInviteState({ type: "reset" });
    }, [statusFilter, trimmedSearch]);

    const invitesQuery = useResidentInvites(
        {
            status: statusFilter,
            q: trimmedSearch || undefined,
            limit: 50,
            cursor: inviteState.cursor ?? undefined,
        },
        { enabled: true }
    );

    useEffect(() => {
        const data = invitesQuery.data as ResidentInvitesResponse | undefined;
        if (!data) return;
        dispatchInviteState({
            type: "append",
            cursor: inviteState.cursor,
            items: data.items || [],
            nextCursor: data.nextCursor ?? null,
        });
    }, [invitesQuery.data, inviteState.cursor]);

    const handleConfirmResend = async () => {
        if (!inviteForResend?.user.id) return;
        try {
            await resendInvite.mutateAsync(inviteForResend.user.id);
            toast.success("Invite sent.");
        } catch (error) {
            const message =
                error instanceof Error && error.message
                    ? error.message
                    : "Failed to send invite.";
            toast.error(message);
        } finally {
            setInviteForResend(null);
        }
    };

    const totalLoaded = useMemo(() => inviteState.items.length, [inviteState.items.length]);

    return (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-zinc-900">Invite Monitor</h2>
                    <p className="text-xs text-zinc-400">
                        Track onboarding invites by backend invite status records.
                    </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <Input
                            placeholder="Search by name or email..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ResidentInviteFilterStatus)}>
                        <SelectTrigger className="w-44">
                            <SelectValue placeholder="Filter status" />
                        </SelectTrigger>
                        <SelectContent>
                            {FILTER_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="mt-6">
                {invitesQuery.isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map((item) => (
                            <div key={item} className="rounded-lg border border-zinc-200 bg-white p-4">
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="mt-2 h-3 w-1/2" />
                            </div>
                        ))}
                    </div>
                ) : inviteState.items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-10 text-center text-sm text-zinc-500">
                        No invites found for the selected filters.
                    </div>
                ) : (
                    <div className="rounded-lg border border-zinc-200 bg-white">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>Resident</TableHead>
                                    <TableHead>Invite Status</TableHead>
                                    <TableHead>Sent At</TableHead>
                                    <TableHead>Expires At</TableHead>
                                    <TableHead>Accepted At</TableHead>
                                    <TableHead>Last Failure</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {inviteState.items.map((invite) => {
                                    const status = STATUS_DISPLAY[invite.status];
                                    const canResend = invite.user.isActive !== false && RESENDABLE_STATUSES.has(invite.status);

                                    return (
                                        <TableRow key={inviteKey(invite)}>
                                            <TableCell>
                                                <div className="text-sm font-medium text-zinc-900">
                                                    {invite.user.name || "Resident"}
                                                </div>
                                                <div className="text-xs text-zinc-500">
                                                    {invite.user.email || "-"}
                                                </div>
                                                {(invite.createdByUser?.name || invite.createdByUser?.email) ? (
                                                    <div className="text-[11px] text-zinc-400">
                                                        Created by {invite.createdByUser?.name || invite.createdByUser?.email}
                                                    </div>
                                                ) : null}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={status.className}>
                                                    {status.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-zinc-600">{formatDateTime(invite.sentAt)}</TableCell>
                                            <TableCell className="text-sm text-zinc-600">{formatDateTime(invite.expiresAt)}</TableCell>
                                            <TableCell className="text-sm text-zinc-600">{formatDateTime(invite.acceptedAt)}</TableCell>
                                            <TableCell className="text-sm text-zinc-600">{renderFailureText(invite)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={!canResend || resendInvite.isPending}
                                                    onClick={() => setInviteForResend(invite)}
                                                >
                                                    Resend Invite
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}

                {inviteState.nextCursor ? (
                    <div className="mt-4 flex items-center justify-between">
                        <p className="text-xs text-zinc-500">{totalLoaded} invite records loaded</p>
                        <Button
                            variant="outline"
                            onClick={() =>
                                dispatchInviteState({
                                    type: "setCursor",
                                    cursor: inviteState.nextCursor,
                                })
                            }
                            disabled={invitesQuery.isFetching}
                        >
                            {invitesQuery.isFetching ? "Loading..." : "Load more"}
                        </Button>
                    </div>
                ) : null}
            </div>

            <ConfirmDialog
                open={Boolean(inviteForResend)}
                onOpenChange={(open) => {
                    if (!open) setInviteForResend(null);
                }}
                title="Resend Invite"
                description={`Resend onboarding invite to ${inviteForResend?.user.email ?? "this resident"}? This sends a new setup-password link.`}
                confirmText={resendInvite.isPending ? "Sending..." : "Send Invite"}
                onConfirm={() => {
                    void handleConfirmResend();
                }}
            />
        </div>
    );
}
