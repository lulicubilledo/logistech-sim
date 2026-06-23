import { Posicion } from '../entities/Posicion';

export interface ContextoNavegacion {
  estaDentroDelMapa(posicion: Posicion): boolean;
  puedeOcupar(posicion: Posicion, robotId: string): boolean;
}

export interface EstrategiaDeNavegacion {
  siguientePaso(
    origen: Posicion,
    destino: Posicion,
    robotId: string,
    contexto: ContextoNavegacion
  ): Posicion | null;
}

