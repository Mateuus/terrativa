# ADR 0001 — Monorepo e limites de módulos

Status: proposto  
Data: 2026-07-26

## Contexto

O produto combina cliente React/Babylon, servidor Fastify/Colyseus, painel
administrativo, engine de regras e contratos compartilhados. Sem limites claros,
regras podem vazar para UI, transporte ou persistência.

## Decisão

Usar pnpm workspaces com Turborepo. Apps compõem pacotes:

- `apps/game-client`, `apps/game-server` e `apps/admin-web`;
- `packages/game-engine`, `protocol`, `database`, `board-content`, `ui` e
  `config`.

`game-engine` é TypeScript puro e não importa frameworks, banco, navegador, rede,
relógio ou variáveis de ambiente. `protocol` contém apenas contratos, validação e
códigos, nunca regras. O acesso ao banco ocorre somente no servidor.

## Consequências

Builds e testes podem ser executados por pacote e armazenados em cache. Há algum
custo de configuração e disciplina de imports, mitigado por regras de lint e
testes de arquitetura. Código não será compartilhado apenas para evitar pequena
duplicação; um pacote precisa ter responsabilidade estável.

## Alternativas rejeitadas

- Repositórios separados: aumentam coordenação e versionamento dos contratos no
  estágio inicial.
- Aplicação única: facilita acoplamento entre UI, rede e domínio.
- Next.js: não é necessário ao cliente do jogo e conflita com a stack normativa.
