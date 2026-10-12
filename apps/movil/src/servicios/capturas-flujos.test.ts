import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { CUENTAS_SISTEMA, esquema } from '@cartera/datos';
import { combinarPlantillas, PAQUETE_ADB, paqueteEfectivo, catalogoEmbebido } from '../captura/catalogo';
import { ingerirNotificaciones, type OpcionesIngesta } from '../captura/ingesta';
import sinteticas from '../../../../fixtures/notificaciones/plantillas.ejemplo.json';
import { agregarPagoPlaneado } from './config-tarjetas';
import {
  activarCaptura,
  capturaInactiva,
  obtenerEstadoCaptura,
  registrarSenalesCaptura,
} from './estado-captura';
import { registrarMovimiento } from './formulario';
import { obtenerHoy } from './hoy';
import { listarOcurrencias } from './ocurrencias';
import { agregarTarjetaCredito } from './onboarding';
import {
  agregarCuentaDesdeCaptura,
  asociarCuentaCaptura,
  confirmarCaptura,
  fueAMeses,
  listarCapturasPorRevisar,
  preguntasCaptura,
  responderDuplicado,
  responderPagoSinOrigen,
  responderSalidaSinPareja,
  type RespuestaSalida,
} from './preguntas-captura';
import { registrarTextoLocal } from './registrar';
import { cargarEscenario } from './semilla';
import { abrirPrueba, escenario, vector } from './__pruebas__/base';
import { cruda, ejemplos, HORA, INICIO_E_CAPTURA, MINUTO, opcionesPrueba } from './__pruebas__/captura';

const { transaccion, transaccionVigente, cuenta } = esquema;

function conEscenario(id: string, cambiar?: (e: Record<string, unknown>) => void) {
  const p = abrirPrueba();
  const datos = escenario(id) as Record<string, unknown>;
  cambiar?.(datos);
  const e = cargarEscenario(p.ctx, datos);
  p.reloj.fijar(e.hoy);
  return { ...p, e };
}

const ejemplo = (id: string) => {
  const x = ejemplos().find((e) => e.id === id);
  if (!x) throw new Error(`falta ${id}`);
  return x;
};

/** Catálogo de prueba con una "Nu" (los formatos de `fixtures/` son sintéticos). */
const catalogoNu = combinarPlantillas([
  {
    bancos: [{ id: 'nu', nombre: 'Nu', paquetes_android: ['mx.ejemplo.nu'] }],
    plantillas: [
      {
        id: 'nu.cargo.v1',
        banco: 'nu',
        tipo: 'cargo',
        campo: 'texto',
        patron:
          '^Compraste \\$(?<monto>[\\d,]+(?:\\.\\d{1,2})?) en (?<comercio>.+?) con tu tarjeta (?<ultimos4>\\d{4})$',
      },
    ],
  },
]);
const opcionesNu: OpcionesIngesta = { ...opcionesPrueba, catalogo: catalogoNu };
const cargoNu = (monto: string, cuando: number) =>
  cruda(
    {
      id: 'NU',
      paquete: 'mx.ejemplo.nu',
      titulo: 'Compra',
      texto: `Compraste $${monto} en OXXO REFORMA con tu tarjeta 4410`,
    },
    cuando,
  );

