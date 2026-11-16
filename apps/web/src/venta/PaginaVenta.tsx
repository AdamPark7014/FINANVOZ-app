import { useState } from 'react';
import { APP_STORE_URL, MARCA, PLAY_STORE_URL, PRECIOS_PUBLICOS } from '../config';
import { formatearCentavos } from '../util/dinero';
import { Icono } from '../util/Icono';
import { FormularioAsesor } from './FormularioAsesor';
import { MaquetaTelefono } from './MaquetaTelefono';

function BotonTienda({
  url,
  arriba,
  abajo,
  icono,
}: {
  url: string;
  arriba: string;
  abajo: string;
  icono: 'apple' | 'play';
}) {
  // Sin enlace todavía (la app no está publicada): se ve igual pero avisa que viene pronto.
  return (
    <a
      className="tienda"
      href={url || '#descargar'}
      aria-disabled={url ? undefined : true}
      title={url ? undefined : 'Muy pronto'}
      onClick={(e) => {
        if (!url) e.preventDefault();
      }}
    >
      <Icono nombre={icono} />
      <span className="tienda-texto">
        <span className="tienda-arriba">{url ? arriba : 'Muy pronto en'}</span>
        <span className="tienda-abajo">{abajo}</span>
      </span>
    </a>
  );
}

