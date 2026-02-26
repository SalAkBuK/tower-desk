import { PortalRedirect } from "@/components/portal/PortalRedirect";

export default async function PortalCatchAllPage({
    params,
}: {
    params: Promise<{ slug?: string[] }>;
}) {
    const resolvedParams = await params;
    return <PortalRedirect slug={resolvedParams.slug} />;
}
