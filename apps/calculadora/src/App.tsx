import { Calculadora } from './Calculadora';
import { ListaEspera } from './ListaEspera';
import { MARCA } from './config';

export function App() {
  return (
    <>
      <header className="encabezado">
        <svg viewBox="0 0 1024 1024" width="40" height="40" aria-hidden="true">
          <rect width="1024" height="1024" rx="224" fill="#0E8A6E" />
          <path
            d="M512 212c-176 0-312 118-312 270 0 86 44 162 114 212l-26 118c-4 18 16 31 31 20l120-82c23 4 47 6 73 6 176 0 312-118 312-274S688 212 512 212z"
            fill="#fff"
          />
          <rect x="352" y="476" width="72" height="120" rx="36" fill="#0A6B57" />
          <rect x="476" y="410" width="72" height="186" rx="36" fill="#0E8A6E" />
          <rect x="600" y="334" width="72" height="262" rx="36" fill="#14A37F" />
        </svg>
        <span className="marca">{MARCA}</span>
      </header>
      <main>
        <h1>¿Cuántos MSI aguantas?</h1>
        <p className="entrada">
          Antes del Buen Fin, calcula cuánto puedes sumar en pagos al mes sin pasarte de lo recomendado.
        </p>
        <Calculadora />
        <ListaEspera />
      </main>
      <footer className="pie">
        <a href="./aviso-de-privacidad.html">Aviso de privacidad</a>
        <span>
          {MARCA} no es una institución financiera ni asesor de inversiones. Las cifras son estimaciones y no
          garantizan resultados.
        </span>
      </footer>
    </>
  );
}
