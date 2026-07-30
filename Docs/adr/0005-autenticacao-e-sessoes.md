# ADR 0005 — Autenticação e sessões

Status: proposto  
Data: 2026-07-26

## Contexto

Web, PWA e WebSocket precisam compartilhar identidade sem expor credenciais
duradouras ao JavaScript. Refresh token roubado ou reutilizado precisa ser
revogável.

## Decisão

Senhas usam Argon2id calibrado. O servidor emite access token assinado de 10–15
minutos, mantido em memória, e refresh token opaco em cookie `HttpOnly`, `Secure`
e `SameSite`. Somente o hash com pepper é persistido.

Cada renovação rotaciona o token em transação. Reuso de token antigo revoga a
família. WebSocket valida access token e `Origin` no handshake, revalida o usuário
ao entrar e deriva `userId` da sessão. Endpoints autenticados por cookie recebem
proteção CSRF adequada.

Capacitor terá um spike antes da Fase 3 para validar cookies no WebView/native
HTTP. Se o cookie seguro não for confiável, um adapter usará Keychain/Keystore;
`localStorage` não armazenará refresh token.

## Consequências

Access token comprometido tem vida curta e sessões podem ser revogadas. Rotação
exige atomicidade e tratamento de concorrência entre abas. Desenvolvimento local
precisa suportar cookie seguro de forma deliberada sem enfraquecer produção.

## Alternativas rejeitadas

- JWT de longa duração sem revogação: aumenta impacto de roubo.
- Refresh token em `localStorage`: amplia exposição a XSS.
- Identidade fornecida no payload do comando: permite falsificação.
