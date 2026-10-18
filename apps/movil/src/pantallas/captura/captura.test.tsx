import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CUENTAS_SISTEMA } from '@cartera/datos';
import { catalogoEmbebido } from '../../captura/catalogo';
import { ingerirNotificaciones, type OpcionesIngesta } from '../../captura/ingesta';
import { ProveedorCaptura } from '../../captura/ProveedorCaptura';
import type { AppBancaria, NotificacionCruda, PuenteCaptura } from '../../captura/tipos';
import {
  activarCaptura,
  cargarEscenario,
  listarCapturasPorRevisar,
  obtenerEstadoCaptura,
  obtenerHoy,
  registrarMovimiento,
  registrarSenalesCaptura,
  type Contexto,
} from '../../servicios';
import { ProveedorSesion } from '../../sesion/ProveedorSesion';
import { PantallaArqueo } from '../arqueo/PantallaArqueo';
import { ProveedorAvisos } from '../principal/ProveedorAvisos';
import { PantallaHoy } from '../principal/PantallaHoy';
import { PantallaMovimientos } from '../principal/PantallaMovimientos';
import { abrirPruebaPantalla, conEscenario, escenario, vector } from '../principal/__pruebas__/base';
import { navegacionFalsa, renderConSesion } from '../principal/__pruebas__/arnes';
import { apagarCapturaTrasRestaurar, reactivarCapturaPendiente } from '../../servicios/estado-captura';
import { ActivarCaptura, DIVULGACION_CAPTURA } from './ActivarCaptura';
import {
  BTN_NO_ES_MIA,
  etiquetaPermisoCaptura,
  etiquetaVacioCapturasPorRevisar,
  INTRO_CAPTURAS_POR_REVISAR,
  PERMISO_DENEGADO,
  TEXTO_CAPTURAS_POR_REVISAR_VACIO,
  tituloSalidaSinPareja,
} from './textos';

const FIXTURES = join(__dirname, '../../../../../fixtures');
const MINUTO = 60_000;
const HORA = 60 * MINUTO;
/** 11 oct 2026 a las 10:00 en la Ciudad de México, como en `e-captura`. */
const INICIO = Date.UTC(2026, 9, 11, 16, 0);

const sha256 = async (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const opciones: OpcionesIngesta = { catalogo: catalogoEmbebido(true), sha256, depuracion: false };

interface Ejemplo {
  id: string;
  paquete: string;
  titulo: string;
  texto: string;
}
const ejemplos: Ejemplo[] = readFileSync(join(FIXTURES, 'notificaciones', 'ejemplos.jsonl'), 'utf8')
  .split('\n')
  .filter((l) => l.trim() !== '')
  .map((l) => JSON.parse(l) as Ejemplo);

function cruda(id: string, cuando: number): NotificacionCruda {
  const e = ejemplos.find((x) => x.id === id);
  if (!e) throw new Error(`falta ${id}`);
  return {
    clave: `0|${e.paquete}|1|${e.id}|10123`,
    etiqueta: null,
    paquete: e.paquete,
    titulo: e.titulo,
    texto: e.texto,
    publicada_en: cuando,
    cuando,
  };
}

function eCaptura() {
  const p = conEscenario('e-captura');
  p.reloj.fijarInstante(INICIO);
  return p;
}

describe('preguntas de captura en Hoy', () => {
  it('"¿A quién le mandaste $4,200?" después de 24 h: "Una que no llevo aquí" vacía el tránsito (CA-M5-09)', async () => {
    const p = eCaptura();
    await ingerirNotificaciones(p.ctx, [cruda('N-04', INICIO)], opciones);
    expect(p.ctx.libro.saldo(CUENTAS_SISTEMA.transito)).toBe(420_000);
    p.reloj.fijarInstante(INICIO + 24 * HORA + MINUTO);
    expect(obtenerHoy(p.ctx).tarjetasAccion.map((t) => t.tipo)).toContain('pregunta_captura');

    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} />);
    expect(screen.getByText(tituloSalidaSinPareja(420_000), { hidden: true })).toBeTruthy();
    fireEvent.press(screen.getByTestId('tarjeta-accion-0-cuenta'));
    fireEvent.press(screen.getByTestId('tarjeta-accion-0-destino-externa'));
    expect(p.ctx.libro.saldo(CUENTAS_SISTEMA.transito)).toBe(0);
    expect(screen.queryByText(tituloSalidaSinPareja(420_000), { hidden: true })).toBeNull();
    p.cerrar();
  });

  it('tarjeta nueva detectada: "No es mía" la descarta sin movimiento', async () => {
    const p = eCaptura();
    const n: NotificacionCruda = {
      ...cruda('N-06', INICIO),
      texto: 'Se realizó un cargo de $350.00 en CINEPOLIS con tu tarjeta con terminación 4321',
    };
    await ingerirNotificaciones(p.ctx, [n], opciones);
    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} />);
    expect(screen.getByText(/Detecté una tarjeta ••4321 de Banco B/, { hidden: true })).toBeTruthy();
    fireEvent.press(screen.getByText(BTN_NO_ES_MIA, { hidden: true }));
    expect(screen.queryByText(/Detecté una tarjeta/)).toBeNull();
    expect(obtenerHoy(p.ctx).tarjetasAccion.map((t) => t.tipo)).not.toContain('pregunta_captura');
    p.cerrar();
  });

  it('captura inactiva: 72 h sin avisos con apps de banco instaladas (CA-M5-06)', () => {
    const p = eCaptura();
    activarCaptura(p.ctx, ['mx.ejemplo.bancoa']);
    registrarSenalesCaptura(p.ctx, { appsInstaladas: ['mx.ejemplo.bancoa'], ultimoEvento: INICIO });
    p.reloj.fijarInstante(INICIO + 72 * HORA);
    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} />);
    expect(
      screen.getByText(
        'No he visto notificaciones de tu banco en 3 días. Revisa que la captura siga activa.',
      ),
    ).toBeTruthy();
    p.cerrar();
  });
});

