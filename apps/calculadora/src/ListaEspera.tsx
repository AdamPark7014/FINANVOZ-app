import { useId, useRef, useState, type FormEvent } from 'react';
import { LISTA_ESPERA_URL, MARCA, RESPONSABLE, RESPONSABLE_DEFINIDO, VERSION_AVISO } from './config';
import { LISTA_ESPERA_TITULO_EXITO, listaEsperaTextoExito } from './textos';

/** Mismo contrato que `services/proxy/supabase/functions/_shared/lista-espera.ts`. */
const PREGUNTAS = [
  {
    clave: 'telefono',
    texto: '¿Usas Android o iPhone?',
    opciones: [
      ['android', 'Android'],
      ['iphone', 'iPhone'],
    ],
  },
  {
    clave: 'notificaciones',
    texto: '¿Tu banco te avisa con una notificación en cada compra?',
    opciones: [
      ['si', 'Sí, siempre'],
      ['a_veces', 'A veces'],
      ['no', 'No'],
      ['no_se', 'No sé'],
    ],
  },
  {
    clave: 'precio',
    texto: '¿Cuánto pagarías al mes por una app que te diga cuánto puedes gastar hoy?',
    opciones: [
      ['0', 'Solo la usaría gratis'],
      ['hasta_49', 'Hasta $49'],
      ['50_99', 'De $50 a $99'],
      ['100_mas', '$100 o más'],
    ],
  },
  {
    clave: 'uso',
    texto: '¿Para qué la usarías?',
    opciones: [
      ['personal', 'Personal'],
      ['negocio', 'Mi negocio o freelance'],
      ['contador', 'Soy contador'],
    ],
  },
] as const;

type Clave = (typeof PREGUNTAS)[number]['clave'];
type Envio = 'inicial' | 'enviando' | 'listo' | 'error' | 'limite';

