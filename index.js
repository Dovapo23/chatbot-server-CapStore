'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode   = require('qrcode-terminal');
const path     = require('path');
const fs       = require('fs');
const express  = require('express');
const cors     = require('cors');
const { collections } = require('./products');
const { findCity, listadoCiudades } = require('./cities');
const { sendOrderEmail, sendMayoreoEmail } = require('./mailer');

// ─── PATHS ────────────────────────────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, 'data', 'customers.json');

// ─── STORAGE ──────────────────────────────────────────────────────────────────
function loadOrders() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return []; }
}

function saveOrder(order) {
  const orders = loadOrders();
  order.id = orders.length + 1;
  order.timestamp = Date.now();    // para comparación de duplicados
  orders.push(order);
  fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2), 'utf8');
  return order.id;
}

// Detecta pedido duplicado: mismo teléfono + mismos productos en los últimos 10 min
function isDuplicateOrder(telefono, cart) {
  const orders = loadOrders();
  const cutoff = Date.now() - 10 * 60 * 1000;
  return orders.some(o => {
    if (!o.timestamp || o.timestamp < cutoff) return false;
    if (o.cliente.telefono !== telefono) return false;
    if (o.productos.length !== cart.length) return false;
    return cart.every((item, i) => o.productos[i] && String(o.productos[i].id) === String(item.id));
  });
}

// ─── SESSION STATE ────────────────────────────────────────────────────────────
// Un objeto por chat activo: state + carrito + datos del cliente
const sessions = new Map();

function getSession(chatId) {
  if (!sessions.has(chatId)) sessions.set(chatId, newSession());
  return sessions.get(chatId);
}

function newSession() {
  return {
    state: 'menu',      // estado actual del flujo
    collection: null,   // clave de la colección activa ('agropecuario'|'luxury'|'colombia')
    currentProduct: null,
    cart: [],           // [{ id, name, price, collection }]
    datos: {},          // { nombre, telefono, direccion, ciudad, depto, correo }
    datosMayoreo: {},   // { nombre, telefono, cantidad, coleccion, correo }
    referencia: null,   // referencia única del pedido (generada al entrar en confirmacion)
    prevState: null,    // estado anterior al desvío de consulta_ciudad / mayoreo
    ciudadCandidatos: null  // candidatos cuando hay ambigüedad
  };
}

function resetSession(chatId) {
  sessions.set(chatId, newSession());
}

// ─── UTILIDADES ───────────────────────────────────────────────────────────────
const fmt = n => `$${n.toLocaleString('es-MX')}`;

