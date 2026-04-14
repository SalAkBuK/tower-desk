import { NextRequest } from "next/server";
import { proxyPlatformRequest } from "../_proxy";

export async function GET(req: NextRequest) {
    return proxyPlatformRequest(req, "/platform/delivery-tasks");
}
