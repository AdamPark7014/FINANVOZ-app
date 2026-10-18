import { useId, useRef, useState, type FormEvent } from 'react';
import { LISTA_ESPERA_URL, MARCA, RESPONSABLE, RESPONSABLE_DEFINIDO, VERSION_AVISO } from './config';
import {
  LISTA_ESPERA_ARIA_CTA,
  LISTA_ESPERA_ARIA_CTA_ENVIANDO,
  LISTA_ESPERA_ARIA_FORMULARIO,
  LISTA_ESPERA_CONSENTIMIENTO,
  LISTA_ESPERA_CTA,
  LISTA_ESPERA_CTA_ENVIANDO,
  LISTA_ESPERA_ENLACE_AVISO,
  LISTA_ESPERA_ERROR_CONSENTIMIENTO,
  LISTA_ESPERA_ERROR_CORREO,
  LISTA_ESPERA_ERROR_LIMITE,
  LISTA_ESPERA_ERROR_NO_ABIERTA,
  LISTA_ESPERA_ERROR_OPCION,
  LISTA_ESPERA_ERROR_RED,
  LISTA_ESPERA_ETIQUETA_CORREO,
  LISTA_ESPERA_PREGUNTAS,
  LISTA_ESPERA_TITULO,
  LISTA_ESPERA_TITULO_EXITO,
  LISTA_ESPERA_TRAMPA_ETIQUETA,
  listaEsperaAvisoBreve,
  listaEsperaErrorFaltaUna,
  listaEsperaErrorFaltanVarias,
  listaEsperaIntro,
  listaEsperaTextoExito,
  type ListaEsperaClave,
} from './textos';

/** Correo con forma razonable; la validación definitiva la hace la función del servidor. */
export const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Envio = 'inicial' | 'enviando' | 'listo' | 'error' | 'limite';

export function ListaEspera() {
  const id = useId();
  const [correo, setCorreo] = useState('');
  const [respuestas, setRespuestas] = useState<Partial<Record<ListaEsperaClave, string>>>({});
  const [acepta, setAcepta] = useState(false);
  const [trampa, setTrampa] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [faltan, setFaltan] = useState<readonly ListaEsperaClave[]>([]);
  const [envio, setEnvio] = useState<Envio>('inicial');
  const grupos = useRef<Partial<Record<ListaEsperaClave, HTMLFieldSetElement | null>>>({});
  const correoRef = useRef<HTMLInputElement>(null);
  const idErrorForm = `${id}-error-form`;

  function responder(clave: ListaEsperaClave, valor: string) {
    setRespuestas((r) => ({ ...r, [clave]: valor }));
    if (faltan.length && faltan.every((c) => c === clave || respuestas[c])) {
      setFaltan([]);
      setError(null);
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setFaltan([]);
    if (!CORREO_VALIDO.test(correo.trim())) {
      correoRef.current?.focus();
      return setError(LISTA_ESPERA_ERROR_CORREO);
    }
    const sinContestar = LISTA_ESPERA_PREGUNTAS.filter((p) => !respuestas[p.clave]);
    const primera = sinContestar[0];
    if (primera) {
      setFaltan(sinContestar.map((p) => p.clave));
      grupos.current[primera.clave]?.querySelector('input')?.focus();
      return setError(
        sinContestar.length === 1
          ? listaEsperaErrorFaltaUna(primera.texto)
          : listaEsperaErrorFaltanVarias(sinContestar.length, primera.texto),
      );
    }
    if (!acepta) return setError(LISTA_ESPERA_ERROR_CONSENTIMIENTO);
    if (!LISTA_ESPERA_URL) return setError(LISTA_ESPERA_ERROR_NO_ABIERTA);
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
      <section className="tarjeta" role="status" aria-live="polite" aria-atomic="true">
        <h2>{LISTA_ESPERA_TITULO_EXITO}</h2>
        <p>{listaEsperaTextoExito(MARCA)}</p>
      </section>
    );
  }

  return (
    <section className="tarjeta" aria-labelledby={`${id}-titulo`}>
      <h2 id={`${id}-titulo`}>{LISTA_ESPERA_TITULO}</h2>
      <p>{listaEsperaIntro(MARCA)}</p>
      <form onSubmit={enviar} noValidate aria-label={LISTA_ESPERA_ARIA_FORMULARIO}>
        <div className="campo">
          <label htmlFor={`${id}-correo`}>{LISTA_ESPERA_ETIQUETA_CORREO}</label>
          <input
            ref={correoRef}
            id={`${id}-correo`}
            type="email"
            autoComplete="email"
            value={correo}
            aria-required="true"
            aria-invalid={error === LISTA_ESPERA_ERROR_CORREO || undefined}
            aria-describedby={error === LISTA_ESPERA_ERROR_CORREO ? idErrorForm : undefined}
            onChange={(e) => {
              setCorreo(e.target.value);
              if (error === LISTA_ESPERA_ERROR_CORREO) setError(null);
            }}
          />
        </div>
        {LISTA_ESPERA_PREGUNTAS.map((p) => {
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
                  {LISTA_ESPERA_ERROR_OPCION}
                </p>
              )}
            </fieldset>
          );
        })}
        <div className="trampa" aria-hidden="true">
          <label htmlFor={`${id}-sitio`}>{LISTA_ESPERA_TRAMPA_ETIQUETA}</label>
          <input
            id={`${id}-sitio`}
            tabIndex={-1}
            autoComplete="off"
            value={trampa}
            onChange={(e) => setTrampa(e.target.value)}
          />
        </div>
        <p className="aviso-breve">
          {listaEsperaAvisoBreve(RESPONSABLE_DEFINIDO, RESPONSABLE)}{' '}
          <a href="./aviso-de-privacidad.html">{LISTA_ESPERA_ENLACE_AVISO}</a>.
        </p>
        <label className="consentimiento">
          <input
            type="checkbox"
            checked={acepta}
            aria-required="true"
            onChange={(e) => {
              setAcepta(e.target.checked);
              if (error === LISTA_ESPERA_ERROR_CONSENTIMIENTO) setError(null);
            }}
          />
          {LISTA_ESPERA_CONSENTIMIENTO}
        </label>
        {error && (
          <p id={idErrorForm} className="error" role="alert">
            {error}
          </p>
        )}
        {envio === 'error' && (
          <p className="error" role="alert">
            {LISTA_ESPERA_ERROR_RED}
          </p>
        )}
        {envio === 'limite' && (
          <p className="error" role="alert">
            {LISTA_ESPERA_ERROR_LIMITE}
          </p>
        )}
        <button
          type="submit"
          disabled={envio === 'enviando'}
          aria-busy={envio === 'enviando' || undefined}
          aria-label={envio === 'enviando' ? LISTA_ESPERA_ARIA_CTA_ENVIANDO : LISTA_ESPERA_ARIA_CTA}
        >
          {envio === 'enviando' ? LISTA_ESPERA_CTA_ENVIANDO : LISTA_ESPERA_CTA}
        </button>
      </form>
    </section>
  );
}
