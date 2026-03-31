'use strict';

// Ciudades capitales de departamento con envío INCLUIDO y pago CONTRA ENTREGA
const CIUDADES = [
  { ciudad: 'MEDELLÍN',      depto: 'ANTIOQUIA' },
  { ciudad: 'BARRANQUILLA',  depto: 'ATLÁNTICO' },
  { ciudad: 'BOGOTÁ',        depto: 'BOGOTÁ D.C.' },
  { ciudad: 'CARTAGENA',     depto: 'BOLÍVAR' },
  { ciudad: 'TUNJA',         depto: 'BOYACÁ' },
  { ciudad: 'MANIZALES',     depto: 'CALDAS' },
  { ciudad: 'FLORENCIA',     depto: 'CAQUETÁ' },
  { ciudad: 'POPAYÁN',       depto: 'CAUCA' },
  { ciudad: 'VALLEDUPAR',    depto: 'CESAR' },
  { ciudad: 'QUIBDÓ',        depto: 'CHOCÓ' },
  { ciudad: 'MONTERÍA',      depto: 'CÓRDOBA' },
  { ciudad: 'NEIVA',         depto: 'HUILA' },
  { ciudad: 'RIOHACHA',      depto: 'LA GUAJIRA' },
  { ciudad: 'SANTA MARTA',   depto: 'MAGDALENA' },
  { ciudad: 'VILLAVICENCIO', depto: 'META' },
  { ciudad: 'PASTO',         depto: 'NARIÑO' },
  { ciudad: 'CÚCUTA',        depto: 'NORTE DE SANTANDER' },
  { ciudad: 'ARMENIA',       depto: 'QUINDÍO' },
  { ciudad: 'PEREIRA',       depto: 'RISARALDA' },
  { ciudad: 'BUCARAMANGA',   depto: 'SANTANDER' },
  { ciudad: 'SINCELEJO',     depto: 'SUCRE' },
  { ciudad: 'IBAGUÉ',        depto: 'TOLIMA' },
  { ciudad: 'CALI',          depto: 'VALLE DEL CAUCA' },
  { ciudad: 'ARAUCA',        depto: 'ARAUCA' },
  { ciudad: 'YOPAL',         depto: 'CASANARE' },
  { ciudad: 'MOCOA',         depto: 'PUTUMAYO' },
];

// Normaliza: minúsculas + sin tildes + sin espacios extremos
function normCity(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

/**
 * Busca la ciudad del cliente en la tabla de cobertura.
 * @param {string} input  Texto libre del usuario (ej: "medellin", "cali valle", "Bogotá DC")
 * @returns {object|null}
 *   - { ciudad, depto }          → encontrada, una sola coincidencia
 *   - { ambiguous, matches[] }   → varias coincidencias posibles
 *   - null                       → sin cobertura
 */
function findCity(input) {
  const n = normCity(input);
  // Palabras con 3+ caracteres para búsqueda parcial
  const words = n.split(/[\s,.\-/()]+/).filter(w => w.length >= 3);

  function matchesCity(entry) {
    const nc = normCity(entry.ciudad);
    return n.includes(nc) || nc.includes(n) ||
           words.some(w => w.length >= 4 && nc.includes(w));
  }

  function matchesDept(entry) {
    const nd = normCity(entry.depto);
    return n.includes(nd) || nd.includes(n) ||
           words.some(w => w.length >= 4 && nd.includes(w));
  }

  // Prioridad 1: coincide ciudad Y departamento en el mismo mensaje
  for (const entry of CIUDADES) {
    if (matchesCity(entry) && matchesDept(entry)) return entry;
  }

  // Prioridad 2: solo coincide ciudad
  const matches = CIUDADES.filter(matchesCity);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1)   return { ambiguous: true, matches };
  return null;
}

// Lista legible de todas las ciudades cubiertas
function listadoCiudades() {
  return CIUDADES.map(e => `• ${e.ciudad} (${e.depto})`).join('\n');
}

module.exports = { CIUDADES, findCity, listadoCiudades };