describe('duplicados con lo dictado (CA-M5-03, E9-38)', () => {
  it('"Coca 25" sin método + cargo de $25 en la Nu el mismo día → una transacción en la Nu con lo dictado', async () => {
    const v = vector<{ esperado: { decision: string } }>('E9-38');
    expect(v.esperado.decision).toBe('fusionar');
    const p = conEscenario('e4-01');
    const dictado = registrarTextoLocal(p.ctx, 'coca 25', 'voz');
    expect(dictado?.resultado).toBe('registrado');
    expect(p.ctx.libro.saldo(CUENTAS_SISTEMA.porAsignar)).toBe(-2_500);
    const nu = p.e.cuentas['nu'] as string;
    const deudaAntes = p.ctx.libro.saldo(nu);

    const [r] = await ingerirNotificaciones(p.ctx, [cargoNu('25.00', INICIO_E_CAPTURA)], opcionesNu);
    expect(r?.estado).toBe('vinculada');
    expect(p.ctx.libro.saldo(CUENTAS_SISTEMA.porAsignar)).toBe(0);
    expect(p.ctx.libro.saldo(nu)).toBe(deudaAntes - 2_500);
    const gastos = p.ctx.db
      .select()
      .from(transaccionVigente)
      .where(eq(transaccionVigente.tipo, 'gasto'))
      .all();
    expect(gastos).toHaveLength(1);
    expect(gastos[0]?.id).toBe(r?.transaccionId);
    expect(gastos[0]?.descripcion?.toLowerCase()).toContain('coca');
    expect(gastos[0]?.origen).toBe('voz');
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('con Δ = 2 días pregunta; "Sí, es el mismo" fusiona y "No" registra aparte', async () => {
    for (const respuesta of ['mismo', 'otro'] as const) {
      const p = conEscenario('e4-01');
      registrarMovimiento(
        p.ctx,
        {
          tipo: 'gasto',
          categoria: 'antojos',
          origenId: CUENTAS_SISTEMA.porAsignar,
          monto: 2_500,
          fecha: '2026-10-09',
          descripcion: 'Coca',
        },
        { origen: 'voz' },
      );
      const [r] = await ingerirNotificaciones(p.ctx, [cargoNu('25.00', INICIO_E_CAPTURA)], opcionesNu);
      expect(r).toMatchObject({ estado: 'interpretada', espera: 'duplicado' });
      const [q] = preguntasCaptura(p.ctx, catalogoNu);
      expect(q).toMatchObject({
        tipo: 'duplicado',
        monto: 2_500,
        dictado: { descripcion: 'Coca', monto: 2_500 },
      });
      responderDuplicado(p.ctx, r?.capturaId as string, respuesta);
      expect(p.ctx.libro.saldo(CUENTAS_SISTEMA.porAsignar)).toBe(respuesta === 'mismo' ? 0 : -2_500);
      expect(preguntasCaptura(p.ctx, catalogoNu)).toEqual([]);
      expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
    }
  });
});

describe('pareja de transferencia y tránsito (CA-M5-04, CA-M5-11)', () => {
  const planEnLa8812 = (e: Record<string, unknown>) => {
    const cuentas = e['cuentas'] as { clave: string; tarjeta?: { modo: string } }[];
    const b = cuentas.find((c) => c.clave === 'banco_b');
    if (b?.tarjeta) b.tarjeta.modo = 'plan';
  };

  for (const orden of [
    ['N-04', 'N-08'],
    ['N-08', 'N-04'],
  ]) {
    it(`${orden.join(' → ')}: un solo pago_tarjeta que cubre el pago planeado de $4,200 del 12 oct`, async () => {
      const p = conEscenario('e-captura', planEnLa8812);
      const tarjeta = p.e.cuentas['banco_b'] as string;
      const programado = agregarPagoPlaneado(p.ctx, {
        tarjetaId: tarjeta,
        monto: 420_000,
        regla: { tipo: 'unica', fecha: '2026-10-12' },
      });
      const reservaAntes = obtenerHoy(p.ctx).reservadoDetalle.filter((r) => r.tipo === 'tarjeta');
      expect(reservaAntes).toEqual([
        { tipo: 'tarjeta', concepto: 'Banco B ••8812', monto: 420_000, fecha: '2026-10-12' },
      ]);

      const cola = orden.map((id, i) => cruda(ejemplo(id), INICIO_E_CAPTURA + i * MINUTO));
      const r = await ingerirNotificaciones(p.ctx, cola, opcionesPrueba);
      expect(r.map((x) => x.estado)).toEqual(['vinculada', 'vinculada']);
      expect(r[1]?.transaccionId).toBeTruthy();
      const final = p.ctx.db
        .select()
        .from(transaccion)
        .where(eq(transaccion.id, r[1]?.transaccionId as string))
        .get();
      expect(final?.tipo).toBe('pago_tarjeta');
      expect(p.ctx.libro.saldo(CUENTAS_SISTEMA.transito)).toBe(0);
      expect(listarOcurrencias(p.ctx, { programadoId: programado })[0]).toMatchObject({
        fecha: '2026-10-12',
        estado: 'cubierta',
        transaccionId: final?.id,
      });
      expect(obtenerHoy(p.ctx).reservadoDetalle.filter((x) => x.tipo === 'tarjeta')).toEqual([]);
      expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
    });
  }

  it('una transferencia entre cuentas propias del mismo monto que la quincena no la cubre (en cualquier orden)', async () => {
    const catalogo = combinarPlantillas([
      sinteticas,
      {
        bancos: [],
        plantillas: [
          {
            id: 'billetera_c.envio.v1',
            banco: 'billetera_c',
            tipo: 'transferencia_enviada',
            campo: 'texto',
            patron: '^Enviaste \\$(?<monto>[\\d,]+(?:\\.\\d{1,2})?) a tu banco$',
          },
        ],
      },
    ]);
    const opciones = { ...opcionesPrueba, catalogo };
    const entrada = cruda(
      {
        id: 'E',
        paquete: 'mx.ejemplo.bancoa',
        titulo: 'Transferencia recibida',
        texto: 'Recibiste una transferencia de $6,500.00 de MI BILLETERA.',
      },
      Date.UTC(2026, 9, 12, 16, 0),
    );
    const salida = cruda(
      { id: 'S', paquete: 'mx.ejemplo.billeterac', titulo: 'Envío', texto: 'Enviaste $6,500.00 a tu banco' },
      Date.UTC(2026, 9, 12, 16, 1),
    );
    for (const cola of [
      [entrada, salida],
      [salida, entrada],
    ]) {
      const p = conEscenario('e-captura', (e) => {
        (e['cuentas'] as { clave: string; saldo: number }[]).forEach((c) => {
          if (c.clave === 'billetera_c') c.saldo = 700_000;
        });
      });
      p.reloj.fijar('2026-10-12');
      const quincena = p.e.ingresoId as string;
      const [primera] = await ingerirNotificaciones(p.ctx, [cola[0] as never], opciones);
      if (cola[0] === entrada) {
        // Sola, la entrada parece la quincena (`07 §5` (b)) y la cubre.
        expect(
          listarOcurrencias(p.ctx, { programadoId: quincena, estado: 'cubierta' }).map((o) => o.fecha),
        ).toContain('2026-10-15');
      }
      expect(primera?.estado).toBe('vinculada');
      const [segunda] = await ingerirNotificaciones(p.ctx, [cola[1] as never], opciones);
      const final = p.ctx.db
        .select()
        .from(transaccion)
        .where(eq(transaccion.id, segunda?.transaccionId as string))
        .get();
      expect(final?.tipo).toBe('transferencia');
      expect(
        listarOcurrencias(p.ctx, { programadoId: quincena }).find((o) => o.fecha === '2026-10-15')?.estado,
      ).toBe('pendiente');
      expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
    }
  });
});

describe('salida sin pareja después de 24 h (CA-M5-09, caso 18)', () => {
  const casos: {
    respuesta: (e: { contactos: Record<string, string> }) => RespuestaSalida;
    tipo: string;
    cuenta: (e: { contactos: Record<string, string> }) => string;
  }[] = [
    {
      respuesta: () => ({ destino: 'externa' }),
      tipo: 'transferencia',
      cuenta: () => CUENTAS_SISTEMA.cuentasExternas,
    },
    {
      respuesta: (e) => ({ destino: 'prestamo', personaId: e.contactos['caro'] as string }),
      tipo: 'prestamo_otorgado',
      cuenta: (e) => e.contactos['caro'] as string,
    },
    {
      respuesta: () => ({ destino: 'gasto', categoria: 'apoyo_familiar' }),
      tipo: 'gasto',
      cuenta: () => 'cat:personal:apoyo_familiar',
    },
  ];
  for (const caso of casos) {
    it(`"${caso.tipo}": reemplaza el pendiente por los asientos del caso 18 y el tránsito vuelve a 0`, async () => {
      const p = conEscenario('e-captura');
      const n04 = cruda(ejemplo('N-04'), INICIO_E_CAPTURA);
      const [r] = await ingerirNotificaciones(p.ctx, [n04], opcionesPrueba);
      expect(p.ctx.libro.saldo(CUENTAS_SISTEMA.transito)).toBe(420_000);
      p.reloj.fijarInstante(INICIO_E_CAPTURA + 23 * HORA);
      expect(preguntasCaptura(p.ctx, opcionesPrueba.catalogo)).toEqual([]);
      p.reloj.fijarInstante(INICIO_E_CAPTURA + 24 * HORA + MINUTO);
      expect(preguntasCaptura(p.ctx, opcionesPrueba.catalogo)).toMatchObject([
        { tipo: 'salida_sin_pareja', capturaId: r?.capturaId, monto: 420_000, cuenta: 'Banco A ••5521' },
      ]);
      const banco = p.e.cuentas['banco_a'] as string;
      const antes = p.ctx.libro.saldo(banco);
      const nueva = responderSalidaSinPareja(p.ctx, r?.capturaId as string, caso.respuesta(p.e));
      const t = p.ctx.libro.obtener(nueva);
      expect(t?.tipo).toBe(caso.tipo);
      expect(t?.reemplazaA).toBe(r?.transaccionId);
      expect(t?.asientos.map((a) => [a.cuentaId, a.monto])).toEqual(
        expect.arrayContaining([
          [caso.cuenta(p.e), 420_000],
          [banco, -420_000],
        ]),
      );
      expect(p.ctx.libro.saldo(CUENTAS_SISTEMA.transito)).toBe(0);
      expect(p.ctx.libro.saldo(banco)).toBe(antes);
      expect(preguntasCaptura(p.ctx, opcionesPrueba.catalogo)).toEqual([]);
      expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
    });
  }

  it('pago a tarjeta sin salida: "De una de mis cuentas" lo vuelve pago_tarjeta (caso 19)', async () => {
    const p = conEscenario('e-captura');
    const [r] = await ingerirNotificaciones(
      p.ctx,
      [cruda(ejemplo('N-08'), INICIO_E_CAPTURA)],
      opcionesPrueba,
    );
    p.reloj.fijarInstante(INICIO_E_CAPTURA + 25 * HORA);
    expect(preguntasCaptura(p.ctx, opcionesPrueba.catalogo)).toMatchObject([
      { tipo: 'pago_sin_origen', monto: 420_000 },
    ]);
    const id = responderPagoSinOrigen(p.ctx, r?.capturaId as string, {
      origen: 'cuenta',
      cuentaId: p.e.cuentas['banco_a'] as string,
    });
    expect(p.ctx.libro.obtener(id)?.tipo).toBe('pago_tarjeta');
    expect(p.ctx.libro.saldo(CUENTAS_SISTEMA.transito)).toBe(0);
  });
});

describe('cuenta, categorías y "¿Fue a meses?"', () => {
  it('tarjeta nueva detectada: queda en espera, al agregarla se registra y aprende su banco', async () => {
    const p = conEscenario('e-captura');
    const n = cruda(
      {
        id: 'X',
        paquete: 'mx.ejemplo.bancob',
        titulo: 'Cargo',
        texto: 'Se realizó un cargo de $350.00 en CINEPOLIS con tu tarjeta con terminación 4321',
      },
      INICIO_E_CAPTURA,
    );
    const [r] = await ingerirNotificaciones(p.ctx, [n], opcionesPrueba);
    expect(r).toMatchObject({ estado: 'interpretada', espera: 'cuenta', transaccionId: null });
    expect(preguntasCaptura(p.ctx, opcionesPrueba.catalogo)).toMatchObject([
      {
        tipo: 'cuenta_nueva',
        banco: 'Banco B (crédito)',
        ultimos4: '4321',
        monto: 35_000,
        sugerencia: 'tarjeta_credito',
      },
    ]);
    const nueva = agregarTarjetaCredito(p.ctx, {
      nombre: 'Banco B ••4321',
      ultimos4: '4321',
      diaCorte: 5,
      diasParaPagar: 20,
      limiteCredito: 1_000_000,
      modo: 'totalero',
      saldo: 0,
    });
    asociarCuentaCaptura(p.ctx, r?.capturaId as string, nueva.cuentaId);
    expect(p.ctx.libro.saldo(nueva.cuentaId)).toBe(-35_000);
    expect(p.ctx.db.select().from(cuenta).where(eq(cuenta.id, nueva.cuentaId)).get()?.institucion).toBe(
      'banco_b',
    );
    expect(preguntasCaptura(p.ctx, opcionesPrueba.catalogo)).toEqual([]);
  });

  it('"¿Fue a meses?" convierte el cargo de la 8812 en compra a meses y sale de Por revisar', async () => {
    const p = conEscenario('e-captura');
    const [r] = await ingerirNotificaciones(
      p.ctx,
      [cruda(ejemplo('N-06'), INICIO_E_CAPTURA)],
      opcionesPrueba,
    );
    expect(preguntasCaptura(p.ctx, opcionesPrueba.catalogo)).toMatchObject([
      { tipo: 'fue_a_meses', monto: 183_000 },
    ]);
    fueAMeses(p.ctx, r?.capturaId as string, 3);
    expect(listarCapturasPorRevisar(p.ctx, opcionesPrueba.catalogo)).toEqual([]);
    expect(preguntasCaptura(p.ctx, opcionesPrueba.catalogo)).toEqual([]);
  });

  it('elegir la categoría de AUDIO TECH la aprende para la siguiente captura', async () => {
    const p = conEscenario('e-captura');
    const [r] = await ingerirNotificaciones(
      p.ctx,
      [cruda(ejemplo('N-12'), INICIO_E_CAPTURA)],
      opcionesPrueba,
    );
    expect(listarCapturasPorRevisar(p.ctx, opcionesPrueba.catalogo)).toMatchObject([
      { motivos: ['sin_categoria'], categoria: null, comercio: 'AUDIO TECH' },
    ]);
    confirmarCaptura(p.ctx, r?.capturaId as string, 'tecnologia');
    expect(listarCapturasPorRevisar(p.ctx, opcionesPrueba.catalogo)).toEqual([]);
    const [otra] = await ingerirNotificaciones(
      p.ctx,
      [cruda(ejemplo('N-12'), INICIO_E_CAPTURA + HORA)],
      opcionesPrueba,
    );
    const t = p.ctx.libro.obtener(otra?.transaccionId as string);
    expect(t?.asientos.some((a) => a.cuentaId === 'cat:personal:tecnologia')).toBe(true);
    expect(listarCapturasPorRevisar(p.ctx, opcionesPrueba.catalogo)).toEqual([]);
  });

  it('mapeo por etiqueta de adb solo en depuración (07 §2.5)', async () => {
    const catalogo = catalogoEmbebido(true);
    const n = { ...cruda(ejemplo('N-01'), INICIO_E_CAPTURA), paquete: PAQUETE_ADB, etiqueta: 'banco_a' };
    expect(paqueteEfectivo(n, catalogo, true)).toBe('mx.ejemplo.bancoa');
    expect(paqueteEfectivo(n, catalogo, false)).toBe(PAQUETE_ADB);
    const p = conEscenario('e-captura');
    const [prod] = await ingerirNotificaciones(p.ctx, [n], opcionesPrueba);
    expect(prod?.estado).toBe('no_reconocida');
    const [dep] = await ingerirNotificaciones(p.ctx, [{ ...n, clave: 'otra' }], {
      ...opcionesPrueba,
      depuracion: true,
    });
    expect(dep?.estado).toBe('vinculada');
  });

  it('cuenta nueva con el saldo de hoy: los movimientos en espera no se cuentan dos veces', async () => {
    const p = conEscenario('e-captura', (d) => {
      d['cuentas'] = (d['cuentas'] as { clave: string }[]).filter((c) => c.clave !== 'billetera_c');
    });
    const resultados = await ingerirNotificaciones(
      p.ctx,
      [cruda(ejemplo('N-09'), INICIO_E_CAPTURA), cruda(ejemplo('N-10'), INICIO_E_CAPTURA + MINUTO)],
      opcionesPrueba,
    );
    expect(resultados.map((r) => r.espera)).toEqual(['cuenta', 'cuenta']);
    // En su app ve $3,000: ya incluye el ingreso de $2,000 y el pago de $96.
    const id = agregarCuentaDesdeCaptura(p.ctx, resultados[1]?.capturaId as string, {
      nombre: 'Billetera C',
      saldoHoy: 300_000,
    });
    expect(p.ctx.libro.saldo(id)).toBe(300_000);
    expect(preguntasCaptura(p.ctx, opcionesPrueba.catalogo)).toEqual([]);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('el catálogo de producción no trae las plantillas sintéticas', () => {
    expect(catalogoEmbebido(false).bancos.map((b) => b.id)).not.toContain('banco_a');
  });
});

describe('captura inactiva (CA-M5-06)', () => {
  it('con 72 h sin eventos y apps bancarias instaladas aparece el aviso', () => {
    const p = conEscenario('e-captura');
    const t0 = INICIO_E_CAPTURA;
    p.reloj.fijarInstante(t0);
    activarCaptura(p.ctx, ['mx.ejemplo.bancoa']);
    registrarSenalesCaptura(p.ctx, { appsInstaladas: [], ultimoEvento: t0 });
    p.reloj.fijarInstante(t0 + 80 * HORA);
    expect(capturaInactiva(p.ctx)).toBe(false);
    registrarSenalesCaptura(p.ctx, { appsInstaladas: ['mx.ejemplo.bancoa'] });
    p.reloj.fijarInstante(t0 + 72 * HORA - 1);
    expect(capturaInactiva(p.ctx)).toBe(false);
    p.reloj.fijarInstante(t0 + 72 * HORA);
    expect(capturaInactiva(p.ctx)).toBe(true);
    expect(obtenerEstadoCaptura(p.ctx).inactiva).toBe(true);
    // Un evento nuevo lo quita.
    registrarSenalesCaptura(p.ctx, { ultimoEvento: t0 + 71 * HORA });
    expect(capturaInactiva(p.ctx)).toBe(false);
  });
});
