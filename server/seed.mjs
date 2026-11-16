import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeSchema } from './schema.mjs';
import { integrations } from './integrationRegistry.mjs';
import { addDays, daysAgo, hash, json, pick, pseudoCpf, randomBetween, slugify } from './utils.mjs';

function insert(db, table, obj) {
  const keys = Object.keys(obj);
  const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
  return db.prepare(sql).run(...keys.map((key) => obj[key])).lastInsertRowid;
}

function maybeReset(db) {
  if (process.env.RESET_DB !== 'true') return;
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  db.exec('PRAGMA foreign_keys = OFF;');
  for (const { name } of tables.reverse()) db.exec(`DELETE FROM ${name};`);
  db.exec('PRAGMA foreign_keys = ON;');
}

const firstNames = ['Lucas','Marina','Rafael','Camila','Pedro','Ana','Thiago','Bianca','Gustavo','Larissa','Bruno','Juliana','Felipe','Patricia','Andre','Natalia','Diego','Sofia','Daniel','Isabela','Mateus','Beatriz','Vinicius','Carolina','Joao','Livia','Eduardo','Gabriela','Caio','Fernanda','Renan','Aline','Igor','Priscila','Vitor','Helena','Samuel','Leticia','Leandro','Amanda'];
const lastNames = ['Silva','Santos','Oliveira','Souza','Costa','Pereira','Rodrigues','Almeida','Nascimento','Lima','Gomes','Ribeiro','Carvalho','Martins','Araujo','Melo','Barbosa','Rocha','Dias','Correia'];
const objetivos = ['hipertrofia','emagrecimento','forca','condicionamento','mobilidade','saude','performance','retorno_pos_lesao'];
const niveis = ['iniciante','intermediario','avancado'];
const segmentos = ['premium','standard','corporativo','student','reabilitacao'];
const restricoes = ['nenhuma','joelho sensivel','ombro direito','lombar','hipertensao controlada','tendinite leve','mobilidade baixa','retorno medico'];

const equipmentNames = [
  ['Halteres','livre'], ['Barra olimpica','livre'], ['Banco ajustavel','livre'], ['Smith machine','maquina'], ['Crossover','maquina'],
  ['Leg press','maquina'], ['Cadeira extensora','maquina'], ['Mesa flexora','maquina'], ['Puxador alto','maquina'], ['Remada baixa','maquina'],
  ['Esteira','cardio'], ['Bike ergometrica','cardio'], ['Eliptico','cardio'], ['Kettlebell','funcional'], ['TRX','funcional'], ['Bola medicinal','funcional'],
  ['Faixa elastica','mobilidade'], ['Colchonete','mobilidade'], ['Barras paralelas','calistenia'], ['Peso corporal','calistenia']
];

