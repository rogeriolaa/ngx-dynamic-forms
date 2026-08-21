import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Responder } from './responder';

describe('Responder', () => {
  let component: Responder;
  let fixture: ComponentFixture<Responder>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Responder],
    }).compileComponents();

    fixture = TestBed.createComponent(Responder);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
