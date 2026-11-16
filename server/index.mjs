import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { all, get, getDb, run, transaction } from './db.mjs';
import { approveRecommendation, finishSession, generateRecommendation, recommendationDetail, startSession, triggerKillSwitch } from './aiEngine.mjs';
import { integrationById } from './integrationRegistry.mjs';
import { hash, json, nowIso, parseJson } from './utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'client', 'dist');
const port = Number(process.env.PORT || 8080);

function send(res, status, payload, headers = {}) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'content-type': typeof payload === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    ...headers
  });
  res.end(body);
}

function ok(res, payload) { send(res, 200, payload); }
function created(res, payload) { send(res, 201, payload); }
function notFound(res) { send(res, 404, { error: 'Rota nao encontrada' }); }

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return { raw }; }
}

function rowsWithJson(rows, fields) {
  return rows.map((row) => {
    const copy = { ...row };
    for (const field of fields) copy[field.replace('_json', '')] = parseJson(copy[field], copy[field]);
    return copy;
  });
}

function studentDetail(id) {
  const aluno = get('SELECT a.*, u.nome AS unidade_nome FROM aluno a LEFT JOIN unidade u ON u.id = a.unidade_id WHERE a.id = ?', [id]);
  if (!aluno) return null;
  const detail = {
    aluno,
    consentimento: get('SELECT * FROM consentimento_lgpd WHERE aluno_id = ? ORDER BY dt_aceite DESC LIMIT 1', [id]),
    triagem: get('SELECT * FROM triagem_saude WHERE aluno_id = ? ORDER BY dt_triagem DESC LIMIT 1', [id]),
    avaliacao: get('SELECT * FROM avaliacao_fisica WHERE aluno_id = ? ORDER BY dt_avaliacao DESC LIMIT 1', [id]),
    meta: get('SELECT * FROM meta_aluno WHERE aluno_id = ? ORDER BY id DESC LIMIT 1', [id]),
    wearables: all('SELECT * FROM wearable_resumo WHERE aluno_id = ? ORDER BY data_ref DESC LIMIT 14', [id]),
    planos: all('SELECT * FROM plano_treino WHERE aluno_id = ? ORDER BY id DESC LIMIT 10', [id]),
    recomendacoes: rowsWithJson(all('SELECT * FROM recomendacao_ia WHERE aluno_id = ? ORDER BY id DESC LIMIT 8', [id]), ['guardrails_json']),
    alertas: all('SELECT * FROM alerta WHERE aluno_id = ? ORDER BY dt_geracao DESC LIMIT 8', [id]),
    sessoes: all('SELECT * FROM sessao_treino WHERE aluno_id = ? ORDER BY dt_inicio DESC LIMIT 10', [id]),
    badges: all('SELECT * FROM game_badge WHERE aluno_id = ? ORDER BY earned_at DESC LIMIT 10', [id])
  };
  return detail;
}

function kpis() {
  const totalStudents = get('SELECT COUNT(*) AS total FROM aluno').total;
  const activeStudents = get("SELECT COUNT(*) AS total FROM aluno WHERE status IN ('ativo','atencao')").total;
  const units = get('SELECT COUNT(*) AS total FROM unidade').total;
  const exercises = get('SELECT COUNT(*) AS total FROM exercicio').total;
  const plans = get('SELECT COUNT(*) AS total FROM plano_treino').total;
  const published = get("SELECT COUNT(*) AS total FROM plano_treino WHERE status IN ('publicado','aprovado')").total;
  const highRisk = get("SELECT COUNT(*) AS total FROM recomendacao_ia WHERE score_risco >= 0.68").total;
  const avg = get('SELECT AVG(score_aderencia) AS aderencia, AVG(score_risco) AS risco, AVG(score_resposta) AS resposta FROM recomendacao_ia');
  const alerts = get("SELECT COUNT(*) AS total FROM alerta WHERE status = 'aberto'").total;
  const incidents = get("SELECT COUNT(*) AS total FROM incidente_gov WHERE status = 'aberto'").total;
  return { totalStudents, activeStudents, units, exercises, plans, published, highRisk, alerts, incidents, avgAdherence: avg.aderencia, avgRisk: avg.risco, avgResponse: avg.resposta };
}