const exerciseBases = [
  ['Supino reto','peitoral',['peitoral','triceps','deltoide anterior'],'empurrar','intermediario','ombro instavel'],
  ['Supino inclinado','peitoral',['peitoral superior','triceps','deltoide anterior'],'empurrar','intermediario','ombro instavel'],
  ['Crucifixo maquina','peitoral',['peitoral'],'isolador','iniciante','ombro instavel'],
  ['Flexao explosiva','peitoral',['peitoral','core','triceps'],'calistenia','avancado','punho dolorido'],
  ['Puxada alta','costas',['latissimo','biceps','trapecio'],'puxar','iniciante','ombro agudo'],
  ['Remada curvada','costas',['dorsal','romboides','posterior ombro'],'puxar','intermediario','lombar sensivel'],
  ['Barra fixa assistida','costas',['latissimo','biceps','core'],'calistenia','intermediario','ombro agudo'],
  ['Remada unilateral','costas',['dorsal','romboides','biceps'],'puxar','iniciante','lombar sensivel'],
  ['Agachamento livre','quadriceps',['quadriceps','gluteos','core'],'agachar','intermediario','joelho sensivel'],
  ['Leg press 45','quadriceps',['quadriceps','gluteos','posterior coxa'],'empurrar','iniciante','joelho agudo'],
  ['Cadeira extensora','quadriceps',['quadriceps'],'isolador','iniciante','joelho agudo'],
  ['Afundo caminhando','quadriceps',['quadriceps','gluteos','core'],'unilateral','intermediario','equilibrio baixo'],
  ['Levantamento terra romeno','posterior',['posterior coxa','gluteos','lombar'],'hinge','intermediario','lombar aguda'],
  ['Mesa flexora','posterior',['posterior coxa'],'isolador','iniciante','joelho agudo'],
  ['Hip thrust','gluteos',['gluteos','posterior coxa','core'],'ponte','intermediario','lombar aguda'],
  ['Abducao maquina','gluteos',['gluteo medio'],'isolador','iniciante','quadril dolorido'],
  ['Desenvolvimento militar','ombros',['deltoides','triceps','core'],'empurrar','intermediario','ombro instavel'],
  ['Elevacao lateral','ombros',['deltoide medial'],'isolador','iniciante','ombro agudo'],
  ['Face pull','ombros',['posterior ombro','trapecio','rotadores'],'puxar','iniciante','ombro agudo'],
  ['Rosca direta','biceps',['biceps','antebraco'],'isolador','iniciante','cotovelo dolorido'],
  ['Rosca martelo','biceps',['biceps','braquial','antebraco'],'isolador','iniciante','cotovelo dolorido'],
  ['Triceps corda','triceps',['triceps'],'isolador','iniciante','cotovelo dolorido'],
  ['Paralelas assistidas','triceps',['triceps','peitoral','deltoide anterior'],'calistenia','intermediario','ombro instavel'],
  ['Prancha RKC','core',['abdomen','core','gluteos'],'estabilidade','iniciante','lombar aguda'],
  ['Dead bug','core',['core profundo','abdomen'],'estabilidade','iniciante','lombar aguda'],
  ['Abdominal cable crunch','core',['abdomen'],'flexao tronco','intermediario','lombar aguda'],
  ['Burpee tecnico','fullbody',['peitoral','quadriceps','core','cardio'],'metabolico','avancado','joelho agudo'],
  ['Kettlebell swing','fullbody',['gluteos','posterior','core','cardio'],'hinge','avancado','lombar aguda'],
  ['Bike HIIT','cardio',['cardio','quadriceps'],'cardio','intermediario','risco cardiaco alto'],
  ['Esteira zona 2','cardio',['cardio','posterior','panturrilha'],'cardio','iniciante','risco cardiaco alto'],
  ['Mobilidade toracica','mobilidade',['toracica','ombros'],'mobilidade','iniciante','nenhuma'],
  ['Alongamento posterior','mobilidade',['posterior coxa','lombar'],'mobilidade','iniciante','dor aguda']
];

