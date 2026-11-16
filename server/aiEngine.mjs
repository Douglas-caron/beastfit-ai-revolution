import { all, get, run, transaction } from './db.mjs';
import { ageFromBirthDate, clamp, daysAgo, hash, json, nowIso, parseJson, pick } from './utils.mjs';

export function getStudentContext(alunoId) {
  const aluno = get('SELECT * FROM aluno WHERE id = ?', [alunoId]);
  if (!aluno) return null;
  const consent = get('SELECT * FROM consentimento_lgpd WHERE aluno_id = ? ORDER BY dt_aceite DESC LIMIT 1', [alunoId]);
  const triagem = get('SELECT * FROM triagem_saude WHERE aluno_id = ? ORDER BY dt_triagem DESC LIMIT 1', [alunoId]);
  const avaliacao = get('SELECT * FROM avaliacao_fisica WHERE aluno_id = ? ORDER BY dt_avaliacao DESC LIMIT 1', [alunoId]);
  const meta = get('SELECT * FROM meta_aluno WHERE aluno_id = ? ORDER BY id DESC LIMIT 1', [alunoId]);
  const wearable = all('SELECT * FROM wearable_resumo WHERE aluno_id = ? ORDER BY data_ref DESC LIMIT 14', [alunoId]);
  const sessions = all('SELECT * FROM sessao_treino WHERE aluno_id = ? ORDER BY dt_inicio DESC LIMIT 10', [alunoId]);
  const feedback = all(`SELECT f.* FROM feedback_aluno f JOIN sessao_treino s ON s.id = f.sessao_id WHERE s.aluno_id = ? ORDER BY f.created_at DESC LIMIT 10`, [alunoId]);
  return { aluno, consent, triagem, avaliacao, meta, wearable, sessions, feedback };
}

function daysSince(dateString) {
  if (!dateString) return 999;
  const diff = Date.now() - new Date(dateString).getTime();
  return Math.floor(diff / 86400000);
}

function readinessAverage(wearable) {
  if (!wearable?.length) return null;
  return wearable.reduce((sum, row) => sum + Number(row.readiness || 0), 0) / wearable.length;
}

function latestFeedbackAverage(feedback, key) {
  if (!feedback?.length) return null;
  return feedback.reduce((sum, row) => sum + Number(row[key] || 0), 0) / feedback.length;
}

function scoreStudent(ctx) {
  const age = ageFromBirthDate(ctx.aluno.birth_date);
  const triageAge = daysSince(ctx.triagem?.dt_triagem);
  const evalAge = daysSince(ctx.avaliacao?.dt_avaliacao);
  const wearableReady = readinessAverage(ctx.wearable);
  const avgPain = latestFeedbackAverage(ctx.feedback, 'dor') ?? 1.5;
  const avgFatigue = latestFeedbackAverage(ctx.feedback, 'fadiga') ?? 3;
  const consentValid = ctx.consent?.status === 'valido';
  const prefs = parseJson(ctx.consent?.preferencias_json, {});
  const triageValid = ctx.triagem?.parq_apto === 1 && triageAge <= 90;
  const evalValid = evalAge <= 90;
  const degraded = wearableReady === null || prefs.wearables === false;
  let risk = 0.08;
  if (!consentValid) risk += 0.65;
  if (!triageValid) risk += 0.42;
  if (!evalValid) risk += 0.28;
  if (ctx.triagem?.risco_clinico === 'alto') risk += 0.35;
  if (ctx.triagem?.risco_clinico === 'moderado') risk += 0.12;
  if (age > 55) risk += 0.08;
  if (wearableReady !== null && wearableReady < 55) risk += 0.16;
  if (avgPain > 5) risk += 0.24;
  if (avgFatigue > 7) risk += 0.12;
  risk = clamp(risk, 0, 0.99);
  const adherence = clamp(0.55 + (wearableReady ?? 70) / 300 - avgFatigue / 40 + (ctx.sessions.length / 30), 0.08, 0.98);
  const response = clamp(0.45 + Number(ctx.avaliacao?.vo2_estimado ?? 35) / 120 + Number(ctx.avaliacao?.mobilidade_score ?? 60) / 300 - risk / 3, 0.12, 0.98);
  return { age, triageAge, evalAge, wearableReady, avgPain, avgFatigue, consentValid, triageValid, evalValid, degraded, risk, adherence, response };
}

