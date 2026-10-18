import { useEffect, useState } from 'react';
import { useCompartido } from '../../compartido/ProveedorCompartido';
import {
  crearGrupoCompartido,
  listarGruposCompartidos,
  MENSAJE_SERVIDOR,
  mensajeError,
  mensajeErrorCompartido,
  sincronizarGruposAbiertos,
  unirseConQr,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoTexto, etiquetaHablada, Pantalla, Tarjeta, Texto } from '../../ui';
import { MensajeError } from '../onboarding/componentes';
import { CodigoQr } from './CodigoQr';
import { EscanerQr } from './EscanerQr';
import {
  AVISO_REVINCULAR_LISTA,
  AYUDA_NOMBRE_PAREJA,
  BTN_CREAR_CODIGO,
  BTN_CREAR_CON_ALGUIEN,
  BTN_ESCANEAR_CODIGO,
  BTN_ESCANEAR_SU_CODIGO,
  BTN_LISTO,
  ERROR_NOMBRE_PAREJA,
  ETIQUETA_NOMBRE_PAREJA,
  ETIQUETA_VOLVER,
  instruccionQrTrasCrear,
  PISTA_VOLVER_CUENTAS,
  etiquetaVacioCompartidos,
  TEXTO_COMPARTIDOS_VACIO,
  TITULO_GASTOS_COMPARTIDOS,
} from './textos';

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
    void sincronizarGruposAbiertos(ctx, deps).then(() => {
      if (vivo) refrescar();
    });
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
      setError(ERROR_NOMBRE_PAREJA);
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
    } catch (e) {
      setError(mensajeError(e, MENSAJE_SERVIDOR));
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
    } catch (e) {
      setError(mensajeError(e, MENSAJE_SERVIDOR));
      setModo({ tipo: 'unirse', escaneando: false });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Pantalla testID="pantalla-compartidos" bordes={['top', 'left', 'right', 'bottom']}>
      <Boton
        testID="compartidos-volver"
        etiqueta={ETIQUETA_VOLVER}
        variante="texto"
        ancho="contenido"
        pista={modo.tipo === 'lista' ? PISTA_VOLVER_CUENTAS : undefined}
        alPresionar={modo.tipo === 'lista' ? alVolver : volverALista}
      />
      <Texto variante="titulo" testID="compartidos-titulo" accessibilityRole="header">
        {TITULO_GASTOS_COMPARTIDOS}
      </Texto>

      {modo.tipo === 'lista' ? (
        <>
          {grupos.length === 0 ? (
            <Texto variante="cuerpo" tono="secundario" testID="compartidos-vacio">
              {TEXTO_COMPARTIDOS_VACIO}
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
                  {AVISO_REVINCULAR_LISTA}
                </Texto>
              ) : null}
            </Tarjeta>
          ))}
          <Boton
            testID="compartidos-crear"
            etiqueta={BTN_CREAR_CON_ALGUIEN}
            alPresionar={() => setModo({ tipo: 'crear' })}
          />
          <Boton
            testID="compartidos-escanear"
            etiqueta={BTN_ESCANEAR_CODIGO}
            variante="secundario"
            alPresionar={() => setModo({ tipo: 'unirse', escaneando: false })}
          />
        </>
      ) : null}

      {modo.tipo === 'crear' ? (
        <>
          <CampoTexto
            testID="compartidos-nombre"
            etiqueta={ETIQUETA_NOMBRE_PAREJA}
            valor={nombre}
            alCambiar={setNombre}
            ayuda={AYUDA_NOMBRE_PAREJA}
          />
          <MensajeError texto={error} />
          <Boton
            testID="compartidos-crear-codigo"
            etiqueta={BTN_CREAR_CODIGO}
            cargando={ocupado}
            alPresionar={() => void crear()}
          />
        </>
      ) : null}

      {modo.tipo === 'qr' ? (
        <>
          <Texto variante="cuerpo">{instruccionQrTrasCrear(modo.nombre)}</Texto>
          <CodigoQr texto={modo.qr} testID="compartidos-qr" />
          <Boton testID="compartidos-listo" etiqueta={BTN_LISTO} alPresionar={() => alAbrirGrupo(modo.grupoId)} />
        </>
      ) : null}

      {modo.tipo === 'unirse' ? (
        modo.escaneando ? (
          <EscanerQr alLeer={(t) => void unirse(t)} alCancelar={volverALista} />
        ) : (
          <>
            <CampoTexto
              testID="compartidos-nombre"
              etiqueta={ETIQUETA_NOMBRE_PAREJA}
              valor={nombre}
              alCambiar={setNombre}
              ayuda={AYUDA_NOMBRE_PAREJA}
            />
            <MensajeError texto={error} />
            <Boton
              testID="compartidos-abrir-escaner"
              etiqueta={BTN_ESCANEAR_SU_CODIGO}
              cargando={ocupado}
              alPresionar={() => {
                if (nombre.trim() === '') setError(ERROR_NOMBRE_PAREJA);
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
