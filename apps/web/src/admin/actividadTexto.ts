import { formatearCentavos, pesosDeCentavos } from '../util/dinero';
import { diasEntre, hoyMexico } from '../util/fecha';

export type AccionBitacora = 'insert' | 'update' | 'delete';

export interface FilaActividad {
  id: number;
  tabla: string;
  registro_id: string;
  accion: AccionBitacora;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
  usuario_id: string | null;
  usuario_nombre: string;
  creado_en: string;
}

const MESES_CORTO = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

const ETAPA_ETIQUETA: Record<string, string> = {
  nuevo: 'Nuevos',
  contactado: 'Contactados',
  demo: 'Demo',
  propuesta: 'Propuesta',
  ganado: 'Ganados',
  perdido: 'Perdidos',
};

const PARAM_ETIQUETA: Record<string, string> = {
  precio_plus_mensual: 'Plus mensual',
  precio_plus_anual: 'Plus anual',
  precio_licencia_mes: 'Licencia por persona al mes',
  comision_pct: 'Comisión general',
  iva_pct: 'IVA',
  dominio_publico: 'Dominio de la página de venta',
};

const PARAM_PRECIO = new Set(['precio_plus_mensual', 'precio_plus_anual', 'precio_licencia_mes']);
const PARAM_PORCENTAJE = new Set(['comision_pct', 'iva_pct']);

function texto(v: unknown, respaldo = ''): string {
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return respaldo;
}

function numero(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) return Number(v);
  return 0;
}

/** Partes civiles y hora en la Ciudad de México a partir de un ISO. */
function partesMexico(iso: string): { fecha: string; hora: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { fecha: hoyMexico(), hora: '00:00' };
  const fecha = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  const partes = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const hh = partes.find((p) => p.type === 'hour')?.value ?? '00';
  const mm = partes.find((p) => p.type === 'minute')?.value ?? '00';
  return { fecha, hora: `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}` };
}

/** «hoy 14:05», «ayer 09:12», «12 nov 18:40». */
export function formatearMomentoMexico(iso: string, ahora: Date = new Date()): string {
  const { fecha, hora } = partesMexico(iso);
  const hoy = hoyMexico(ahora);
  const delta = diasEntre(fecha, hoy);
  if (delta === 0) return `hoy ${hora}`;
  if (delta === 1) return `ayer ${hora}`;
  const [, m = '01', d = '01'] = fecha.split('-');
  const mes = MESES_CORTO[Number(m) - 1] ?? m;
  return `${Number(d)} ${mes} ${hora}`;
}

function formatearParametro(clave: string, valor: unknown): string {
  if (PARAM_PRECIO.has(clave)) return formatearCentavos(numero(valor));
  if (PARAM_PORCENTAJE.has(clave)) return `${pesosDeCentavos(numero(valor))} %`; // puntos base: 1550 → 15.50 %
  if (typeof valor === 'string') return valor.trim() || '(vacío)';
  if (valor == null) return '(vacío)';
  return String(valor);
}

