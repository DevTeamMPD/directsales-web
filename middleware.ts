import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_FIXTURES === '1') return NextResponse.next();
  // route ที่ pg_cron ปลุก ไม่ใช้ session ของ Supabase — ตรวจรหัสลับเองใน route (lib/cron/auth.ts)
  if (request.nextUrl.pathname.startsWith('/api/cron/')) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() ต่ออายุ session ใน cookie (ห้ามมีโค้ดอื่นคั่นระหว่าง createServerClient กับบรรทัดนี้)
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const onLogin = path === '/login' || path.startsWith('/login/');
  if (!user && !onLogin) return redirectKeepingCookies(request, response, '/login');
  if (user && onLogin) return redirectKeepingCookies(request, response, '/leads');
  return response;
}

function redirectKeepingCookies(request: NextRequest, from: NextResponse, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  const res = NextResponse.redirect(url);
  from.cookies.getAll().forEach((c) => res.cookies.set(c));
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?)$).*)'],
};
