import { Resend } from 'resend';

export interface LinhaPedidoEmail {
  artigo_codigo: string;
  descricao: string;
  lote: string;
  validade?: string | null;
  quantidade: number;
}

export interface EmailPedidoDados {
  nr_pedido: string;
  ref_documento?: string | null;
  cliente_nome: string;
  cliente_sigla: string;
  nome_destinatario: string;
  morada: string;
  codigo_postal: string;
  localidade: string;
  pais?: string;
  data_pedido: string;
  data_entrega?: string | null;
  observacoes?: string | null;
  utilizador_nome?: string | null;
  utilizador_email: string;
  linhas: LinhaPedidoEmail[];
}

export interface EmailEnvioResult {
  success: boolean;
  recipients: string[];
  delivered?: string[];
  failed?: { email: string; reason: string }[];
  data?: unknown;
  error?: string;
  details?: string;
}

/**
 * Criação da instância do cliente Resend
 */
function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.startsWith('re_123456789') || apiKey === 'YOUR_RESEND_API_KEY') {
    return null;
  }
  return new Resend(apiKey);
}

/**
 * Função utilitária para envio robusto de emails via Resend para múltiplos destinatários.
 * Trata restrições do modo sandbox/teste de forma individual para garantir entrega aos destinatários autorizados.
 */
