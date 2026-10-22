import { ASUNTO_CORREO_AYUDA, CONTACTO_TITULO, PREGUNTAS_FRECUENTES, textoCuerpoContacto } from './ayuda-app';
import { MARCA, RESPONSABLE } from './config';

/** `mailto:` con solo el asunto, igual que el botón «Escribir un correo» de la app. */
export function enlaceCorreoAyuda(): string {
  return `mailto:${RESPONSABLE.correo}?subject=${encodeURIComponent(ASUNTO_CORREO_AYUDA)}`;
}

/** Página pública de ayuda y soporte (URL de soporte de App Store Connect y contacto de Play). */
export function Soporte() {
  return (
    <main id="contenido-principal" className="aviso-integral" tabIndex={-1}>
      <nav aria-label="Volver">
        <a href="./">← Volver a la calculadora</a>
      </nav>
      <h1 id="titulo-soporte">Ayuda y soporte de {MARCA}</h1>
      <p className="ayuda">
        Las mismas respuestas que en la app (Ajustes › Ayuda). Si no encuentras la tuya, escríbenos:{' '}
        <a href={enlaceCorreoAyuda()}>{RESPONSABLE.correo}</a>.
      </p>

      <section aria-labelledby="titulo-preguntas">
        <h2 id="titulo-preguntas">Preguntas frecuentes</h2>
        {PREGUNTAS_FRECUENTES.map((p) => (
          <article key={p.id} id={`pregunta-${p.id}`} aria-labelledby={`pregunta-${p.id}-titulo`}>
            <h3 id={`pregunta-${p.id}-titulo`}>{p.pregunta}</h3>
            {p.respuesta.map((parrafo) => (
              <p key={parrafo}>{parrafo}</p>
            ))}
            {p.iphone && (
              <>
                {p.iphone.map((parrafo, i) => (
                  <p key={parrafo}>
                    {i === 0 && <strong>En iPhone: </strong>}
                    {parrafo}
                  </p>
                ))}
              </>
            )}
          </article>
        ))}
      </section>

      <section aria-labelledby="titulo-contacto">
        <h2 id="titulo-contacto">{CONTACTO_TITULO}</h2>
        <p>{textoCuerpoContacto(RESPONSABLE.correo)}</p>
        <p>
          <a href={enlaceCorreoAyuda()}>Escribir un correo</a>
        </p>
        <p>
          Responsable: {RESPONSABLE.nombre}. Lo que hacemos con tus datos está en el{' '}
          <a href="./aviso-de-privacidad.html">aviso de privacidad</a>.
        </p>
      </section>
    </main>
  );
}
