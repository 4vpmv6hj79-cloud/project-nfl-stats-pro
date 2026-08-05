import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';

import { ConferenceService } from
  '../../../../core/services/api/conference.service';

@Component({
  selector: 'app-conference-list',
  standalone: true,
  imports: [
    AsyncPipe,
  ],
  templateUrl: './conference-list.html',
  styleUrl: './conference-list.scss',
})
export class ConferenceListComponent {

  private readonly conferenceService =
    inject(ConferenceService);

  readonly conferences$ =
    this.conferenceService.getConferences();
}
