/* Fotos de la portada.
   Son de Pexels (https://www.pexels.com/license/): uso gratuito, también comercial, sin pedir permiso.
   Se cargan desde el servidor de Pexels. Si prefieres no depender de internet, descárgalas a
   src/assets/fotos/ e impórtalas en lugar de usar estas direcciones. */

const pexels = (id, ancho = 900) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${ancho}`;

export const fotosAula = [
  { src: pexels(8617938), alt: 'Niñas y niños levantan la mano con entusiasmo en un salón de clases' },
  { src: pexels(8471855), alt: 'Grupo de niños hace experimentos de ciencias en el salón' },
  { src: pexels(5621962), alt: 'Tres niños trabajan juntos con un libro en su mesa' },
  { src: pexels(8617845), alt: 'Niños observan con un microscopio en clase' },
  { src: pexels(8466175), alt: 'Tres niñas dibujan juntas en una mesa del salón' },
  { src: pexels(8363771), alt: 'Una maestra choca la mano con sus alumnos durante una actividad' },
];

export const fotoDocente = { src: pexels(8088232), alt: 'Maestra sonriente con un grupo de niños en un salón iluminado' };
export const fotoAlumnos = { src: pexels(8465500), alt: 'Niña levanta la mano para participar en clase' };
export const fotoHero = { src: pexels(3992949, 1000), alt: 'Niños concentrados en una actividad en su salón de clases' };