function retention() {
  const byUnit = all(`SELECT u.nome AS unidade, COUNT(a.id) AS alunos, ROUND(AVG(COALESCE(fs.feature_value,0.5)),3) AS aderencia_media
    FROM unidade u LEFT JOIN aluno a ON a.unidade_id = u.id LEFT JOIN feature_store fs ON fs.aluno_id = a.id AND fs.feature_key='weekly_adherence'
    GROUP BY u.id ORDER BY aderencia_media DESC`);
  const riskList = all(`SELECT a.id, a.nome, a.nivel, a.segmento, u.nome AS unidade, r.score_aderencia, r.score_risco, r.status
    FROM recomendacao_ia r JOIN aluno a ON a.id = r.aluno_id LEFT JOIN unidade u ON u.id = a.unidade_id
    ORDER BY r.score_aderencia ASC, r.score_risco DESC LIMIT 30`);
  const interventions = riskList.slice(0, 12).map((row) => ({ ...row, acao: row.score_risco > 0.65 ? 'revisao humana + treino regenerativo' : 'mensagem de reengajamento + ajuste de meta' }));
  return { byUnit, riskList, interventions };
}

function fairness() {
  const metrics = all('SELECT * FROM metrica_fairness ORDER BY status, grupo');
  const slices = all(`SELECT a.sexo, a.nivel, COUNT(*) AS alunos, ROUND(AVG(r.score_risco),3) AS risco, ROUND(AVG(r.score_aderencia),3) AS aderencia
    FROM aluno a JOIN recomendacao_ia r ON r.aluno_id = a.id GROUP BY a.sexo, a.nivel ORDER BY risco DESC`);
  return { metrics, slices, summary: { status: metrics.every((m) => m.status === 'ok') ? 'aprovado' : 'em_observacao', limiarMinimo: 0.82 } };
}

function dataDictionary() {
  const db = getDb();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  return tables.map(({ name }) => ({ table: name, columns: db.prepare(`PRAGMA table_info(${name})`).all().map((c) => ({ name: c.name, type: c.type, required: c.notnull === 1, pk: c.pk === 1 })) }));
}

function architecture() {
  return {
    layers: [
      { name: 'Canais', nodes: ['App do Aluno','Portal do Instrutor','Portal do Gestor/Admin','Recepcao'] },
      { name: 'Aplicacao Node', nodes: ['API Gateway','Treinos','Cadastro','Notificacoes','Auth/RBAC'] },
      { name: 'SQLite Operacional', nodes: ['DER operacional','Feature Store','Auditoria','LGPD'] },
      { name: 'IA/Analytics', nodes: ['Recomendador Hibrido','Guardrails','XAI','Fairness','MLOps'] },
      { name: 'Integracoes', nodes: ['100 APIs opcionais','Wearables','Mensageria','Mapas','Nutricao'] }
    ],
    principles: ['multiunidade', 'human-in-the-loop', 'fallback sem wearable', 'pseudonimizacao', 'kill-switch', 'auditoria imutavel']
  };
}

