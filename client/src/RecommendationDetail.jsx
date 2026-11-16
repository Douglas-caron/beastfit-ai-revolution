import React, { useEffect, useState } from 'react';
import { api, formatPct } from './api.js';
import { AnimatedExercise } from './components/AnimatedExercise.jsx';
import { ActionButton, BarList, DataTable, Gauge, Panel, Pill, StatCard } from './components/widgets.jsx';

export function RecommendationDetail({ id, navigate }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try { setData(await api(`/api/recommendations/${id}`)); }
    catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, [id]);

  async function review(decision) {
    setBusy(true);
    try {
      await api(`/api/recommendations/${id}/review`, { method: 'POST', body: { decision, notes: `${decision} pela tela XAI` } });
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  if (error) return <div className="empty error">{error}</div>;
  if (!data) return <div className="loader">Abrindo pacote XAI...</div>;

  const rec = data.recomendacao;
  const factors = (data.explicacoes || []).map((x) => ({ grupo: x.fator, valor: Math.abs(Number(x.importancia || 0)) }));
  const firstItem = data.plano?.items?.[0] || {};

  return (
    <section className="content-stack">
      <div className="profile-hero rec-hero">
        <AnimatedExercise exercise={{ nome: rec.aluno_nome || 'Plano IA', grupo_muscular: firstItem.grupo_muscular || 'fullbody', musculos_alvo: firstItem.musculos_alvo || [] }} />
        <div>
          <p className="eyebrow">Recomendacao #{rec.id} - modelo {rec.versao_modelo_id}</p>
          <h2>{rec.aluno_nome}</h2>
          <p>Status: {rec.status}. Guardrails: {rec.guardrails?.fallback ? 'modo parcial' : 'completo'}.</p>
          <div className="pill-row"><Pill>{rec.status}</Pill><Pill tone={rec.score_risco > 0.65 ? 'danger' : 'good'}>risco {formatPct(rec.score_risco)}</Pill></div>
        </div>
        <div className="profile-actions">
          <ActionButton disabled={busy} onClick={() => review('aprovada')}>aprovar</ActionButton>
          <ActionButton danger disabled={busy} onClick={() => review('rejeitada')}>rejeitar</ActionButton>
        </div>
      </div>
      <div className="grid three">
        <StatCard hot label="aderencia" value={formatPct(rec.score_aderencia)} hint="probabilidade de continuar" />
        <StatCard label="risco" value={formatPct(rec.score_risco)} hint="seguranca e fadiga" />
        <StatCard label="resposta" value={formatPct(rec.score_resposta)} hint="forca/VO2 esperado" />
      </div>
      <div className="grid two">
        <Panel title="SHAP values" eyebrow="fatores explicativos"><BarList rows={factors} labelKey="grupo" valueKey="valor" max={8} /></Panel>
        <Panel title="Scores" eyebrow="decisao humana"><div className="triple-score"><Gauge value={rec.score_aderencia} label="aderencia" /><Gauge value={rec.score_risco} label="risco" /><Gauge value={rec.score_resposta} label="resposta" /></div></Panel>
      </div>
      <Panel title="Plano gerado" eyebrow="aguardando instrutor"><DataTable rows={data.plano?.items || []} max={12} /></Panel>
    </section>
  );
}
