"use client";

import { useAuth } from "@/lib/auth";
import { getDefaultHomeRoute } from "@/lib/homeRoute";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { user, status, baseRole } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (status === 'unknown' || status === 'restoring') return;
    if (status === 'unauthenticated') {
      router.replace('/login');
    } else if (status === 'authenticated' && user) {
      router.replace(getDefaultHomeRoute(user, baseRole));
    }
  }, [status, user, baseRole, router]);

  if (status !== 'restoring') {
    return null;
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-3 text-zinc-400">
        <Loader2 className="h-8 w-8 animate-spin" />
        <div className="text-sm">Restoring session...</div>
      </div>
    </div>
  );
}
