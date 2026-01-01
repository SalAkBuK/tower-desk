"use client";

import { useAuth } from "@/lib/auth";
import { getDefaultHomeRoute } from "@/lib/homeRoute";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { user, status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.replace('/login');
    } else if (status === 'authenticated' && user) {
      router.replace(getDefaultHomeRoute(user));
    }
  }, [status, user, router]);

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-zinc-950">
      <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
    </div>
  );
}
