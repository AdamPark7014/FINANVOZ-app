import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';
import { hoyMexico, sumarDias } from '../util/fecha';
import type { FilaActividad } from './actividadTexto';
import { crearCapaDemo } from './demo';

export type { FilaActividad } from './actividadTexto';

export type Rol = 'dueno' | 'vendedor';

export interface SesionAdmin {
  usuarioId: string;
  correo: string;
  nombre: string;
  rol: Rol;
}

export interface ResumenMes {
  mes: string;
  ingreso_cobrado_centavos: number;
  ingreso_plus_centavos: number;
  ingreso_licencias_centavos: number;
  por_cobrar_centavos: number;
  ventas: number;
  prospectos_por_etapa: Record<string, number>;
  tasa_cierre: number;
  prospectos_abiertos: number;
  plus_activos: number;
  usuarios_activos_7d: number;
}

export interface Prospecto {
  id: string;
  nombre: string;
  contacto: string;
  telefono: string;
  correo: string;
  origen: string;
  interes: string;
  etapa: string;
  motivo_perdida: string | null;
  vendedor_id: string;
  siguiente_paso: string;
  siguiente_paso_en: string | null;
  cliente_id: string | null;
}

export interface Cliente {
  id: string;
  nombre: string;
  rfc: string | null;
  tipo: string;
  contacto: string;
  telefono: string;
  correo: string;
  vendedor_id: string;
  notas: string;
}

export interface Venta {
  id: string;
  folio: string;
  cliente_id: string;
  vendedor_id: string;
  producto: string;
  cantidad: number;
  meses: number;
  precio_unitario_centavos: number;
  total_centavos: number;
  estado: string;
  vence_en: string | null;
  pagada_en: string | null;
  cancelada_motivo: string | null;
  creado_en: string;
  cliente_nombre: string;
  vendedor_nombre: string;
}

export interface Miembro {
  usuario_id: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  meta_mensual_centavos: number;
  comision_pb: number | null;
}

export interface ComisionMes {
  mes: string;
  vendedor_id: string;
  vendedor_nombre: string;
  vendido_centavos: number;
  cobrado_centavos: number;
  por_cobrar_centavos: number;
  comision_centavos: number;
  meta_mensual_centavos: number;
}

export interface Parametro {
  clave: string;
  valor: unknown;
}

export type ResultadoDatos<T> =
  { ok: true; datos: T } | { ok: false; error: string; codigo?: 'sin_permiso' | 'red' | 'otro' };

export interface CapaDatos {
  iniciarSesion(correo: string, contrasena: string): Promise<ResultadoDatos<SesionAdmin>>;
  cerrarSesion(): Promise<void>;
  sesionActual(): Promise<ResultadoDatos<SesionAdmin | null>>;
  resumen(mes: string): Promise<ResultadoDatos<ResumenMes>>;
  listarProspectos(): Promise<ResultadoDatos<Prospecto[]>>;
  crearProspecto(
    p: Pick<
      Prospecto,
      | 'nombre'
      | 'telefono'
      | 'correo'
      | 'origen'
      | 'interes'
      | 'siguiente_paso'
      | 'siguiente_paso_en'
      | 'vendedor_id'
    >,
  ): Promise<ResultadoDatos<Prospecto>>;
  actualizarEtapaProspecto(id: string, etapa: string, motivo?: string): Promise<ResultadoDatos<Prospecto>>;
  convertirProspectoEnCliente(
    id: string,
  ): Promise<ResultadoDatos<{ cliente: Cliente; prospecto: Prospecto }>>;
  listarClientes(q?: string): Promise<ResultadoDatos<Cliente[]>>;
  crearCliente(c: Omit<Cliente, 'id'>): Promise<ResultadoDatos<Cliente>>;
  ventasDeCliente(clienteId: string): Promise<ResultadoDatos<Venta[]>>;
  listarVentas(estado?: string): Promise<ResultadoDatos<Venta[]>>;
  registrarVenta(input: {
    cliente_id: string;
    vendedor_id: string;
    producto: string;
    cantidad: number;
    meses: number;
    precio_unitario_centavos?: number | null;
    vence_en?: string | null;
  }): Promise<ResultadoDatos<Venta>>;
  marcarVentaPagada(id: string): Promise<ResultadoDatos<Venta>>;
  cancelarVenta(id: string, motivo: string): Promise<ResultadoDatos<Venta>>;
  comisiones(mes: string): Promise<ResultadoDatos<ComisionMes[]>>;
  listarMiembros(): Promise<ResultadoDatos<Miembro[]>>;
  guardarMiembro(
    m: Partial<Miembro> & { usuario_id: string; nombre: string; rol: Rol },
  ): Promise<ResultadoDatos<Miembro>>;
  listarParametros(): Promise<ResultadoDatos<Parametro[]>>;
  guardarParametro(clave: string, valor: unknown): Promise<ResultadoDatos<Parametro>>;
  parametrosPrecio(): Promise<ResultadoDatos<Record<string, number>>>;
  pendientesHoy(): Promise<ResultadoDatos<{ ventasPorVencer: Venta[]; pasosVencidos: Prospecto[] }>>;
  ultimasVentas(limite?: number): Promise<ResultadoDatos<Venta[]>>;
  listarActividad(opts?: {
    /** Solo estas tablas (vacío o ausente = todas). */
    tablas?: string[];
    antesDe?: number;
    limite?: number;
  }): Promise<ResultadoDatos<FilaActividad[]>>;
}

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v);
  return 0;
}

