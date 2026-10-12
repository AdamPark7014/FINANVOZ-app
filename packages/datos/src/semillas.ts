import type { Espacio } from './nucleo';

/** Ids fijos de las cuentas de sistema que inserta `0001_inicial` (`docs/04-DATOS.md §2.1`). */
export const CUENTAS_SISTEMA = {
  porAsignar: 'sis:personal:por_asignar',
  porAsignarEntradas: 'sis:personal:por_asignar_entradas',
  transito: 'sis:personal:transito',
  cuentasExternas: 'sis:personal:cuentas_externas',
  saldosIniciales: 'sis:personal:saldos_iniciales',
  ajusteConciliacion: 'sis:personal:ajuste_conciliacion',
} as const;

/** Id fijo de una categoría del catálogo inicial (`§2.3`). */
export function idCategoria(slug: string, espacio: Espacio = 'personal'): string {
  return `cat:${espacio}:${slug}`;
}

export const CATEGORIAS_GASTO_VARIABLE = [
  'comida_fuera',
  'antojos',
  'super',
  'transporte',
  'gasolina',
  'entretenimiento',
  'ropa',
  'hogar',
  'cuidado_personal',
  'salud',
  'mascotas',
  'regalos',
  'apoyo_familiar',
  'viajes',
  'tecnologia',
  'deporte',
  'otros_gastos',
  'varios_efectivo',
] as const;
export const CATEGORIAS_GASTO_FIJO = [
  'vivienda',
  'servicios',
  'suscripciones',
  'educacion',
  'comisiones_intereses',
] as const;
export const CATEGORIAS_INGRESO = [
  'sueldo',
  'honorarios',
  'ventas',
  'regalo_recibido',
  'reembolso',
  'rendimientos',
  'otros_ingresos',
] as const;
