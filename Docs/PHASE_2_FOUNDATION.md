# Fase 2 — Fundação do monorepo

Status: implementada e validada localmente; inspeção visual manual pendente.

## Entregas

- workspace pnpm com Turborepo;
- cliente React/Vite/Tailwind com bootstrap Babylon.js;
- servidor Fastify e Colyseus na mesma porta;
- pacotes compartilhados de protocolo, engine, conteúdo, configuração, UI e banco;
- schema Prisma/MySQL e migração inicial;
- suporte a banco e Redis locais por variáveis discretas no `.env`;
- Docker Compose opcional para serviços descartáveis;
- Biome, TypeScript, Vitest, build e GitHub Actions;
- cena procedural low-poly inicial, sem ativos de terceiros incorporados.

## Verificação

- `GET /health`: HTTP 200;
- `GET /ready`: HTTP 200;
- `GET /__healthcheck`: HTTP 200;
- criação da sala `lobby` pelo matchmaking: HTTP 200;
- schema Prisma válido;
- typecheck, lint, testes e build executados no workspace;
- cliente Vite responde HTTP 200 e entrega o ponto de montagem React.

A captura visual automatizada ficou pendente porque não havia uma janela do
navegador integrado disponível na sessão. Abra `http://localhost:5173` para a
conferência manual da cena Babylon.

Nenhuma migração é executada automaticamente no banco local existente. O comando
`corepack pnpm db:migrate` deve ser usado apenas quando a equipe decidir aplicar o
schema inicial nesse ambiente.

## Próximo marco

A Fase 3 introduz conta, autenticação, rotação de refresh token, guards e testes
de abuso. Os modelos CC0 selecionados entram gradualmente a partir das fases de
conteúdo e tabuleiro 3D, mantendo um registro de origem e licença.
