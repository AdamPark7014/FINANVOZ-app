import { describe, expect, it } from 'vitest';
import { usuarioDeToken } from './token';

const b64url = (o: unknown) =>
  Buffer.from(JSON.stringify(o))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

describe('usuarioDeToken', () => {
  it('lee el sub uuid del JWT de la sesión anónima', () => {
    const jwt = `${b64url({ alg: 'HS256' })}.${b64url({ sub: '0A000000-0000-4000-8000-00000000ABCD', role: 'authenticated' })}.firma`;
    expect(usuarioDeToken(jwt)).toBe('0a000000-0000-4000-8000-00000000abcd');
  });

  it('cualquier otra cosa: null', () => {
    expect(usuarioDeToken('')).toBeNull();
    expect(usuarioDeToken('a.b.c')).toBeNull();
    expect(usuarioDeToken(`x.${b64url({ sub: 'no-uuid' })}.y`)).toBeNull();
    expect(usuarioDeToken(`x.${b64url({})}.y`)).toBeNull();
  });
});