export function PaginaVenta() {
  const [asesor, setAsesor] = useState(false);
  const plus = formatearCentavos(PRECIOS_PUBLICOS.plusMensualCentavos);

  return (
    <div className="venta">
      <header className="venta-encabezado">
        <a className="marca" href="/">
          <span className="marca-cuadro">
            <Icono nombre="marca" tamano={16} />
          </span>
          <span className="marca-nombre">{MARCA}</span>
        </a>
        <nav className="venta-nav" aria-label="Secciones">
          <a href="#como">Cómo funciona</a>
          <a href="#negocio">Para tu negocio</a>
          <a href="#precios">Precios</a>
          <a href="#privacidad">Privacidad</a>
        </nav>
        <a className="btn btn-primario" href="#descargar">
          Descargar gratis
        </a>
      </header>

      <main id="contenido">
        <section className="venta-heroe" aria-labelledby="heroe-titulo">
          <div className="heroe-texto">
            <p className="ceja">Tu asistente de dinero, por voz</p>
            <h1 id="heroe-titulo">
              Dile qué gastaste.
              <br />
              Te dice cuánto te queda.
            </h1>
            <p className="heroe-entrada">
              «Tacos 80 en efectivo.» Listo, registrado. Cada mañana {MARCA} te dice cuánto puedes gastar hoy
              para llegar a la quincena, sin hojas de cálculo y sin conectar tu banco.
            </p>
            <div className="tiendas" id="descargar">
              <BotonTienda url={APP_STORE_URL} arriba="Descárgala en" abajo="App Store" icono="apple" />
              <BotonTienda url={PLAY_STORE_URL} arriba="Disponible en" abajo="Google Play" icono="play" />
            </div>
            <p className="nota">Gratis para registrar y saber tu cifra del día. Plus desde {plus} al mes.</p>
          </div>
          <div className="heroe-telefono">
            <MaquetaTelefono />
          </div>
        </section>

        <section id="como" className="banda" aria-labelledby="como-titulo">
          <div className="banda-interior">
            <h2 id="como-titulo">Dos toques. Nada más.</h2>
            <p className="entrada">
              Todo lo importante está a un toque del micrófono. Si prefieres escribir, también entiende.
            </p>
            <div className="pasos">
              <article>
                <span className="paso-numero num">1 · Registra</span>
                <h3>«Súper 1,240 con la Nu»</h3>
                <p>
                  Entiende montos dichos como los dices, la cuenta, la fecha y la categoría. Varias cosas de
                  corrido, en una sola frase.
                </p>
              </article>
              <article>
                <span className="paso-numero num">2 · Pregunta</span>
                <h3>«¿Me alcanza para unos tenis de 1,800?»</h3>
                <p>
                  Te contesta con tus pagos fijos, tus tarjetas y tu quincena a la vista: de contado, a meses
                  o esperando.
                </p>
              </article>
              <article>
                <span className="paso-numero num">3 · Duerme tranquilo</span>
                <h3>Tu cifra del día, cada mañana</h3>
                <p>
                  Lo que puedes gastar hoy sin quedarte corto. Si algo cambia, te avisa antes de que duela.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section id="negocio" className="venta-negocio" aria-labelledby="negocio-titulo">
          <div className="negocio-texto">
            <p className="ceja">Para tu negocio</p>
            <h2 id="negocio-titulo">
              Tu tiendita, tu estética o tu taller, separados de tu dinero personal.
            </h2>
            <p className="entrada">
              Ventas, fiado, corte de caja y una estimación de tus impuestos RESICO. A fin de mes, el resumen
              que le mandas a tu contador.
            </p>
          </div>
          <div className="negocio-tarjeta">
            <dl>
              <div>
                <dt>Ventas cobradas · noviembre</dt>
                <dd className="num">$38,420</dd>
              </div>
              <div>
                <dt>Gastos del negocio</dt>
                <dd className="num">$21,960</dd>
              </div>
              <div>
                <dt>ISR RESICO estimado</dt>
                <dd className="num">$480</dd>
              </div>
              <div className="total">
                <dt>Utilidad</dt>
                <dd className="num">$15,980</dd>
              </div>
            </dl>
            <p className="nota">Ejemplo ilustrativo de un negocio de servicios.</p>
          </div>
        </section>

        <section id="precios" className="banda" aria-labelledby="precios-titulo">
          <div className="banda-interior">
            <h2 id="precios-titulo">Empieza gratis.</h2>
            <p className="entrada">Paga solo si quieres que piense más por ti.</p>
            <div className="precios">
              <article className="precio">
                <h3>Gratis</h3>
                <p className="precio-monto num">$0</p>
                <ul>
                  <li>Registro por voz ilimitado</li>
                  <li>Cifra del día y quincena</li>
                  <li>Cuentas, tarjetas y pagos fijos</li>
                  <li>Respaldo cifrado</li>
                </ul>
                <a className="btn btn-secundario" href="#descargar">
                  Descargar
                </a>
              </article>
              <article className="precio precio-destacado">
                <h3>Plus</h3>
                <p className="precio-monto num">
                  {plus}
                  <span> al mes</span>
                </p>
                <p className="precio-alterno num">
                  o {formatearCentavos(PRECIOS_PUBLICOS.plusAnualCentavos)} al año
                </p>
                <ul>
                  <li>«¿Me alcanza?» con meses sin intereses</li>
                  <li>Preguntas libres a tu asistente</li>
                  <li>Negocio, impuestos y deducciones</li>
                  <li>Gastos compartidos y tandas</li>
                </ul>
                <a className="btn btn-primario" href="#descargar">
                  Probar Plus
                </a>
              </article>
              <article className="precio">
                <h3>Para tu equipo o clientes</h3>
                <p className="precio-texto">
                  Licencias para cooperativas, cajas de ahorro o empresas que quieren dar {MARCA} a su gente,
                  desde {formatearCentavos(PRECIOS_PUBLICOS.licenciaMesCentavos)} por persona al mes.
                </p>
                <button type="button" className="btn btn-secundario" onClick={() => setAsesor(true)}>
                  Hablar con un asesor
                </button>
              </article>
            </div>
          </div>
        </section>

        <section id="privacidad" className="venta-privacidad" aria-labelledby="privacidad-titulo">
          <h2 id="privacidad-titulo" className="solo-lector">
            Privacidad
          </h2>
          <div>
            <h3>No pedimos tu banco</h3>
            <p>Nunca te pedimos usuario ni contraseña de tu banca en línea.</p>
          </div>
          <div>
            <h3>Tus datos viven en tu teléfono</h3>
            <p>El respaldo va cifrado. Lo que dices no se guarda en registros.</p>
          </div>
          <div>
            <h3>Hecha en México</h3>
            <p>Quincenas, meses sin intereses, tandas, fiado y RESICO, como se vive aquí.</p>
          </div>
        </section>
      </main>

      <footer className="venta-pie">
        <span>© 2026 {MARCA} · Puebla, México</span>
        <nav aria-label="Pie de página">
          <a href="/aviso-de-privacidad.html">Aviso de privacidad</a>
          <a href="/soporte.html">Soporte</a>
          <a href="/admin">Acceso del equipo</a>
        </nav>
      </footer>

      {asesor ? <FormularioAsesor onCerrar={() => setAsesor(false)} /> : null}
    </div>
  );
}
