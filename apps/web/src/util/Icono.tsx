/** Íconos de trazo propios (un solo grosor, color heredado). Decorativos salvo que lleven `etiqueta`. */
export type NombreIcono = 'marca' | 'microfono' | 'menu' | 'cerrar' | 'apple' | 'play' | 'salir';

const TRAZOS: Record<NombreIcono, string[]> = {
  marca: ['M12 3v12', 'M8 7v6', 'M16 7v6', 'M4 10v1', 'M20 10v1', 'M8 20h8'],
  microfono: ['M9 6a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0z', 'M5 11a7 7 0 0 0 14 0', 'M12 18v3'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  cerrar: ['M6 6l12 12', 'M18 6L6 18'],
  apple: [
    'M16 3c-1.5.2-3 1.3-3.4 3',
    'M12 7c-2-1.5-6-1-6.6 3.5C4.8 15 8 21 10 21c1 0 1.3-.6 2-.6s1 .6 2 .6c2 0 4.4-4.5 4.6-5.5-1.8-.8-2.8-2.5-2.6-4.4.2-1.6 1.2-2.6 2-3.1C16.6 6.3 14 6 12 7z',
  ],
  play: ['M5 3l14 9-14 9z', 'M5 3l9 9-9 9'],
  salir: ['M10 4H5v16h5', 'M14 8l4 4-4 4', 'M18 12H9'],
};

export function Icono({
  nombre,
  tamano = 20,
  etiqueta,
}: {
  nombre: NombreIcono;
  tamano?: number;
  etiqueta?: string;
}) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(etiqueta ? { role: 'img', 'aria-label': etiqueta } : { 'aria-hidden': true })}
    >
      {TRAZOS[nombre].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