function createStudent(body) {
  const created = transaction((db) => {
    const alunoId = db.prepare('INSERT INTO aluno (unidade_id,nome,email,birth_date,sexo,cpf_hash,status,segmento,nivel,avatar) VALUES (?,?,?,?,?,?,?,?,?,?)').run(
      body.unidade_id || 1,
      body.nome || 'Novo Aluno BeastFit',
      body.email || `novo${Date.now()}@beastfit.local`,
      body.birth_date || '1995-01-01',
      body.sexo || 'N',
      hash(body.cpf || Date.now()).slice(0, 32),
      'ativo',
      body.segmento || 'standard',
      body.nivel || 'iniciante',
      body.avatar || ''
    ).lastInsertRowid;
    db.prepare('INSERT INTO consentimento_lgpd (aluno_id, finalidade, versao_termo, dt_aceite, status, preferencias_json) VALUES (?,?,?,?,?,?)').run(alunoId, 'operacional_analitica_wearables', '2026.1', nowIso(), body.consentimento === false ? 'pendente' : 'valido', json({ analytics: true, wearables: true, marketing: false }));
    db.prepare('INSERT INTO meta_aluno (aluno_id,objetivo,horizonte_semanas,disponibilidade_semana,prioridade,restricoes,preferencias) VALUES (?,?,?,?,?,?,?)').run(alunoId, body.objetivo || 'saude', 12, body.disponibilidade_semana || 3, 'consistencia', body.restricoes || 'nenhuma', body.preferencias || 'treino guiado');
    db.prepare('INSERT INTO auditoria_acesso (usuario_id, entidade, id_entidade, acao, dt_evento, ip_hash, detalhes) VALUES (?,?,?,?,?,?,?)').run(1, 'aluno', alunoId, 'cadastrou', nowIso(), hash('localhost').slice(0, 18), 'Cadastro pelo endpoint demo.');
    return alunoId;
  });
  return studentDetail(created);
}

async function testIntegration(id) {
  const item = integrationById(id) || get('SELECT * FROM api_integration WHERE id = ?', [id]);
  if (!item) throw Object.assign(new Error('Integracao nao encontrada'), { status: 404 });
  const fallback = parseJson(item.mock_response, item.mock_response || { ok: true });
  if (process.env.ENABLE_EXTERNAL_APIS !== 'true') {
    return { integration: item, externalAttempted: false, safeFallback: true, data: fallback };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1800);
  try {
    const response = await fetch(item.endpoint, { signal: controller.signal, headers: { 'user-agent': 'BeastFitAI/1.0 educational demo' } });
    clearTimeout(timer);
    const type = response.headers.get('content-type') || '';
    const data = type.includes('json') ? await response.json() : await response.text();
    return { integration: item, externalAttempted: true, status: response.status, safeFallback: false, data };
  } catch (error) {
    clearTimeout(timer);
    return { integration: item, externalAttempted: true, safeFallback: true, error: error.message, data: fallback };
  }
}

