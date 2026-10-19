import { fireEvent, render, screen } from '@testing-library/react-native';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { CUENTAS_SISTEMA } from '@cartera/datos';
import { crearAnalitica, type EnvioAnalitica } from '../../analitica/cliente';
import { catalogoEmbebido, combinarPlantillas } from '../../captura/catalogo';
import { ingerirNotificaciones, type OpcionesIngesta } from '../../captura/ingesta';
import type { NotificacionCruda } from '../../captura/tipos';
import {
  fijarEstadisticas,
  listarCapturasPorRevisar,
  listarCategorias,
  preguntasCaptura,
  registrarMovimiento,
  type Contexto,
} from '../../servicios';
import { ProveedorAnalitica } from '../../sesion/ProveedorAnalitica';
import { ProveedorSesion } from '../../sesion/ProveedorSesion';
import { ProveedorAvisos } from '../principal/ProveedorAvisos';
import { conEscenario } from '../principal/__pruebas__/base';
import { etiquetaCampoMonto } from '../../ui/formato';
import { PorRevisarCapturas } from './PorRevisarCapturas';
import { TarjetaPreguntaCaptura } from './PreguntasCaptura';
import {
  AYUDA_SALDO_HOY,
  ETIQUETA_SALDO_HOY,
  PISTA_NO_ES_MIA_CUENTA,
  PISTA_NO_OTRO_DUPLICADO,
} from './textos';

/**
 * Pendiente 30 (parte captura): `correccion {campo}` desde las capturas. Solo el campo, nunca el monto, el
 * comercio, el banco ni el texto de la notificación (regla 9).
 */
const FIXTURES = join(__dirname, '../../../../../fixtures');
const MINUTO = 60_000;
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

function cruda(e: Pick<Ejemplo, 'id' | 'paquete' | 'titulo' | 'texto'>, cuando: number): NotificacionCruda {
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
  fijarEstadisticas(p.ctx, true);
  return p;
}

/** Analítica real (lista blanca y opt-in) con un transporte falso que guarda lo que saldría. */
function conAnalitica(ctx: Contexto, ui: ReactNode) {
  const enviados: EnvioAnalitica[] = [];
  const analitica = crearAnalitica({
    transporte: async (e) => {
      enviados.push(e);
    },
    aleatorio: (n) => new Uint8Array(randomBytes(n)),
    bancosPermitidos: new Set(),
  });
  render(
    <ProveedorSesion ctx={ctx}>
      <ProveedorAnalitica analitica={analitica}>
        <ProveedorAvisos>{ui}</ProveedorAvisos>
      </ProveedorAnalitica>
    </ProveedorSesion>,
  );
  return enviados;
}

/** Nombre y propiedades del evento sin las técnicas fijas (`$lib`, `$geoip_disable`…). */
const propios = (enviados: EnvioAnalitica[]) =>
  enviados.map((e) => [
    e.evento,
    Object.fromEntries(Object.entries(e.propiedades).filter(([k]) => !k.startsWith('$'))),
  ]);

