import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { strToU8 } from 'fflate';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import { datosExportacion } from '../privacidad/exportar';
import { contarCfdi, importarCfdi, resumenImportacion, TEXTO_RECHAZO, type ArchivoCfdi } from './cfdi';
import type { Contexto } from './contexto';
import {
  asignarAlumnoNivel,
  AVISO_DEDUCIBLE_EFECTIVO,
  confirmarPagoFactura,
  guardarPerfilFiscal,
  marcarLentes,
  MENSAJE_SIN_PARAMETROS,
  normalizarRfc,
  obtenerDeducciones,
  obtenerPerfilFiscal,
  TEXTO_MOTIVO_EXCLUSION,
  type VistaDeducciones,
} from './deducciones';
import { listarCuentas } from './cuentas';
import { registrarMovimiento } from './formulario';
import { registrarTexto } from './registrar';
import { cargarEscenario } from './semilla';
import { abrirPrueba, escenario } from './__pruebas__/base';
import {
  ahorroE13,
  armarZip,
  configFiscalPrueba,
  CONSULTA_MEDICA,
  deduccionE13,
  uuidDe,
} from './__pruebas__/fiscal';
import { nubeFalsa } from './__pruebas__/nube';

const CARPETA_CFDI = fileURLToPath(new URL('../../../../fixtures/cfdi', import.meta.url));

/** Los XML de `fixtures/cfdi`, leídos del disco (nunca copiados). */
function archivosFixture(): ArchivoCfdi[] {
  return readdirSync(CARPETA_CFDI)
    .filter((n) => n.endsWith('.xml'))
    .sort()
    .map((nombre) => ({ nombre, bytes: new Uint8Array(readFileSync(`${CARPETA_CFDI}/${nombre}`)) }));
}

/** CA-M12-02: `fixtures/cfdi` como un ZIP armado en la prueba (lo que comparte el portal del SAT). */
function zipFixture(): ArchivoCfdi {
  return { nombre: 'facturas.zip', bytes: armarZip(archivosFixture()) };
}

function conSemilla(configFiscal?: Record<number, unknown>): { ctx: Contexto } {
  const p = abrirPrueba('2026-10-11');
  cargarEscenario(p.ctx, escenario('e4-01'));
  p.reloj.fijar('2026-10-11');
  return { ctx: configFiscal ? { ...p.ctx, configFiscal } : p.ctx };
}

/** Perfil y etiquetas del vector E13-10 (RFC, ingresos, alumno/nivel y lentes) por la vía de la pantalla. */
function comoE1310(ctx: Contexto, baseGravable: number | null = null) {
  const v = deduccionE13('E13-10');
  guardarPerfilFiscal(ctx, { rfc: v.rfc, ingresos: v.ingresos, baseGravable });
  for (const [uuid, e] of Object.entries(v.etiquetas)) {
    if (e['lentes'] === true) marcarLentes(ctx, uuid, true);
    if (typeof e['alumno'] === 'string') asignarAlumnoNivel(ctx, uuid, e['alumno'], e['nivel'] as string);
  }
}

function lista(v: VistaDeducciones) {
  if (v.estado !== 'listo') throw new Error(`se esperaba la estimación, llegó ${v.estado}`);
  return v;
}