async function enviarMensagemResend(params: {
  from: string;
  recipients: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<EmailEnvioResult> {
  const resend = getResendClient();
  const { from, recipients, subject, html, text } = params;

  if (!resend) {
    const aviso = 'Chave RESEND_API_KEY não configurada ou em modo simulação no .env.local';
    console.warn(`[Resend Email] ${aviso}. Destinatários planeados: ${recipients.join(', ')}`);
    return {
      success: false,
      recipients,
      error: aviso,
    };
  }

  const delivered: string[] = [];
  const failed: { email: string; reason: string }[] = [];
  const responsesData: Record<string, unknown> = {};

  for (const email of recipients) {
    try {
      const response = await resend.emails.send({
        from,
        to: [email],
        subject,
        html,
        text,
      });

      if (response.error) {
        console.warn(`[Resend Email Warning] Falha no envio para ${email}:`, response.error.message);
        failed.push({
          email,
          reason: response.error.message || 'Erro na API Resend',
        });
      } else {
        console.log(`[Resend Email Success] Email entregue para ${email} (ID: ${response.data?.id})`);
        delivered.push(email);
        if (response.data) {
          responsesData[email] = response.data;
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error(`[Resend Email Exception] Erro ao enviar para ${email}:`, errorMsg);
      failed.push({
        email,
        reason: errorMsg,
      });
    }
  }

  const isSuccess = delivered.length > 0;
  let summaryError: string | undefined = undefined;
  let details: string | undefined = undefined;

  if (failed.length > 0) {
    const sandboxFailures = failed.filter(
      (f) =>
        f.reason.includes('testing emails') ||
        f.reason.includes('validation_error') ||
        f.reason.includes('verify a domain')
    );

    if (sandboxFailures.length > 0) {
      details = `Alguns endereços (${sandboxFailures.map((f) => f.email).join(', ')}) requerem validação de domínio em resend.com/domains para envio fora da conta titular (jccmmelo@gmail.com).`;
    }

    if (!isSuccess) {
      summaryError = failed.map((f) => `${f.email}: ${f.reason}`).join(' | ');
    }
  }

  return {
    success: isSuccess,
    recipients,
    delivered,
    failed,
    data: responsesData,
    error: summaryError,
    details,
  };
}

/**
 * Gera o template HTML moderno e responsivo com os dados completos do pedido
 */
export function gerarEmailPedidoHtml(dados: EmailPedidoDados): string {
  const totalUnidades = dados.linhas.reduce((acc, l) => acc + l.quantidade, 0);
  const dataFormatada = new Date(dados.data_pedido).toLocaleDateString('pt-PT');
  const entregaFormatada = dados.data_entrega
    ? new Date(dados.data_entrega).toLocaleDateString('pt-PT')
    : 'Não especificada';

  const linhasHtml = dados.linhas
    .map(
      (l, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px 14px; font-weight: 600; color: #0284c7; font-family: monospace; font-size: 13px;">${l.artigo_codigo}</td>
        <td style="padding: 12px 14px; color: #1e293b; font-size: 13px;">${l.descricao}</td>
        <td style="padding: 12px 14px; color: #475569; font-family: monospace; font-size: 12px;"><span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: 600;">${l.lote}</span></td>
        <td style="padding: 12px 14px; color: #64748b; font-size: 12px;">${l.validade || 'N/D'}</td>
        <td style="padding: 12px 14px; text-align: right; font-weight: 700; color: #0f172a; font-size: 14px;">${l.quantidade}</td>
      </tr>
    `
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmação de Pedido ${dados.nr_pedido}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; line-height: 1.5;">
  <div style="max-width: 680px; margin: 24px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0;">
    
    <!-- Cabeçalho -->
    <div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 32px 28px; text-align: left; color: #ffffff;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td>
            <div style="display: inline-block; background-color: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 8px;">
              Plataforma Farma • Expedição
            </div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff;">Novo Pedido Registado com Sucesso</h1>
            <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">Notificação automática de registo e movimentação de stock</p>
          </td>
          <td style="text-align: right; vertical-align: middle;">
            <div style="background-color: #ffffff; color: #0369a1; padding: 8px 16px; border-radius: 8px; font-weight: 700; font-size: 16px; display: inline-block; font-family: monospace;">
              ${dados.nr_pedido}
            </div>
          </td>
        </tr>
      </table>
    </div>

    <div style="padding: 28px;">
      
      <!-- Cartões de Informação Rápida -->
      <table style="width: 100%; border-collapse: separate; border-spacing: 12px 0; margin-bottom: 24px;">
        <tr>
          <td style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; width: 50%;">
            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600;">Cliente Proprietário</div>
            <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 4px;">${dados.cliente_nome} (${dados.cliente_sigla})</div>
            ${dados.ref_documento ? `<div style="font-size: 12px; color: #64748b; margin-top: 2px;">Ref. Doc: <strong>${dados.ref_documento}</strong></div>` : ''}
          </td>
          <td style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; width: 50%;">
            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600;">Datas do Pedido</div>
            <div style="font-size: 13px; color: #0f172a; margin-top: 4px;">Data: <strong>${dataFormatada}</strong></div>
            <div style="font-size: 13px; color: #0f172a; margin-top: 2px;">Previsão Entrega: <strong>${entregaFormatada}</strong></div>
          </td>
        </tr>
      </table>

      <!-- Dados de Destino -->
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <strong style="color: #166534; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">📍 Dados de Destino & Expedição</strong>
        </div>
        <div style="font-size: 15px; font-weight: 700; color: #14532d; margin-bottom: 4px;">${dados.nome_destinatario}</div>
        <div style="font-size: 13px; color: #166534; line-height: 1.4;">
          ${dados.morada}<br>
          ${dados.codigo_postal} ${dados.localidade} • ${dados.pais || 'Portugal'}
        </div>
      </div>

      <!-- Tabela de Linhas do Pedido -->
      <div style="margin-bottom: 24px;">
        <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">
          📦 Linhas de Artigos (Alocação FEFO)
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background-color: #0f172a; color: #ffffff; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
              <th style="padding: 10px 14px;">Código</th>
              <th style="padding: 10px 14px;">Descrição</th>
              <th style="padding: 10px 14px;">Lote</th>
              <th style="padding: 10px 14px;">Validade</th>
              <th style="padding: 10px 14px; text-align: right;">Qtd</th>
            </tr>
          </thead>
          <tbody>
            ${linhasHtml}
          </tbody>
          <tfoot>
            <tr style="background-color: #e2e8f0; font-weight: 700;">
              <td colspan="4" style="padding: 12px 14px; text-align: right; font-size: 13px; color: #0f172a;">Total de Unidades:</td>
              <td style="padding: 12px 14px; text-align: right; font-size: 15px; color: #0284c7;">${totalUnidades} un</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Observações se existirem -->
      ${
        dados.observacoes
          ? `
      <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 14px; margin-bottom: 24px;">
        <div style="font-size: 12px; font-weight: 700; color: #92400e; text-transform: uppercase; margin-bottom: 4px;">Observações:</div>
        <div style="font-size: 13px; color: #78350f;">${dados.observacoes}</div>
      </div>
      `
          : ''
      }

      <!-- Informação do Utilizador Solicitante -->
      <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #64748b;">
        <p style="margin: 0 0 4px 0;">
          <strong>Pedido submetido por:</strong> ${dados.utilizador_nome || 'Utilizador'} &lt;${dados.utilizador_email}&gt;
        </p>
        <p style="margin: 0;">
          <strong>Movimentação de Stock:</strong> Saída de Stock (SS) registada no Armazém 01 (${dados.cliente_sigla}-01).
        </p>
      </div>

    </div>

    <!-- Rodapé -->
    <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 28px; text-align: center; font-size: 11px; color: #94a3b8;">
      <p style="margin: 0 0 6px 0;">
        Este é um email automático gerado pela <strong>Plataforma Farma • Sermail</strong>.
      </p>
      <p style="margin: 0;">
        Notificação enviada ao requerente e à equipa técnica (joao.melo@sermail.pt).
      </p>
    </div>

  </div>
</body>
</html>
  `.trim();
}

/**
 * Gera a versão em texto simples do email
 */
export function gerarEmailPedidoTexto(dados: EmailPedidoDados): string {
  const totalUnidades = dados.linhas.reduce((acc, l) => acc + l.quantidade, 0);
  const linhasTexto = dados.linhas
    .map(
      (l) =>
        `- ${l.artigo_codigo} | ${l.descricao} | Lote: ${l.lote} | Validade: ${l.validade || 'N/D'} | Qtd: ${l.quantidade} un`
    )
    .join('\n');

  return `
PLATAFORMA FARMA - NOVO PEDIDO REGISTADO (${dados.nr_pedido})
=================================================================

DETALHES DO PEDIDO:
- Número do Pedido: ${dados.nr_pedido}
- Cliente Proprietário: ${dados.cliente_nome} (${dados.cliente_sigla})
- Referência Documento: ${dados.ref_documento || 'N/A'}
- Data do Pedido: ${dados.data_pedido}
- Previsão de Entrega: ${dados.data_entrega || 'N/A'}
- Requerente: ${dados.utilizador_nome || ''} (${dados.utilizador_email})

DADOS DE DESTINO:
- Destinatário: ${dados.nome_destinatario}
- Morada: ${dados.morada}
- Código Postal / Localidade: ${dados.codigo_postal} ${dados.localidade}
- País: ${dados.pais || 'Portugal'}

ARTIGOS E LOTES ALOCADOS (FEFO):
${linhasTexto}

Total de Unidades: ${totalUnidades} un

${dados.observacoes ? `OBSERVAÇÕES:\n${dados.observacoes}\n` : ''}
=================================================================
Este email foi gerado automaticamente pela Plataforma Farma.
Notificação enviada a: ${dados.utilizador_email} e joao.melo@sermail.pt
`.trim();
}

/**
 * Envia o email de notificação de pedido para o utilizador e contas de administração configuradas
 */
export async function enviarEmailConfirmacaoPedido(dados: EmailPedidoDados): Promise<EmailEnvioResult> {
  const adminNotification = process.env.RESEND_NOTIFICATION_EMAIL || 'jccmmelo@gmail.com';
  const defaultAdmin = 'joao.melo@sermail.pt';
  const userEmail = (dados.utilizador_email || '').toLowerCase().trim();

  // Gerar lista de destinatários únicos
  const recipients = Array.from(
    new Set([userEmail, adminNotification, defaultAdmin].filter((email) => email && email.includes('@')))
  );

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Plataforma Farma <onboarding@resend.dev>';
  const subject = `[Plataforma Farma] Pedido Registado: ${dados.nr_pedido} - ${dados.nome_destinatario}`;
  const html = gerarEmailPedidoHtml(dados);
  const text = gerarEmailPedidoTexto(dados);

  return enviarMensagemResend({
    from: fromEmail,
    recipients,
    subject,
    html,
    text,
  });
}

export interface EmailTesteAdminDados {
  adminEmail?: string;
  destinatarios?: string[];
  solicitanteNome?: string | null;
  solicitanteEmail?: string | null;
}

/**
 * Gera o template HTML para o email de teste administrativo
 */
export function gerarEmailTesteHtml(dados: EmailTesteAdminDados, timestamp: string): string {
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Plataforma Farma <onboarding@resend.dev>';
  const listDestinatarios = dados.destinatarios && dados.destinatarios.length > 0
    ? dados.destinatarios.join(', ')
    : (dados.adminEmail || 'jccmmelo@gmail.com, joao.melo@sermail.pt');

  return `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Teste de Comunicação Resend</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; line-height: 1.5;">
  <div style="max-width: 650px; margin: 24px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0284c7 0%, #0f172a 100%); padding: 32px 28px; text-align: left; color: #ffffff;">
      <div style="display: inline-block; background-color: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 8px;">
        ✉️ Teste de Diagnóstico • Painel de Configuração
      </div>
      <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff;">Validação de Envio de Email (Resend)</h1>
      <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Mensagem de confirmação enviada com sucesso para os Administradores</p>
    </div>

    <div style="padding: 28px;">
      
      <!-- Mensagem de Sucesso -->
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <strong style="color: #166534; font-size: 14px;">✔ Ligação com o Resend operacional e verificada!</strong>
        </div>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: #15803d;">
          Este email confirma que a integração entre a <strong>Plataforma Farma</strong> e o motor de envio <strong>Resend</strong> está ativa e pronta para emitir notificações automáticas de expedição.
        </p>
      </div>

      <!-- Tabela de Diagnóstico do Sistema -->
      <div style="margin-bottom: 24px;">
        <div style="font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
          Parametrização & Diagnóstico do Envio
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; font-size: 13px;">
          <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 14px; font-weight: 600; color: #64748b; width: 35%;">Remetente (From):</td>
            <td style="padding: 10px 14px; font-weight: 600; color: #0f172a; font-family: monospace;">${fromEmail}</td>
          </tr>
          <tr style="background-color: #ffffff; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 14px; font-weight: 600; color: #64748b;">Destinatários de Teste:</td>
            <td style="padding: 10px 14px; color: #0284c7; font-weight: 600;">${listDestinatarios}</td>
          </tr>
          <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 14px; font-weight: 600; color: #64748b;">Solicitado Por:</td>
            <td style="padding: 10px 14px; color: #334155;">${dados.solicitanteNome || 'Administrador'} (${dados.solicitanteEmail || 'admin@sermail.pt'})</td>
          </tr>
          <tr style="background-color: #ffffff;">
            <td style="padding: 10px 14px; font-weight: 600; color: #64748b;">Data & Hora do Envio:</td>
            <td style="padding: 10px 14px; color: #334155;">${timestamp}</td>
          </tr>
        </table>
      </div>

      <!-- Demonstração de Pedido -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <div style="font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 6px;">
          📦 Demonstração do Formato de Notificação de Pedido:
        </div>
        <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.4;">
          Quando qualquer utilizador submete um pedido no menu <strong>Pedidos & Expedição</strong>, o sistema calcula os lotes pelo critério <strong>FEFO</strong>, debita os movimentos de saída (<strong>SS</strong>) e dispara um email com todos os detalhes e morada de destino para o requerente e equipa de logística.
        </p>
      </div>

    </div>

    <!-- Rodapé -->
    <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 28px; text-align: center; font-size: 11px; color: #94a3b8;">
      <p style="margin: 0 0 4px 0;">
        Plataforma Farma • Sermail, Logística Integrada Lda.
      </p>
      <p style="margin: 0;">
        Email de teste gerado pela Aba de Configuração de Emails.
      </p>
    </div>

  </div>
</body>
</html>
  `.trim();
}

/**
 * Envia o email de teste administrativo via Resend
 */
export async function enviarEmailTesteAdmin(dados: EmailTesteAdminDados): Promise<EmailEnvioResult> {
  const rawList: string[] = [];

  if (dados.destinatarios && dados.destinatarios.length > 0) {
    rawList.push(...dados.destinatarios);
  }
  if (dados.adminEmail) {
    rawList.push(...dados.adminEmail.split(/[,;\s]+/));
  }

  // Se nenhum destino foi passado, usar lista padrão de supervisão
  if (rawList.length === 0) {
    rawList.push('jccmmelo@gmail.com', 'joao.melo@sermail.pt');
  }

  const recipients = Array.from(
    new Set(rawList.map((e) => e.toLowerCase().trim()).filter((e) => e && e.includes('@')))
  );

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Plataforma Farma <onboarding@resend.dev>';
  const timestamp = new Date().toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' });
  const subject = `[Plataforma Farma] ✉️ Teste de Comunicação Resend - ${timestamp}`;
  const html = gerarEmailTesteHtml({ ...dados, destinatarios: recipients }, timestamp);
  const text = `
PLATAFORMA FARMA - TESTE DE COMUNICAÇÃO RESEND
=================================================
Data e Hora: ${timestamp}
Remetente: ${fromEmail}
Destinatários: ${recipients.join(', ')}
Solicitado por: ${dados.solicitanteNome || 'Admin'} (${dados.solicitanteEmail || 'admin@sermail.pt'})

Este é um email de validação emitido através da aba Email na Página de Configurações da Plataforma Farma.
A integração com o Resend está operacional.
=================================================
`.trim();

  return enviarMensagemResend({
    from: fromEmail,
    recipients,
    subject,
    html,
    text,
  });
}