// Normaliza texto para comparaciones: minúsculas + sin tildes
function norm(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

const cartTotal = cart => cart.reduce((s, i) => s + i.price, 0);

async function send(chatId, text) {
  await client.sendMessage(chatId, text);
}

async function sendImg(chatId, imgPath, caption) {
  try {
    const media = MessageMedia.fromFilePath(imgPath);
    await client.sendMessage(chatId, media, { caption });
  } catch (err) {
    console.error('❌ Imagen no encontrada:', imgPath);
    await send(chatId, `_(imagen no disponible — ${caption})_`);
  }
}

// Respuestas afirmativas y negativas aceptadas
const ES_SI = ['si', 's', 'yes', 'dale', 'claro', 'ok', 'okay', 'sip', 'yep'];
const ES_NO = ['no', 'n', 'nope', 'nel', 'nanai'];

// Palabras clave que activan la info de descuentos / venta al por mayor
const DISCOUNT_TRIGGERS = [
  'descuento', 'descuentos', 'precio especial', 'por mayor', 'mayoreo',
  'mayorista', 'varias gorras', 'muchas gorras', 'precio para varios',
  'precio para mucho', 'gorras para', 'pedido grande', 'vendo gorras',
  'revender', 'reventa', 'al por mayor', 'mas de', 'cuantas puedo pedir',
];

// Palabras clave que activan la consulta de cobertura de envío
const CITY_QUERY_TRIGGERS = [
  'ciudades', 'que ciudades', 'cuales ciudades', 'donde envian', 'donde despachan',
  'envian a', 'despachan a', 'tienen envio', 'hacen envio', 'envio gratis',
  'envio incluido', 'envio free', 'cobertura', 'a donde llegan', 'hasta donde',
  'donde llegan', 'llegan a', 'entregan en', 'hacen entregas'
];

// ─── TEXTOS ───────────────────────────────────────────────────────────────────
function txtMenu() {
  return (
    `¡Hola! 👋 Bienvenido a *🧢 The Cap Store Online*\n` +
    `Tu tienda de gorras colombianas de calidad.\n` +
    `💰 Agropecuario & Colombia: *${fmt(75000)}* | Luxury: *${fmt(70000)}* c/u\n\n` +
    `¿Qué colección quieres ver?\n\n` +
    `*1* — 🌾 Colección Agropecuario 2026\n` +
    `*2* — 💎 New Era Colección Luxury\n` +
    `*3* — 🇨🇴 República de Colombia\n` +
    `*4* — 🛒 Ver mi carrito\n` +
    `*5* — 📞 Contacto\n` +
    `*6* — 🎁 Descuentos y pedidos al por mayor\n` +
    `*7* — 📦 Ciudades con envío incluido\n\n` +
    `_Escribe el número de tu elección_`
  );
}

function txtContacto() {
  return (
    `📞 *Contacto The Cap Store Online*\n\n` +
    `📱 WhatsApp: este mismo número\n` +
    `📍 Colombia\n` +
    `⏰ Atención: Lun–Sáb 8am–8pm\n\n` +
    `_Escribe *menu* para volver_`
  );
}

// ─── HANDLER: MENÚ ───────────────────────────────────────────────────────────
async function handleMenu(chatId, text, session) {
  if (text === '1') return startCollection(chatId, session, 'agropecuario');
  if (text === '2') return startCollection(chatId, session, 'luxury');
  if (text === '3') return startCollection(chatId, session, 'colombia');
  if (text === '4') return showCart(chatId, session);
  if (text === '5') return send(chatId, txtContacto());
  if (text === '6') return iniciarDescuento(chatId, session);
  if (text === '7') return iniciarConsultaCiudad(chatId, session);
  await send(chatId, txtMenu());
}

async function startCollection(chatId, session, key) {
  session.collection = key;
  session.state = 'collection';
  await sendCollectionList(chatId, key);
}

async function sendCollectionList(chatId, key) {
  const col = collections[key];
  let msg = `${col.emoji} *${col.nombre}*\n💰 Precio: *${fmt(col.precio)}* c/u\n\n`;
  col.products.forEach((p, i) => { msg += `*${i + 1}*. ${p.name}\n`; });
  msg += `\nEscribe el *número* del producto para ver la foto.\n_*0* para volver al menú_`;
  await send(chatId, msg);
}

// ─── HANDLER: COLECCIÓN (lista) ────────────────────────────────────────────
async function handleCollection(chatId, text, session) {
  if (text === '0') { resetSession(chatId); return send(chatId, txtMenu()); }

  const col = collections[session.collection];
  const idx = parseInt(text, 10) - 1;

  if (isNaN(idx) || idx < 0 || idx >= col.products.length) {
    return send(chatId, `⚠️ Número inválido. Escribe del *1* al *${col.products.length}*, o *0* para el menú.`);
  }

  const product = col.products[idx];
  session.currentProduct = product;
  session.state = 'viewing_product';

  await sendImg(chatId, product.image, `🧢 *${product.name}*\n💰 ${fmt(product.price)}`);
  await send(
    chatId,
    `¿Quieres agregar *${product.name}* al carrito?\n\n` +
    `✅ *sí* — agregar\n` +
    `🔙 *no* — ver otra gorra\n` +
    `🏠 *0* — menú principal`
  );
}

// ─── HANDLER: VIENDO PRODUCTO ─────────────────────────────────────────────
async function handleViewingProduct(chatId, text, session) {
  if (text === '0') { resetSession(chatId); return send(chatId, txtMenu()); }

  if (ES_SI.includes(text)) {
    const p = session.currentProduct;
    session.cart.push({ id: p.id, name: p.name, price: p.price, collection: session.collection });
    session.currentProduct = null;
    session.state = 'more_products';

    const total = cartTotal(session.cart);
    return send(
      chatId,
      `✅ *${p.name}* agregada al carrito!\n` +
      `🛒 Carrito: ${session.cart.length} gorra${session.cart.length > 1 ? 's' : ''} — *${fmt(total)}*\n\n` +
      `¿Quieres ver más gorras?\n\n` +
      `*sí* — seguir comprando\n` +
      `*no* — ir a pagar`
    );
  }

  if (ES_NO.includes(text)) {
    session.currentProduct = null;
    session.state = 'collection';
    return sendCollectionList(chatId, session.collection);
  }

  await send(chatId, `Responde *sí* para agregar, *no* para ver otra, o *0* para el menú.`);
}

// ─── HANDLER: ¿MÁS PRODUCTOS? ────────────────────────────────────────────
async function handleMoreProducts(chatId, text, session) {
  if (ES_SI.includes(text)) {
    session.state = 'collection';
    return sendCollectionList(chatId, session.collection);
  }
  if (ES_NO.includes(text)) {
    if (session.cart.length === 0) { resetSession(chatId); return send(chatId, txtMenu()); }
    session.state = 'datos_nombre';
    return send(chatId, `📝 *Datos de entrega*\n\n¿Cuál es tu *nombre completo*?`);
  }
  await send(chatId, `Responde *sí* para seguir comprando o *no* para pagar.`);
}

// ─── HANDLERS: DESCUENTOS Y VENTA AL POR MAYOR ───────────────────────────

function txtDescuentoInfo() {
  return (
    `🎁 *Descuentos por volumen — The Cap Store Online*\n\n` +
    `Aplicamos descuento especial a partir de *3 gorras* en el mismo pedido.\n\n` +
    `📦 *Pedido normal:* de 3 a *6 unidades* (precio con descuento incluido)\n` +
    `🏭 *Venta al por mayor:* más de *6 gorras*\n` +
    `   • Precio especial negociado directamente\n` +
    `   • 💳 Pago *anticipado* (Nequi / Daviplata / transferencia)\n` +
    `   • Te contactamos por WhatsApp para coordinar\n\n` +
    `¿Te interesa un pedido al por mayor (más de 6 gorras)?\n\n` +
    `*sí* — dejar mis datos para que me contacten\n` +
    `*no* — volver al menú`
  );
}

async function iniciarDescuento(chatId, session) {
  session.prevState = session.state;
  session.datosMayoreo = {};
  session.state = 'mayoreo_intro';
  await send(chatId, txtDescuentoInfo());
}

async function handleMayoreoIntro(chatId, text, session) {
  if (ES_SI.includes(text)) {
    session.state = 'mayoreo_nombre';
    return send(chatId, `📝 *Pedido al por mayor*\n\n👤 ¿Cuál es tu *nombre completo*?`);
  }
  if (ES_NO.includes(text) || text === '0') {
    session.state = session.prevState || 'menu';
    session.prevState = null;
    return send(chatId, txtMenu());
  }
  await send(chatId, `Responde *sí* para dejar tus datos o *no* para volver al menú.`);
}

async function handleMayoreoNombre(chatId, rawText, session) {
  if (rawText.trim().length < 3) {
    return send(chatId, `⚠️ Por favor escribe tu *nombre completo* (mín. 3 caracteres).`);
  }
  session.datosMayoreo.nombre = rawText.trim();
  session.state = 'mayoreo_telefono';
  await send(chatId, `📱 ¿Cuál es tu número de *celular / WhatsApp*?\n_Solo dígitos, ej: 3001234567_`);
}

async function handleMayoreoTelefono(chatId, rawText, session) {
  const digits = rawText.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) {
    return send(chatId, `⚠️ Número inválido. Ingresa solo dígitos, ej: *3001234567*`);
  }
  session.datosMayoreo.telefono = digits;
  session.state = 'mayoreo_cantidad';
  await send(chatId, `📦 ¿Cuántas gorras necesitas?\n_Recuerda: para pedidos al por mayor son más de 6 unidades_`);
}

