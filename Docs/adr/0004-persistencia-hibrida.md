# ADR 0004 — Persistência híbrida com snapshots e eventos

Status: proposto  
Data: 2026-07-26

## Contexto

Manter toda mutação somente em memória perde partidas após reinício. Event sourcing
completo desde o início aumenta muito o custo de evolução de schema e replay.

## Decisão

No MVP, o estado ativo vive na `GameRoom`. MySQL persiste:

- snapshot inicial, fim de turno, desconexões relevantes, ações críticas e final;
- recibo/acknowledgement de cada comando mutável aceito;
- eventos necessários para auditoria e recuperação;
- resultado e estatísticas.

Snapshots são JSON canônico, imutáveis, versionados e protegidos por checksum
SHA-256. Recuperação carrega o maior snapshot consistente e reaplica eventos
posteriores compatíveis. Conteúdo do board é referenciado por versão imutável.

## Consequências

O caminho comum permanece rápido e a recuperação é possível. Snapshot e evento
precisam de versionamento/migrations de payload. A estratégia não promete replay
histórico perpétuo no MVP; replay completo é pós-MVP.

## Alternativas rejeitadas

- Apenas memória: não atende recuperação.
- Snapshot a cada patch: I/O excessivo para pouco benefício.
- Event sourcing integral: aumenta escopo e exige estabilidade prematura dos
  eventos.
