import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, decodeSessionToken } from "@/lib/session-token";

// Public routes that never require authentication
const PUBLIC_PATHS = [
  "/",
  "/sign-in",
  "/closed",
  "/api/health",
  "/api/auth/login",
  "/api/auth/logout",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Allow public routes immediately
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // 2. Read session cookie
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME);
  const session = sessionCookie ? decodeSessionToken(sessionCookie.value) : null;

  // 3. Gating unauthenticated requests
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", req.url);
    return NextResponse.redirect(signInUrl);
  }

  // 4. Role Gating: Admin surfaces
  if (
    (pathname.startsWith("/admin") ||
      pathname.startsWith("/api/students") ||
      pathname.startsWith("/api/settings") ||
      pathname.startsWith("/api/access-")) &&
    session.role !== "admin"
  ) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Admin privileges required" } },
        { status: 403 }
      );
    }
    const fallbackUrl = session.role === "scanner" ? "/scanner" : "/student/home";
    return NextResponse.redirect(new URL(fallbackUrl, req.url));
  }

  // 5. Role Gating: Scanner surfaces
  if (
    (pathname.startsWith("/scanner") || pathname.startsWith("/api/scans")) &&
    session.role !== "scanner" &&
    session.role !== "admin"
  ) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Scanner privileges required" } },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL("/student/home", req.url));
  }

  // 6. Role Gating: Student surfaces
  if (
    (pathname.startsWith("/student") || pathname.startsWith("/api/tag")) &&
    session.role !== "student" &&
    session.role !== "admin"
  ) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Student privileges required" } },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL("/scanner", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
