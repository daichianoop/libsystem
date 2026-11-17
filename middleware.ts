import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define route matchers
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/closed",
  "/api/health",
  "/api/webhooks/clerk",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)", "/api/students(.*)", "/api/settings(.*)", "/api/access-(.*)"]);
const isScannerRoute = createRouteMatcher(["/scanner(.*)", "/api/scans(.*)"]);
const isStudentRoute = createRouteMatcher(["/student(.*)", "/api/tag(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  // If public route, allow immediately
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  const { userId, sessionClaims } = await auth();

  // If unauthenticated, redirect to sign-in
  if (!userId) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", req.url);
    return NextResponse.redirect(signInUrl);
  }

  // Extract role from session claims (Clerk publicMetadata)
  const userRole = (sessionClaims?.metadata as any)?.role || (sessionClaims as any)?.role || "student";

  // Role Gate: Admin routes
  if (isAdminRoute(req) && userRole !== "admin") {
    // Non-admin attempting to access /admin
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Admin privileges required" } },
        { status: 403 }
      );
    }
    // Redirect non-admin to their respective home
    if (userRole === "scanner") {
      return NextResponse.redirect(new URL("/scanner", req.url));
    }
    return NextResponse.redirect(new URL("/student/home", req.url));
  }

  // Role Gate: Scanner routes
  if (isScannerRoute(req) && userRole !== "scanner" && userRole !== "admin") {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Scanner privileges required" } },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL("/student/home", req.url));
  }

  // Role Gate: Student routes
  if (isStudentRoute(req) && userRole !== "student" && userRole !== "admin") {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Student privileges required" } },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL("/scanner", req.url));
  }

  // Stub for Phase 1 time window enforcement (will query access_windows in Phase 3)
  // Admins are never locked out
  const isTimeWindowStubActive = false; // Stubbed for Phase 1
  if (isTimeWindowStubActive && userRole !== "admin") {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: "OUTSIDE_ACCESS_WINDOW", message: "System is closed at this time." } },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL("/closed", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
