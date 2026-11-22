import { useCallback, useEffect, useState } from 'react';
import { FILTROS_ACTIVIDAD, describirActividad } from './actividadTexto';
import type { CapaDatos, FilaActividad, SesionAdmin } from './datos';
import { Cabecera, Cargando, ErrorCarga, SinPermiso, Vacio } from './componentes/Estados';

const LIMITE = 50;

export function Actividad({ datos, sesion }: { datos: CapaDatos; sesion: SesionAdmin }) {
  const esDueno = sesion.rol === 'dueno';
  const [filtro, setFiltro] = useState('todo');
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'error'>('cargando');
  const [error, setError] = useState('');
  const [filas, setFilas] = useState<FilaActividad[]>([]);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);

  const tablas = FILTROS_ACTIVIDAD.find((f) => f.id === filtro)?.tablas;

  const cargar = useCallback(
    async (antesDe?: number, acumular = false) => {
      if (!esDueno) return;
      if (acumular) setCargandoMas(true);
      else {
        setEstado('cargando');
        setFilas([]);
      }
      const r = await datos.listarActividad({
        ...(tablas ? { tablas } : {}),
        ...(antesDe != null ? { antesDe } : {}),
        limite: LIMITE,
      });
      if (!r.ok) {
        setError(r.error);
        setEstado('error');
        setCargandoMas(false);
        return;
      }
      setFilas((prev) => (acumular ? [...prev, ...r.datos] : r.datos));
      setHayMas(r.datos.length >= LIMITE);
      setEstado('ok');
      setCargandoMas(false);
    },
    [datos, esDueno, tablas],
  );

  useEffect(() => {
    if (!esDueno) return;
    void cargar();
  }, [cargar, esDueno, sesion.usuarioId, filtro]);

  const cabecera = <Cabecera titulo="Actividad" porque="Quién cambió qué y cuándo. Nadie puede borrarla." />;

  if (!esDueno) {
    return (
      <>
        {cabecera}
        <SinPermiso />
      </>
    );
  }

  return (
    <>
      {cabecera}

      <div className="pestanas" role="group" aria-label="Filtrar actividad">
        {FILTROS_ACTIVIDAD.map((f) => (
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

      {estado === 'cargando' ? (
        <Cargando filas={5} />
      ) : estado === 'error' ? (
        <ErrorCarga mensaje={error} onReintentar={() => void cargar()} />
      ) : filas.length === 0 ? (
        <Vacio porqué="Todavía no hay movimientos. Cada alta, cobro o ajuste queda aquí para siempre." />
      ) : (
        <section className="panel" aria-label="Movimientos">
          <ul className="lista-actividad">
            {filas.map((f) => {
              // «Quién hizo qué · cuándo»: el cuándo va aparte, a la derecha, para leer la columna de un vistazo.
              const frase = describirActividad(f);
              const corte = frase.lastIndexOf(' · ');
              const que = corte > 0 ? frase.slice(0, corte) : frase;
              const cuando = corte > 0 ? frase.slice(corte + 3) : '';
              return (
                <li key={f.id}>
                  <span className="actividad-inicial" aria-hidden="true">
                    {(f.usuario_nombre.trim()[0] ?? '·').toUpperCase()}
                  </span>
                  <p>{que}</p>
                  {cuando ? <span className="actividad-cuando num">{cuando}</span> : null}
                </li>
              );
            })}
          </ul>
          {hayMas ? (
            <div className="panel-cuerpo">
              <button
                type="button"
                className="btn btn-secundario"
                disabled={cargandoMas}
                onClick={() => {
                  const ultimo = filas[filas.length - 1];
                  if (ultimo) void cargar(ultimo.id, true);
                }}
              >
                {cargandoMas ? 'Cargando…' : 'Ver más'}
              </button>
            </div>
          ) : null}
        </section>
      )}
    </>
  );
}