async function handleMayoreoCantidad(chatId, rawText, session) {
  const n = parseInt(rawText.replace(/\D/g, ''), 10);
  if (isNaN(n) || n < 1) {
    return send(chatId, `⚠️ Escribe la cantidad en número, ej: *10*`);
  }
  if (n <= 6) {
    return send(
      chatId,
      `ℹ️ Para *${n} gorras* aplica el pedido normal con descuento incluido.\n\n` +
      `Puedes hacer tu pedido directamente desde el catálogo.\n` +
      `_Escribe *menu* para ver las colecciones o *sí* si igual quieres que te contactemos._`
    );
  }
  session.datosMayoreo.cantidad = n;
  session.state = 'mayoreo_coleccion';
  await send(
    chatId,
    `🧢 ¿Qué colección(es) te interesan?\n\n` +
    `*1* — 🌾 Agropecuario 2026\n` +
    `*2* — 💎 New Era Luxury\n` +
    `*3* — 🇨🇴 República de Colombia\n` +
    `*4* — Varias / Todas\n\n` +
    `_Escribe el número o el nombre_`
  );
}

async function handleMayoreoColeccion(chatId, rawText, session) {
  const t = norm(rawText);
  let col;
  if (t === '1' || t.includes('agro'))    col = 'Agropecuario 2026';
  else if (t === '2' || t.includes('lux') || t.includes('new era')) col = 'New Era Luxury';
  else if (t === '3' || t.includes('colombia') || t.includes('tricolor')) col = 'República de Colombia';
  else if (t === '4' || t.includes('varia') || t.includes('toda')) col = 'Varias / Todas';
  else col = rawText.trim();

  session.datosMayoreo.coleccion = col;
  session.state = 'mayoreo_correo';
  await send(chatId, `📧 ¿Cuál es tu *correo electrónico*?\n_Escribe *no* si prefieres no darlo_`);
}

