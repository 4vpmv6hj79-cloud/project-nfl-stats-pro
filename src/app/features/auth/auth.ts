import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { AuthService } from '../../core/services/auth.service';

// Dominios de correo bloqueados (test/temporales)
const BLOCKED_EMAIL_DOMAINS = [
  'test.com', 'example.com', 'fake.com', 'temp.com',
  'throwaway.com', 'mailinator.com', 'guerrillamail.com',
  'yopmail.com', 'tempmail.com', 'sharklasers.com',
  'trashmail.com', 'dispostable.com',
];

const BLOCKED_EMAILS = [
  'test@test.com', 'admin@admin.com', 'user@user.com',
  'a@a.com', 'abc@abc.com', 'asdf@asdf.com',
];

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './auth.html',
  styleUrl: './auth.scss',
})
export class AuthComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly mode = signal<'login' | 'register'>('login');
  readonly loading = signal(false);
  readonly showPassword = signal(false);

  /** Formulario de registro */
  readonly registerForm: FormGroup = this.fb.group({
    displayName: ['', [
      Validators.required,
      Validators.minLength(2),
      Validators.maxLength(50),
      this.nameValidator,
    ]],
    email: ['', [
      Validators.required,
      Validators.email,
      this.realEmailValidator,
    ]],
    password: ['', [
      Validators.required,
      Validators.minLength(6),
      Validators.maxLength(50),
      this.passwordValidator,
    ]],
  });

  /** Formulario de login */
  readonly loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  get errorMessage(): string | null {
    return this.authService.error();
  }

  toggleMode(): void {
    this.mode.update(m => m === 'login' ? 'register' : 'login');
    this.authService.error.set(null);
    this.registerForm.reset();
    this.loginForm.reset();
  }

  async onSubmit(): Promise<void> {
    if (this.loading()) return;

    const form = this.mode() === 'register' ? this.registerForm : this.loginForm;

    // Marcar todos los campos como touched para mostrar errores
    form.markAllAsTouched();

    if (form.invalid) return;

    this.loading.set(true);

    let success: boolean;

    if (this.mode() === 'register') {
      const { email, password, displayName } = this.registerForm.value;
      success = await this.authService.register(email, password, displayName);
    } else {
      const { email, password } = this.loginForm.value;
      success = await this.authService.login(email, password);
    }

    this.loading.set(false);

    if (success) {
      this.router.navigate(['/dashboard']);
    }
  }

  async loginWithGoogle(): Promise<void> {
    if (this.loading()) return;

    this.loading.set(true);
    const success = await this.authService.loginWithGoogle();
    this.loading.set(false);

    if (success) {
      this.router.navigate(['/dashboard']);
    }
  }

  // ── Validators ────────────────────────────────────────────

  /**
   * Solo permite letras (incluyendo acentos/ñ), espacios y guiones.
   */
  private nameValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (!value) return null;

    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\-']+$/;
    if (!nameRegex.test(value)) {
      return { invalidName: true };
    }

    return null;
  }

  /**
   * Valida que el email sea real:
   * - No sea de un dominio bloqueado (test.com, example.com, etc.)
   * - No sea un email conocido de prueba
   * - Tenga un formato válido con dominio real (al menos 2 caracteres en TLD)
   */
  private realEmailValidator(control: AbstractControl): ValidationErrors | null {
    const value = (control.value ?? '').toLowerCase().trim();
    if (!value) return null;

    // Verificar formato básico
    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(value)) {
      return { invalidEmail: true };
    }

    // Verificar emails bloqueados
    if (BLOCKED_EMAILS.includes(value)) {
      return { blockedEmail: true };
    }

    // Verificar dominios bloqueados
    const domain = value.split('@')[1];
    if (BLOCKED_EMAIL_DOMAINS.includes(domain)) {
      return { blockedDomain: true };
    }

    // El nombre de usuario no puede ser solo números o un solo carácter
    const username = value.split('@')[0];
    if (username.length < 2) {
      return { invalidEmail: true };
    }

    return null;
  }

  /**
   * Valida la contraseña:
   * - Al menos 6 caracteres
   * - Solo permite: letras, números, y estos caracteres especiales: !@#$%^&*._-
   * - Debe tener al menos una letra y un número
   */
  private passwordValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (!value) return null;

    // Solo caracteres permitidos
    const allowedChars = /^[a-zA-Z0-9!@#$%^&*._\-]+$/;
    if (!allowedChars.test(value)) {
      return { invalidChars: true };
    }

    // Debe tener al menos una letra
    if (!/[a-zA-Z]/.test(value)) {
      return { needsLetter: true };
    }

    // Debe tener al menos un número
    if (!/[0-9]/.test(value)) {
      return { needsNumber: true };
    }

    return null;
  }

  // ── Error messages ────────────────────────────────────────

  getNameError(): string {
    const control = this.registerForm.get('displayName');
    if (!control?.touched || !control.errors) return '';

    if (control.errors['required']) return 'El nombre es requerido.';
    if (control.errors['minlength']) return 'El nombre debe tener al menos 2 caracteres.';
    if (control.errors['maxlength']) return 'El nombre no puede exceder 50 caracteres.';
    if (control.errors['invalidName']) return 'Solo se permiten letras, espacios y guiones.';
    return '';
  }

  getEmailError(): string {
    const form = this.mode() === 'register' ? this.registerForm : this.loginForm;
    const control = form.get('email');
    if (!control?.touched || !control.errors) return '';

    if (control.errors['required']) return 'El correo es requerido.';
    if (control.errors['email'] || control.errors['invalidEmail']) return 'Ingresa un correo electrónico válido.';
    if (control.errors['blockedEmail'] || control.errors['blockedDomain']) return 'Este correo no está permitido. Usa un correo real.';
    return '';
  }

  getPasswordError(): string {
    const form = this.mode() === 'register' ? this.registerForm : this.loginForm;
    const control = form.get('password');
    if (!control?.touched || !control.errors) return '';

    if (control.errors['required']) return 'La contraseña es requerida.';
    if (control.errors['minlength']) return 'La contraseña debe tener al menos 6 caracteres.';
    if (control.errors['invalidChars']) return 'Solo se permiten letras, números y: !@#$%^&*._-';
    if (control.errors['needsLetter']) return 'La contraseña debe incluir al menos una letra.';
    if (control.errors['needsNumber']) return 'La contraseña debe incluir al menos un número.';
    return '';
  }
}
