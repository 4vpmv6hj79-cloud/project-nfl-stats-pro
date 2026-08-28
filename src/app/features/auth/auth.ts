import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [
    FormsModule,
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

  readonly mode = signal<'login' | 'register'>('login');
  readonly loading = signal(false);
  readonly showPassword = signal(false);

  // Form fields
  email = '';
  password = '';
  displayName = '';

  get errorMessage(): string | null {
    return this.authService.error();
  }

  toggleMode(): void {
    this.mode.update(m => m === 'login' ? 'register' : 'login');
    this.authService.error.set(null);
  }

  async onSubmit(): Promise<void> {
    if (this.loading()) return;

    this.loading.set(true);

    let success: boolean;

    if (this.mode() === 'register') {
      success = await this.authService.register(
        this.email,
        this.password,
        this.displayName
      );
    } else {
      success = await this.authService.login(this.email, this.password);
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
}