async function handleMayoreoCorreo(chatId, rawText, session) {
  const t = norm(rawText.trim());
  if (t === 'no' || t === 'n') {
    session.datosMayoreo.correo = null;
  } else if (rawText.includes('@') && rawText.includes('.')) {
    session.datosMayoreo.correo = rawText.trim().toLowerCase();
  } else {
    return send(chatId, `⚠️ Correo inválido. Ingresa uno válido o escribe *no* para omitirlo.`);
  }
  session.state = 'mayoreo_confirmar';
  await sendResumenMayoreo(chatId, session);
}

async function sendResumenMayoreo(chatId, session) {
  const m = session.datosMayoreo;
  let msg = `📋 *Resumen — Pedido al por mayor*\n\n`;
  msg += `👤 *Nombre:* ${m.nombre}\n`;
  msg += `📱 *Celular:* ${m.telefono}\n`;
  msg += `📦 *Cantidad:* ${m.cantidad} gorras\n`;
  msg += `🧢 *Colección:* ${m.coleccion}\n`;
  if (m.correo) msg += `📧 *Correo:* ${m.correo}\n`;
  msg += `\n💳 *Pago:* Anticipado\n\n`;
  msg += `Nos contactaremos contigo para coordinar precio y entrega.\n\n`;
  msg += `¿Confirmamos el registro?\n\n✅ *sí* — confirmar\n❌ *no* — cancelar`;
  await send(chatId, msg);
}

async function handleMayoreoConfirmar(chatId, text, session) {
  if (ES_SI.includes(text)) {
    const m     = session.datosMayoreo;
    const fecha = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
    const wa    = chatId.replace('@c.us', '');

    console.log(`\n🏭  Mayoreo — ${m.nombre} — ${m.cantidad} gorras (${m.coleccion})`);
    sendMayoreoEmail(m, fecha, wa).catch(err => console.error('Mailer mayoreo:', err.message));

    session.datosMayoreo = {};
    session.state = 'menu';
    await send(
      chatId,
      `✅ *¡Registro recibido!* 🎉\n\n` +
      `Nos contactaremos pronto al *${m.telefono}* para coordinar tu pedido al por mayor.\n\n` +
      `💳 Recuerda: el pago es *anticipado*.\n\n` +
      `¡Gracias por elegir *The Cap Store Online*! 🧢🙏\n\n` +
      `_Escribe *menu* para volver al inicio_`
    );
    return;
  }
  if (ES_NO.includes(text)) {
    session.datosMayoreo = {};
    session.state = 'menu';
    return send(chatId, `❌ Registro cancelado.\n\n${txtMenu()}`);
  }
  await send(chatId, `Por favor responde *sí* para confirmar o *no* para cancelar.`);
}

// ─── HANDLERS: CONSULTA DE COBERTURA DE CIUDADES ─────────────────────────

// Inicia el desvío de consulta guardando el estado anterior
async function iniciarConsultaCiudad(chatId, session) {
  session.prevState = session.state === 'consulta_ciudad' ? (session.prevState || 'menu') : session.state;
  session.ciudadCandidatos = null;
  session.state = 'consulta_ciudad';
  await send(
    chatId,
    `📦 *Cobertura de envío — The Cap Store Online*\n\n` +
    `Hacemos envíos a las capitales de todos los departamentos de Colombia.\n` +
    `En esas ciudades el envío es *incluido* y el pago es *contra entrega en efectivo*. 🎉\n\n` +
    `¿En qué *ciudad y departamento* te encuentras?\n` +
    `_Escríbelo así: "Medellín, Antioquia" o solo la ciudad_`
  );
}

