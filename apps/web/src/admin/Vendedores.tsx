import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { centavosDePesos, formatearCentavos, pesosDeCentavos } from '../util/dinero';
import { encabezadoMes, hoyMexico, inicioDeMes } from '../util/fecha';
import { Icono } from '../util/Icono';
import type { CapaDatos, ComisionMes, Miembro, SesionAdmin } from './datos';
import { Cabecera, Cargando, ErrorCarga, Vacio } from './componentes/Estados';

export function Vendedores({ datos, sesion }: { datos: CapaDatos; sesion: SesionAdmin }) {
  const hoy = hoyMexico();
  const esDueno = sesion.rol === 'dueno';
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'error'>('cargando');
  const [error, setError] = useState('');
  const [coms, setComs] = useState<ComisionMes[]>([]);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [editando, setEditando] = useState<Miembro | 'nuevo' | null>(null);

  const cargar = useCallback(async () => {
    setEstado('cargando');
    const [c, m] = await Promise.all([datos.comisiones(inicioDeMes(hoy)), datos.listarMiembros()]);
    if (!c.ok) {
      setError(c.error);
      setEstado('error');
      return;
    }
    setComs(c.datos);
    setMiembros(m.ok ? m.datos : []);
    setEstado('ok');
  }, [datos, hoy]);

  useEffect(() => {
    void cargar();
  }, [cargar, sesion.usuarioId]);

  const totalComision = coms.reduce((s, c) => s + c.comision_centavos, 0);

  return (
    <>
      <Cabecera
        titulo={esDueno ? 'Vendedores y comisiones' : 'Tus comisiones'}
        porque={`Cuánto cobró cada quien y cuánto le toca · ${encabezadoMes(hoy)}`}
      >
        {esDueno ? (
          <button type="button" className="btn btn-primario btn-control" onClick={() => setEditando('nuevo')}>
            Agregar vendedor
          </button>
        ) : null}
      </Cabecera>

      {estado === 'cargando' ? (
        <Cargando filas={3} />
      ) : estado === 'error' ? (
        <ErrorCarga mensaje={error} onReintentar={() => void cargar()} />
      ) : (
        <>
          {coms.length === 0 ? (
            <Vacio porqué="Nadie ha vendido este mes todavía. Las comisiones salen de lo cobrado." />
          ) : (
            <div className="panel tabla-wrap">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Vendedor</th>
                    <th className="sec monto">Vendido</th>
                    <th className="sec monto">Por cobrar</th>
                    <th className="monto">Cobrado</th>
                    <th className="monto">Comisión</th>
                  </tr>
                </thead>
                <tbody>
                  {coms.map((c) => {
                    const pct =
                      c.meta_mensual_centavos > 0
                        ? Math.round((100 * c.cobrado_centavos) / c.meta_mensual_centavos)
                        : null;
                    return (
                      <tr key={c.vendedor_id}>
                        <td>
                          {c.vendedor_nombre}
                          <span className="meta">
                            {pct === null
                              ? 'Sin meta'
                              : `${pct} % de su meta de ${formatearCentavos(c.meta_mensual_centavos)}`}
                          </span>
                        </td>
                        <td className="sec monto">{formatearCentavos(c.vendido_centavos)}</td>
                        <td className="sec monto">{formatearCentavos(c.por_cobrar_centavos)}</td>
                        <td className="monto">{formatearCentavos(c.cobrado_centavos)}</td>
                        <td className="monto">{formatearCentavos(c.comision_centavos)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {esDueno && coms.length > 1 ? (
                  <tfoot>
                    <tr>
                      <td>Total a pagar en comisiones</td>
                      <td className="sec" />
                      <td className="sec" />
                      <td />
                      <td className="monto">{formatearCentavos(totalComision)}</td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          )}

          {esDueno ? (
            <section className="panel seccion-separada" aria-labelledby="t-equipo">
              <div className="panel-cabecera">
                <div>
                  <h2 id="t-equipo">Equipo</h2>
                  <p className="panel-subtitulo">Quién entra al panel, su meta y su comisión</p>
                </div>
              </div>
              <div className="tabla-wrap">
                <table className="tabla">
                  <tbody>
                    {miembros.map((m) => (
                      <tr key={m.usuario_id}>
                        <td>
                          {m.nombre}
                          <span className="meta">
                            {m.rol === 'dueno' ? 'Dueño' : 'Vendedor'}
                            {m.activo ? '' : ' · sin acceso'}
                            {m.rol === 'vendedor'
                              ? ` · meta ${formatearCentavos(m.meta_mensual_centavos)} · ${
                                  m.comision_pb == null
                                    ? 'comisión general'
                                    : `comisión ${pesosDeCentavos(m.comision_pb)} %`
                                }`
                              : ''}
                          </span>
                        </td>
                        <td className="monto">
                          <button
                            type="button"
                            className="btn btn-texto btn-control"
                            onClick={() => setEditando(m)}
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      )}

      {editando && esDueno ? (
        <HojaMiembro
          datos={datos}
          miembro={editando === 'nuevo' ? null : editando}
          onCerrar={() => setEditando(null)}
          onListo={() => {
            setEditando(null);
            void cargar();
          }}
        />
      ) : null}
    </>
  );
}

function HojaMiembro({
  datos,
  miembro,
  onCerrar,
  onListo,
}: {
  datos: CapaDatos;
  miembro: Miembro | null;
  onCerrar: () => void;
  onListo: () => void;
}) {
  const [usuarioId, setUsuarioId] = useState(miembro?.usuario_id ?? '');
  const [nombre, setNombre] = useState(miembro?.nombre ?? '');
  const [rol, setRol] = useState<'dueno' | 'vendedor'>(miembro?.rol ?? 'vendedor');
  const [activo, setActivo] = useState(miembro?.activo ?? true);
  const [meta, setMeta] = useState(miembro ? pesosDeCentavos(miembro.meta_mensual_centavos) : '');
  const [comision, setComision] = useState(
    miembro?.comision_pb != null ? pesosDeCentavos(miembro.comision_pb) : '',
  );
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const metaCentavos = meta.trim() === '' ? 0 : centavosDePesos(meta);
  const comisionPb = comision.trim() === '' ? null : centavosDePesos(comision);
  const comisionMala = comision.trim() !== '' && (comisionPb === null || comisionPb > 10000);
  const valido = Boolean(usuarioId.trim() && nombre.trim()) && metaCentavos !== null && !comisionMala;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!valido || metaCentavos === null) return;
    setEnviando(true);
    const r = await datos.guardarMiembro({
      usuario_id: usuarioId.trim(),
      nombre: nombre.trim(),
      rol,
      activo,
      meta_mensual_centavos: metaCentavos,
      comision_pb: comisionPb,
    });
    setEnviando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onListo();
  }

  return (
    <div className="hoja-fondo" role="dialog" aria-modal="true" aria-labelledby="miembro-titulo">
      <div className="hoja">
        <div className="hoja-cabecera">
          <h2 id="miembro-titulo">{miembro ? `Editar a ${miembro.nombre}` : 'Agregar vendedor'}</h2>
          <button type="button" className="boton-icono" onClick={onCerrar} aria-label="Cerrar">
            <Icono nombre="cerrar" />
          </button>
        </div>
        <form onSubmit={enviar}>
          {miembro ? null : (
            <div className="campo">
              <label htmlFor="m-uid">Id de su cuenta</label>
              <input id="m-uid" required value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} />
              <span className="pista">
                Primero crea su cuenta con correo y contraseña en Supabase (Authentication) y pega aquí su id.
              </span>
            </div>
          )}
          <div className="campo">
            <label htmlFor="m-nombre">Nombre</label>
            <input id="m-nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="m-rol">Rol</label>
            <select id="m-rol" value={rol} onChange={(e) => setRol(e.target.value as 'dueno' | 'vendedor')}>
              <option value="vendedor">Vendedor: ve y vende solo lo suyo</option>
              <option value="dueno">Dueño: ve todo, cobra y ajusta</option>
            </select>
          </div>
          {rol === 'vendedor' ? (
            <>
              <div className="campo">
                <label htmlFor="m-meta">Meta mensual ($)</label>
                <input
                  id="m-meta"
                  inputMode="decimal"
                  value={meta}
                  onChange={(e) => setMeta(e.target.value)}
                />
              </div>
              <div className="campo">
                <label htmlFor="m-com">Comisión (%)</label>
                <input
                  id="m-com"
                  inputMode="decimal"
                  value={comision}
                  aria-invalid={comisionMala || undefined}
                  onChange={(e) => setComision(e.target.value)}
                />
                <span className={comisionMala ? 'error-campo' : 'pista'}>
                  {comisionMala
                    ? 'Escribe un porcentaje entre 0 y 100.'
                    : 'Vacío = la comisión general de Ajustes.'}
                </span>
              </div>
            </>
          ) : null}
          <div className="campo campo-casilla">
            <input
              id="m-activo"
              type="checkbox"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
            />
            <label htmlFor="m-activo">Puede entrar al panel</label>
          </div>
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
              {enviando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