function mapVenta(r: Record<string, unknown>): Venta {
  return {
    id: String(r.id),
    folio: String(r.folio),
    cliente_id: String(r.cliente_id),
    vendedor_id: String(r.vendedor_id),
    producto: String(r.producto),
    cantidad: num(r.cantidad),
    meses: num(r.meses),
    precio_unitario_centavos: num(r.precio_unitario_centavos),
    total_centavos: num(r.total_centavos),
    estado: String(r.estado),
    vence_en: (r.vence_en as string | null) ?? null,
    pagada_en: (r.pagada_en as string | null) ?? null,
    cancelada_motivo: (r.cancelada_motivo as string | null) ?? null,
    creado_en: String(r.creado_en),
    cliente_nombre: nombreDe(r.cliente),
    vendedor_nombre: nombreDe(r.vendedor),
  };
}

function nombreDe(v: unknown): string {
  if (v && typeof v === 'object' && 'nombre' in v) return String((v as { nombre: unknown }).nombre ?? '');
  return '';
}

/** Ventas con el nombre del cliente y del vendedor (PostgREST resuelve las llaves foráneas). */
const SELECT_VENTA = '*, cliente:admin_clientes(nombre), vendedor:admin_miembros(nombre)';

/** Escapa comodines de `ilike` y separadores de filtros de PostgREST en una búsqueda escrita. */
export function textoBusqueda(q: string): string {
  return q.trim().replace(/[%_\\,()]/g, (c) => `\\${c}`);
}

