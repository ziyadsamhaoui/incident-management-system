import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware — runs on every request.
 *
 * Note: Auth state is stored in localStorage (via Zustand persist),
 * which is NOT accessible from Next.js server-side middleware.
 * Fine-grained route protection is handled client-side by the
 * <AuthGuard /> component.
 *
 * This middleware currently forwards all requests. If a cookie-based
 * auth strategy is adopted in the future, update this to redirect
 * unauthenticated requests to /login.
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files, api routes, and _next
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
