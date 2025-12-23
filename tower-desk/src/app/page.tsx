"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else if (user) {
      if (user.role === 'superadmin') router.push('/sa/buildings');
      else if (user.role === 'admin') router.push('/admin/requests');
      else if (user.role === 'manager') router.push('/manager/requests');
      else router.push('/403');
    }
  }, [isAuthenticated, user, router]);

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-zinc-950">
      <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
    </div>
  );
}
