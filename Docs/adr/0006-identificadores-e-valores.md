# ADR 0006 — Identificadores e representação de valores

Status: proposto  
Data: 2026-07-26

## Contexto

IDs precisam funcionar antes e durante transações e aparecer com clareza em logs.
MySQL permite UUID em texto ou binário. Créditos fictícios não podem sofrer erro
de ponto flutuante.

## Decisão

No MVP, entidades persistidas usam UUID gerado pela aplicação e armazenado como
`CHAR(36)` com charset ASCII/collation binária. `commandId` segue o mesmo formato
de UUID validado pelo protocolo. Códigos de sala são valores separados, curtos,
aleatórios, normalizados e não sequenciais.

Créditos, preços, aluguéis e patrimônio usam inteiros dentro do intervalo seguro
definido pelo domínio. Datas persistem em UTC com precisão de milissegundos.

## Consequências

IDs são legíveis, fáceis de mapear no Prisma e conhecidos antes da transação. O
armazenamento e os índices ocupam mais espaço que `BINARY(16)`, aceitável no MVP.
Se volume justificar mudança, será necessário novo ADR e migration explícita.
Validações impedem overflow e valores negativos inválidos.

## Alternativas rejeitadas

- UUID `BINARY(16)` agora: economiza espaço, mas adiciona conversões e atrito
  operacional cedo.
- IDs sequenciais expostos: facilitam enumeração.
- Valores em `float`/`double`: introduzem arredondamento indevido.