function targetExercises(meta, risk) {
  const goal = meta?.objetivo || 'saude';
  let groups;
  if (goal === 'hipertrofia') groups = ['peitoral','costas','quadriceps','gluteos','ombros','biceps','triceps'];
  else if (goal === 'emagrecimento') groups = ['fullbody','cardio','quadriceps','core','gluteos'];
  else if (goal === 'forca') groups = ['peitoral','costas','quadriceps','posterior'];
  else if (goal === 'mobilidade') groups = ['mobilidade','core','gluteos'];
  else if (goal === 'retorno_pos_lesao') groups = ['mobilidade','core','cardio','gluteos'];
  else groups = ['fullbody','core','cardio','costas','quadriceps'];
  const clauses = groups.map(() => 'grupo_muscular = ?').join(' OR ');
  const list = all(`SELECT * FROM exercicio WHERE ${clauses} ORDER BY id LIMIT 24`, groups);
  return list.filter((exercise) => risk < 0.68 || exercise.nivel !== 'avancado').slice(0, 8);
}

function buildXai(score) {
  return [
    { fator: 'Consentimento e validade dos dados', importancia: score.consentValid ? 0.12 : 0.38, sinal: score.consentValid ? 'positivo' : 'negativo', descricao: score.consentValid ? 'Consentimento permite analise personalizada.' : 'Sem consentimento valido, recomendacao fica restrita.' },
    { fator: 'Triagem PAR-Q e avaliacao', importancia: score.triageValid && score.evalValid ? 0.18 : 0.42, sinal: score.triageValid && score.evalValid ? 'positivo' : 'negativo', descricao: `Triagem com ${score.triageAge} dias e avaliacao com ${score.evalAge} dias.` },
    { fator: 'Readiness por wearable', importancia: score.wearableReady ? 0.22 : 0.10, sinal: score.wearableReady && score.wearableReady > 65 ? 'positivo' : 'neutro', descricao: score.wearableReady ? `Readiness medio ${score.wearableReady.toFixed(1)}.` : 'Sem wearable; modo degradado com dados internos.' },
    { fator: 'Dor e fadiga subjetiva', importancia: clamp((score.avgPain + score.avgFatigue) / 30, 0.08, 0.34), sinal: score.avgPain > 5 || score.avgFatigue > 7 ? 'negativo' : 'positivo', descricao: `Dor media ${score.avgPain.toFixed(1)} e fadiga ${score.avgFatigue.toFixed(1)}.` },
    { fator: 'Historico de sessoes', importancia: 0.16, sinal: 'positivo', descricao: 'Sessoes recentes aumentam confianca da recomendacao.' }
  ];
}

