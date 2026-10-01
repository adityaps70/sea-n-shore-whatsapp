import { NextRequest, NextResponse } from "next/server";
import { getVercelOidcToken } from "@vercel/oidc";

const EDGE_URL = "https://eamdiqtzbzkkdxvhxdqy.supabase.co/functions/v1/la-shimti-pms";

async function forward(req: NextRequest, method: "GET" | "POST") {
  const token = await getVercelOidcToken({
    project: "prj_sa7LIUoo5nRHcwpaaR13Hp4OVfCo",
    team: "team_w3XOKcTFgBNWgaRvkcVL0P90",
  });

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Unable to obtain Vercel project identity for the PMS backend." },
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