export function crearCapaDatos(cliente?: SupabaseClient): CapaDatos {
  const sb =
    cliente ??
    createClient(SUPABASE_URL || 'http://localhost', SUPABASE_ANON_KEY || 'anon', {
      auth: { persistSession: true, autoRefreshToken: true },
    });

  async function miembroDeUsuario(usuarioId: string): Promise<SesionAdmin | null> {
    const { data, error } = await sb
      .from('admin_miembros')
      .select('usuario_id, nombre, rol, activo')
      .eq('usuario_id', usuarioId)
      .maybeSingle();
    if (error || !data || !data.activo) return null;
    const { data: user } = await sb.auth.getUser();
    return {
      usuarioId: data.usuario_id as string,
      correo: user.user?.email ?? '',
      nombre: data.nombre as string,
      rol: data.rol as Rol,
    };
  }

  return {
    async iniciarSesion(correo, contrasena) {
      const { data, error } = await sb.auth.signInWithPassword({ email: correo, password: contrasena });
      if (error || !data.user)
        return { ok: false, error: 'No se pudo entrar. Revisa correo y contraseña.', codigo: 'otro' };
      const sesion = await miembroDeUsuario(data.user.id);
      if (!sesion) {
        await sb.auth.signOut();
        return { ok: false, error: 'Tu cuenta no tiene acceso al panel.', codigo: 'sin_permiso' };
      }
      return { ok: true, datos: sesion };
    },

    async cerrarSesion() {
      await sb.auth.signOut();
    },

    async sesionActual() {
      const { data } = await sb.auth.getSession();
      if (!data.session?.user) return { ok: true, datos: null };
      const sesion = await miembroDeUsuario(data.session.user.id);
      if (!sesion) return { ok: true, datos: null };
      return { ok: true, datos: sesion };
    },

    async resumen(mes) {
      const { data, error } = await sb.rpc('admin_resumen', { p_mes: mes });
      if (error) return { ok: false, error: 'No se pudo cargar el resumen.', codigo: 'red' };
      if (data === null)
        return { ok: false, error: 'Sin permiso para ver el resumen.', codigo: 'sin_permiso' };
      const r = data as Record<string, unknown>;
      return {
        ok: true,
        datos: {
          mes: String(r.mes),
          ingreso_cobrado_centavos: num(r.ingreso_cobrado_centavos),
          ingreso_plus_centavos: num(r.ingreso_plus_centavos),
          ingreso_licencias_centavos: num(r.ingreso_licencias_centavos),
          por_cobrar_centavos: num(r.por_cobrar_centavos),
          ventas: num(r.ventas),
          prospectos_por_etapa: (r.prospectos_por_etapa as Record<string, number>) ?? {},
          tasa_cierre: num(r.tasa_cierre),
          prospectos_abiertos: num(r.prospectos_abiertos),
          plus_activos: num(r.plus_activos),
          usuarios_activos_7d: num(r.usuarios_activos_7d),
        },
      };
    },

    async listarProspectos() {
      const { data, error } = await sb
        .from('admin_prospectos')
        .select('*')
        .order('creado_en', { ascending: false });
      if (error) return { ok: false, error: 'No se pudieron cargar los prospectos.', codigo: 'red' };
      return { ok: true, datos: (data ?? []) as Prospecto[] };
    },

    async crearProspecto(p) {
      const { data, error } = await sb.from('admin_prospectos').insert(p).select('*').single();
      if (error) return { ok: false, error: 'No se pudo guardar el prospecto.', codigo: 'otro' };
      return { ok: true, datos: data as Prospecto };
    },

    async actualizarEtapaProspecto(id, etapa, motivo) {
      const patch: Record<string, unknown> = { etapa };
      if (motivo !== undefined) patch.motivo_perdida = motivo;
      const { data, error } = await sb
        .from('admin_prospectos')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) return { ok: false, error: 'No se pudo cambiar la etapa.', codigo: 'otro' };
      return { ok: true, datos: data as Prospecto };
    },

    async convertirProspectoEnCliente(id) {
      // Atómico en la base: o se crean cliente y prospecto ganado, o nada.
      const { data, error } = await sb.rpc('admin_convertir_prospecto', { p_prospecto: id });
      if (error || !data) return { ok: false, error: 'No se pudo convertir en cliente.', codigo: 'otro' };
      const r = data as { cliente: Cliente; prospecto: Prospecto };
      return { ok: true, datos: { cliente: r.cliente, prospecto: r.prospecto } };
    },

    async listarClientes(q) {
      let query = sb.from('admin_clientes').select('*').order('nombre');
      if (q && q.trim()) query = query.ilike('nombre', `%${textoBusqueda(q)}%`);
      const { data, error } = await query;
      if (error) return { ok: false, error: 'No se pudieron cargar los clientes.', codigo: 'red' };
      return { ok: true, datos: (data ?? []) as Cliente[] };
    },

    async crearCliente(c) {
      const { data, error } = await sb
        .from('admin_clientes')
        .insert({ ...c, rfc: c.rfc ? c.rfc.trim().toUpperCase() : null })
        .select('*')
        .single();
      if (error) {
        const rfc = error.message.includes('rfc');
        return {
          ok: false,
          error: rfc ? 'El RFC no tiene el formato correcto.' : 'No se pudo guardar el cliente.',
          codigo: 'otro',
        };
      }
      return { ok: true, datos: data as Cliente };
    },

    async ventasDeCliente(clienteId) {
      const { data, error } = await sb
        .from('admin_ventas')
        .select(SELECT_VENTA)
        .eq('cliente_id', clienteId)
        .order('creado_en', { ascending: false });
      if (error) return { ok: false, error: 'No se pudieron cargar las ventas.', codigo: 'red' };
      return { ok: true, datos: (data ?? []).map((r) => mapVenta(r as Record<string, unknown>)) };
    },

    async listarVentas(estado) {
      let query = sb.from('admin_ventas').select(SELECT_VENTA).order('creado_en', { ascending: false });
      if (estado) query = query.eq('estado', estado);
      const { data, error } = await query;
      if (error) return { ok: false, error: 'No se pudieron cargar las ventas.', codigo: 'red' };
      return { ok: true, datos: (data ?? []).map((r) => mapVenta(r as Record<string, unknown>)) };
    },

    async registrarVenta(input) {
      const fila: Record<string, unknown> = {
        cliente_id: input.cliente_id,
        vendedor_id: input.vendedor_id,
        producto: input.producto,
        cantidad: input.cantidad,
        meses: input.meses,
        vence_en: input.vence_en ?? null,
      };
      if (input.precio_unitario_centavos != null)
        fila.precio_unitario_centavos = input.precio_unitario_centavos;
      const { data, error } = await sb.from('admin_ventas').insert(fila).select(SELECT_VENTA).single();
      if (error) return { ok: false, error: 'No se pudo registrar la venta.', codigo: 'otro' };
      return { ok: true, datos: mapVenta(data as Record<string, unknown>) };
    },

    async marcarVentaPagada(id) {
      const { data, error } = await sb
        .from('admin_ventas')
        // La base fija `pagada_en` con su propio reloj (no el del navegador).
        .update({ estado: 'pagada' })
        .eq('id', id)
        .select(SELECT_VENTA)
        .single();
      if (error) return { ok: false, error: 'No se pudo marcar como pagada.', codigo: 'otro' };
      return { ok: true, datos: mapVenta(data as Record<string, unknown>) };
    },

    async cancelarVenta(id, motivo) {
      const { data, error } = await sb
        .from('admin_ventas')
        .update({ estado: 'cancelada', cancelada_motivo: motivo })
        .eq('id', id)
        .select(SELECT_VENTA)
        .single();
      if (error) return { ok: false, error: 'No se pudo cancelar la venta.', codigo: 'otro' };
      return { ok: true, datos: mapVenta(data as Record<string, unknown>) };
    },

    async comisiones(mes) {
      const { data, error } = await sb.from('admin_comisiones_mes').select('*').eq('mes', mes);
      if (error) return { ok: false, error: 'No se pudieron cargar las comisiones.', codigo: 'red' };
      return {
        ok: true,
        datos: (data ?? []).map((r) => ({
          mes: String(r.mes),
          vendedor_id: String(r.vendedor_id),
          vendedor_nombre: String(r.vendedor_nombre),
          vendido_centavos: num(r.vendido_centavos),
          cobrado_centavos: num(r.cobrado_centavos),
          por_cobrar_centavos: num(r.por_cobrar_centavos),
          comision_centavos: num(r.comision_centavos),
          meta_mensual_centavos: num(r.meta_mensual_centavos),
        })),
      };
    },

    async listarMiembros() {
      const { data, error } = await sb.from('admin_miembros').select('*').order('creado_en');
      if (error) return { ok: false, error: 'No se pudieron cargar los vendedores.', codigo: 'red' };
      return { ok: true, datos: (data ?? []) as Miembro[] };
    },

    async guardarMiembro(m) {
      const { data, error } = await sb
        .from('admin_miembros')
        .upsert({
          usuario_id: m.usuario_id,
          nombre: m.nombre,
          rol: m.rol,
          activo: m.activo ?? true,
          meta_mensual_centavos: m.meta_mensual_centavos ?? 0,
          comision_pb: m.comision_pb ?? null,
        })
        .select('*')
        .single();
      if (error) return { ok: false, error: 'No se pudo guardar el miembro.', codigo: 'otro' };
      return { ok: true, datos: data as Miembro };
    },

    async listarParametros() {
      const { data, error } = await sb.from('admin_parametros').select('clave, valor').order('clave');
      if (error) return { ok: false, error: 'No se pudieron cargar los ajustes.', codigo: 'red' };
      return { ok: true, datos: (data ?? []) as Parametro[] };
    },

    async guardarParametro(clave, valor) {
      const { data, error } = await sb
        .from('admin_parametros')
        .update({ valor })
        .eq('clave', clave)
        .select('clave, valor')
        .single();
      if (error) return { ok: false, error: 'No se pudo guardar el parámetro.', codigo: 'otro' };
      return { ok: true, datos: data as Parametro };
    },

    async parametrosPrecio() {
      const r = await this.listarParametros();
      if (!r.ok) return r;
      const out: Record<string, number> = {};
      for (const p of r.datos) {
        if (typeof p.valor === 'number') out[p.clave] = p.valor;
      }
      return { ok: true, datos: out };
    },

    async pendientesHoy() {
      const hoy = hoyMexico();
      const ventas = await sb
        .from('admin_ventas')
        .select(SELECT_VENTA)
        .eq('estado', 'por_cobrar')
        // Vencidas y las que vencen en la próxima semana: da tiempo de cobrar.
        .lte('vence_en', sumarDias(hoy, 7))
        .order('vence_en');
      const pasos = await sb
        .from('admin_prospectos')
        .select('*')
        .not('etapa', 'in', '(ganado,perdido)')
        .lte('siguiente_paso_en', hoy)
        .order('siguiente_paso_en');
      if (ventas.error || pasos.error)
        return { ok: false, error: 'No se pudo cargar lo pendiente.', codigo: 'red' };
      return {
        ok: true,
        datos: {
          ventasPorVencer: (ventas.data ?? []).map((r) => mapVenta(r as Record<string, unknown>)),
          pasosVencidos: (pasos.data ?? []) as Prospecto[],
        },
      };
    },

    async ultimasVentas(limite = 8) {
      const { data, error } = await sb
        .from('admin_ventas')
        .select(SELECT_VENTA)
        .order('creado_en', { ascending: false })
        .limit(limite);
      if (error) return { ok: false, error: 'No se pudieron cargar las ventas.', codigo: 'red' };
      return { ok: true, datos: (data ?? []).map((r) => mapVenta(r as Record<string, unknown>)) };
    },

    async listarActividad(opts = {}) {
      const limite = opts.limite ?? 50;
      let query = sb
        .from('admin_bitacora')
        .select('id, tabla, registro_id, accion, antes, despues, usuario_id, creado_en')
        .order('id', { ascending: false })
        .limit(limite);
      if (opts.tablas && opts.tablas.length > 0) query = query.in('tabla', opts.tablas);
      if (opts.antesDe != null) query = query.lt('id', opts.antesDe);
      const { data, error } = await query;
      if (error) {
        if (/permission|policy|row-level/i.test(error.message))
          return { ok: false, error: 'Sin permiso para ver la actividad.', codigo: 'sin_permiso' };
        return { ok: false, error: 'No se pudo cargar la actividad.', codigo: 'red' };
      }
      const filas = (data ?? []) as Array<{
        id: number;
        tabla: string;
        registro_id: string;
        accion: string;
        antes: Record<string, unknown> | null;
        despues: Record<string, unknown> | null;
        usuario_id: string | null;
        creado_en: string;
      }>;
      const ids = [...new Set(filas.map((f) => f.usuario_id).filter((id): id is string => Boolean(id)))];
      const nombres = new Map<string, string>();
      if (ids.length > 0) {
        const { data: miembros } = await sb
          .from('admin_miembros')
          .select('usuario_id, nombre')
          .in('usuario_id', ids);
        for (const m of miembros ?? []) {
          nombres.set(String(m.usuario_id), String(m.nombre ?? ''));
        }
      }
      // La bitácora guarda la venta tal cual (solo `cliente_id`): se agrega el nombre para la frase.
      const idsCliente = [
        ...new Set(
          filas
            .filter((f) => f.tabla === 'admin_ventas')
            .map((f) => String((f.despues ?? f.antes)?.cliente_id ?? ''))
            .filter(Boolean),
        ),
      ];
      if (idsCliente.length > 0) {
        const { data: cs } = await sb.from('admin_clientes').select('id, nombre').in('id', idsCliente);
        const porId = new Map((cs ?? []).map((c) => [String(c.id), String(c.nombre ?? '')]));
        for (const f of filas) {
          if (f.tabla !== 'admin_ventas' || !f.despues) continue;
          const nombre = porId.get(String(f.despues.cliente_id ?? ''));
          if (nombre) f.despues = { ...f.despues, cliente_nombre: nombre };
        }
      }
      return {
        ok: true,
        datos: filas.map((f) => ({
          id: Number(f.id),
          tabla: f.tabla,
          registro_id: f.registro_id,
          accion: f.accion as FilaActividad['accion'],
          antes: f.antes,
          despues: f.despues,
          usuario_id: f.usuario_id,
          usuario_nombre: f.usuario_id ? (nombres.get(f.usuario_id) ?? '') : '',
          creado_en: f.creado_en,
        })),
      };
    },
  };
}

/**
 * Modo de ejemplo: con `?demo` en la dirección, o en desarrollo sin Supabase configurado. Datos en memoria,
 * nada se guarda y el panel lo avisa arriba.
 */
export const MODO_DEMO =
  typeof window !== 'undefined' &&
  (new URLSearchParams(window.location.search).has('demo') || (import.meta.env.DEV && !SUPABASE_URL));

export const datos: CapaDatos = MODO_DEMO ? crearCapaDemo() : crearCapaDatos();
