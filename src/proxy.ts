import { NextResponse, type NextRequest } from "next/server";
import { checkBasicAuth, isPublicPath } from "@/lib/operatorAuth";

// Operator password gate: everything except published client sites and what
// they need (see isPublicPath). Fails closed if OPERATOR_PASSWORD is unset.
export function proxy(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) return NextResponse.next();

  const result = checkBasicAuth(request.headers.get("authorization"), process.env.OPERATOR_PASSWORD);
  if (result === "ok") return NextResponse.next();
  if (result === "unconfigured") {
    return new NextResponse("Operator password not configured", { status: 503 });
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="LaunchLocal", charset="UTF-8"' },
  });
}

export const config = {
  // Skip Next's static assets outright; isPublicPath handles the rest.
  matcher: "/((?!_next/static|_next/image).*)",
};
