// M9 · respaldo en la nube: CA-M9-04 (automático, 4 más recientes, blob ilegible), CA-M9-05 (restaurar en otro
// teléfono, parte de la app con una nube falsa), CA-M9-06 (aviso a los 14 días con reloj fijo), CA-M9-07 (borrar la
// cuenta de punta a punta) y CA-M9-08 (el automático no necesita la contraseña).
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { construirGasto, sumarDias } from '@cartera/core';
import { comprobarIntegridad } from '@cartera/datos';
import { leerEncabezado } from '@cartera/respaldo';
import { criptoNode } from '@cartera/respaldo/node';
import { puertoEnMemoria } from '../avisos/puerto';
import { almacenEnMemoria } from '../db/llave';
import { aleatorioNode, puertoNode } from '../db/node';
import { TABLAS_EXPORTADAS } from '../privacidad/exportar';
import { completarOnboarding } from './ajustes';
import { fijarPreferenciasAvisos } from './avisos-tarjetas';
import { crearContexto, type Contexto } from './contexto';
import { obtenerHoy } from './hoy';
import { crearGeneradorSecuencial } from './ids';
import { crearPersona } from './personas';
import {
  fijarContrasenaRespaldo,
  prepararRestauracion,
  restaurarRespaldo,
  type DependenciasRespaldo,
} from './respaldo';
import {
  bajarUltimoRespaldo,
  borrarCuentaRespaldo,
  confirmarCodigoRespaldo,
  ejecutarRespaldoAutomatico,
  fijarRespaldoAutomatico,
  mensajeErrorNube,
  obtenerRespaldoNube,
  planAvisoRespaldo,
  registrarRespaldoRestaurado,
  respaldarEnNube,
  sincronizarAvisoRespaldo,
  type NubeRespaldo,
  type TipoRed,
} from './respaldo-nube';
import { cargarEscenario } from './semilla';
import { abrirPrueba, escenario, type Prueba } from './__pruebas__/base';
import { servidorRespaldoFalso } from './__pruebas__/respaldo-nube';

const CONTRASENA = 'mi respaldo seguro 2026';
const CORREO = 'ana@correo.mx';
const COMERCIO = 'Taquería El Güero';
const PERSONA = 'Mariana Soto';

function dependencias(): DependenciasRespaldo {
  return {
    cripto: criptoNode,
    almacen: almacenEnMemoria(),
    aleatorio: aleatorioNode,
    puertoBase: puertoNode(),
    puertoEnsayo: () => puertoNode(),
  };
}

/** Teléfono con la semilla e4-01, un comercio y una persona con nombre, y la contraseña de respaldo creada. */
async function telefonoConDatos(hoy = '2026-10-11'): Promise<Prueba & { deps: DependenciasRespaldo }> {
  const p = abrirPrueba(hoy);
  const e = cargarEscenario(p.ctx, escenario('e4-01'));
  p.ctx.libro.registrar({
    ...construirGasto({ categoria: 'cat:personal:super', pago: e.cuentas.bbva ?? '', monto: 123_456 }),
    fecha: hoy,
    origen: 'manual',
    claveIdempotencia: 'prueba:comercio',
    descripcion: COMERCIO,
  });
  crearPersona(p.ctx, { nombre: PERSONA });
  const deps = dependencias();
  await fijarContrasenaRespaldo(deps, CONTRASENA, CONTRASENA);
  return { ...p, deps };
}

async function vincular(nube: NubeRespaldo, ctx: Contexto, correo = CORREO) {
  const pedido = await nube.cuenta.pedirCodigo(correo);
  if (!pedido.ok) throw new Error(pedido.error);
  const r = await confirmarCodigoRespaldo(nube.cuenta, ctx, correo, '123456', pedido.modo);
  if (!r.ok) throw new Error(r.error);
  return r;
}

const contenido = (ctx: Pick<Contexto, 'db'>) =>
  Object.fromEntries(
    TABLAS_EXPORTADAS.filter((t) => t !== 'ajuste').map((t) => [
      t,
      ctx.db.all(sql.raw(`SELECT * FROM "${t}" ORDER BY rowid`)),
    ]),
  );

