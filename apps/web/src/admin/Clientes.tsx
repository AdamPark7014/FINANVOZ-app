import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { formatearCentavos } from '../util/dinero';
import { fechaCorta } from '../util/fecha';
import { Icono } from '../util/Icono';
import type { CapaDatos, Cliente, Miembro, SesionAdmin, Venta } from './datos';
import { Cabecera, Cargando, ErrorCarga, Vacio } from './componentes/Estados';
import { ESTADOS_VENTA, TIPOS_CLIENTE, describirVenta } from './textos';

export function Clientes({
  datos,
  sesion,
  onRegistrarVenta,
}: {
  datos: CapaDatos;
  sesion: SesionAdmin;
  onRegistrarVenta: (clienteId: string) => void;
}) {
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'error'>('cargando');
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [lista, setLista] = useState<Cliente[]>([]);
  const [ficha, setFicha] = useState<Cliente | null>(null);
  const [alta, setAlta] = useState(false);

  const cargar = useCallback(
    async (busqueda: string) => {
      setEstado('cargando');
      const r = await datos.listarClientes(busqueda);
      if (!r.ok) {
        setError(r.error);
        setEstado('error');
        return;
      }
      setLista(r.datos);
      setEstado('ok');
    },
    [datos],
  );

  // Busca mientras escribes (con una pausa corta para no pedir en cada tecla).
  useEffect(() => {
    const t = window.setTimeout(() => void cargar(q), 250);
    return () => window.clearTimeout(t);
  }, [cargar, q, sesion.usuarioId]);

  return (
    <>
      <Cabecera titulo="Clientes" porque="Quién ya te compró y qué le has vendido">
        <button type="button" className="btn btn-primario btn-control" onClick={() => setAlta(true)}>
          Nuevo cliente
        </button>
      </Cabecera>

      <label className="solo-lector" htmlFor="buscar-cliente">
        Buscar cliente
      </label>
      <input
        id="buscar-cliente"
        className="buscador"
        type="search"
        placeholder="Buscar por nombre"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {estado === 'cargando' && lista.length === 0 ? (
        <Cargando filas={4} />
      ) : estado === 'error' ? (
        <ErrorCarga mensaje={error} onReintentar={() => void cargar(q)} />
      ) : lista.length === 0 ? (
        <Vacio
          porqué={
            q
              ? `Ningún cliente se llama «${q}».`
              : 'Aún no hay clientes. Se crean solos al ganar un prospecto, o dalos de alta aquí.'
          }
          accion={q ? undefined : 'Nuevo cliente'}
          onAccion={() => setAlta(true)}
        />
      ) : (
        <div className="panel tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Cliente</th>
                <th className="sec">Tipo</th>
                <th className="sec">Contacto</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} className="fila-accion" onClick={() => setFicha(c)}>
                  <td>
                    <button type="button" className="enlace-fila" onClick={() => setFicha(c)}>
                      {c.nombre}
                    </button>
                    {c.rfc ? <span className="meta">{c.rfc}</span> : null}
                    <span className="meta-movil">{TIPOS_CLIENTE[c.tipo] ?? c.tipo}</span>
                  </td>
                  <td className="sec">{TIPOS_CLIENTE[c.tipo] ?? c.tipo}</td>
                  <td className="sec">{c.contacto || c.correo || c.telefono || 'Sin contacto'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ficha ? (
        <FichaCliente
          datos={datos}
          cliente={ficha}
          onCerrar={() => setFicha(null)}
          onRegistrarVenta={() => onRegistrarVenta(ficha.id)}
        />
      ) : null}
      {alta ? (
        <AltaCliente
          datos={datos}
          sesion={sesion}
          onCerrar={() => setAlta(false)}
          onListo={(c) => {
            setAlta(false);
            setQ('');
            void cargar('');
            setFicha(c);
          }}
        />
      ) : null}
    </>
  );
}

function FichaCliente({
  datos,
  cliente,
  onCerrar,
  onRegistrarVenta,
}: {
  datos: CapaDatos;
  cliente: Cliente;
  onCerrar: () => void;
  onRegistrarVenta: () => void;
}) {
  const [ventas, setVentas] = useState<Venta[] | null>(null);
  useEffect(() => {
    void datos.ventasDeCliente(cliente.id).then((r) => setVentas(r.ok ? r.datos : []));
  }, [datos, cliente.id]);
  const cobrado = (ventas ?? [])
    .filter((v) => v.estado === 'pagada')
    .reduce((s, v) => s + v.total_centavos, 0);

  return (
    <div className="hoja-fondo" role="dialog" aria-modal="true" aria-labelledby="ficha-titulo">
      <div className="hoja">
        <div className="hoja-cabecera">
          <h2 id="ficha-titulo">{cliente.nombre}</h2>
          <button type="button" className="boton-icono" onClick={onCerrar} aria-label="Cerrar">
            <Icono nombre="cerrar" />
          </button>
        </div>
        <div className="ficha">
          <span>
            {TIPOS_CLIENTE[cliente.tipo] ?? cliente.tipo}
            {cliente.rfc ? ` · RFC ${cliente.rfc}` : ''}
          </span>
          {cliente.contacto ? <span>{cliente.contacto}</span> : null}
          {cliente.correo ? <a href={`mailto:${cliente.correo}`}>{cliente.correo}</a> : null}
          {cliente.telefono ? <a href={`tel:${cliente.telefono}`}>{cliente.telefono}</a> : null}
          {cliente.notas ? <span>{cliente.notas}</span> : null}
        </div>
        <p className="cifra-label">Te ha pagado</p>
        <p className="cifra-valor num">{formatearCentavos(cobrado)}</p>
        <h3>Ventas</h3>
        {ventas === null ? (
          <Cargando filas={2} />
        ) : ventas.length === 0 ? (
          <p className="panel-subtitulo">Todavía no le has vendido nada.</p>
        ) : (
          <ul className="lista-pendientes">
            {ventas.map((v) => (
              <li key={v.id}>
                {v.folio} · {describirVenta(v)} · {formatearCentavos(v.total_centavos)} ·{' '}
                {ESTADOS_VENTA[v.estado] ?? v.estado} · {fechaCorta(v.creado_en)}
              </li>
            ))}
          </ul>
        )}
        <div className="hoja-acciones">
          <button type="button" className="btn btn-primario" onClick={onRegistrarVenta}>
            Registrar venta
          </button>
        </div>
      </div>
    </div>
  );
}

function AltaCliente({
  datos,
  sesion,
  onCerrar,
  onListo,
}: {
  datos: CapaDatos;
  sesion: SesionAdmin;
  onCerrar: () => void;
  onListo: (c: Cliente) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('negocio');
  const [rfc, setRfc] = useState('');
  const [contacto, setContacto] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [vendedor, setVendedor] = useState(sesion.usuarioId);
  const [vendedores, setVendedores] = useState<Miembro[]>([]);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (sesion.rol !== 'dueno') return;
    void datos.listarMiembros().then((r) => {
      if (!r.ok) return;
      const activos = r.datos.filter((m) => m.activo);
      setVendedores(activos);
      const primero = activos.find((m) => m.rol === 'vendedor');
      if (primero) setVendedor(primero.usuario_id);
    });
  }, [datos, sesion.rol]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setEnviando(true);
    setError('');
    const r = await datos.crearCliente({
      nombre: nombre.trim(),
      tipo,
      rfc: rfc.trim() || null,
      contacto: contacto.trim(),
      correo: correo.trim(),
      telefono: telefono.trim(),
      vendedor_id: sesion.rol === 'dueno' ? vendedor : sesion.usuarioId,
      notas: '',
    });
    setEnviando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onListo(r.datos);
  }

  return (
    <div className="hoja-fondo" role="dialog" aria-modal="true" aria-labelledby="alta-titulo">
      <div className="hoja">
        <div className="hoja-cabecera">
          <h2 id="alta-titulo">Nuevo cliente</h2>
          <button type="button" className="boton-icono" onClick={onCerrar} aria-label="Cerrar">
            <Icono nombre="cerrar" />
          </button>
        </div>
        <form onSubmit={enviar}>
          <div className="campo">
            <label htmlFor="cli-nombre">Nombre o razón social</label>
            <input
              id="cli-nombre"
              required
              maxLength={200}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="cli-tipo">Tipo</label>
            <select id="cli-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {Object.entries(TIPOS_CLIENTE).map(([id, etiqueta]) => (
                <option key={id} value={id}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="cli-rfc">RFC (opcional)</label>
            <input
              id="cli-rfc"
              autoCapitalize="characters"
              maxLength={13}
              value={rfc}
              onChange={(e) => setRfc(e.target.value.toUpperCase())}
            />
          </div>
          <div className="campo">
            <label htmlFor="cli-contacto">Persona de contacto</label>
            <input id="cli-contacto" value={contacto} onChange={(e) => setContacto(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="cli-correo">Correo</label>
            <input id="cli-correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="cli-tel">Teléfono</label>
            <input id="cli-tel" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
          {sesion.rol === 'dueno' && vendedores.length > 0 ? (
            <div className="campo">
              <label htmlFor="cli-vendedor">Lo atiende</label>
              <select id="cli-vendedor" value={vendedor} onChange={(e) => setVendedor(e.target.value)}>
                {vendedores.map((m) => (
                  <option key={m.usuario_id} value={m.usuario_id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {error ? (
            <p className="error-campo" role="alert">
              {error}
            </p>
          ) : null}
          <div className="hoja-acciones">
            <button type="button" className="btn btn-secundario" onClick={onCerrar}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primario" disabled={!nombre.trim() || enviando}>
              {enviando ? 'Guardando…' : 'Guardar cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
