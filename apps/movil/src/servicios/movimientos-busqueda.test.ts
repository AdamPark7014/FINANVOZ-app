import { describe, expect, it } from 'vitest';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import { listarMovimientos, normalizarBusqueda } from './movimientos';
import { cargarEscenario } from './semilla';
import { registrarTextoLocal } from './registrar';
import { abrirPrueba, escenario } from './__pruebas__/base';

/** «Buscar» del dock de Movimientos (dirección B, `02 §2`): texto en lo que se ve del movimiento. */
describe('búsqueda en Movimientos', () => {
  function conGastos() {
    const p = abrirPrueba();
    cargarEscenario(p.ctx, escenario('e4-01'));
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    registrarTextoLocal(p.ctx, 'coca 25 en efectivo', 'texto');
    registrarTextoLocal(p.ctx, 'tacos 180 en efectivo', 'texto');
    return p;
  }
  const descripciones = (dias: ReturnType<typeof listarMovimientos>) =>
    dias.flatMap((d) => d.movimientos).map((m) => m.descripcion);

  it('normaliza sin acentos, mayúsculas ni espacios de más', () => {
    expect(normalizarBusqueda('  Comída   FUERA ')).toBe('comida fuera');
  });

  it('encuentra por descripción, categoría o cuenta (el efectivo de e4-01 se llama Cartera); sin coincidencias no devuelve nada', () => {
    const p = conGastos();
    expect(descripciones(listarMovimientos(p.ctx, { texto: 'COCA' }))).toEqual(['coca']);
    expect(descripciones(listarMovimientos(p.ctx, { texto: 'comida' }))).toEqual(['tacos']);
    expect(descripciones(listarMovimientos(p.ctx, { texto: 'cartera' })).sort()).toEqual(['coca', 'tacos']);
    expect(listarMovimientos(p.ctx, { texto: 'zapatos' })).toEqual([]);
  });

  it('solo dígitos también busca en el monto en pesos; vacío no filtra', () => {
    const p = conGastos();
    expect(descripciones(listarMovimientos(p.ctx, { texto: '180' }))).toEqual(['tacos']);
    expect(descripciones(listarMovimientos(p.ctx, { texto: ' ' })).sort()).toEqual(
      descripciones(listarMovimientos(p.ctx)).sort(),
    );
  });

  it('cada movimiento trae el slug de su categoría para el ícono', () => {
    const p = conGastos();
    const [coca] = listarMovimientos(p.ctx, { texto: 'coca' }).flatMap((d) => d.movimientos);
    expect(coca?.categoriaSlug).toBe('antojos');
  });
});
