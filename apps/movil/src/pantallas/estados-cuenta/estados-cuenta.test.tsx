import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, screen } from '@testing-library/react-native';
import {
  construirGasto,
  construirPagoTarjeta,
  construirReembolso,
  type Centavos,
  type MovimientoPropuesto,
  type PlainDate,
} from '@cartera/core';
import { idCategoria } from '@cartera/datos';
import type { ResultadoExtraccionPdf } from '../../captura/puente';
import { aceptarConsentimiento, agregarCuenta, agregarTarjetaCredito, type Contexto } from '../../servicios';
import { auditar } from '../__pruebas__/accesibilidad';
import { abrirPruebaPantalla } from '../principal/__pruebas__/base';
import { renderConSesion } from '../principal/__pruebas__/arnes';
import { PantallaTarjeta } from '../tarjetas/PantallaTarjeta';
import { esPdfCompartido } from './compartido';
import { LeerEstadoCuenta, type ExtraerPdf } from './LeerEstadoCuenta';
import {
  ETIQUETA_AVISO_ESTADO,
  ERROR_CONTRASENA_PDF,
  mensajeGuardado,
  mensajeNoReconocido,
  MENSAJE_ESCANEADO,
  MENSAJE_INVALIDO,
  TEXTO_SIN_NUEVOS,
  tituloNuevos,
  TITULO_PANTALLA,
} from './textos';

const PDF = join(__dirname, '../../../../../fixtures/pdf');

interface Renglon {
  indice: number;
  fecha: PlainDate;
  descripcion: string;
  monto: Centavos;
  tipo: 'cargo' | 'comision' | 'pago' | 'abono';
}
interface EsperadoB {
  saldo_anterior: number;
  saldo_corte: number;
  movimientos: Renglon[];
  msi: { cuota: number }[];
}

const B = JSON.parse(readFileSync(join(PDF, 'banco_b.json'), 'utf8')) as EsperadoB;
/** El texto que PDFBox saca de `banco_b.pdf` (lo comprueba `nucleo-jvm`). */
const PAGINAS_B = [readFileSync(join(PDF, 'banco_b.txt'), 'utf8')];
const CUOTAS_MSI = B.msi.reduce((s, m) => s + m.cuota, 0);

/** La Oro ••8812 con los 42 renglones de Banco B registrados salvo `faltan` (CA-M15-02). */
function preparar({ faltan = [7, 24, 37], diferencia = 0 }: { faltan?: number[]; diferencia?: number } = {}) {
  const p = abrirPruebaPantalla('2026-09-01');
  const { ctx } = p;
  aceptarConsentimiento(ctx, { datosFinancieros: true });
  const bbva = agregarCuenta(ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 5_000_000 });
  const oro = agregarTarjetaCredito(ctx, {
    nombre: 'Oro',
    ultimos4: '8812',
    diaCorte: 10,
    diasParaPagar: 20,
    limiteCredito: 3_000_000,
    modo: 'totalero',
    saldo: B.saldo_anterior + CUOTAS_MSI - diferencia,
  }).cuentaId;
  p.reloj.fijar('2026-10-11');
  for (const m of B.movimientos) {
    if (faltan.includes(m.indice)) continue;
    const mov: MovimientoPropuesto =
      m.tipo === 'pago'
        ? construirPagoTarjeta({ tarjeta: oro, origen: bbva, monto: m.monto })
        : m.tipo === 'abono'
          ? construirReembolso({ destino: oro, contra: idCategoria('reembolso'), monto: m.monto })
          : construirGasto({
              categoria: idCategoria(m.tipo === 'comision' ? 'comisiones_intereses' : 'otros_gastos'),
              pago: oro,
              monto: m.monto,
            });
    ctx.libro.registrar({
      tipo: mov.tipo,
      fecha: m.fecha,
      origen: 'notificacion',
      claveIdempotencia: `prueba:${m.indice}`,
      asientos: mov.asientos,
      comercio: m.descripcion,
    });
  }
  return { ctx, oro };
}

