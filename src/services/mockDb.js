import { seed } from '../mock/seedData';

/**
 * In-browser mock database used only in Demo Mode.
 * Persists NON-SENSITIVE fictional demo data to localStorage so edits survive
 * refreshes. Replace every service that imports this with REST calls via
 * apiClient.js when the backend is available.
 */
const STORAGE_KEY = 'legal-eagle-demo-db-v2';
let db = null;

export function getDb() {
  if (!db) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      db = raw ? JSON.parse(raw) : structuredClone(seed);
    } catch {
      db = structuredClone(seed);
    }
  }
  return db;
}

export function commit() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    throw new ServiceError('Local demo storage is full. Try a smaller image or reset demo data.');
  }
}

export function resetDb() {
  db = structuredClone(seed);
  commit();
}

export class ServiceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Simulated network latency. */
export const delay = (ms = 300 + Math.random() * 250) => new Promise((r) => setTimeout(r, ms));

export const clone = (value) => structuredClone(value);

export const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
