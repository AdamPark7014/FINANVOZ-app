import { useId, useState, type FormEvent } from 'react';
import { PROSPECTO_URL } from '../config';
import { Icono } from '../util/Icono';

type Envio = 'inicial' | 'enviando' | 'listo' | 'error' | 'limite';

export function FormularioAsesor({ onCerrar }: { onCerrar: () => void }) {
  const id = useId();
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [interes, setInteres] = useState('licencias');
  const [mensaje, setMensaje] = useState('');
  const [trampa, setTrampa] = useState('');
  const [envio, setEnvio] = useState<Envio>('inicial');

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!PROSPECTO_URL) {
      setEnvio('error');
      return;
    }
    setEnvio('enviando');
    try {
      const r = await fetch(PROSPECTO_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nombre,
          correo,
          telefono,
          contacto: '',
          interes,
          mensaje,
          sitio_web: trampa,
        }),
      });
      if (r.ok) setEnvio('listo');
      else if (r.status === 429) setEnvio('limite');
      else setEnvio('error');
    } catch {
      setEnvio('error');
    }
  }

  return (
    <div className="hoja-fondo" role="dialog" aria-modal="true" aria-labelledby={`${id}-titulo`}>
      <div className="hoja">
        <div className="hoja-cabecera">
          <h2 id={`${id}-titulo`}>Hablar con un asesor</h2>
          <button type="button" className="boton-icono" onClick={onCerrar} aria-label="Cerrar">
            <Icono nombre="cerrar" />
          </button>
        </div>
        <p className="hoja-entrada">Déjanos tus datos y una persona del equipo te contacta.</p>
        {envio === 'listo' ? (
          <p role="status">Recibimos tu mensaje. Te escribimos pronto.</p>
        ) : envio === 'limite' ? (
          <div className="estado-error" role="alert">
            <p>Llegaste al límite de envíos por ahora. Intenta en una hora.</p>
            <button type="button" className="btn btn-primario" onClick={() => setEnvio('inicial')}>
              Reintentar
            </button>
          </div>
        ) : envio === 'error' ? (
          <div className="estado-error" role="alert">
            <p>No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.</p>
            <button type="button" className="btn btn-primario" onClick={() => setEnvio('inicial')}>
              Reintentar
            </button>
          </div>
        ) : (
          <form onSubmit={enviar}>
            <div className="campo">
              <label htmlFor={`${id}-nombre`}>Nombre</label>
              <input
                id={`${id}-nombre`}
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
            <div className="campo">
              <label htmlFor={`${id}-correo`}>Correo</label>
              <input
                id={`${id}-correo`}
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
              />
            </div>
            <div className="campo">
              <label htmlFor={`${id}-tel`}>Teléfono</label>
              <input id={`${id}-tel`} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor={`${id}-interes`}>Te interesa</label>
              <select id={`${id}-interes`} value={interes} onChange={(e) => setInteres(e.target.value)}>
                <option value="plus">Plus</option>
                <option value="licencias">Licencias para equipo o clientes</option>
                <option value="otro">Otra cosa</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor={`${id}-msg`}>Mensaje</label>
              <textarea
                id={`${id}-msg`}
                rows={3}
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
              />
            </div>
            <div className="hp" aria-hidden="true">
              <label htmlFor={`${id}-web`}>Sitio web</label>
              <input
                id={`${id}-web`}
                tabIndex={-1}
                autoComplete="off"
                value={trampa}
                onChange={(e) => setTrampa(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primario" disabled={envio === 'enviando'}>
              {envio === 'enviando' ? 'Enviando…' : 'Enviar'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
