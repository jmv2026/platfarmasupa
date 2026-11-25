import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newPassword = typeof body?.password === 'string' ? body.password : '';

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'A palavra-passe deve ter pelo menos 8 caracteres.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Sessão inválida ou expirada. Por favor, inicie sessão novamente.' },
        { status: 401 }
      );
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || 'Não foi possível atualizar a palavra-passe.' },
        { status: 400 }
      );
    }

    // Registar evento de auditoria
    try {
      await supabase.from('audit_logs').insert({
        action: 'PASSWORD_CHANGE',
        entity: 'auth.users',
        entity_id: user.id,
        user_id: user.id,
        user_email: user.email,
        details: {
          source: 'api_update_password',
          timestamp: new Date().toISOString(),
          message: 'Palavra-passe alterada com sucesso pelo utilizador autenticado.',
        },
      });
    } catch {
      // Não-bloqueante
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao atualizar a palavra-passe.' },
      { status: 500 }
    );
  }
}
