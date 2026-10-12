import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Aviso } from './Aviso';
import './estilos.css';

const raiz = document.getElementById('raiz');
if (raiz) {
  createRoot(raiz).render(
    <StrictMode>
      <Aviso />
    </StrictMode>,
  );
}
