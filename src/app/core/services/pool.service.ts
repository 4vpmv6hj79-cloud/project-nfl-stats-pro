import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { FirebaseService } from './firebase.service';
import { AuthService } from './auth.service';
import {
  Pool,
  PoolMember,
  PredictionPick,
  UserPredictions,
} from '../../shared/models/domain/pool.model';

/**
 * Servicio de Quiniela (pools). Gestiona grupos entre amigos y sus
 * predicciones en Firestore.
 *
 * Colecciones:
 * - pools/{poolId}
 * - pools/{poolId}/members/{uid}
 * - pools/{poolId}/predictions/{uid}
 *
 * Es una quiniela por puntos, sin dinero.
 */
@Injectable({ providedIn: 'root' })
export class PoolService {
  private readonly firebase = inject(FirebaseService);
  private readonly authService = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private async db(): Promise<any> {
    await this.firebase.initialize();
    return this.firebase.firestore;
  }

  /** Genera un código legible para compartir, ej. "NFL-4X8K2" */
  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin O/0/I/1 para evitar confusión
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return `NFL-${code}`;
  }

  /**
   * Crea un grupo nuevo. El creador queda automáticamente como miembro.
   * Devuelve el grupo creado (con su código para compartir).
   */
  async createPool(name: string): Promise<Pool | null> {
    if (!this.isBrowser) return null;
    const firestore = await this.db();
    const user = this.authService.user();
    if (!firestore || !user) return null;

    const {
      collection,
      doc,
      setDoc,
      serverTimestamp,
    } = await import('firebase/firestore');

    try {
      // Generar un código único (reintentar si colisiona). Si la búsqueda
      // por código falla (p. ej. por reglas/índice), seguimos con el código
      // generado, que es suficientemente aleatorio.
      let code = this.generateCode();
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const existing = await this.findPoolByCode(code);
          if (!existing) break;
          code = this.generateCode();
        } catch {
          break;
        }
      }

      const poolRef = doc(collection(firestore, 'pools'));
      const now = Date.now();

      const pool: Pool = {
        id: poolRef.id,
        name: name.trim() || 'Mi quiniela',
        code,
        ownerUid: user.uid,
        createdAt: now,
        memberCount: 1,
      };

      await setDoc(poolRef, { ...pool, createdAtServer: serverTimestamp() });

      // Agregar al creador como miembro
      await this.addMember(poolRef.id, user.uid, user.displayName ?? 'Usuario');

      return pool;
    } catch (e) {
      // Propagar el error para que la UI muestre un mensaje claro
      console.error('Error al crear la quiniela:', e);
      throw e;
    }
  }

  /** Busca un grupo por su código. Devuelve el grupo o null. */
  async findPoolByCode(code: string): Promise<Pool | null> {
    const firestore = await this.db();
    if (!firestore) return null;

    const { collection, query, where, getDocs, limit } = await import(
      'firebase/firestore'
    );

    const q = query(
      collection(firestore, 'pools'),
      where('code', '==', code.trim().toUpperCase()),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;

    return snap.docs[0].data() as Pool;
  }

  /**
   * Une al usuario actual a un grupo mediante su código.
   * Devuelve el grupo si tuvo éxito, o null si el código no existe.
   */
  async joinPoolByCode(code: string): Promise<Pool | null> {
    if (!this.isBrowser) return null;
    const user = this.authService.user();
    if (!user) return null;

    const pool = await this.findPoolByCode(code);
    if (!pool) return null;

    await this.addMember(pool.id, user.uid, user.displayName ?? 'Usuario');
    return pool;
  }

  /** Agrega un miembro al grupo (idempotente) y actualiza el conteo. */
  private async addMember(
    poolId: string,
    uid: string,
    displayName: string,
  ): Promise<void> {
    const firestore = await this.db();
    if (!firestore) return;

    const { doc, getDoc, setDoc, updateDoc, increment } = await import(
      'firebase/firestore'
    );

    const memberRef = doc(firestore, 'pools', poolId, 'members', uid);
    const existing = await getDoc(memberRef);
    if (existing.exists()) return; // ya es miembro

    const member: PoolMember = {
      uid,
      displayName,
      points: 0,
      correctPicks: 0,
      totalPicks: 0,
      joinedAt: Date.now(),
    };
    await setDoc(memberRef, member);

    // Incrementar el conteo de miembros del grupo
    const poolRef = doc(firestore, 'pools', poolId);
    await updateDoc(poolRef, { memberCount: increment(1) });

    // Registrar el grupo en el documento del usuario (lectura simple, sin
    // necesidad de índices ni collectionGroup para listar "Mis quinielas").
    const { arrayUnion } = await import('firebase/firestore');
    const userRef = doc(firestore, 'users', uid);
    await setDoc(userRef, { pools: arrayUnion(poolId) }, { merge: true });
  }

  /**
   * Devuelve los grupos a los que pertenece el usuario actual.
   * Lee la lista de IDs guardada en users/{uid}.pools (lectura directa,
   * sin collectionGroup ni índices), y trae cada grupo por su id.
   */
  async getMyPools(): Promise<Pool[]> {
    if (!this.isBrowser) return [];
    const firestore = await this.db();
    const user = this.authService.user();
    if (!firestore || !user) return [];

    const { doc, getDoc } = await import('firebase/firestore');

    // Leer los IDs de grupos del documento del usuario
    let poolIds: string[] = [];
    try {
      const userSnap = await getDoc(doc(firestore, 'users', user.uid));
      poolIds = (userSnap.data()?.['pools'] as string[]) ?? [];
    } catch {
      return [];
    }

    // Traer cada grupo por su id (lecturas simples por documento)
    const pools: Pool[] = [];
    for (const poolId of poolIds) {
      try {
        const poolSnap = await getDoc(doc(firestore, 'pools', poolId));
        if (poolSnap.exists()) {
          pools.push(poolSnap.data() as Pool);
        }
      } catch {
        // ignorar grupos que no se puedan leer
      }
    }

    return pools.sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Devuelve un grupo por su id. */
  async getPool(poolId: string): Promise<Pool | null> {
    const firestore = await this.db();
    if (!firestore) return null;

    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(firestore, 'pools', poolId));
    return snap.exists() ? (snap.data() as Pool) : null;
  }

  /** Devuelve los miembros de un grupo, ordenados por puntos (ranking). */
  async getMembers(poolId: string): Promise<PoolMember[]> {
    const firestore = await this.db();
    if (!firestore) return [];

    const { collection, getDocs } = await import('firebase/firestore');
    const snap = await getDocs(collection(firestore, 'pools', poolId, 'members'));

    return snap.docs
      .map((d) => d.data() as PoolMember)
      .sort((a, b) => b.points - a.points || b.correctPicks - a.correctPicks);
  }

  /** Devuelve las predicciones del usuario actual en un grupo. */
  async getMyPredictions(poolId: string): Promise<UserPredictions | null> {
    const firestore = await this.db();
    const user = this.authService.user();
    if (!firestore || !user) return null;

    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(
      doc(firestore, 'pools', poolId, 'predictions', user.uid),
    );
    return snap.exists() ? (snap.data() as UserPredictions) : null;
  }

  /** Devuelve las predicciones de TODOS los miembros de un grupo. */
  async getAllPredictions(poolId: string): Promise<UserPredictions[]> {
    const firestore = await this.db();
    if (!firestore) return [];

    const { collection, getDocs } = await import('firebase/firestore');
    const snap = await getDocs(
      collection(firestore, 'pools', poolId, 'predictions'),
    );
    return snap.docs.map((d) => d.data() as UserPredictions);
  }

  /**
   * Guarda (o actualiza) una predicción del usuario para un partido.
   * Las predicciones NO se reinician: quedan guardadas para toda la temporada.
   */
  async savePick(
    poolId: string,
    gameId: string,
    pick: 'home' | 'away',
    week: number,
  ): Promise<void> {
    if (!this.isBrowser) return;
    const firestore = await this.db();
    const user = this.authService.user();
    if (!firestore || !user) return;

    const { doc, setDoc } = await import('firebase/firestore');
    const predRef = doc(
      firestore,
      'pools',
      poolId,
      'predictions',
      user.uid,
    );

    const pickData: PredictionPick = { gameId, pick, week };

    await setDoc(
      predRef,
      {
        uid: user.uid,
        displayName: user.displayName ?? 'Usuario',
        updatedAt: Date.now(),
        picks: { [gameId]: pickData },
      },
      { merge: true },
    );
  }

  /**
   * Actualiza el puntaje de un miembro (aciertos). Lo usa el cálculo
   * de puntajes cuando compara predicciones con resultados reales.
   */
  async updateMemberScore(
    poolId: string,
    uid: string,
    points: number,
    correctPicks: number,
    totalPicks: number,
  ): Promise<void> {
    const firestore = await this.db();
    if (!firestore) return;

    const { doc, setDoc } = await import('firebase/firestore');
    await setDoc(
      doc(firestore, 'pools', poolId, 'members', uid),
      { points, correctPicks, totalPicks },
      { merge: true },
    );
  }
}