const originalUseCases = [
  ['UC01','Cadastrar aluno e vincular a unidade','Cadastro','Recepcao, Aluno','Criar cadastro mestre com unidade, status e identificacao.','Alta'],
  ['UC02','Registrar consentimento LGPD e privacidade','Cadastro','Aluno, Recepcao, DPO','Coletar aceite, finalidade de uso e restricoes de tratamento.','Alta'],
  ['UC03','Aplicar triagem PAR-Q+/anamnese','Cadastro','Instrutor, Aluno','Identificar aptidao, restricoes e necessidade de avaliacao adicional.','Alta'],
  ['UC04','Realizar avaliacao fisica inicial e periodica','Cadastro','Instrutor, Aluno','Registrar composicao corporal, FC repouso, 1RM e VO2 estimado.','Alta'],
  ['UC05','Definir metas, restricoes e disponibilidade','Cadastro','Aluno, Instrutor','Cadastrar objetivos, janelas de treino, preferencias e limitacoes.','Alta'],
  ['UC06','Integrar dados de wearables e aplicativos','Cadastro','Servico de Wearables, Sistema','Consumir sinais externos, normalizar formatos e anexar series temporais.','Alta'],
  ['UC07','Solicitar plano de treino personalizado por IA','Prescricao','Instrutor, IA','Gerar recomendacao com historico, contexto, meta e risco.','Alta'],
  ['UC08','Revisar, explicar e ajustar recomendacao','Prescricao','Instrutor','Revisao humana com XAI e ajustes do plano.','Alta'],
  ['UC09','Publicar plano de treino ao aluno','Prescricao','Instrutor, Sistema','Disponibilizar a versao aprovada nos canais do aluno.','Alta'],
  ['UC10','Executar sessao de treino','Execucao','Aluno','Iniciar e concluir sessao associada ao plano vigente.','Alta'],
  ['UC11','Registrar execucao, carga, repeticoes e presenca','Execucao','Aluno, Instrutor, Sistema','Persistir o treino realizado para fechar ciclo de aprendizado.','Alta'],
  ['UC12','Registrar feedback do aluno','Execucao','Aluno','Coletar RPE, dor, fadiga, satisfacao e comentario.','Alta'],
  ['UC13','Detectar risco e aplicar guardrails','Seguranca','Sistema','Avaliar limites de progressao, fadiga e restricoes clinicas.','Alta'],
  ['UC14','Acionar kill-switch e escalonamento humano','Seguranca','Sistema, Instrutor','Interromper recomendacoes ou sessoes em risco elevado.','Alta'],
  ['UC15','Replanejar treino apos evento ou meta','Prescricao','Instrutor, IA','Gerar nova versao do plano com base em evolucao e eventos.','Alta'],
  ['UC16','Agendar reavaliacao fisica ou funcional','Execucao','Instrutor, Recepcao','Planejar checkpoints obrigatorios de seguranca e performance.','Media'],
  ['UC17','Monitorar aderencia, retencao e risco de evasao','Retencao','Gestor, Sistema','Medir frequencia, churn e efetividade das intervencoes.','Alta'],
  ['UC18','Disparar alertas e acoes de reengajamento','Retencao','Sistema, Notificacoes','Executar campanhas, lembretes e contato proativo.','Alta'],
  ['UC19','Gerenciar unidades, usuarios e permissoes','Admin','Administrador','Administrar multiunidade, RBAC e segregacao de acesso.','Alta'],
  ['UC20','Gerenciar catalogo de exercicios e regras','Admin','Administrador, Instrutor','Manter exercicios, equipamentos, contraindicacoes e parametros.','Alta'],
  ['UC21','Auditar fairness, vies e explicabilidade','Governanca','DPO, Dados, Gestor','Analisar modelos por grupo, unidade e contexto com XAI.','Alta'],
  ['UC22','Gerar dashboards e relatorios gerenciais','Gestao','Gestor, Administrador','Produzir visoes operacionais, clinicas e executivas.','Alta'],
  ['UC23','Treinar, versionar e implantar modelos de IA','MLOps','Cientista de Dados','Executar ciclo de vida do modelo com validacao e deploy.','Alta'],
  ['UC24','Registrar auditoria e trilha de conformidade','Governanca','Sistema, DPO','Manter trilhas imutaveis de acesso e compartilhamento.','Alta'],
  ['UC25','Gerenciar incidentes e eventos adversos','Governanca','Instrutor, Gestor, DPO','Registrar, classificar e responder eventos adversos.','Alta']
];

const extraUseCases = Array.from({ length: 55 }, (_, i) => {
  const n = i + 26;
  const options = [
    ['Login SSO e RBAC dinamico','Admin','Administrador, Usuario','Autenticar por perfil e liberar paginas conforme permissao.'],
    ['Check-in inteligente por QR','Recepcao','Aluno, Recepcao','Registrar presenca e alimentar aderencia automaticamente.'],
    ['Painel de lotacao por equipamento','Operacao','Gestor, Instrutor','Sugerir ajustes de treino considerando equipamentos livres.'],
    ['Campanha de aniversario e ausencia','CRM','Recepcao, Notificacoes','Disparar contato humano em momentos de relacionamento.'],
    ['Ficha imprimivel com QR do plano','Treinos','Instrutor, Aluno','Gerar ficha visual para treino offline e terminal de sala.'],
    ['Analise de postura por camera','Visao Computacional','Instrutor, IA','Registrar risco tecnico com pose estimation opcional.'],
    ['Sincronizar dados offline','Mobile','Aluno, Sistema','Guardar execucoes sem internet e sincronizar depois.'],
    ['Exportar pacote LGPD','Compliance','DPO, Aluno','Gerar dados pessoais em formato portavel e auditavel.'],
    ['Simular piloto A/B por unidade','Pesquisa','Gestor, Dados','Comparar grupo IA versus prescricao usual com metricas.'],
    ['Gerar playbook de resposta a incidente','Governanca','DPO, Gestor','Criar tarefas, prazos e responsaveis por severidade.'],
    ['Analisar uplift de retencao','Retencao','Gestor, IA','Recomendar a melhor acao para reduzir churn individual.']
  ];
  const [titulo, bloco, atores, objetivo] = options[i % options.length];
  return [`UC${String(n).padStart(2, '0')}`, `${titulo} ${Math.floor(i / options.length) + 1}`, bloco, atores, objetivo, i % 3 === 0 ? 'Alta' : 'Media'];
});

