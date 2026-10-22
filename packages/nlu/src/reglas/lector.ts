import { SEP, type Tokens } from './tokens';

/**
 * Cursor sobre los tokens con marcas para retroceder. Cada producción del nivel 0 avanza el cursor y, si al final
 * no consumió toda la frase, no está segura y devuelve `null`.
 */
export class Lector {
  pos = 0;

  constructor(readonly tokens: Tokens) {}

  get t(): readonly string[] {
    return this.tokens.t;
  }

  get fin(): boolean {
    return this.pos >= this.t.length;
  }

  get largo(): number {
    return this.t.length;
  }

  ver(k = 0): string | undefined {
    return this.t[this.pos + k];
  }

  marca(): number {
    return this.pos;
  }

  volver(marca: number): void {
    this.pos = marca;
  }

  /** Consume una palabra si es alguna de las opciones. */
  palabra(...opciones: readonly string[]): boolean {
    const actual = this.ver();
    if (actual === undefined || !opciones.includes(actual)) return false;
    this.pos++;
    return true;
  }

  /** Consume la secuencia completa o nada. */
  secuencia(...palabras: readonly string[]): boolean {
    if (!palabras.every((p, k) => this.t[this.pos + k] === p)) return false;
    this.pos += palabras.length;
    return true;
  }

  /** Consume la primera secuencia que coincida (se prueban en el orden dado: poner las largas primero). */
  alguna(...secuencias: readonly (readonly string[])[]): boolean {
    return secuencias.some((s) => this.secuencia(...s));
  }

  /** Consume un separador (coma) si lo hay. */
  sep(): boolean {
    return this.palabra(SEP);
  }

  /** Original en minúsculas (con acentos) de `[inicio, fin)`. */
  original(inicio: number, fin: number): string {
    return this.tokens.o.slice(inicio, fin).join(' ');
  }

  /** Texto crudo (con mayúsculas) de una posición. */
  crudo(i: number): string {
    return this.tokens.c[i] ?? '';
  }
}
