import { Posicion } from '../entities/Posicion';
import { ContextoNavegacion, EstrategiaDeNavegacion } from './EstrategiaDeNavegacion';

export class MovimientoEnL implements EstrategiaDeNavegacion {
  public siguientePaso(
    origen: Posicion,
    destino: Posicion,
    robotId: string,
    contexto: ContextoNavegacion
  ): Posicion | null {
    const candidatos: Posicion[] = [];

    if (origen.x !== destino.x) {
      candidatos.push({ x: origen.x + Math.sign(destino.x - origen.x), y: origen.y });
    }

    if (origen.y !== destino.y) {
      candidatos.push({ x: origen.x, y: origen.y + Math.sign(destino.y - origen.y) });
    }

    for (const candidato of candidatos) {
      if (contexto.estaDentroDelMapa(candidato) && contexto.puedeOcupar(candidato, robotId)) {
        return candidato;
      }
    }

    return null;
  }
}
