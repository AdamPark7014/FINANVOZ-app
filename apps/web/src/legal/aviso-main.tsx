// Aviso de privacidad: el mismo texto vigente de la calculadora (una sola fuente legal para las dos webs).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Aviso } from '../../../calculadora/src/Aviso';
import '../../../calculadora/src/estilos.css';

const raiz = document.getElementById('raiz');
if (raiz) {
  createRoot(raiz).render(
    <StrictMode>
      <Aviso />
    </StrictMode>,
  );
}