describe('CA-M12-02 · importar facturas (XML o ZIP)', () => {
  it('el ZIP de fixtures/cfdi: 8 importadas y 1 rechazada con su mensaje; reimportar no duplica', () => {
    const { ctx } = conSemilla();
    const r = importarCfdi(ctx, [zipFixture()]);
    expect(r.importadas).toBe(8);
    expect(r.repetidas).toBe(0);
    expect(r.rechazadas).toEqual([
      {
        archivo: 'facturas.zip › c09_version_33.xml',
        motivo: 'version_no_soportada',
        texto: TEXTO_RECHAZO.version_no_soportada,
      },
    ]);
    expect(r.resumen).toBe('Importé 8 facturas; 1 no es versión 4.0');
    expect(contarCfdi(ctx)).toBe(8);

    const otra = importarCfdi(ctx, [zipFixture()]);
    expect(otra).toMatchObject({ importadas: 0, repetidas: 8 });
    expect(otra.resumen).toBe('No importé facturas nuevas; 8 ya las tenías y 1 no es versión 4.0');
    expect(contarCfdi(ctx)).toBe(8);

    // El XML suelto que ya venía en el ZIP tampoco se duplica; el UUID manda aunque cambie el nombre.
    const [c01] = archivosFixture();
    expect(importarCfdi(ctx, [{ ...(c01 as ArchivoCfdi), nombre: 'copia.xml' }]).repetidas).toBe(1);
    expect(contarCfdi(ctx)).toBe(8);
  });

  it('XML sueltos: el mismo UUID dos veces en una tanda entra una vez; el XML se guarda completo', () => {
    const { ctx } = conSemilla();
    const archivos = archivosFixture();
    const r = importarCfdi(ctx, [...archivos, archivos[0] as ArchivoCfdi]);
    expect(r).toMatchObject({ importadas: 8, repetidas: 1 });
    const filas = datosExportacion(ctx).tablas['cfdi'] ?? [];
    expect(filas).toHaveLength(8);
    const c01 = filas.find((f) => f['uuid'] === uuidDe('c01_dentista_debito.xml'));
    expect(c01?.['xml']).toBe(readFileSync(`${CARPETA_CFDI}/c01_dentista_debito.xml`, 'utf8'));
    expect(c01).toMatchObject({ estatus: 'desconocido', etiquetas: '{}', transaccion_id: null });
  });

  it('cada motivo de rechazo tiene su texto llano y el resumen los agrupa', () => {
    const { ctx } = conSemilla();
    const xml = (s: string) => strToU8(s);
    const r = importarCfdi(ctx, [
      { nombre: 'roto.xml', bytes: xml('<cfdi:Comprobante') },
      { nombre: 'otro.xml', bytes: xml('<factura xmlns="urn:otra"><total>1</total></factura>') },
      { nombre: 'factura.pdf', bytes: xml('%PDF-1.7') },
      { nombre: 'malo.zip', bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]) },
      {
        nombre: 'dentro.zip',
        bytes: armarZip([
          { nombre: 'leeme.pdf', bytes: xml('%PDF') },
          { nombre: '__MACOSX/._c01.xml', bytes: xml('x') },
        ]),
      },
    ]);
    expect(r.importadas).toBe(0);
    expect(r.rechazadas.map((x) => [x.archivo, x.motivo])).toEqual([
      ['factura.pdf', 'archivo_no_soportado'],
      ['malo.zip', 'zip_invalido'],
      ['roto.xml', 'xml_invalido'],
      ['otro.xml', 'no_es_cfdi'],
    ]);
    expect(r.resumen).toBe(
      'No importé facturas nuevas; 1 no es XML ni ZIP, 1 es un ZIP dañado, 1 está dañado y 1 no es factura',
    );
    for (const texto of Object.values(TEXTO_RECHAZO)) {
      expect(texto).toMatch(/^[A-ZÁÉÍÓÚÑ¿]/);
      expect(texto).not.toMatch(/exitosamente|por favor|!/i);
    }
    expect(
      resumenImportacion({
        importadas: 1,
        repetidas: 2,
        rechazadas: [
          { archivo: 'a', motivo: 'sin_timbre', texto: '' },
          { archivo: 'b', motivo: 'sin_timbre', texto: '' },
        ],
      }),
    ).toBe('Importé 1 factura; 2 ya las tenías y 2 no están timbradas');
  });

  it('un ZIP con un XML declarado demasiado grande lo rechaza sin leerlo', () => {
    const { ctx } = conSemilla();
    const grande = new Uint8Array(3 * 1024 * 1024).fill(0x20);
    const r = importarCfdi(ctx, [{ nombre: 'z.zip', bytes: armarZip([{ nombre: 'g.xml', bytes: grande }]) }]);
    expect(r.rechazadas).toEqual([
      { archivo: 'z.zip › g.xml', motivo: 'demasiado_grande', texto: TEXTO_RECHAZO.demasiado_grande },
    ]);
  });

  it('sin el consentimiento no guarda nada', () => {
    const p = abrirPrueba('2026-10-11');
    expect(() => importarCfdi(p.ctx, [zipFixture()])).toThrow(/aviso de privacidad/);
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    expect(importarCfdi(p.ctx, [zipFixture()]).importadas).toBe(8);
  });

  it('ni importar ni estimar escriben en la consola (regla 9)', () => {
    const espias = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    const { ctx } = conSemilla(configFiscalPrueba());
    importarCfdi(ctx, [zipFixture(), { nombre: 'x.xml', bytes: strToU8('<a') }]);
    comoE1310(ctx, 30_000_000);
    obtenerDeducciones(ctx);
    for (const e of espias) {
      expect(e).not.toHaveBeenCalled();
      e.mockRestore();
    }
  });
});

