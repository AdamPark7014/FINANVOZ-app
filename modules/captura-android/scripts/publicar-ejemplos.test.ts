import { describe, expect, it } from 'vitest';
import {
  citar,
  comandoPublicar,
  etiquetasPorPaquete,
  leerEjemplos,
  partirArgumentosSh,
} from './publicar-ejemplos.mjs';

type Ejemplo = { id: string; paquete: string; titulo: string; texto: string };

/** Lo que vería `cmd` en el teléfono: el shell POSIX parte el comando en argumentos. */
function argumentosEnShell(comando: string): string[] {
  return partirArgumentosSh(comando);
}

describe('publicar-ejemplos (CA-M5-01 en build de depuración)', () => {
  it('cada ejemplo llega intacto a cmd notification post con la etiqueta de su banco', () => {
    const etiquetas = etiquetasPorPaquete() as Map<string, string>;
    const ejemplos = leerEjemplos() as Ejemplo[];
    expect(ejemplos.map((e) => e.id)).toEqual([
      'N-01', 'N-02', 'N-03', 'N-04', 'N-05', 'N-06', 'N-07', 'N-08', 'N-09', 'N-10', 'N-11', 'N-12',
    ]);
    for (const e of ejemplos) {
      const etiqueta = etiquetas.get(e.paquete);
      expect(etiqueta, e.id).toBeDefined();
      const args = argumentosEnShell(comandoPublicar(etiqueta ?? '', e.titulo, e.texto));
      expect(args).toEqual(['cmd', 'notification', 'post', '-S', 'bigtext', '-t', e.titulo, etiqueta, e.texto]);
    }
  });

  it('los ejemplos de negocio usan cobros_d', () => {
    const etiquetas = etiquetasPorPaquete() as Map<string, string>;
    const negocio = leerEjemplos(true) as Ejemplo[];
    expect(negocio.map((e) => etiquetas.get(e.paquete))).toEqual(['cobros_d', 'cobros_d']);
  });

  it('cita comillas simples, $ y signos de exclamación', () => {
    const raro = "it's $100 ¡ya! `x` \"y\"";
    expect(argumentosEnShell(citar(raro))).toEqual([raro]);
  });
});
