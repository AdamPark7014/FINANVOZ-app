import { useState, type ReactNode } from 'react';
import { MARCA } from '../config';
import { Icono } from '../util/Icono';
import { irA } from '../util/router';
import type { SesionAdmin } from './datos';

const LINKS: { id: string; etiqueta: string; soloDueno?: boolean }[] = [
  { id: 'resumen', etiqueta: 'Resumen' },
  { id: 'prospectos', etiqueta: 'Prospectos' },
  { id: 'clientes', etiqueta: 'Clientes' },
  { id: 'ventas', etiqueta: 'Ventas' },
  { id: 'vendedores', etiqueta: 'Vendedores y comisiones' },
  { id: 'ajustes', etiqueta: 'Ajustes', soloDueno: true },
];

export function Layout({
  sesion,
  seccion,
  demo = false,
  onSalir,
  children,
}: {
  sesion: SesionAdmin;
  seccion: string;
  demo?: boolean;
  onSalir: () => void;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const links = LINKS.filter((l) => !l.soloDueno || sesion.rol === 'dueno');

  return (
    <div className="admin">
      <aside className={`admin-nav${abierto ? ' abierto' : ''}`}>
        <div className="admin-nav-cabecera">
          <a
            className="admin-marca"
            href="/admin/resumen"
            onClick={(e) => {
              e.preventDefault();
              irA('/admin/resumen');
            }}
          >
            <span className="marca-cuadro admin-marca-cuadro">
              <Icono nombre="marca" tamano={14} />
            </span>
            <span>
              {MARCA} <span className="admin-marca-sufijo">admin</span>
            </span>
          </a>
          <button
            type="button"
            className="boton-icono admin-menu"
            aria-expanded={abierto}
            aria-controls="admin-modulos"
            aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setAbierto((a) => !a)}
          >
            <Icono nombre={abierto ? 'cerrar' : 'menu'} />
          </button>
        </div>
        <nav id="admin-modulos" className="admin-links" aria-label="Módulos">
          {links.map((l) => (
            <a
              key={l.id}
              href={`/admin/${l.id}`}
              aria-current={seccion === l.id ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                setAbierto(false);
                irA(`/admin/${l.id}`);
              }}
            >
              {l.etiqueta}
            </a>
          ))}
        </nav>
        <div className="admin-usuario">
          <span>
            {sesion.nombre} · {sesion.rol === 'dueno' ? 'Dueño' : 'Vendedor'}
          </span>
          <button type="button" className="boton-icono" onClick={onSalir} aria-label="Salir">
            <Icono nombre="salir" tamano={18} />
          </button>
        </div>
      </aside>
      <main className="admin-main" id="contenido">
        {demo ? (
          <p className="aviso-demo" role="note">
            Datos de ejemplo para ver el panel sin servidor. Nada de esto se guarda.
          </p>
        ) : null}
        {children}
      </main>
    </div>
  );
}
