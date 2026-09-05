'use strict';

const { createClient } = require('@supabase/supabase-js');

// Cliente server-side: usa la service role key (NUNCA la anon key del
// frontend), porque la policy RLS de registro_chat solo permite INSERT
// al rol 'anon' — el backend necesita poder leer para isDuplicateOrder.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Guarda un pedido del bot de WhatsApp en registro_chat.
// Inserta UNA FILA POR PRODUCTO del carrito (ver db/migration_001_canal_unificado.sql,
// punto 4): registro_chat está diseñada como "un evento de compra por fila",
// no una fila por pedido completo, así que un carrito con 3 gorras genera
// 3 filas que comparten el mismo numero_pedido.
async function saveOrder(order) {
  const filas = order.productos.map(producto => ({
    referencia:      producto.id,
    nombre_producto: producto.name,
    coleccion:       producto.collection,
    precio:          producto.price,
    nombre:          order.cliente.nombre,
    celular:         order.cliente.telefono,
    direccion:       order.cliente.direccion,
    ciudad:          order.cliente.ciudad,
    departamento:    order.cliente.depto,
    correo:          order.cliente.correo,
    estado:          order.estado,
    numero_pedido:   order.referencia,
    pago:            order.pago,
    canal:           'whatsapp',
  }));

  const { error } = await supabase.from('registro_chat').insert(filas);
  if (error) throw new Error(`Supabase insert (saveOrder): ${error.message}`);

  return order.referencia;
}

// Reemplaza la detección de duplicados basada en JSON local: mismo celular
// con un pedido (cualquier fila, ya que hay varias por pedido) en los
// últimos 10 minutos.
async function isDuplicateOrder(telefono, cart) {
  if (!cart || cart.length === 0) return false;

  const cutoffISO = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('registro_chat')
    .select('numero_pedido, referencia')
    .eq('celular', telefono)
    .eq('canal', 'whatsapp')
    .gte('fecha', cutoffISO);

  if (error) throw new Error(`Supabase select (isDuplicateOrder): ${error.message}`);
  if (!data || data.length === 0) return false;

  // Agrupa las filas devueltas por numero_pedido y compara el set de
  // referencias (productos) de cada pedido reciente contra el carrito actual.
  const porPedido = new Map();
  for (const fila of data) {
    if (!porPedido.has(fila.numero_pedido)) porPedido.set(fila.numero_pedido, []);
    porPedido.get(fila.numero_pedido).push(fila.referencia);
  }

  const idsCarritoActual = cart.map(item => String(item.id)).sort();

  for (const referencias of porPedido.values()) {
    const idsPedidoPrevio = referencias.map(String).sort();
    if (idsPedidoPrevio.length === idsCarritoActual.length &&
        idsPedidoPrevio.every((id, i) => id === idsCarritoActual[i])) {
      return true;
    }
  }
  return false;
}

module.exports = { saveOrder, isDuplicateOrder };
