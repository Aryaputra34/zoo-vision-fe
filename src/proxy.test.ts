import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

describe('proxy middleware', () => {
  it('/rides without the cookie → 307 to /login?next=%2Frides; with the cookie → passes; /login passes', () => {
    // 1. /rides without cookie -> 307 to /login?next=%2Frides
    const reqNoCookie = new NextRequest('http://localhost:3000/rides');
    const resNoCookie = proxy(reqNoCookie);
    expect(resNoCookie.status).toBe(307);
    const location = resNoCookie.headers.get('location');
    expect(location).toContain('/login?next=%2Frides');

    // 2. /rides with cookie -> passes
    const reqWithCookie = new NextRequest('http://localhost:3000/rides', {
      headers: {
        cookie: 'zoo_session=valid-session-token',
      },
    });
    const resWithCookie = proxy(reqWithCookie);
    expect(resWithCookie.status).toBe(200);
    expect(resWithCookie.headers.get('location')).toBeNull();

    // 3. /login without cookie -> passes
    const reqLogin = new NextRequest('http://localhost:3000/login');
    const resLogin = proxy(reqLogin);
    expect(resLogin.status).toBe(200);
    expect(resLogin.headers.get('location')).toBeNull();
  });
});
