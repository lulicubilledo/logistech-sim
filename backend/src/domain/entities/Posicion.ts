export interface Posicion {
  x: number;
  y: number;
}

export function mismaPosicion(a: Posicion, b: Posicion): boolean {
  return a.x === b.x && a.y === b.y;
}

export function clavePosicion(posicion: Posicion): string {
  return `${posicion.x},${posicion.y}`;
}

export function distanciaManhattan(a: Posicion, b: Posicion): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