async function handleConsultaCiudad(chatId, rawText, session) {
  const text = norm(rawText);

  // Si el usuario pide el listado completo
  if (['lista', 'listar', 'todas', 'ver todas', 'ver lista'].some(k => text.includes(k))) {
    await send(
      chatId,
      `📦 *Ciudades con envío incluido y pago contra entrega:*\n\n` +
      listadoCiudades() + `\n\n` +
      `_¿Tu ciudad está en la lista? Escríbeme el nombre para confirmarlo._`
    );
    return; // permanece en consulta_ciudad esperando la ciudad del cliente
  }

  // Caso: había candidatos ambiguos del paso anterior → el usuario aclara
  if (session.ciudadCandidatos) {
    const idx = parseInt(text, 10) - 1;
    if (!isNaN(idx) && idx >= 0 && idx < session.ciudadCandidatos.length) {
      const entry = session.ciudadCandidatos[idx];
      session.ciudadCandidatos = null;
      await responderCobertura(chatId, entry, session);
      return;
    }
    // Si escribió algo diferente a un número, volver a buscar con el nuevo texto
    session.ciudadCandidatos = null;
  }

  const result = findCity(rawText);

  if (result === null) {
    await send(
      chatId,
      `😔 *${rawText.trim()}* no está en nuestra cobertura de envío incluido.\n\n` +
      `Para enviar a esa ciudad debes realizar el pago del *producto + costo de envío* por adelantado.\n` +
      `Contáctanos para coordinar tu pedido y cotizar el envío. 📞\n\n` +
      `_Escribe *lista* para ver las ciudades cubiertas o *menu* para volver_`
    );
    await restaurarEstado(chatId, session);
    return;
  }

  if (result.ambiguous) {
    const opciones = result.matches
      .map((c, i) => `*${i + 1}*. ${c.ciudad} — ${c.depto}`)
      .join('\n');
    session.ciudadCandidatos = result.matches;
    await send(
      chatId,
      `Encontré varias ciudades con ese nombre 🔍\n\n${opciones}\n\n` +
      `¿En cuál de estas vives? Escribe el *número*:`
    );
    return; // espera aclaración del usuario
  }

  await responderCobertura(chatId, result, session);
}

async function responderCobertura(chatId, entry, session) {
  await send(
    chatId,
    `✅ ¡Sí hacemos envíos a *${entry.ciudad}* (${entry.depto})!\n\n` +
    `📦 *Envío:* incluido sin costo adicional\n` +
    `💳 *Pago:* contra entrega en efectivo\n\n` +
    `_¿Quieres ver nuestras gorras? Escribe *menu* para empezar_`
  );
  await restaurarEstado(chatId, session);
}

// Restaura el estado anterior al desvío de ciudad
async function restaurarEstado(chatId, session) {
  const prev = session.prevState || 'menu';
  session.prevState = null;
  session.state = prev;
  // No re-mostramos contexto automáticamente; el usuario puede escribir 'menu' o continuar
}

// ─── HANDLER: CARRITO ────────────────────────────────────────────────────
async function showCart(chatId, session) {
  if (session.cart.length === 0) {
    session.state = 'menu';
    return send(chatId, `🛒 Tu carrito está vacío.\n\n${txtMenu()}`);
  }

  let msg = `🛒 *Tu carrito:*\n\n`;
  session.cart.forEach((item, i) => { msg += `${i + 1}. ${item.name} — ${fmt(item.price)}\n`; });
  msg += `\n💰 *Total: ${fmt(cartTotal(session.cart))}*\n\n`;
  msg += `*pagar* — proceder al pago\n*vaciar* — limpiar carrito\n*0* — seguir comprando`;

  session.state = 'cart_view';
  await send(chatId, msg);
}

async function handleCartView(chatId, text, session) {
  if (text === 'pagar') {
    session.state = 'datos_nombre';
    return send(chatId, `📝 *Datos de entrega*\n\n¿Cuál es tu *nombre completo*?`);
  }
  if (text === 'vaciar') {
    session.cart = [];
    session.state = 'menu';
    return send(chatId, `🗑️ Carrito vaciado.\n\n${txtMenu()}`);
  }
  if (text === '0') { resetSession(chatId); return send(chatId, txtMenu()); }
  await send(chatId, `Escribe *pagar*, *vaciar*, o *0* para volver.`);
}

