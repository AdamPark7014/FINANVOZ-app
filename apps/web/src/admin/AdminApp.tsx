import { useEffect, useState } from 'react';
import { datos as capaDefault, MODO_DEMO, type CapaDatos, type SesionAdmin } from './datos';
import { Layout } from './Layout';
import { Login } from './Login';
import { Resumen } from './Resumen';
import { Prospectos } from './Prospectos';
import { Clientes } from './Clientes';
import { Ventas } from './Ventas';
import { Vendedores } from './Vendedores';
import { Ajustes } from './Ajustes';
import { Cargando } from './componentes/Estados';
import { irA } from '../util/router';

export function AdminApp({ seccion, capa = capaDefault }: { seccion: string; capa?: CapaDatos }) {
  const [sesion, setSesion] = useState<SesionAdmin | null>(null);
  const [listo, setListo] = useState(false);
  const [clienteVenta, setClienteVenta] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const r = await capa.sesionActual();
      if (r.ok) setSesion(r.datos);
      setListo(true);
    })();
  }, [capa]);

  if (!listo) return <Cargando />;
  if (!sesion) return <Login datos={capa} onOk={setSesion} />;

  const sec = seccion === '' || seccion === 'admin' ? 'resumen' : seccion;

  return (
    <Layout
      sesion={sesion}
      seccion={sec}
      demo={capa === capaDefault && MODO_DEMO}
      onSalir={() => {
        void capa.cerrarSesion().then(() => setSesion(null));
      }}
    >
      {sec === 'resumen' ? <Resumen datos={capa} sesion={sesion} /> : null}
      {sec === 'prospectos' ? (
        <Prospectos
          datos={capa}
          sesion={sesion}
          onRegistrarVenta={(id) => {
            setClienteVenta(id);
            irA('/admin/ventas');
          }}
        />
      ) : null}
      {sec === 'clientes' ? (
        <Clientes
          datos={capa}
          sesion={sesion}
          onRegistrarVenta={(id) => {
            setClienteVenta(id);
            irA('/admin/ventas');
          }}
        />
      ) : null}
      {sec === 'ventas' ? <Ventas datos={capa} sesion={sesion} clienteInicial={clienteVenta} /> : null}
      {sec === 'vendedores' ? <Vendedores datos={capa} sesion={sesion} /> : null}
      {sec === 'ajustes' ? <Ajustes datos={capa} sesion={sesion} /> : null}
    </Layout>
  );
}
