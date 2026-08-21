import { FieldCategory, FieldType } from '../models/field-definition';

/** Static description of one field type — drives palette, icons and defaults. */
export interface FieldTypeMeta {
  type: FieldType;
  label: string;
  icon: string; // primeicons class
  category: FieldCategory;
  /** Whether the type consumes an options[] list. */
  supportsOptions: boolean;
  /** Config a newly added field of this type starts with. */
  defaultConfig: Partial<FieldTypeMeta & Record<string, unknown>>;
}

/**
 * Ordered v1 catalog. `hidden`, `section` are non-input categories;
 * everything else renders as an editable control.
 */
export const BUILT_IN_FIELD_TYPES: FieldTypeMeta[] = [
  {
    type: 'text',
    label: 'Short text',
    icon: 'pi pi-pencil',
    category: 'input',
    supportsOptions: false,
    defaultConfig: {},
  },
  {
    type: 'textarea',
    label: 'Long text',
    icon: 'pi pi-align-left',
    category: 'input',
    supportsOptions: false,
    defaultConfig: { rows: 4 },
  },
  {
    type: 'number',
    label: 'Number',
    icon: 'pi pi-hashtag',
    category: 'input',
    supportsOptions: false,
    defaultConfig: {},
  },
  {
    type: 'email',
    label: 'Email',
    icon: 'pi pi-envelope',
    category: 'input',
    supportsOptions: false,
    defaultConfig: {},
  },
  {
    type: 'date',
    label: 'Date',
    icon: 'pi pi-calendar',
    category: 'input',
    supportsOptions: false,
    defaultConfig: {},
  },
  {
    type: 'dropdown',
    label: 'Dropdown',
    icon: 'pi pi-chevron-down',
    category: 'input',
    supportsOptions: true,
    defaultConfig: {
      options: [
        { label: 'Option A', value: 'a' },
        { label: 'Option B', value: 'b' },
      ],
    },
  },
  {
    type: 'multi-select',
    label: 'Multi select',
    icon: 'pi pi-list',
    category: 'input',
    supportsOptions: true,
    defaultConfig: {
      options: [
        { label: 'Option A', value: 'a' },
        { label: 'Option B', value: 'b' },
      ],
    },
  },
  {
    type: 'radio',
    label: 'Radio group',
    icon: 'pi pi-circle-fill',
    category: 'input',
    supportsOptions: true,
    defaultConfig: {
      options: [
        { label: 'Yes', value: 'yes' },
        { label: 'No', value: 'no' },
      ],
    },
  },
  {
    type: 'checkbox',
    label: 'Checkbox',
    icon: 'pi pi-check-square',
    category: 'input',
    supportsOptions: false,
    defaultConfig: { defaultValue: false },
  },
  {
    type: 'checkbox-group',
    label: 'Checkbox group',
    icon: 'pi pi-check-square',
    category: 'input',
    supportsOptions: true,
    defaultConfig: {
      options: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
      ],
    },
  },
  {
    type: 'rating',
    label: 'Rating',
    icon: 'pi pi-star',
    category: 'input',
    supportsOptions: false,
    defaultConfig: { max: 5 },
  },
  {
    type: 'slider',
    label: 'Slider',
    icon: 'pi pi-arrows-h',
    category: 'input',
    supportsOptions: false,
    defaultConfig: { min: 0, max: 100, step: 1 },
  },
  {
    type: 'section',
    label: 'Section header',
    icon: 'pi pi-minus',
    category: 'layout',
    supportsOptions: false,
    defaultConfig: {},
  },
  {
    type: 'hidden',
    label: 'Hidden field',
    icon: 'pi pi-eye-slash',
    category: 'hidden',
    supportsOptions: false,
    defaultConfig: {},
  },
];
