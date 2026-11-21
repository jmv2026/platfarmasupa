import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: Obter o utilizador autenticado diretamente do Supabase Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Rotas públicas que não requerem autenticação
  const isLoginPage = pathname === '/login';
  const isAuthCallback = pathname.startsWith('/auth');

  // 1. Utilizador não autenticado a tentar aceder a rota privada -> Redirecionar para /login
  if (!user && !isLoginPage && !isAuthCallback) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    // Opcional: preservar o destino original
    if (pathname !== '/') {
      redirectUrl.searchParams.set('redirectTo', pathname);
    }
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Utilizador já autenticado a tentar aceder à página de login -> Redirecionar para /dashboard
  if (user && isLoginPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/dashboard';
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Interceta todas as rotas exceto:
     * - _next/static (ficheiros estáticos compilados)
     * - _next/image (otimização de imagens)
     * - favicon.ico
     * - Ficheiros estáticos com extensões (.svg, .png, .jpg, .css, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
};
