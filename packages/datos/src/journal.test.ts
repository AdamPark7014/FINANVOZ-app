import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CARPETA_MIGRACIONES } from './__pruebas__/base';

interface EntradaJournal {
  readonly idx: number;
  readonly when: number;
  readonly tag: string;
}

const journal = JSON.parse(readFileSync(`${CARPETA_MIGRACIONES}/meta/_journal.json`, 'utf8')) as {
  entries: EntradaJournal[];
};

describe('journal de migraciones', () => {
  it('trae migraciones con idx consecutivo desde 0', () => {
    expect(journal.entries.length).toBeGreaterThan(0);
    expect(journal.entries.map((e) => e.idx)).toEqual(journal.entries.map((_, i) => i));
  });

  it('el `when` es estrictamente creciente (el migrador salta las que queden atrás)', () => {
    journal.entries.forEach((e, i) => {
      if (i > 0) expect(e.when, e.tag).toBeGreaterThan(journal.entries[i - 1]?.when ?? Infinity);
    });
  });

  it('cada entrada tiene su .sql numerado en orden y no hay .sql fuera del journal', () => {
    const tags = journal.entries.map((e) => e.tag);
    tags.forEach((tag, i) => expect(tag.startsWith(String(i + 1).padStart(4, '0') + '_'), tag).toBe(true));
    const archivos = readdirSync(CARPETA_MIGRACIONES)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => f.slice(0, -'.sql'.length))
      .sort();
    expect(archivos).toEqual([...tags].sort());
  });
});
