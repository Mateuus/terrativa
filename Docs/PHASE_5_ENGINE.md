# Fase 5 — Engine determinística e ranking competitivo

Status: engine pura implementada; persistência e página inicial do ranking
implementadas. A `GameRoom` que transmite a partida fica na Fase 7, conforme o
roadmap.

## Engine

O pacote `@terrativa/game-engine` não depende de React, Colyseus, Prisma ou
relógio global. Toda aleatoriedade parte de uma seed explícita e todo timeout
recebe `now` pelo contexto.

Foram implementados:

- snapshot completo do board usado na partida;
- validação de conteúdo, jogadores e invariantes;
- RNG `xorshift32` e embaralhamento Fisher–Yates determinísticos;
- turnos, dois dados, movimento e bônus de passagem pelo início;
- compra, recusa, propriedade, aluguel e pagamento autoritativo;
- grupos completos e melhorias equilibradas;
- venda de melhoria, hipoteca e retirada de hipoteca;
- eventos, benefícios, movimento por carta e carta de saída da fiscalização;
- fiscalização por até três tentativas, taxa ou carta;
- dívida, liquidação, falência, transferência de ativos e último solvente;
- propostas de troca revalidadas e aplicadas sem efeito parcial;
- timeout de compra, auto-roll e encerramento automático;
- limite opcional de rodadas e vitória por patrimônio;
- state version e cache limitado de command IDs;
- colocação final, patrimônio final e motivo de término.

O estado de entrada nunca é mutado. Com a mesma seed, estado, comando e relógio,
o resultado e a lista de eventos são idênticos.

## Partidas oficiais

`Room` e `Game` agora possuem `mode`:

- `CASUAL`: sala criada pelo jogador, pública ou privada;
- `RANKED`: somente infraestrutura marcada como `OFFICIAL_QUEUE`.

A API de criação de salas personalizadas rejeita `RANKED` com
`ranking.officialQueueRequired`. Ter o código ou a senha de uma sala nunca
permite gerar rating.

A fila oficial, formação automática da partida e `GameRoom` pertencem à Fase 7.

## Fórmula de rating v1

Rating inicial: **1000**. Piso: **100**. Fator K: **32**.

Para cada participante:

1. `P`, colocação pareada: vitória contra quem terminou abaixo, 0,5 em empate e
   zero contra quem terminou acima;
2. `W`, patrimônio normalizado entre o menor e o maior patrimônio final;
3. `S`, solvência: 1 para ativo e 0 para falido;
4. desempenho observado:

```text
D = 0,65 × P + 0,25 × W + 0,10 × S
```

A expectativa `E` é a média Elo logística contra cada adversário:

```text
E(a,b) = 1 / (1 + 10 ^ ((rating_b - rating_a) / 400))
```

O delta bruto é `K × (D - E)`. A média dos deltas é removida antes do
arredondamento, preservando soma zero. Correções de arredondamento e o piso de
rating também são redistribuídos dentro da mesma partida.

Além do rating:

```text
performanceScore = round(D × 1000)
periodPoints      = round(D × 100)
```

`periodPoints` alimenta os destaques diário, semanal e mensal. O ranking da
temporada prioriza rating atual. Assim, atividade de curto prazo e habilidade
sazonal não são confundidas.

A Valve divulga que o modo Premier usa CS Rating, temporadas e leaderboards
globais/regionais, mas não publica sua fórmula completa. A Terrativa usa apenas
essa ideia de apresentação; a fórmula acima é original, pública e auditável:
<https://store.steampowered.com/app/730/CounterStrike_2/>.

## Persistência

Migrations adicionadas e aplicadas:

- `MatchMode` em `Room` e `Game`;
- `RankedSeason`;
- `PlayerRating`;
- `RankedMatchResult`;
- `RankedRatingEntry`.

Cada conclusão ranqueada grava:

- versão do cálculo;
- ratings antes e depois;
- delta;
- colocação e patrimônio;
- falência;
- performance score e pontos do período.

`gameId` é único em `RankedMatchResult`, tornando a finalização idempotente. A
atualização de todos os ratings e do ledger ocorre em uma transação Prisma.

O seed cria **Temporada 1**, ativa de julho a dezembro de 2026.

## Leaderboards

Endpoint público:

```text
GET /api/v1/rankings?period=DAY|WEEK|MONTH|SEASON
```

- dia, semana e mês: ordenam pontos do período, delta e vitórias;
- temporada: ordena rating, pontos e colocação média;
- semana começa na segunda-feira;
- os limites de calendário são UTC na v1 e aparecem explicitamente na página.

A interface oferece as quatro visões, rating, pontos, delta, partidas, vitórias,
falências e colocação média.

## Validação

Os testes da engine incluem determinismo, compra, aluguel, equilíbrio de
melhorias, hipoteca, cartas, fiscalização, versionamento, duplicidade, dívida,
falência, trocas, timeout, simulação completa e rating multiplayer zero-sum.

Nenhum valor financeiro real é utilizado.
