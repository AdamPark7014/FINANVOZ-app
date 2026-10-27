import { describe, expect, it } from 'vitest';
import { razonContraste } from './contraste';
import { colores, OBJETIVO_TACTIL_MIN, type Colores } from './tokens';

const AA = 4.5;
const pares: [keyof Colores, keyof Colores][] = [
  ['texto', 'fondo'],
  ['texto', 'superficie'],
  ['texto', 'superficieAlterna'],
  ['textoSecundario', 'fondo'],
  ['textoSecundario', 'superficie'],
  ['sobreAcento', 'acento'],
  ['acentoTexto', 'fondo'],
  ['acentoTexto', 'superficie'],
  ['faltante', 'fondo'],
  ['faltante', 'superficie'],
  ['sobreAviso', 'aviso'],
  ['avisoAccion', 'aviso'],
  // M13: texto sobre chips elegidos, tarjetas presionadas y superficies elevadas.
  ['textoSecundario', 'superficieAlterna'],
  ['acentoTexto', 'superficieAlterna'],
  ['faltante', 'superficieAlterna'],
  // Dirección B: dock de voz, selector de arriba y la frase por revisar.
  ['sobreDock', 'dock'],
  ['sobreDock', 'dockBoton'],
  ['sobreMicrofono', 'microfono'],
  ['texto', 'segmentoActivo'],
  ['textoSecundario', 'segmento'],
  ['texto', 'iconoFondo'],
  ['sobreAtencion', 'atencion'],
];

/**
 * WCAG 1.4.11 (contraste de componentes y gráficos, ≥ 3:1), pase de M13: lo que identifica un control o su
 * estado contra lo que tiene alrededor. Los bordes de tarjetas (`borde`) son decorativos y no entran.
 */
const NO_TEXTO = 3;
const paresControles: [keyof Colores, keyof Colores, string][] = [
  ['acento', 'fondo', 'botón primario e interruptor encendido sobre la pantalla'],
  ['acento', 'superficie', 'botón primario e interruptor encendido sobre una tarjeta'],
  ['acentoTexto', 'fondo', 'borde del botón secundario y de la opción elegida'],
  ['acentoTexto', 'superficie', 'borde del botón secundario sobre una tarjeta'],
  ['acentoTexto', 'superficieAlterna', 'borde de la opción elegida sobre su relleno'],
  ['bordeControl', 'fondo', 'campo, interruptor apagado y opción sin elegir'],
  ['bordeControl', 'superficie', 'campo, interruptor apagado y opción sin elegir sobre una tarjeta'],
  ['bordeControl', 'superficieAlterna', 'interruptor apagado sobre una tarjeta presionada'],
  ['foco', 'fondo', 'anillo de foco'],
  ['foco', 'superficie', 'anillo de foco sobre una tarjeta'],
  ['acento', 'superficieAlterna', 'lo lleno de una barra contra su fondo'],
  ['texto', 'superficieAlterna', 'marca del 30 % de una barra'],
  ['microfono', 'dock', 'el micrófono contra el dock de voz'],
  ['acento', 'iconoFondo', 'el ícono de categoría sobre su cuadro'],
  ['acento', 'segmento', 'el círculo de Tú elegido sobre el riel'],
];

describe.each(['claro', 'oscuro'] as const)('contraste AA en modo %s (RNF-08)', (esquema) => {
  it.each(pares)('%s sobre %s ≥ 4.5', (frente, fondo) => {
    const c = colores[esquema];
    expect(razonContraste(c[frente], c[fondo])).toBeGreaterThanOrEqual(AA);
  });

  it.each(paresControles)('%s contra %s ≥ 3 (%s)', (frente, fondo) => {
    const c = colores[esquema];
    expect(razonContraste(c[frente], c[fondo])).toBeGreaterThanOrEqual(NO_TEXTO);
  });

  it('cada color es #RRGGBB (salvo el velo) y ningún token queda sin probar contra su fondo', () => {
    const c = colores[esquema];
    for (const [k, v] of Object.entries(c)) {
      if (k === 'velo') continue;
      expect(v).toMatch(/^#[0-9A-F]{6}$/i);
    }
    const probados = new Set([...pares.flat(), ...paresControles.flatMap(([a, b]) => [a, b])]);
    // Exentos: deshabilitado (WCAG 1.4.3 excluye controles inactivos), el borde decorativo y el velo.
    const exentos = new Set(['textoDeshabilitado', 'borde', 'velo']);
    expect(Object.keys(c).filter((k) => !probados.has(k as keyof Colores) && !exentos.has(k))).toEqual([]);
  });

  it('el borde decorativo de tarjetas se distingue del fondo (≥ 1.5; no identifica controles)', () => {
    const c = colores[esquema];
    expect(razonContraste(c.borde, c.superficie)).toBeGreaterThanOrEqual(1.5);
  });
});

it('objetivo táctil mínimo de 48 dp', () => {
  expect(OBJETIVO_TACTIL_MIN).toBeGreaterThanOrEqual(48);
});