const rules = [
  ['RN01','Consentimento obrigatorio','Dados sensiveis e wearables so podem ser processados com consentimento valido e finalidade registrada.','critica'],
  ['RN02','Triagem e avaliacao validas','Nao publicar plano se PAR-Q ou avaliacao estiver vencida ou pendente.','critica'],
  ['RN03','Human-in-the-loop','Toda recomendacao de IA deve passar por revisao/aprovacao humana.','critica'],
  ['RN04','Guardrails prioritarios','Regras de seguranca prevalecem sobre performance, aderencia ou preferencia.','critica'],
  ['RN05','Kill-switch','Alertas criticos suspendem plano ou sessao ate analise humana.','critica'],
  ['RN06','Fallback operacional','Ausencia de wearable nao impede operacao; usa dados internos e marca inferencia parcial.','alta'],
  ['RN07','Pseudonimizacao e trilha','Dados analiticos usam identificadores pseudonimizados e consulta sensivel auditada.','critica'],
  ['RN08','Versionamento de modelos','Toda recomendacao registra versao, dataset e data de geracao.','alta'],
  ['RN09','Fairness minima','Modelos nao sao promovidos quando violam limiares de equidade.','critica'],
  ['RN10','Eventos adversos','Todo evento adverso gera registro, gravidade, causa e eventual revisao do plano.','critica']
];

for (let i = 11; i <= 35; i++) {
  rules.push([`RN${String(i).padStart(2,'0')}`, `Regra operacional ${i}`, `Regra expandida para validacao automatica, auditoria, retencao e seguranca do modulo ${i}.`, i % 4 === 0 ? 'critica' : 'media']);
}

const workoutThemes = [
  ['Forja de Peitoral','hipertrofia','intermediario','Peito e triceps com progressao segura.'],
  ['Costas Titano','forca','intermediario','Puxadas e remadas com controle lombar.'],
  ['Pernas Vulcao','hipertrofia','avancado','Quadriceps, gluteos e posterior com volume alto.'],
  ['Core Blindado','saude','iniciante','Estabilidade e protecao lombar.'],
  ['Zona 2 Inteligente','condicionamento','iniciante','Cardio seguro guiado por FC e RPE.'],
  ['HIIT Controlado','performance','avancado','Intervalos com kill-switch preventivo.'],
  ['Mobilidade Total','mobilidade','iniciante','Respiracao, mobilidade e recuperacao.'],
  ['Retorno Pos Lesao','retorno_pos_lesao','iniciante','Treino conservador com guardrails fortes.'],
  ['Power Upper','forca','avancado','Parte superior com enfoque neural.'],
  ['Full Body Starter','saude','iniciante','Base global para cold start.']
];

