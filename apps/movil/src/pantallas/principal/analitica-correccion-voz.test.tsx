import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { randomBytes } from 'node:crypto';
import type { ReactNode } from 'react';
import { crearAnalitica, type EnvioAnalitica } from '../../analitica/cliente';
import { aceptarConsentimiento } from '../../privacidad/consentimiento';
import { fijarEstadisticas } from '../../privacidad/estadisticas';
import { aplicarEleccion, listarMovimientos, registrarMovimiento, type Contexto } from '../../servicios';
import { nubeFalsa } from '../../servicios/__pruebas__/nube';
import { ProveedorAnalitica } from '../../sesion/ProveedorAnalitica';
import { conEscenario } from './__pruebas__/base';
import {
  crearMotorFalso,
  fraseRegistro,
  navegacionFalsa,
  oidaDesde,
  renderConSesion,
} from './__pruebas__/arnes';
import { EnlaceAnaliticaCorreccion } from './ConfirmacionRegistro';
import { PantallaHoy } from './PantallaHoy';
import { PantallaRegistrar } from './PantallaRegistrar';

/**
 * Pendiente 30 (voz): `correccion {campo}` al aplicar una corrección dictada. Solo el campo del catálogo, nunca
 * monto, comercio ni texto de la frase (regla 9).
 */
// Sin verbo y con «micheladas» (fuera del diccionario): el nivel 0 la deja a la nube (06 §9.3).
const TACOS_Y_COCA = 'unas micheladas de 80 con la Nu y una coca de 25 en efectivo';
const TACOS_EN_EFECTIVO = 'no, los tacos fueron en efectivo';

const RESPUESTAS = {
  [TACOS_Y_COCA]: {
    intencion: 'registrar',
    movimientos: [
      {
        tipo: 'gasto',
        monto: 8000,
        fecha: '2026-10-11',
        descripcion: 'tacos',
        categoria: 'comida_fuera',
        origen: { tipo: 'credito', alias: 'nu' },
      },
      {
        tipo: 'gasto',
        monto: 2500,
        fecha: '2026-10-11',
        descripcion: 'coca',
        categoria: 'antojos',
        origen: { tipo: 'efectivo' },
      },
    ],
  },
  [TACOS_EN_EFECTIVO]: {
    intencion: 'corregir',
    objetivo: { texto: 'tacos' },
    cambios: { origen: { tipo: 'efectivo' } },
  },
};

const propios = (enviados: EnvioAnalitica[]) =>
  enviados.map((e) => [
    e.evento,
    Object.fromEntries(Object.entries(e.propiedades).filter(([k]) => !k.startsWith('$'))),
  ]);

function conAnalitica(
  ctx: Contexto,
  ui: ReactNode,
  nube: ReturnType<typeof nubeFalsa>['nube'] | null = null,
) {
  const enviados: EnvioAnalitica[] = [];
  const analitica = crearAnalitica({
    transporte: async (e) => {
      enviados.push(e);
    },
    aleatorio: (n) => new Uint8Array(randomBytes(n)),
    bancosPermitidos: new Set(),
  });
  renderConSesion(ctx, <ProveedorAnalitica analitica={analitica}>{ui}</ProveedorAnalitica>, nube);
  return enviados;
}

/** Escribe en Hoy (cuando Hoy y Registrar están montadas a la vez, la conversación es la de Hoy). */
async function escribir(frase: string) {
  const raiz = screen.queryByTestId('pantalla-hoy') ? within(screen.getByTestId('pantalla-hoy')) : screen;
  // Al mandar, el campo se cierra para que se vea la respuesta: se reabre con el botón del teclado.
  if (!raiz.queryByTestId('campo-registrar')) fireEvent.press(raiz.getByTestId('boton-escribir'));
  fireEvent.changeText(raiz.getByTestId('campo-registrar'), frase);
  await act(async () => {
    fireEvent.press(raiz.getByTestId('boton-enviar-registro'));
  });
}

function prepararAnalitica(id = 'e4-01') {
  const p = conEscenario(id);
  aceptarConsentimiento(p.ctx, { datosFinancieros: true, estadisticas: true });
  fijarEstadisticas(p.ctx, true);
  return p;
}

describe('analítica de corrección por voz (03 §8, pendiente 30)', () => {
  it('corregir cuenta por texto envía correccion {campo: cuenta} al guardar', async () => {
    const p = prepararAnalitica();
    const f = nubeFalsa({ ...RESPUESTAS });
    const enviados = conAnalitica(
      p.ctx,
      <>
        <EnlaceAnaliticaCorreccion />
        <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />
        <PantallaRegistrar alCerrar={jest.fn()} motor={crearMotorFalso().motor} />
      </>,
      f.nube,
    );

    await escribir(TACOS_Y_COCA);
    await escribir(TACOS_EN_EFECTIVO);
    // Dirección B: la corrección es la tarjeta «Listo, lo corregí.»; el lector oye la frase entera.
    expect(within(screen.getByTestId('pantalla-hoy')).getByText('Listo, lo corregí.')).toBeTruthy();
    expect(fraseRegistro()).toMatch(oidaDesde('Corregí: Tacos $80'));
    expect(propios(enviados).filter(([nombre]) => nombre === 'correccion')).toEqual([
      ['correccion', { campo: 'cuenta' }],
    ]);

    const jsonCorreccion = JSON.stringify(propios(enviados).filter(([nombre]) => nombre === 'correccion'));
    expect(jsonCorreccion).not.toContain('tacos');
    expect(jsonCorreccion).not.toContain('Nu');
    expect(jsonCorreccion).not.toMatch(/\d/);
    p.cerrar();
  });

  it('aplicarEleccion con enlace emite correccion {campo: cuenta} (mismo camino que "Guardar" en elegir)', () => {
    const p = prepararAnalitica();
    const enviados: EnvioAnalitica[] = [];
    const analitica = crearAnalitica({
      transporte: async (e) => {
        enviados.push(e);
      },
      aleatorio: (n) => new Uint8Array(randomBytes(n)),
      bancosPermitidos: new Set(),
    });
    renderConSesion(
      p.ctx,
      <ProveedorAnalitica analitica={analitica}>
        <EnlaceAnaliticaCorreccion />
      </ProveedorAnalitica>,
    );
    const nu = p.e.cuentas.nu as string;
    const efectivo = p.e.cuentas.efectivo as string;
    const r = registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      monto: 8_000,
      categoria: 'comida_fuera',
      origenId: nu,
      descripcion: 'tacos',
    });
    const res = aplicarEleccion(
      p.ctx,
      { accion: 'corregir', transaccionId: r.transaccionId, cambios: { origenId: efectivo } },
      'texto',
    );
    expect(res.resultado).toBe('corregido');
    expect(propios(enviados)).toEqual([['correccion', { campo: 'cuenta' }]]);
    const tacos = listarMovimientos(p.ctx)
      .flatMap((d) => d.movimientos)
      .find((m) => m.descripcion === 'tacos');
    expect(tacos?.saleDe).toContain('Cartera');
    p.cerrar();
  });
});