describe('CA-M12-03 · deducciones del año con E13.config_prueba', () => {
  it('E13-10: $25,900 deducibles, por tipo, y cada exclusión con su motivo llano', () => {
    const { ctx } = conSemilla(configFiscalPrueba());
    importarCfdi(ctx, [zipFixture()]);
    comoE1310(ctx);
    const v = lista(obtenerDeducciones(ctx));
    expect(v.total).toBe(deduccionE13('E13-10').esperado.total_deducible);
    expect(v.titulo).toBe('Llevas $25,900 deducibles en 2026 (estimación)');
    expect(v.porTipo.map((t) => t.texto)).toEqual([
      'Médicos, dentista y hospital: $4,000',
      'Seguros de gastos médicos: $9,000',
      'Colegiaturas: $12,900',
    ]);
    expect(v.noDeducibles.map((f) => [f.uuid, f.motivo])).toEqual(
      deduccionE13('E13-10').esperado.excluidos.map((e) => [e.uuid, e.motivo]),
    );
    expect(v.noDeducibles.map((f) => [f.emisor, f.textoMotivo])).toEqual([
      ['CONSULTORIO FICTICIO', 'lo pagaste en efectivo'],
      ['GASOLINERA FICTICIA', 'no es un gasto deducible'],
      ['HOSPITAL FICTICIO', 'factura en pagos sin confirmar'],
    ]);
    expect(v.textoTope).toBeNull();
    expect(v.niveles.map((n) => n.etiqueta)).toEqual([
      'Preescolar',
      'Primaria',
      'Secundaria',
      'Profesional técnico',
      'Bachillerato',
    ]);
    const hospital = v.facturas.find((f) => f.uuid === uuidDe('c08_hospital_ppd.xml'));
    expect(hospital).toMatchObject({ enPagos: true, pagoConfirmado: null, estado: 'no_deducible' });
    const colegiatura = v.facturas.find((f) => f.uuid === uuidDe('c04_colegiatura_enero.xml'));
    expect(colegiatura).toMatchObject({ pideAlumnoNivel: true, alumno: 'ana', nivel: 'primaria' });
    expect(v.facturas.find((f) => f.uuid === uuidDe('c03_lentes_tarjeta.xml'))).toMatchObject({
      ofreceLentes: true,
      lentes: true,
    });
    expect(v.leyenda).toBe(
      'Estimación para apartar dinero y preparar tu declaración. No sustituye a tu contador ni presenta declaraciones ante el SAT.',
    );
  });

  it('E13-12: al confirmar el pago del PPD por transferencia, $30,900', () => {
    const { ctx } = conSemilla(configFiscalPrueba());
    importarCfdi(ctx, [zipFixture()]);
    comoE1310(ctx);
    const hospital = uuidDe('c08_hospital_ppd.xml');
    confirmarPagoFactura(ctx, hospital, 'transferencia');
    const v = lista(obtenerDeducciones(ctx));
    expect(v.total).toBe(deduccionE13('E13-12').esperado.total_deducible);
    expect(v.titulo).toBe('Llevas $30,900 deducibles en 2026 (estimación)');
    expect(v.facturas.find((f) => f.uuid === hospital)).toMatchObject({
      estado: 'deducible',
      pagoConfirmado: 'transferencia',
    });
    // En efectivo no cuenta (requiere pago electrónico).
    confirmarPagoFactura(ctx, hospital, 'efectivo');
    expect(lista(obtenerDeducciones(ctx)).total).toBe(deduccionE13('E13-10').esperado.total_deducible);
  });

  it('E13-11: con ingresos de $60,000 el tope recorta y lo dice', () => {
    const { ctx } = conSemilla(configFiscalPrueba());
    importarCfdi(ctx, [zipFixture()]);
    comoE1310(ctx);
    guardarPerfilFiscal(ctx, {
      rfc: 'PEPJ800101AB1',
      ingresos: deduccionE13('E13-11').ingresos,
      baseGravable: null,
    });
    const v = lista(obtenerDeducciones(ctx));
    expect(v.total).toBe(deduccionE13('E13-11').esperado.total_deducible);
    expect(v.textoTope).toBe('Llegaste al tope del año: $4,000 ya no cuentan.');
  });

  it('E13.3: con base gravable, "Podrías pagar unos $X menos de ISR" (E13-20, en pesos hacia abajo)', () => {
    const { ctx } = conSemilla(configFiscalPrueba());
    importarCfdi(ctx, [zipFixture()]);
    const a = ahorroE13('E13-20');
    comoE1310(ctx, a.base_gravable);
    const v = lista(obtenerDeducciones(ctx));
    expect(v.total).toBe(a.deducciones);
    expect(v.ahorro).toBe(a.esperado['ahorro_estimado']);
    expect(v.textoAhorro).toBe('Podrías pagar unos $2,817 menos de ISR');
    comoE1310(ctx, null);
    expect(lista(obtenerDeducciones(ctx)).textoAhorro).toMatch(/agrega tu base gravable/);
  });

  it('sin alumno y nivel, las colegiaturas no cuentan y lo dice', () => {
    const { ctx } = conSemilla(configFiscalPrueba());
    importarCfdi(ctx, [zipFixture()]);
    guardarPerfilFiscal(ctx, { rfc: 'pepj-800101-ab1', ingresos: 30_000_000, baseGravable: null });
    const v = lista(obtenerDeducciones(ctx));
    const sinAlumno = v.noDeducibles.filter((f) => f.motivo === 'falta_alumno_nivel');
    expect(sinAlumno).toHaveLength(2);
    expect(sinAlumno[0]?.textoMotivo).toBe('falta decir el alumno y el nivel');
  });

  it('todos los motivos de exclusión tienen texto llano sin tecnicismos', () => {
    for (const texto of Object.values(TEXTO_MOTIVO_EXCLUSION)) {
      expect(texto).not.toMatch(/PPD|PUE|CFDI|uso|ejercicio|receptor|exclusi/i);
    }
  });
});

