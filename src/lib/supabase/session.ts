import { cache } from 'react';
import { createClient } from './server';
import { UserProfile } from './types';

// Cache em memória no servidor (TTL 30s) para evitar round-trip repetido a public.users em cada mudança de página
const PROFILE_CACHE_TTL_MS = 30_000;
const profileCache = new Map<string, { profile: UserProfile | null; expiresAt: number }>();

export function invalidateUserProfileCache(userId?: string) {
  if (userId) {
    profileCache.delete(userId);
  } else {
    profileCache.clear();
  }
}

async function fetchProfileCached(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<UserProfile | null> {
  const now = Date.now();
  const cached = profileCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.profile;
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  const result = (profile as UserProfile) || null;
  profileCache.set(userId, { profile: result, expiresAt: now + PROFILE_CACHE_TTL_MS });
  return result;
}

/**
 * Obtém o cliente Supabase, utilizador autenticado e perfil em paralelo (sem waterfall sequencial),
 * deduplicando chamadas no mesmo pedido SSR através de React.cache().
 */
export const getAuthContext = cache(async () => {
  const supabase = await createClient();

  // Ler sessão local do cookie (0ms) para paralelizar a validação getUser() com a query à tabela users
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const cookieUserId = session?.user?.id;

  const [
    {
      data: { user },
    },
    preliminaryProfile,
  ] = await Promise.all([
    supabase.auth.getUser(),
    cookieUserId ? fetchProfileCached(supabase, cookieUserId) : Promise.resolve(null),
  ]);

  if (!user) {
    return {
      supabase,
      user: null,
      profile: null,
      isManagerOrAdmin: false,
      userClientId: null as string | null,
    };
  }

  const profile =
    cookieUserId === user.id
      ? preliminaryProfile
      : await fetchProfileCached(supabase, user.id);

  const isManagerOrAdmin =
    profile?.role === 'admin' ||
    profile?.role === 'gestor' ||
    user.email === 'admin@sermail.pt' ||
    user.user_metadata?.role === 'admin';

  const userClientId = profile?.cliente_id || null;

  return {
    supabase,
    user,
    profile,
    isManagerOrAdmin,
    userClientId,
  };
});

