import React, { useEffect, useMemo, useState } from 'react';
import { api, formatNumber, formatPct } from './api.js';
import { pageMeta } from './pages.js';
import { PageHeader } from './components/PageHeader.jsx';
import { AnimatedExercise, MuscleMap } from './components/AnimatedExercise.jsx';
import { ActionButton, BarList, DataTable, Gauge, Panel, Pill, Sparkline, StatCard } from './components/widgets.jsx';

const emptyList = [];

export function PageFactory({ page, navigate }) {
  const [data, setData] = useState(null);
  const [aux, setAux] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const endpoint = page?.endpoint;

  async function load() {
    if (!endpoint) return setData({});
    setError('');
    try { setData(await api(endpoint)); }
    catch (err) { setError(err.message); }
  }

  useEffect(() => { setData(null); setMessage(''); load(); }, [endpoint]);

  async function post(path, body, callback) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api(path, { method: 'POST', body });
      setMessage('Operacao concluida com sucesso.');
      callback?.(result);
      await load();
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally { setBusy(false); }
  }

  if (error) return <section className="content-stack"><PageHeader page={page} /><div className="empty error">{error}</div></section>;
  if (!data) return <section className="content-stack"><PageHeader page={page} /><div className="loader">Carregando modulo...</div></section>;

  const renderers = {
    dashboard: () => <Dashboard data={data} navigate={navigate} />,
    units: () => <Units rows={asArray(data)} />,
    students: () => <Students rows={asArray(data)} navigate={navigate} />,
    studentCreate: () => <StudentCreate post={post} busy={busy} navigate={navigate} />,
    consent: () => <ConsentPanel rows={asArray(data)} />,
    triage: () => <ClinicalPanel rows={asArray(data)} mode="triagem" />,
    assessments: () => <ClinicalPanel rows={asArray(data)} mode="avaliacao" />,
    goals: () => <GoalsPanel rows={asArray(data)} />,
    wearables: () => <WearablePanel />,
    featureStore: () => <FeatureStore rows={asArray(data)} />,
    etl: () => <ActionStudio page={page} post={post} busy={busy} message={message} path="/api/etl/run" body={{ mode: 'normalizacao_interoperavel' }} />,
    dictionary: () => <Dictionary rows={asArray(data)} />,
    atlas: () => <Atlas rows={asArray(data)} navigate={navigate} />,
    muscleMap: () => <MuscleMapPage />,
    equipment: () => <Equipment rows={asArray(data)} />,
    plans: () => <Plans rows={asArray(data)} />,
    workoutList: () => <WorkoutList rows={asArray(data)} navigate={navigate} />,
    printSheet: () => <PrintSheet rows={asArray(data)} />,
    aiGenerator: () => <AIGenerator post={post} busy={busy} navigate={navigate} />,
    review: () => <ReviewDesk rows={asArray(data)} post={post} busy={busy} navigate={navigate} />,
    xai: () => <XaiLab rows={asArray(data)} navigate={navigate} />,
    guardrails: () => <GuardrailLab rows={asArray(data)} />,
    killSwitch: () => <KillSwitch post={post} busy={busy} />,
    sessions: () => <Sessions rows={asArray(data)} />,
    execution: () => <ExecutionConsole post={post} busy={busy} />,
    feedback: () => <FeedbackPanel />,
    replanning: () => <Replanning rows={asArray(data)} post={post} busy={busy} />,
    schedule: () => <Schedule rows={asArray(data)} />,
    retention: () => <Retention data={data} />,
    reengagement: () => <Reengagement data={data} />,
    campaigns: () => <Campaigns rows={asArray(data)} />,
    notifications: () => <Notifications rows={asArray(data)} />,
    payments: () => <Payments rows={asArray(data)} />,
    checkins: () => <Checkins rows={asArray(data)} />,
    classes: () => <Classes rows={asArray(data)} />,
    users: () => <Users rows={asArray(data)} />,
    admin: () => <Admin rows={asArray(data)} />,
    reports: () => <Reports data={data} />,
    models: () => <Models rows={asArray(data)} post={post} busy={busy} />,
    mlops: () => <MLOps rows={asArray(data)} post={post} busy={busy} />,
    fairness: () => <Fairness data={data} />,
    audit: () => <Audit rows={asArray(data)} />,
    incidents: () => <Incidents rows={asArray(data)} post={post} busy={busy} />,
    compliance: () => <Compliance />,
    apiHub: () => <ApiHub rows={asArray(data)} setAux={setAux} aux={aux} post={post} busy={busy} />,
    abPilot: () => <ABPilot data={data} />,
    timeSeries: () => <TimeSeriesDemo />,
    uplift: () => <Uplift data={data} />,
    gamification: () => <Gamification rows={asArray(data)} />,
    instructorPortal: () => <InstructorPortal />,
    studentApp: () => <StudentApp />,
    reception: () => <Reception />,
    birthdays: () => <Birthdays />,
    playbooks: () => <Playbooks />,
    architecture: () => <Architecture data={data} />,
    useCases: () => <UseCases rows={asArray(data)} />,
    rules: () => <Rules rows={asArray(data)} />,
    settings: () => <Settings />,
    table: () => <GenericTable rows={asArray(data)} page={page} />
  };

  const renderer = renderers[page.type] || renderers.table;
  return <section className="content-stack"><PageHeader page={page} />{message && <div className="toast">{message}</div>}{renderer()}</section>;
}

