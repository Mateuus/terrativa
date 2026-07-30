# ADR 0003 — Concorrência, versão e idempotência

Status: proposto  
Data: 2026-07-26

## Contexto

WebSocket, retries e reconexões podem entregar comandos concorrentes ou
duplicados. Compras, pagamentos e trocas não podem ser aplicados duas vezes.

## Decisão

Cada `gameId` tem uma fila mutável exclusiva. O servidor:

1. autentica e valida o envelope;
2. deduplica `commandId`;
3. compara `expectedStateVersion`;
4. executa a engine;
5. persiste ações críticas;
6. instala o novo estado e incrementa a versão;
7. envia acknowledgement, patches e eventos.

Um retry conserva o mesmo `commandId`. Repetições retornam o acknowledgement
anterior a partir de um registro `GameCommand` único por
`(gameId, commandId)`. Um comando pode gerar vários `GameEvent` ligados a esse
registro. Comandos rejeitados não avançam a versão.

## Consequências

A correção é simples dentro de uma partida e a vazão escala por número de
partidas, não por comandos simultâneos da mesma partida. Uma ação lenta pode
bloquear aquela fila, portanto transações e I/O devem ser curtos e observados.
Escala multiprocesso exige que uma room pertença a um único processo e use
presence/driver compartilhados.

## Alternativas rejeitadas

- Locks distribuídos no MVP: complexidade sem necessidade em processo único.
- Last-write-wins: pode perder dinheiro e ativos.
- Confiar apenas na ordem do WebSocket: não cobre reconnect, retries e banco.
