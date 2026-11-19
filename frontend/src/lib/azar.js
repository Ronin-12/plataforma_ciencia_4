/** Devuelve una copia del arreglo en orden aleatorio (Fisher-Yates). */
export function mezclar(elementos) {
  const resultado = [...elementos];
  for (let indice = resultado.length - 1; indice > 0; indice -= 1) {
    const destino = Math.floor(Math.random() * (indice + 1));
    [resultado[indice], resultado[destino]] = [resultado[destino], resultado[indice]];
  }
  return resultado;
}
