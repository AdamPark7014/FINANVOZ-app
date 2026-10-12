import { describe, expect, it } from 'vitest';
import { ErrorDominio } from '@cartera/core';
import { CUENTAS_SISTEMA, esquema } from '@cartera/datos';
import { CLAVE_LLAVES_COMPARTIDO, obtenerLlaveGrupo } from '../compartido/llaves';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import {
  agregarGastoCompartido,
  anularEventoCompartido,
  AVISO_NO_COMPARTIDO,
  crearGrupoCompartido,
  listarGruposCompartidos,
  mostrarCodigo,
  obtenerGrupoCompartido,
  registrarPagoCompartido,
  salirDelGrupo,
  sincronizarGrupo,
  textoSaldo,
  unirseConQr,
  type DependenciasCompartido,
} from './compartido';
import { aplicarCorreccion } from './correcciones';
import { anularMovimiento } from './formulario';
import { deudasConPersonas } from './hoy';
import { agregarCuenta } from './onboarding';
import { registrarTexto } from './registrar';
import { abrirPrueba, vector, type Prueba } from './__pruebas__/base';
import { depsTelefono, servidorCompartidoFalso } from './__pruebas__/compartido';
import { nubeFalsa } from './__pruebas__/nube';

type Gasto = { id: string; total: number; pago: 'a' | 'b'; proporcion_a_bp: number; anulado?: boolean };
type Pago = { id: string; tipo: 'pago'; de: 'a' | 'b'; monto: number };

interface Telefono extends Prueba {
  deps: DependenciasCompartido;
  cliente: ReturnType<ReturnType<typeof servidorCompartidoFalso>['cliente']>;
  bbva: string;
}

function telefono(servidor: ReturnType<typeof servidorCompartidoFalso>, usuario: string): Telefono {
  const p = abrirPrueba('2026-10-11');
  aceptarConsentimiento(p.ctx, { datosFinancieros: true });
  const bbva = agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 5_000_000 });
  const cliente = servidor.cliente(usuario);
  return { ...p, bbva, cliente, deps: depsTelefono(p, cliente) };
}

/** A crea el grupo (llama "Beto" a su pareja) y B escanea el QR (la llama "Ana"). */
async function pareja() {
  const servidor = servidorCompartidoFalso();
  const A = telefono(servidor, 'usuario-a');
  const B = telefono(servidor, 'usuario-b');
  const creado = await crearGrupoCompartido(A.ctx, A.deps, 'Beto');
  if (!creado.ok) throw new Error(creado.error);
  const unido = await unirseConQr(B.ctx, B.deps, creado.qr, 'Ana');
  if (!unido.ok) throw new Error(unido.error);
  return { servidor, A, B, grupo: creado.grupoId };
}

/** Registra un gasto de vector en el teléfono de quien pagó (`a` = A). */
function gastoDeVector(t: { A: Telefono; B: Telefono; grupo: string }, g: Gasto): string {
  const quien = g.pago === 'a' ? t.A : t.B;
  const miParteBp = g.pago === 'a' ? g.proporcion_a_bp : 10000 - g.proporcion_a_bp;
  return agregarGastoCompartido(quien.ctx, quien.deps, t.grupo, {
    total: g.total,
    pagueYo: true,
    miParteBp,
    descripcion: `Gasto ${g.id}`,
    categoria: 'super',
    cuentaId: quien.bbva,
  }).eventoId;
}

async function sincronizarAmbos(t: { A: Telefono; B: Telefono; grupo: string }) {
  for (const x of [t.A, t.B, t.A])
    expect(await sincronizarGrupo(x.ctx, x.deps, t.grupo)).toEqual({ ok: true });
}

const pareja_ = (t: Telefono, grupo: string) =>
  t.ctx.db
    .select()
    .from(esquema.grupoCompartido)
    .all()
    .find((g) => g.id === grupo)?.contraparteId ?? '';