const texto = (paginas: readonly string[]): ResultadoExtraccionPdf => ({ tipo: 'texto', paginas });

function montar(ctx: Contexto, extraer: ExtraerPdf, tarjetaId?: string) {
  const alVerTarjeta = jest.fn();
  const alSalir = jest.fn();
  const r = renderConSesion(
    ctx,
    <LeerEstadoCuenta
      extraer={extraer}
      tarjetaId={tarjetaId}
      alVerTarjeta={alVerTarjeta}
      alSalir={alSalir}
    />,
  );
  return { ...r, alVerTarjeta, alSalir };
}

async function presionar(testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
}

describe('Estado de cuenta en PDF (02 §26)', () => {
  it('CA-M15-02: "42 movimientos; 3 no los tenía; el saldo al corte coincide" → Guardar agrega 3', async () => {
    const { ctx, oro } = preparar();
    const extraer = jest.fn(async () => texto(PAGINAS_B));
    const v = montar(ctx, extraer);
    expect(screen.getByTestId('estado-cuenta-titulo')).toHaveTextContent(TITULO_PANTALLA);
    expect(await screen.findByTestId('estado-resumen-texto')).toHaveTextContent(
      'Leí tu estado de cuenta de la Oro (corte 10 oct): 42 movimientos; 3 no los tenía; el saldo al corte coincide',
    );
    expect(extraer).toHaveBeenCalledWith(null);
    for (const i of [7, 24, 37]) expect(screen.getByTestId(`estado-nuevo-${i}`)).toBeTruthy();
    expect(screen.getByTestId('estado-nuevo-7')).toHaveTextContent(/Compra: SORIANA HIPER COYOACAN · 16 sep/);
    expect(auditar(screen.toJSON(), { etiquetaExplicita: true })).toStrictEqual([]);

    await presionar('estado-guardar');
    expect(screen.getByTestId('estado-guardado')).toHaveTextContent('Agregué 3 movimientos a tu Oro.');
    expect(screen.queryByTestId('estado-conciliacion')).toBeNull();
    await presionar('estado-ver-tarjeta');
    expect(v.alVerTarjeta).toHaveBeenCalledWith(oro);
  });

  it('CA-M15-02: si el saldo difiere, "Según tu banco debes …; según Cartera, …. ¿Ajusto?" y Ajustar', async () => {
    const { ctx } = preparar({ diferencia: 15_000 });
    montar(ctx, async () => texto(PAGINAS_B));
    expect(await screen.findByTestId('estado-resumen-texto')).toHaveTextContent(
      /3 no los tenía; el saldo al corte no coincide$/,
    );
    await presionar('estado-guardar');
    expect(screen.getByTestId('estado-conciliacion-texto')).toHaveTextContent(
      'Según tu banco debes $14,021.95; según Cartera, $13,871.95. ¿Ajusto?',
    );
    expect(auditar(screen.toJSON(), { etiquetaExplicita: true })).toStrictEqual([]);
    await presionar('estado-ajustar');
    expect(screen.getByTestId('estado-ajustado')).toHaveTextContent(
      'Listo: tu Oro quedó como dice tu banco.',
    );

    // Ya conciliado: volver a compartirlo no agrega ni propone nada.
    screen.unmount();
    montar(ctx, async () => texto(PAGINAS_B));
    expect(await screen.findByTestId('estado-resumen-texto')).toHaveTextContent(
      /: 42 movimientos; ya tenías todos; el saldo al corte coincide$/,
    );
    expect(screen.getByTestId('estado-sin-nuevos')).toHaveTextContent(TEXTO_SIN_NUEVOS);
  });

  it('quitar un nuevo de la lista no lo agrega', async () => {
    const { ctx } = preparar();
    montar(ctx, async () => texto(PAGINAS_B));
    await screen.findByTestId('estado-resumen-texto');
    fireEvent.press(screen.getByTestId('estado-nuevo-37'));
    expect(screen.getByTestId('estado-nuevo-37').props.accessibilityState).toMatchObject({ checked: false });
    await presionar('estado-guardar');
    expect(screen.getByTestId('estado-guardado')).toHaveTextContent('Agregué 2 movimientos a tu Oro.');
    // Sin la bonificación, Cartera dice que debes más que el banco: propone ajustar.
    expect(screen.getByTestId('estado-conciliacion-texto')).toHaveTextContent(/según Cartera, \$14,121\.95/);
    await presionar('estado-no-ajustar');
    expect(screen.queryByTestId('estado-conciliacion')).toBeNull();
  });

  it('un dudoso pide "Es el mismo" o "Es otro" antes de guardar', async () => {
    const { ctx, oro } = preparar({ faltan: [7] });
    // SORIANA registrada dos días después: E9.3 pregunta.
    ctx.libro.registrar({
      ...construirGasto({ categoria: idCategoria('super'), pago: oro, monto: 153275 }),
      fecha: '2026-09-18',
      origen: 'notificacion',
      claveIdempotencia: 'prueba:soriana',
      comercio: 'SORIANA',
    });
    montar(ctx, async () => texto(PAGINAS_B));
    expect(await screen.findByTestId('estado-resumen-texto')).toHaveTextContent(
      /: 42 movimientos; ya tenías todos; 1 quizá ya lo tenías; el saldo al corte coincide$/,
    );
    expect(screen.getByTestId('estado-dudoso-7')).toHaveTextContent(
      /¿Es el mismo que ya tenías: SORIANA del 18 sep por \$1,532\.75\?/,
    );
    expect(screen.getByTestId('estado-guardar').props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(screen.getByTestId('estado-dudoso-7-mismo'));
    expect(screen.getByTestId('estado-guardar').props.accessibilityState).toMatchObject({ disabled: false });
    expect(auditar(screen.toJSON(), { etiquetaExplicita: true })).toStrictEqual([]);
    await presionar('estado-guardar');
    expect(screen.getByTestId('estado-guardado')).toHaveTextContent('No agregué nada: tu Oro ya tenía todo.');
    expect(screen.queryByTestId('estado-conciliacion')).toBeNull();
  });

  it('PDF con contraseña: la pide, avisa si no abre y lee con la buena', async () => {
    const { ctx } = preparar();
    const extraer = jest.fn<Promise<ResultadoExtraccionPdf>, [string | null]>(async (c) =>
      c === null
        ? { tipo: 'pide_contrasena' }
        : c === 'PRUEBA2026'
          ? texto(PAGINAS_B)
          : { tipo: 'contrasena_incorrecta' },
    );
    montar(ctx, extraer);
    expect(await screen.findByTestId('estado-contrasena')).toBeTruthy();
    expect(screen.getByTestId('estado-abrir').props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.changeText(screen.getByTestId('estado-contrasena'), 'otra');
    await presionar('estado-abrir');
    expect(screen.getByTestId('estado-contrasena').props.accessibilityHint).toBe(ERROR_CONTRASENA_PDF);
    expect(screen.getByTestId('estado-contrasena').props.secureTextEntry).toBe(true);
    fireEvent.changeText(screen.getByTestId('estado-contrasena'), 'PRUEBA2026');
    await presionar('estado-abrir');
    expect(screen.getByTestId('estado-resumen-texto')).toHaveTextContent(/42 movimientos/);
    expect(extraer.mock.calls.map((c) => c[0])).toStrictEqual([null, 'otra', 'PRUEBA2026']);
  });

  it('CA-M15-03: un PDF escaneado muestra "No puedo leer PDFs escaneados"', async () => {
    const { ctx } = preparar();
    // Lo que PDFBox saca de `escaneado.pdf`: una página sin texto.
    const v = montar(ctx, async () => texto(['\n']));
    expect(await screen.findByTestId('estado-escaneado')).toHaveTextContent(MENSAJE_ESCANEADO);
    expect(MENSAJE_ESCANEADO).toBe('No puedo leer PDFs escaneados');
    expect(auditar(screen.toJSON(), { etiquetaExplicita: true })).toStrictEqual([]);
    await presionar('estado-salir');
    expect(v.alSalir).toHaveBeenCalled();
  });

  it('avisos de error usan etiqueta TalkBack', async () => {
    const { ctx } = preparar();
    montar(ctx, async () => ({ tipo: 'invalido' }));
    const aviso = await screen.findByTestId('estado-error');
    expect(aviso).toHaveTextContent(MENSAJE_INVALIDO);
    expect(aviso.props.accessibilityLabel).toBe(`${ETIQUETA_AVISO_ESTADO}. ${MENSAJE_INVALIDO}`);
  });

  it('banco desconocido, archivo inválido, demasiado grande, sin módulo y error al leer', async () => {
    const { ctx } = preparar();
    const casos: [ExtraerPdf, string, RegExp][] = [
      [
        async () => texto(['ESTADO DE CUENTA BANCO DESCONOCIDO\nSALDO 100.00\n'.repeat(5)]),
        'estado-no-reconocido',
        /Todavía no sé leer estados de cuenta de ese banco\. Por ahora leo: Banco B, Banco E, Banco F\./,
      ],
      [async () => ({ tipo: 'invalido' }), 'estado-error', /No pude abrir ese archivo/],
      [async () => ({ tipo: 'demasiado_grande' }), 'estado-error', /demasiado grande/],
      [
        async () => ({ tipo: 'no_disponible' }),
        'estado-error',
        /solo puedo leer estados de cuenta en Android/,
      ],
      [
        async () => Promise.reject(new Error('SORIANA 1,532.75')),
        'estado-error',
        /No pude abrir ese archivo/,
      ],
    ];
    for (const [extraer, id, esperado] of casos) {
      montar(ctx, extraer);
      expect(await screen.findByTestId(id)).toHaveTextContent(esperado);
      screen.unmount();
    }
  });

  it('con dos tarjetas que terminan igual pregunta de cuál es; desde la tarjeta ya no pregunta', async () => {
    const { ctx, oro } = preparar();
    const otra = agregarTarjetaCredito(ctx, {
      nombre: 'Platino',
      ultimos4: '8812',
      diaCorte: 10,
      diasParaPagar: 20,
      limiteCredito: 1_000_000,
      modo: 'totalero',
      saldo: 0,
    }).cuentaId;
    montar(ctx, async () => texto(PAGINAS_B));
    expect(await screen.findByTestId('estado-elegir')).toHaveTextContent(
      '¿De qué tarjeta es este estado de cuenta de Banco B terminación 8812 (corte 10 oct)?',
    );
    expect(screen.getByTestId(`estado-tarjeta-${otra}`)).toBeTruthy();
    await presionar(`estado-tarjeta-${oro}`);
    expect(screen.getByTestId('estado-resumen-texto')).toHaveTextContent(/de la Oro/);
    screen.unmount();

    montar(ctx, async () => texto(PAGINAS_B), oro);
    expect(await screen.findByTestId('estado-resumen-texto')).toHaveTextContent(/de la Oro/);
  });
});

describe('CA-M15-03 · ningún contenido del PDF sale del teléfono', () => {
  const PRIVADO = /SORIANA|OXXO|AMAZON|8812|14,021|1402195|PRUEBA2026/;

  it('leer, guardar y ajustar no usa la red ni escribe el contenido en la consola', async () => {
    const fetchOriginal = global.fetch;
    const fetchEspia = jest.fn(() => Promise.reject(new Error('sin red')));
    global.fetch = fetchEspia as unknown as typeof fetch;
    // Toda salida de red de React Native pasa por fetch, XMLHttpRequest o WebSocket.
    const globales = global as unknown as Record<'XMLHttpRequest' | 'WebSocket', unknown>;
    const { XMLHttpRequest: xhrOriginal, WebSocket: wsOriginal } = globales;
    const xhr = jest.fn();
    const sockets = jest.fn();
    globales.XMLHttpRequest = xhr;
    globales.WebSocket = sockets;
    const consolas = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    try {
      const { ctx } = preparar({ diferencia: 15_000 });
      const extraer = jest.fn<Promise<ResultadoExtraccionPdf>, [string | null]>(async (c) =>
        c === 'PRUEBA2026' ? texto(PAGINAS_B) : { tipo: 'pide_contrasena' },
      );
      montar(ctx, extraer);
      fireEvent.changeText(await screen.findByTestId('estado-contrasena'), 'PRUEBA2026');
      await presionar('estado-abrir');
      await presionar('estado-guardar');
      await presionar('estado-ajustar');
      expect(screen.getByTestId('estado-ajustado')).toBeTruthy();

      expect(fetchEspia).not.toHaveBeenCalled();
      expect(xhr).not.toHaveBeenCalled();
      expect(sockets).not.toHaveBeenCalled();
      for (const c of consolas) {
        for (const llamada of c.mock.calls) {
          expect(JSON.stringify(llamada)).not.toMatch(PRIVADO);
        }
      }
    } finally {
      global.fetch = fetchOriginal;
      globales.XMLHttpRequest = xhrOriginal;
      globales.WebSocket = wsOriginal;
      for (const c of consolas) c.mockRestore();
    }
  });
});

describe('entradas', () => {
  it('el detalle de la tarjeta ofrece "Leer el PDF de tu banco" solo si hay cómo', async () => {
    const { ctx, oro } = preparar();
    const leerPdf = jest.fn();
    const v = renderConSesion(
      ctx,
      <PantallaTarjeta tarjetaId={oro} alVolver={jest.fn()} alLeerEstadoPdf={leerPdf} />,
    );
    await presionar('tarjeta-leer-pdf');
    expect(leerPdf).toHaveBeenCalled();
    v.unmount();
    renderConSesion(ctx, <PantallaTarjeta tarjetaId={oro} alVolver={jest.fn()} />);
    expect(screen.queryByTestId('tarjeta-leer-pdf')).toBeNull();
  });
});

describe('textos de estado de cuenta', () => {
  it('mensajeNoReconocido y tituloNuevos en español de México', () => {
    expect(mensajeNoReconocido(['Banco B', 'Banco E'])).toBe(
      'Todavía no sé leer estados de cuenta de ese banco. Por ahora leo: Banco B, Banco E.',
    );
    expect(tituloNuevos(1)).toBe('El que no tenía');
    expect(mensajeGuardado(0, 'Oro')).toBe('No agregué nada: tu Oro ya tenía todo.');
  });
});

describe('hoja de compartir: ¿es un PDF?', () => {
  it('por el tipo o, si la app no lo dice, por la extensión', () => {
    expect(esPdfCompartido({ mimeType: 'application/pdf' })).toBe(true);
    expect(esPdfCompartido({ mimeType: '*/*', contentMimeType: 'application/PDF' })).toBe(true);
    expect(esPdfCompartido({ mimeType: 'application/octet-stream', originalName: 'Estado_Oct.PDF' })).toBe(
      true,
    );
    expect(esPdfCompartido({ value: 'content://x/estado.pdf?x=1' })).toBe(true);
    expect(esPdfCompartido({ mimeType: 'application/zip', originalName: 'facturas.zip' })).toBe(false);
    expect(esPdfCompartido({ mimeType: 'text/xml', value: 'content://x/factura.xml' })).toBe(false);
  });
});
