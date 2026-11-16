import { useId, useState, type FormEvent } from 'react';
import { MARCA } from '../config';
import { Icono } from '../util/Icono';
import type { CapaDatos, SesionAdmin } from './datos';

export function Login({ datos, onOk }: { datos: CapaDatos; onOk: (s: SesionAdmin) => void }) {
  const id = useId();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const r = await datos.iniciarSesion(correo.trim(), contrasena);
    setEnviando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onOk(r.datos);
  }

  return (
    <main className="login" id="contenido">
      <div className="tarjeta">
        <span className="marca-cuadro">
          <Icono nombre="marca" tamano={16} />
        </span>
        <h1>Entra a {MARCA} admin</h1>
        <p className="porque">Para el dueño y los vendedores con cuenta activa.</p>
        <form onSubmit={enviar}>
          <div className="campo">
            <label htmlFor={`${id}-correo`}>Correo</label>
            <input
              id={`${id}-correo`}
              type="email"
              autoComplete="username"
              required
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor={`${id}-pass`}>Contraseña</label>
            <input
              id={`${id}-pass`}
              type="password"
              autoComplete="current-password"
              required
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
            />
          </div>
          {error ? (
            <p className="error-campo" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn btn-primario" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  );
}