describe('CA-M16-03 · dos teléfonos con los gastos de E12-20', () => {
  it('A crea el grupo, B escanea el QR y los dos ven "A le debe a B $1,600.01"', async () => {
    const t = await pareja();
    const v = vector<{ gastos: Gasto[]; esperado: { saldo: number; monto: number } }>('E12-20');
    for (const g of v.gastos) {
      const id = gastoDeVector(t, g);
      if (g.anulado) {
        const quien = g.pago === 'a' ? t.A : t.B;
        anularEventoCompartido(quien.ctx, quien.deps, t.grupo, id);
      }
    }
    await sincronizarAmbos(t);

    const vistaA = obtenerGrupoCompartido(t.A.ctx, t.A.almacen, t.grupo);
    const vistaB = obtenerGrupoCompartido(t.B.ctx, t.B.almacen, t.grupo);
    expect(vistaA.saldo.texto).toBe('Le debes $1,600.01 a Beto');
    expect(vistaB.saldo.texto).toBe('Ana te debe $1,600.01');
    expect(vistaA.saldo.saldo).toBe(v.esperado.saldo);
    expect(vistaB.saldo.saldo).toBe(-v.esperado.saldo);
    expect(vistaA.movimientos).toHaveLength(4);
    expect(vistaA.movimientos.filter((m) => m.anulado)).toHaveLength(1);
    expect(vistaA.pendientes + vistaB.pendientes).toBe(0);

    // Libro de cada quien: la contraparte pareja lleva el mismo saldo que E12.2, y la deuda entra en E4.
    expect(t.A.ctx.libro.saldo(pareja_(t.A, t.grupo))).toBe(v.esperado.saldo);
    expect(t.B.ctx.libro.saldo(pareja_(t.B, t.grupo))).toBe(-v.esperado.saldo);
    expect(deudasConPersonas(t.A.ctx)).toEqual([
      { id: pareja_(t.A, t.grupo), nombre: 'Beto', monto: v.esperado.monto, apartar: true },
    ]);
    expect(deudasConPersonas(t.B.ctx)).toEqual([]);
    for (const x of [t.A, t.B]) expect(x.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('E12-21 · A salda en dos pagos y los dos quedan a mano, también en su libro', async () => {
    const t = await pareja();
    const v = vector<{ gastos: (Gasto | Pago)[] }>('E12-21');
    for (const g of v.gastos) {
      if ('tipo' in g) {
        registrarPagoCompartido(t.A.ctx, t.A.deps, t.grupo, {
          monto: g.monto,
          quien: 'yo',
          cuentaId: t.A.bbva,
        });
        continue;
      }
      const id = gastoDeVector(t, g);
      if (g.anulado) anularEventoCompartido(t.B.ctx, t.B.deps, t.grupo, id);
    }
    await sincronizarAmbos(t);
    for (const x of [t.A, t.B]) {
      expect(obtenerGrupoCompartido(x.ctx, x.almacen, t.grupo).saldo.texto).toBe('Están a mano');
      expect(x.ctx.libro.saldo(pareja_(x, t.grupo))).toBe(0);
    }
    // B recibió los pagos sin saber a qué cuenta: quedan "por asignar" (no inflan su dinero libre).
    expect(t.B.ctx.libro.saldo(CUENTAS_SISTEMA.porAsignarEntradas)).toBe(160001);
  });

  it('agregar funciona sin conexión: queda pendiente y se comparte al volver la red', async () => {
    const t = await pareja();
    t.A.cliente.red.caida = true;
    gastoDeVector(t, { id: 'x', total: 120000, pago: 'a', proporcion_a_bp: 5000 });
    expect(await sincronizarGrupo(t.A.ctx, t.A.deps, t.grupo)).toEqual({ ok: false, error: 'sin_red' });
    expect(obtenerGrupoCompartido(t.A.ctx, t.A.almacen, t.grupo)).toMatchObject({
      pendientes: 1,
      saldo: { texto: 'Beto te debe $600' },
    });
    t.A.cliente.red.caida = false;
    await sincronizarAmbos(t);
    expect(obtenerGrupoCompartido(t.B.ctx, t.B.almacen, t.grupo).saldo.texto).toBe('Le debes $600 a Ana');
  });

  it('el servidor solo recibe texto cifrado: ni montos ni descripciones', async () => {
    const t = await pareja();
    gastoDeVector(t, { id: 'secreto', total: 123456, pago: 'a', proporcion_a_bp: 5000 });
    await sincronizarAmbos(t);
    const crudo = JSON.stringify([...t.servidor.grupos.values()]);
    for (const claro of ['123456', 'secreto', 'super', 'gasto_compartido', 'Beto', 'Ana']) {
      expect(crudo).not.toContain(claro);
    }
  });
});

describe('Validaciones de agregar, saldar y anular', () => {
  it('solo se anula lo propio, una vez; y no con el grupo cerrado', async () => {
    const t = await pareja();
    const id = gastoDeVector(t, { id: 'x', total: 1000, pago: 'a', proporcion_a_bp: 5000 });
    await sincronizarAmbos(t);
    expect(() => anularEventoCompartido(t.B.ctx, t.B.deps, t.grupo, id)).toThrow(/solo puedes anular/);
    anularEventoCompartido(t.A.ctx, t.A.deps, t.grupo, id);
    expect(() => anularEventoCompartido(t.A.ctx, t.A.deps, t.grupo, id)).toThrow(ErrorDominio);
  });

  it('lo compartido no se anula ni se corrige desde Movimientos (el cambio no llegaría a tu pareja)', async () => {
    const t = await pareja();
    const id = gastoDeVector(t, { id: 'x', total: 1000, pago: 'a', proporcion_a_bp: 5000 });
    const fila = t.A.ctx.db
      .select()
      .from(esquema.eventoCompartido)
      .all()
      .find((e) => e.id === id);
    const tx = fila?.transaccionId ?? '';
    expect(() => anularMovimiento(t.A.ctx, tx)).toThrow(
      expect.objectContaining({ codigo: 'movimiento_compartido' }),
    );
    expect(() => aplicarCorreccion(t.A.ctx, tx, { descripcion: 'otra' })).toThrow(
      expect.objectContaining({ codigo: 'movimiento_compartido' }),
    );
  });

  it('una categoría desconocida o un total en cero se rechazan', async () => {
    const t = await pareja();
    const base = { total: 1000, pagueYo: true, miParteBp: 5000, descripcion: '', categoria: 'super' };
    expect(() =>
      agregarGastoCompartido(t.A.ctx, t.A.deps, t.grupo, { ...base, categoria: 'no_existe' }),
    ).toThrow(/categoría/);
    expect(() => agregarGastoCompartido(t.A.ctx, t.A.deps, t.grupo, { ...base, total: 0 })).toThrow(
      ErrorDominio,
    );
  });

  it('un QR ajeno, el propio o sin servicio no unen a nadie', async () => {
    const t = await pareja();
    expect(await unirseConQr(t.B.ctx, t.B.deps, 'https://ejemplo.com', 'Ana')).toEqual({
      ok: false,
      error: 'qr_invalido',
    });
    const codigo = await mostrarCodigo(t.A.ctx, t.A.deps, t.grupo);
    if (!codigo.ok) throw new Error(codigo.error);
    const servidor = servidorCompartidoFalso();
    const C = telefono(servidor, 'usuario-c');
    expect(await crearGrupoCompartido(C.ctx, { ...C.deps, cliente: null }, 'Dani')).toEqual({
      ok: false,
      error: 'sin_servicio',
    });
    // A escanea su propio código: el servidor responde que ya ocupa el otro lugar.
    const propio = await crearGrupoCompartido(C.ctx, C.deps, 'Dani');
    if (!propio.ok) throw new Error(propio.error);
    expect(await unirseConQr(C.ctx, C.deps, propio.qr, 'Yo')).toEqual({ ok: false, error: 'ya_miembro' });
  });

  it('textoSaldo', () => {
    expect(textoSaldo('Ana', 160001).texto).toBe('Ana te debe $1,600.01');
    expect(textoSaldo('Ana', -5).texto).toBe('Le debes $0.05 a Ana');
    expect(textoSaldo('Ana', 0)).toEqual({ saldo: 0, monto: 0, debe: null, texto: 'Están a mano' });
  });
});

describe('CA-M16-05 · salir cierra el grupo sin dejar saldos distintos', () => {
  it('A publica y sale antes de que B descargue; lo de B sin conexión se anula con aviso', async () => {
    const t = await pareja();
    // B publica antes del cierre: le llega a A antes de que A borre la llave.
    gastoDeVector(t, { id: 'b1', total: 450000, pago: 'b', proporcion_a_bp: 6000 });
    expect(await sincronizarGrupo(t.B.ctx, t.B.deps, t.grupo)).toEqual({ ok: true });
    // B crea otro sin conexión (nunca se publica).
    t.B.cliente.red.caida = true;
    gastoDeVector(t, { id: 'b2', total: 30000, pago: 'b', proporcion_a_bp: 5000 });
    // A agrega uno (pendiente) y sale: lo publica, cierra, descarga y borra la llave.
    gastoDeVector(t, { id: 'a1', total: 120000, pago: 'a', proporcion_a_bp: 5000 });
    expect(await salirDelGrupo(t.A.ctx, t.A.deps, t.grupo)).toEqual({ ok: true });
    expect(obtenerLlaveGrupo(t.A.almacen, t.grupo)).toBeNull();
    expect(t.A.almacen.valores.has(CLAVE_LLAVES_COMPARTIDO)).toBe(false);
    const vistaA = obtenerGrupoCompartido(t.A.ctx, t.A.almacen, t.grupo);
    expect(vistaA).toMatchObject({ abierto: false, avisoCierre: 'Cerraste el grupo compartido' });
    expect(vistaA.movimientos.map((m) => m.titulo).sort()).toEqual(['Gasto a1', 'Gasto b1']);

    // B vuelve a tener red: su pendiente recibe 403 grupo_cerrado, descarga lo de A y cierra.
    t.B.cliente.red.caida = false;
    expect(await sincronizarGrupo(t.B.ctx, t.B.deps, t.grupo)).toEqual({ ok: true });
    const vistaB = obtenerGrupoCompartido(t.B.ctx, t.B.almacen, t.grupo);
    expect(vistaB).toMatchObject({ abierto: false, avisoCierre: 'Ana cerró el grupo compartido' });
    const b2 = vistaB.movimientos.find((m) => m.titulo === 'Gasto b2');
    expect(b2).toMatchObject({ noCompartido: true, anulado: true, anulable: false });
    expect(AVISO_NO_COMPARTIDO).toBe('No se compartió: el grupo ya estaba cerrado');
    expect(obtenerLlaveGrupo(t.B.almacen, t.grupo)).toBeNull();

    // Mismo saldo en los dos, y el libro de cada quien coincide con él.
    expect(vistaA.saldo.saldo).toBe(-vistaB.saldo.saldo);
    expect(vistaA.saldo.texto).toBe('Le debes $2,100 a Beto');
    expect(t.A.ctx.libro.saldo(pareja_(t.A, t.grupo))).toBe(vistaA.saldo.saldo);
    expect(t.B.ctx.libro.saldo(pareja_(t.B, t.grupo))).toBe(vistaB.saldo.saldo);
    for (const x of [t.A, t.B]) expect(x.ctx.libro.comprobarIntegridad()).toEqual([]);

    // Publicar después responde grupo_cerrado a los dos; agregar aquí ya no se permite.
    for (const c of [t.A.cliente, t.B.cliente]) {
      expect(await c.publicar(t.grupo, [{ id: 'x', blob: 'y' }])).toEqual({
        ok: false,
        error: 'grupo_cerrado',
      });
    }
    expect(() => gastoDeVector(t, { id: 'z', total: 100, pago: 'a', proporcion_a_bp: 5000 })).toThrow(
      /cerrado/,
    );
  });

  it('una anulación sin compartir se revierte: el movimiento compartido vuelve al libro', async () => {
    const t = await pareja();
    const id = gastoDeVector(t, { id: 'b1', total: 100000, pago: 'b', proporcion_a_bp: 5000 });
    await sincronizarAmbos(t);
    t.B.cliente.red.caida = true;
    anularEventoCompartido(t.B.ctx, t.B.deps, t.grupo, id);
    expect(t.B.ctx.libro.saldo(pareja_(t.B, t.grupo))).toBe(0);
    expect(await salirDelGrupo(t.A.ctx, t.A.deps, t.grupo)).toEqual({ ok: true });
    t.B.cliente.red.caida = false;
    expect(await sincronizarGrupo(t.B.ctx, t.B.deps, t.grupo)).toEqual({ ok: true });
    expect(t.B.ctx.libro.saldo(pareja_(t.B, t.grupo))).toBe(50000);
    expect(t.A.ctx.libro.saldo(pareja_(t.A, t.grupo))).toBe(-50000);
    expect(obtenerGrupoCompartido(t.B.ctx, t.B.almacen, t.grupo).saldo.texto).toBe('Ana te debe $500');
  });

  it('un grupo nuevo entre las mismas personas usa otra llave', async () => {
    const t = await pareja();
    const primera = obtenerLlaveGrupo(t.A.almacen, t.grupo);
    await salirDelGrupo(t.A.ctx, t.A.deps, t.grupo);
    const otro = await crearGrupoCompartido(t.A.ctx, t.A.deps, 'Beto');
    if (!otro.ok) throw new Error(otro.error);
    const segunda = obtenerLlaveGrupo(t.A.almacen, otro.grupoId);
    expect(segunda).not.toBeNull();
    expect(Buffer.from(segunda ?? []).equals(Buffer.from(primera ?? []))).toBe(false);
    expect(listarGruposCompartidos(t.A.ctx, t.A.almacen).map((g) => g.abierto)).toEqual([true, false]);
  });
});

describe('CA-M16-06 · volver a vincular', () => {
  it('sin la llave o con una sesión nueva se ofrece volver a vincular; el QR nuevo de la otra persona funciona', async () => {
    const t = await pareja();
    gastoDeVector(t, { id: 'a1', total: 120000, pago: 'a', proporcion_a_bp: 5000 });
    await sincronizarAmbos(t);

    // B "restaura desde archivo" en otro teléfono: misma base, sesión anónima nueva y sin la llave.
    const viejo = t.B.cliente;
    const nuevo = t.servidor.cliente('usuario-b2');
    await t.B.almacen.borrar(CLAVE_LLAVES_COMPARTIDO);
    const depsB = { ...t.B.deps, cliente: nuevo };
    expect(await sincronizarGrupo(t.B.ctx, depsB, t.grupo)).toEqual({ ok: false, error: 'sin_llave' });
    expect(obtenerGrupoCompartido(t.B.ctx, t.B.almacen, t.grupo).revincular).toBe(true);

    const codigo = await mostrarCodigo(t.A.ctx, t.A.deps, t.grupo);
    if (!codigo.ok) throw new Error(codigo.error);
    expect(await unirseConQr(t.B.ctx, depsB, codigo.qr)).toEqual({
      ok: true,
      grupoId: t.grupo,
      nuevo: false,
    });
    expect(obtenerGrupoCompartido(t.B.ctx, t.B.almacen, t.grupo).revincular).toBe(false);
    // El teléfono anterior deja de tener acceso.
    expect(await viejo.descargar(t.grupo, null)).toEqual({ ok: false, error: 'no_miembro' });
    // El código ya se usó.
    expect(await unirseConQr(t.B.ctx, depsB, codigo.qr)).toEqual({ ok: false, error: 'codigo_invalido' });

    t.B.deps = depsB;
    gastoDeVector(t, { id: 'b1', total: 2000, pago: 'b', proporcion_a_bp: 5000 });
    await sincronizarAmbos(t);
    expect(obtenerGrupoCompartido(t.A.ctx, t.A.almacen, t.grupo).saldo.texto).toBe('Beto te debe $590');
    expect(obtenerGrupoCompartido(t.B.ctx, t.B.almacen, t.grupo).saldo.texto).toBe('Le debes $590 a Ana');
  });

  it('con la llave pero una sesión que el servidor ya no reconoce: no_miembro → volver a vincular', async () => {
    const t = await pareja();
    const depsB = { ...t.B.deps, cliente: t.servidor.cliente('usuario-b2') };
    expect(await sincronizarGrupo(t.B.ctx, depsB, t.grupo)).toEqual({ ok: false, error: 'no_miembro' });
    expect(obtenerGrupoCompartido(t.B.ctx, t.B.almacen, t.grupo).revincular).toBe(true);
  });

  it('eventos propios recuperados del servidor (sin la cuenta local) van a "por asignar"', async () => {
    const t = await pareja();
    gastoDeVector(t, { id: 'b1', total: 1000, pago: 'b', proporcion_a_bp: 5000 });
    await sincronizarAmbos(t);
    // B en un teléfono vacío (sin respaldo) que se vuelve a vincular con la misma sesión.
    const B2 = telefono(t.servidor, 'usuario-b2');
    const codigo = await mostrarCodigo(t.A.ctx, t.A.deps, t.grupo);
    if (!codigo.ok) throw new Error(codigo.error);
    expect(await unirseConQr(B2.ctx, B2.deps, codigo.qr, 'Ana')).toMatchObject({ ok: true, nuevo: true });
    expect(obtenerGrupoCompartido(B2.ctx, B2.almacen, t.grupo).saldo.texto).toBe('Ana te debe $5');
    expect(B2.ctx.libro.saldo(CUENTAS_SISTEMA.porAsignar)).toBe(-1000);
  });
});

describe('Gasto compartido dictado (02 §27, pendiente 147)', () => {
  async function dictar(x: Telefono, frase: string) {
    const r = await registrarTexto(x.ctx, frase, 'voz');
    if (r.resultado !== 'confirmar_compartido')
      throw new Error(`se esperaba confirmar, llegó ${r.resultado}`);
    return r.propuesta;
  }

  it('sin grupo abierto pide vincularse primero y no escribe nada', async () => {
    const servidor = servidorCompartidoFalso();
    const A = telefono(servidor, 'usuario-a');
    const saldo = A.ctx.libro.saldo(A.bbva);
    expect(await registrarTexto(A.ctx, 'Súper 1,200, pagué yo, 60/40', 'voz')).toEqual({
      resultado: 'sin_pareja',
    });
    expect(A.ctx.libro.saldo(A.bbva)).toBe(saldo);
  });

  it('con un grupo: confirma con todo lo dicho y nada se comparte antes de "Guardar"', async () => {
    const t = await pareja();
    const saldo = t.A.ctx.libro.saldo(t.A.bbva);
    const propuesta = await dictar(t.A, 'Súper 1,200, pagué yo, 60/40');
    expect(propuesta).toEqual({
      total: 120000,
      descripcion: 'Súper',
      categoria: 'super',
      fecha: '2026-10-11',
      pagueYo: true,
      miParteBp: 6000,
      grupoId: t.grupo,
      grupos: [{ id: t.grupo, nombre: 'Beto' }],
    });
    expect(t.A.ctx.libro.saldo(t.A.bbva)).toBe(saldo);
    expect(obtenerGrupoCompartido(t.A.ctx, t.A.almacen, t.grupo).movimientos).toHaveLength(0);

    // "Guardar" usa la misma función que el formulario.
    agregarGastoCompartido(t.A.ctx, t.A.deps, t.grupo, {
      total: propuesta.total,
      pagueYo: propuesta.pagueYo ?? true,
      miParteBp: propuesta.miParteBp,
      descripcion: propuesta.descripcion ?? '',
      categoria: propuesta.categoria,
      cuentaId: t.A.bbva,
      fecha: propuesta.fecha,
    });
    await sincronizarAmbos(t);
    expect(obtenerGrupoCompartido(t.A.ctx, t.A.almacen, t.grupo).saldo.texto).toBe('Beto te debe $480');
    expect(obtenerGrupoCompartido(t.B.ctx, t.B.almacen, t.grupo).saldo.texto).toBe('Le debes $480 a Ana');
    for (const x of [t.A, t.B]) expect(x.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('pagó la pareja, mitad y mitad por omisión; sin quién pagó queda por preguntar', async () => {
    const t = await pareja();
    expect(await dictar(t.A, 'gasto compartido de 500 en gasolina, pagó ella')).toMatchObject({
      total: 50000,
      categoria: 'gasolina',
      pagueYo: false,
      miParteBp: 5000,
      grupoId: t.grupo,
    });
    expect(await dictar(t.A, 'la renta 8 mil mitad y mitad con mi pareja')).toMatchObject({
      total: 800000,
      categoria: 'vivienda',
      pagueYo: null,
      miParteBp: 5000,
    });
  });

  it('con varios grupos: el nombre dicho elige el grupo; si no lo dijo, se pregunta', async () => {
    const t = await pareja();
    const otro = await crearGrupoCompartido(t.A.ctx, t.A.deps, 'Caro');
    if (!otro.ok) throw new Error(otro.error);
    const conBeto = await dictar(t.A, 'pagó Beto 300 del cine, 50/50');
    expect(conBeto).toMatchObject({ total: 30000, pagueYo: false, grupoId: t.grupo });
    expect(conBeto.grupos.map((g) => g.nombre)).toEqual(['Beto', 'Caro']);
    expect(await dictar(t.A, 'tacos 400, pagué yo, mitad y mitad')).toMatchObject({
      grupoId: null,
      miParteBp: 5000,
    });
    // Un nombre que no es de ningún grupo tampoco elige uno al azar.
    expect((await dictar(t.A, 'pagó Dani 300 del cine, 50/50')).grupoId).toBeNull();
  });

  it('lo que interpreta la nube llega a la misma confirmación', async () => {
    const t = await pareja();
    const frase = 'ayer pagué 1,500 del súper con mi pareja, 70/30';
    const f = nubeFalsa({
      [frase]: {
        intencion: 'gasto_compartido',
        gasto: {
          monto: 150000,
          fecha: '2026-10-10',
          descripcion: 'súper',
          categoria: 'super',
          pagador: 'yo',
          mi_parte: 70,
        },
      },
    });
    const r = await registrarTexto(t.A.ctx, frase, 'voz', { nube: f.nube });
    expect(r).toMatchObject({
      resultado: 'confirmar_compartido',
      propuesta: { total: 150000, fecha: '2026-10-10', pagueYo: true, miParteBp: 7000, grupoId: t.grupo },
    });
  });
});
