import type { ReactNode } from 'react';

/** Título del módulo, su porqué en una línea y, a la derecha, sus acciones (una sola primaria). */
export function Cabecera({
  titulo,
  porque,
  children,
}: {
  titulo: string;
  porque: string;
  children?: ReactNode;
}) {
  return (
    <div className="modulo-cabecera">
      <div>
        <h1>{titulo}</h1>
        <p className="porque">{porque}</p>
      </div>
      {children ? <div className="modulo-acciones">{children}</div> : null}
    </div>
  );
}

export function Cargando({ filas = 3 }: { filas?: number }) {
  return (
    <div aria-busy="true" aria-label="Cargando">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="esqueleto" />
      ))}
    </div>
  );
}

export function Vacio({
  porqué,
  accion,
  onAccion,
}: {
  porqué: string;
  accion?: string | undefined;
  onAccion?: (() => void) | undefined;
}) {
  return (
    <div className="estado-vacio">
      <p>{porqué}</p>
      {accion && onAccion ? (
        <button type="button" className="btn btn-primario" onClick={onAccion}>
          {accion}
        </button>
      ) : null}
    </div>
  );
}

export function ErrorCarga({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  return (
    <div className="estado-error" role="alert">
      <p>{mensaje}</p>
      <button type="button" className="btn btn-secundario" onClick={onReintentar}>
        Reintentar
      </button>
    </div>
  );
}

export function SinPermiso() {
  return (
    <div className="estado-permiso" role="status">
      <p>Esta sección es solo para el dueño. Si la necesitas, pídele acceso a Adam.</p>
    </div>
  );
}
