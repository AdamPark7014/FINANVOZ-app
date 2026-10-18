import { describe, expect, it } from 'vitest';
import { VERSION_CONSENTIMIENTO, compararVersionAviso, versionAvisoDesactualizada } from '../../privacidad/consentimiento';
import { VERSION_TERMINOS } from '../privacidad/legales';
import { AVISO_COMPLETO, AVISO_SIMPLIFICADO } from './aviso';

describe('aviso de privacidad (pendiente 84 · modo explicar)', () => {
  it('VERSION_CONSENTIMIENTO es posterior a 2026-10-m7 y desactualiza la versión anterior', () => {
    expect(VERSION_CONSENTIMIENTO).toMatch(/^\d{4}-\d{2}-m\d+$/);
    expect(compararVersionAviso('2026-10-m7', VERSION_CONSENTIMIENTO)).toBeLessThan(0);
    expect(versionAvisoDesactualizada('2026-10-m7')).toBe(true);
    expect(versionAvisoDesactualizada(VERSION_CONSENTIMIENTO)).toBe(false);
  });

  it('el aviso simplificado menciona preguntas abiertas, datos agregados y el proveedor de IA', () => {
    const texto = AVISO_SIMPLIFICADO.join(' ');
    expect(texto).toMatch(/preguntas abiertas/i);
    expect(texto).toMatch(/agregad/i);
    expect(texto).toMatch(/montos formateados/i);
    expect(texto).toMatch(/nombres cortos/i);
    expect(texto).toMatch(/proveedor de inteligencia artificial/i);
    expect(texto).toMatch(/no enviamos tu libro completo/i);
  });

  it('el aviso completo describe la pregunta y los resultados agregados en datos, finalidades y encargados', () => {
    const datos = AVISO_COMPLETO.find((s) => s.titulo === 'Qué datos tratamos');
    const finalidades = AVISO_COMPLETO.find((s) => s.titulo === 'Para qué los usamos');
    const encargados = AVISO_COMPLETO.find((s) => s.titulo === 'Quién más los trata');
    expect(datos?.parrafos.some((p) => /preguntas abiertas/i.test(p))).toBe(true);
    expect(datos?.parrafos.some((p) => /agregad/i.test(p) && /montos formateados/i.test(p))).toBe(true);
    expect(finalidades?.parrafos.some((p) => /preguntas abiertas/i.test(p))).toBe(true);
    expect(encargados?.parrafos.some((p) => /resultados agregados/i.test(p))).toBe(true);
  });

  it('los términos suben de versión con el aviso y mencinan el modo explicar', () => {
    expect(compararVersionAviso('2026-10-m7', VERSION_TERMINOS)).toBeLessThan(0);
    expect(VERSION_TERMINOS).toBe(VERSION_CONSENTIMIENTO);
  });
});
