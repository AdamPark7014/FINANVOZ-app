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
];

describe.each(['claro', 'oscuro'] as const)('contraste AA en modo %s (RNF-08)', (esquema) => {
  it.each(pares)('%s sobre %s ≥ 4.5', (frente, fondo) => {
    const c = colores[esquema];
    expect(razonContraste(c[frente], c[fondo])).toBeGreaterThanOrEqual(AA);
  });

  it('el borde de controles se distingue del fondo (≥ 3:1 no aplica a decorativos; ≥ 1.5)', () => {
    const c = colores[esquema];
    expect(razonContraste(c.borde, c.superficie)).toBeGreaterThanOrEqual(1.5);
  });
});

it('objetivo táctil mínimo de 48 dp', () => {
  expect(OBJETIVO_TACTIL_MIN).toBeGreaterThanOrEqual(48);
});
