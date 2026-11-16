const base = process.env.BASE_URL || 'http://localhost:8080';
const checks = [
  '/api/health',
  '/api/summary',
  '/api/students?limit=5',
  '/api/exercises',
  '/api/workout-pages',
  '/api/fairness',
  '/api/integrations'
];

for (const path of checks) {
  const response = await fetch(`${base}${path}`);
  if (!response.ok) throw new Error(`${path} falhou com HTTP ${response.status}`);
  const data = await response.json();
  console.log(`OK ${path}`, Array.isArray(data) ? `rows=${data.length}` : Object.keys(data).join(','));
}

const rec = await fetch(`${base}/api/recommendations/generate`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ alunoId: 1, userId: 2 })
});
if (!rec.ok) throw new Error(`geracao IA falhou ${rec.status}`);
console.log('OK /api/recommendations/generate');
