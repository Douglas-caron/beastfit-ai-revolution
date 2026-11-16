import React, { useEffect, useMemo, useState } from 'react';
import { api, formatPct } from './api.js';
import { AnimatedExercise } from './components/AnimatedExercise.jsx';
import { ActionButton, DataTable, Gauge, Panel, Pill, Sparkline, StatCard } from './components/widgets.jsx';

export function StudentProfile({ id, navigate }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try { setData(await api(`/api/students/${id}`)); }
    catch (err) { setError(err.message); }
  }

  useEffect(() => { load(); }, [id]);

  const latestRec = data?.recomendacoes?.[0];
  const hrv = useMemo(() => (data?.wearables || []).slice().reverse().map((w) => w.hrv), [data]);
  const sleep = useMemo(() => (data?.wearables || []).slice().reverse().map((w) => w.sono_horas), [data]);

  async function gerar() {
    setBusy(true);
    setError('');
    try {
      const rec = await api('/api/recommendations/generate', { method: 'POST', body: { alunoId: Number(id), userId: 2 } });
      navigate(`/recomendacoes/${rec.recomendacao.id}`);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function kill() {
    setBusy(true);
    try {
      await api('/api/kill-switch', { method: 'POST', body: { alunoId: Number(id), reason: 'Acionamento preventivo pelo perfil do aluno', userId: 2 } });
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  if (error) return <div className="empty error">{error}</div>;
  if (!data) return <div className="loader">Carregando perfil completo...</div>;

  const aluno = data.aluno;
  const consentOk = data.consentimento?.status === 'valido';
  const triagemOk = data.triagem?.parq_apto === 1 || data.triagem?.parq_apto === true;

  return (
    <section className="content-stack">
      <div className="profile-hero">
        <div className="avatar-ring"><span>{aluno.nome.split(' ').map((p) => p[0]).slice(0, 2).join('')}</span></div>
        <div>
          <p className="eyebrow">Aluno #{aluno.id} - {aluno.unidade_nome}</p>
          <h2>{aluno.nome}</h2>
          <p>{aluno.email} - {aluno.segmento} - {aluno.nivel}</p>
          <div className="pill-row">
            <Pill tone={consentOk ? 'good' : 'warn'}>LGPD {consentOk ? 'valida' : 'pendente'}</Pill>
            <Pill tone={triagemOk ? 'good' : 'danger'}>PAR-Q {triagemOk ? 'apto' : 'revisar'}</Pill>
            <Pill>status {aluno.status}</Pill>
          </div>
        </div>
        <div className="profile-actions">
          <ActionButton onClick={gerar} disabled={busy}>gerar IA</ActionButton>
          <ActionButton danger onClick={kill} disabled={busy}>kill-switch</ActionButton>
        </div>
      </div>

      <div className="grid four">
        <StatCard label="aderencia prevista" value={formatPct(latestRec?.score_aderencia)} hint="modelo de churn" hot />
        <StatCard label="risco atual" value={formatPct(latestRec?.score_risco)} hint="guardrails ativos" />
        <StatCard label="resposta esperada" value={formatPct(latestRec?.score_resposta)} hint="forca/VO2" />
        <StatCard label="sessoes" value={data.sessoes.length} hint="historico recente" />
      </div>

      <div className="grid two">
        <Panel title="Sinais de wearables" eyebrow="series temporais">
          <div className="spark-grid">
            <div><span>HRV</span><Sparkline values={hrv} /></div>
            <div><span>Sono</span><Sparkline values={sleep} /></div>
          </div>
          <DataTable rows={data.wearables} max={6} />
        </Panel>
        <Panel title="Estado fisiologico" eyebrow="body twin">
          <div className="twin-row">
            <AnimatedExercise exercise={{ nome: data.meta?.objetivo || 'Treino atual', grupo_muscular: latestRec?.score_risco > 0.6 ? 'mobilidade' : 'fullbody', musculos_alvo: [] }} />
            <Gauge value={latestRec?.score_risco || 0.2} label="risco" />
          </div>
        </Panel>
      </div>

      <div className="grid two">
        <Panel title="Planos publicados" eyebrow="human-in-the-loop"><DataTable rows={data.planos} max={8} /></Panel>
        <Panel title="Alertas e badges" eyebrow="retencao">
          <DataTable rows={[...(data.alertas || []), ...(data.badges || [])]} max={10} />
        </Panel>
      </div>
    </section>
  );
}
