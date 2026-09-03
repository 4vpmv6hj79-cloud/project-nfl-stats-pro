import { Injectable, inject, signal, effect, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { FirebaseService } from './firebase.service';
import { AnalyticsService } from './analytics.service';
import { SessionService } from './session.service';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly firebase = inject(FirebaseService);
  private readonly analytics = inject(AnalyticsService);
  private readonly session = inject(SessionService);
  private readonly platformId = inject(PLATFORM_ID);

  /** Usuario actual (null = no autenticado) */
  readonly user = signal<AppUser | null>(null);

  /** true mientras se verifica el estado de auth al iniciar */
  readonly loading = signal(true);

  /** Mensaje de error del último intento de login/registro */
  readonly error = signal<string | null>(null);

  /** Se activa cuando la sesión se cerró por inicio en otro dispositivo */
  readonly sessionClosedRemotely = signal(false);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.initAuth();

      // Si la sesión es invalidada por otro dispositivo, cerrar sesión aquí
      effect(() => {
        if (this.session.invalidated() && this.user()) {
          this.sessionClosedRemotely.set(true);
          this.forceLogout();
        }
      });
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
    await this.firebase.initialize();
    const auth = this.firebase.auth;
    if (!auth) return false;

    this.error.set(null);

    try {
      const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
      const credential = await createUserWithEmailAndPassword(auth, email, password);

      if (credential.user && displayName) {
        await updateProfile(credential.user, { displayName });
      }

      this.user.set(this.mapUser(credential.user));
      this.analytics.logEvent('sign_up', { method: 'email' });
      await this.session.registerSession(credential.user.uid);
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
    await this.firebase.initialize();
    const auth = this.firebase.auth;
    if (!auth) return false;

    this.error.set(null);

    try {
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const credential = await signInWithEmailAndPassword(auth, email, password);
      this.user.set(this.mapUser(credential.user));
      this.analytics.logEvent('login', { method: 'email' });
      await this.session.registerSession(credential.user.uid);
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
    await this.firebase.initialize();
    const auth = this.firebase.auth;
    if (!auth) return false;

    this.error.set(null);

    try {
      const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(auth, provider);
      this.user.set(this.mapUser(credential.user));
      this.analytics.logEvent('login', { method: 'google' });
      await this.session.registerSession(credential.user.uid);
      return true;
    } catch (e: any) {
      this.error.set(this.translateError(e.code));
      return false;
    }
  }

  /**
   * Cerrar sesión (acción del usuario).
   */
  async logout(): Promise<void> {
    this.session.clear();
    await this.firebase.initialize();
    const auth = this.firebase.auth;
    if (!auth) return;

    const { signOut } = await import('firebase/auth');
    await signOut(auth);
    this.user.set(null);
  }

  /**
   * Cierre de sesión forzado (por sesión iniciada en otro dispositivo).
   */
  private async forceLogout(): Promise<void> {
    this.session.clear();
    const auth = this.firebase.auth;
    if (auth) {
      const { signOut } = await import('firebase/auth');
      await signOut(auth);
    }
    this.user.set(null);
  }

  private async initAuth(): Promise<void> {
    await this.firebase.initialize();
    const auth = this.firebase.auth;

    if (!auth) {
      this.loading.set(false);
      return;
    }

    const { onAuthStateChanged } = await import('firebase/auth');
    onAuthStateChanged(auth, (firebaseUser: any) => {
      const wasLoggedOut = !this.user();
      this.user.set(firebaseUser ? this.mapUser(firebaseUser) : null);
      this.loading.set(false);

      // Si al restaurar la app hay un usuario ya autenticado (sesión
      // persistida), empezar a vigilar su sesión. Solo registramos una
      // nueva sesión en login/register explícito, no aquí, para no
      // invalidar la sesión de otro dispositivo al abrir la app.
      if (firebaseUser && wasLoggedOut) {
        this.session.watchExisting(firebaseUser.uid);
      }
    });
  }

  private mapUser(u: any): AppUser {
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