/** Correo con forma razonable; la validación definitiva la hace la función del servidor. */
export const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function ListaEspera() {
  const id = useId();
  const [correo, setCorreo] = useState('');
  const [respuestas, setRespuestas] = useState<Partial<Record<Clave, string>>>({});
  const [acepta, setAcepta] = useState(false);
  const [trampa, setTrampa] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [faltan, setFaltan] = useState<readonly Clave[]>([]);
  const [envio, setEnvio] = useState<Envio>('inicial');
  const grupos = useRef<Partial<Record<Clave, HTMLFieldSetElement | null>>>({});

  function responder(clave: Clave, valor: string) {
    setRespuestas((r) => ({ ...r, [clave]: valor }));
    if (faltan.length && faltan.every((c) => c === clave || respuestas[c])) {
      setFaltan([]);
      setError(null);
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setFaltan([]);
    if (!CORREO_VALIDO.test(correo.trim()))
      return setError('Revisa tu correo: le falta algo, como la @ o el dominio.');
    const sinContestar = PREGUNTAS.filter((p) => !respuestas[p.clave]);
    const primera = sinContestar[0];
    if (primera) {
      setFaltan(sinContestar.map((p) => p.clave));
      grupos.current[primera.clave]?.querySelector('input')?.focus();
      return setError(
        sinContestar.length === 1
          ? `Falta contestar: ${primera.texto}`
          : `Faltan ${sinContestar.length} preguntas por contestar. Empieza por: ${primera.texto}`,
      );
    }
    if (!acepta) return setError('Para anotarte, marca que leíste y aceptas el aviso de privacidad.');
    if (!LISTA_ESPERA_URL) return setError('La lista de espera todavía no está abierta. Vuelve pronto.');
    setError(null);
    setEnvio('enviando');
    try {
      // Solo correo y respuestas. Los montos de la calculadora nunca se envían (CA-M0-07).
      const r = await fetch(LISTA_ESPERA_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          correo: correo.trim(),
          respuestas,
          consentimiento: acepta,
          version_aviso: VERSION_AVISO,
          sitio_web: trampa,
        }),
      });
      setEnvio(r.ok ? 'listo' : r.status === 429 ? 'limite' : 'error');
    } catch {
      setEnvio('error');
    }
  }

  if (envio === 'listo') {
    return (
      <section className="tarjeta" aria-live="polite">
        <h2>{LISTA_ESPERA_TITULO_EXITO}</h2>
        <p>{listaEsperaTextoExito(MARCA)}</p>
      </section>
    );
  }

  return (
    <section className="tarjeta" aria-labelledby={`${id}-titulo`}>
      <h2 id={`${id}-titulo`}>¿Quieres saber cuánto puedes gastar cada día?</h2>
      <p>
        {MARCA} es una app que te lo dice: le hablas, registra tus gastos y te avisa si llegas a la quincena.
        Anótate para la beta.
      </p>
      <form onSubmit={enviar} noValidate aria-label="Formulario para anotarte en la lista de espera">
        <div className="campo">
          <label htmlFor={`${id}-correo`}>Tu correo</label>
          <input
            id={`${id}-correo`}
            type="email"
            autoComplete="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </div>
        {PREGUNTAS.map((p) => {
          const invalida = faltan.includes(p.clave) && !respuestas[p.clave];
          const idError = `${id}-${p.clave}-error`;
          return (
            <fieldset
              key={p.clave}
              ref={(el) => {
                grupos.current[p.clave] = el;
              }}
              className="opciones"
              role="radiogroup"
              aria-required="true"
              aria-invalid={invalida || undefined}
              aria-describedby={invalida ? idError : undefined}
            >
              <legend>{p.texto}</legend>
              {p.opciones.map(([valor, texto]) => (
                <label key={valor} className="opcion">
                  <input
                    type="radio"
                    name={`${id}-${p.clave}`}
                    value={valor}
                    checked={respuestas[p.clave] === valor}
                    onChange={() => responder(p.clave, valor)}
                  />
                  {texto}
                </label>
              ))}
              {invalida && (
                <p id={idError} className="error">
                  Elige una respuesta.
                </p>
              )}
            </fieldset>
          );
        })}
        <div className="trampa" aria-hidden="true">
          <label htmlFor={`${id}-sitio`}>No llenes este campo</label>
          <input
            id={`${id}-sitio`}
            tabIndex={-1}
            autoComplete="off"
            value={trampa}
            onChange={(e) => setTrampa(e.target.value)}
          />
        </div>
        <p className="aviso-breve">
          {RESPONSABLE_DEFINIDO
            ? `${RESPONSABLE.nombre}, con domicilio en ${RESPONSABLE.domicilio}, `
            : 'El responsable '}
          usa tu correo y respuestas para avisarte del lanzamiento, invitarte a la beta y entender qué
          necesita la gente. Los guarda Supabase como encargado. Te das de baja con el enlace de cada correo
          {RESPONSABLE_DEFINIDO ? ` o escribiendo a ${RESPONSABLE.correo}` : ''}.{' '}
          <a href="./aviso-de-privacidad.html">Aviso de privacidad completo</a>.
        </p>
        <label className="consentimiento">
          <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
          Leí el aviso de privacidad y acepto que usen mis datos para esto.
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {envio === 'error' && (
          <p className="error" role="alert">
            No pude anotarte. Revisa tu conexión e intenta de nuevo.
          </p>
        )}
        {envio === 'limite' && (
          <p className="error" role="alert">
            Recibimos varios intentos desde tu conexión. Intenta de nuevo en una hora.
          </p>
        )}
        <button
          type="submit"
          disabled={envio === 'enviando'}
          aria-busy={envio === 'enviando' || undefined}
          aria-label={
            envio === 'enviando'
              ? 'Enviando tu solicitud a la lista de espera'
              : 'Anotarme en la lista de espera de la beta'
          }
        >
          {envio === 'enviando' ? 'Anotando…' : 'Anotarme'}
        </button>
      </form>
    </section>
  );
}
