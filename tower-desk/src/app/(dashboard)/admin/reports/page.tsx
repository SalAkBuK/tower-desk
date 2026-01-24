"use client";

import { FileText } from "lucide-react";

export default function AdminReportsPage() {
    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Reports</h1>
                <p className="mt-1 text-sm text-zinc-500">Generate and view reports.</p>
            </div>

            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 p-12">
                <div className="flex flex-col items-center justify-center text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100">
                        <FileText className="h-8 w-8 text-zinc-400" />
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-zinc-700">Coming Soon</h2>
                    <p className="mt-2 max-w-sm text-sm text-zinc-500">
                        Reports functionality will be available in a future update.
                    </p>
                </div>
            </div>
        </div>
    );
}
