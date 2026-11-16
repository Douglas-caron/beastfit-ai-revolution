export async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    ...options,
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
  });
  const type = response.headers.get('content-type') || '';
  const data = type.includes('json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof data === 'object' ? data.error : data;
    throw new Error(message || `HTTP ${response.status}`);
  }
  return data;
}

export function formatPct(value) {
  if (value == null || Number.isNaN(Number(value))) return '0%';
  return `${Math.round(Number(value) * 100)}%`;
}

export function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value || 0));
}