describe('Deducciones · perfil y parámetros por validar', () => {
  it('sin perfil pide los datos; el RFC se normaliza y se valida', () => {
    const { ctx } = conSemilla(configFiscalPrueba());
    importarCfdi(ctx, [zipFixture()]);
    const v = obtenerDeducciones(ctx);
    expect(v.estado).toBe('sin_perfil');
    expect(v.facturas).toHaveLength(8);
    expect(normalizarRfc(' pepj 800101 ab1 ')).toBe('PEPJ800101AB1');
    expect(normalizarRfc('ABC010101AB1')).toBeNull();
    expect(() => guardarPerfilFiscal(ctx, { rfc: 'XAXX', ingresos: 1, baseGravable: null })).toThrow(/RFC/);
    expect(() =>
      guardarPerfilFiscal(ctx, { rfc: 'PEPJ800101AB1', ingresos: -1, baseGravable: null }),
    ).toThrow();
    guardarPerfilFiscal(ctx, { rfc: 'PEPJ800101AB1', ingresos: 30_000_000, baseGravable: null });
    expect(obtenerPerfilFiscal(ctx)).toEqual({
      rfc: 'PEPJ800101AB1',
      ingresos: 30_000_000,
      base_gravable: null,
    });
  });

  it('con config/fiscal/2026.json por validar no calcula nada y lo explica', () => {
    const { ctx } = conSemilla();
    importarCfdi(ctx, [zipFixture()]);
    comoE1310(ctx, 30_000_000);
    const v = obtenerDeducciones(ctx);
    expect(v.estado).toBe('sin_parametros');
    if (v.estado !== 'sin_parametros') return;
    expect(v.mensaje).toBe(MENSAJE_SIN_PARAMETROS);
    expect(v.facturas).toHaveLength(8);
    expect(v.facturas.every((f) => f.estado === 'sin_calcular' && !f.pideAlumnoNivel)).toBe(true);
    expect(JSON.stringify(v)).not.toMatch(/deducibles|ISR/);
  });

  it('una configuración completa pero sin la firma del contador tampoco calcula', () => {
    const config = configFiscalPrueba();
    const sinFirma = { 2026: { ...(config[2026] as object), estado: 'por_validar' } };
    const { ctx } = conSemilla(sinFirma);
    importarCfdi(ctx, [zipFixture()]);
    comoE1310(ctx);
    expect(obtenerDeducciones(ctx).estado).toBe('sin_parametros');
    expect(obtenerDeducciones(ctx, 2025).estado).toBe('sin_parametros');
  });

  it('las facturas de otro año no entran a la estimación del año y el año aparece para elegirlo', () => {
    const { ctx } = conSemilla(configFiscalPrueba());
    importarCfdi(ctx, [zipFixture()]);
    comoE1310(ctx);
    const v = obtenerDeducciones(ctx, 2025);
    expect(v.facturas).toEqual([]);
    expect(obtenerDeducciones(ctx).ejercicios).toEqual([2026]);
  });
});

