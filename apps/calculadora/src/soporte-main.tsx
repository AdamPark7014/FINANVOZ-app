import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Soporte } from './Soporte';
import './estilos.css';

const raiz = document.getElementById('raiz');
if (raiz) {
  createRoot(raiz).render(
    <StrictMode>
      <Soporte />
    </StrictMode>,
  );
}
