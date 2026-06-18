// netlify/functions/admin-participants.js
//
// Devuelve la lista de participantes para el admin panel.
// Protegido con un password simple via header 'x-admin-password'.
//
// Variables de entorno necesarias:
//   SUPABASE_URL
//   SUPABASE_SERVICE_KEY  -> service_role key (secreta, solo en backend)
//   ADMIN_PASSWORD        -> password elegido por vos para entrar al panel

exports.handler = async (event) => {
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  const providedPassword = event.headers['x-admin-password'];

  if (!ADMIN_PASSWORD || providedPassword !== ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Supabase no configurado' }) };
  }

  // GET -> listar participantes
  if (event.httpMethod === 'GET') {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/giveaway_participants?select=*&order=created_at.desc`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
          }
        }
      );
      const data = await res.json();
      return { statusCode: 200, body: JSON.stringify(data) };
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Error consultando Supabase' }) };
    }
  }

  // POST -> marcar ganador { id: "uuid" }
  // Primero resetea is_winner=false en TODOS los participantes, así solo queda
  // marcado el ganador más reciente.
  if (event.httpMethod === 'POST') {
    try {
      const { id } = JSON.parse(event.body);
      if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'Falta id' }) };

      // Resetear cualquier ganador previo
      await fetch(
        `${SUPABASE_URL}/rest/v1/giveaway_participants?is_winner=eq.true`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ is_winner: false })
        }
      );

      // Marcar el nuevo ganador
      await fetch(
        `${SUPABASE_URL}/rest/v1/giveaway_participants?id=eq.${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ is_winner: true })
        }
      );
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Error actualizando Supabase' }) };
    }
  }

  // DELETE -> eliminar participante { id: "uuid" }
  if (event.httpMethod === 'DELETE') {
    try {
      const { id } = JSON.parse(event.body);
      if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'Falta id' }) };

      await fetch(
        `${SUPABASE_URL}/rest/v1/giveaway_participants?id=eq.${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Prefer': 'return=minimal'
          }
        }
      );
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Error eliminando participante' }) };
    }
  }

  return { statusCode: 405, body: 'Method not allowed' };
};