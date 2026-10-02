import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  createAdminSession,
  hasAdminAuthEnv,
  validateAdminCredentials,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const email = String(form.get("email") || "");
  const password = String(form.get("password") || "");
  const next = String(form.get("next") || "/");

  if (!hasAdminAuthEnv()) {
    return NextResponse.redirect(new URL("/login?config=1", request.url), 303);
  }

  if (!validateAdminCredentials(email, password)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "1");
    if (next.startsWith("/")) url.searchParams.set("next", next);
    return NextResponse.redirect(url, 303);
  }

  const destination = next.startsWith("/") ? next : "/";
  const response = NextResponse.redirect(new URL(destination, request.url), 303);
  const session = createAdminSession(email);
  if (!session) {
    return NextResponse.redirect(new URL("/login?config=1", request.url), 303);
  }

  response.cookies.set(ADMIN_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60,
  });

  return response;
}
