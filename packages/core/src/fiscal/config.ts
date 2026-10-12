import { type Centavos, type PuntosBase } from '../dinero';
import { ErrorDominio } from '../errores';
import { type ConfigDeducciones, type ReglaUso, type TopeDeduccion } from './deducciones';
import { type FilaTarifa, validarTarifa } from './isr';

/**
 * Marca de un parámetro que la especificación no da y que debe llenar (y validar) un contador público.
 * Cualquier campo con este valor hace que `validarConfigFiscal` falle cerrado.
 */
export const POR_DEFINIR = 'POR_DEFINIR';

export type EstadoConfigFiscal = 'por_validar' | 'validado';

export interface FilaResico {
  hasta: Centavos;
  tasa_bp: PuntosBase;
}

/** `config/fiscal/<año>.json` ya validado (`10 §5`): lo que consumen E13 y E15. */
export interface ConfigFiscal {
  ejercicio: number;
  /** `por_validar` hasta que un contador público lo firme en ESTADO (CA-M12-06); la UI lo dice. */
  estado: EstadoConfigFiscal;
  fuentes: string[];
  dia_pago: number;
  iva_tasa_general_bp: PuntosBase;
  porcentaje_por_defecto_bp: PuntosBase;
  resico_pf: { limite_anual: Centavos; tabla_mensual: FilaResico[] };
  tarifa_anual_isr: FilaTarifa[];
  uma: { diaria: Centavos; anual: Centavos };
  /** Sección `deducciones` del archivo con `uma_anual` tomado de `uma.anual` (una sola fuente). */
  deducciones: ConfigDeducciones;
}

/** Rutas (`a.b[2].c`) de los campos que todavía valen `POR_DEFINIR`. */
export function camposPorDefinir(datos: unknown, ruta = ''): string[] {
  if (datos === POR_DEFINIR) return [ruta || '(raíz)'];
  if (Array.isArray(datos)) return datos.flatMap((v, i) => camposPorDefinir(v, `${ruta}[${i}]`));
  if (typeof datos === 'object' && datos !== null) {
    return Object.entries(datos).flatMap(([k, v]) => camposPorDefinir(v, ruta ? `${ruta}.${k}` : k));
  }
  return [];
}

type Objeto = Record<string, unknown>;

class Lector {
  readonly errores: string[] = [];

  objeto(v: unknown, ruta: string): Objeto {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) return v as Objeto;
    this.errores.push(`${ruta}: se esperaba un objeto`);
    return {};
  }

  lista(v: unknown, ruta: string): unknown[] {
    if (Array.isArray(v) && v.length > 0) return v;
    this.errores.push(`${ruta}: se esperaba una lista no vacía`);
    return [];
  }

  entero(v: unknown, ruta: string, minimo = 0, maximo = Number.MAX_SAFE_INTEGER): number {
    if (typeof v === 'number' && Number.isSafeInteger(v) && v >= minimo && v <= maximo) return v;
    this.errores.push(`${ruta}: se esperaba un entero entre ${minimo} y ${maximo}`);
    return 0;
  }

  bp(v: unknown, ruta: string): PuntosBase {
    return this.entero(v, ruta, 0, 10000);
  }

  booleano(v: unknown, ruta: string): boolean {
    if (typeof v === 'boolean') return v;
    this.errores.push(`${ruta}: se esperaba true o false`);
    return false;
  }

  texto(v: unknown, ruta: string): string {
    if (typeof v === 'string' && v.length > 0) return v;
    this.errores.push(`${ruta}: se esperaba un texto`);
    return '';
  }

  tope(v: unknown, ruta: string): TopeDeduccion {
    const o = this.objeto(v, ruta);
    const t: TopeDeduccion = {};
    if (o['umas'] !== undefined) t.umas = this.entero(o['umas'], `${ruta}.umas`);
    if (o['porcentaje_ingresos_bp'] !== undefined) {
      t.porcentaje_ingresos_bp = this.bp(o['porcentaje_ingresos_bp'], `${ruta}.porcentaje_ingresos_bp`);
    }
    if (o['fijo'] !== undefined) t.fijo = this.entero(o['fijo'], `${ruta}.fijo`);
    if (Object.keys(t).length === 0)
      this.errores.push(`${ruta}: un tope necesita umas, porcentaje_ingresos_bp o fijo`);
    return t;
  }

  regla(v: unknown, ruta: string): ReglaUso {
    const o = this.objeto(v, ruta);
    const r: ReglaUso = {
      en_tope_global: this.booleano(o['en_tope_global'], `${ruta}.en_tope_global`),
      requiere_pago_electronico: this.booleano(
        o['requiere_pago_electronico'],
        `${ruta}.requiere_pago_electronico`,
      ),
    };
    if (o['tope'] !== undefined) r.tope = this.tope(o['tope'], `${ruta}.tope`);
    if (o['tope_por_alumno_nivel'] !== undefined) {
      const niveles = this.objeto(o['tope_por_alumno_nivel'], `${ruta}.tope_por_alumno_nivel`);
      r.tope_por_alumno_nivel = Object.fromEntries(
        Object.entries(niveles).map(([n, m]) => [n, this.entero(m, `${ruta}.tope_por_alumno_nivel.${n}`)]),
      );
      if (Object.keys(niveles).length === 0) this.errores.push(`${ruta}.tope_por_alumno_nivel: sin niveles`);
    }
    return r;
  }
}

