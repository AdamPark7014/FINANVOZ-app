import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { obtenerPreferenciasAvisos } from '../../servicios';
import { ProveedorSesion } from '../../sesion/ProveedorSesion';
import { notificacionesEnMemoria, ProveedorNotificaciones } from '../avisos/notificaciones';
import { conEscenario } from '../principal/__pruebas__/base';
import {
  AVISOS_APAGADOS_EN_TELEFONO,
  DESC_HORARIO_SILENCIOSO,
  ETIQUETA_BLOQUE_HORARIO_SILENCIOSO,
  CONFIRMACION_HORARIO,
  ETIQUETA_HORARIO_SILENCIOSO,
  horaHablada,
  PISTA_PERMITIR_AVISOS,
  SECCION_AVISOS,
} from './avisos-textos';
import { SeccionAvisos } from './SeccionAvisos';

function montar(ctx: ReturnType<typeof conEscenario>['ctx'], permiso?: 'sin_preguntar' | 'concedido') {
  const n = permiso ? notificacionesEnMemoria(permiso) : notificacionesEnMemoria('concedido');
  render(
    <ProveedorNotificaciones notificaciones={n}>
      <ProveedorSesion ctx={ctx} nube={null}>
        <SeccionAvisos />
      </ProveedorSesion>
    </ProveedorNotificaciones>,
  );
  return n;
}

describe('SeccionAvisos (TalkBack)', () => {
  it('título de sección es encabezado', () => {
    const p = conEscenario('e4-01');
    montar(p.ctx);
    expect(screen.getByTestId('ajustes-avisos-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByText(SECCION_AVISOS)).toBeTruthy();
    p.cerrar();
  });

  it('sin permiso: alerta hablada y pista en Permitir avisos', async () => {
    const p = conEscenario('e4-01');
    montar(p.ctx, 'sin_preguntar');
    await waitFor(() => expect(screen.getByTestId('ajustes-avisos-sin-permiso')).toBeTruthy());
    expect(screen.getByTestId('ajustes-avisos-sin-permiso')).toHaveProp(
      'accessibilityLabel',
      expect.stringMatching(/^Aviso\./),
    );
    expect(screen.getByText(AVISOS_APAGADOS_EN_TELEFONO)).toBeTruthy();
    expect(screen.getByTestId('ajustes-avisos-permitir')).toHaveProp(
      'accessibilityHint',
      PISTA_PERMITIR_AVISOS,
    );
    p.cerrar();
  });

  it('horario silencioso: bloque hablado y descripción oculta al lector', () => {
    const p = conEscenario('e4-01');
    montar(p.ctx);
    expect(screen.getByTestId('ajustes-avisos-horario-titulo')).toHaveProp(
      'accessibilityLabel',
      ETIQUETA_BLOQUE_HORARIO_SILENCIOSO,
    );
    expect(screen.getByText(ETIQUETA_HORARIO_SILENCIOSO)).toBeTruthy();
    const desc = screen.getByTestId('ajustes-avisos-horario-desc', { includeHiddenElements: true });
    expect(desc.props.accessibilityElementsHidden).toBe(true);
    expect(desc).toHaveTextContent(DESC_HORARIO_SILENCIOSO);
    p.cerrar();
  });

  it('la hora de avisos y el horario silencioso se eligen con chips y se guardan al tocarlos', () => {
    const p = conEscenario('e4-01');
    montar(p.ctx);
    expect(screen.queryByTestId('ajustes-guardar-horario')).toBeNull();
    const ocho = screen.getByTestId('ajustes-aviso-hora-08:00');
    expect(ocho.props.accessibilityLabel).toBe('8 de la mañana');
    fireEvent.press(ocho);
    expect(obtenerPreferenciasAvisos(p.ctx).hora).toBe('08:00');
    expect(screen.getByTestId('ajustes-avisos-mensaje')).toHaveTextContent(CONFIRMACION_HORARIO);
    fireEvent.press(screen.getByTestId('ajustes-silencio-inicio-23:00'));
    fireEvent.press(screen.getByTestId('ajustes-silencio-fin-07:00'));
    expect(obtenerPreferenciasAvisos(p.ctx).silencio).toEqual({ inicio: '23:00', fin: '07:00' });
    expect(screen.getByTestId('ajustes-silencio-fin-07:00').props.accessibilityState).toMatchObject({
      selected: true,
    });
    p.cerrar();
  });
});

describe('horaHablada', () => {
  it('lee las horas como se dicen', () => {
    expect(horaHablada('09:00')).toBe('9 de la mañana');
    expect(horaHablada('12:00')).toBe('12 del día');
    expect(horaHablada('18:00')).toBe('6 de la tarde');
    expect(horaHablada('22:00')).toBe('10 de la noche');
    expect(horaHablada('00:00')).toBe('12 de la noche');
    expect(horaHablada('07:30')).toBe('7 y 30 de la mañana');
  });
});