function asArray(data) {
  if (Array.isArray(data)) return data;
  if (data?.rows && Array.isArray(data.rows)) return data.rows;
  return emptyList;
}

function Dashboard({ data, navigate }) {
  const k = data.kpis || {};
  return <>
    <div className="grid four">
      <StatCard hot label="alunos ativos" value={formatNumber(k.activeStudents)} hint={`${formatNumber(k.totalStudents)} cadastrados`} />
      <StatCard label="unidades" value={formatNumber(k.units)} hint="multiunidade" />
      <StatCard label="exercicios" value={formatNumber(k.exercises)} hint="atlas animado" />
      <StatCard label="recomendacoes" value={formatNumber(k.plans)} hint={`${formatNumber(k.published)} publicadas`} />
    </div>
    <div className="grid two hero-grid">
      <Panel title="Motor IA explicavel" eyebrow="XAI + guardrails" action={<ActionButton onClick={() => navigate('/gerador-ia')}>gerar plano</ActionButton>}>
        <div className="ai-orbit">
          <Gauge value={k.avgAdherence} label="aderencia" />
          <Gauge value={k.avgResponse} label="resposta" />
          <Gauge value={k.avgRisk} label="risco" />
        </div>
      </Panel>
      <Panel title="Body Twin animado" eyebrow="musculo vermelho em tempo real">
        <div className="twin-row"><AnimatedExercise exercise={{ nome: 'Treino IA Full Body', grupo_muscular: 'fullbody', musculos_alvo: [] }} /><p>As animacoes do projeto simulam GIFs de exercicio com zonas musculares pulsando em vermelho, usando SVG e CSS para manter tudo gratis, rapido e offline.</p></div>
      </Panel>
    </div>
    <div className="grid two">
      <Panel title="Arquitetura viva" eyebrow="camadas do sistema">
        <div className="layer-list">{(data.architecture?.layers || []).map((layer) => <div key={layer.name}><strong>{layer.name}</strong><span>{layer.nodes.join(' / ')}</span></div>)}</div>
      </Panel>
      <Panel title="Operacao critica" eyebrow="risco, compliance e MLOps">
        <div className="grid two compact-grid"><StatCard label="alertas" value={k.alerts} /><StatCard label="incidentes" value={k.incidents} /><StatCard label="casos de uso" value={data.useCases} /><StatCard label="conectores" value={data.integrations} /></div>
      </Panel>
    </div>
  </>;
}

function Units({ rows }) {
  return <><div className="unit-map">{rows.map((unit) => <article key={unit.id}><span>{unit.uf}</span><strong>{unit.nome}</strong><p>{unit.cidade}</p><b>{unit.alunos} alunos</b></article>)}</div><Panel title="Unidades cadastradas" eyebrow="rede"><DataTable rows={rows} max={20} /></Panel></>;
}

