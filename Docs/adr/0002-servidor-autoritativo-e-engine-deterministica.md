# ADR 0002 — Servidor autoritativo e engine determinística

Status: aceito pela especificação  
Data: 2026-07-26

## Contexto

O cliente é controlado pelo usuário e pode ser modificado, repetir mensagens ou
forjar resultados. Regras misturadas a rooms e renderização seriam difíceis de
testar e recuperar.

## Decisão

O cliente envia somente intenções. O servidor resolve identidade, fase, turno,
dados, movimento, saldo, aluguel, ativos, cartas e vitória. Todas as mutações de
jogo passam por uma função pura:

`execute(state, command, context) -> result`.

Relógio e RNG entram explicitamente no contexto. A seed é criada no servidor,
persistida de forma protegida e não é revelada durante a partida. A engine
retorna próximo estado e eventos, mas não faz I/O.

## Consequências

Partidas podem ser simuladas, reproduzidas e verificadas sem UI ou rede. O
servidor carrega o custo de toda validação. Animações podem divergir
temporariamente, mas sempre convergem ao estado oficial. Mudanças em regras
exigem testes determinísticos e versionamento de conteúdo.

## Alternativas rejeitadas

- Cálculo otimista oficial no cliente: permite fraude e divergência.
- Regras dentro de handlers Colyseus: acopla domínio, transporte e ciclo de vida.
- RNG global (`Math.random`): impede replay e testes reproduzíveis.