/** Como `strings`: tramos de 4 o más caracteres imprimibles (latin1 y UTF-8). */
function legibles(bytes: Uint8Array): string[] {
  const textos = [Buffer.from(bytes).toString('latin1'), Buffer.from(bytes).toString('utf8')];
  return textos.flatMap((t) => t.match(/[\x20-\x7e\u00a0-\u024f]{4,}/g) ?? []);
}

describe('respaldo en la nube (M9)', () => {
  it('CA-M9-04 · el automático semanal sube con Wi-Fi, conserva los 4 más recientes y el blob no tiene nada legible', async () => {
    const servidor = servidorRespaldoFalso();
    const nube = servidor.telefono();
    const p = await telefonoConDatos('2026-10-01');
    await vincular(nube, p.ctx);
    fijarRespaldoAutomatico(p.ctx, { automatico: true });
    let red: TipoRed = 'wifi';
    const deps = { cifrado: p.deps, respaldos: nube.respaldos, red: async () => red };

    // Seis semanas: cada lunes la tarea corre varias veces al día; solo respalda una vez por semana.
    const hechos: string[] = [];
    for (let dia = 0; dia < 42; dia++) {
      p.reloj.fijar(sumarDias('2026-10-01', dia));
      for (let corrida = 0; corrida < 2; corrida++) {
        const r = await ejecutarRespaldoAutomatico(deps, p.ctx);
        if (r.tipo === 'hecho') hechos.push(r.fecha);
        else if (r.tipo === 'error') throw new Error(r.error);
      }
    }
    expect(hechos).toEqual([0, 7, 14, 21, 28, 35].map((d) => sumarDias('2026-10-01', d)));
    expect(servidor.archivosDe(nube.sesion().usuarioId)).toHaveLength(4);
    expect(obtenerRespaldoNube(p.ctx).textoUltimo).toBe('Último respaldo: hace 6 días');

    // Sin Wi-Fi no sube con datos móviles (salvo que se apague "solo con Wi-Fi"); sin red, tampoco.
    p.reloj.fijar('2026-11-20');
    red = 'celular';
    expect(await ejecutarRespaldoAutomatico(deps, p.ctx)).toEqual({ tipo: 'omitido', motivo: 'sin_wifi' });
    red = 'ninguna';
    expect(await ejecutarRespaldoAutomatico(deps, p.ctx)).toEqual({ tipo: 'omitido', motivo: 'sin_red' });
    red = 'celular';
    fijarRespaldoAutomatico(p.ctx, { soloWifi: false });
    expect((await ejecutarRespaldoAutomatico(deps, p.ctx)).tipo).toBe('hecho');
    fijarRespaldoAutomatico(p.ctx, { automatico: false });
    p.reloj.fijar('2026-12-31');
    expect(await ejecutarRespaldoAutomatico(deps, p.ctx)).toEqual({ tipo: 'omitido', motivo: 'apagado' });

    // Lo que guardó el servidor: ni montos, ni nombres, ni comercios, ni cuentas legibles. El encabezado en
    // claro solo trae el formato, la KDF, la fecha y la versión del esquema.
    expect(servidor.subidos.length).toBe(7);
    const prohibidos = [
      COMERCIO,
      'Taquer',
      'Güero',
      PERSONA,
      'Mariana',
      'Cartera',
      'BBVA',
      '5521',
      'Nu ',
      'renta',
    ];
    const montos = ['123456', '1,234.56', '1234.56', '359000', '650000', '450000', '67400'];
    for (const blob of servidor.subidos) {
      const { encabezado } = leerEncabezado(blob);
      expect(Object.keys(encabezado).sort()).toEqual(
        ['cifrado', 'contenido', 'creado_en', 'formato', 'kdf', 'version', 'version_esquema'].sort(),
      );
      for (const tramo of legibles(blob)) {
        for (const x of [...prohibidos, ...montos]) expect(tramo).not.toContain(x);
      }
    }
    p.base.cerrar();
  }, 120_000);

  it('CA-M9-05 · otro teléfono entra con correo y código, baja el más reciente y con la contraseña reproduce el estado', async () => {
    const servidor = servidorRespaldoFalso();
    const viejo = await telefonoConDatos('2026-10-11');
    const nubeVieja = servidor.telefono();
    await vincular(nubeVieja, viejo.ctx);
    expect(
      (await respaldarEnNube({ cifrado: viejo.deps, respaldos: nubeVieja.respaldos }, viejo.ctx)).ok,
    ).toBe(true);
    // Un movimiento más y otro respaldo: el nuevo teléfono debe traer el más reciente.
    viejo.ctx.libro.registrar({
      ...construirGasto({
        categoria: 'cat:personal:super',
        pago: viejo.ctx.db.get<{ id: string }>(sql`SELECT id FROM cuenta WHERE nombre = 'Cartera'`)?.id ?? '',
        monto: 5_000,
      }),
      fecha: '2026-10-11',
      origen: 'manual',
      claveIdempotencia: 'prueba:ultimo',
    });
    expect(
      (await respaldarEnNube({ cifrado: viejo.deps, respaldos: nubeVieja.respaldos }, viejo.ctx)).ok,
    ).toBe(true);
    // Primero las filas: Hoy materializa ocurrencias al calcularse.
    const filas = contenido(viejo.ctx);
    const antes = { filas, hoy: obtenerHoy(viejo.ctx) };

    // Teléfono nuevo: sin datos, sin llave, sesión anónima propia.
    const nueva = servidor.telefono();
    const destino = dependencias();
    expect(await nueva.cuenta.pedirCodigo('otro@correo.mx', { soloEntrar: true })).toEqual({
      ok: false,
      error: 'sin_cuenta',
    });
    const pedido = await nueva.cuenta.pedirCodigo(CORREO, { soloEntrar: true });
    expect(pedido).toEqual({ ok: true, modo: 'entrar' });
    // La cuenta todavía no se puede abrir (no hay base): la confirmación sin contexto es la de la cuenta.
    expect(await nueva.cuenta.verificarCodigo(CORREO, '000000', 'entrar')).toEqual({
      ok: false,
      error: 'codigo_invalido',
    });
    const entrada = await nueva.cuenta.verificarCodigo(CORREO, '123456', 'entrar');
    expect(entrada).toMatchObject({ ok: true, usuarioId: nubeVieja.sesion().usuarioId });

    const bajado = await bajarUltimoRespaldo(nueva.respaldos);
    if (!bajado.ok) throw new Error(bajado.error);
    expect(bajado.respaldo.nombre).toBe(
      servidor.archivosDe(nubeVieja.sesion().usuarioId).sort().reverse()[0],
    );
    await expect(prepararRestauracion(destino, bajado.bytes, 'otra contraseña')).rejects.toMatchObject({
      codigo: 'respaldo_corrupto_o_contrasena_incorrecta',
    });
    const listo = await prepararRestauracion(destino, bajado.bytes, CONTRASENA);
    const base = restaurarRespaldo(destino, listo);
    const ctx = crearContexto({ db: base.db, reloj: viejo.reloj, generarId: crearGeneradorSecuencial() });
    registrarRespaldoRestaurado(ctx, listo.fecha);

    expect(contenido(ctx)).toEqual(antes.filas);
    expect(obtenerHoy(ctx)).toEqual(antes.hoy);
    expect(comprobarIntegridad(ctx.db)).toEqual([]);
    expect(obtenerRespaldoNube(ctx)).toMatchObject({ ultimo: '2026-10-11', pedirCorreo: false });

    // El automático sigue en el teléfono nuevo con la llave restaurada (sin pedir la contraseña).
    fijarRespaldoAutomatico(ctx, { automatico: true });
    viejo.reloj.fijar('2026-10-18');
    const r = await ejecutarRespaldoAutomatico(
      { cifrado: destino, respaldos: nueva.respaldos, red: async () => 'wifi' },
      ctx,
    );
    expect(r).toEqual({ tipo: 'hecho', fecha: '2026-10-18' });

    // Otra cuenta no ve los respaldos de esta (la RLS real se prueba contra Supabase, pendiente 55).
    const ajena = servidor.telefono();
    const otra = abrirPrueba('2026-10-11');
    await vincular(ajena, otra.ctx, 'otra@correo.mx');
    expect(await bajarUltimoRespaldo(ajena.respaldos)).toEqual({ ok: false, error: 'sin_respaldos' });
    expect(await ajena.respaldos.bajar(bajado.respaldo.nombre)).toEqual({
      ok: false,
      error: 'no_encontrado',
    });

    base.cerrar();
    viejo.base.cerrar();
    otra.base.cerrar();
  }, 120_000);

  it('sin_correo (la sesión de correo caducó y quedó un anónimo): se marca para pedir correo y código otra vez', async () => {
    const servidor = servidorRespaldoFalso();
    const nube = servidor.telefono();
    const p = await telefonoConDatos();
    await vincular(nube, p.ctx);
    fijarRespaldoAutomatico(p.ctx, { automatico: true });
    nube.caducarSesion();

    const deps = { cifrado: p.deps, respaldos: nube.respaldos, red: async (): Promise<TipoRed> => 'wifi' };
    expect(await ejecutarRespaldoAutomatico(deps, p.ctx)).toEqual({ tipo: 'error', error: 'sin_correo' });
    expect(obtenerRespaldoNube(p.ctx).pedirCorreo).toBe(true);
    expect(mensajeErrorNube('sin_correo')).toBe('Vuelve a entrar con tu correo para seguir respaldando.');
    // Mientras tanto la tarea no insiste.
    expect(await ejecutarRespaldoAutomatico(deps, p.ctx)).toEqual({
      tipo: 'omitido',
      motivo: 'pedir_correo',
    });

    // Correo y código de nuevo: "entrar" al mismo usuario y el automático sigue.
    const r = await vincular(nube, p.ctx);
    expect(r.cambioUsuario).toBe(true);
    expect(obtenerRespaldoNube(p.ctx).pedirCorreo).toBe(false);
    expect((await ejecutarRespaldoAutomatico(deps, p.ctx)).tipo).toBe('hecho');
    p.base.cerrar();
  }, 60_000);

  it('respaldar sin contraseña o sin red no cambia la fecha del último respaldo', async () => {
    const servidor = servidorRespaldoFalso();
    const nube = servidor.telefono();
    const p = abrirPrueba('2026-10-11');
    cargarEscenario(p.ctx, escenario('e4-01'));
    await vincular(nube, p.ctx);
    const sinLlave = dependencias();
    expect(await respaldarEnNube({ cifrado: sinLlave, respaldos: nube.respaldos }, p.ctx)).toEqual({
      ok: false,
      error: 'sin_contrasena',
    });
    await fijarContrasenaRespaldo(sinLlave, CONTRASENA, CONTRASENA);
    servidor.desconectar();
    expect(await respaldarEnNube({ cifrado: sinLlave, respaldos: nube.respaldos }, p.ctx)).toEqual({
      ok: false,
      error: 'sin_red',
    });
    expect(obtenerRespaldoNube(p.ctx)).toMatchObject({
      ultimo: null,
      textoUltimo: 'Todavía no tienes respaldos en la nube.',
      pedirCorreo: false,
    });
    p.base.cerrar();
  }, 60_000);

  it('CA-M9-07 (app) · borrar la cuenta de respaldo: archivos y cuenta en el servidor, sesión nueva y estado local limpio', async () => {
    const servidor = servidorRespaldoFalso();
    const nube = servidor.telefono();
    const p = await telefonoConDatos();
    const { usuarioId } = await vincular(nube, p.ctx);
    fijarRespaldoAutomatico(p.ctx, { automatico: true });
    expect((await respaldarEnNube({ cifrado: p.deps, respaldos: nube.respaldos }, p.ctx)).ok).toBe(true);
    expect(servidor.archivosDe(usuarioId)).toHaveLength(1);

    servidor.desconectar();
    expect(await borrarCuentaRespaldo(nube, p.ctx)).toEqual({ ok: false, error: 'sin_red' });
    expect(nube.sesion().usuarioId).toBe(usuarioId);
    servidor.desconectar(false);

    expect(await borrarCuentaRespaldo(nube, p.ctx)).toEqual({ ok: true });
    expect(servidor.archivosDe(usuarioId)).toEqual([]);
    expect(servidor.existeCuenta(CORREO)).toBe(false);
    expect(nube.sesion()).toMatchObject({ correo: null });
    expect(nube.sesion().usuarioId).not.toBe(usuarioId);
    expect(obtenerRespaldoNube(p.ctx)).toMatchObject({ automatico: false, ultimo: null, pedirCorreo: false });
    p.base.cerrar();
  }, 60_000);

  it('CA-M9-06 · con 14 días simulados sin respaldo aparece el aviso (y un respaldo lo recorre)', async () => {
    const p = abrirPrueba('2026-10-01');
    cargarEscenario(p.ctx, escenario('e4-01'));
    const puerto = puertoEnMemoria();
    // El onboarding terminó el 1 de octubre (`ahora` del reloj fijo está en esa fecha en CDMX).
    p.reloj.fijarInstante(Date.UTC(2026, 9, 1, 18, 0, 0));
    completarOnboarding(p.ctx);

    for (let dia = 0; dia < 14; dia++) {
      p.reloj.fijar(sumarDias('2026-10-01', dia));
      expect(obtenerRespaldoNube(p.ctx).pendiente).toBe(false);
    }
    await sincronizarAvisoRespaldo(p.ctx, puerto, '12:00');
    expect(puerto.lista()[0]).toMatchObject({
      id: 'respaldo:2026-10-15',
      fecha: '2026-10-15',
      hora: '09:00',
      titulo: 'Respalda tus datos',
    });

    p.reloj.fijar('2026-10-15');
    expect(obtenerRespaldoNube(p.ctx).pendiente).toBe(true);
    await sincronizarAvisoRespaldo(p.ctx, puerto, '08:00');
    expect(puerto.lista().map((n) => n.fecha)).toEqual([
      '2026-10-15',
      '2026-10-22',
      '2026-10-29',
      '2026-11-05',
    ]);

    // Un respaldo (aquí, uno restaurado de ese día) reinicia la cuenta: el siguiente aviso es en 14 días.
    registrarRespaldoRestaurado(p.ctx, '2026-10-15');
    expect(obtenerRespaldoNube(p.ctx).pendiente).toBe(false);
    await sincronizarAvisoRespaldo(p.ctx, puerto, '10:00');
    expect(puerto.lista()[0]?.fecha).toBe('2026-10-29');

    // Apagado en Ajustes → Avisos: se cancelan.
    fijarPreferenciasAvisos(p.ctx, { respaldo: false });
    expect(planAvisoRespaldo(p.ctx, '10:00')).toEqual([]);
    await sincronizarAvisoRespaldo(p.ctx, puerto, '10:00');
    expect(puerto.lista()).toEqual([]);
    p.base.cerrar();
  });

  it('sin onboarding terminado no hay aviso; "hoy", "ayer" y "hace N días"', () => {
    const p = abrirPrueba('2026-10-11');
    expect(planAvisoRespaldo(p.ctx, '10:00')).toEqual([]);
    registrarRespaldoRestaurado(p.ctx, '2026-10-11');
    expect(obtenerRespaldoNube(p.ctx).textoUltimo).toBe('Último respaldo: hoy');
    p.reloj.fijar('2026-10-12');
    expect(obtenerRespaldoNube(p.ctx).textoUltimo).toBe('Último respaldo: ayer');
    p.reloj.fijar('2026-10-13');
    expect(obtenerRespaldoNube(p.ctx).textoUltimo).toBe('Último respaldo: hace 2 días');
    // Un respaldo restaurado más viejo no retrocede la fecha.
    registrarRespaldoRestaurado(p.ctx, '2026-10-01');
    expect(obtenerRespaldoNube(p.ctx).ultimo).toBe('2026-10-11');
    p.base.cerrar();
  });
});
