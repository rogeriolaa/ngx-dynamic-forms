import * as vi from 'vitest';

// Jest-compat shim
(globalThis as Record<string, unknown>)['jest'] = vi;

// In-memory IndexedDB so repository specs run outside a browser.
import 'fake-indexeddb/auto';
