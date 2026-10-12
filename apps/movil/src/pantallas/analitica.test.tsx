import { randomBytes } from 'node:crypto';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { crearAnalitica, type EnvioAnalitica } from '../analitica/cliente';
import { fijarEstadisticas, type Contexto } from '../servicios';
import { ProveedorAnalitica } from '../sesion/ProveedorAnalitica';
import { ProveedorSesion } from '../sesion/ProveedorSesion';
import { PantallaArqueo } from './arqueo/PantallaArqueo';
import { crearMotorFalso } from './principal/__pruebas__/arnes';
import { conEscenario } from './principal/__pruebas__/base';
import { PantallaRegistrar } from './principal/PantallaRegistrar';
import { ProveedorAvisos } from './principal/ProveedorAvisos';

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

/** Propiedades del evento sin las técnicas fijas (`$lib`, `$geoip_disable`…). */
const propiasDe = (enviados: EnvioAnalitica[]) =>
  enviados.map((e) => Object.entries(e.propiedades).filter(([k]) => !k.startsWith('$')));

const registrar = (frase: string) => {
  fireEvent.changeText(screen.getByTestId('campo-registrar'), frase);
  fireEvent.press(screen.getByTestId('boton-enviar-registro'));
};

describe('analítica en pantallas (03 §8, RNF-05)', () => {
  it('sin el opt-in, registrar y arquear no envían nada', () => {
    const p = conEscenario('e4-01');
    const enviados = conAnalitica(
      p.ctx,
      <PantallaRegistrar alCerrar={jest.fn()} motor={crearMotorFalso().motor} />,
    );
    registrar('coca 25 en efectivo');
    expect(screen.getByTestId('aviso')).toBeTruthy();
    expect(enviados).toEqual([]);
    p.cerrar();
  });

  it('con el opt-in, registrar envía solo origen, nivel, si preguntó, latencia y espacio', () => {
    const p = conEscenario('e4-01');
    fijarEstadisticas(p.ctx, true);
    const enviados = conAnalitica(
      p.ctx,
      <PantallaRegistrar alCerrar={jest.fn()} motor={crearMotorFalso().motor} />,
    );
    registrar('coca 25 en efectivo');
    registrar('renta 6000 en efectivo');
    fireEvent.press(screen.getByTestId('boton-guardar-confirmacion'));
    expect(enviados.map((e) => [e.evento, e.propiedades])).toEqual([
      [
        'movimiento_registrado',
        expect.objectContaining({
          origen: 'texto',
          nivel_interprete: 'reglas',
          pregunto: false,
          latencia_bucket: '<1s',
          espacio: 'personal',
        }),
      ],
      [
        'movimiento_registrado',
        expect.objectContaining({ origen: 'texto', nivel_interprete: 'reglas', pregunto: true }),
      ],
    ]);
    expect(enviados[1]?.propiedades).not.toHaveProperty('latencia_bucket');
    const json = JSON.stringify(propiasDe(enviados)).toLowerCase();
    for (const prohibido of ['coca', 'renta', '25', '6000', '6,000', 'efectivo', 'cartera', '$']) {
      expect(json).not.toContain(prohibido);
    }
    p.cerrar();
  });

  it('el arqueo envía solo el tipo de resultado', () => {
    const p = conEscenario('e4-01');
    fijarEstadisticas(p.ctx, true);
    const enviados = conAnalitica(p.ctx, <PantallaArqueo alCerrar={jest.fn()} />);
    fireEvent.press(screen.getByTestId('arqueo-otra'));
    fireEvent.changeText(screen.getByTestId('arqueo-monto'), '700');
    fireEvent.press(screen.getByTestId('arqueo-calcular'));
    fireEvent.press(screen.getByTestId('arqueo-sobrante-no_se'));
    expect(enviados.map((e) => e.evento)).toEqual(['arqueo']);
    expect(enviados[0]?.propiedades).toMatchObject({ resultado: 'sobrante' });
    expect(JSON.stringify(propiasDe(enviados))).not.toMatch(/700|640|\$/);
    p.cerrar();
  });
});
