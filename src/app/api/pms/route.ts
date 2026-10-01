import { NextRequest, NextResponse } from "next/server";

const EDGE_URL = "https://eamdiqtzbzkkdxvhxdqy.supabase.co/functions/v1/la-shimti-pms";

async function forward(req: NextRequest, method: "GET" | "POST") {
  const token = process.env.VERCEL_OIDC_TOKEN;

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Vercel project identity is unavailable. Redeploy this preview." },
      { status: 500 }
    );
  }

  const init: RequestInit = {
    method,
    headers: {
      "x-vercel-oidc-token": token,
      "content-type": "application/json",
    },
    cache: "no-store",
  };

  if (method === "POST") {
    init.body = await req.text();
  }

  const response = await fetch(EDGE_URL, init);
  const body = await response.text();

  return new NextResponse(body, {
    status: response.status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(req: NextRequest) {
  return forward(req, "GET");
}

export async function POST(req: NextRequest) {
  return forward(req, "POST");
}
