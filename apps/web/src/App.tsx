import { PaginaVenta } from './venta/PaginaVenta';
import { AdminApp } from './admin/AdminApp';
import { useRuta } from './util/router';

export function App() {
  const ruta = useRuta();
  if (ruta.pantalla === 'admin') return <AdminApp seccion={ruta.seccion} />;
  return <PaginaVenta />;
}
