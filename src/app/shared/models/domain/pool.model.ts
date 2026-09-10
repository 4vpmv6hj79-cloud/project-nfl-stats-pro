/**
 * Modelos para la Quiniela (pools) entre usuarios.
 *
 * Estructura en Firestore:
 * - pools/{poolId}                     → datos del grupo
 * - pools/{poolId}/members/{uid}       → miembros del grupo y su puntaje
 * - pools/{poolId}/predictions/{uid}   → predicciones de cada miembro
 *
 * Sin dinero: es una quiniela amistosa por puntos.
 */

/** Un grupo de quiniela */
export interface Pool {
  id: string;
  name: string;
  code: string;          // Código para compartir e invitar (ej. "NFL-4X8K2")
  ownerUid: string;      // Quién creó el grupo
  createdAt: number;
  memberCount: number;
}

/** Un miembro de un grupo */
export interface PoolMember {
  uid: string;
  displayName: string;
  points: number;        // Aciertos acumulados
  correctPicks: number;  // Predicciones correctas
  totalPicks: number;    // Predicciones hechas (de partidos ya finalizados)
  joinedAt: number;
}

/**
 * Predicción de un usuario para un partido.
 * La clave en Firestore es el gameId; el valor es el equipo elegido.
 */
export interface PredictionPick {
  gameId: string;
  pick: 'home' | 'away';   // Equipo que el usuario cree que ganará
  week: number;
}

/** Documento de predicciones de un usuario en un grupo */
export interface UserPredictions {
  uid: string;
  displayName: string;
  picks: Record<string, PredictionPick>;  // gameId -> pick
  updatedAt: number;
}
