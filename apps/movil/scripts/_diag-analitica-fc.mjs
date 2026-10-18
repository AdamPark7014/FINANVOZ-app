import fc from 'fast-check';
import { validarEvento, EVENTOS_PERMITIDOS, PROPIEDADES_TECNICAS } from '../src/analitica/eventos.ts';
import { aleatorioNode } from '../src/db/node.ts';
import { abrirPrueba } from '../src/servicios/__pruebas__/base.ts';
import { aceptarConsentimiento } from '../src/privacidad/consentimiento.ts';
import { crearAnalitica } from '../src/analitica/cliente.ts';

const BANCOS = new Set(['bbva', 'nu']);
const SENSIBLES = [
  '$1,234.56', '1234.56', '150000', '109990', '25 pesos', 'OXXO', 'WALMART',
  '5512345678', 'maria.lopez@gmail.com',
];

const nombres = [...Object.keys(EVENTOS_PERMITIDOS), 'otro', 'texto'];
const claves = [
  ...new Set(Object.values(EVENTOS_PERMITIDOS).flatMap((e) => Object.keys(e.shape))),
  'monto', 'comercio', 'alias', 'texto', 'nombre', 'rfc',
];
const valor = fc.oneof(
  fc.constantFrom(...SENSIBLES),
  fc.string(),
  fc.integer(),
  fc.double(),
  fc.boolean(),
  fc.constantFrom(
    'voz', 'texto', 'personal', 'faltante', 'bbva', 'msi', 'reglas', '<1s', 3,
    'aceptada', 'sin_red', 'agregado', 'quitado', 'explicacion', 'plantilla',
  ),
);

function correr(trials, full) {
  let zeroRuns = 0;
  let propFail = 0;
  for (let t = 0; t < trials; t++) {
    const p = abrirPrueba();
    aceptarConsentimiento(p.ctx, { datosFinancieros: true, estadisticas: true });
    const enviados = [];
    const analitica = crearAnalitica({
      transporte: (e) => {
        enviados.push(e);
        return Promise.resolve();
      },
      aleatorio: aleatorioNode,
      bancosPermitidos: BANCOS,
    });
    try {
      fc.assert(
        fc.property(
          fc.constantFrom(...nombres),
          fc.dictionary(fc.constantFrom(...claves), valor),
          (nombre, propiedades) => {
            const antes = enviados.length;
            analitica.registrar(p.ctx, { nombre, propiedades });
            for (const enviado of enviados.slice(antes)) {
              const forma = EVENTOS_PERMITIDOS[enviado.evento];
              if (!forma) throw new Error('forma');
              const permitidas = new Set([...Object.keys(forma.shape), ...Object.keys(PROPIEDADES_TECNICAS)]);
              for (const k of Object.keys(enviado.propiedades)) {
                if (!permitidas.has(k)) throw new Error('k');
              }
              const json = JSON.stringify(enviado).toLowerCase();
              for (const s of SENSIBLES) {
                if (json.includes(s.toLowerCase())) throw new Error(`sensible:${s}`);
              }
              for (const [k, v] of Object.entries(enviado.propiedades)) {
                if (typeof v === 'number') {
                  if (Math.abs(v) > (k === 'version' ? 999 : 40)) throw new Error('num');
                }
                if (typeof v === 'string' && /\d{3,}|\$/.test(v)) throw new Error('str');
              }
            }
          },
        ),
        { numRuns: 500 },
      );
    } catch {
      propFail++;
    }
    if (enviados.length === 0) zeroRuns++;
    p.base.cerrar();
  }
  return { trials, zeroRuns, zeroPct: (100 * zeroRuns) / trials, propFail };
}

console.log('validacion sola:', correr(500, false));
console.log('full cliente:', correr(500, true));
