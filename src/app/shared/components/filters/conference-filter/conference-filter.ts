import { Component, EventEmitter, Output } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

@Component({
  selector: 'app-conference-filter',
  standalone: true,
  imports: [
    MatButtonToggleModule
  ],
  templateUrl: './conference-filter.html',
  styleUrl: './conference-filter.scss'
})
export class ConferenceFilterComponent {

  @Output()
  conferenceChange = new EventEmitter<string>();

  onChange(value: string) {
    this.conferenceChange.emit(value);
  }

}
