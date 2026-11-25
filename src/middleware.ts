import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// ============================================================================
// RATE LIMITING EM MEMÓRIA (Anti Força Bruta para rota de Login)
// ============================================================================
const loginRateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // Janela deslizante de 1 minuto
const MAX_LOGIN_REQUESTS = 20;          // Máximo de 20 pedidos/minuto por IP

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const history = loginRateLimitMap.get(ip) || [];
  const recent = history.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  
  if (recent.length >= MAX_LOGIN_REQUESTS) {
    return false; // Bloqueado
  }
  
  recent.push(now);
  loginRateLimitMap.set(ip, recent);
  
  // Limpeza de cache para IPs antigos (evita crescimento ilimitado de memória)
  if (loginRateLimitMap.size > 1000) {
    for (const [key, times] of loginRateLimitMap.entries()) {
      if (times.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) {
        loginRateLimitMap.delete(key);
      }
    }
  }
  
  return true; // Permitido
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === '/login';
  const isResetPasswordPage = pathname === '/reset-password';
  const isAuthCallback = pathname.startsWith('/auth') || pathname.startsWith('/api/auth');

  // 1. Verificação de Rate Limit no endpoint de Login
  if (isLoginPage) {
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    if (!checkLoginRateLimit(clientIp)) {
      return new NextResponse(
        JSON.stringify({
          error: 'Demasiadas tentativas de acesso. Por motivos de segurança, aguarde 60 segundos antes de tentar novamente.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Retry-After': '60',
          },
        }
      );
    }
  }

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

  // 2. Validação contínua do utilizador diretamente do Supabase Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 3. Utilizador não autenticado a tentar aceder a rota privada -> Redirecionar para /login
  if (!user && !isLoginPage && !isResetPasswordPage && !isAuthCallback) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    if (pathname !== '/') {
      redirectUrl.searchParams.set('redirectTo', pathname);
    }
    return NextResponse.redirect(redirectUrl);
  }

  // 4. Utilizador já autenticado a tentar aceder à página de login -> Redirecionar para /dashboard
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