function fraseBase(fila: FilaActividad): string {
  const quien = fila.usuario_nombre.trim();
  const despues = fila.despues;
  const antes = fila.antes;

  if (fila.tabla === 'admin_prospectos' && fila.accion === 'insert' && !quien) {
    return `La página de venta recibió a ${texto(despues?.nombre, 'un prospecto')}`;
  }

  if (fila.tabla === 'admin_ventas' && fila.accion === 'insert') {
    const folio = texto(despues?.folio, 'una venta');
    const cliente = texto(despues?.cliente_nombre, 'Cliente');
    const monto = formatearCentavos(numero(despues?.total_centavos));
    return `${quien || 'Alguien'} registró ${folio} a ${cliente} (${monto})`;
  }

  if (fila.tabla === 'admin_ventas' && fila.accion === 'update') {
    const folio = texto(despues?.folio ?? antes?.folio, 'una venta');
    const monto = formatearCentavos(numero(despues?.total_centavos ?? antes?.total_centavos));
    if (texto(despues?.estado) === 'pagada' && texto(antes?.estado) !== 'pagada') {
      return `${quien || 'Alguien'} marcó ${folio} como pagada (${monto})`;
    }
    if (texto(despues?.estado) === 'cancelada') {
      const motivo = texto(despues?.cancelada_motivo, 'sin motivo');
      return `${quien || 'Alguien'} canceló ${folio}: ${motivo}`;
    }
  }

  if (fila.tabla === 'admin_prospectos' && fila.accion === 'update') {
    const etapaAntes = texto(antes?.etapa);
    const etapaDespues = texto(despues?.etapa);
    if (etapaDespues && etapaDespues !== etapaAntes) {
      const nombre = texto(despues?.nombre ?? antes?.nombre, 'un prospecto');
      const etiqueta = ETAPA_ETIQUETA[etapaDespues] ?? etapaDespues;
      return `${quien || 'Alguien'} movió ${nombre} a ${etiqueta}`;
    }
  }

  if (fila.tabla === 'admin_clientes' && fila.accion === 'insert') {
    const nombre = texto(despues?.nombre, 'cliente');
    return quien ? `${quien} registró al cliente ${nombre}` : `Alta de cliente ${nombre}`;
  }

  if (fila.tabla === 'admin_parametros' && fila.accion === 'update') {
    const clave = texto(despues?.clave ?? antes?.clave ?? fila.registro_id);
    const etiqueta = PARAM_ETIQUETA[clave] ?? clave;
    return `${quien || 'Alguien'} cambió ${etiqueta} de ${formatearParametro(clave, antes?.valor)} a ${formatearParametro(clave, despues?.valor)}`;
  }

  if (fila.tabla === 'admin_miembros') {
    const nombre = texto(despues?.nombre ?? antes?.nombre, 'miembro');
    if (fila.accion === 'insert') {
      return `${quien || 'Alguien'} dio de alta al miembro ${nombre}`;
    }
    return `${quien || 'Alguien'} actualizó al miembro ${nombre}`;
  }

  if (fila.tabla === 'admin_prospectos' && fila.accion === 'insert') {
    return `${quien || 'Alguien'} registró al prospecto ${texto(despues?.nombre, 'sin nombre')}`;
  }

  // Cualquier otro cambio, dicho con palabras (nunca nombres de tablas).
  const nombre = texto(despues?.nombre ?? antes?.nombre ?? despues?.folio ?? antes?.folio);
  const sujeto: Record<string, string> = {
    admin_ventas: `la venta ${nombre}`,
    admin_clientes: `al cliente ${nombre}`,
    admin_prospectos: `al prospecto ${nombre}`,
    admin_parametros: 'un ajuste',
  };
  const verbo = fila.accion === 'insert' ? 'agregó' : fila.accion === 'delete' ? 'quitó' : 'actualizó';
  return `${quien || 'Alguien'} ${verbo} ${(sujeto[fila.tabla] ?? 'un registro').trim()}`;
}

/** Frase humana de una fila de bitácora, con fecha/hora al final. */
export function describirActividad(fila: FilaActividad, ahora: Date = new Date()): string {
  return `${fraseBase(fila)} · ${formatearMomentoMexico(fila.creado_en, ahora)}`;
}

/** Tablas que agrupa cada pestaña del módulo Actividad. */
export const FILTROS_ACTIVIDAD: { id: string; etiqueta: string; tablas?: string[] }[] = [
  { id: 'todo', etiqueta: 'Todo' },
  { id: 'ventas', etiqueta: 'Ventas', tablas: ['admin_ventas'] },
  { id: 'prospectos', etiqueta: 'Prospectos', tablas: ['admin_prospectos'] },
  { id: 'clientes', etiqueta: 'Clientes', tablas: ['admin_clientes'] },
  { id: 'ajustes', etiqueta: 'Ajustes y equipo', tablas: ['admin_parametros', 'admin_miembros'] },
];
