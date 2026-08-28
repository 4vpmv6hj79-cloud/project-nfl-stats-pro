import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
} from 'firebase/auth';

import { FirebaseService } from './firebase.service';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly firebase = inject(FirebaseService);
  private readonly platformId = inject(PLATFORM_ID);

  /** Usuario actual (null = no autenticado) */
  readonly user = signal<AppUser | null>(null);

  /** true mientras se verifica el estado de auth al iniciar */
  readonly loading = signal(true);

  /** Mensaje de error del último intento de login/registro */
  readonly error = signal<string | null>(null);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.listenAuthState();
    } else {
      this.loading.set(false);
    }
  }

  get isAuthenticated(): boolean {
    return this.user() !== null;
  }

  /**
   * Registro con correo y contraseña.
   */
  async register(email: string, password: string, displayName: string): Promise<boolean> {
    const auth = this.firebase.auth;
    if (!auth) return false;

    this.error.set(null);

    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);

      if (credential.user && displayName) {
        await updateProfile(credential.user, { displayName });
      }

      this.user.set(this.mapUser(credential.user));
      return true;
    } catch (e: any) {
      this.error.set(this.translateError(e.code));
      return false;
    }
  }

  /**
   * Login con correo y contraseña.
   */
  async login(email: string, password: string): Promise<boolean> {
    const auth = this.firebase.auth;
    if (!auth) return false;

    this.error.set(null);

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      this.user.set(this.mapUser(credential.user));
      return true;
    } catch (e: any) {
      this.error.set(this.translateError(e.code));
      return false;
    }
  }

  /**
   * Login con Google (popup).
   */
  async loginWithGoogle(): Promise<boolean> {
    const auth = this.firebase.auth;
    if (!auth) return false;

    this.error.set(null);

    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(auth, provider);
      this.user.set(this.mapUser(credential.user));
      return true;
    } catch (e: any) {
      this.error.set(this.translateError(e.code));
      return false;
    }
  }

  /**
   * Cerrar sesión.
   */
  async logout(): Promise<void> {
    const auth = this.firebase.auth;
    if (!auth) return;

    await signOut(auth);
    this.user.set(null);
  }

  private listenAuthState(): void {
    const auth = this.firebase.auth;
    if (!auth) {
      this.loading.set(false);
      return;
    }

    onAuthStateChanged(auth, (firebaseUser) => {
      this.user.set(firebaseUser ? this.mapUser(firebaseUser) : null);
      this.loading.set(false);
    });
  }

  private mapUser(u: User): AppUser {
    return {
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      photoURL: u.photoURL,
    };
  }

  private translateError(code: string): string {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'Este correo ya está registrado.';
      case 'auth/invalid-email':
        return 'Correo electrónico inválido.';
      case 'auth/weak-password':
        return 'La contraseña debe tener al menos 6 caracteres.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Correo o contraseña incorrectos.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos. Intenta más tarde.';
      case 'auth/popup-closed-by-user':
        return 'Se cerró la ventana de inicio de sesión.';
      case 'auth/network-request-failed':
        return 'Error de conexión. Verifica tu internet.';
      default:
        return 'Ocurrió un error. Intenta de nuevo.';
    }
  }
}