// ─── HANDLERS: CAPTURA DE DATOS ──────────────────────────────────────────
async function handleDatosNombre(chatId, rawText, session) {
  if (rawText.trim().length < 3) {
    return send(chatId, `⚠️ Por favor escribe tu *nombre completo* (mín. 3 caracteres).`);
  }
  session.datos.nombre = rawText.trim();
  session.state = 'datos_telefono';
  await send(chatId, `👍 ¡Perfecto, *${session.datos.nombre}*!\n\n📱 ¿Cuál es tu número de *celular*?\n_Solo números, ej: 3001234567_`);
}

async function handleDatosTelefono(chatId, rawText, session) {
  const digits = rawText.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) {
    return send(chatId, `⚠️ Número inválido. Ingresa solo dígitos, ej: *3001234567*`);
  }
  session.datos.telefono = digits;
  session.state = 'datos_direccion';
  await send(
    chatId,
    `📍 ¿Cuál es tu *dirección de entrega*?\n\n` +
    `_Incluye ciudad, barrio y dirección exacta._\n` +
    `_Ej: Bogotá, Kennedy, Cra 80 #45-20 Apto 301_`
  );
}

async function handleDatosDireccion(chatId, rawText, session) {
  if (rawText.trim().length < 10) {
    return send(chatId, `⚠️ Por favor escribe la dirección más completa (ciudad + barrio + dirección).`);
  }
  session.datos.direccion = rawText.trim();
  session.state = 'datos_ciudad';
  await send(chatId, `🏙️ ¿En qué *ciudad* resides?`);
}

async function handleDatosCiudad(chatId, rawText, session) {
  if (rawText.trim().length < 2) {
    return send(chatId, `⚠️ Por favor escribe el nombre de tu ciudad.`);
  }
  session.datos.ciudad = rawText.trim();
  session.state = 'datos_depto';
  await send(chatId, `🗺️ ¿En qué *departamento* te encuentras?\n_Ej: Antioquia, Valle del Cauca, Bogotá D.C._`);
}

async function handleDatosDepto(chatId, rawText, session) {
  if (rawText.trim().length < 3) {
    return send(chatId, `⚠️ Por favor escribe el nombre del departamento.`);
  }
  session.datos.depto = rawText.trim();
  session.state = 'datos_correo';
  await send(chatId, `📧 ¿Cuál es tu *correo electrónico*?\n\n_Escribe *no* si prefieres no darlo_`);
}

async function handleDatosCorreo(chatId, rawText, session) {
  const t = rawText.trim();
  if (norm(t) === 'no' || norm(t) === 'n') {
    session.datos.correo = null;
  } else if (t.includes('@') && t.includes('.')) {
    session.datos.correo = t.toLowerCase();
  } else {
    return send(chatId, `⚠️ Correo inválido. Ingresa uno válido o escribe *no* para omitirlo.`);
  }
  session.state = 'confirmacion';
  await sendResumen(chatId, session);
}

// ─── RESUMEN DEL PEDIDO ───────────────────────────────────────────────────
async function sendResumen(chatId, session) {
  const { datos, cart } = session;
  const total = cartTotal(cart);

  // Genera la referencia única del pedido al mostrar el resumen
  if (!session.referencia) {
    session.referencia = 'CS-WA-' + Date.now().toString(36).toUpperCase();
  }

  let msg = `📋 *Resumen de tu pedido*\n`;
  msg += `🔖 *Ref:* ${session.referencia}\n\n`;
  msg += `🧢 *Productos:*\n`;
  cart.forEach((item, i) => { msg += `   ${i + 1}. ${item.name} — ${fmt(item.price)}\n`; });
  msg += `\n💰 *Total: ${fmt(total)}*\n\n`;
  msg += `👤 *Nombre:* ${datos.nombre}\n`;
  msg += `📱 *Celular:* ${datos.telefono}\n`;
  msg += `📍 *Dirección:* ${datos.direccion}\n`;
  msg += `🏙️ *Ciudad:* ${datos.ciudad}\n`;
  msg += `🗺️ *Departamento:* ${datos.depto}\n`;
  if (datos.correo) msg += `📧 *Correo:* ${datos.correo}\n`;
  msg += `\n💳 *Pago:* Contra entrega en efectivo\n\n`;
  msg += `¿Confirmas tu pedido?\n\n✅ *sí* — confirmar\n❌ *no* — cancelar`;

  await send(chatId, msg);
}

