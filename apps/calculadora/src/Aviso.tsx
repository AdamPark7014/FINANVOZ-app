import { AVISO_COMPLETO, AVISO_WEB, type SeccionAviso } from './aviso-app';
import { MARCA, RESPONSABLE_DEFINIDO, VERSION_CONSENTIMIENTO } from './config';

function Secciones({ secciones }: { secciones: readonly SeccionAviso[] }) {
  return secciones.map((s) => (
    <section key={s.titulo}>
      <h2>{s.titulo}</h2>
      {s.parrafos.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </section>
  ));
}

/** Aviso de privacidad integral (`08 §2`): app + uso de esta web. */
export function Aviso() {
  return (
    <main className="aviso-integral">
      <p>
        <a href="./">← Volver a la calculadora</a>
      </p>
      <h1>Aviso de privacidad de {MARCA}</h1>
      <p className="ayuda">Versión {VERSION_CONSENTIMIENTO}</p>
      {!RESPONSABLE_DEFINIDO && (
        <p className="error" role="alert">
          Borrador: falta la identidad del responsable. Este aviso no se publica así.
        </p>
      )}
      <Secciones secciones={AVISO_COMPLETO} />
      <Secciones secciones={AVISO_WEB} />
    </main>
  );
}