describe('CA-M12-04 · aviso preventivo al registrar salud en efectivo', () => {
  it('"consulta médica de 800 en efectivo" lo trae; con tarjeta o de otra categoría, no', async () => {
    const { ctx } = conSemilla();
    const f = nubeFalsa({ [CONSULTA_MEDICA.texto]: CONSULTA_MEDICA.interpretacion });
    const r = await registrarTexto(ctx, CONSULTA_MEDICA.texto, 'texto', { nube: f.nube });
    if (r.resultado !== 'registrado') throw new Error(`se esperaba registro, llegó ${r.resultado}`);
    expect(r.movimientos[0]).toMatchObject({ monto: 80_000, avisoDeducible: true });
    expect(AVISO_DEDUCIBLE_EFECTIVO).toBe(
      'Si lo pagas con tarjeta o transferencia y pides factura, lo puedes deducir.',
    );
    const coca = await registrarTexto(ctx, 'coca 25 en efectivo', 'texto');
    if (coca.resultado !== 'registrado') throw new Error(coca.resultado);
    expect(coca.movimientos[0]?.avisoDeducible).toBe(false);
  });

  it('también desde el formulario: salud en efectivo sí, salud con tarjeta no', () => {
    const { ctx } = conSemilla();
    const cuentas = listarCuentas(ctx).tienes;
    const efectivo = cuentas.find((c) => c.subtipo === 'efectivo')?.id as string;
    const debito = cuentas.find((c) => c.subtipo === 'debito')?.id as string;
    const salud = (origenId: string) =>
      registrarMovimiento(ctx, { tipo: 'gasto', monto: 80_000, categoria: 'salud', origenId }).avisoDeducible;
    expect(salud(efectivo)).toBe(true);
    expect(salud(debito)).toBe(false);
    expect(
      registrarMovimiento(ctx, { tipo: 'gasto', monto: 2_500, categoria: 'antojos', origenId: efectivo })
        .avisoDeducible,
    ).toBe(false);
  });
});
