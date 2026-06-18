// netlify/functions/send-confirmation.js
//
// Envía el correo de confirmación al participante usando Resend,
// y marca email_sent = true en Supabase si se envió correctamente.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { first_name, email } = payload;

  if (!first_name || !email) {
    return { statusCode: 400, body: 'Missing first_name or email' };
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const RESEND_FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS || 'NICC <onboarding@resend.dev>';
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!RESEND_API_KEY) {
    return { statusCode: 500, body: 'RESEND_API_KEY no configurada' };
  }

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color:#1C1A17;">
      <h2 style="color:#B5482B; margin-bottom: 4px;">Estás participando 🎉</h2>
      <p style="font-size: 15px; line-height: 1.6;">
        Hola ${first_name},<br><br>
        Estás participando en el giveaway de NICC. Guardá nuestro número en tus contactos
        para cualquier emergencia legal:
      </p>
      <p style="font-size: 18px; font-weight: bold; background:#F6EFE3; padding: 12px 16px; border-radius: 8px;">
        +1 (346) 621-5972
      </p>
      <p style="font-size: 13px; color:#7a7263; margin-top: 24px;">
        — National Injury Claims Council
      </p>
    </div>
  `;

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: RESEND_FROM_ADDRESS,
        to: [email],
        subject: 'Estás participando - NICC',
        html: emailHtml
      })
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error('Resend error:', errBody);
      return { statusCode: 502, body: `Error enviando correo: ${errBody}` };
    }

    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      try {
        await fetch(
          `${SUPABASE_URL}/rest/v1/giveaway_participants?email=eq.${encodeURIComponent(email)}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ email_sent: true })
          }
        );
      } catch (e) {
        console.error('No se pudo marcar email_sent en Supabase:', e);
      }
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };

  } catch (err) {
    console.error('Error inesperado:', err);
    return { statusCode: 500, body: 'Error interno' };
  }
};
