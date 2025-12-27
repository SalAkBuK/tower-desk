import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL;
const PLATFORM_API_KEY = process.env.PLATFORM_API_KEY;

export async function POST(req: NextRequest) {
    if (!API_BASE_URL || !PLATFORM_API_KEY) {
        return NextResponse.json({ message: "Platform API is not configured." }, { status: 500 });
    }

    let requestBody = "";
    try {
        requestBody = await req.text();
    } catch {
        return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
    }

    const res = await fetch(`${API_BASE_URL}/platform/orgs`, {
        method: "POST",
        headers: {
            "Content-Type": req.headers.get("content-type") || "application/json",
            "accept": req.headers.get("accept") || "*/*",
            ...(req.headers.get("authorization") ? { Authorization: req.headers.get("authorization") as string } : {}),
            "x-platform-key": PLATFORM_API_KEY
        },
        body: requestBody,
        cache: "no-store"
    });

    const responseBody = await res.text();
    const headers = new Headers();
    const contentType = res.headers.get("content-type");
    if (contentType) {
        headers.set("content-type", contentType);
    }

    return new NextResponse(responseBody, { status: res.status, headers });
}

export async function GET(req: NextRequest) {
    if (!API_BASE_URL || !PLATFORM_API_KEY) {
        return NextResponse.json({ message: "Platform API is not configured." }, { status: 500 });
    }

    const url = new URL(req.url);
    const res = await fetch(`${API_BASE_URL}/platform/orgs${url.search}`, {
        method: "GET",
        headers: {
            "accept": req.headers.get("accept") || "*/*",
            ...(req.headers.get("authorization") ? { Authorization: req.headers.get("authorization") as string } : {}),
            "x-platform-key": PLATFORM_API_KEY
        },
        cache: "no-store"
    });

    const responseBody = await res.text();
    const headers = new Headers();
    const contentType = res.headers.get("content-type");
    if (contentType) {
        headers.set("content-type", contentType);
    }

    return new NextResponse(responseBody, { status: res.status, headers });
}