export function generateRecommendation(alunoId, userId = 1) {
  const ctx = getStudentContext(alunoId);
  if (!ctx) throw Object.assign(new Error('Aluno nao encontrado'), { status: 404 });
  const score = scoreStudent(ctx);
  const model = get('SELECT * FROM versao_modelo WHERE status = ? ORDER BY id DESC LIMIT 1', ['aprovado']) || get('SELECT * FROM versao_modelo ORDER BY id DESC LIMIT 1');
  const snapshot = get('SELECT * FROM dataset_snapshot ORDER BY id DESC LIMIT 1');
  const status = score.risk >= 0.78 ? 'bloqueada_guardrail' : 'em_revisao';
  const guardrails = {
    humanReview: true,
    maxWeeklyProgressionPct: score.risk > 0.45 ? 5 : 10,
    blockAdvanced: score.risk > 0.68,
    parqValid: score.triageValid,
    physicalEvaluationValid: score.evalValid,
    consentValid: score.consentValid,
    mode: score.degraded ? 'degradado' : 'completo'
  };
  return transaction((db) => {
    const recId = db.prepare(`INSERT INTO recomendacao_ia (aluno_id, versao_modelo_id, snapshot_id, dt_geracao, score_aderencia, score_risco, score_resposta, status, modo_degradado, summary, guardrails_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      alunoId,
      model?.id || 1,
      snapshot?.id || 1,
      nowIso(),
      Number(score.adherence.toFixed(3)),
      Number(score.risk.toFixed(3)),
      Number(score.response.toFixed(3)),
      status,
      score.degraded ? 1 : 0,
      `IA gerou plano ${status} para ${ctx.aluno.nome}. Risco ${score.risk.toFixed(2)}, aderencia ${score.adherence.toFixed(2)}, resposta ${score.response.toFixed(2)}.`,
      json(guardrails)
    ).lastInsertRowid;
    for (const item of buildXai(score)) {
      db.prepare('INSERT INTO explicacao_ia (recomendacao_id, fator, importancia, sinal, descricao) VALUES (?,?,?,?,?)').run(recId, item.fator, item.importancia, item.sinal, item.descricao);
    }
    if (score.risk >= 0.78) {
      db.prepare('INSERT INTO alerta (aluno_id, recomendacao_id, tipo, severidade, origem, status, dt_geracao, mensagem) VALUES (?,?,?,?,?,?,?,?)').run(alunoId, recId, 'guardrail_critico', 'critica', 'motor_guardrails', 'aberto', nowIso(), 'Recomendacao bloqueada por risco alto. Revisao humana obrigatoria.');
    }
    db.prepare('INSERT INTO auditoria_acesso (usuario_id, entidade, id_entidade, acao, dt_evento, ip_hash, detalhes) VALUES (?,?,?,?,?,?,?)').run(userId, 'recomendacao_ia', recId, 'gerou', nowIso(), hash('localhost').slice(0, 18), 'Geracao por motor hibrido XAI.');
    return recommendationDetail(recId);
  });
}

export function recommendationDetail(recId) {
  const rec = get(`SELECT r.*, a.nome AS aluno_nome, a.nivel, a.segmento FROM recomendacao_ia r JOIN aluno a ON a.id = r.aluno_id WHERE r.id = ?`, [recId]);
  if (!rec) return null;
  rec.guardrails = parseJson(rec.guardrails_json, {});
  rec.explanations = all('SELECT * FROM explicacao_ia WHERE recomendacao_id = ? ORDER BY importancia DESC', [recId]);
  rec.suggestedExercises = targetExercises(get('SELECT * FROM meta_aluno WHERE aluno_id = ? ORDER BY id DESC LIMIT 1', [rec.aluno_id]), rec.score_risco);
  return rec;
}

export function approveRecommendation(recId, userId = 1, decision = 'aprovada', notes = 'Aprovada por instrutor com apoio XAI.') {
  const rec = recommendationDetail(recId);
  if (!rec) throw Object.assign(new Error('Recomendacao nao encontrada'), { status: 404 });
  if (rec.status === 'bloqueada_guardrail' && decision === 'aprovada') {
    throw Object.assign(new Error('Guardrail bloqueou publicacao. Use replanejamento conservador ou registre justificativa de reversao.'), { status: 422 });
  }
  return transaction((db) => {
    db.prepare('UPDATE recomendacao_ia SET status = ? WHERE id = ?').run(decision, recId);
    db.prepare('INSERT INTO auditoria_acesso (usuario_id, entidade, id_entidade, acao, dt_evento, ip_hash, detalhes) VALUES (?,?,?,?,?,?,?)').run(userId, 'recomendacao_ia', recId, decision, nowIso(), hash('localhost').slice(0, 18), notes);
    if (decision !== 'aprovada') return recommendationDetail(recId);
    const meta = get('SELECT * FROM meta_aluno WHERE aluno_id = ? ORDER BY id DESC LIMIT 1', [rec.aluno_id]);
    const planId = db.prepare('INSERT INTO plano_treino (aluno_id, usuario_resp, recomendacao_id, dt_inicio, dt_fim, status, versao, nome, objetivo, score_risco) VALUES (?,?,?,?,?,?,?,?,?,?)').run(rec.aluno_id, userId, recId, nowIso(), daysAgo(-45), 'aprovado', 1, `Plano XAI ${recId}`, meta?.objetivo || 'saude', rec.score_risco).lastInsertRowid;
    const exercises = rec.suggestedExercises.length ? rec.suggestedExercises : all('SELECT * FROM exercicio LIMIT 6');
    exercises.slice(0, 7).forEach((ex, index) => {
      const conservative = rec.score_risco > 0.45;
      db.prepare('INSERT INTO item_plano_treino (plano_id, exercicio_id, ordem, series, reps, carga_alvo, descanso_seg, tecnica, observacao) VALUES (?,?,?,?,?,?,?,?,?)').run(planId, ex.id, index + 1, conservative ? 2 : 4, conservative ? '12-15' : '8-12', conservative ? 20 + index * 3 : 35 + index * 6, conservative ? 75 : 60, conservative ? 'RPE 5-6' : 'RPE 7-8', 'Item aprovado por instrutor e guardrails.');
    });
    return { ...recommendationDetail(recId), plan: get('SELECT * FROM plano_treino WHERE id = ?', [planId]), items: all(`SELECT i.*, e.nome, e.grupo_muscular, e.musculos_alvo FROM item_plano_treino i JOIN exercicio e ON e.id = i.exercicio_id WHERE i.plano_id = ?`, [planId]) };
  });
}

export function startSession(alunoId, planId, origin = 'app') {
  const plan = get('SELECT * FROM plano_treino WHERE id = ? AND aluno_id = ?', [planId, alunoId]);
  if (!plan) throw Object.assign(new Error('Plano nao encontrado para o aluno'), { status: 404 });
  if (!['publicado', 'aprovado'].includes(plan.status)) throw Object.assign(new Error('Plano nao esta publicado/aprovado'), { status: 422 });
  const result = run('INSERT INTO sessao_treino (aluno_id, plano_id, dt_inicio, status, origem, aderencia_score) VALUES (?,?,?,?,?,?)', [alunoId, planId, nowIso(), 'em_execucao', origin, 0.5]);
  return get('SELECT * FROM sessao_treino WHERE id = ?', [result.lastInsertRowid]);
}

export function finishSession(sessionId, feedback = {}) {
  const session = get('SELECT * FROM sessao_treino WHERE id = ?', [sessionId]);
  if (!session) throw Object.assign(new Error('Sessao nao encontrada'), { status: 404 });
  const dor = Number(feedback.dor ?? 0);
  const fadiga = Number(feedback.fadiga ?? 4);
  const rpe = Number(feedback.rpe ?? 7);
  return transaction((db) => {
    db.prepare('UPDATE sessao_treino SET status = ?, dt_fim = ?, aderencia_score = ? WHERE id = ?').run('concluida', nowIso(), clamp(1 - (dor + fadiga) / 25, 0.1, 1), sessionId);
    db.prepare('INSERT INTO feedback_aluno (sessao_id, nps, fadiga, satisfacao, dor, comentario, rpe) VALUES (?,?,?,?,?,?,?)').run(sessionId, Number(feedback.nps ?? 9), fadiga, Number(feedback.satisfacao ?? 8), dor, feedback.comentario ?? 'Feedback enviado pelo app.', rpe);
    if (dor >= 7 || rpe >= 10) {
      db.prepare('INSERT INTO alerta (aluno_id, recomendacao_id, tipo, severidade, origem, status, dt_geracao, mensagem) VALUES (?,?,?,?,?,?,?,?)').run(session.aluno_id, null, 'dor_intensa', 'critica', 'feedback', 'aberto', nowIso(), 'Dor intensa ou RPE extremo registrado; acionar instrutor.');
    }
    return get('SELECT * FROM sessao_treino WHERE id = ?', [sessionId]);
  });
}

export function triggerKillSwitch({ alunoId, sessionId = null, reason = 'risco critico detectado', userId = 1 }) {
  return transaction((db) => {
    if (sessionId) db.prepare('UPDATE sessao_treino SET status = ?, dt_fim = ? WHERE id = ?').run('interrompida_kill_switch', nowIso(), sessionId);
    db.prepare('UPDATE plano_treino SET status = ? WHERE aluno_id = ? AND status IN (?,?,?)').run('suspenso_kill_switch', alunoId, 'publicado', 'aprovado', 'em_execucao');
    const alertId = db.prepare('INSERT INTO alerta (aluno_id, recomendacao_id, tipo, severidade, origem, status, dt_geracao, mensagem) VALUES (?,?,?,?,?,?,?,?)').run(alunoId, null, 'kill_switch', 'critica', 'motor_segurança', 'aberto', nowIso(), reason).lastInsertRowid;
    const incId = db.prepare('INSERT INTO incidente_gov (categoria, criticidade, status, dt_abertura, responsavel, descricao) VALUES (?,?,?,?,?,?)').run('seguranca_exercicio', 'critica', 'aberto', nowIso(), 'Instrutor lider', reason).lastInsertRowid;
    db.prepare('INSERT INTO auditoria_acesso (usuario_id, entidade, id_entidade, acao, dt_evento, ip_hash, detalhes) VALUES (?,?,?,?,?,?,?)').run(userId, 'kill_switch', alertId, 'acionou', nowIso(), hash('localhost').slice(0, 18), reason);
    return { alert: get('SELECT * FROM alerta WHERE id = ?', [alertId]), incident: get('SELECT * FROM incidente_gov WHERE id = ?', [incId]) };
  });
}
