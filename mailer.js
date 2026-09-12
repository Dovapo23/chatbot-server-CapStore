'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Resend } = require('resend');

const NOTIFY_TO = 'thecapstoreonline@gmail.com';
// Dirección remitente: dominio de pruebas de Resend hasta que se verifique un dominio propio.
const FROM = 'The Cap Store Bot <onboarding@resend.dev>';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const fmt = n => `$${Number(n).toLocaleString('es-MX')}`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Envía correo de notificación cuando se confirma un pedido por WhatsApp.
 * Se llama sin await (fire-and-forget) para no bloquear la respuesta al cliente.
 */
async function sendOrderEmail(order) {
  if (!resend) {
    console.warn(`⚠️  RESEND_API_KEY no configurada. Pedido #${order.id} guardado sin notificación de email.`);
    return;
  }

  const filaProductos = order.productos
    .map((p, i) => `<tr>
      <td style="padding:4px 10px">${i + 1}</td>
      <td style="padding:4px 10px">${esc(p.name)}</td>
      <td style="padding:4px 10px">${esc(p.collection)}</td>
      <td style="padding:4px 10px">${fmt(p.price)}</td>
    </tr>`)
    .join('');

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
    <div style="background:#0d1117;padding:20px;text-align:center">
      <h2 style="color:#f5a623;margin:0">🧢 The Cap Store Online</h2>
      <p style="color:#fff;margin:4px 0">Nuevo pedido confirmado vía WhatsApp</p>
    </div>
    <div style="padding:20px">
      <h3 style="color:#0d1117">Pedido #${esc(order.id)} — Ref: <code>${esc(order.referencia)}</code></h3>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <tr style="background:#f5f5f5"><td style="padding:6px 10px;font-weight:bold">Cliente</td><td style="padding:6px 10px">${esc(order.cliente.nombre)}</td></tr>
        <tr><td style="padding:6px 10px;font-weight:bold">Celular</td><td style="padding:6px 10px">${esc(order.cliente.telefono)}</td></tr>
        <tr style="background:#f5f5f5"><td style="padding:6px 10px;font-weight:bold">WhatsApp</td><td style="padding:6px 10px">${esc(order.cliente.whatsapp)}</td></tr>
        <tr><td style="padding:6px 10px;font-weight:bold">Ciudad</td><td style="padding:6px 10px">${esc(order.cliente.ciudad)}</td></tr>
        <tr style="background:#f5f5f5"><td style="padding:6px 10px;font-weight:bold">Departamento</td><td style="padding:6px 10px">${esc(order.cliente.depto)}</td></tr>
        <tr><td style="padding:6px 10px;font-weight:bold">Dirección</td><td style="padding:6px 10px">${esc(order.cliente.direccion)}</td></tr>
        <tr style="background:#f5f5f5"><td style="padding:6px 10px;font-weight:bold">Correo</td><td style="padding:6px 10px">${esc(order.cliente.correo) || '—'}</td></tr>
      </table>

      <h4 style="margin-top:20px;color:#0d1117">Productos:</h4>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <thead>
          <tr style="background:#0d1117;color:#fff">
            <th style="padding:6px 10px">#</th>
            <th style="padding:6px 10px">Producto</th>
            <th style="padding:6px 10px">Colección</th>
            <th style="padding:6px 10px">Precio</th>
          </tr>
        </thead>
        <tbody>${filaProductos}</tbody>
      </table>

      <div style="margin-top:16px;padding:12px;background:#fff8e1;border-left:4px solid #f5a623;border-radius:4px">
        <strong>Total: ${fmt(order.total)}</strong><br>
        <span style="color:#555">💳 Pago: Contra entrega en efectivo</span>
      </div>
    </div>
    <div style="background:#f5f5f5;padding:12px;text-align:center;font-size:12px;color:#888">
      Pedido recibido el ${order.fecha} — Bot de WhatsApp
    </div>
  </div>`;

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: NOTIFY_TO,
      subject: `Nuevo Pedido de ${order.cliente.nombre}`,
      html,
    });
    if (error) throw new Error(error.message || JSON.stringify(error));
    console.log(`📧 Notificación enviada → ${NOTIFY_TO} (Pedido #${order.id})`);
  } catch (err) {
    console.error('❌ Error al enviar correo de notificación:', err.message);
  }
}

/**
 * Envía correo de notificación para pedido al por mayor (> 6 unidades).
 * Subject: "Nuevo Pedido al por mayor [nombre]"
 */
