import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { hoyMexico, sumarDias } from '../util/fecha';
import { Icono } from '../util/Icono';
import type { CapaDatos, Miembro, Prospecto, SesionAdmin } from './datos';
import { Cabecera, Cargando, ErrorCarga, Vacio } from './componentes/Estados';
import { etiquetaSiguientePaso } from './prospectosFecha';
import { ETAPAS, INTERESES, ORIGENES } from './textos';

export { etiquetaSiguientePaso } from './prospectosFecha';

/** La siguiente etapa natural: un toque para avanzar. */
const SIGUIENTE: Record<string, { etapa: string; etiqueta: string }> = {
  nuevo: { etapa: 'contactado', etiqueta: 'Ya lo contacté' },
  contactado: { etapa: 'demo', etiqueta: 'Agendé demo' },
  demo: { etapa: 'propuesta', etiqueta: 'Mandé propuesta' },
  propuesta: { etapa: 'ganado', etiqueta: 'Ganado' },
};

export function Prospectos({
  datos,
  sesion,
  onRegistrarVenta,
}: {
  datos: CapaDatos;
  sesion: SesionAdmin;
  onRegistrarVenta: (clienteId: string) => void;
}) {
  const hoy = hoyMexico();
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'error'>('cargando');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [lista, setLista] = useState<Prospecto[]>([]);
  const [filtro, setFiltro] = useState<string>('nuevo');
  const [alta, setAlta] = useState(false);
  const [perdido, setPerdido] = useState<Prospecto | null>(null);

  const cargar = useCallback(async () => {
    setEstado('cargando');
    const r = await datos.listarProspectos();
    if (!r.ok) {
      setError(r.error);
      setEstado('error');
      return;
    }
    setLista(r.datos);
    setEstado('ok');
  }, [datos]);

  useEffect(() => {
    void cargar();
  }, [cargar, sesion.usuarioId]);

  const conteos = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of lista) c[p.etapa] = (c[p.etapa] ?? 0) + 1;
    return c;
  }, [lista]);

  // Primero lo atrasado y lo de hoy; después por fecha del siguiente paso.
  const visibles = lista
    .filter((p) => p.etapa === filtro)
    .sort((a, b) => (a.siguiente_paso_en ?? '9999').localeCompare(b.siguiente_paso_en ?? '9999'));

  async function mover(p: Prospecto, etapa: string, motivo?: string) {
    setAviso('');
    if (etapa === 'ganado') {
      const r = await datos.convertirProspectoEnCliente(p.id);
      if (!r.ok) {
        setAviso(r.error);
        return;
      }
      onRegistrarVenta(r.datos.cliente.id);
      return;
    }
    const r = await datos.actualizarEtapaProspecto(p.id, etapa, motivo);
    setAviso(
      r.ok ? `${p.nombre} pasó a ${ETAPAS.find((e) => e.id === etapa)?.etiqueta.toLowerCase()}.` : r.error,
    );
    setPerdido(null);
    await cargar();
  }

  return (
    <>
      <Cabecera titulo="Prospectos" porque="Quién puede comprar y qué sigue con cada uno">
        <button type="button" className="btn btn-primario btn-control" onClick={() => setAlta(true)}>
          Nuevo prospecto
        </button>
      </Cabecera>
      {alta ? (
        <AltaProspecto
          datos={datos}
          sesion={sesion}
          onCerrar={() => setAlta(false)}
          onListo={(p) => {
            setAlta(false);
            setFiltro('nuevo');
            setAviso(`Anoté a ${p.nombre}.`);
            void cargar();
          }}
        />
      ) : null}
      {perdido ? (
        <HojaPerdido
          prospecto={perdido}
          onCerrar={() => setPerdido(null)}
          onConfirmar={async (motivo) => {
            await mover(perdido, 'perdido', motivo);
          }}
        />
      ) : null}

      <div className="pestanas" role="group" aria-label="Etapas">
        {ETAPAS.map((e) => (
          <button
            key={e.id}
            type="button"
            className="pestana"
            aria-pressed={filtro === e.id}
            onClick={() => setFiltro(e.id)}
          >
            {e.etiqueta} <span className="conteo">{conteos[e.id] ?? 0}</span>
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
      ) : visibles.length === 0 ? (
        <Vacio
          porqué={
            filtro === 'nuevo'
              ? 'No hay prospectos nuevos. Los que llenan «Hablar con un asesor» en la página llegan aquí solos.'
              : 'No hay prospectos en esta etapa.'
          }
        />
      ) : (
        <div className="panel tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Prospecto</th>
                <th className="sec">Siguiente paso</th>
                <th>
                  <span className="solo-lector">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => {
                const sig = SIGUIENTE[p.etapa];
                const fecha = etiquetaSiguientePaso(p.siguiente_paso_en, hoy);
                return (
                  <tr key={p.id}>
                    <td>
                      {p.nombre}
                      <span className="meta">
                        {INTERESES[p.interes] ?? p.interes} · {ORIGENES[p.origen] ?? p.origen}
                        {p.correo ? ` · ${p.correo}` : ''}
                        {p.telefono ? ` · ${p.telefono}` : ''}
                      </span>
                      <span className="meta-movil">
                        {p.siguiente_paso || 'Sin siguiente paso'}
                        {fecha ? ` · ${fecha}` : ''}
                      </span>
                      {p.motivo_perdida ? <span className="meta">Motivo: {p.motivo_perdida}</span> : null}
                    </td>
                    <td className="sec">
                      {p.siguiente_paso || 'Sin siguiente paso'}
                      {fecha ? <span className="meta">{fecha}</span> : null}
                    </td>
                    <td>
                      <div className="modulo-acciones">
                        {p.etapa !== 'ganado' && p.etapa !== 'perdido' ? (
                          <button
                            type="button"
                            className="btn btn-texto btn-texto-gris btn-control"
                            onClick={() => setPerdido(p)}
                          >
                            Marcar perdido
                          </button>
                        ) : null}
                        {sig ? (
                          <button
                            type="button"
                            className={`btn btn-control ${sig.etapa === 'ganado' ? 'btn-primario' : 'btn-secundario'}`}
                            onClick={() => void mover(p, sig.etapa)}
                          >
                            {sig.etiqueta}
                          </button>
                        ) : p.etapa === 'perdido' ? (
                          <button
                            type="button"
                            className="btn btn-secundario btn-control"
                            onClick={() => void mover(p, 'contactado')}
                          >
                            Reabrir
                          </button>
                        ) : p.cliente_id ? (
                          <button
                            type="button"
                            className="btn btn-secundario btn-control"
                            onClick={() => p.cliente_id && onRegistrarVenta(p.cliente_id)}
                          >
                            Registrar venta
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function HojaPerdido({
  prospecto,
  onCerrar,
  onConfirmar,
}: {
  prospecto: Prospecto;
  onCerrar: () => void;
  onConfirmar: (motivo: string | undefined) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  return (
    <div className="hoja-fondo" role="dialog" aria-modal="true" aria-labelledby="perdido-titulo">
      <div className="hoja">
        <div className="hoja-cabecera">
          <h2 id="perdido-titulo">Marcar perdido a {prospecto.nombre}</h2>
          <button type="button" className="boton-icono" onClick={onCerrar} aria-label="Cerrar">
            <Icono nombre="cerrar" />
          </button>
        </div>
        <p className="hoja-entrada">
          Queda en Perdidos y en la bitácora. El motivo es opcional.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setEnviando(true);
            void onConfirmar(motivo.trim() || undefined).finally(() => setEnviando(false));
          }}
        >
          <div className="campo">
            <label htmlFor="motivo-perdido">Motivo (opcional)</label>
            <input
              id="motivo-perdido"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="hoja-acciones">
            <button type="button" className="btn btn-secundario" onClick={onCerrar}>
              Volver
            </button>
            <button type="submit" className="btn btn-peligro" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Marcar perdido'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AltaProspecto({
  datos,
  sesion,
  onCerrar,
  onListo,
}: {
  datos: CapaDatos;
  sesion: SesionAdmin;
  onCerrar: () => void;
  onListo: (p: Prospecto) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [interes, setInteres] = useState('licencias');
  const [origen, setOrigen] = useState('llamada');
  const [paso, setPaso] = useState('Llamar para presentar Finanvoz');
  const [pasoEn, setPasoEn] = useState(sumarDias(hoyMexico(), 1));
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
    const r = await datos.crearProspecto({
      nombre: nombre.trim(),
      telefono: telefono.trim(),
      correo: correo.trim().toLowerCase(),
      interes,
      origen,
      siguiente_paso: paso.trim(),
      siguiente_paso_en: pasoEn || null,
      vendedor_id: sesion.rol === 'dueno' ? vendedor : sesion.usuarioId,
    });
    setEnviando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onListo(r.datos);
  }

  return (
    <div className="hoja-fondo" role="dialog" aria-modal="true" aria-labelledby="alta-prospecto-titulo">
      <div className="hoja">
        <div className="hoja-cabecera">
          <h2 id="alta-prospecto-titulo">Nuevo prospecto</h2>
          <button type="button" className="boton-icono" onClick={onCerrar} aria-label="Cerrar">
            <Icono nombre="cerrar" />
          </button>
        </div>
        <form onSubmit={enviar}>
          <div className="campo">
            <label htmlFor="pr-nombre">Nombre o negocio</label>
            <input
              id="pr-nombre"
              required
              maxLength={200}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="pr-tel">Teléfono</label>
            <input id="pr-tel" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="pr-correo">Correo</label>
            <input id="pr-correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="pr-interes">Le interesa</label>
            <select id="pr-interes" value={interes} onChange={(e) => setInteres(e.target.value)}>
              {Object.entries(INTERESES).map(([id, etiqueta]) => (
                <option key={id} value={id}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="pr-origen">Cómo llegó</label>
            <select id="pr-origen" value={origen} onChange={(e) => setOrigen(e.target.value)}>
              {Object.entries(ORIGENES).map(([id, etiqueta]) => (
                <option key={id} value={id}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="pr-paso">Siguiente paso</label>
            <input id="pr-paso" value={paso} onChange={(e) => setPaso(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="pr-cuando">Cuándo</label>
            <input id="pr-cuando" type="date" value={pasoEn} onChange={(e) => setPasoEn(e.target.value)} />
          </div>
          {sesion.rol === 'dueno' && vendedores.length > 0 ? (
            <div className="campo">
              <label htmlFor="pr-vendedor">Lo atiende</label>
              <select id="pr-vendedor" value={vendedor} onChange={(e) => setVendedor(e.target.value)}>
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
              {enviando ? 'Guardando…' : 'Guardar prospecto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