function Students({ rows, navigate }) {
  const [q, setQ] = useState('');
  const filtered = rows.filter((r) => `${r.nome} ${r.email} ${r.nivel} ${r.segmento}`.toLowerCase().includes(q.toLowerCase()));
  return <>
    <div className="filter-line"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar aluno..." /><Pill>{filtered.length} encontrados</Pill></div>
    <div className="student-grid">{filtered.slice(0, 48).map((student) => <button key={student.id} onClick={() => navigate(`/alunos/${student.id}`)}>
      <span>{student.nome.split(' ').map((p) => p[0]).slice(0, 2).join('')}</span><strong>{student.nome}</strong><small>{student.unidade_nome} - {student.nivel}</small><i>{formatPct(student.score_aderencia)} aderencia</i>
    </button>)}</div>
  </>;
}

function StudentCreate({ post, busy, navigate }) {
  const [form, setForm] = useState({ nome: '', email: '', sexo: 'F', nivel: 'iniciante', objetivo: 'hipertrofia', disponibilidade_semana: 4, segmento: 'standard' });
  function set(key, value) { setForm((old) => ({ ...old, [key]: value })); }
  async function submit(e) { e.preventDefault(); const result = await post('/api/students', form); if (result?.aluno?.id) navigate(`/alunos/${result.aluno.id}`); }
  return <Panel title="Cadastro relampago" eyebrow="UC01 + UC02"><form className="form-grid" onSubmit={submit}>
    <label>Nome<input value={form.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Nome do aluno" /></label>
    <label>Email<input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="email@exemplo.com" /></label>
    <label>Sexo<select value={form.sexo} onChange={(e) => set('sexo', e.target.value)}><option>F</option><option>M</option><option>N</option></select></label>
    <label>Nivel<select value={form.nivel} onChange={(e) => set('nivel', e.target.value)}><option>iniciante</option><option>intermediario</option><option>avancado</option></select></label>
    <label>Objetivo<input value={form.objetivo} onChange={(e) => set('objetivo', e.target.value)} /></label>
    <label>Dias por semana<input type="number" value={form.disponibilidade_semana} onChange={(e) => set('disponibilidade_semana', Number(e.target.value))} /></label>
    <ActionButton disabled={busy}>criar e abrir perfil</ActionButton>
  </form></Panel>;
}

function ConsentPanel({ rows }) { return <div className="grid two"><Panel title="LGPD operacional" eyebrow="consentimento"><p>Todo aluno novo nasce com finalidade registrada, preferencias auditaveis e trilha de acesso.</p><DataTable rows={rows.slice(0, 12)} /></Panel><Panel title="Politicas ativas" eyebrow="privacy by design"><ul className="check-list"><li>Consentimento para analytics antes de processar dados sensiveis.</li><li>Wearables entram como enriquecimento e nunca como obrigatoriedade.</li><li>Pseudonimizacao e logs para cada consulta sensivel.</li></ul></Panel></div>; }
function ClinicalPanel({ rows, mode }) { return <div className="grid two"><Panel title={mode === 'triagem' ? 'Triagem PAR-Q+' : 'Avaliacao fisica'} eyebrow="seguranca clinica"><DataTable rows={rows.slice(0, 18)} /></Panel><Panel title="Bloqueio preventivo" eyebrow="RN02"><AnimatedExercise exercise={{ nome: 'Avaliacao segura', grupo_muscular: mode === 'triagem' ? 'core' : 'fullbody', musculos_alvo: [] }} /><p>Planos vencidos ou triagem pendente bloqueiam publicacao ate revisao humana.</p></Panel></div>; }
function GoalsPanel({ rows }) { return <Panel title="Metas, restricoes e disponibilidade" eyebrow="personalizacao"><DataTable rows={rows.slice(0, 25)} /></Panel>; }
function WearablePanel() { return <DemoStudentBlock title="Wearables" subtitle="HRV, sono, FC, passos e fallback quando a API nao responde" />; }
function FeatureStore({ rows }) { return <Panel title="Feature Store versionado" eyebrow="machine learning"><DataTable rows={rows} max={25} /></Panel>; }

function Dictionary({ rows }) { return <div className="dictionary-grid">{rows.map((table) => <article key={table.table}><h3>{table.table}</h3><ul>{table.columns.slice(0, 12).map((c) => <li key={c.name}><b>{c.name}</b><span>{c.type}</span>{c.pk && <Pill>PK</Pill>}</li>)}</ul></article>)}</div>; }

function Atlas({ rows, navigate }) {
  const groups = [...new Set(rows.map((r) => r.grupo_muscular))];
  const [group, setGroup] = useState(groups[0] || 'peitoral');
  const filtered = rows.filter((r) => r.grupo_muscular === group);
  return <><div className="filter-line">{groups.map((g) => <button key={g} className={g === group ? 'chip active' : 'chip'} onClick={() => setGroup(g)}>{g}</button>)}</div><div className="exercise-grid">{filtered.map((exercise) => <button key={exercise.id} onClick={() => navigate(`/exercicios/${exercise.id}`)}><AnimatedExercise exercise={exercise} compact /><strong>{exercise.nome}</strong><small>{exercise.equipamento} - {exercise.nivel}</small></button>)}</div></>;
}

function MuscleMapPage() { const groups = ['peitoral','costas','quadriceps','posterior','gluteos','ombros','biceps','triceps','core','cardio','mobilidade','fullbody']; const [group, setGroup] = useState('peitoral'); return <div className="grid two"><Panel title="Mapa muscular interativo" eyebrow="SVG animado"><div className="filter-line wrap">{groups.map((g) => <button className={g === group ? 'chip active' : 'chip'} onClick={() => setGroup(g)} key={g}>{g}</button>)}</div><MuscleMap group={group} /></Panel><Panel title="Como usar no treino" eyebrow="UX didatica"><p>A pagina foi criada para substituir imagens pagas por uma experiencia propria: o aluno escolhe o musculo e o sistema destaca a area em vermelho pulsante.</p><ul className="check-list"><li>Foco visual instantaneo.</li><li>Funciona offline.</li><li>Facil de conectar ao catalogo de exercicios.</li></ul></Panel></div>; }
function Equipment({ rows }) { return <Panel title="Equipamentos e capacidade operacional" eyebrow="catalogo"><DataTable rows={rows} max={30} /></Panel>; }
function Plans({ rows }) { return <Panel title="Planos de treino" eyebrow="publicados, revisao e execucao"><DataTable rows={rows} max={24} /></Panel>; }
function WorkoutList({ rows, navigate }) { return <div className="workout-grid">{rows.map((p) => <button key={p.id} onClick={() => navigate(`/treinos/${p.slug}`)}><span>{p.category}</span><strong>{p.title}</strong><p>{p.description}</p><i>{p.duration_min} min - {p.difficulty}</i></button>)}</div>; }
function PrintSheet({ rows }) { return <Panel title="Ficha de treino imprimivel" eyebrow="aluno + instrutor"><div className="sheet-preview"><h3>{rows[0]?.nome || 'Plano BeastFit IA'}</h3><DataTable rows={rows.slice(0, 8)} max={8} /><p>Use o comando de impressao do navegador para gerar PDF da ficha aprovada.</p></div></Panel>; }

function AIGenerator({ post, busy, navigate }) {
  const [students, setStudents] = useState([]);
  const [alunoId, setAlunoId] = useState(1);
  useEffect(() => { api('/api/students?limit=50').then(setStudents); }, []);
  async function generate() { const result = await post('/api/recommendations/generate', { alunoId: Number(alunoId), userId: 2 }); if (result?.recomendacao?.id) navigate(`/recomendacoes/${result.recomendacao.id}`); }
  return <div className="grid two"><Panel title="Gerador de treino por IA" eyebrow="UC07"><label className="select-line">Aluno<select value={alunoId} onChange={(e) => setAlunoId(e.target.value)}>{students.map((s) => <option key={s.id} value={s.id}>{s.nome} - {s.nivel}</option>)}</select></label><ActionButton disabled={busy} onClick={generate}>gerar recomendacao segura</ActionButton></Panel><Panel title="Pipeline da decisao" eyebrow="hibrido + XAI"><ol className="timeline"><li>Consolida historico, metas e wearables.</li><li>Calcula aderencia, risco e resposta esperada.</li><li>Aplica guardrails e fallback se faltar API externa.</li><li>Entrega explicabilidade para revisao humana.</li></ol></Panel></div>;
}

function ReviewDesk({ rows, post, busy, navigate }) { return <div className="review-grid">{rows.slice(0, 30).map((rec) => <article key={rec.id}><p className="eyebrow">#{rec.id} - {rec.aluno_nome}</p><h3>{rec.status}</h3><div className="triple-score"><Gauge value={rec.score_aderencia} label="aderencia" /><Gauge value={rec.score_risco} label="risco" /><Gauge value={rec.score_resposta} label="resposta" /></div><div className="row-actions"><ActionButton onClick={() => navigate(`/recomendacoes/${rec.id}`)}>ver XAI</ActionButton><ActionButton disabled={busy} onClick={() => post(`/api/recommendations/${rec.id}/review`, { decision: 'aprovada', notes: 'Aprovado pelo desk' })}>aprovar</ActionButton><ActionButton danger disabled={busy} onClick={() => post(`/api/recommendations/${rec.id}/review`, { decision: 'rejeitada', notes: 'Rejeitado para recalculo' })}>rejeitar</ActionButton></div></article>)}</div>; }
function XaiLab({ rows, navigate }) { return <div className="grid two"><Panel title="Explicabilidade SHAP visual" eyebrow="XAI"><p>Cada recomendacao traz fatores de influencia para o instrutor decidir sem caixa-preta.</p><DataTable rows={rows.slice(0, 12)} onRow={(r) => navigate(`/recomendacoes/${r.id}`)} /></Panel><Panel title="Exemplo de fatores" eyebrow="por que a IA sugeriu"><BarList rows={[{ grupo: 'HRV baixo', valor: 0.32 },{ grupo: 'sono irregular', valor: 0.27 },{ grupo: 'aderencia alta', valor: 0.22 },{ grupo: 'historico de carga', valor: 0.19 }]} valueKey="valor" /></Panel></div>; }
function GuardrailLab({ rows }) { const danger = rows.filter((r) => Number(r.score_risco) > 0.65); return <div className="grid two"><Panel title="Guardrails prioritarios" eyebrow="RN04"><ul className="check-list"><li>Progressao semanal limitada.</li><li>Restricao clinica bloqueia publicacao.</li><li>Preferencia nunca supera seguranca.</li><li>Sem wearable entra em modo parcial.</li></ul></Panel><Panel title="Recomendacoes em atencao" eyebrow="risco elevado"><DataTable rows={danger} max={12} /></Panel></div>; }
function KillSwitch({ post, busy }) { const [alunoId, setAlunoId] = useState(1); const [reason, setReason] = useState('Fadiga extrema detectada no console'); return <Panel title="Kill-switch operacional" eyebrow="UC14 + RN05"><div className="form-grid"><label>Aluno ID<input type="number" value={alunoId} onChange={(e) => setAlunoId(e.target.value)} /></label><label>Motivo<input value={reason} onChange={(e) => setReason(e.target.value)} /></label><ActionButton danger disabled={busy} onClick={() => post('/api/kill-switch', { alunoId: Number(alunoId), reason })}>acionar parada segura</ActionButton></div></Panel>; }

function Sessions({ rows }) { return <Panel title="Sessoes de treino" eyebrow="execucao"><DataTable rows={rows} max={30} /></Panel>; }
function ExecutionConsole({ post, busy }) { const [form, setForm] = useState({ alunoId: 1, planId: 1, origin: 'terminal_instrutor' }); return <Panel title="Console de execucao" eyebrow="UC10 + UC11"><div className="form-grid"><label>Aluno ID<input type="number" value={form.alunoId} onChange={(e) => setForm({ ...form, alunoId: Number(e.target.value) })} /></label><label>Plano ID<input type="number" value={form.planId} onChange={(e) => setForm({ ...form, planId: Number(e.target.value) })} /></label><ActionButton disabled={busy} onClick={() => post('/api/sessions/start', form)}>abrir sessao</ActionButton></div></Panel>; }
function FeedbackPanel() { return <DemoStudentBlock title="Feedback pos-sessao" subtitle="RPE, dor, fadiga, satisfacao e comentario livre atualizam risco e aderencia" />; }
function Replanning({ rows, post, busy }) { const pending = rows.filter((r) => r.status !== 'aprovada').slice(0, 8); return <Panel title="Replanejamento inteligente" eyebrow="evento, estagnacao ou meta"><DataTable rows={pending} /><ActionButton disabled={busy} onClick={() => post('/api/recommendations/generate', { alunoId: pending[0]?.aluno_id || 1, userId: 2 })}>gerar nova versao</ActionButton></Panel>; }
function Schedule({ rows }) { return <Panel title="Agenda e reavaliacoes" eyebrow="checkpoints"><DataTable rows={rows} max={20} /></Panel>; }

function Retention({ data }) { return <div className="grid two"><Panel title="Aderencia por unidade" eyebrow="churn"><BarList rows={data.byUnit || []} labelKey="unidade" valueKey="aderencia_media" max={8} /></Panel><Panel title="Fila priorizada" eyebrow="intervencao"><DataTable rows={data.interventions || []} max={14} /></Panel></div>; }
function Reengagement({ data }) { return <div className="grid two"><Panel title="Acoes de reengajamento" eyebrow="UC18"><DataTable rows={data.interventions || []} max={12} /></Panel><Panel title="Playbook automatico" eyebrow="uplift"><ul className="check-list"><li>Aluno com risco alto recebe contato humano.</li><li>Aluno com dor recebe reducao de carga e revisao.</li><li>Aluno com baixa frequencia recebe desafio curto e meta visivel.</li></ul></Panel></div>; }
function Campaigns({ rows }) { return <Panel title="Campanhas" eyebrow="CRM fitness"><DataTable rows={rows} /></Panel>; }
function Notifications({ rows }) { return <Panel title="Notificacoes" eyebrow="mensageria"><DataTable rows={rows} max={30} /></Panel>; }
function Payments({ rows }) { return <Panel title="Planos e pagamentos" eyebrow="operacional"><DataTable rows={rows} max={30} /></Panel>; }
function Checkins({ rows }) { return <Panel title="Check-ins e presenca" eyebrow="catraca inteligente"><DataTable rows={rows} max={30} /></Panel>; }
function Classes({ rows }) { return <Panel title="Aulas coletivas" eyebrow="capacidade operacional"><DataTable rows={rows} max={20} /></Panel>; }
function Users({ rows }) { return <Panel title="Usuarios e perfis" eyebrow="RBAC"><DataTable rows={rows} max={35} /></Panel>; }
function Admin({ rows }) { return <div className="grid two"><Panel title="Administracao da rede" eyebrow="UC19"><DataTable rows={rows} /></Panel><Panel title="Permissoes" eyebrow="segregacao de acesso"><ul className="check-list"><li>Admin global parametriza a rede.</li><li>Gestor enxerga indicadores da unidade.</li><li>DPO acessa auditoria e consentimento.</li><li>Instrutor aprova planos e acompanha execucao.</li></ul></Panel></div>; }
function Reports({ data }) { return <div className="grid two"><Panel title="Relatorio executivo" eyebrow="KPIs"><pre className="json-box">{JSON.stringify(data.kpis, null, 2)}</pre></Panel><Panel title="Fairness" eyebrow="governanca"><pre className="json-box">{JSON.stringify(data.fairness, null, 2)}</pre></Panel></div>; }
function Models({ rows, post, busy }) { return <Panel title="Versoes de modelo" eyebrow="MLOps"><DataTable rows={rows} max={20} /><ActionButton disabled={busy} onClick={() => post('/api/models/train', { ambiente: 'sandbox' })}>treinar nova versao sandbox</ActionButton></Panel>; }
function MLOps({ rows, post, busy }) { return <div className="grid two"><Panel title="Ciclo de vida do modelo" eyebrow="UC23"><ol className="timeline"><li>Dataset versionado.</li><li>Validacao temporal e k-fold.</li><li>Fairness minimo.</li><li>Deploy controlado e rollback.</li></ol><ActionButton disabled={busy} onClick={() => post('/api/models/train', { ambiente: 'piloto' })}>iniciar piloto</ActionButton></Panel><Panel title="Historico" eyebrow="registry"><DataTable rows={rows} /></Panel></div>; }
function Fairness({ data }) { return <div className="grid two"><Panel title="Metricas fairness" eyebrow={data.summary?.status}><DataTable rows={data.metrics || []} max={25} /></Panel><Panel title="Slices por grupo" eyebrow="sexo, nivel, unidade"><DataTable rows={data.slices || []} max={20} /></Panel></div>; }
function Audit({ rows }) { return <Panel title="Trilha imutavel de auditoria" eyebrow="UC24"><DataTable rows={rows} max={35} /></Panel>; }
function Incidents({ rows, post, busy }) { return <div className="grid two"><Panel title="Incidentes e eventos adversos" eyebrow="UC25"><DataTable rows={rows} max={20} /></Panel><Panel title="Abrir incidente" eyebrow="governanca"><ActionButton danger disabled={busy} onClick={() => post('/api/incidents', { categoria: 'seguranca', criticidade: 'alta', descricao: 'Incidente de demonstracao aberto pelo painel' })}>registrar incidente</ActionButton></Panel></div>; }
function Compliance() { return <div className="grid two"><Panel title="LGPD + Privacy by Design" eyebrow="DPO"><ul className="check-list"><li>Consentimento explicito e finalidade registrada.</li><li>Hash e pseudonimizacao para analytics.</li><li>Auditoria para acesso sensivel.</li><li>Exclusao e restricao por preferencia.</li></ul></Panel><Panel title="Risco em IA" eyebrow="ISO/IEC 23894"><ul className="check-list"><li>Modelos restritos quando fairness falha.</li><li>Kill-switch em risco critico.</li><li>Relatorio XAI por recomendacao.</li></ul></Panel></div>; }

function ApiHub({ rows, aux, setAux }) {
  async function test(id) { setAux({ testing: id }); const result = await api(`/api/integrations/${id}/test`); setAux({ result }); }
  const categories = [...new Set(rows.map((r) => r.category))];
  const [cat, setCat] = useState(categories[0] || '');
  const filtered = cat ? rows.filter((r) => r.category === cat) : rows;
  return <div className="grid two"><Panel title="100 conectores gratuitos/opcionais" eyebrow="fallback sem erro"><div className="filter-line wrap">{categories.map((c) => <button key={c} className={cat === c ? 'chip active' : 'chip'} onClick={() => setCat(c)}>{c}</button>)}</div><div className="api-grid">{filtered.slice(0, 20).map((row) => <article key={row.id}><strong>{row.name}</strong><span>{row.provider}</span><small>{row.purpose}</small><button onClick={() => test(row.id)}>testar</button></article>)}</div></Panel><Panel title="Resultado seguro" eyebrow="modo demo"><pre className="json-box">{JSON.stringify(aux.result || { dica: 'Clique em testar. Por padrao o projeto usa fallback local para nao quebrar por limite de terceiros.' }, null, 2)}</pre></Panel></div>;
}

function ABPilot({ data }) { return <div className="grid two"><Panel title="Piloto A/B" eyebrow="avaliacao online"><BarList rows={data.byUnit || []} labelKey="unidade" valueKey="aderencia_media" /><p>Divida por unidade ou aluno, compare prescricao usual versus IA e monitore seguranca.</p></Panel><Panel title="Metricas" eyebrow="offline + online"><ul className="check-list"><li>Precision@k, Recall@k e NDCG.</li><li>RMSE/MAE, AUC e Brier.</li><li>Aderencia semanal, 1RM, VO2 e eventos.</li></ul></Panel></div>; }
function TimeSeriesDemo() { return <DemoStudentBlock title="Series temporais" subtitle="Transformers, LSTM e GRU simulados com sinais de HRV, sono e carga" />; }
function Uplift({ data }) { return <div className="grid two"><Panel title="Uplift modelling" eyebrow="qual acao retém"><DataTable rows={data.interventions || []} max={12} /></Panel><Panel title="Acoes recomendadas" eyebrow="engenharia de retencao"><BarList rows={[{ grupo: 'revisao humana', valor: 0.41 }, { grupo: 'mensagem motivacional', valor: 0.27 }, { grupo: 'treino regenerativo', valor: 0.22 }, { grupo: 'mudanca de meta', valor: 0.18 }]} valueKey="valor" /></Panel></div>; }
function Gamification({ rows }) { return <Panel title="Gamificacao" eyebrow="badges e streaks"><DataTable rows={rows} max={25} /></Panel>; }
function InstructorPortal() { return <DemoStudentBlock title="Portal do instrutor" subtitle="Revisao humana, XAI, aprovacao, ajustes de carga e acompanhamento da sessao" />; }
function StudentApp() { return <DemoStudentBlock title="App do aluno" subtitle="Plano publicado, mapa muscular animado, check-in, feedback e progresso" />; }
function Reception() { return <DemoStudentBlock title="Recepcao inteligente" subtitle="Cadastro, aniversarios, faltas, campanhas, agenda e contato proativo" />; }
function Birthdays() { return <DemoStudentBlock title="Aniversariantes e ausentes" subtitle="Alertas simples de relacionamento para aumentar retencao" />; }
function Playbooks() { return <div className="playbook-grid">{['Risco critico','Aluno sumiu','Dor intensa','Wearable offline','Fairness falhou','LGPD solicitada'].map((title, i) => <article key={title}><span>PB0{i + 1}</span><h3>{title}</h3><p>Passo a passo operacional com responsavel, SLA, acao e registro de auditoria.</p></article>)}</div>; }
function Architecture({ data }) { return <div className="architecture-canvas">{(data.layers || []).map((layer) => <section key={layer.name}><h3>{layer.name}</h3>{layer.nodes.map((node) => <span key={node}>{node}</span>)}</section>)}</div>; }
function UseCases({ rows }) { return <div className="usecase-grid">{rows.map((uc) => <article key={uc.codigo}><span>{uc.codigo}</span><h3>{uc.titulo}</h3><p>{uc.objetivo}</p><Pill>{uc.prioridade}</Pill></article>)}</div>; }
function Rules({ rows }) { return <div className="rule-grid">{rows.map((rn) => <article key={rn.codigo}><span>{rn.codigo}</span><h3>{rn.regra}</h3><p>{rn.descricao}</p></article>)}</div>; }
function Settings() { return <Panel title="Configuracoes globais" eyebrow="rede"><div className="form-grid"><label>Cor primaria<input value="vermelho Beast" readOnly /></label><label>Politica de progressao<input value="5-10% por semana" readOnly /></label><label>Modo API externa<input value="fallback seguro por padrao" readOnly /></label></div></Panel>; }
function GenericTable({ rows, page }) { return <Panel title={page.title} eyebrow={page.group}><DataTable rows={rows} max={30} /></Panel>; }

function DemoStudentBlock({ title, subtitle }) {
  const [detail, setDetail] = useState(null);
  useEffect(() => { api('/api/students/1').then(setDetail); }, []);
  const hrv = detail?.wearables?.slice().reverse().map((w) => w.hrv) || [61, 63, 58, 67, 64, 70, 66];
  return <div className="grid two"><Panel title={title} eyebrow="demo vivo"><p>{subtitle}</p><Sparkline values={hrv} /><DataTable rows={detail?.wearables || []} max={8} /></Panel><Panel title="Visual de exercicio" eyebrow="body twin"><AnimatedExercise exercise={{ nome: title, grupo_muscular: 'fullbody', musculos_alvo: [] }} /></Panel></div>;
}
