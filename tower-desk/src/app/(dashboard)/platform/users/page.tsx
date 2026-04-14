import { redirect } from "next/navigation";

export default function PlatformUsersRedirectPage() {
    redirect("/platform/orgs");
}
