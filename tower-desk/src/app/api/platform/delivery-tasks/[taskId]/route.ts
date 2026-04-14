import { NextRequest } from "next/server";
import { proxyPlatformRequest } from "../../_proxy";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ taskId: string }> },
) {
    const { taskId } = await params;
    return proxyPlatformRequest(req, `/platform/delivery-tasks/${taskId}`);
}
