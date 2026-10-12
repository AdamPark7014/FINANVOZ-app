// M16 de punta a punta: dos teléfonos (los servicios de la app, cada uno con su base SQLite, su almacén seguro y su
// libro) contra este servidor (el manejador real con la migración real en PGlite), hablando por el cliente HTTP de
// la app (`nube/compartido-nube.ts`). Cubre CA-M16-03, la parte de inspección de CA-M16-04 y los flujos de
// CA-M16-05 y CA-M16-06. Lo que falta es lo del teléfono real (cámara y dos emuladores): pendientes de ESTADO.
import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CLAVE_LLAVES_COMPARTIDO,
  obtenerLlaveGrupo,
} from '../../../../../../apps/movil/src/compartido/llaves.ts';
import { crearClienteCompartido } from '../../../../../../apps/movil/src/nube/compartido-nube.ts';
import { aceptarConsentimiento } from '../../../../../../apps/movil/src/privacidad/consentimiento.ts';
import {
  agregarGastoCompartido,
  anularEventoCompartido,
  crearGrupoCompartido,
  mostrarCodigo,
  obtenerGrupoCompartido,
  registrarPagoCompartido,
  salirDelGrupo,
  sincronizarGrupo,
  unirseConQr,
  type DependenciasCompartido,
} from '../../../../../../apps/movil/src/servicios/compartido.ts';
import { agregarCuenta } from '../../../../../../apps/movil/src/servicios/onboarding.ts';
import {
  abrirPrueba,
  vector,
  type Prueba,
} from '../../../../../../apps/movil/src/servicios/__pruebas__/base.ts';
import { crearCriptoNoble } from '../../../../../../packages/sincronizacion/src/noble.ts';
import { abrirServidor, type ServidorPrueba } from './__pruebas__/servidor.ts';

type Gasto = { id: string; total: number; pago: 'a' | 'b'; proporcion_a_bp: number; anulado?: boolean };
type Pago = { id: string; tipo: 'pago'; de: 'a' | 'b'; monto: number };

interface Telefono extends Prueba {
  usuario: string;
  deps: DependenciasCompartido;
  bbva: string;
}

let s: ServidorPrueba;

beforeEach(async () => {
  s = await abrirServidor();
});

/** Cliente HTTP de la app con un `fetch` que entrega la petición al manejador. */
function cliente(usuario: string) {
  return crearClienteCompartido({
    url: 'https://abc.supabase.co',
    sesion: { obtenerToken: async () => `jwt-${usuario}` },
    fetch: async (url, p) => {
      const r = await s.manejador(
        new Request(url, {
          method: p.method,
          headers: p.headers,
          ...(p.body === undefined ? {} : { body: p.body as string }),
        }),
      );
      return { status: r.status, json: () => r.json(), arrayBuffer: () => r.arrayBuffer() };
    },
  });
}

async function telefono(): Promise<Telefono> {
  const p = abrirPrueba('2026-10-11');
  aceptarConsentimiento(p.ctx, { datosFinancieros: true });
  const bbva = agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 5_000_000 });
  const usuario = await s.usuario();
  const deps = {
    cripto: crearCriptoNoble((n) => new Uint8Array(randomBytes(n))),
    almacen: p.almacen,
    cliente: cliente(usuario),
  };
  return { ...p, usuario, deps, bbva };
}

async function pareja() {
  const A = await telefono();
  const B = await telefono();
  const creado = await crearGrupoCompartido(A.ctx, A.deps, 'Beto');
  if (!creado.ok) throw new Error(creado.error);
  const unido = await unirseConQr(B.ctx, B.deps, creado.qr, 'Ana');
  if (!unido.ok) throw new Error(unido.error);
  return { A, B, grupo: creado.grupoId };
}

type Par = Awaited<ReturnType<typeof pareja>>;

function gasto(t: Par, g: Gasto): string {
  const quien = g.pago === 'a' ? t.A : t.B;
  return agregarGastoCompartido(quien.ctx, quien.deps, t.grupo, {
    total: g.total,
    pagueYo: true,
    miParteBp: g.pago === 'a' ? g.proporcion_a_bp : 10000 - g.proporcion_a_bp,
    descripcion: `Súper ${g.id}`,
    categoria: 'super',
    cuentaId: quien.bbva,
  }).eventoId;
}

const saldo = (x: Telefono, grupo: string) => obtenerGrupoCompartido(x.ctx, x.almacen, grupo).saldo;

