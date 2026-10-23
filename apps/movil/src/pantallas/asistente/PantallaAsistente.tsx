import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { espacio, margenPantalla, useTema } from '../../ui';
import { useReservarEspacioAviso } from '../../ui/componentes/Aviso';
import { InvitacionAvisos } from '../avisos/InvitacionAvisos';
import { EnlaceAnaliticaCorreccion } from '../principal/ConfirmacionRegistro';
import { cifraHoyMostrada } from '../principal/useAvisoRegistro';
import { AvisosUnaVez } from './AvisosUnaVez';
import { BarraVoz } from './BarraVoz';
import { CabeceraDia } from './CabeceraDia';
import { Conversacion, useTurnosNuevos } from './Conversacion';
import { EstadoVacio } from './EstadoVacio';
import { PanelDesglose } from './PanelDesglose';
import { useAsistente, type Asistente, type OpcionesAsistente } from './useAsistente';

/**
 * Pestaña Asistente (Ola 7, maqueta Hoy A «Conversación»; testID `pantalla-hoy` para Maestro): cabecera compacta
 * con la barra reservado · colchón · libre, la conversación del día y la barra de voz. Sin turnos todavía, el
 * micrófono enorme al centro (Hoy C). El teclado empuja la conversación; la barra de voz queda sobre él.
 */
export function PantallaAsistente(props: OpcionesAsistente) {
  const a = useAsistente(props);
  const { c } = useTema();
  const nav = props.navegacion;
  const vista = a.vista;
  return (
    <SafeAreaView
      {...a.cortarAlTocar}
      testID="pantalla-hoy"
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: c.fondo }}
    >
      <EnlaceAnaliticaCorreccion />
      <Contenedor>
        <View
          style={{
            paddingHorizontal: margenPantalla,
            paddingTop: espacio.s,
            paddingBottom: espacio.s,
            gap: espacio.m,
            borderBottomWidth: a.verDesglose ? 0 : 1,
            borderBottomColor: c.borde,
          }}
        >
          <CabeceraDia
            vista={vista}
            desgloseAbierto={a.verDesglose}
            alAlternarDesglose={() => a.setVerDesglose((v) => !v)}
            alConfigurarIngreso={nav.alConfigurarIngreso}
          />
          {a.verDesglose && vista.estado !== 'sin_ingreso' ? (
            <PanelDesglose
              vista={vista}
              probabilidad={a.plus.probabilidad}
              conCandado={!a.plus.probabilidad && a.conTienda}
              {...(props.bloques ? { bloques: props.bloques } : {})}
              {...(nav.alAbrirMeAlcanza && (a.plus.meAlcanza || a.conTienda)
                ? { alMeAlcanza: () => nav.alAbrirMeAlcanza?.() }
                : {})}
            />
          ) : null}
        </View>
        <Cuerpo a={a} props={props} />
      </Contenedor>
    </SafeAreaView>
  );
}

/**
 * La conversación con su barra de voz, sin cabecera: la usa la pantalla y la envoltura `PanelRegistrar` que
 * conservan las pantallas que dictan dentro de otra (pruebas de compartido, micrófonos).
 */
export function PanelConversacion(props: OpcionesAsistente) {
  const a = useAsistente({ ...props, soloSesion: true });
  return (
    <View style={{ gap: espacio.m }} testID="panel-registrar">
      <EnlaceAnaliticaCorreccion />
      <Cuerpo a={a} props={props} enPanel />
    </View>
  );
}

function Contenedor({ children }: { children: ReactNode }) {
  // En iPhone el teclado se dibuja encima: el contenedor se encoge y la barra de voz queda pegada a él. Android ya
  // encoge la ventana (`adjustResize`).
  if (Platform.OS !== 'ios') return <View style={{ flex: 1 }}>{children}</View>;
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      {children}
    </KeyboardAvoidingView>
  );
}

function Cuerpo({
  a,
  props,
  enPanel = false,
}: {
  a: Asistente;
  props: OpcionesAsistente;
  enPanel?: boolean;
}) {
  const { c } = useTema();
  const nav = props.navegacion;
  // «Hablar» y el teclado van fijos al pie (sobre las pestañas): el aviso inferior sube para no taparlos.
  const [altoPie, setAltoPie] = useState(0);
  useReservarEspacioAviso(altoPie);
  // En panel (dentro de otra pantalla) no hay estado vacío: la barra de voz siempre trae su micrófono.
  const sinTurnos = !enPanel && a.turnos.length === 0;
  // Cada turno nuevo del asistente se anuncia (también el primero, que llega con el estado vacío a la vista).
  const esNuevo = useTurnosNuevos(a.turnos);
  const encabezado = enPanel ? null : (
    <View style={{ gap: espacio.m }}>
      <AvisosUnaVez avisos={a.vista.avisos} />
      <InvitacionAvisos />
    </View>
  );
  const alAbrirArqueo = nav.alAbrirArqueo;
  return (
    <>
      {sinTurnos ? (
        <EstadoVacio
          primerUso={a.vista.primerUso}
          hoyPuedes={cifraHoyMostrada(a.vista)}
          escuchando={a.microfono.escuchando}
          boton={a.microfono.boton}
          encabezado={encabezado}
          {...(nav.alVerMovimiento ? { alVerMovimiento: nav.alVerMovimiento } : {})}
        />
      ) : (
        <View style={enPanel ? undefined : { flex: 1 }}>
          <Conversacion
            virtualizada={!enPanel}
            esNuevo={esNuevo}
            alEscribir={() => a.setEscribiendo(true)}
            turnos={a.turnos}
            idsSesion={a.idsSesion}
            tarjetasAccion={a.vista.tarjetasAccion}
            observaciones={a.observaciones}
            alVerMovimientosFiltro={(filtro) => nav.alVerMovimientos(filtro)}
            encabezado={encabezado}
            alVerMovimientos={() => nav.alVerMovimientos()}
            {...(alAbrirArqueo ? { alAbrirArqueo: () => alAbrirArqueo() } : {})}
            alResultadoTarjeta={a.alResultadoTarjeta}
            alListoTarjeta={a.alListoTarjeta}
            alCancelarTarjeta={a.resolver}
          />
        </View>
      )}
      <View
        testID="hoy-pie-registrar"
        onLayout={(e) => setAltoPie(Math.round(e.nativeEvent.layout.height) + espacio.m)}
        style={{
          paddingHorizontal: enPanel ? 0 : margenPantalla,
          paddingTop: espacio.xs,
          paddingBottom: espacio.s,
          backgroundColor: c.fondo,
        }}
      >
        <BarraVoz a={a} conMicrofono={!sinTurnos} />
      </View>
    </>
  );
}
