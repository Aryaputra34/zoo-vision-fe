import { NextResponse, type NextRequest } from 'next/server';

export const SESSION_COOKIE = 'zoo_session';

const PUBLIC_ASSET = /\.(?:svg|png|jpg|jpeg|webp|ico)$/;

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (
    pathname === '/login' ||
    PUBLIC_ASSET.test(pathname) ||
    Boolean(req.cookies.get(SESSION_COOKIE)?.value)
  ) {
    return NextResponse.next();
  }

  const login = new URL('/login', req.url);
  login.searchParams.set('next', pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