// ─── HANDLER: CONFIRMACIÓN ────────────────────────────────────────────────
async function handleConfirmacion(chatId, text, session) {
  if (ES_SI.includes(text)) {
    // Verificar duplicado antes de guardar
    if (isDuplicateOrder(session.datos.telefono, session.cart)) {
      await send(
        chatId,
        `⚠️ Parece que ya tienes un pedido reciente con los mismos productos.\n` +
        `Si fue un error escríbenos por aquí o llámanos.\n\n` +
        `_Ref del pedido anterior: verifica con nosotros_\n\n` +
        `_Escribe *menu* para volver_`
      );
      return;
    }

    const order = {
      referencia: session.referencia || ('CS-WA-' + Date.now().toString(36).toUpperCase()),
      fecha:    new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
      cliente: {
        nombre:    session.datos.nombre,
        telefono:  session.datos.telefono,
        whatsapp:  chatId.replace('@c.us', ''),
        direccion: session.datos.direccion,
        ciudad:    session.datos.ciudad,
        depto:     session.datos.depto,
        correo:    session.datos.correo
      },
      productos: session.cart,
      total:     cartTotal(session.cart),
      pago:      'Contra entrega en efectivo',
      estado:    'pendiente'
    };

    const numPedido = saveOrder(order);
    console.log(`\n🛍️  Pedido #${numPedido} [${order.referencia}] — ${order.cliente.nombre} — ${fmt(order.total)}`);

    // Notificación por correo (fire-and-forget, no bloquea la respuesta al cliente)
    sendOrderEmail(order).catch(err => console.error('Mailer:', err.message));

    await send(
      chatId,
      `✅ *¡Pedido #${numPedido} confirmado!* 🎉\n` +
      `🔖 Ref: *${order.referencia}*\n\n` +
      `Nos contactaremos al *${session.datos.telefono}* para coordinar la entrega.\n\n` +
      `💳 Recuerda: pago *contra entrega en efectivo*.\n\n` +
      `¡Gracias por comprar en *The Cap Store Online*! 🧢🙏\n\n` +
      `_Escribe *menu* para hacer otro pedido_`
    );

    resetSession(chatId);
    return;
  }

  if (ES_NO.includes(text)) {
    resetSession(chatId);
    return send(chatId, `❌ Pedido cancelado.\n\n${txtMenu()}`);
  }

  await send(chatId, `Por favor responde *sí* para confirmar o *no* para cancelar.`);
}

// ─── ROUTER PRINCIPAL ─────────────────────────────────────────────────────
async function handleMessage(msg) {
  // Ignorar grupos, estados y mensajes sin texto
  if (!msg.body || msg.from === 'status@broadcast' || msg.from.endsWith('@g.us')) return;

  const chatId  = msg.from;
  const text    = norm(msg.body);   // normalizado para comparar
  const rawText = msg.body;         // original para guardar datos del cliente

  const session = getSession(chatId);

  // Comandos globales de reinicio
  if (['menu', 'inicio', 'hola', 'hi', 'buenas'].some(k => text.startsWith(k))) {
    resetSession(chatId);
    return send(chatId, txtMenu());
  }

  // Detección global de descuentos / venta al por mayor
  // No interrumpe estados de captura (compra normal ni flujo mayoreo activo)
  const estadosCaptura = [
    'datos_nombre', 'datos_telefono', 'datos_direccion', 'datos_ciudad', 'datos_depto', 'datos_correo', 'confirmacion',
    'mayoreo_intro', 'mayoreo_nombre', 'mayoreo_telefono', 'mayoreo_cantidad', 'mayoreo_coleccion', 'mayoreo_correo', 'mayoreo_confirmar',
  ];
  if (!estadosCaptura.includes(session.state) && session.state !== 'consulta_ciudad') {
    if (DISCOUNT_TRIGGERS.some(k => text.includes(k))) {
      return iniciarDescuento(chatId, session);
    }
    if (CITY_QUERY_TRIGGERS.some(k => text.includes(k))) {
      return iniciarConsultaCiudad(chatId, session);
    }
  }

  switch (session.state) {
    case 'menu':           return handleMenu(chatId, text, session);
    case 'collection':     return handleCollection(chatId, text, session);
    case 'viewing_product':return handleViewingProduct(chatId, text, session);
    case 'more_products':  return handleMoreProducts(chatId, text, session);
    case 'cart_view':      return handleCartView(chatId, text, session);
    case 'datos_nombre':   return handleDatosNombre(chatId, rawText, session);
    case 'datos_telefono': return handleDatosTelefono(chatId, rawText, session);
    case 'datos_direccion':return handleDatosDireccion(chatId, rawText, session);
    case 'datos_ciudad':     return handleDatosCiudad(chatId, rawText, session);
    case 'datos_depto':      return handleDatosDepto(chatId, rawText, session);
    case 'datos_correo':     return handleDatosCorreo(chatId, rawText, session);
    case 'confirmacion':     return handleConfirmacion(chatId, text, session);
    case 'mayoreo_intro':    return handleMayoreoIntro(chatId, text, session);
    case 'mayoreo_nombre':   return handleMayoreoNombre(chatId, rawText, session);
    case 'mayoreo_telefono': return handleMayoreoTelefono(chatId, rawText, session);
    case 'mayoreo_cantidad': return handleMayoreoCantidad(chatId, rawText, session);
    case 'mayoreo_coleccion':return handleMayoreoColeccion(chatId, rawText, session);
    case 'mayoreo_correo':   return handleMayoreoCorreo(chatId, rawText, session);
    case 'mayoreo_confirmar':return handleMayoreoConfirmar(chatId, text, session);
    case 'consulta_ciudad':  return handleConsultaCiudad(chatId, rawText, session);
    default:
      resetSession(chatId);
      return send(chatId, txtMenu());
  }
}

