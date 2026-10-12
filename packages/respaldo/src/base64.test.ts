import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { aBase64, deBase64 } from './base64';

describe('base64', () => {
  it('coincide con Buffer y va y vuelve', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 64 }), (bytes) => {
        const texto = aBase64(bytes);
        expect(texto).toBe(Buffer.from(bytes).toString('base64'));
        expect(deBase64(texto)).toEqual(bytes);
      }),
    );
  });

  it('rechaza texto no canónico', () => {
    expect(deBase64('AAE')).toBeNull();
    expect(deBase64('AA=A')).toBeNull();
    expect(deBase64('AB==')).toBeNull();
    expect(deBase64('A*==')).toBeNull();
  });
});
