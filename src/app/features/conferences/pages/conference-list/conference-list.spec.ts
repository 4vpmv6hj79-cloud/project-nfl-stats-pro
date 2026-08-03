import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConferenceList } from './conference-list';

describe('ConferenceList', () => {
  let component: ConferenceList;
  let fixture: ComponentFixture<ConferenceList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConferenceList],
    }).compileComponents();

    fixture = TestBed.createComponent(ConferenceList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
