import { Icono } from '../util/Icono';

/** La pantalla principal de la app tal como se ve: cifra del día, plática y orbe del micrófono. */
export function MaquetaTelefono() {
  return (
    <div
      className="telefono"
      role="img"
      aria-label="Pantalla de Finanvoz: hoy puedes gastar 412 pesos; el asistente registró tacos por 80 pesos"
    >
      <div className="telefono-pantalla" aria-hidden="true">
        <div className="tel-encabezado">
          <span>Domingo 15 de noviembre</span>
          <span className="tel-avatar">A</span>
        </div>
        <div className="tel-cifra-bloque">
          <p className="tel-etiqueta">Hoy puedes gastar</p>
          <p className="tel-cifra num">$412</p>
          <div className="tel-barra">
            <span />
          </div>
          <p className="tel-pista">Faltan 5 días para la quincena · llegas con $1,180</p>
        </div>
        <div className="tel-platica">
          <div className="tel-burbuja tel-burbuja-tu">Tacos 80 en efectivo</div>
          <div className="tel-burbuja">Registré $80 en Comida, efectivo. Te quedan $332 para hoy.</div>
          <div className="tel-chips">
            <span>Deshacer</span>
            <span>Era con tarjeta</span>
          </div>
        </div>
        <div className="tel-voz">
          <span className="tel-orbe">
            <Icono nombre="microfono" tamano={26} />
          </span>
          <span className="tel-pista">Toca y habla</span>
        </div>
      </div>
    </div>
  );
}