describe('Movimientos → capturas por revisar', () => {
  it('con captura activa y sin pendientes muestra el estado vacío', () => {
    const p = eCaptura();
    activarCaptura(p.ctx, ['mx.ejemplo.bancoa']);
    renderConSesion(p.ctx, <PantallaMovimientos alRegistrar={jest.fn()} />);
    expect(screen.getByTestId('capturas-por-revisar-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByTestId('capturas-por-revisar-vacio')).toHaveTextContent(
      TEXTO_CAPTURAS_POR_REVISAR_VACIO,
    );
    expect(screen.getByTestId('capturas-por-revisar-vacio')).toHaveProp('accessibilityLiveRegion', 'polite');
    expect(screen.getByTestId('capturas-por-revisar-vacio')).toHaveProp(
      'accessibilityLabel',
      etiquetaVacioCapturasPorRevisar(),
    );
    p.cerrar();
  });

  it('la no reconocida muestra su texto y "Ya lo registré" la quita; "¿Fue a meses?" la vuelve compra a meses', async () => {
    const p = eCaptura();
    await ingerirNotificaciones(
      p.ctx,
      ejemplos.map((e, i) => cruda(e.id, INICIO + i * MINUTO)),
      opciones,
    );
    const antes = listarCapturasPorRevisar(p.ctx, opciones.catalogo);
    const noReconocida = antes.find((c) => c.motivos[0] === 'no_reconocida');
    const aMeses = antes.find((c) => c.motivos.includes('fue_a_meses'));
    expect(noReconocida && aMeses).toBeTruthy();

    renderConSesion(p.ctx, <PantallaMovimientos alRegistrar={jest.fn()} />);
    expect(screen.getByTestId('capturas-por-revisar')).toBeTruthy();
    expect(screen.getByTestId('capturas-por-revisar-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByTestId('capturas-por-revisar-intro')).toHaveTextContent(INTRO_CAPTURAS_POR_REVISAR);
    expect(
      within(screen.getByTestId(`captura-${noReconocida?.capturaId}`)).getByRole('header'),
    ).toBeTruthy();
    expect(screen.getByText(/Consulta tu estado de cuenta en la app/)).toBeTruthy();
    fireEvent.press(screen.getByTestId(`captura-${noReconocida?.capturaId}-ya`));
    expect(screen.queryByText(/Consulta tu estado de cuenta en la app/)).toBeNull();

    fireEvent.press(screen.getByTestId(`captura-${aMeses?.capturaId}-meses-6`));
    const despues = listarCapturasPorRevisar(p.ctx, opciones.catalogo);
    expect(despues.find((c) => c.capturaId === aMeses?.capturaId)).toBeUndefined();
    expect(screen.queryByTestId(`captura-${aMeses?.capturaId}`)).toBeNull();
    p.cerrar();
  });
});

interface VectorE7 {
  efectivo_real: number;
  historial: { categoria: string; monto: number }[];
  esperado: { hueco: number; propuesta: { categoria: string; monto: number }[] };
}

describe('arqueo (CA-M5-05)', () => {
  it('coca marcada, traes $300: faltan $315 repartidos como E7-08 y el efectivo queda en $300', () => {
    const p = abrirPruebaPantalla();
    const e = cargarEscenario(p.ctx, escenario('e4-01'));
    p.reloj.fijar(e.hoy);
    p.reloj.fijarInstante(INICIO - 30 * HORA);
    const efectivo = e.cuentas['efectivo'] as string;
    const v = vector<VectorE7>('E7-08');
    registrarMovimiento(p.ctx, {
      tipo: 'ingreso',
      categoria: 'otros_ingresos',
      destinoId: efectivo,
      monto: v.historial.reduce((s, h) => s + h.monto, 0),
      fecha: '2026-09-20',
    });
    v.historial.forEach((h, i) =>
      registrarMovimiento(p.ctx, {
        tipo: 'gasto',
        categoria: h.categoria,
        origenId: efectivo,
        monto: h.monto,
        fecha: `2026-09-${String(21 + i).padStart(2, '0')}`,
      }),
    );
    const coca = registrarMovimiento(
      p.ctx,
      {
        tipo: 'gasto',
        categoria: 'antojos',
        origenId: CUENTAS_SISTEMA.porAsignar,
        monto: 2_500,
        descripcion: 'Coca',
        fecha: '2026-10-10',
      },
      { origen: 'voz' },
    );
    p.reloj.fijarInstante(INICIO);
    const alCerrar = jest.fn();
    renderConSesion(p.ctx, <PantallaArqueo alCerrar={alCerrar} />);

    fireEvent.press(screen.getByTestId(`arqueo-marcar-${coca.transaccionId}`));
    fireEvent.press(screen.getByTestId('arqueo-continuar'));
    expect(screen.getByTestId('arqueo-esperado')).toHaveTextContent(
      'Deberías traer $615 en efectivo. ¿Cuánto traes?',
    );
    fireEvent.press(screen.getByTestId('arqueo-otra'));
    fireEvent.changeText(screen.getByTestId('arqueo-monto'), '300');
    fireEvent.press(screen.getByTestId('arqueo-calcular'));
    expect(screen.getByText('Faltan $315. Lo repartí según tus gastos en efectivo:')).toBeTruthy();
    for (const pr of v.esperado.propuesta) {
      expect(screen.getByTestId(`arqueo-propuesta-${pr.categoria}`)).toHaveProp(
        'value',
        (pr.monto / 100).toLocaleString('en-US'),
      );
    }
    fireEvent.press(screen.getByTestId('arqueo-confirmar'));
    expect(p.ctx.libro.saldo(efectivo)).toBe(30_000);
    expect(p.ctx.libro.saldo(CUENTAS_SISTEMA.porAsignar)).toBe(0);
    fireEvent.press(screen.getByTestId('arqueo-listo'));
    expect(alCerrar).toHaveBeenCalled();
    p.cerrar();
  });

  it('tarjeta de Hoy 48 h después de un retiro: el chip exacto cuadra el efectivo con un toque', () => {
    const p = conEscenario('e4-01');
    p.reloj.fijarInstante(INICIO);
    registrarMovimiento(p.ctx, {
      tipo: 'retiro_efectivo',
      origenId: p.e.cuentas['bbva'] as string,
      destinoId: p.e.cuentas['efectivo'] as string,
      monto: 50_000,
    });
    p.reloj.fijarInstante(INICIO + 48 * HORA + 1_000);
    const navegacion = { ...navegacionFalsa(), alAbrirArqueo: jest.fn() };
    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacion} />);
    expect(screen.getByText('Deberías traer $1,140 en efectivo. ¿Cuánto traes?')).toBeTruthy();
    fireEvent.press(screen.getByText('Otra cantidad'));
    expect(navegacion.alAbrirArqueo).toHaveBeenCalled();
    fireEvent.press(screen.getByText('$1,140'));
    expect(screen.queryByText(/Deberías traer/)).toBeNull();
    expect(obtenerHoy(p.ctx).tarjetasAccion.map((t) => t.tipo)).not.toContain('arqueo');
    p.cerrar();
  });

  it('un sobrante pide de dónde salió antes de registrar nada (E7-09)', () => {
    const p = conEscenario('e4-01');
    const efectivo = p.e.cuentas['efectivo'] as string;
    renderConSesion(p.ctx, <PantallaArqueo alCerrar={jest.fn()} />);
    fireEvent.press(screen.getByTestId('arqueo-otra'));
    fireEvent.changeText(screen.getByTestId('arqueo-monto'), '700');
    fireEvent.press(screen.getByTestId('arqueo-calcular'));
    expect(screen.getByText('Traes $60 más de lo esperado. ¿De dónde salió?')).toBeTruthy();
    expect(p.ctx.libro.saldo(efectivo)).toBe(64_000);
    fireEvent.press(screen.getByTestId('arqueo-sobrante-no_se'));
    expect(p.ctx.libro.saldo(efectivo)).toBe(70_000);
    p.cerrar();
  });
});

/** Módulo nativo falso: el permiso se concede "al volver del ajuste". */
function puenteFalso(cola: NotificacionCruda[] = []) {
  let permiso: 'concedido' | 'denegado' = 'denegado';
  const apps: AppBancaria[] = [{ banco: 'banco_a', nombre: 'Banco A', paquete: 'mx.ejemplo.bancoa' }];
  const puente = {
    disponible: () => true,
    esDepuracion: () => false,
    leerCola: jest.fn(async () => [...cola]),
    confirmarProcesadas: jest.fn(async (n: readonly NotificacionCruda[]) => n.length),
    suscribirse: jest.fn(() => () => {}),
    estadoPermiso: jest.fn(async () => permiso),
    abrirAjustesPermiso: jest.fn(async () => {
      permiso = 'concedido';
      return true;
    }),
    abrirInfoApp: jest.fn(async () => true),
    appsBancariasInstaladas: jest.fn(async () => apps),
    fijarListaBlanca: jest.fn(async (p: readonly string[]) => [...p]),
    listaBlanca: jest.fn(async () => []),
    ultimoEvento: jest.fn(async () => null),
    estadoServicio: jest.fn(async () => ({ conectado_en: null, desconectado_en: null, ultimo_evento: null })),
    solicitarReconexion: jest.fn(async () => {}),
    diagnostico: {
      resumen: jest.fn(),
      configurar: jest.fn(),
      muestras: jest.fn(async () => []),
      borrar: jest.fn(async () => {}),
    },
  } as unknown as PuenteCaptura & {
    leerCola: jest.Mock;
    confirmarProcesadas: jest.Mock;
    abrirAjustesPermiso: jest.Mock;
    fijarListaBlanca: jest.Mock;
  };
  return puente;
}

function conCaptura(ctx: Contexto, puente: PuenteCaptura, ui: React.ReactNode) {
  return render(
    <ProveedorSesion ctx={ctx}>
      <ProveedorCaptura puente={puente} sha256={sha256} catalogo={opciones.catalogo} depuracion={false}>
        <ProveedorAvisos>{ui}</ProveedorAvisos>
      </ProveedorCaptura>
    </ProveedorSesion>,
  );
}

describe('O6 · activar la captura', () => {
  it('si el permiso sigue denegado, muestra instrucciones y el aviso de denegado', async () => {
    const p = eCaptura();
    let permiso: 'concedido' | 'denegado' = 'denegado';
    const apps: AppBancaria[] = [{ banco: 'banco_a', nombre: 'Banco A', paquete: 'mx.ejemplo.bancoa' }];
    const puente = {
      ...puenteFalso(),
      estadoPermiso: jest.fn(async () => permiso),
      abrirAjustesPermiso: jest.fn(async () => true),
      appsBancariasInstaladas: jest.fn(async () => apps),
    } as unknown as PuenteCaptura & { abrirAjustesPermiso: jest.Mock };
    conCaptura(p.ctx, puente, <ActivarCaptura testID="o6" alTerminar={jest.fn()} />);
    await act(async () => fireEvent.press(screen.getByTestId('o6-activar')));
    await act(async () => fireEvent.press(screen.getByTestId('o6-ya')));
    expect(screen.getByTestId('o6-permiso-denegado')).toBeTruthy();
    expect(screen.getByText(PERMISO_DENEGADO)).toBeTruthy();
    expect(screen.getByTestId('o6-permiso-denegado-texto').props.accessibilityLabel).toBe(
      etiquetaPermisoCaptura(true),
    );
    permiso = 'concedido';
    await act(async () => fireEvent.press(screen.getByTestId('o6-ya')));
    expect(screen.getByText('¿Qué apps de banco leo?')).toBeTruthy();
    p.cerrar();
  });

  it('divulgación → Activar abre el ajuste → al volver se eligen las apps y queda la lista blanca', async () => {
    const p = eCaptura();
    const puente = puenteFalso();
    const alTerminar = jest.fn();
    conCaptura(p.ctx, puente, <ActivarCaptura testID="o6" alTerminar={alTerminar} />);
    expect(
      screen.getByText(
        'Solo leemos las apps que marques. Las demás notificaciones se ignoran en tu teléfono y no se guardan.',
      ),
    ).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId('o6-activar')));
    expect(puente.abrirAjustesPermiso).toHaveBeenCalled();
    expect(obtenerEstadoCaptura(p.ctx).divulgacionAceptada).toBe(true);
    await act(async () => fireEvent.press(screen.getByTestId('o6-ya')));
    // Ninguna app viene marcada.
    expect(screen.getByTestId('o6-guardar-apps')).toBeDisabled();
    fireEvent.press(screen.getByTestId('o6-app-banco_a'));
    await act(async () => fireEvent.press(screen.getByTestId('o6-guardar-apps')));
    expect(puente.fijarListaBlanca).toHaveBeenCalledWith(['mx.ejemplo.bancoa']);
    expect(obtenerEstadoCaptura(p.ctx)).toMatchObject({ activada: true, apps: ['mx.ejemplo.bancoa'] });
    fireEvent.press(screen.getByTestId('o6-continuar'));
    expect(alTerminar).toHaveBeenCalledWith(true);
    p.cerrar();
  });

  it('tras restaurar, Hoy pide reactivarla y "Activar" recorre el mismo flujo hasta la lista blanca (pendiente 47)', async () => {
    const p = eCaptura();
    activarCaptura(p.ctx, ['mx.ejemplo.bancoa']);
    apagarCapturaTrasRestaurar(p.ctx);
    expect(obtenerHoy(p.ctx).tarjetasAccion.map((t) => t.tipo)).toContain('reactivar_captura');
    const puente = puenteFalso();
    conCaptura(p.ctx, puente, <PantallaHoy navegacion={navegacionFalsa()} />);
    expect(screen.getByText('Vuelve a activar la lectura de notificaciones')).toBeTruthy();
    fireEvent.press(screen.getByTestId(/-reactivar$/));
    // La divulgación destacada se vuelve a mostrar antes de abrir el ajuste del sistema.
    expect(screen.getByText(DIVULGACION_CAPTURA.parrafos[1])).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId(/-activar-activar$/)));
    expect(puente.abrirAjustesPermiso).toHaveBeenCalled();
    await act(async () => fireEvent.press(screen.getByTestId(/-activar-ya$/)));
    fireEvent.press(screen.getByTestId(/-activar-app-banco_a$/));
    await act(async () => fireEvent.press(screen.getByTestId(/-activar-guardar-apps$/)));
    expect(puente.fijarListaBlanca).toHaveBeenCalledWith(['mx.ejemplo.bancoa']);
    expect(obtenerEstadoCaptura(p.ctx).activada).toBe(true);
    expect(reactivarCapturaPendiente(p.ctx)).toBe(false);
    expect(screen.queryByText('Vuelve a activar la lectura de notificaciones')).toBeNull();
    expect(screen.getByText('Listo: vuelvo a leer los avisos de tu banco.')).toBeTruthy();
    p.cerrar();
  });

  it('tras restaurar, "Ahora no" deja la captura apagada y quita la tarjeta', async () => {
    const p = eCaptura();
    activarCaptura(p.ctx, ['mx.ejemplo.bancoa']);
    apagarCapturaTrasRestaurar(p.ctx);
    const puente = puenteFalso();
    conCaptura(p.ctx, puente, <PantallaHoy navegacion={navegacionFalsa()} />);
    await act(async () => fireEvent.press(screen.getByTestId(/-ahora-no$/)));
    expect(puente.fijarListaBlanca).toHaveBeenCalledWith([]);
    expect(obtenerEstadoCaptura(p.ctx).activada).toBe(false);
    expect(reactivarCapturaPendiente(p.ctx)).toBe(false);
    expect(screen.queryByText('Vuelve a activar la lectura de notificaciones')).toBeNull();
    expect(screen.getByText('Va. Puedes activarla cuando quieras en Ajustes.')).toBeTruthy();
    p.cerrar();
  });

  it('el proveedor ingiere la cola al abrir y la confirma con las notificaciones completas', async () => {
    const p = eCaptura();
    const cola = [cruda('N-01', INICIO), cruda('N-09', INICIO + MINUTO)];
    const puente = puenteFalso(cola);
    conCaptura(p.ctx, puente, <PantallaMovimientos alRegistrar={jest.fn()} />);
    await waitFor(() => expect(puente.confirmarProcesadas).toHaveBeenCalledWith(cola));
    await waitFor(() => expect(screen.getByText('OXXO PUEBLA 123')).toBeTruthy());
    p.cerrar();
  });
});