export function seedDatabase(db) {
  maybeReset(db);
  if (db.prepare('SELECT COUNT(*) AS total FROM aluno').get().total > 0) return;
  const redeId = insert(db, 'rede_academia', { nome: 'BEASTFIT AI NETWORK', cnpj_base: '00.000.000/0001-00' });
  const unidades = ['Assis Alpha','Sao Paulo Red Core','Rio Black Lab','Curitiba Iron','Belo Horizonte Pulse','Recife Titan','Porto Alegre Forge','Brasilia Command'].map((nome, i) =>
    insert(db, 'unidade', { rede_id: redeId, nome, cidade: nome.split(' ')[0], uf: pick(['SP','RJ','PR','MG','PE','RS','DF'], i), status: 'ativa', capacidade: 350 + i * 70 })
  );

  const perfis = ['admin','gestor','instrutor','recepcao','dpo','mlops','aluno'];
  const usuarios = [];
  for (let i = 0; i < 42; i++) {
    const perfil = pick(perfis, i);
    usuarios.push(insert(db, 'usuario', {
      unidade_id: pick(unidades, i),
      nome: `${pick(firstNames, i)} ${pick(lastNames, i + 3)}`,
      email: `${perfil}${i}@beastfit.local`,
      perfil,
      ativo: 1,
      senha_hash: hash('beastfit-demo')
    }));
  }

  const equipamentos = equipmentNames.map(([nome, categoria]) => insert(db, 'equipamento', { nome, categoria, status_global: 'ativo' }));
  const exercicioIds = [];
  for (let i = 0; i < 96; i++) {
    const base = exerciseBases[i % exerciseBases.length];
    const variation = Math.floor(i / exerciseBases.length) + 1;
    const nome = variation === 1 ? base[0] : `${base[0]} V${variation}`;
    exercicioIds.push(insert(db, 'exercicio', {
      equipamento_id: pick(equipamentos, i),
      nome,
      grupo_muscular: base[1],
      musculos_alvo: json(base[2]),
      padrao_movimento: base[3],
      nivel: base[4],
      contraindications: base[5],
      gif_key: slugify(nome),
      instrucoes: `Controle a fase excentrica, respire com ritmo e mantenha RPE alvo entre 6 e 8. Area ativa: ${base[2].join(', ')}.`
    }));
  }

  for (const uc of originalUseCases.concat(extraUseCases)) {
    insert(db, 'use_case', { codigo: uc[0], titulo: uc[1], bloco: uc[2], atores: uc[3], objetivo: uc[4], prioridade: uc[5], status: 'implementado_demo' });
  }
  for (const r of rules) insert(db, 'business_rule', { codigo: r[0], titulo: r[1], descricao: r[2], criticidade: r[3] });
  for (const api of integrations) insert(db, 'api_integration', { ...api, mock_response: json(api.mock_response) });

  const modeloId = insert(db, 'modelo_ia', { nome_modelo: 'BeastHybrid-XAI Transformer Lite', tipo: 'hibrido_contextual', owner: 'MLOps BeastFit', status: 'ativo' });
  const versaoId = insert(db, 'versao_modelo', { modelo_id: modeloId, versao: 'v1.0.0-node24', dt_publicacao: daysAgo(7), ambiente: 'piloto', hash_artefato: hash('model-v1'), metricas_json: json({ precisionAt10: 0.81, auc: 0.87, brier: 0.11, fairness: 0.94 }), status: 'aprovado' });
  const snapshotId = insert(db, 'dataset_snapshot', { periodo_ini: daysAgo(180), periodo_fim: daysAgo(1), hash_integridade: hash('snapshot-180'), status: 'valido', linhas: 128930 });
  const groups = ['sexo:F','sexo:M','nivel:iniciante','nivel:intermediario','nivel:avancado','idade:40+','unidade:interior','unidade:capital'];
  groups.forEach((grupo, i) => insert(db, 'metrica_fairness', { versao_modelo_id: versaoId, grupo, metrica: i % 2 ? 'equality_of_odds' : 'disparate_impact', valor: 0.88 + (i % 7) / 100, limiar: 0.82, status: 'ok' }));

  const alunoIds = [];
  for (let i = 0; i < 220; i++) {
    const nome = `${pick(firstNames, i)} ${pick(lastNames, i * 3)} ${pick(lastNames, i * 7)}`;
    const age = randomBetween(i + 4, 18, 64);
    const birthYear = new Date().getFullYear() - age;
    const alunoId = insert(db, 'aluno', {
      unidade_id: pick(unidades, i),
      nome,
      email: `aluno${String(i + 1).padStart(3, '0')}@demo.beastfit.local`,
      birth_date: `${birthYear}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
      sexo: i % 2 === 0 ? 'F' : 'M',
      cpf_hash: pseudoCpf(i),
      status: i % 19 === 0 ? 'atencao' : 'ativo',
      segmento: pick(segmentos, i),
      nivel: pick(niveis, i + Math.floor(i / 9)),
      avatar: `https://api.dicebear.com/7.x/shapes/svg?seed=beastfit-${i}`
    });
    alunoIds.push(alunoId);
    insert(db, 'consentimento_lgpd', { aluno_id: alunoId, finalidade: 'operacional_analitica_wearables', versao_termo: '2026.1', dt_aceite: daysAgo(randomBetween(i, 1, 90)), status: i % 23 === 0 ? 'restrito' : 'valido', preferencias_json: json({ analytics: i % 23 !== 0, wearables: i % 5 !== 0, marketing: i % 4 === 0 }) });
    insert(db, 'triagem_saude', { aluno_id: alunoId, usuario_id: pick(usuarios, i), dt_triagem: daysAgo(randomBetween(i + 1, 1, 80)), parq_apto: i % 31 === 0 ? 0 : 1, restricoes: pick(restricoes, i), risco_clinico: i % 31 === 0 ? 'alto' : (i % 11 === 0 ? 'moderado' : 'baixo') });
    const peso = randomBetween(i + 7, 52, 108);
    const altura = randomBetween(i + 8, 155, 194) / 100;
    const imc = Number((peso / (altura * altura)).toFixed(1));
    insert(db, 'avaliacao_fisica', { aluno_id: alunoId, usuario_id: pick(usuarios, i + 3), dt_avaliacao: daysAgo(randomBetween(i + 2, 1, 88)), peso, altura, gordura_pct: randomBetween(i + 3, 11, 38), fc_repouso: randomBetween(i + 5, 48, 86), vo2_estimado: randomBetween(i + 6, 28, 58), imc, forcarm_estimada: randomBetween(i + 8, 45, 150), mobilidade_score: randomBetween(i + 9, 40, 96) });
    insert(db, 'meta_aluno', { aluno_id: alunoId, objetivo: pick(objetivos, i), horizonte_semanas: randomBetween(i + 10, 8, 32), disponibilidade_semana: randomBetween(i + 11, 2, 6), prioridade: pick(['estetica','saude','performance','consistencia'], i), restricoes: pick(restricoes, i + 2), preferencias: pick(['treino curto','maquinas','peso livre','cardio baixo','aulas coletivas','sem impacto'], i) });
    for (let d = 0; d < 14; d++) {
      insert(db, 'wearable_resumo', { aluno_id: alunoId, data_ref: daysAgo(d), hrv: randomBetween(i * 3 + d, 34, 92), sono_horas: randomBetween(i + d, 45, 86) / 10, passos: randomBetween(i + d * 2, 2200, 16000), fc_media: randomBetween(i + d, 64, 114), fc_max: randomBetween(i + d, 116, 184), stress_score: randomBetween(i + d, 8, 88), readiness: randomBetween(i + d, 40, 98) });
    }
    const scoreAderencia = randomBetween(i + 13, 47, 96) / 100;
    const scoreRisco = randomBetween(i + 14, 4, 72) / 100;
    const recId = insert(db, 'recomendacao_ia', { aluno_id: alunoId, versao_modelo_id: versaoId, snapshot_id: snapshotId, dt_geracao: daysAgo(randomBetween(i, 0, 20)), score_aderencia: scoreAderencia, score_risco: scoreRisco, score_resposta: randomBetween(i + 15, 52, 97) / 100, status: scoreRisco > 0.68 ? 'bloqueada_guardrail' : (i % 3 === 0 ? 'em_revisao' : 'aprovada'), modo_degradado: i % 5 === 0 ? 1 : 0, summary: `Plano recomendado para ${pick(objetivos, i)} com risco ${scoreRisco.toFixed(2)} e aderencia ${scoreAderencia.toFixed(2)}.`, guardrails_json: json({ progressaoMaxSemanalPct: 10, wearableFallback: i % 5 === 0, humanReview: true, blocked: scoreRisco > 0.68 }) });
    const factors = [
      ['HRV recente', randomBetween(i, 18, 38) / 100, scoreRisco > 0.5 ? 'negativo' : 'positivo'],
      ['Sono medio', randomBetween(i + 1, 10, 24) / 100, i % 4 === 0 ? 'negativo' : 'positivo'],
      ['Historico de aderencia', randomBetween(i + 2, 15, 35) / 100, 'positivo'],
      ['Restricao clinica', randomBetween(i + 3, 8, 29) / 100, i % 11 === 0 ? 'negativo' : 'neutro']
    ];
    factors.forEach((f) => insert(db, 'explicacao_ia', { recomendacao_id: recId, fator: f[0], importancia: f[1], sinal: f[2], descricao: `Fator ${f[0]} influenciou a recomendacao de forma ${f[2]}.` }));
    const planStatus = scoreRisco > 0.68 ? 'suspenso' : (i % 3 === 0 ? 'em_revisao' : 'publicado');
    const planId = insert(db, 'plano_treino', { aluno_id: alunoId, usuario_resp: pick(usuarios, i + 6), recomendacao_id: recId, dt_inicio: daysAgo(randomBetween(i, 1, 30)), dt_fim: addDays(45), status: planStatus, versao: 1, nome: `Protocolo ${pick(workoutThemes, i)[0]}`, objetivo: pick(objetivos, i), score_risco: scoreRisco });
    for (let j = 0; j < 6; j++) {
      insert(db, 'item_plano_treino', { plano_id: planId, exercicio_id: pick(exercicioIds, i + j * 7), ordem: j + 1, series: 3 + (j % 2), reps: j % 3 === 0 ? '6-8' : (j % 3 === 1 ? '8-12' : '12-15'), carga_alvo: randomBetween(i + j, 12, 120), descanso_seg: 45 + j * 15, tecnica: pick(['cadencia 3-1-1','RIR 2','tempo controlado','cluster leve'], i + j), observacao: 'Gerado por IA e validado por guardrails.' });
    }
    for (let s = 0; s < 3; s++) {
      const sessId = insert(db, 'sessao_treino', { aluno_id: alunoId, plano_id: planId, dt_inicio: daysAgo(randomBetween(i + s, 0, 35)), dt_fim: daysAgo(randomBetween(i + s, 0, 35)), status: s === 0 && scoreRisco > 0.68 ? 'interrompida' : 'concluida', origem: s % 2 ? 'app' : 'terminal', aderencia_score: randomBetween(i + s, 55, 99) / 100 });
      for (let e = 0; e < 4; e++) insert(db, 'execucao_exercicio', { sessao_id: sessId, exercicio_id: pick(exercicioIds, i + e), series_realizadas: 3, reps_realizadas: '10,10,9', carga_real: randomBetween(i + e, 10, 110), rpe: randomBetween(i + e, 5, 9), dor_0_10: randomBetween(i + e, 0, 5), observacao: 'Execucao registrada para aprendizado.' });
      insert(db, 'feedback_aluno', { sessao_id: sessId, nps: randomBetween(i + s, 6, 10), fadiga: randomBetween(i + s, 1, 8), satisfacao: randomBetween(i + s, 6, 10), dor: randomBetween(i + s, 0, 5), comentario: 'Treino fluido, desafio correto e bom acompanhamento.', rpe: randomBetween(i + s, 5, 9) });
    }
    if (i % 9 === 0) insert(db, 'alerta', { aluno_id: alunoId, recomendacao_id: recId, tipo: i % 18 === 0 ? 'risco_churn' : 'risco_fadiga', severidade: i % 18 === 0 ? 'alta' : 'media', origem: 'motor_aderencia', status: 'aberto', dt_geracao: daysAgo(randomBetween(i, 0, 12)), mensagem: 'Queda de frequencia detectada. Reengajamento recomendado.' });
    if (i % 37 === 0) insert(db, 'evento_adverso', { aluno_id: alunoId, sessao_id: null, tipo: 'dor_aguda', gravidade: 'moderada', descricao: 'Aluno reportou dor intensa durante exercicio.', desfecho: 'encaminhado_instrutor', dt_evento: daysAgo(randomBetween(i, 0, 60)) });
    if (i % 5 === 0) insert(db, 'payment_plan', { aluno_id: alunoId, name: pick(['Mensal Black','Trimestral Red','Anual Titan'], i), amount: pick([129.9, 299.9, 999.9], i), status: i % 20 === 0 ? 'em_atraso' : 'ativo', due_date: addDays(randomBetween(i, 1, 24)) });
    if (i % 6 === 0) insert(db, 'game_badge', { aluno_id: alunoId, badge: pick(['7 dias de furia','Primeira avaliacao','Zona 2 master','Consistency beast'], i), points: randomBetween(i, 50, 900), earned_at: daysAgo(randomBetween(i, 0, 70)) });
    if (i % 3 === 0) insert(db, 'checkin', { aluno_id: alunoId, unidade_id: pick(unidades, i), source: pick(['qr','catraca','app'], i), created_at: daysAgo(randomBetween(i, 0, 21)) });
    insert(db, 'feature_store', { aluno_id: alunoId, feature_key: 'weekly_adherence', feature_value: randomBetween(i, 20, 100) / 100, version: 'fs-2026-01', created_at: daysAgo(randomBetween(i, 0, 60)) });
  }

  for (let i = 0; i < 60; i++) {
    const t = pick(workoutThemes, i);
    insert(db, 'workout_template', { name: `${t[0]} ${Math.floor(i / workoutThemes.length) + 1}`, focus: t[1], level: t[2], duration_min: 28 + (i % 8) * 6, description: t[3], intensity: pick(['leve','moderada','alta','periodizada'], i), muscle_targets: json(pick(exerciseBases, i)[2]) });
    insert(db, 'workout_page', { slug: slugify(`${t[0]} ${i + 1}`), title: `${t[0]} ${i + 1}`, objective: t[1], level: t[2], hero_metric: `${60 + (i % 39)}% prontidao alvo`, blocks_json: json([
      { title: 'Aquecimento neural', text: '5 minutos de mobilidade e elevacao gradual de FC.' },
      { title: 'Bloco principal', text: 'Exercicios organizados por padrao de movimento, RPE e descanso.' },
      { title: 'Guardrail', text: 'Se dor acima de 6/10, reduzir carga e acionar instrutor.' }
    ]) });
  }

  for (let i = 0; i < 14; i++) {
    insert(db, 'campaign', { name: pick(['Volta pro treino','Aniversario monstro','Primeira semana WOW','Reativacao Black'], i), target_segment: pick(segmentos, i), status: i % 2 ? 'ativa' : 'rascunho', channel: pick(['whatsapp','email','push','recepcao'], i), metric: `${randomBetween(i, 8, 34)}% uplift` });
    insert(db, 'class_schedule', { unidade_id: pick(unidades, i), name: pick(['Spinning IA','HIIT Red','Mobility Lab','Upper Class','Glute Builder'], i), coach_id: pick(usuarios, i), capacity: randomBetween(i, 12, 35), enrolled: randomBetween(i, 5, 33), starts_at: addDays(i + 1) });
  }

  for (let i = 0; i < 18; i++) {
    const incId = insert(db, 'incidente_gov', { categoria: pick(['seguranca','fairness','lgpd','operacao'], i), criticidade: pick(['baixa','media','alta','critica'], i), status: i % 4 === 0 ? 'aberto' : 'resolvido', dt_abertura: daysAgo(randomBetween(i, 0, 120)), responsavel: pick(['DPO','MLOps','Gestor Unidade','Instrutor Lider'], i), descricao: 'Incidente demonstrativo com rastreabilidade, causa e acao corretiva.' });
    insert(db, 'acao_corretiva', { incidente_id: incId, tipo: 'playbook', descricao: 'Revisar regra, notificar responsavel e validar antes de reabrir modelo.', prazo: addDays(randomBetween(i, 1, 30)), status: i % 3 === 0 ? 'pendente' : 'concluida' });
  }

  for (let i = 0; i < 90; i++) insert(db, 'auditoria_acesso', { usuario_id: pick(usuarios, i), entidade: pick(['aluno','plano_treino','recomendacao_ia','consentimento_lgpd','evento_adverso'], i), id_entidade: randomBetween(i, 1, 220), acao: pick(['consultou','alterou','aprovou','exportou','bloqueou'], i), dt_evento: daysAgo(randomBetween(i, 0, 45)), ip_hash: hash(`ip-${i}`).slice(0, 18), detalhes: 'Trilha imutavel de demo.' });
}

const isDirect = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isDirect) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const dbPath = process.env.BEASTFIT_DB || path.join(__dirname, 'data', 'beastfit.sqlite');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  initializeSchema(db);
  seedDatabase(db);
  const total = db.prepare('SELECT COUNT(*) AS total FROM aluno').get().total;
  console.log(`Seed concluido: ${total} alunos em ${dbPath}`);
}
