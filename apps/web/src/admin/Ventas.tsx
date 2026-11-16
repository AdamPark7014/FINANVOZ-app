import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { centavosDePesos, formatearCentavos, pesosDeCentavos } from '../util/dinero';
import { fechaCorta, hoyMexico, sumarDias } from '../util/fecha';
import { Icono } from '../util/Icono';
import type { CapaDatos, Cliente, SesionAdmin, Venta } from './datos';
import { Cabecera, Cargando, ErrorCarga, Vacio } from './componentes/Estados';
import { ESTADOS_VENTA, PRODUCTOS, describirVenta } from './textos';

const FILTROS = [
  { id: 'por_cobrar', etiqueta: 'Por cobrar' },
  { id: 'pagada', etiqueta: 'Pagadas' },
  { id: 'cancelada', etiqueta: 'Canceladas' },
] as const;

const CLAVE_PRECIO: Record<string, string> = {
  plus_mensual: 'precio_plus_mensual',
  plus_anual: 'precio_plus_anual',
  licencias: 'precio_licencia_mes',
};

export function Ventas({
  datos,
  sesion,
  clienteInicial,
}: {
  datos: CapaDatos;
  sesion: SesionAdmin;
  clienteInicial?: string | null;
}) {
  const esDueno = sesion.rol === 'dueno';
  const [filtro, setFiltro] = useState<string>('por_cobrar');
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'error'>('cargando');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [lista, setLista] = useState<Venta[]>([]);
  const [hoja, setHoja] = useState(Boolean(clienteInicial));
  const [cancelando, setCancelando] = useState<Venta | null>(null);

  const cargar = useCallback(async () => {
    setEstado('cargando');
    const r = await datos.listarVentas(filtro);
    if (!r.ok) {
      setError(r.error);
      setEstado('error');
      return;
    }
    setLista(r.datos);
    setEstado('ok');
  }, [datos, filtro]);

  useEffect(() => {
    void cargar();
  }, [cargar, sesion.usuarioId]);

  async function cobrar(v: Venta) {
    const r = await datos.marcarVentaPagada(v.id);
    setAviso(r.ok ? `${v.folio} quedó pagada.` : r.error);
    await cargar();
  }

  return (
    <>
      <Cabecera titulo="Ventas" porque="Lo vendido, lo cobrado y lo que aún falta">
        <button type="button" className="btn btn-primario btn-control" onClick={() => setHoja(true)}>
          Registrar venta
        </button>
      </Cabecera>

      <div className="pestanas" role="group" aria-label="Filtrar ventas">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            className="pestana"
            aria-pressed={filtro === f.id}
            onClick={() => setFiltro(f.id)}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>

      {aviso ? (
        <p className="aviso-demo" role="status">
          {aviso}
        </p>
      ) : null}

      {estado === 'cargando' ? (
        <Cargando filas={4} />
      ) : estado === 'error' ? (
        <ErrorCarga mensaje={error} onReintentar={() => void cargar()} />
      ) : lista.length === 0 ? (
        <Vacio
          porqué={
            filtro === 'por_cobrar'
              ? 'No hay nada por cobrar. Cuando registres una venta, espera aquí hasta que se pague.'
              : filtro === 'pagada'
                ? 'Aún no hay ventas pagadas.'
                : 'No hay ventas canceladas.'
          }
          accion={filtro === 'por_cobrar' ? 'Registrar venta' : undefined}
          onAccion={() => setHoja(true)}
        />
      ) : (
        <div className="panel tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Cliente</th>
                <th className="sec">Qué compró</th>
                {esDueno ? <th className="sec">Vendedor</th> : null}
                <th className="sec">{filtro === 'por_cobrar' ? 'Vence' : 'Estado'}</th>
                <th className="monto">Monto</th>
                {esDueno && filtro === 'por_cobrar' ? (
                  <th>
                    <span className="solo-lector">Acciones</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {lista.map((v) => (
                <tr key={v.id}>
                  <td>
                    {v.cliente_nombre || 'Cliente'}
                    <span className="meta">
                      Folio {v.folio} · {fechaCorta(v.creado_en)}
                    </span>
                    <span className="meta-movil">{describirVenta(v)}</span>
                    {v.cancelada_motivo ? <span className="meta">Motivo: {v.cancelada_motivo}</span> : null}
                  </td>
                  <td className="sec">{describirVenta(v)}</td>
                  {esDueno ? <td className="sec">{v.vendedor_nombre}</td> : null}
                  <td className="sec">
                    {filtro === 'por_cobrar' ? (
                      v.vence_en ? (
                        fechaCorta(v.vence_en)
                      ) : (
                        'Sin fecha'
                      )
                    ) : (
                      <span className={`estado estado-${v.estado}`}>
                        {ESTADOS_VENTA[v.estado] ?? v.estado}
                      </span>
                    )}
                  </td>
                  <td className="monto">{formatearCentavos(v.total_centavos)}</td>
                  {esDueno && filtro === 'por_cobrar' ? (
                    <td>
                      <div className="modulo-acciones">
                        <button
                          type="button"
                          className="btn btn-texto btn-control"
                          onClick={() => setCancelando(v)}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="btn btn-secundario btn-control"
                          onClick={() => void cobrar(v)}
                        >
                          Marcar pagada
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hoja ? (
        <HojaRegistrar
          datos={datos}
          sesion={sesion}
          clienteInicial={clienteInicial ?? ''}
          onCerrar={() => setHoja(false)}
          onListo={(v) => {
            setHoja(false);
            setAviso(`Registré ${v.folio} por ${formatearCentavos(v.total_centavos)}.`);
            setFiltro('por_cobrar');
            void cargar();
          }}
        />
      ) : null}

      {cancelando ? (
        <HojaCancelar
          venta={cancelando}
          onCerrar={() => setCancelando(null)}
          onConfirmar={async (motivo) => {
            const r = await datos.cancelarVenta(cancelando.id, motivo);
            setCancelando(null);
            setAviso(r.ok ? `${cancelando.folio} quedó cancelada.` : r.error);
            await cargar();
          }}
        />
      ) : null}
    </>
  );
}

function HojaRegistrar({
  datos,
  sesion,
  clienteInicial,
  onCerrar,
  onListo,
}: {
  datos: CapaDatos;
  sesion: SesionAdmin;
  clienteInicial: string;
  onCerrar: () => void;
  onListo: (v: Venta) => void;
}) {
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [precios, setPrecios] = useState<Record<string, number>>({});
  const [clienteId, setClienteId] = useState(clienteInicial);
  const [producto, setProducto] = useState('plus_mensual');
  const [cantidad, setCantidad] = useState('1');
  const [meses, setMeses] = useState('12');
  const [precio, setPrecio] = useState('');
  const [vence, setVence] = useState(sumarDias(hoyMexico(), 7));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      const [c, p] = await Promise.all([datos.listarClientes(), datos.parametrosPrecio()]);
      setClientes(c.ok ? c.datos : []);
      if (p.ok) setPrecios(p.datos);
    })();
  }, [datos]);

  // Al cambiar de producto, el precio sugerido sale de Ajustes (se puede cambiar para esta venta).
  useEffect(() => {
    const sugerido = precios[CLAVE_PRECIO[producto] ?? ''];
    setPrecio(sugerido == null ? '' : pesosDeCentavos(sugerido));
  }, [producto, precios]);

  const precioCentavos = centavosDePesos(precio);
  const nCantidad = Math.max(0, Math.trunc(Number(cantidad) || 0));
  const nMeses = producto === 'licencias' ? Math.max(0, Math.trunc(Number(meses) || 0)) : 1;
  const total = useMemo(
    () => (precioCentavos === null ? null : nCantidad * nMeses * precioCentavos),
    [precioCentavos, nCantidad, nMeses],
  );
  const cliente = clientes?.find((c) => c.id === clienteId);
  const valido = Boolean(cliente) && nCantidad > 0 && nMeses > 0 && precioCentavos !== null;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!valido || !cliente || precioCentavos === null) return;
    setEnviando(true);
    setError('');
    const r = await datos.registrarVenta({
      cliente_id: cliente.id,
      // La venta es del vendedor dueño del cliente (así cuenta en su comisión aunque la capture el dueño).
      vendedor_id: sesion.rol === 'dueno' ? cliente.vendedor_id : sesion.usuarioId,
      producto,
      cantidad: nCantidad,
      meses: nMeses,
      precio_unitario_centavos: precioCentavos,
      vence_en: vence || null,
    });
    setEnviando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onListo(r.datos);
  }

  return (
    <div className="hoja-fondo" role="dialog" aria-modal="true" aria-labelledby="registrar-titulo">
      <div className="hoja">
        <div className="hoja-cabecera">
          <h2 id="registrar-titulo">Registrar venta</h2>
          <button type="button" className="boton-icono" onClick={onCerrar} aria-label="Cerrar">
            <Icono nombre="cerrar" />
          </button>
        </div>
        {clientes === null ? (
          <Cargando filas={3} />
        ) : clientes.length === 0 ? (
          <Vacio porqué="Primero da de alta al cliente en Clientes o gana un prospecto." />
        ) : (
          <form onSubmit={enviar}>
            <div className="campo">
              <label htmlFor="venta-cliente">Cliente</label>
              <select
                id="venta-cliente"
                required
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
              >
                <option value="">Elige un cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="venta-producto">Qué compra</label>
              <select id="venta-producto" value={producto} onChange={(e) => setProducto(e.target.value)}>
                {Object.entries(PRODUCTOS).map(([id, etiqueta]) => (
                  <option key={id} value={id}>
                    {etiqueta}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="venta-cant">{producto === 'licencias' ? 'Personas' : 'Cantidad'}</label>
              <input
                id="venta-cant"
                inputMode="numeric"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            {producto === 'licencias' ? (
              <div className="campo">
                <label htmlFor="venta-meses">Meses</label>
                <input
                  id="venta-meses"
                  inputMode="numeric"
                  value={meses}
                  onChange={(e) => setMeses(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            ) : null}
            <div className="campo">
              <label htmlFor="venta-precio">
                {producto === 'licencias' ? 'Precio por persona al mes' : 'Precio'}
              </label>
              <input
                id="venta-precio"
                inputMode="decimal"
                value={precio}
                onChange={(e) => setPrecio(e.target.value.replace(/[^\d.]/g, ''))}
                aria-describedby="venta-precio-pista"
              />
              <span id="venta-precio-pista" className="pista">
                En pesos. Sugerido de Ajustes; cámbialo solo para esta venta.
              </span>
            </div>
            <div className="campo">
              <label htmlFor="venta-vence">Fecha para cobrar</label>
              <input id="venta-vence" type="date" value={vence} onChange={(e) => setVence(e.target.value)} />
            </div>
            <p className="cifra-label">Total</p>
            <p className="cifra-valor num">{total === null ? '—' : formatearCentavos(total)}</p>
            {error ? (
              <p className="error-campo" role="alert">
                {error}
              </p>
            ) : null}
            <div className="hoja-acciones">
              <button type="button" className="btn btn-secundario" onClick={onCerrar}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primario" disabled={!valido || enviando}>
                {enviando ? 'Guardando…' : 'Registrar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function HojaCancelar({
  venta,
  onCerrar,
  onConfirmar,
}: {
  venta: Venta;
  onCerrar: () => void;
  onConfirmar: (motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  return (
    <div className="hoja-fondo" role="dialog" aria-modal="true" aria-labelledby="cancelar-titulo">
      <div className="hoja">
        <div className="hoja-cabecera">
          <h2 id="cancelar-titulo">Cancelar {venta.folio}</h2>
          <button type="button" className="boton-icono" onClick={onCerrar} aria-label="Cerrar">
            <Icono nombre="cerrar" />
          </button>
        </div>
        <p className="hoja-entrada">
          {venta.cliente_nombre} · {formatearCentavos(venta.total_centavos)}. Queda en la bitácora y no se
          puede deshacer.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!motivo.trim()) return;
            setEnviando(true);
            void onConfirmar(motivo.trim());
          }}
        >
          <div className="campo">
            <label htmlFor="motivo-cancel">Motivo</label>
            <input id="motivo-cancel" value={motivo} onChange={(e) => setMotivo(e.target.value)} required />
          </div>
          <div className="hoja-acciones">
            <button type="button" className="btn btn-secundario" onClick={onCerrar}>
              Volver
            </button>
            <button type="submit" className="btn btn-peligro" disabled={!motivo.trim() || enviando}>
              Cancelar venta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
