"use client";

import { useAuth } from "@/lib/auth";
import { getDefaultHomeRoute } from "@/lib/homeRoute";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { user, status, baseRole } = useAuth();
  const router = useRouter();
  const restoreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (restoreTimeoutRef.current) {
      clearTimeout(restoreTimeoutRef.current);
      restoreTimeoutRef.current = null;
    }
    if (status === 'loading') return;
    if (status === 'restoring') {
      restoreTimeoutRef.current = setTimeout(() => {
        router.replace('/login');
      }, 2500);
      return;
    }
    if (status === 'unauthenticated') {
      router.replace('/login');
    } else if (status === 'authenticated' && user) {
      router.replace(getDefaultHomeRoute(user, baseRole));
    }
  }, [status, user, baseRole, router]);

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-3 text-zinc-400">
        <Loader2 className="h-8 w-8 animate-spin" />
        <div className="text-sm">{status === 'restoring' ? 'Restoring session...' : 'Loading...'}</div>
      </div>
    </div>
  );
}
