import { useEffect, useState } from 'react';
import { useCompartido } from '../../compartido/ProveedorCompartido';
import {
  crearGrupoCompartido,
  gruposAbiertos,
  listarGruposCompartidos,
  sincronizarGrupo,
  unirseConQr,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoTexto, etiquetaHablada, Pantalla, Tarjeta, Texto } from '../../ui';
import { MensajeError } from '../onboarding/componentes';
import { CodigoQr } from './CodigoQr';
import { EscanerQr } from './EscanerQr';
import { mensajeErrorCompartido } from './textos';

type Modo =
  | { tipo: 'lista' }
  | { tipo: 'crear' }
  | { tipo: 'qr'; grupoId: string; qr: string; nombre: string }
  | { tipo: 'unirse'; escaneando: boolean };

/**
 * Cuentas → Gastos compartidos (`02 §27`): tus grupos con su saldo, "Crear con alguien" (muestra el QR) y
 * "Escanear código" (te une al grupo de tu pareja). Al abrir sincroniza los grupos abiertos.
 */
export function PantallaCompartidos({
  alVolver,
  alAbrirGrupo,
}: {
  alVolver: () => void;
  alAbrirGrupo: (grupoId: string) => void;
}) {
  const { ctx, refrescar } = useSesion();
  const deps = useCompartido();
  const grupos = useVista((c) => listarGruposCompartidos(c, deps.almacen));
  const [modo, setModo] = useState<Modo>({ tipo: 'lista' });
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      for (const id of gruposAbiertos(ctx)) await sincronizarGrupo(ctx, deps, id).catch(() => null);
      if (vivo) refrescar();
    })();
    return () => {
      vivo = false;
    };
  }, [ctx, deps, refrescar]);

  const volverALista = () => {
    setModo({ tipo: 'lista' });
    setNombre('');
    setError(null);
  };

  const crear = async () => {
    if (nombre.trim() === '') {
      setError('Escribe cómo se llama tu pareja.');
      return;
    }
    setOcupado(true);
    try {
      const r = await crearGrupoCompartido(ctx, deps, nombre);
      if (!r.ok) setError(mensajeErrorCompartido(r.error));
      else {
        setError(null);
        setModo({ tipo: 'qr', grupoId: r.grupoId, qr: r.qr, nombre: nombre.trim() });
        refrescar();
      }
    } finally {
      setOcupado(false);
    }
  };

  const unirse = async (texto: string) => {
    setOcupado(true);
    try {
      const r = await unirseConQr(ctx, deps, texto, nombre);
      refrescar();
      if (r.ok) alAbrirGrupo(r.grupoId);
      else {
        setError(mensajeErrorCompartido(r.error));
        setModo({ tipo: 'unirse', escaneando: false });
      }
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Pantalla testID="pantalla-compartidos" bordes={['top', 'left', 'right', 'bottom']}>
      <Boton
        testID="compartidos-volver"
        etiqueta="Volver"
        variante="texto"
        ancho="contenido"
        alPresionar={modo.tipo === 'lista' ? alVolver : volverALista}
      />
      <Texto variante="titulo">Gastos compartidos</Texto>

      {modo.tipo === 'lista' ? (
        <>
          {grupos.length === 0 ? (
            <Texto variante="cuerpo" tono="secundario">
              Comparte gastos con tu pareja: los dos ven lo mismo y cada quien conserva su libro privado.
            </Texto>
          ) : null}
          {grupos.map((g) => (
            <Tarjeta
              key={g.id}
              testID={`compartido-${g.id}`}
              alPresionar={() => alAbrirGrupo(g.id)}
              etiquetaAccesible={etiquetaHablada(`${g.nombre}. ${g.avisoCierre ?? g.saldo.texto}`)}
            >
              <Texto variante="cuerpoFuerte">{g.nombre}</Texto>
              <Texto variante="secundario" accessibilityLabel={etiquetaHablada(g.saldo.texto)}>
                {g.saldo.texto}
              </Texto>
              {g.avisoCierre ? (
                <Texto variante="secundario" tono="secundario">
                  {g.avisoCierre}
                </Texto>
              ) : null}
              {g.revincular ? (
                <Texto variante="secundario" tono="faltante">
                  Vuelve a vincular este teléfono
                </Texto>
              ) : null}
            </Tarjeta>
          ))}
          <Boton
            testID="compartidos-crear"
            etiqueta="Crear con alguien"
            alPresionar={() => setModo({ tipo: 'crear' })}
          />
          <Boton
            testID="compartidos-escanear"
            etiqueta="Escanear código"
            variante="secundario"
            alPresionar={() => setModo({ tipo: 'unirse', escaneando: false })}
          />
        </>
      ) : null}

      {modo.tipo === 'crear' ? (
        <>
          <CampoTexto
            testID="compartidos-nombre"
            etiqueta="¿Cómo se llama tu pareja?"
            valor={nombre}
            alCambiar={setNombre}
            ayuda="Solo se guarda en tu teléfono."
          />
          <MensajeError texto={error} />
          <Boton
            testID="compartidos-crear-codigo"
            etiqueta="Crear código"
            cargando={ocupado}
            alPresionar={() => void crear()}
          />
        </>
      ) : null}

      {modo.tipo === 'qr' ? (
        <>
          <Texto variante="cuerpo">
            {`Pídele a ${modo.nombre} que abra Finanvoz → Cuentas → Gastos compartidos → Escanear código. El código sirve una sola vez y vence en 10 minutos.`}
          </Texto>
          <CodigoQr texto={modo.qr} testID="compartidos-qr" />
          <Boton testID="compartidos-listo" etiqueta="Listo" alPresionar={() => alAbrirGrupo(modo.grupoId)} />
        </>
      ) : null}

      {modo.tipo === 'unirse' ? (
        modo.escaneando ? (
          <EscanerQr alLeer={(t) => void unirse(t)} alCancelar={volverALista} />
        ) : (
          <>
            <CampoTexto
              testID="compartidos-nombre"
              etiqueta="¿Cómo se llama tu pareja?"
              valor={nombre}
              alCambiar={setNombre}
              ayuda="Solo se guarda en tu teléfono."
            />
            <MensajeError texto={error} />
            <Boton
              testID="compartidos-abrir-escaner"
              etiqueta="Escanear su código"
              cargando={ocupado}
              alPresionar={() => {
                if (nombre.trim() === '') setError('Escribe cómo se llama tu pareja.');
                else {
                  setError(null);
                  setModo({ tipo: 'unirse', escaneando: true });
                }
              }}
            />
          </>
        )
      ) : null}
    </Pantalla>
  );
}
