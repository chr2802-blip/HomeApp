import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/accept-invite"];

/**
 * Cheap cookie-presence gate so unauthenticated requests never reach a page render.
 * The cookie is actually verified in `getCurrentUser`, which runs on every page.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) return NextResponse.next();

  if (!request.cookies.has("homehub_session")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/homes/:path*",
    "/lists/:path*",
    "/tasks/:path*",
    "/meals/:path*",
    "/recipes/:path*",
    "/admin/:path*",
    "/settings/:path*",
    "/profile/:path*",
  ],
};