describe('analítica de las correcciones de captura (03 §8, pendiente 30)', () => {
  it('"Cambiar categoría" en Por revisar envía correccion {campo: categoria}; dejarla igual, nada', async () => {
    const p = eCaptura();
    await ingerirNotificaciones(
      p.ctx,
      ejemplos.map((e, i) => cruda(e, INICIO + i * MINUTO)),
      opciones,
    );
    const c = listarCapturasPorRevisar(p.ctx, opciones.catalogo).find(
      (x) => x.categoria !== null && !x.motivos.includes('sin_categoria'),
    );
    if (!c?.categoria) throw new Error('falta una captura con categoría en Por revisar');
    const ingreso = c.motivos.includes('ingreso') || c.motivos.includes('cobro');
    const otra = listarCategorias(p.ctx, ingreso ? 'ingreso' : 'gasto').find((k) => k.slug !== c.categoria);
    if (!otra) throw new Error('falta otra categoría');

    const enviados = conAnalitica(p.ctx, <PorRevisarCapturas alRegistrar={jest.fn()} />);
    fireEvent.press(screen.getByTestId(`captura-${c.capturaId}-cambiar`));
    fireEvent.press(screen.getByTestId(`captura-${c.capturaId}-categoria-${otra.slug}`));
    expect(propios(enviados)).toEqual([['correccion', { campo: 'categoria' }]]);
    p.cerrar();
  });

  it('cuenta nueva (débito): el saldo se anuncia en pesos (02 §15)', () => {
    const p = eCaptura();
    const pregunta = {
      tipo: 'cuenta_nueva' as const,
      capturaId: 'cap-prueba',
      banco: 'Banco A',
      bancoId: 'banco_a',
      ultimos4: null,
      monto: 50_000,
      fecha: '2026-10-11',
      candidatas: [],
      sugerencia: 'cuenta' as const,
    };
    conAnalitica(p.ctx, <TarjetaPreguntaCaptura pregunta={pregunta} testID="pregunta" />);
    fireEvent.press(screen.getByTestId('pregunta-agregar'));
    expect(screen.getByTestId('pregunta-form-saldo')).toHaveProp(
      'accessibilityLabel',
      etiquetaCampoMonto(ETIQUETA_SALDO_HOY, ''),
    );
    expect(screen.getByTestId('pregunta-form-saldo')).toHaveProp('accessibilityHint', AYUDA_SALDO_HOY);
    p.cerrar();
  });

  it('"No es mía" en una tarjeta detectada envía correccion {campo: cuenta} y nada del aviso', async () => {
    const p = eCaptura();
    const base = ejemplos.find((e) => e.id === 'N-06');
    if (!base) throw new Error('falta N-06');
    const texto = 'Se realizó un cargo de $350.00 en CINEPOLIS con tu tarjeta con terminación 4321';
    await ingerirNotificaciones(p.ctx, [cruda({ ...base, texto }, INICIO)], opciones);
    const q = preguntasCaptura(p.ctx, opciones.catalogo).find((x) => x.tipo === 'cuenta_nueva');
    if (!q) throw new Error('falta la pregunta de cuenta nueva');

    const enviados = conAnalitica(p.ctx, <TarjetaPreguntaCaptura pregunta={q} testID="pregunta" />);
    expect(screen.getByTestId('pregunta-no-es-mia')).toHaveProp('accessibilityHint', PISTA_NO_ES_MIA_CUENTA);
    fireEvent.press(screen.getByTestId('pregunta-no-es-mia'));
    expect(propios(enviados)).toEqual([['correccion', { campo: 'cuenta' }]]);
    const json = JSON.stringify(enviados).toLowerCase();
    for (const prohibido of ['cinepolis', '350', '4321', 'banco']) expect(json).not.toContain(prohibido);
    p.cerrar();
  });

  it('posible duplicado: "No, es otro" envía correccion {campo: otro}; "Sí, es el mismo", nada', async () => {
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
    for (const [boton, esperado] of [
      ['otro', [['correccion', { campo: 'otro' }]]],
      ['mismo', []],
    ] as const) {
      const p = conEscenario('e4-01');
      fijarEstadisticas(p.ctx, true);
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
      const nota = cruda(
        {
          id: 'NU',
          paquete: 'mx.ejemplo.nu',
          titulo: 'Compra',
          texto: 'Compraste $25.00 en OXXO REFORMA con tu tarjeta 4410',
        },
        INICIO,
      );
      await ingerirNotificaciones(p.ctx, [nota], { ...opciones, catalogo: catalogoNu });
      const q = preguntasCaptura(p.ctx, catalogoNu).find((x) => x.tipo === 'duplicado');
      if (!q) throw new Error('falta la pregunta de duplicado');

      const enviados = conAnalitica(p.ctx, <TarjetaPreguntaCaptura pregunta={q} testID="pregunta" />);
      if (boton === 'otro') {
        expect(screen.getByTestId('pregunta-otro')).toHaveProp('accessibilityHint', PISTA_NO_OTRO_DUPLICADO);
      }
      fireEvent.press(screen.getByTestId(`pregunta-${boton}`));
      expect(propios(enviados)).toEqual(esperado);
      expect(JSON.stringify(enviados).toLowerCase()).not.toMatch(/coca|oxxo|2500|25\.00|4410/);
      screen.unmount();
      p.cerrar();
    }
  });
});