// ─── CLIENTE WHATSAPP ─────────────────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: path.join(__dirname, '.wwebjs_auth') }),
  puppeteer: {
    headless: true,
    executablePath: '/usr/bin/chromium', // <--- ¡Vuelve la línea mágica!
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  }
});

client.on('qr', qr => {
  console.clear();
  console.log('═══════════════════════════════════════════════');
  console.log('  🧢  The Cap Store Online — Bot de WhatsApp');
  console.log('═══════════════════════════════════════════════');
  console.log('  📱 Escanea el QR con tu WhatsApp:');
  console.log('     (Ajustes > Dispositivos vinculados > +)\n');
  qrcode.generate(qr, { small: true });
  console.log('\n  Esperando escaneo...');
  console.log('═══════════════════════════════════════════════');
});

client.on('authenticated', () => console.log('🔐 Autenticado.'));

client.on('ready', () => {
  console.log('\n✅ Bot conectado y escuchando mensajes.');
  console.log(`📁 Pedidos en: ${DATA_FILE}\n`);
});

client.on('disconnected', reason => console.log('❌ Desconectado:', reason));

client.on('message', async msg => {
  try { await handleMessage(msg); }
  catch (err) { console.error('Error en mensaje:', err.message); }
});

// ─── API HTTP — notificaciones desde el sitio web ────────────────────────────
// El sitio web hace POST a estos endpoints para enviar correos via Gmail/nodemailer.
// Usar la misma cuenta y contraseña de aplicación del .env

const API_PORT = process.env.API_PORT || 8080;
const API_KEY  = process.env.API_KEY  || 'capsstore2026';

const api = express();
api.use(cors());
api.use(express.json());

// Middleware: valida la clave de API en el header X-Api-Key
api.use((req, res, next) => {
  if (req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
});

// POST /enviar-correo  → endpoint unificado para pedido normal y al por mayor (web)
api.post('/enviar-correo', async (req, res) => {
  const { type, numeroPedido, datosCliente, producto, coleccion, precio, dm } = req.body;
  const fecha = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });

  if (type === 'order') {
    if (!numeroPedido || !datosCliente) return res.status(400).json({ error: 'Datos incompletos' });
    const order = {
      id:         numeroPedido,
      referencia: numeroPedido,
      fecha,
      cliente: {
        nombre:    datosCliente.nombre,
        telefono:  datosCliente.celular,
        whatsapp:  '(web)',
        direccion: datosCliente.direccion,
        ciudad:    datosCliente.ciudad,
        depto:     datosCliente.depto,
        correo:    datosCliente.correo !== '—' ? datosCliente.correo : null,
      },
      productos: [{ name: producto.name, id: producto.id, collection: coleccion, price: precio }],
      total:     precio,
    };
    sendOrderEmail(order).catch(err => console.error('API order:', err.message));

  } else if (type === 'mayoreo') {
    if (!dm || !dm.nombre) return res.status(400).json({ error: 'Datos incompletos' });
    sendMayoreoEmail(dm, fecha, '(web)').catch(err => console.error('API mayoreo:', err.message));

  } else {
    return res.status(400).json({ error: 'type inválido (order | mayoreo)' });
  }

  res.json({ ok: true });
});

api.listen(API_PORT, () => {
  console.log(`🌐 API de notificaciones activa en http://localhost:${API_PORT}`);
});

// ─── INIT ─────────────────────────────────────────────────────────────────
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');

client.initialize();
