// API de Conversões (CAPI) do Meta — reenvia eventos do navegador pelo servidor
// com o MESMO event_id, permitindo a deduplicação no Gerenciador de Eventos.
// Requer a variável de ambiente FB_CAPI_TOKEN configurada na Vercel
// (Gerenciador de Eventos > Configurações > API de Conversões > Gerar token).

const PIXEL_ID = '1660742761748533';
const ALLOWED_EVENTS = ['PageView', 'ViewContent', 'Contact'];

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const token = process.env.FB_CAPI_TOKEN;
  if (!token) return res.status(200).json({ skipped: 'FB_CAPI_TOKEN não configurado' });

  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!ALLOWED_EVENTS.includes(b.event_name)) return res.status(400).json({ error: 'evento não permitido' });
    if (!b.event_id) return res.status(400).json({ error: 'event_id obrigatório' });

    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const ua = req.headers['user-agent'] || '';

    const event = {
      event_name: b.event_name,
      event_time: Math.floor(Date.now() / 1000),
      event_id: String(b.event_id),
      action_source: 'website',
      event_source_url: b.event_source_url || '',
      user_data: {
        client_ip_address: ip,
        client_user_agent: ua,
        ...(b.fbp ? { fbp: b.fbp } : {}),
        ...(b.fbc ? { fbc: b.fbc } : {})
      },
      ...(b.custom_data && typeof b.custom_data === 'object' ? { custom_data: b.custom_data } : {})
    };

    const r = await fetch(`https://graph.facebook.com/v21.0/${PIXEL_ID}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [event], access_token: token })
    });
    const j = await r.json();
    return res.status(r.ok ? 200 : 502).json(r.ok ? { success: true } : { error: j.error && j.error.message });
  } catch (e) {
    return res.status(500).json({ error: 'internal' });
  }
}
