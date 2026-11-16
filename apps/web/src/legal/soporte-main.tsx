// Ayuda y soporte: la misma página de la calculadora (una sola fuente para las dos webs).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Soporte } from '../../../calculadora/src/Soporte';
import '../../../calculadora/src/estilos.css';

const raiz = document.getElementById('raiz');
if (raiz) {
  createRoot(raiz).render(
    <StrictMode>
      <Soporte />
    </StrictMode>,
  );
}