function mime(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  if (file.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

function serveStatic(req, res, url) {
  if (!fs.existsSync(distDir)) {
    send(res, 200, { message: 'Backend BeastFit AI online. Rode npm run dev para abrir o frontend Vite ou npm run build para servir client/dist.', api: '/api/health' });
    return;
  }
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  let filePath = path.join(distDir, requested);
  if (!filePath.startsWith(distDir)) return notFound(res);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) filePath = path.join(distDir, 'index.html');
  res.writeHead(200, { 'content-type': mime(filePath) });
  fs.createReadStream(filePath).pipe(res);
}

async function handleApi(req, res, url) {
  const method = req.method || 'GET';
  const pathName = url.pathname;
  const body = method === 'GET' ? {} : await readBody(req);

  if (pathName === '/api/health') return ok(res, { ok: true, name: 'BeastFit AI Revolution', node: process.version, sqlite: 'node:sqlite', time: nowIso() });
  if (pathName === '/api/summary') return ok(res, { kpis: kpis(), architecture: architecture(), pages: 61, useCases: get('SELECT COUNT(*) AS total FROM use_case').total, integrations: get('SELECT COUNT(*) AS total FROM api_integration').total });
  if (pathName === '/api/dashboard/kpis') return ok(res, kpis());
  if (pathName === '/api/dashboard/retention') return ok(res, retention());
  if (pathName === '/api/dashboard/fairness') return ok(res, fairness());
  if (pathName === '/api/fairness') return ok(res, fairness());
  if (pathName === '/api/data-dictionary') return ok(res, dataDictionary());
  if (pathName === '/api/architecture') return ok(res, architecture());
  if (pathName === '/api/use-cases') return ok(res, all('SELECT * FROM use_case ORDER BY codigo'));
  if (pathName === '/api/business-rules') return ok(res, all('SELECT * FROM business_rule ORDER BY codigo'));
  if (pathName === '/api/units') return ok(res, all('SELECT u.*, COUNT(a.id) AS alunos FROM unidade u LEFT JOIN aluno a ON a.unidade_id = u.id GROUP BY u.id ORDER BY u.id'));
  if (pathName === '/api/users') return ok(res, all('SELECT usuario.*, unidade.nome AS unidade_nome FROM usuario LEFT JOIN unidade ON unidade.id = usuario.unidade_id ORDER BY usuario.id LIMIT 200'));
  if (pathName === '/api/students' && method === 'GET') {
    const search = `%${(url.searchParams.get('search') || '').toLowerCase()}%`;
    const limit = Math.min(Number(url.searchParams.get('limit') || 80), 220);
    return ok(res, all(`SELECT a.*, u.nome AS unidade_nome, r.score_aderencia, r.score_risco, r.status AS recomendacao_status
      FROM aluno a LEFT JOIN unidade u ON u.id = a.unidade_id
      LEFT JOIN recomendacao_ia r ON r.id = (SELECT id FROM recomendacao_ia WHERE aluno_id = a.id ORDER BY id DESC LIMIT 1)
      WHERE LOWER(a.nome) LIKE ? OR LOWER(a.email) LIKE ? OR LOWER(a.segmento) LIKE ?
      ORDER BY a.id LIMIT ?`, [search, search, search, limit]));
  }
  if (pathName === '/api/students' && method === 'POST') return created(res, createStudent(body));
  if (pathName.startsWith('/api/students/')) {
    const id = Number(pathName.split('/')[3]);
    const detail = studentDetail(id);
    return detail ? ok(res, detail) : notFound(res);
  }
  if (pathName === '/api/exercises') {
    const group = url.searchParams.get('group');
    const rows = group ? all('SELECT e.*, eq.nome AS equipamento FROM exercicio e LEFT JOIN equipamento eq ON eq.id = e.equipamento_id WHERE e.grupo_muscular = ? ORDER BY e.id', [group]) : all('SELECT e.*, eq.nome AS equipamento FROM exercicio e LEFT JOIN equipamento eq ON eq.id = e.equipamento_id ORDER BY e.id');
    return ok(res, rows.map((r) => ({ ...r, musculos_alvo: parseJson(r.musculos_alvo, []) })));
  }
  if (pathName.startsWith('/api/exercises/')) {
    const id = Number(pathName.split('/')[3]);
    const row = get('SELECT e.*, eq.nome AS equipamento FROM exercicio e LEFT JOIN equipamento eq ON eq.id = e.equipamento_id WHERE e.id = ?', [id]);
    return row ? ok(res, { ...row, musculos_alvo: parseJson(row.musculos_alvo, []) }) : notFound(res);
  }
  if (pathName === '/api/equipment') return ok(res, all('SELECT eq.*, COUNT(e.id) AS exercicios FROM equipamento eq LEFT JOIN exercicio e ON e.equipamento_id = eq.id GROUP BY eq.id ORDER BY eq.id'));
  if (pathName === '/api/plans') return ok(res, all(`SELECT p.*, a.nome AS aluno_nome, u.nome AS instrutor_nome FROM plano_treino p LEFT JOIN aluno a ON a.id = p.aluno_id LEFT JOIN usuario u ON u.id = p.usuario_resp ORDER BY p.id DESC LIMIT 120`));
  if (pathName.startsWith('/api/plans/')) {
    const id = Number(pathName.split('/')[3]);
    const plan = get('SELECT p.*, a.nome AS aluno_nome FROM plano_treino p LEFT JOIN aluno a ON a.id = p.aluno_id WHERE p.id = ?', [id]);
    if (!plan) return notFound(res);
    return ok(res, { plan, items: all(`SELECT i.*, e.nome, e.grupo_muscular, e.musculos_alvo FROM item_plano_treino i JOIN exercicio e ON e.id = i.exercicio_id WHERE i.plano_id = ? ORDER BY i.ordem`, [id]).map((r) => ({ ...r, musculos_alvo: parseJson(r.musculos_alvo, []) })) });
  }
  if (pathName === '/api/recommendations') return ok(res, rowsWithJson(all(`SELECT r.*, a.nome AS aluno_nome FROM recomendacao_ia r JOIN aluno a ON a.id = r.aluno_id ORDER BY r.id DESC LIMIT 100`), ['guardrails_json']));
  if (pathName === '/api/recommendations/generate' && method === 'POST') return created(res, generateRecommendation(Number(body.alunoId || body.aluno_id), Number(body.userId || 1)));
  if (pathName.match(/^\/api\/recommendations\/\d+$/)) {
    const rec = recommendationDetail(Number(pathName.split('/')[3]));
    return rec ? ok(res, rec) : notFound(res);
  }
  if (pathName.match(/^\/api\/recommendations\/\d+\/review$/) && method === 'POST') return ok(res, approveRecommendation(Number(pathName.split('/')[3]), Number(body.userId || 1), body.decision || 'aprovada', body.notes || 'Revisao humana registrada.'));
  if (pathName === '/api/sessions/start' && method === 'POST') return created(res, startSession(Number(body.alunoId), Number(body.planId), body.origin || 'app'));
  if (pathName.match(/^\/api\/sessions\/\d+\/finish$/) && method === 'POST') return ok(res, finishSession(Number(pathName.split('/')[3]), body));
  if (pathName === '/api/sessions') return ok(res, all(`SELECT s.*, a.nome AS aluno_nome, p.nome AS plano_nome FROM sessao_treino s JOIN aluno a ON a.id = s.aluno_id LEFT JOIN plano_treino p ON p.id = s.plano_id ORDER BY s.id DESC LIMIT 120`));
  if (pathName === '/api/kill-switch' && method === 'POST') return created(res, triggerKillSwitch({ alunoId: Number(body.alunoId || body.aluno_id), sessionId: body.sessionId ? Number(body.sessionId) : null, reason: body.reason || 'Acionamento manual do kill-switch', userId: Number(body.userId || 1) }));
  if (pathName === '/api/alerts') return ok(res, all(`SELECT al.*, a.nome AS aluno_nome FROM alerta al LEFT JOIN aluno a ON a.id = al.aluno_id ORDER BY al.dt_geracao DESC LIMIT 120`));
  if (pathName === '/api/incidents' && method === 'GET') return ok(res, all('SELECT * FROM incidente_gov ORDER BY dt_abertura DESC LIMIT 120'));
  if (pathName === '/api/incidents' && method === 'POST') {
    const id = run('INSERT INTO incidente_gov (categoria,criticidade,status,dt_abertura,responsavel,descricao) VALUES (?,?,?,?,?,?)', [body.categoria || 'operacao', body.criticidade || 'media', 'aberto', nowIso(), body.responsavel || 'Gestor', body.descricao || 'Incidente criado pelo portal.']).lastInsertRowid;
    return created(res, get('SELECT * FROM incidente_gov WHERE id = ?', [id]));
  }
  if (pathName === '/api/audit') return ok(res, all('SELECT * FROM auditoria_acesso ORDER BY dt_evento DESC LIMIT 160'));
  if (pathName === '/api/model-versions') return ok(res, rowsWithJson(all(`SELECT vm.*, m.nome_modelo, m.tipo FROM versao_modelo vm JOIN modelo_ia m ON m.id = vm.modelo_id ORDER BY vm.id DESC`), ['metricas_json']));
  if (pathName === '/api/models/train' && method === 'POST') {
    const id = transaction((db) => {
      const model = db.prepare('SELECT * FROM modelo_ia ORDER BY id DESC LIMIT 1').get();
      const version = `v${Date.now().toString().slice(-6)}`;
      return db.prepare('INSERT INTO versao_modelo (modelo_id, versao, dt_publicacao, ambiente, hash_artefato, metricas_json, status) VALUES (?,?,?,?,?,?,?)').run(model.id, version, nowIso(), body.ambiente || 'sandbox', hash(version), json({ precisionAt10: 0.79, auc: 0.86, fairness: 0.91, stressTest: 'ok' }), 'sandbox').lastInsertRowid;
    });
    return created(res, get('SELECT * FROM versao_modelo WHERE id = ?', [id]));
  }
  if (pathName === '/api/feature-store') return ok(res, all('SELECT * FROM feature_store ORDER BY id DESC LIMIT 200'));
  if (pathName === '/api/etl/run' && method === 'POST') return ok(res, { ok: true, job: `etl_${Date.now()}`, mode: body.mode || 'normalizacao', processed: 1000 + Math.floor(Math.random() * 3000), hash: hash(JSON.stringify(body)).slice(0, 16), finishedAt: nowIso() });
  if (pathName === '/api/workout-pages') return ok(res, rowsWithJson(all('SELECT * FROM workout_page ORDER BY id LIMIT 80'), ['blocks_json']));
  if (pathName.match(/^\/api\/workout-pages\/[^/]+$/)) {
    const slug = pathName.split('/')[3];
    const page = get('SELECT * FROM workout_page WHERE slug = ?', [slug]);
    return page ? ok(res, { ...page, blocks: parseJson(page.blocks_json, []) }) : notFound(res);
  }
  if (pathName === '/api/campaigns') return ok(res, all('SELECT * FROM campaign ORDER BY id DESC'));
  if (pathName === '/api/notifications') return ok(res, all(`SELECT n.*, a.nome AS aluno_nome FROM notification n LEFT JOIN aluno a ON a.id = n.aluno_id ORDER BY scheduled_at DESC LIMIT 120`));
  if (pathName === '/api/payments') return ok(res, all(`SELECT p.*, a.nome AS aluno_nome FROM payment_plan p JOIN aluno a ON a.id = p.aluno_id ORDER BY due_date ASC LIMIT 120`));
  if (pathName === '/api/classes') return ok(res, all(`SELECT c.*, u.nome AS unidade_nome, us.nome AS coach_nome FROM class_schedule c LEFT JOIN unidade u ON u.id = c.unidade_id LEFT JOIN usuario us ON us.id = c.coach_id ORDER BY starts_at LIMIT 80`));
  if (pathName === '/api/gamification') return ok(res, all(`SELECT g.*, a.nome AS aluno_nome FROM game_badge g JOIN aluno a ON a.id = g.aluno_id ORDER BY earned_at DESC LIMIT 120`));
  if (pathName === '/api/checkins') return ok(res, all(`SELECT ch.*, a.nome AS aluno_nome, u.nome AS unidade_nome FROM checkin ch JOIN aluno a ON a.id = ch.aluno_id JOIN unidade u ON u.id = ch.unidade_id ORDER BY ch.created_at DESC LIMIT 120`));
  if (pathName === '/api/integrations') return ok(res, rowsWithJson(all('SELECT * FROM api_integration ORDER BY id'), ['mock_response']));
  if (pathName.match(/^\/api\/integrations\/\d+\/test$/)) return ok(res, await testIntegration(Number(pathName.split('/')[3])));
  if (pathName === '/api/reports/executive') return ok(res, { title: 'Relatorio Executivo BeastFit', kpis: kpis(), retention: retention().byUnit, fairness: fairness().summary, generatedAt: nowIso() });
  if (pathName === '/api/search') {
    const q = `%${(url.searchParams.get('q') || '').toLowerCase()}%`;
    return ok(res, {
      alunos: all('SELECT id, nome, email, nivel, segmento FROM aluno WHERE LOWER(nome) LIKE ? OR LOWER(email) LIKE ? LIMIT 12', [q, q]),
      exercicios: all('SELECT id, nome, grupo_muscular, nivel FROM exercicio WHERE LOWER(nome) LIKE ? OR LOWER(grupo_muscular) LIKE ? LIMIT 12', [q, q]),
      casos: all('SELECT codigo, titulo, bloco FROM use_case WHERE LOWER(titulo) LIKE ? OR LOWER(codigo) LIKE ? LIMIT 12', [q, q])
    });
  }
  return notFound(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'OPTIONS') return send(res, 204, '');
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return serveStatic(req, res, url);
  } catch (error) {
    const status = error.status || 500;
    send(res, status, { error: error.message || 'Erro interno', status });
  }
});

server.listen(port, () => {
  getDb();
  console.log(`BeastFit AI API em http://localhost:${port}`);
});
