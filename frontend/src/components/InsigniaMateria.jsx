/** Etiqueta de color con el icono y el nombre de la materia. */
export default function InsigniaMateria({ materia, corta = false, className = '' }) {
  const { Icono } = materia;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-extrabold sm:text-sm ${className}`}
      style={{ backgroundColor: materia.suave, borderColor: materia.color, color: materia.tinta }}
    >
      <Icono size={15} strokeWidth={2.6} aria-hidden="true" />
      {corta ? materia.corto : materia.nombre}
    </span>
  );
}