describe('CA-M16-03 · dos teléfonos contra el servidor real', () => {
  it('con los gastos de E12-20 los dos ven "A le debe a B $1,600.01"; con E12-21 quedan a mano', async () => {
    const t = await pareja();
    const v20 = vector<{ gastos: Gasto[]; esperado: { saldo: number } }>('E12-20');
    for (const g of v20.gastos) {
      const id = gasto(t, g);
      if (g.anulado) anularEventoCompartido(t.B.ctx, t.B.deps, t.grupo, id);
    }
    for (const x of [t.A, t.B, t.A])
      expect(await sincronizarGrupo(x.ctx, x.deps, t.grupo)).toEqual({ ok: true });
    expect(saldo(t.A, t.grupo).texto).toBe('Le debes $1,600.01 a Beto');
    expect(saldo(t.B, t.grupo).texto).toBe('Ana te debe $1,600.01');
    expect(saldo(t.A, t.grupo).saldo).toBe(v20.esperado.saldo);

    // E12-21: A salda en dos pagos.
    const v21 = vector<{ gastos: (Gasto | Pago)[] }>('E12-21');
    for (const p of v21.gastos) {
      if ('tipo' in p)
        registrarPagoCompartido(t.A.ctx, t.A.deps, t.grupo, {
          monto: p.monto,
          quien: 'yo',
          cuentaId: t.A.bbva,
        });
    }
    for (const x of [t.A, t.B]) expect(await sincronizarGrupo(x.ctx, x.deps, t.grupo)).toEqual({ ok: true });
    for (const x of [t.A, t.B]) {
      expect(saldo(x, t.grupo).texto).toBe('Están a mano');
      expect(x.ctx.libro.comprobarIntegridad()).toEqual([]);
    }
  });
});

describe('CA-M16-04 · inspección del servidor', () => {
  it('la tabla solo guarda texto cifrado y una tercera cuenta recibe 403', async () => {
    const t = await pareja();
    gasto(t, { id: 'secreto', total: 123456, pago: 'a', proporcion_a_bp: 5000 });
    expect(await sincronizarGrupo(t.A.ctx, t.A.deps, t.grupo)).toEqual({ ok: true });
    const filas = (
      await s.db.query<Record<string, unknown>>('select grupo_id, id, autor, blob from eventos_compartidos')
    ).rows;
    expect(filas).toHaveLength(1);
    const crudo = JSON.stringify(filas);
    for (const claro of [
      '123456',
      '1,234.56',
      'secreto',
      'Súper',
      'super',
      'gasto_compartido',
      'Beto',
      'Ana',
      '2026-10-11',
    ]) {
      expect(crudo).not.toContain(claro);
    }
    const blob = Buffer.from(String(filas[0]?.blob), 'base64').toString('latin1');
    // Un byte suelto como '{' aparece al azar en texto cifrado; se buscan claves JSON completas.
    expect(blob).not.toContain('"tipo"');
    expect(blob).not.toContain('cuerpo');

    const C = cliente(await s.usuario());
    expect(await C.descargar(t.grupo, null)).toEqual({ ok: false, error: 'no_miembro' });
    expect(
      await C.publicar(t.grupo, [{ id: '5f0c3b1e-7a51-4c1b-9d6e-2f4a8c3b5d71', blob: 'A'.repeat(60) }]),
    ).toEqual({ ok: false, error: 'no_miembro' });
    expect(await C.pedirCodigo(t.grupo)).toEqual({ ok: false, error: 'no_miembro' });
  });
});

