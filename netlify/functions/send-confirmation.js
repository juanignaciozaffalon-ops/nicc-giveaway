// netlify/functions/send-confirmation.js
//
// Envía el correo de confirmación al participante usando Resend,
// y marca email_sent = true en Supabase si se envió correctamente.
//
// Variables de entorno necesarias (configurar en Netlify > Site settings > Environment variables):
//   RESEND_API_KEY        -> API key de Resend
//   RESEND_FROM_ADDRESS   -> ej: "NICC <giveaway@nicc.com>" (debe ser un dominio verificado en Resend)
//   SUPABASE_URL          -> https://YOUR_PROJECT.supabase.co
//   SUPABASE_SERVICE_KEY  -> service_role key de Supabase (NUNCA la anon key, esta es secreta)

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
    <!doctype html>
    <html>
    <body style="margin:0; padding:0; background-color:#f4f1ec; font-family: Arial, Helvetica, sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f1ec; padding: 24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:10px; overflow:hidden; max-width:480px;">
              <tr>
                <td style="background-color:#1A1814; padding:20px 28px;">
                  <span style="color:#E0A030; font-size:13px; font-weight:bold; letter-spacing:1px;">NATIONAL INJURY CLAIMS COUNCIL</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 28px 28px 8px;">
                  <p style="font-size:16px; line-height:1.6; color:#1C1A17; margin:0 0 14px;">Hola ${first_name},</p>
                  <p style="font-size:15px; line-height:1.6; color:#3a352c; margin:0 0 14px;">
                    Gracias por registrarte en nuestro giveaway. Tu registro quedó confirmado y ya estás participando del sorteo.
                  </p>
                  <p style="font-size:15px; line-height:1.6; color:#3a352c; margin:0 0 18px;">
                    Te recomendamos guardar nuestro número de contacto, por si en algún momento necesitás asesoría legal luego de un accidente:
                  </p>
                  <p style="font-size:16px; color:#1C1A17; margin:0 0 20px; padding: 10px 0; border-top:1px solid #eee; border-bottom:1px solid #eee;">
                    National Injury Claims Council<br>
                    Teléfono: +1 (346) 621-5972
                  </p>
                  <p style="font-size:14px; line-height:1.6; color:#6b6358; margin:0 0 6px;">
                    El ganador se anunciará próximamente en nuestra cuenta de Instagram.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 18px 28px 26px;">
                  <p style="font-size:12.5px; color:#9a9285; margin:0;">
                    Recibiste este correo porque te registraste en un giveaway de National Injury Claims Council.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const emailText =
`Hola ${first_name},

Gracias por registrarte en nuestro giveaway. Tu registro quedó confirmado y ya estás participando del sorteo.

Te recomendamos guardar nuestro número de contacto, por si en algún momento necesitás asesoría legal luego de un accidente:

National Injury Claims Council
Teléfono: +1 (346) 621-5972

El ganador se anunciará próximamente en nuestra cuenta de Instagram.

—
Recibiste este correo porque te registraste en un giveaway de National Injury Claims Council.`;

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
        subject: 'Tu registro está confirmado - National Injury Claims Council',
        html: emailHtml,
        text: emailText
      })
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error('Resend error:', errBody);
      return { statusCode: 502, body: `Error enviando correo: ${errBody}` };
    }

    // Marcar email_sent = true en Supabase (best-effort, no bloquea la respuesta)
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
