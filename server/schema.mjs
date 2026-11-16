export const schemaSql = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS rede_academia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  cnpj_base TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS unidade (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rede_id INTEGER REFERENCES rede_academia(id),
  nome TEXT NOT NULL,
  cidade TEXT,
  uf TEXT,
  status TEXT DEFAULT 'ativa',
  capacidade INTEGER DEFAULT 400
);
CREATE TABLE IF NOT EXISTS usuario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unidade_id INTEGER REFERENCES unidade(id),
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  perfil TEXT NOT NULL,
  ativo INTEGER DEFAULT 1,
  senha_hash TEXT DEFAULT 'demo'
);
CREATE TABLE IF NOT EXISTS aluno (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unidade_id INTEGER REFERENCES unidade(id),
  nome TEXT NOT NULL,
  email TEXT UNIQUE,
  birth_date TEXT,
  sexo TEXT,
  cpf_hash TEXT,
  status TEXT DEFAULT 'ativo',
  segmento TEXT,
  nivel TEXT,
  avatar TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS consentimento_lgpd (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aluno_id INTEGER REFERENCES aluno(id),
  finalidade TEXT,
  versao_termo TEXT,
  dt_aceite TEXT,
  status TEXT,
  preferencias_json TEXT
);
CREATE TABLE IF NOT EXISTS triagem_saude (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aluno_id INTEGER REFERENCES aluno(id),
  usuario_id INTEGER REFERENCES usuario(id),
  dt_triagem TEXT,
  parq_apto INTEGER,
  restricoes TEXT,
  risco_clinico TEXT
);
CREATE TABLE IF NOT EXISTS avaliacao_fisica (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aluno_id INTEGER REFERENCES aluno(id),
  usuario_id INTEGER REFERENCES usuario(id),
  dt_avaliacao TEXT,
  peso REAL,
  altura REAL,
  gordura_pct REAL,
  fc_repouso INTEGER,
  vo2_estimado REAL,
  imc REAL,
  forcarm_estimada REAL,
  mobilidade_score REAL
);
CREATE TABLE IF NOT EXISTS meta_aluno (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aluno_id INTEGER REFERENCES aluno(id),
  objetivo TEXT,
  horizonte_semanas INTEGER,
  disponibilidade_semana INTEGER,
  prioridade TEXT,
  restricoes TEXT,
  preferencias TEXT
);
CREATE TABLE IF NOT EXISTS wearable_resumo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aluno_id INTEGER REFERENCES aluno(id),
  data_ref TEXT,
  hrv REAL,
  sono_horas REAL,
  passos INTEGER,
  fc_media INTEGER,
  fc_max INTEGER,
  stress_score REAL,
  readiness REAL
);
CREATE TABLE IF NOT EXISTS equipamento (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  categoria TEXT,
  status_global TEXT DEFAULT 'ativo'
);
CREATE TABLE IF NOT EXISTS exercicio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipamento_id INTEGER REFERENCES equipamento(id),
  nome TEXT NOT NULL,
  grupo_muscular TEXT,
  musculos_alvo TEXT,
  padrao_movimento TEXT,
  nivel TEXT,
  contraindications TEXT,
  gif_key TEXT,
  instrucoes TEXT
);
CREATE TABLE IF NOT EXISTS plano_treino (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aluno_id INTEGER REFERENCES aluno(id),
  usuario_resp INTEGER REFERENCES usuario(id),
  recomendacao_id INTEGER,
  dt_inicio TEXT,
  dt_fim TEXT,
  status TEXT,
  versao INTEGER DEFAULT 1,
  nome TEXT,
  objetivo TEXT,
  score_risco REAL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS item_plano_treino (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plano_id INTEGER REFERENCES plano_treino(id),
  exercicio_id INTEGER REFERENCES exercicio(id),
  ordem INTEGER,
  series INTEGER,
  reps TEXT,
  carga_alvo REAL,
  descanso_seg INTEGER,
  tecnica TEXT,
  observacao TEXT
);
CREATE TABLE IF NOT EXISTS sessao_treino (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aluno_id INTEGER REFERENCES aluno(id),
  plano_id INTEGER REFERENCES plano_treino(id),
  dt_inicio TEXT,
  dt_fim TEXT,
  status TEXT,
  origem TEXT,
  aderencia_score REAL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS execucao_exercicio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessao_id INTEGER REFERENCES sessao_treino(id),
  exercicio_id INTEGER REFERENCES exercicio(id),
  series_realizadas INTEGER,
  reps_realizadas TEXT,
  carga_real REAL,
  rpe REAL,
  dor_0_10 INTEGER,
  observacao TEXT
);
CREATE TABLE IF NOT EXISTS feedback_aluno (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessao_id INTEGER REFERENCES sessao_treino(id),
  nps INTEGER,
  fadiga INTEGER,
  satisfacao INTEGER,
  dor INTEGER,
  comentario TEXT,
  rpe REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS modelo_ia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_modelo TEXT,
  tipo TEXT,
  owner TEXT,
  status TEXT
);
CREATE TABLE IF NOT EXISTS versao_modelo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  modelo_id INTEGER REFERENCES modelo_ia(id),
  versao TEXT,
  dt_publicacao TEXT,
  ambiente TEXT,
  hash_artefato TEXT,
  metricas_json TEXT,
  status TEXT
);
CREATE TABLE IF NOT EXISTS dataset_snapshot (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  periodo_ini TEXT,
  periodo_fim TEXT,
  hash_integridade TEXT,
  status TEXT,
  linhas INTEGER
);
CREATE TABLE IF NOT EXISTS recomendacao_ia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aluno_id INTEGER REFERENCES aluno(id),
  versao_modelo_id INTEGER REFERENCES versao_modelo(id),
  snapshot_id INTEGER REFERENCES dataset_snapshot(id),
  dt_geracao TEXT,
  score_aderencia REAL,
  score_risco REAL,
  score_resposta REAL,
  status TEXT,
  modo_degradado INTEGER DEFAULT 0,
  summary TEXT,
  guardrails_json TEXT
);
CREATE TABLE IF NOT EXISTS explicacao_ia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recomendacao_id INTEGER REFERENCES recomendacao_ia(id),
  fator TEXT,
  importancia REAL,
  sinal TEXT,
  descricao TEXT
);
CREATE TABLE IF NOT EXISTS metrica_fairness (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  versao_modelo_id INTEGER REFERENCES versao_modelo(id),
  grupo TEXT,
  metrica TEXT,
  valor REAL,
  limiar REAL,
  status TEXT
);
CREATE TABLE IF NOT EXISTS alerta (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aluno_id INTEGER REFERENCES aluno(id),
  recomendacao_id INTEGER REFERENCES recomendacao_ia(id),
  tipo TEXT,
  severidade TEXT,
  origem TEXT,
  status TEXT,
  dt_geracao TEXT,
  mensagem TEXT
);
CREATE TABLE IF NOT EXISTS evento_adverso (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aluno_id INTEGER REFERENCES aluno(id),
  sessao_id INTEGER REFERENCES sessao_treino(id),
  tipo TEXT,
  gravidade TEXT,
  descricao TEXT,
  desfecho TEXT,
  dt_evento TEXT
);
CREATE TABLE IF NOT EXISTS incidente_gov (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria TEXT,
  criticidade TEXT,
  status TEXT,
  dt_abertura TEXT,
  responsavel TEXT,
  descricao TEXT
);
CREATE TABLE IF NOT EXISTS acao_corretiva (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incidente_id INTEGER REFERENCES incidente_gov(id),
  tipo TEXT,
  descricao TEXT,
  prazo TEXT,
  status TEXT
);
CREATE TABLE IF NOT EXISTS auditoria_acesso (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER REFERENCES usuario(id),
  entidade TEXT,
  id_entidade INTEGER,
  acao TEXT,
  dt_evento TEXT,
  ip_hash TEXT,
  detalhes TEXT
);
CREATE TABLE IF NOT EXISTS use_case (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT UNIQUE,
  titulo TEXT,
  bloco TEXT,
  atores TEXT,
  objetivo TEXT,
  prioridade TEXT,
  status TEXT
);
CREATE TABLE IF NOT EXISTS business_rule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT UNIQUE,
  titulo TEXT,
  descricao TEXT,
  criticidade TEXT
);
CREATE TABLE IF NOT EXISTS api_integration (
  id INTEGER PRIMARY KEY,
  name TEXT,
  category TEXT,
  provider TEXT,
  endpoint TEXT,
  method TEXT,
  free_tier TEXT,
  auth_type TEXT,
  status TEXT,
  mock_response TEXT
);
CREATE TABLE IF NOT EXISTS workout_template (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  focus TEXT,
  level TEXT,
  duration_min INTEGER,
  description TEXT,
  intensity TEXT,
  muscle_targets TEXT
);
CREATE TABLE IF NOT EXISTS workout_page (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE,
  title TEXT,
  objective TEXT,
  level TEXT,
  hero_metric TEXT,
  blocks_json TEXT
);
CREATE TABLE IF NOT EXISTS campaign (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  target_segment TEXT,
  status TEXT,
  channel TEXT,
  metric TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS notification (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aluno_id INTEGER REFERENCES aluno(id),
  channel TEXT,
  title TEXT,
  body TEXT,
  status TEXT,
  scheduled_at TEXT
);
CREATE TABLE IF NOT EXISTS payment_plan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aluno_id INTEGER REFERENCES aluno(id),
  name TEXT,
  amount REAL,
  status TEXT,
  due_date TEXT
);
CREATE TABLE IF NOT EXISTS appointment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aluno_id INTEGER REFERENCES aluno(id),
  usuario_id INTEGER REFERENCES usuario(id),
  type TEXT,
  status TEXT,
  scheduled_at TEXT
);
CREATE TABLE IF NOT EXISTS class_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unidade_id INTEGER REFERENCES unidade(id),
  name TEXT,
  coach_id INTEGER REFERENCES usuario(id),
  capacity INTEGER,
  enrolled INTEGER,
  starts_at TEXT
);
CREATE TABLE IF NOT EXISTS game_badge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aluno_id INTEGER REFERENCES aluno(id),
  badge TEXT,
  points INTEGER,
  earned_at TEXT
);
CREATE TABLE IF NOT EXISTS checkin (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aluno_id INTEGER REFERENCES aluno(id),
  unidade_id INTEGER REFERENCES unidade(id),
  source TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS feature_store (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aluno_id INTEGER REFERENCES aluno(id),
  feature_key TEXT,
  feature_value REAL,
  version TEXT,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_aluno_unidade ON aluno(unidade_id);
CREATE INDEX IF NOT EXISTS idx_plano_aluno ON plano_treino(aluno_id);
CREATE INDEX IF NOT EXISTS idx_sessao_aluno ON sessao_treino(aluno_id);
CREATE INDEX IF NOT EXISTS idx_audit_entidade ON auditoria_acesso(entidade, id_entidade);
`;

export function initializeSchema(db) {
  db.exec(schemaSql);
}
