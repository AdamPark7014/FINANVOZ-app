/**
 * Ayudas de las pruebas de M12 (Vitest y jest-expo): la configuración fiscal SINTÉTICA de los vectores E13 con la
 * forma de `config/fiscal/<año>.json` (`10 §5`) y un ZIP armado en memoria. Sin `import.meta` ni `node:` para que
 * corra igual en los dos.
 */
import { zipSync } from 'fflate';
import vectoresCrudos from '../../../../../fixtures/motores/vectores.json';

interface Vectores {
  E13: {
    config_prueba: Record<string, unknown> & { uma_anual: number };
    tarifa_prueba: unknown[];
    parsear: { archivo: string; esperado: { uuid?: string } }[];
    deducciones: {
      id: string;
      rfc: string;
      ingresos: number;
      etiquetas: Record<string, Record<string, unknown>>;
      esperado: { total_deducible: number; excluidos: { uuid: string; motivo: string }[] };
    }[];
    ahorro: { id: string; base_gravable: number; deducciones: number; esperado: Record<string, number> }[];
  };
  E15: { config: Record<string, unknown> };
}
const vectores = vectoresCrudos as unknown as Vectores;

export const E13 = vectores.E13;

function sinDescripcion(o: Record<string, unknown>): Record<string, unknown> {
  const copia = { ...o };
  delete copia['descripcion'];
  return copia;
}

/**
 * `config/fiscal/2026.json` armado con `E13.config_prueba`, `E13.tarifa_prueba` y la tabla de `E15.config`, marcado
 * `validado` SOLO para probar la lógica de la pantalla (el archivo real sigue por validar: pendientes 90–93). Pasa
 * por `validarConfigFiscal` como el real.
 */
export function configFiscalPrueba(): Record<number, unknown> {
  const { uma_anual, ...deducciones } = sinDescripcion(E13.config_prueba) as { uma_anual: number };
  return {
    2026: {
      ejercicio: 2026,
      estado: 'validado',
      fuentes: ['vectores E13 y E15 (sintéticos)'],
      ...sinDescripcion(E15config()),
      tarifa_anual_isr: E13.tarifa_prueba,
      uma: { diaria: 11731, anual: uma_anual },
      deducciones,
    },
  };
}

function E15config(): Record<string, unknown> {
  return vectores.E15.config;
}

/** Un ZIP en memoria con esos archivos (como el que baja el portal del SAT). */
export function armarZip(archivos: readonly { nombre: string; bytes: Uint8Array }[]): Uint8Array {
  return zipSync(Object.fromEntries(archivos.map((a) => [a.nombre, a.bytes])));
}

/** UUID de una factura de `fixtures/cfdi` por nombre de archivo, del vector `E13.parsear`. */
export function uuidDe(archivo: string): string {
  const p = E13.parsear.find((x) => x.archivo.endsWith(`/${archivo}`));
  const uuid = p?.esperado.uuid;
  if (!uuid) throw new Error(`sin UUID para ${archivo}`);
  return uuid;
}

/** Etiquetas de un vector de `E13.deducciones` (E13-10, E13-12) por id. */
export function deduccionE13(id: string) {
  const v = E13.deducciones.find((d) => d.id === id);
  if (!v) throw new Error(`no existe el vector ${id}`);
  return v;
}

/** Ahorro esperado de un vector de `E13.ahorro` (E13-20…) por id. */
export function ahorroE13(id: string) {
  const v = E13.ahorro.find((d) => d.id === id);
  if (!v) throw new Error(`no existe el vector ${id}`);
  return v;
}

/** CA-M12-04: la frase del criterio; la resuelve el nivel 0, sin internet (golden G33). */
export const CONSULTA_MEDICA = 'consulta médica de 800 en efectivo';

/**
 * Salud en efectivo que el nivel 0 no resuelve (verbo y monto fuera de su gramática): la interpreta la nube. Esta es
 * la interpretación que devuelve la nube falsa de las pruebas.
 */
export const CONSULTA_MEDICA_NUBE = {
  texto: 'fui al doctor y me cobró 800 en efectivo',
  interpretacion: {
    intencion: 'registrar',
    movimientos: [
      {
        tipo: 'gasto',
        monto: 80_000,
        fecha: '2026-10-11',
        categoria: 'salud',
        descripcion: 'doctor',
        origen: { tipo: 'efectivo' },
      },
    ],
  },
} as const;
