# BeastFit AI Revolution

Sistema demonstrativo de rede de academias feito em React, Node 24.14.0 e SQLite nativo (`node:sqlite`). O projeto implementa os principais pontos do documento: multiunidade, cadastro de alunos, consentimento LGPD, triagem PAR-Q, avaliacao fisica, catalogo de exercicios, recomendacao de treino por IA, revisao humana, XAI, guardrails, kill-switch, retencao, fairness, auditoria, MLOps e paineis executivos.

## O que vem pronto

- Backend Node sem Express, usando HTTP nativo e SQLite nativo.
- Frontend React/Vite com tema vermelho e preto, responsivo e visual.
- Mais de 50 paginas no app; atualmente sao 61 rotas principais, alem de telas dinamicas de aluno, exercicio, treino e recomendacao.
- Banco seedado com mais de 200 alunos, 8 unidades, 96 exercicios, planos, sessoes, feedbacks, wearables, alertas, incidentes, pagamentos e badges.
- 80 casos de uso cadastrados, incluindo os 25 do documento e expansoes praticas.
- 35 regras de negocio cadastradas, incluindo consentimento, triagem, human-in-the-loop, guardrails, kill-switch, fallback, fairness e auditoria.
- 100 conectores de API gratuitos/opcionais com fallback local seguro para demo. Por padrao, o app nao depende de terceiros para nao quebrar por limite, CORS, token ou indisponibilidade.
- Animacoes de exercicio em SVG/CSS simulando GIF muscular com areas vermelhas pulsantes.
- Gerador de recomendacao com scores, explicabilidade e workflow de aprovacao humana.

## Requisitos

- Node.js 24.14.0 ou superior.
- npm.

O projeto foi desenhado para Node 24 porque usa `node:sqlite`. Em versoes antigas do Node, esse modulo pode aparecer como experimental ou indisponivel.

## Como rodar

```bash
npm install
npm run seed
npm run dev
```

Depois abra:

```text
http://localhost:5173
```

A API sobe em:

```text
http://localhost:8080/api/health
```

## Rodar em modo producao

```bash
npm install
npm run seed
npm run build
npm start
```

Depois abra:

```text
http://localhost:8080
```

## Resetar dados

```bash
RESET_DB=true npm run seed
```

## Teste rapido

Em um terminal:

```bash
npm start
```

Em outro:

```bash
npm run smoke
```

## APIs externas

Por padrao, os 100 conectores usam fallback local. Isso deixa o sistema estavel, gratuito para demonstracao e sem necessidade de chaves. Para tentar chamadas externas em endpoints publicos:

```bash
ENABLE_EXTERNAL_APIS=true npm start
```

Antes de colocar em producao, revise termos, limites, autenticao e politicas de cada API de terceiro.

## Principais rotas da API

- `GET /api/summary`
- `GET /api/students`
- `POST /api/students`
- `GET /api/students/:id`
- `GET /api/exercises`
- `GET /api/workout-pages`
- `POST /api/recommendations/generate`
- `POST /api/recommendations/:id/review`
- `POST /api/kill-switch`
- `GET /api/fairness`
- `GET /api/data-dictionary`
- `GET /api/integrations`
- `GET /api/reports/executive`

## Estrutura

```text
client/               Frontend React e CSS
server/               API Node, schema SQLite, seed e motor IA simulado
scripts/              Dev runner e smoke test
server/data/          Banco SQLite gerado localmente
```

## Observacoes importantes

Este projeto e uma base educacional/prototipo funcional. As recomendacoes de treino, scores de risco e regras clinicas sao demonstrativos. Em uso real, toda prescricao deve ser validada por profissional habilitado, com revisao juridica de LGPD, revisao de seguranca, validacao cientifica e governanca operacional.
