import { Component, OnInit, inject, signal } from '@angular/core';

import { ConferenceService } from
  '../../../../core/services/api/conference.service';
import { Conference } from '../../../../shared/models/domain/conference.model';

@Component({
  selector: 'app-conference-list',
  standalone: true,
  imports: [],
  templateUrl: './conference-list.html',
  styleUrl: './conference-list.scss',
})
export class ConferenceListComponent implements OnInit {

  private readonly conferenceService =
    inject(ConferenceService);

  readonly conferences = signal<Conference[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);

  ngOnInit(): void {
    this.conferenceService.getConferences().subscribe({
      next: (conferences) => {
        this.conferences.set(conferences);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
