import {
  trigger,
  transition,
  style,
  animate,
  query,
  stagger,
  state,
} from '@angular/animations';

/**
 * Animación de entrada escalonada para listas de elementos.
 * Uso: [@staggerFadeIn]="items.length"
 */
export const staggerFadeIn = trigger('staggerFadeIn', [
  transition('* => *', [
    query(':enter', [
      style({ opacity: 0, transform: 'translateY(12px)' }),
      stagger(50, [
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ], { optional: true }),
  ]),
]);

/**
 * Fade in simple para un elemento.
 * Uso: [@fadeIn]
 */
export const fadeIn = trigger('fadeIn', [
  transition(':enter', [
    style({ opacity: 0 }),
    animate('250ms ease-out', style({ opacity: 1 })),
  ]),
]);

/**
 * Slide in desde abajo.
 * Uso: [@slideUp]
 */
export const slideUp = trigger('slideUp', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(16px)' }),
    animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
  ]),
]);

/**
 * Escala para botones/iconos interactivos.
 * Uso: [@scaleIn]
 */
export const scaleIn = trigger('scaleIn', [
  transition(':enter', [
    style({ opacity: 0, transform: 'scale(0.8)' }),
    animate('200ms ease-out', style({ opacity: 1, transform: 'scale(1)' })),
  ]),
]);

/**
 * Animación de score cambiando (flash).
 * Uso: [@scoreFlash]="score"
 */
export const scoreFlash = trigger('scoreFlash', [
  transition('* => *', [
    style({ color: '#22C55E', transform: 'scale(1.15)' }),
    animate('400ms ease-out', style({ color: '*', transform: 'scale(1)' })),
  ]),
]);
