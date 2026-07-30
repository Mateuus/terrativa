# Fase 3 — Conta e segurança

Status: implementada e validada em banco descartável.

## Marca aplicada

O nome oficial do produto passou a ser **Terrativa**. O primeiro modo é
**Terrativa: Baixada Santista**, com o slogan **Explore, negocie e desenvolva.**
Namespaces internos usam `@terrativa/*`.

A disponibilidade jurídica do nome, domínios e perfis sociais continua pendente
de pesquisa própria e avaliação conforme `TERRATIVA_BRAND.md`.

## Fluxos entregues

- `POST /api/v1/auth/register`;
- `POST /api/v1/auth/login`;
- `POST /api/v1/auth/refresh`;
- `POST /api/v1/auth/logout`;
- `GET /api/v1/me`;
- `PATCH /api/v1/me`;
- autenticação estática do matchmaking Colyseus antes da reserva.

## Controles de segurança

- senha com Argon2id (`m=19456`, `t=2`, `p=1`);
- access token HS256 com emissor/audiência, `jti`, sessão e expiração máxima de
  15 minutos;
- refresh token opaco de 256 bits, armazenado somente como HMAC-SHA-256;
- rotação transacional e revogação de toda a família quando um token consumido
  reaparece;
- refresh em cookie `HttpOnly`, `Secure` em staging/produção e `SameSite=Strict`;
- proteção double-submit CSRF em refresh e logout;
- access token mantido somente em memória no cliente;
- mensagem genérica de login para não revelar existência de e-mail;
- limite por rota e bloqueio progressivo por combinação normalizada de conta/IP;
- fingerprints de IP e user-agent armazenadas somente como HMAC;
- validação Zod estrita e resposta de erro sem stack ou detalhes sensíveis;
- conta suspensa/excluída rejeitada também durante autenticação do access token.
- handshake WebSocket restrito ao `APP_ORIGIN` configurado.

## Validação

Os testes cobrem contratos, Argon2id, assinatura adulterada, cadastro, conflito,
login inválido, bloqueio progressivo, guard, perfil, logout, rotação e reuso de
refresh token, CSRF e integração Fastify/Colyseus.

Em MySQL 8 descartável:

- migração inicial aplicada;
- cadastro retornou HTTP 201;
- perfil autenticado retornou HTTP 200;
- refresh retornou HTTP 200 e novo access token;
- cookie de refresh confirmou a flag `HttpOnly`.

Nenhuma migração ou escrita foi executada no banco local fornecido pela equipe.

## Decisões adiadas

- verificação e recuperação por e-mail dependem da escolha de provedor;
- conta é ativada imediatamente no MVP e mantém `emailVerifiedAt` nulo;
- coleta de dados de menores, modo escolar e consentimento exigem avaliação
  jurídica e política de privacidade antes de implementação.
