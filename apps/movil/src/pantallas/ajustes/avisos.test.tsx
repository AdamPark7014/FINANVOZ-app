import { render, screen, waitFor } from '@testing-library/react-native';
import { ProveedorSesion } from '../../sesion/ProveedorSesion';
import { notificacionesEnMemoria, ProveedorNotificaciones } from '../avisos/notificaciones';
import { conEscenario } from '../principal/__pruebas__/base';
import {
  AVISOS_APAGADOS_EN_TELEFONO,
  DESC_HORARIO_SILENCIOSO,
  ETIQUETA_BLOQUE_HORARIO_SILENCIOSO,
  ETIQUETA_HORARIO_SILENCIOSO,
  PISTA_GUARDAR_HORARIO,
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
    expect(screen.getByTestId('ajustes-guardar-horario')).toHaveProp(
      'accessibilityHint',
      PISTA_GUARDAR_HORARIO,
    );
    p.cerrar();
  });
});