/**
 * Valida el contenido de `config/fiscal/<año>.json` (ya leído y parseado por quien lo carga) y lo
 * devuelve tipado. Falla cerrado: `config_fiscal_incompleta` si queda algún `POR_DEFINIR`
 * (el mensaje lista las rutas) y `config_fiscal_invalida` si la forma no es la de `10 §5`.
 * Con `ejercicio`, además exige que el archivo sea de ese año.
 */
export function validarConfigFiscal(datos: unknown, ejercicio?: number): ConfigFiscal {
  const pendientes = camposPorDefinir(datos);
  if (pendientes.length > 0) {
    throw new ErrorDominio('config_fiscal_incompleta', `parámetros por definir: ${pendientes.join(', ')}`);
  }
  const l = new Lector();
  const raiz = l.objeto(datos, 'config');
  const anio = l.entero(raiz['ejercicio'], 'ejercicio', 2000, 2999);
  if (ejercicio !== undefined && anio !== ejercicio) l.errores.push(`ejercicio: se esperaba ${ejercicio}`);
  const estado = raiz['estado'];
  if (estado !== 'por_validar' && estado !== 'validado') l.errores.push('estado: por_validar o validado');
  const fuentes = l.lista(raiz['fuentes'], 'fuentes').map((f, i) => l.texto(f, `fuentes[${i}]`));

  const resico = l.objeto(raiz['resico_pf'], 'resico_pf');
  const tabla_mensual = l.lista(resico['tabla_mensual'], 'resico_pf.tabla_mensual').map((f, i) => {
    const o = l.objeto(f, `resico_pf.tabla_mensual[${i}]`);
    return {
      hasta: l.entero(o['hasta'], `resico_pf.tabla_mensual[${i}].hasta`),
      tasa_bp: l.bp(o['tasa_bp'], `resico_pf.tabla_mensual[${i}].tasa_bp`),
    };
  });
  tabla_mensual.forEach((f, i) => {
    const anterior = tabla_mensual[i - 1];
    if (anterior && f.hasta <= anterior.hasta)
      l.errores.push('resico_pf.tabla_mensual: límites no crecientes');
  });

  const tarifa_anual_isr = l.lista(raiz['tarifa_anual_isr'], 'tarifa_anual_isr').map((f, i) => {
    const o = l.objeto(f, `tarifa_anual_isr[${i}]`);
    return {
      limite_inferior: l.entero(o['limite_inferior'], `tarifa_anual_isr[${i}].limite_inferior`),
      cuota_fija: l.entero(o['cuota_fija'], `tarifa_anual_isr[${i}].cuota_fija`),
      tasa_bp: l.bp(o['tasa_bp'], `tarifa_anual_isr[${i}].tasa_bp`),
    };
  });
  if (tarifa_anual_isr.length > 0) {
    try {
      validarTarifa(tarifa_anual_isr);
    } catch (e) {
      l.errores.push(`tarifa_anual_isr: ${(e as Error).message}`);
    }
  }

  const uma = l.objeto(raiz['uma'], 'uma');
  const umaDiaria = l.entero(uma['diaria'], 'uma.diaria', 1);
  const umaAnual = l.entero(uma['anual'], 'uma.anual', 1);

  const ded = l.objeto(raiz['deducciones'], 'deducciones');
  const usosCrudos = l.objeto(ded['usos'], 'deducciones.usos');
  const usos = Object.fromEntries(
    Object.entries(usosCrudos).map(([uso, r]) => [uso, l.regla(r, `deducciones.usos.${uso}`)]),
  );
  if (Object.keys(usosCrudos).length === 0) l.errores.push('deducciones.usos: sin usos');
  const deducciones: ConfigDeducciones = {
    uma_anual: umaAnual,
    tope_global: l.tope(ded['tope_global'], 'deducciones.tope_global'),
    formas_pago_electronicas: l
      .lista(ded['formas_pago_electronicas'], 'deducciones.formas_pago_electronicas')
      .map((f, i) => l.texto(f, `deducciones.formas_pago_electronicas[${i}]`)),
    tope_lentes_por_beneficiario: l.entero(
      ded['tope_lentes_por_beneficiario'],
      'deducciones.tope_lentes_por_beneficiario',
    ),
    usos,
  };

  const config: ConfigFiscal = {
    ejercicio: anio,
    estado: estado === 'validado' ? 'validado' : 'por_validar',
    fuentes,
    dia_pago: l.entero(raiz['dia_pago'], 'dia_pago', 1, 31),
    iva_tasa_general_bp: l.bp(raiz['iva_tasa_general_bp'], 'iva_tasa_general_bp'),
    porcentaje_por_defecto_bp: l.bp(raiz['porcentaje_por_defecto_bp'], 'porcentaje_por_defecto_bp'),
    resico_pf: { limite_anual: l.entero(resico['limite_anual'], 'resico_pf.limite_anual', 1), tabla_mensual },
    tarifa_anual_isr,
    uma: { diaria: umaDiaria, anual: umaAnual },
    deducciones,
  };
  if (l.errores.length > 0) {
    throw new ErrorDominio('config_fiscal_invalida', l.errores.join('; '));
  }
  return config;
}
