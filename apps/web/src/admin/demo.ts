// Capa de datos de ejemplo, en memoria: deja ver y probar el panel completo sin servidor (`/admin?demo`).
// Nada sale del navegador ni se guarda; el panel muestra un aviso mientras está activa.
import { diasEntre, hoyMexico, inicioDeMes, sumarDias } from '../util/fecha';
import type { FilaActividad } from './actividadTexto';
import type {
  CapaDatos,
  Cliente,
  ComisionMes,
  Miembro,
  Parametro,
  Prospecto,
  ResultadoDatos,
  SesionAdmin,
  Venta,
} from './datos';

const DUENO = 'demo-dueno';
const V1 = 'demo-vendedor-1';
const V2 = 'demo-vendedor-2';

const ok = <T>(datos: T): ResultadoDatos<T> => ({ ok: true, datos });

export function crearCapaDemo(hoy: string = hoyMexico()): CapaDatos {
  let sesion: SesionAdmin | null = null;
  let folio = 0;
  let id = 0;
  const nuevoId = (p: string) => `${p}-${++id}`;

  const miembros: Miembro[] = [
    {
      usuario_id: DUENO,
      nombre: 'Adam',
      rol: 'dueno',
      activo: true,
      meta_mensual_centavos: 0,
      comision_pb: null,
    },
    {
      usuario_id: V1,
      nombre: 'Vendedor 1',
      rol: 'vendedor',
      activo: true,
      meta_mensual_centavos: 1_500_000,
      comision_pb: null,
    },
    {
      usuario_id: V2,
      nombre: 'Vendedor 2',
      rol: 'vendedor',
      activo: true,
      meta_mensual_centavos: 1_000_000,
      comision_pb: null,
    },
  ];
  const parametros: Parametro[] = [
    { clave: 'precio_plus_mensual', valor: 9900 },
    { clave: 'precio_plus_anual', valor: 99000 },
    { clave: 'precio_licencia_mes', valor: 2000 },
    { clave: 'comision_pct', valor: 1500 },
    { clave: 'iva_pct', valor: 1600 },
    { clave: 'dominio_publico', valor: '' },
  ];
  const param = (clave: string) => {
    const v = parametros.find((p) => p.clave === clave)?.valor;
    return typeof v === 'number' ? v : 0;
  };

  const cliente = (nombre: string, tipo: string, vendedor: string, contacto = ''): Cliente => ({
    id: nuevoId('c'),
    nombre,
    rfc: null,
    tipo,
    contacto,
    telefono: '',
    correo: '',
    vendedor_id: vendedor,
    notas: '',
  });
  const clientes: Cliente[] = [
    cliente('Caja Popular San Andrés Cholula', 'institucion', V1, 'Lic. Martha Ortega'),
    cliente('Estética Lupita', 'negocio', V2, 'Guadalupe Hernández'),
    cliente('Transportes Hermanos Rojas Huerta, S.A. de C.V.', 'negocio', V1, 'Ing. Rojas'),
    cliente('Taller Mecánico El Güero', 'negocio', V2),
  ];
  const [cCaja, cEstetica, cTransportes, cTaller] = clientes as [Cliente, Cliente, Cliente, Cliente];

  const nombreMiembro = (u: string) => miembros.find((m) => m.usuario_id === u)?.nombre ?? '';
  const nombreCliente = (c: string) => clientes.find((x) => x.id === c)?.nombre ?? '';

  const venta = (
    c: Cliente,
    producto: string,
    cantidad: number,
    meses: number,
    precio: number,
    estado: string,
    haceDias: number,
    venceEnDias: number | null = null,
  ): Venta => {
    const creado = sumarDias(hoy, -haceDias);
    const total = producto === 'licencias' ? cantidad * meses * precio : cantidad * precio;
    return {
      id: nuevoId('v'),
      folio: `FV-${String(++folio).padStart(4, '0')}`,
      cliente_id: c.id,
      vendedor_id: c.vendedor_id,
      producto,
      cantidad,
      meses,
      precio_unitario_centavos: precio,
      total_centavos: total,
      estado,
      vence_en: venceEnDias === null ? null : sumarDias(hoy, venceEnDias),
      pagada_en: estado === 'pagada' ? `${creado}T18:00:00Z` : null,
      cancelada_motivo: null,
      creado_en: `${creado}T17:00:00Z`,
      cliente_nombre: c.nombre,
      vendedor_nombre: nombreMiembro(c.vendedor_id),
    };
  };
  const ventas: Venta[] = [
    venta(cTaller, 'plus_mensual', 1, 1, 9900, 'pagada', 8),
    venta(cTransportes, 'licencias', 8, 6, 4000, 'por_cobrar', 5, 5),
    venta(cEstetica, 'plus_anual', 1, 12, 99000, 'pagada', 3),
    venta(cCaja, 'licencias', 40, 12, 2000, 'pagada', 1),
  ].reverse();

  const prospecto = (
    nombre: string,
    vendedor: string,
    etapa: string,
    interes: string,
    origen: string,
    paso: string,
    pasoEnDias: number | null,
  ): Prospecto => ({
    id: nuevoId('p'),
    nombre,
    contacto: '',
    telefono: '',
    correo: '',
    origen,
    interes,
    etapa,
    motivo_perdida: null,
    vendedor_id: vendedor,
    siguiente_paso: paso,
    siguiente_paso_en: pasoEnDias === null ? null : sumarDias(hoy, pasoEnDias),
    cliente_id: null,
  });
  const prospectos: Prospecto[] = [
    prospecto(
      'Cooperativa Textil de Tehuacán',
      V1,
      'propuesta',
      'licencias',
      'referido',
      'Enviar propuesta de 25 licencias',
      0,
    ),
    prospecto('Abarrotes Doña Chela', V2, 'nuevo', 'plus', 'pagina', 'Llamar para presentar Plus', 0),
    prospecto('Consultorio Dental Sonrisa', V2, 'contactado', 'plus', 'pagina', 'Demo por videollamada', 1),
    prospecto('Grupo Escolar Zaragoza', V1, 'demo', 'licencias', 'llamada', 'Demo con la directora', -1),
    prospecto('Panadería La Espiga', V2, 'nuevo', 'plus', 'pagina', 'Llamar', 2),
    prospecto('Farmacias del Barrio', V1, 'perdido', 'licencias', 'referido', '', null),
  ];

  const visibles = <T extends { vendedor_id: string }>(xs: T[]) =>
    sesion?.rol === 'dueno' ? xs : xs.filter((x) => x.vendedor_id === sesion?.usuarioId);
  const sinSesion = { ok: false as const, error: 'Inicia sesión.', codigo: 'sin_permiso' as const };

  function comisionesDe(mes: string): ComisionMes[] {
    return miembros
      .filter((m) => m.rol === 'vendedor' && (sesion?.rol === 'dueno' || m.usuario_id === sesion?.usuarioId))
      .map((m) => {
        const suyas = ventas.filter((v) => v.vendedor_id === m.usuario_id);
        const delMes = (f: string | null) => f !== null && inicioDeMes(f.slice(0, 10)) === mes;
        const cobrado = suyas
          .filter((v) => v.estado === 'pagada' && delMes(v.pagada_en))
          .reduce((s, v) => s + v.total_centavos, 0);
        const pb = m.comision_pb ?? param('comision_pct');
        return {
          mes,
          vendedor_id: m.usuario_id,
          vendedor_nombre: m.nombre,
          vendido_centavos: suyas
            .filter((v) => v.estado !== 'cancelada' && delMes(v.creado_en))
            .reduce((s, v) => s + v.total_centavos, 0),
          cobrado_centavos: cobrado,
          por_cobrar_centavos: suyas
            .filter((v) => v.estado === 'por_cobrar' && delMes(v.creado_en))
            .reduce((s, v) => s + v.total_centavos, 0),
          comision_centavos: Math.floor((cobrado * pb) / 10000),
          meta_mensual_centavos: m.meta_mensual_centavos,
        };
      });
  }

  function cambiarVenta(idVenta: string, cambio: Partial<Venta>): ResultadoDatos<Venta> {
    const v = ventas.find((x) => x.id === idVenta);
    if (!v) return { ok: false, error: 'No se encontró la venta.', codigo: 'otro' };
    const antes = { ...v };
    Object.assign(v, cambio);
    registrar(
      'admin_ventas',
      v.id,
      'update',
      antes as unknown as Record<string, unknown>,
      {
        ...v,
      } as unknown as Record<string, unknown>,
    );
    return ok({ ...v });
  }

  let bitacoraId = 0;
  const bitacora: FilaActividad[] = [];
  function registrar(
    tabla: string,
    registro_id: string,
    accion: FilaActividad['accion'],
    antes: Record<string, unknown> | null,
    despues: Record<string, unknown> | null,
    actor?: { usuario_id: string | null; usuario_nombre: string; creado_en?: string },
  ) {
    bitacora.unshift({
      id: ++bitacoraId,
      tabla,
      registro_id,
      accion,
      antes,
      despues,
      usuario_id: actor?.usuario_id ?? sesion?.usuarioId ?? null,
      usuario_nombre: actor?.usuario_nombre ?? sesion?.nombre ?? '',
      creado_en: actor?.creado_en ?? new Date().toISOString(),
    });
  }

  // Semilla: movimientos de ejemplo para que Actividad no abra vacía.
  for (const v of [...ventas].reverse()) {
    const actor = {
      usuario_id: v.vendedor_id,
      usuario_nombre: v.vendedor_nombre || nombreMiembro(v.vendedor_id),
      creado_en: v.creado_en,
    };
    registrar('admin_ventas', v.id, 'insert', null, { ...v } as unknown as Record<string, unknown>, actor);
    if (v.estado === 'pagada') {
      registrar(
        'admin_ventas',
        v.id,
        'update',
        { ...v, estado: 'por_cobrar', pagada_en: null } as unknown as Record<string, unknown>,
        { ...v } as unknown as Record<string, unknown>,
        { usuario_id: DUENO, usuario_nombre: 'Adam', creado_en: v.pagada_en ?? v.creado_en },
      );
    }
  }
  for (const p of [...prospectos].reverse()) {
    const dePagina = p.origen === 'pagina';
    registrar(
      'admin_prospectos',
      p.id,
      'insert',
      null,
      { ...p },
      dePagina
        ? { usuario_id: null, usuario_nombre: '', creado_en: `${hoy}T12:00:00-06:00` }
        : {
            usuario_id: p.vendedor_id,
            usuario_nombre: nombreMiembro(p.vendedor_id),
            creado_en: `${hoy}T12:00:00-06:00`,
          },
    );
  }

  return {
    async iniciarSesion() {
      sesion = { usuarioId: DUENO, correo: 'demo@finanvoz', nombre: 'Adam', rol: 'dueno' };
      return ok(sesion);
    },
    async cerrarSesion() {
      sesion = null;
    },
    async sesionActual() {
      // En el modo de ejemplo se entra directo como dueño.
      sesion ??= { usuarioId: DUENO, correo: 'demo@finanvoz', nombre: 'Adam', rol: 'dueno' };
      return ok(sesion);
    },
    async resumen(mes) {
      if (!sesion) return sinSesion;
      const inicio = inicioDeMes(mes);
      const vs = visibles(ventas);
      const pagadasMes = vs.filter(
        (v) => v.estado === 'pagada' && v.pagada_en && inicioDeMes(v.pagada_en.slice(0, 10)) === inicio,
      );
      const plus = pagadasMes
        .filter((v) => v.producto !== 'licencias')
        .reduce((s, v) => s + v.total_centavos, 0);
      const lic = pagadasMes
        .filter((v) => v.producto === 'licencias')
        .reduce((s, v) => s + v.total_centavos, 0);
      const ps = visibles(prospectos);
      const porEtapa: Record<string, number> = {};
      for (const p of ps) porEtapa[p.etapa] = (porEtapa[p.etapa] ?? 0) + 1;
      const ganados = porEtapa['ganado'] ?? 0;
      const perdidos = porEtapa['perdido'] ?? 0;
      return ok({
        mes: inicio,
        ingreso_cobrado_centavos: plus + lic,
        ingreso_plus_centavos: plus,
        ingreso_licencias_centavos: lic,
        por_cobrar_centavos: vs
          .filter((v) => v.estado === 'por_cobrar')
          .reduce((s, v) => s + v.total_centavos, 0),
        ventas: vs.filter((v) => v.estado !== 'cancelada').length,
        prospectos_por_etapa: porEtapa,
        tasa_cierre: ganados + perdidos === 0 ? 0 : Math.round((100 * ganados) / (ganados + perdidos)),
        prospectos_abiertos: ps.filter((p) => p.etapa !== 'ganado' && p.etapa !== 'perdido').length,
        plus_activos: sesion.rol === 'dueno' ? 77 : 0,
        usuarios_activos_7d: sesion.rol === 'dueno' ? 612 : 0,
      });
    },
    async listarProspectos() {
      return ok(visibles(prospectos).map((p) => ({ ...p })));
    },
    async crearProspecto(p) {
      const nuevo: Prospecto = {
        ...p,
        id: nuevoId('p'),
        contacto: '',
        etapa: 'nuevo',
        motivo_perdida: null,
        cliente_id: null,
      };
      prospectos.unshift(nuevo);
      registrar('admin_prospectos', nuevo.id, 'insert', null, { ...nuevo });
      return ok({ ...nuevo });
    },
    async actualizarEtapaProspecto(idP, etapa, motivo) {
      const p = prospectos.find((x) => x.id === idP);
      if (!p) return { ok: false, error: 'No se encontró el prospecto.', codigo: 'otro' };
      const antes = { ...p };
      p.etapa = etapa;
      p.motivo_perdida = etapa === 'perdido' ? (motivo ?? null) : null;
      registrar('admin_prospectos', p.id, 'update', antes, { ...p });
      return ok({ ...p });
    },
    async convertirProspectoEnCliente(idP) {
      const p = prospectos.find((x) => x.id === idP);
      if (!p) return { ok: false, error: 'No se encontró el prospecto.', codigo: 'otro' };
      const antes = { ...p };
      let c = clientes.find((x) => x.id === p.cliente_id);
      if (!c) {
        c = cliente(p.nombre, p.interes === 'plus' ? 'persona' : 'negocio', p.vendedor_id);
        clientes.push(c);
        registrar('admin_clientes', c.id, 'insert', null, { ...c });
      }
      p.etapa = 'ganado';
      p.cliente_id = c.id;
      registrar('admin_prospectos', p.id, 'update', antes, { ...p });
      return ok({ cliente: { ...c }, prospecto: { ...p } });
    },
    async listarClientes(q) {
      const t = (q ?? '').trim().toLowerCase();
      return ok(
        visibles(clientes)
          .filter((c) => !t || c.nombre.toLowerCase().includes(t))
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
      );
    },
    async crearCliente(c) {
      if (c.rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(c.rfc.trim().toUpperCase()))
        return { ok: false, error: 'El RFC no tiene el formato correcto.', codigo: 'otro' };
      const nuevo: Cliente = { ...c, id: nuevoId('c'), rfc: c.rfc ? c.rfc.trim().toUpperCase() : null };
      clientes.push(nuevo);
      registrar('admin_clientes', nuevo.id, 'insert', null, { ...nuevo });
      return ok({ ...nuevo });
    },
    async ventasDeCliente(c) {
      return ok(visibles(ventas).filter((v) => v.cliente_id === c));
    },
    async listarVentas(estado) {
      return ok(visibles(ventas).filter((v) => !estado || v.estado === estado));
    },
    async registrarVenta(input) {
      const precios: Record<string, number> = {
        plus_mensual: param('precio_plus_mensual'),
        plus_anual: param('precio_plus_anual'),
        licencias: param('precio_licencia_mes'),
      };
      const precio = input.precio_unitario_centavos ?? precios[input.producto] ?? 0;
      const v: Venta = {
        id: nuevoId('v'),
        folio: `FV-${String(++folio).padStart(4, '0')}`,
        cliente_id: input.cliente_id,
        vendedor_id: input.vendedor_id,
        producto: input.producto,
        cantidad: input.cantidad,
        meses: input.meses,
        precio_unitario_centavos: precio,
        total_centavos:
          input.producto === 'licencias' ? input.cantidad * input.meses * precio : input.cantidad * precio,
        estado: 'por_cobrar',
        vence_en: input.vence_en ?? null,
        pagada_en: null,
        cancelada_motivo: null,
        creado_en: new Date().toISOString(),
        cliente_nombre: nombreCliente(input.cliente_id),
        vendedor_nombre: nombreMiembro(input.vendedor_id),
      };
      ventas.unshift(v);
      registrar('admin_ventas', v.id, 'insert', null, { ...v } as unknown as Record<string, unknown>);
      return ok({ ...v });
    },
    async marcarVentaPagada(idV) {
      return cambiarVenta(idV, { estado: 'pagada', pagada_en: new Date().toISOString() });
    },
    async cancelarVenta(idV, motivo) {
      return cambiarVenta(idV, { estado: 'cancelada', cancelada_motivo: motivo, pagada_en: null });
    },
    async comisiones(mes) {
      return ok(comisionesDe(inicioDeMes(mes)));
    },
    async listarMiembros() {
      return ok(visibles(miembros.map((m) => ({ ...m, vendedor_id: m.usuario_id }))));
    },
    async guardarMiembro(m) {
      const i = miembros.findIndex((x) => x.usuario_id === m.usuario_id);
      const nuevo: Miembro = {
        activo: true,
        meta_mensual_centavos: 0,
        comision_pb: null,
        ...(i >= 0 ? miembros[i] : {}),
        ...m,
      };
      const antes = i >= 0 ? ({ ...miembros[i] } as unknown as Record<string, unknown>) : null;
      if (i >= 0) miembros[i] = nuevo;
      else miembros.push(nuevo);
      registrar('admin_miembros', nuevo.usuario_id, antes ? 'update' : 'insert', antes, {
        ...nuevo,
      } as unknown as Record<string, unknown>);
      return ok({ ...nuevo });
    },
    async listarParametros() {
      return ok(parametros.map((p) => ({ ...p })));
    },
    async guardarParametro(clave, valor) {
      const p = parametros.find((x) => x.clave === clave);
      if (!p) return { ok: false, error: 'Ese ajuste no existe.', codigo: 'otro' };
      const antes = { clave: p.clave, valor: p.valor };
      p.valor = valor;
      registrar('admin_parametros', clave, 'update', antes, { clave: p.clave, valor: p.valor });
      return ok({ ...p });
    },
    async parametrosPrecio() {
      const out: Record<string, number> = {};
      for (const p of parametros) if (typeof p.valor === 'number') out[p.clave] = p.valor;
      return ok(out);
    },
    async pendientesHoy() {
      return ok({
        ventasPorVencer: visibles(ventas).filter(
          (v) => v.estado === 'por_cobrar' && v.vence_en !== null && diasEntre(hoy, v.vence_en) <= 7,
        ),
        pasosVencidos: visibles(prospectos).filter(
          (p) =>
            p.etapa !== 'ganado' &&
            p.etapa !== 'perdido' &&
            p.siguiente_paso_en !== null &&
            diasEntre(hoy, p.siguiente_paso_en) <= 0,
        ),
      });
    },
    async ultimasVentas(limite = 8) {
      return ok(visibles(ventas).slice(0, limite));
    },
    async listarActividad(opts = {}) {
      if (!sesion) return sinSesion;
      if (sesion.rol !== 'dueno')
        return { ok: false, error: 'Sin permiso para ver la actividad.', codigo: 'sin_permiso' };
      const limite = opts.limite ?? 50;
      let filas = bitacora;
      if (opts.tablas && opts.tablas.length > 0) filas = filas.filter((f) => opts.tablas?.includes(f.tabla));
      const antesDe = opts.antesDe;
      if (antesDe != null) filas = filas.filter((f) => f.id < antesDe);
      return ok(filas.slice(0, limite).map((f) => ({ ...f })));
    },
  };
}
