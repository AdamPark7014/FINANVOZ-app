import { useCallback, useEffect, useState } from 'react';
import { formatearCentavos } from '../util/dinero';
import { encabezadoMes, fechaCorta, hoyMexico, inicioDeMes } from '../util/fecha';
import { irA } from '../util/router';
import type { CapaDatos, ComisionMes, Prospecto, ResumenMes, SesionAdmin, Venta } from './datos';
import { Cabecera, Cargando, ErrorCarga, Vacio } from './componentes/Estados';
import { ESTADOS_VENTA, describirVenta } from './textos';

type Pendientes = { ventasPorVencer: Venta[]; pasosVencidos: Prospecto[] };

export function Resumen({ datos, sesion }: { datos: CapaDatos; sesion: SesionAdmin }) {
  const hoy = hoyMexico();
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'error'>('cargando');
  const [error, setError] = useState('');
  const [resumen, setResumen] = useState<ResumenMes | null>(null);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [coms, setComs] = useState<ComisionMes[]>([]);
  const [pendientes, setPendientes] = useState<Pendientes>({ ventasPorVencer: [], pasosVencidos: [] });

  const cargar = useCallback(async () => {
    setEstado('cargando');
    const [r, v, c, p] = await Promise.all([
      datos.resumen(hoy),
      datos.ultimasVentas(6),
      datos.comisiones(inicioDeMes(hoy)),
      datos.pendientesHoy(),
    ]);
    if (!r.ok) {
      setError(r.error);
      setEstado('error');
      return;
    }
    setResumen(r.datos);
    setVentas(v.ok ? v.datos : []);
    setComs(c.ok ? c.datos : []);
    setPendientes(p.ok ? p.datos : { ventasPorVencer: [], pasosVencidos: [] });
    setEstado('ok');
  }, [datos, hoy]);

  useEffect(() => {
    void cargar();
  }, [cargar, sesion.usuarioId]);

  const esDueno = sesion.rol === 'dueno';
  const cabecera = (
    <Cabecera titulo="Resumen" porque={`Lo que entró este mes y lo que falta cobrar · ${encabezadoMes(hoy)}`}>
      <button type="button" className="btn btn-primario btn-control" onClick={() => irA('/admin/ventas')}>
        Registrar venta
      </button>
    </Cabecera>
  );

  if (estado === 'cargando')
    return (
      <>
        {cabecera}
        <Cargando filas={5} />
      </>
    );
  if (estado === 'error' || !resumen)
    return (
      <>
        {cabecera}
        <ErrorCarga mensaje={error || 'No se pudo cargar el resumen.'} onReintentar={() => void cargar()} />
      </>
    );

  const totalPendientes = pendientes.ventasPorVencer.length + pendientes.pasosVencidos.length;

  return (
    <>
      {cabecera}

      <section aria-label="Cifras del mes" className="tira">
        <div>
          <p className="cifra-label">Cobrado este mes</p>
          <p className="cifra-valor num">{formatearCentavos(resumen.ingreso_cobrado_centavos)}</p>
          <p className="cifra-pista num">
            Plus {formatearCentavos(resumen.ingreso_plus_centavos)} · licencias{' '}
            {formatearCentavos(resumen.ingreso_licencias_centavos)}
          </p>
        </div>
        <div>
          <p className="cifra-label">Por cobrar</p>
          <p className="cifra-valor num">{formatearCentavos(resumen.por_cobrar_centavos)}</p>
          <p className="cifra-pista">
            {pendientes.ventasPorVencer.length === 0
              ? 'Nada vence esta semana'
              : `${pendientes.ventasPorVencer.length} vence${pendientes.ventasPorVencer.length === 1 ? '' : 'n'} esta semana`}
          </p>
        </div>
        <div>
          <p className="cifra-label">Prospectos abiertos</p>
          <p className="cifra-valor num">{resumen.prospectos_abiertos}</p>
          <p className="cifra-pista">Cierras {resumen.tasa_cierre} % de los que terminan</p>
        </div>
        {esDueno ? (
          <div>
            <p className="cifra-label">Plus activos en la app</p>
            <p className="cifra-valor num">{resumen.plus_activos.toLocaleString('es-MX')}</p>
            <p className="cifra-pista num">
              {resumen.usuarios_activos_7d.toLocaleString('es-MX')} usaron el asistente en 7 días
            </p>
          </div>
        ) : (
          <div>
            <p className="cifra-label">Ventas del mes</p>
            <p className="cifra-valor num">{resumen.ventas}</p>
            <p className="cifra-pista">Sin contar canceladas</p>
          </div>
        )}
      </section>

      <div className="columnas">
        <section aria-labelledby="t-ventas" className="panel columna-ancha">
          <div className="panel-cabecera">
            <h2 id="t-ventas">Últimas ventas</h2>
            <a
              href="/admin/ventas"
              onClick={(e) => {
                e.preventDefault();
                irA('/admin/ventas');
              }}
            >
              Ver todas
            </a>
          </div>
          {ventas.length === 0 ? (
            <div className="panel-cuerpo">
              <Vacio
                porqué="Todavía no hay ventas. La primera aparece aquí en cuanto la registres."
                accion="Registrar venta"
                onAccion={() => irA('/admin/ventas')}
              />
            </div>
          ) : (
            <div className="tabla-wrap">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th className="sec">Qué compró</th>
                    {esDueno ? <th className="sec">Vendedor</th> : null}
                    <th className="sec">Estado</th>
                    <th className="monto">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {ventas.map((v) => (
                    <tr key={v.id}>
                      <td>
                        {v.cliente_nombre || 'Cliente'}
                        <span className="meta">
                          Folio {v.folio} · {fechaCorta(v.creado_en)}
                        </span>
                        <span className="meta-movil">
                          {describirVenta(v)} · {ESTADOS_VENTA[v.estado] ?? v.estado}
                        </span>
                      </td>
                      <td className="sec">{describirVenta(v)}</td>
                      {esDueno ? <td className="sec">{v.vendedor_nombre}</td> : null}
                      <td className="sec">
                        <span className={`estado estado-${v.estado}`}>
                          {ESTADOS_VENTA[v.estado] ?? v.estado}
                        </span>
                      </td>
                      <td className="monto">{formatearCentavos(v.total_centavos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="t-vend" className="panel columna-angosta">
          <div className="panel-cabecera">
            <div>
              <h2 id="t-vend">{esDueno ? 'Vendedores este mes' : 'Tu mes'}</h2>
              <p className="panel-subtitulo">Comisión sobre lo cobrado</p>
            </div>
          </div>
          <div className="panel-cuerpo">
            {coms.length === 0 ? (
              <p className="panel-subtitulo">Aún no hay ventas este mes.</p>
            ) : (
              coms.map((c) => {
                const pct =
                  c.meta_mensual_centavos > 0
                    ? Math.min(100, Math.round((100 * c.cobrado_centavos) / c.meta_mensual_centavos))
                    : 0;
                return (
                  <div key={c.vendedor_id} className="vendedor">
                    <div className="vendedor-fila">
                      <strong>{c.vendedor_nombre}</strong>
                      <span className="num">{formatearCentavos(c.cobrado_centavos)}</span>
                    </div>
                    <div className="vendedor-fila vendedor-detalle">
                      <span>
                        Vendido {formatearCentavos(c.vendido_centavos)}
                        {c.por_cobrar_centavos > 0
                          ? ` · ${formatearCentavos(c.por_cobrar_centavos)} por cobrar`
                          : ''}
                      </span>
                      <span className="num">Comisión {formatearCentavos(c.comision_centavos)}</span>
                    </div>
                    {c.meta_mensual_centavos > 0 ? (
                      <>
                        <div
                          className="barra"
                          role="progressbar"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Meta de ${c.vendedor_nombre}`}
                        >
                          <span style={{ width: `${pct}%` }} />
                        </div>
                        <p className="vendedor-detalle">
                          {pct} % de su meta de {formatearCentavos(c.meta_mensual_centavos)}
                        </p>
                      </>
                    ) : null}
                  </div>
                );
              })
            )}

            <h3>Pendiente hoy</h3>
            {totalPendientes === 0 ? (
              <p className="panel-subtitulo">Nada vence hoy. Buen momento para buscar prospectos.</p>
            ) : (
              <ul className="lista-pendientes">
                {pendientes.ventasPorVencer.map((v) => (
                  <li key={v.id}>
                    Cobrar {v.folio} a {v.cliente_nombre || 'cliente'}
                    {v.vence_en ? ` · vence el ${fechaCorta(v.vence_en)}` : ''}
                  </li>
                ))}
                {pendientes.pasosVencidos.map((p) => (
                  <li key={p.id}>
                    {p.nombre}: {p.siguiente_paso || 'definir el siguiente paso'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
