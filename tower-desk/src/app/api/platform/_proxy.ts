import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL;
const PLATFORM_API_KEY = process.env.PLATFORM_API_KEY;

export async function proxyPlatformRequest(req: NextRequest, path: string) {
    if (!API_BASE_URL || !PLATFORM_API_KEY) {
        return NextResponse.json({ message: "Platform API is not configured." }, { status: 500 });
    }

    const url = new URL(req.url);
    const targetUrl = `${API_BASE_URL}${path}${url.search}`;
    const method = req.method.toUpperCase();
    const requestBody = method === "GET" || method === "HEAD" ? undefined : await req.text();

    const res = await fetch(targetUrl, {
        method,
        headers: {
            ...(requestBody !== undefined ? { "Content-Type": req.headers.get("content-type") || "application/json" } : {}),
            "accept": req.headers.get("accept") || "*/*",
            ...(req.headers.get("authorization") ? { Authorization: req.headers.get("authorization") as string } : {}),
            "x-platform-key": PLATFORM_API_KEY,
        },
        ...(requestBody !== undefined ? { body: requestBody } : {}),
        cache: "no-store",
    });

    const responseBody = await res.text();
    const headers = new Headers();
    const contentType = res.headers.get("content-type");
    if (contentType) {
        headers.set("content-type", contentType);
    }

    return new NextResponse(responseBody, {
        status: res.status,
        headers,
    });
}