async function sendMayoreoEmail(datos, fecha, whatsapp) {
  if (!resend) {
    console.warn('⚠️  RESEND_API_KEY no configurada. Lead mayoreo sin notificación.');
    return;
  }

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
    <div style="background:#0d1117;padding:20px;text-align:center">
      <h2 style="color:#f5a623;margin:0">🧢 The Cap Store Online</h2>
      <p style="color:#fff;margin:4px 0">📦 Solicitud de pedido al por mayor</p>
    </div>
    <div style="padding:20px">
      <div style="padding:12px;background:#fff3cd;border-left:4px solid #f5a623;border-radius:4px;margin-bottom:16px">
        <strong>⚠️ Este cliente requiere contacto directo — pago anticipado</strong>
      </div>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <tr style="background:#f5f5f5"><td style="padding:8px 12px;font-weight:bold">Cliente</td><td style="padding:8px 12px">${esc(datos.nombre)}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:bold">Celular / WhatsApp</td><td style="padding:8px 12px">${esc(datos.telefono)}</td></tr>
        <tr style="background:#f5f5f5"><td style="padding:8px 12px;font-weight:bold">WhatsApp ID</td><td style="padding:8px 12px">${esc(whatsapp) || '—'}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:bold">Cantidad solicitada</td><td style="padding:8px 12px"><strong>${esc(datos.cantidad)} gorras</strong></td></tr>
        <tr style="background:#f5f5f5"><td style="padding:8px 12px;font-weight:bold">Colección de interés</td><td style="padding:8px 12px">${esc(datos.coleccion)}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:bold">Correo</td><td style="padding:8px 12px">${esc(datos.correo) || '—'}</td></tr>
      </table>
      <div style="margin-top:16px;padding:12px;background:#e8f5e9;border-left:4px solid #4caf50;border-radius:4px">
        💳 <strong>Forma de pago:</strong> Anticipado (transferencia / Nequi / Daviplata)
      </div>
    </div>
    <div style="background:#f5f5f5;padding:12px;text-align:center;font-size:12px;color:#888">
      Solicitud recibida el ${fecha} — Bot de WhatsApp
    </div>
  </div>`;

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: NOTIFY_TO,
      subject: `Nuevo Pedido al por mayor ${datos.nombre}`,
      html,
    });
    if (error) throw new Error(error.message || JSON.stringify(error));
    console.log(`📧 Lead mayoreo enviado → ${NOTIFY_TO} (${datos.nombre})`);
  } catch (err) {
    console.error('❌ Error al enviar correo mayoreo:', err.message);
  }
}

/**
 * Envía correo de notificación cuando alguien usa el formulario de contacto del sitio web.
 */
async function sendContactEmail(nombre, correo, mensaje, fecha) {
  if (!resend) {
    console.warn('⚠️  RESEND_API_KEY no configurada. Mensaje de contacto sin notificación.');
    return;
  }

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
    <div style="background:#0d1117;padding:20px;text-align:center">
      <h2 style="color:#f5a623;margin:0">🧢 The Cap Store Online</h2>
      <p style="color:#fff;margin:4px 0">✉️ Nuevo mensaje del formulario de contacto</p>
    </div>
    <div style="padding:20px">
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <tr style="background:#f5f5f5"><td style="padding:8px 12px;font-weight:bold">Nombre</td><td style="padding:8px 12px">${esc(nombre)}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:bold">Correo</td><td style="padding:8px 12px">${esc(correo)}</td></tr>
      </table>
      <div style="margin-top:16px;padding:12px;background:#fff8e1;border-left:4px solid #f5a623;border-radius:4px;white-space:pre-wrap">${esc(mensaje)}</div>
    </div>
    <div style="background:#f5f5f5;padding:12px;text-align:center;font-size:12px;color:#888">
      Mensaje recibido el ${fecha} — Formulario de contacto web
    </div>
  </div>`;

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: NOTIFY_TO,
      reply_to: correo || undefined,
      subject: `Nuevo mensaje de contacto — ${nombre}`,
      html,
    });
    if (error) throw new Error(error.message || JSON.stringify(error));
    console.log(`📧 Mensaje de contacto enviado → ${NOTIFY_TO} (${nombre})`);
  } catch (err) {
    console.error('❌ Error al enviar correo de contacto:', err.message);
  }
}

module.exports = { sendOrderEmail, sendMayoreoEmail, sendContactEmail };
