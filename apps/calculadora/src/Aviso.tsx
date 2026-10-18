import { AVISO_COMPLETO, AVISO_WEB, type SeccionAviso } from './aviso-app';
import { MARCA, RESPONSABLE_DEFINIDO, VERSION_CONSENTIMIENTO } from './config';

function idSeccion(titulo: string): string {
  return `aviso-${titulo
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;
}

function Secciones({ secciones }: { secciones: readonly SeccionAviso[] }) {
  return secciones.map((s) => {
    const tituloId = idSeccion(s.titulo);
    return (
      <section key={s.titulo} aria-labelledby={tituloId}>
        <h2 id={tituloId}>{s.titulo}</h2>
        {s.parrafos.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </section>
    );
  });
}

/** Aviso de privacidad integral (`08 §2`): app + uso de esta web. */
export function Aviso() {
  return (
    <main id="contenido-principal" className="aviso-integral" tabIndex={-1}>
      <nav aria-label="Volver">
        <a href="./">← Volver a la calculadora</a>
      </nav>
      <h1 id="titulo-aviso-privacidad">Aviso de privacidad de {MARCA}</h1>
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
