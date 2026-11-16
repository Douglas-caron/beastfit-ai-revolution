import { createHash, randomUUID } from 'node:crypto';

export function nowIso() {
  return new Date().toISOString();
}

export function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export function pseudoCpf(seed) {
  return hash(`cpf-${seed}`).slice(0, 32);
}

export function slugify(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function pick(list, index) {
  return list[index % list.length];
}

export function json(value) {
  return JSON.stringify(value ?? null);
}

export function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

export function uuid(prefix = 'id') {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

export function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function ageFromBirthDate(dateString) {
  const born = new Date(dateString);
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) age -= 1;
  return age;
}

export function randomBetween(seed, min, max) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  const n = x - Math.floor(x);
  return Math.round(min + n * (max - min));
}
