import { Posicion, clavePosicion, distanciaManhattan } from '../entities/Posicion';
import { ContextoNavegacion, EstrategiaDeNavegacion } from './EstrategiaDeNavegacion';

export class AEstrella implements EstrategiaDeNavegacion {
  public siguientePaso(
    origen: Posicion,
    destino: Posicion,
    robotId: string,
    contexto: ContextoNavegacion
  ): Posicion | null {
    const inicio = clavePosicion(origen);
    const objetivo = clavePosicion(destino);
    const abiertos: Posicion[] = [origen];
    const vieneDesde = new Map<string, string>();
    const costo = new Map<string, number>([[inicio, 0]]);

    while (abiertos.length > 0) {
      abiertos.sort((a, b) => {
        const costoA = (costo.get(clavePosicion(a)) ?? Infinity) + distanciaManhattan(a, destino);
        const costoB = (costo.get(clavePosicion(b)) ?? Infinity) + distanciaManhattan(b, destino);
        return costoA - costoB;
      });

      const actual = abiertos.shift();
      if (!actual) break;
      const actualClave = clavePosicion(actual);

      if (actualClave === objetivo) {
        return this.reconstruirPrimerPaso(origen, destino, vieneDesde);
      }

      for (const vecino of this.vecinos(actual)) {
        if (!contexto.estaDentroDelMapa(vecino)) continue;
        if (!contexto.puedeOcupar(vecino, robotId)) continue;

        const vecinoClave = clavePosicion(vecino);
        const nuevoCosto = (costo.get(actualClave) ?? Infinity) + 1;
        if (nuevoCosto >= (costo.get(vecinoClave) ?? Infinity)) continue;

        vieneDesde.set(vecinoClave, actualClave);
        costo.set(vecinoClave, nuevoCosto);
        if (!abiertos.some((posicion) => clavePosicion(posicion) === vecinoClave)) {
          abiertos.push(vecino);
        }
      }
    }

    return null;
  }

  private vecinos(posicion: Posicion): Posicion[] {
    return [
      { x: posicion.x + 1, y: posicion.y },
      { x: posicion.x - 1, y: posicion.y },
      { x: posicion.x, y: posicion.y + 1 },
      { x: posicion.x, y: posicion.y - 1 },
    ];
  }

  private reconstruirPrimerPaso(
    origen: Posicion,
    destino: Posicion,
    vieneDesde: Map<string, string>
  ): Posicion | null {
    const origenClave = clavePosicion(origen);
    let actualClave = clavePosicion(destino);
    let anteriorClave = vieneDesde.get(actualClave);

    if (!anteriorClave) return null;

    while (anteriorClave !== origenClave) {
      actualClave = anteriorClave;
      anteriorClave = vieneDesde.get(actualClave);
      if (!anteriorClave) return null;
    }

    const [x, y] = actualClave.split(',').map(Number);
    return { x, y };
  }
}
