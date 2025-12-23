import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function ForbiddenPage() {
    return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-zinc-50 text-zinc-900">
            <div className="bg-red-50 p-4 rounded-full mb-4">
                <ShieldAlert className="h-12 w-12 text-red-500" />
            </div>
            <h1 className="text-3xl font-bold mb-2">403 - Access Denied</h1>
            <p className="text-zinc-500 mb-8 max-w-md text-center">
                You do not have permission to access this resource. Please contact your administrator if you believe this is a mistake.
            </p>
            <Link href="/">
                <Button>Go Back Home</Button>
            </Link>
        </div>
    );
}
