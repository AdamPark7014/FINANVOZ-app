import type { ClaimsSesion } from '../../nube/token';
import type { CuentaRespaldo, NubeRespaldo, RespaldoNube, RespaldoRemoto } from '../respaldo-nube';

/**
 * Nube de respaldo falsa para las pruebas de servicios: Auth con correo y código y el bucket `respaldos` con el
 * contrato de `services/proxy` (cada cuenta solo ve su prefijo, retención de 4, `sin_correo` con la sesión
 * anónima, borrar cuenta = archivos y usuario). Varios "teléfonos" comparten el mismo servidor.
 */
export function servidorRespaldoFalso() {
  /** correo → usuario */
  const cuentas = new Map<string, string>();
  /** usuario → nombre → { bytes, creadoEn } */
  const archivos = new Map<string, Map<string, { bytes: Uint8Array; creadoEn: string }>>();
  /** correo → código vigente */
  const codigos = new Map<string, string>();
  const subidos: Uint8Array[] = [];
  let siguienteUsuario = 1;
  let reloj = Date.UTC(2026, 9, 1, 15, 0, 0);
  let sinRed = false;
  const nuevoUsuario = () => `00000000-0000-4000-8000-${String(siguienteUsuario++).padStart(12, '0')}`;

  /** Un teléfono con su propia sesión (anónima al principio). */
  function telefono(): NubeRespaldo & {
    sesion(): { usuarioId: string; correo: string | null };
    caducarSesion(): void;
  } {
    let sesion: { usuarioId: string; correo: string | null } = { usuarioId: nuevoUsuario(), correo: null };
    const claims = (): ClaimsSesion => ({ ...sesion, conCorreo: sesion.correo !== null });
    const red = () => {
      if (sinRed) throw new TypeError('Network request failed');
    };
    const propios = () => {
      const u = sesion.correo === null ? null : sesion.usuarioId;
      if (u === null) return null;
      let m = archivos.get(u);
      if (!m) archivos.set(u, (m = new Map()));
      return m;
    };
    const lista = (m: Map<string, { bytes: Uint8Array; creadoEn: string }>): RespaldoRemoto[] =>
      [...m.entries()]
        .sort(([a], [b]) => (a < b ? 1 : -1))
        .map(([nombre, x]) => ({ nombre, tamano: x.bytes.length, creadoEn: x.creadoEn, version: 1 }));

    const cuenta: CuentaRespaldo = {
      async estado() {
        return claims();
      },
      async pedirCodigo(correo, opciones) {
        if (sinRed) return { ok: false, error: 'sin_red' };
        const c = correo.trim().toLowerCase();
        codigos.set(c, '123456');
        if (cuentas.has(c) || sesion.correo !== null) return { ok: true, modo: 'entrar' };
        if (opciones?.soloEntrar) return { ok: false, error: 'sin_cuenta' };
        return { ok: true, modo: 'vincular' };
      },
      async verificarCodigo(correo, codigo, modo) {
        const c = correo.trim().toLowerCase();
        if (codigos.get(c) !== codigo) return { ok: false, error: 'codigo_invalido' };
        codigos.delete(c);
        if (modo === 'vincular') {
          cuentas.set(c, sesion.usuarioId);
          sesion = { ...sesion, correo: c };
        } else {
          const u = cuentas.get(c);
          if (!u) return { ok: false, error: 'sin_cuenta' };
          sesion = { usuarioId: u, correo: c };
        }
        return { ok: true, ...claims() };
      },
      async olvidarSesion() {
        sesion = { usuarioId: nuevoUsuario(), correo: null };
      },
    };

    const respaldos: RespaldoNube = {
      async listar() {
        red();
        const m = propios();
        if (!m) return { ok: false, error: 'sin_correo' };
        // Retención (la poda del servidor): los 4 más recientes.
        for (const x of lista(m).slice(4)) m.delete(x.nombre);
        return { ok: true, respaldos: lista(m) };
      },
      async subir(bytes, version) {
        if (sinRed) return { ok: false, error: 'sin_red' };
        const m = propios();
        if (!m) return { ok: false, error: 'sin_correo' };
        reloj += 1000;
        const creadoEn = new Date(reloj).toISOString();
        const nombre = `${creadoEn.replace(/[-:]/g, '').replace(/\.\d{3}/, '')}-v${version}.cartera`;
        m.set(nombre, { bytes: bytes.slice(), creadoEn });
        subidos.push(bytes.slice());
        const l = await respaldos.listar();
        return l.ok ? { ok: true, nombre, respaldos: l.respaldos } : l;
      },
      async bajar(nombre) {
        if (sinRed) return { ok: false, error: 'sin_red' };
        const m = propios();
        if (!m) return { ok: false, error: 'sin_correo' };
        const x = m.get(nombre);
        return x ? { ok: true, bytes: x.bytes.slice() } : { ok: false, error: 'no_encontrado' };
      },
      async borrarCuenta() {
        if (sinRed) return { ok: false, error: 'sin_red' };
        const m = propios();
        if (!m) return { ok: false, error: 'sin_correo' };
        archivos.delete(sesion.usuarioId);
        for (const [c, u] of cuentas) if (u === sesion.usuarioId) cuentas.delete(c);
        return { ok: true };
      },
    };

    return {
      cuenta,
      respaldos,
      sesion: () => sesion,
      /** El refresh de la sesión de correo dejó de servir y `sesion.ts` creó un anónimo. */
      caducarSesion() {
        sesion = { usuarioId: nuevoUsuario(), correo: null };
      },
    };
  }

  return {
    telefono,
    /** Todo lo que se subió alguna vez (para buscar texto legible). */
    subidos,
    archivosDe: (usuario: string) => [...(archivos.get(usuario)?.keys() ?? [])],
    existeCuenta: (correo: string) => cuentas.has(correo),
    desconectar(v = true) {
      sinRed = v;
    },
  };
}
