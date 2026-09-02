import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';

export type ExplainLevel = 'beginner' | 'advanced';

export interface ExplainResult {
  explanation: string;
  available: boolean;
}

@Injectable({ providedIn: 'root' })
export class AiExplainService {
  private readonly http = inject(HttpClient);

  /**
   * Solicita una explicación en español del estado del partido.
   * Si la IA no está configurada (503) devuelve available: false
   * para que el frontend oculte la feature.
   */
  explain(context: string, level: ExplainLevel): Observable<ExplainResult> {
    return this.http
      .post<{ explanation: string }>('/api/explain', { context, level })
      .pipe(
        map(res => ({
          explanation: res.explanation ?? '',
          available: true,
        })),
        catchError(() =>
          of({ explanation: '', available: false })
        ),
      );
  }
}