describe('CA-M16-05 · salir sin dejar saldos distintos', () => {
  it('A publica y sale antes de que B descargue; lo de B sin conexión se anula con aviso; la llave de A se borra', async () => {
    const t = await pareja();
    // B publica antes del cierre: le llega a A antes de que A borre su llave.
    gasto(t, { id: 'b1', total: 450000, pago: 'b', proporcion_a_bp: 6000 });
    expect(await sincronizarGrupo(t.B.ctx, t.B.deps, t.grupo)).toEqual({ ok: true });
    // B crea otro sin conexión.
    const enLinea = t.B.deps.cliente;
    const sinRed = { ...t.B.deps, cliente: null };
    gasto(t, { id: 'b2', total: 30000, pago: 'b', proporcion_a_bp: 5000 });
    expect(await sincronizarGrupo(t.B.ctx, sinRed, t.grupo)).toEqual({ ok: false, error: 'sin_servicio' });
    // A agrega uno y sale.
    gasto(t, { id: 'a1', total: 120000, pago: 'a', proporcion_a_bp: 5000 });
    expect(await salirDelGrupo(t.A.ctx, t.A.deps, t.grupo)).toEqual({ ok: true });
    expect(obtenerLlaveGrupo(t.A.almacen, t.grupo)).toBeNull();
    expect(t.A.almacen.valores.has(CLAVE_LLAVES_COMPARTIDO)).toBe(false);
    const vistaA = obtenerGrupoCompartido(t.A.ctx, t.A.almacen, t.grupo);
    expect(vistaA.movimientos.map((m) => m.titulo).sort()).toEqual(['Súper a1', 'Súper b1']);
    expect(vistaA.avisoCierre).toBe('Cerraste el grupo compartido');

    // B vuelve: su pendiente recibe 403 grupo_cerrado, descarga lo de A, cierra y se anula lo suyo.
    expect(await sincronizarGrupo(t.B.ctx, { ...t.B.deps, cliente: enLinea }, t.grupo)).toEqual({ ok: true });
    const vistaB = obtenerGrupoCompartido(t.B.ctx, t.B.almacen, t.grupo);
    expect(vistaB.avisoCierre).toBe('Ana cerró el grupo compartido');
    expect(vistaB.movimientos.find((m) => m.titulo === 'Súper b2')).toMatchObject({ noCompartido: true });
    expect(vistaA.saldo.saldo).toBe(-vistaB.saldo.saldo);
    for (const x of [t.A, t.B]) expect(x.ctx.libro.comprobarIntegridad()).toEqual([]);

    // Publicar después: 403 grupo_cerrado para los dos.
    const evento = [{ id: '5f0c3b1e-7a51-4c1b-9d6e-2f4a8c3b5d71', blob: 'A'.repeat(60) }];
    expect(await cliente(t.A.usuario).publicar(t.grupo, evento)).toEqual({
      ok: false,
      error: 'grupo_cerrado',
    });
    expect(await cliente(t.B.usuario).publicar(t.grupo, evento)).toEqual({
      ok: false,
      error: 'grupo_cerrado',
    });

    // Un grupo nuevo entre las mismas personas usa otra llave.
    const nuevo = await crearGrupoCompartido(t.A.ctx, t.A.deps, 'Beto');
    if (!nuevo.ok) throw new Error(nuevo.error);
    expect(nuevo.grupoId).not.toBe(t.grupo);
    const otra = obtenerLlaveGrupo(t.A.almacen, nuevo.grupoId);
    expect(otra).not.toBeNull();
    expect(nuevo.qr.split(':')[4]).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe('CA-M16-06 · volver a vincular', () => {
  it('restaurar desde archivo en otro teléfono (sesión nueva, sin llave) ofrece volver a vincular y el teléfono anterior pierde el acceso', async () => {
    const t = await pareja();
    gasto(t, { id: 'a1', total: 120000, pago: 'a', proporcion_a_bp: 5000 });
    for (const x of [t.A, t.B]) expect(await sincronizarGrupo(x.ctx, x.deps, t.grupo)).toEqual({ ok: true });

    const anterior = t.B.deps.cliente;
    const sesionNueva = await s.usuario();
    const depsNuevo = { ...t.B.deps, cliente: cliente(sesionNueva) };
    // Con la llave (venía en el respaldo cifrado) pero otra sesión: no_miembro.
    expect(await sincronizarGrupo(t.B.ctx, depsNuevo, t.grupo)).toEqual({ ok: false, error: 'no_miembro' });
    expect(obtenerGrupoCompartido(t.B.ctx, t.B.almacen, t.grupo).revincular).toBe(true);
    // Sin la llave (restaurado desde un archivo exportado en claro): sin_llave.
    await t.B.almacen.borrar(CLAVE_LLAVES_COMPARTIDO);
    expect(await sincronizarGrupo(t.B.ctx, depsNuevo, t.grupo)).toEqual({ ok: false, error: 'sin_llave' });

    const codigo = await mostrarCodigo(t.A.ctx, t.A.deps, t.grupo);
    if (!codigo.ok) throw new Error(codigo.error);
    expect(await unirseConQr(t.B.ctx, depsNuevo, codigo.qr)).toEqual({
      ok: true,
      grupoId: t.grupo,
      nuevo: false,
    });
    expect(obtenerGrupoCompartido(t.B.ctx, t.B.almacen, t.grupo).revincular).toBe(false);
    expect(await anterior?.descargar(t.grupo, null)).toEqual({ ok: false, error: 'no_miembro' });

    gasto(
      { ...t, B: { ...t.B, deps: depsNuevo } },
      { id: 'b1', total: 2000, pago: 'b', proporcion_a_bp: 5000 },
    );
    expect(await sincronizarGrupo(t.B.ctx, depsNuevo, t.grupo)).toEqual({ ok: true });
    expect(await sincronizarGrupo(t.A.ctx, t.A.deps, t.grupo)).toEqual({ ok: true });
    expect(saldo(t.A, t.grupo).texto).toBe('Beto te debe $590');
    expect(saldo(t.B, t.grupo).texto).toBe('Le debes $590 a Ana');
  });
});
