import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
    const userEmail = typeof body?.userEmail === 'string' ? body.userEmail.trim() : '';
    const userName = typeof body?.userName === 'string' ? body.userName.trim() : '';
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

    if (!userId || !userEmail) {
      return NextResponse.json(
        { error: 'Utilizador e email são obrigatórios.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'A nova password deve ter pelo menos 8 caracteres.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user: adminUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !adminUser) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    // 1. Executar reset da password via RPC segura (valida role admin/gestor)
    const { error: rpcError } = await supabase.rpc('reset_user_password_by_admin', {
      p_user_id: userId,
      p_new_password: newPassword,
    });

    if (rpcError) {
      return NextResponse.json(
        { error: rpcError.message || 'Erro ao efetuar reset da password.' },
        { status: 403 }
      );
    }

    // 2. Enviar a nova password por email via Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Plataforma Farma <noreplay@platfarma.sermaildev.cloud>';

    if (!resendApiKey) {
      return NextResponse.json(
        {
          success: true,
          emailSent: false,
          warning: 'Password atualizada, mas RESEND_API_KEY não está configurada para envio de email.',
        },
        { status: 200 }
      );
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #00382b; margin-top: 0;">Plataforma Farma — Sermail</h2>
        <p style="color: #334155; font-size: 14px;">Olá${userName ? ` <strong>${userName}</strong>` : ''},</p>
        <p style="color: #334155; font-size: 14px;">
          A sua palavra-passe de acesso à <strong>Plataforma Farma</strong> foi redefinida pelo administrador.
        </p>
        <div style="margin: 20px 0; padding: 16px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; text-align: center;">
          <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Nova Palavra-passe</p>
          <p style="margin: 0; font-size: 20px; font-weight: bold; color: #0f172a; font-family: monospace; letter-spacing: 0.05em;">${newPassword}</p>
        </div>
        <p style="color: #64748b; font-size: 12px;">
          Por motivos de segurança, recomendamos que guarde esta credencial em local seguro.
        </p>
      </div>
    `;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [userEmail],
        subject: 'Plataforma Farma — Nova Palavra-passe de Acesso',
        html: emailHtml,
      }),
    });

    if (!resendRes.ok) {
      const resendErr = await resendRes.text();
      return NextResponse.json(
        {
          success: true,
          emailSent: false,
          warning: `Password atualizada na base de dados, mas falhou o envio do email: ${resendErr}`,
        },
        { status: 200 }
      );
    }

    // 3. Registar em audit_logs
    try {
      await supabase.from('audit_logs').insert({
        action: 'ADMIN_PASSWORD_RESET',
        entity: 'auth.users',
        entity_id: userId,
        user_id: adminUser.id,
        user_email: adminUser.email,
        details: {
          target_user_id: userId,
          target_user_email: userEmail,
          email_sent: true,
          timestamp: new Date().toISOString(),
        },
      });
    } catch {
      // Não-bloqueante
    }

    return NextResponse.json({ success: true, emailSent: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao processar reset de password.' },
      { status: 500 }
    );
  }
}
