import {
  OnInit,
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FieldDefinition } from '../../models/field-definition';
import { FieldShell } from './field-shell';

/** Stored shape for `file-upload` answers — JSON-safe and human-readable. */
export interface UploadedFileValue {
  name: string;
  dataUrl: string;
}

const MAX_FILE_BYTES = 2 * 1024 * 1024;

@Component({
  selector: 'ngx-file-upload-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldShell, ReactiveFormsModule],
  styles: `
    .file-input { padding: 0.375rem; cursor: pointer; }
    .file-chip {
      display: flex; align-items: center; gap: 0.5rem;
      border: 1px solid var(--ndf-border);
      border-radius: 8px;
      padding: 0.375rem 0.625rem;
      font-size: 0.875rem;
    }
    .file-thumb {
      width: 2.25rem; height: 2.25rem;
      object-fit: cover;
      border-radius: 6px;
    }
    .file-name {
      flex: 1; min-width: 0;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      color: var(--ndf-text);
    }
    .chip-btn {
      border: none; background: none;
      cursor: pointer;
      color: var(--ndf-text-muted);
      font-size: 0.875rem;
      padding: 0 0.25rem;
      line-height: 1;
    }
    .chip-btn:hover { color: var(--ndf-danger); }
    .file-error {
      margin: 0.25rem 0 0;
      font-size: 0.75rem;
      color: var(--ndf-danger);
    }
  `,
  template: `
    <ngx-field-shell [field]="field()" [control]="control()">
      @if (value(); as v) {
        <div class="file-chip" data-testid="file-chip">
          @if (v.dataUrl.startsWith('data:image')) {
            <img class="file-thumb" [src]="v.dataUrl" alt="" />
          }
          <a class="file-name" [href]="v.dataUrl" [download]="v.name" [attr.data-testid]="'file-name-' + field().id">
            {{ v.name }}
          </a>
          <button
            type="button"
            class="chip-btn"
            title="Remove file"
            [attr.data-testid]="'file-clear-' + field().id"
            (click)="clear()"
          >
            ✕
          </button>
        </div>
      } @else {
        <input
          class="ndf-input file-input"
          type="file"
          [id]="field().id"
          [accept]="field().accept ?? ''"
          [attr.data-testid]="'file-input-' + field().id"
          (change)="onPick($any($event.target))"
        />
        @if (tooLarge()) {
          <p class="file-error" role="alert">File exceeds the 2 MB limit.</p>
        }
      }
    </ngx-field-shell>
  `,
})
export class FileUploadField implements OnInit {
  readonly field = input.required<FieldDefinition>();
  readonly control = input.required<FormControl>();

  private readonly destroyRef = inject(DestroyRef);
  readonly value = signal<UploadedFileValue | null>(null);
  readonly tooLarge = signal(false);

  ngOnInit(): void {
    // keep the chip in sync even when values arrive via draft restore
    const sub = this.control().valueChanges.subscribe((v) => this.value.set(v ?? null));
    this.destroyRef.onDestroy(() => sub.unsubscribe());
    this.value.set(this.control().value ?? null);
  }

  onPick(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      this.tooLarge.set(true);
      input.value = '';
      return;
    }
    this.tooLarge.set(false);

    const reader = new FileReader();
    reader.onload = () => {
      const uploaded: UploadedFileValue = { name: file.name, dataUrl: String(reader.result) };
      this.control().setValue(uploaded);
      this.value.set(uploaded);
    };
    reader.readAsDataURL(file);
  }

  clear(): void {
    this.control().setValue(null);
    this.value.set(null);
  }
}

@Component({
  selector: 'ngx-signature-pad',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldShell, ReactiveFormsModule],
  styles: `
    .pad-frame { display: flex; flex-direction: column; gap: 0.25rem; }
    canvas.sig-pad {
      width: 100%;
      height: 9rem;
      border: 1px dashed var(--ndf-border-strong);
      border-radius: 8px;
      background: var(--ndf-surface, #fff);
      touch-action: none;
      cursor: crosshair;
      display: block;
    }
    :host-context(.app-dark) canvas.sig-pad {
      background: #1c1c1c;
    }
    .pad-actions { display: flex; justify-content: flex-end; }
    .sig-preview { max-height: 0.75rem; }
  `,
  template: `
    <ngx-field-shell [field]="field()" [control]="control()">
      <div class="pad-frame">
        @if (control().value; as dataUrl) {
          <img class="sig-preview" [src]="dataUrl" alt="Signature preview" style="display:none" />
        }
        <canvas
          #pad
          class="sig-pad"
          [attr.data-testid]="'signature-pad-' + field().id"
          (pointerdown)="startStroke($event)"
          (pointermove)="moveStroke($event)"
          (pointerup)="endStroke()"
          (pointerleave)="endStroke()"
        ></canvas>
        <div class="pad-actions">
          <button
            type="button"
            class="chip-btn"
            title="Clear signature"
            [attr.data-testid]="'signature-clear-' + field().id"
            (click)="clear()"
          >
            ✕
          </button>
        </div>
      </div>
    </ngx-field-shell>
  `,
})
export class SignaturePad implements AfterViewInit {
  readonly field = input.required<FieldDefinition>();
  readonly control = input.required<FormControl>();

  private readonly padRef = viewChild.required<ElementRef<HTMLCanvasElement>>('pad');
  private ctx: CanvasRenderingContext2D | null = null;
  private drawing = false;

  ngAfterViewInit(): void {
    const canvas = this.padRef().nativeElement;
    // match the bitmap to the CSS box so strokes line up with the cursor
    canvas.width = canvas.clientWidth || 320;
    canvas.height = canvas.clientHeight || 144;
    this.ctx = canvas.getContext('2d');
    if (this.ctx) {
      this.ctx.lineWidth = 2;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.strokeStyle = '#1f2937';
    }
    this.restoreExisting();
  }

  startStroke(event: PointerEvent): void {
    if (!this.ctx) return;
    event.preventDefault();
    this.drawing = true;
    const pos = this.positionOf(event);
    this.ctx.beginPath();
    this.ctx.moveTo(pos.x, pos.y);
  }

  moveStroke(event: PointerEvent): void {
    if (!this.drawing || !this.ctx) return;
    event.preventDefault();
    const pos = this.positionOf(event);
    this.ctx.lineTo(pos.x, pos.y);
    this.ctx.stroke();
  }

  endStroke(): void {
    if (!this.drawing) return;
    this.drawing = false;
    const dataUrl = this.padRef().nativeElement.toDataURL('image/png');
    this.control().setValue(dataUrl);
  }

  clear(): void {
    const canvas = this.padRef().nativeElement;
    this.ctx?.clearRect(0, 0, canvas.width, canvas.height);
    this.control().setValue(null);
  }

  /** Re-draws a restored answer (draft/prefill) so the user sees it. */
  private restoreExisting(): void {
    const existing = this.control().value;
    if (typeof existing !== 'string' || !existing.startsWith('data:image')) return;
    const image = new Image();
    image.onload = () =>
      this.ctx?.drawImage(image, 0, 0, this.padRef().nativeElement.width, this.padRef().nativeElement.height);
    image.src = existing;
  }

  private positionOf(event: PointerEvent): { x: number; y: number } {
    const rect = this.padRef().nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
}
