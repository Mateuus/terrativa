# Terrativa — sistema de gestão contínua e jogo sem espera

## 1. Objetivo

Este documento redefine o núcleo de Terrativa para que o jogador não fique parado enquanto aguarda o próximo turno.

Terrativa deixa de ser apenas um jogo de andar pelo tabuleiro, comprar propriedades e cobrar aluguel. O jogo passa a combinar:

- exploração do mapa;
- aquisição de empreendimentos;
- administração de edifícios;
- manutenção preventiva;
- pedidos de obra;
- contratação de equipes;
- entrega de materiais;
- melhorias com tempo de execução;
- contratos regionais;
- análise de oportunidades;
- negociação entre jogadores;
- decisões simultâneas.

O turno principal continua existindo para manter o ritmo coletivo. Entretanto, todos os jogadores podem administrar seus empreendimentos enquanto outra pessoa executa o turno.

## 2. Nova definição do jogo

> Terrativa é um jogo multiplayer de estratégia e gestão regional no qual os jogadores exploram cidades, adquirem empreendimentos fictícios, administram equipes, realizam manutenções, atendem contratos e desenvolvem seus territórios em tempo real, mesmo enquanto aguardam o próximo turno principal.

## 3. Problema que estamos resolvendo

Em um jogo tradicional de turnos, quanto maior o número de participantes, maior o tempo entre as jogadas.

Se cada turno durar 60 segundos:

| Jogadores | Pessoas jogando antes da sua próxima vez | Espera máxima aproximada |
| ---: | ---: | ---: |
| 2 | 1 | 1 minuto |
| 3 | 2 | 2 minutos |
| 4 | 3 | 3 minutos |
| 5 | 4 | 4 minutos |
| 6 | 5 | 5 minutos |

Se cada turno durar 45 segundos:

| Jogadores | Espera aproximada |
| ---: | ---: |
| 2 | 45 segundos |
| 3 | 1 minuto e 30 segundos |
| 4 | 2 minutos e 15 segundos |
| 5 | 3 minutos |
| 6 | 3 minutos e 45 segundos |

Esses valores são limites teóricos baseados em todos os jogadores usando o tempo inteiro. Animações, negociações e decisões adicionais podem aumentar o intervalo.

### Recomendação

- Quantidade suportada: **2 a 6 jogadores**.
- Melhor experiência estratégica: **3 ou 4 jogadores**.
- Com 5 ou 6 jogadores: usar turnos principais mais curtos e gestão paralela.
- Tempo-alvo do turno principal: **30 a 45 segundos**.
- Decisões complexas devem ser preparadas fora do turno.

## 4. Referências de design

O projeto não copiará regras ou conteúdos de terceiros. Os exemplos abaixo servem apenas para validar princípios de design.

### Ações simultâneas

`Between Two Cities`, da Stonemaier Games, permite que cada participante construa simultaneamente com jogadores vizinhos. Isso demonstra que decisões paralelas podem manter todos envolvidos.

Referência:

https://stonemaiergames.com/games/between-two-cities/

### Decisões simultâneas com tempo

O diário de desenvolvimento de `Pendulum` descreve colocação simultânea de trabalhadores e liberdade para ajustar decisões durante a execução. A inspiração relevante para Terrativa é permitir planejamento paralelo sem retirar o estado autoritativo do servidor.

Referência:

https://stonemaiergames.com/games/pendulum/design-diary-pendulum/

### Salas e estado autoritativo

Colyseus oferece salas, sincronização de estado e reconexão. Terrativa usará esse modelo para manter a gestão paralela sob controle do servidor.

Referências:

- https://docs.colyseus.io/
- https://docs.colyseus.io/room

## 5. Princípio central: dois ritmos de jogo

Terrativa terá duas camadas funcionando juntas.

### Camada A — Turno de exploração

Somente o jogador atual pode:

- solicitar os dados;
- movimentar seu peão;
- resolver a casa;
- adquirir oportunidade liberada;
- responder à decisão obrigatória da casa;
- escolher uma ação especial do turno.

### Camada B — Central de gestão

Todos os jogadores ativos podem, simultaneamente:

- consultar seus empreendimentos;
- analisar alertas;
- aprovar manutenção;
- organizar equipes;
- solicitar orçamentos;
- preparar pedidos de obra;
- colocar upgrades na fila;
- responder contratos;
- revisar previsão de custos;
- preparar negociações;
- consultar o mapa;
- acompanhar obras em andamento.

## 6. Regra de justiça

A gestão paralela não poderá alterar instantaneamente o resultado do turno que já está sendo resolvido.

Exemplo:

1. Jogador A está se movimentando.
2. Jogador B inicia um upgrade no prédio onde A poderá cair.
3. O upgrade não pode aumentar o aluguel antes da resolução do movimento de A.
4. A obra fica como `AGENDADA` ou `EM_EXECUÇÃO`.
5. O benefício só é ativado em uma fronteira segura.

### Fronteira segura recomendada

Um upgrade concluído entra em vigor:

- no início do próximo turno do proprietário; ou
- no início da próxima rodada global;

conforme a regra escolhida para a partida.

Para o MVP, utilizar:

> **Toda obra concluída é ativada no início do próximo turno do proprietário.**

Isso torna o sistema previsível e impede mudanças surpresa durante a resolução de outro jogador.

## 7. Central de gestão

A Central de Gestão é a tela que mantém o jogador ocupado fora do turno principal.

Áreas:

```text
Visão Geral
Empreendimentos
Manutenções
Obras
Equipes
Materiais
Contratos
Negociações
Relatórios
```

### Visão Geral

Exibe:

- saldo disponível;
- saldo reservado;
- saúde média dos prédios;
- obras em andamento;
- entregas previstas;
- equipes livres;
- contratos próximos do prazo;
- alertas importantes;
- previsão de receita e despesa.

## 8. Empreendimentos

Cada propriedade comprada passa a ser um empreendimento administrável.

Dados:

```text
Nome
Cidade
Categoria
Nível
Condição
Eficiência
Atratividade
Capacidade
Receita-base fictícia
Custo operacional
Manutenção prevista
Equipe associada
Obra atual
Materiais armazenados
Alertas
```

Categorias sugeridas:

- residencial;
- comercial;
- cultural;
- turístico;
- logístico;
- serviços;
- mobilidade;
- tecnologia;
- ambiental.

As categorias devem gerar estratégias diferentes sem representar preços reais.

## 9. Condição do edifício

Todo empreendimento possui uma condição de 0 a 100.

Faixas:

| Condição | Estado | Efeito sugerido |
| ---: | --- | --- |
| 90–100 | Excelente | funcionamento total |
| 70–89 | Boa | funcionamento normal |
| 50–69 | Atenção | pequena perda de eficiência |
| 30–49 | Crítica | custo maior e benefício reduzido |
| 0–29 | Interditada | sem benefício até reparo |

### Princípio de acessibilidade

O sistema não deve exigir manutenção constante em todos os prédios. Isso causaria trabalho repetitivo e prejudicaria jogadores iniciantes.

Utilizar:

- degradação lenta;
- alertas antecipados;
- manutenção automática opcional;
- ações em lote;
- no máximo poucos problemas relevantes por rodada.

## 10. Tipos de manutenção

### Preventiva

- programada antes de ocorrer falha;
- custo menor;
- duração curta;
- preserva eficiência;
- pode ser agendada fora do turno.

### Corretiva

- resolve problema existente;
- custo maior;
- pode exigir material;
- reduz temporariamente o benefício.

### Emergencial

- usada em condição crítica;
- custo elevado;
- execução rápida;
- limitada para não virar solução padrão.

### Sustentável

- melhora eficiência;
- reduz custos futuros;
- pode gerar benefício educacional;
- exemplos fictícios: iluminação eficiente, reuso de água e gestão de resíduos.

## 11. Alertas e pedidos

O jogador recebe uma Caixa de Operações.

Tipos:

- `MAINTENANCE_DUE`
- `MATERIAL_REQUIRED`
- `TEAM_AVAILABLE`
- `TEAM_DELAYED`
- `WORK_ORDER_READY`
- `CONTRACT_AVAILABLE`
- `CONTRACT_EXPIRING`
- `INSPECTION_REQUIRED`
- `UPGRADE_COMPLETED`
- `UPGRADE_ACTIVATED`
- `BUDGET_WARNING`
- `TRADE_RECEIVED`

Cada alerta deve responder:

- o que aconteceu;
- qual empreendimento foi afetado;
- qual o prazo;
- qual o custo;
- quais alternativas existem;
- o que acontece se o jogador ignorar.

## 12. Pedido de obra

Uma melhoria não acontece por um simples clique.

Fluxo:

```text
Identificar oportunidade
→ escolher projeto
→ analisar requisitos
→ solicitar orçamento
→ selecionar equipe
→ reservar recursos
→ pedir materiais
→ aguardar entrega
→ iniciar obra
→ acompanhar progresso
→ concluir
→ aguardar ativação segura
→ receber benefício
```

## 13. Estados da obra

```text
DRAFT
QUOTING
WAITING_APPROVAL
WAITING_MATERIALS
READY_TO_START
QUEUED
IN_PROGRESS
PAUSED
COMPLETED_PENDING_ACTIVATION
ACTIVE
CANCELLED
```

### Regras

- `DRAFT`: jogador ainda pode editar.
- `QUOTING`: servidor prepara opções.
- `WAITING_APPROVAL`: aguarda confirmação.
- `WAITING_MATERIALS`: pedido confirmado, material em trânsito.
- `READY_TO_START`: requisitos completos.
- `QUEUED`: aguarda equipe ou vaga.
- `IN_PROGRESS`: consome tempo de obra.
- `PAUSED`: evento válido interrompeu.
- `COMPLETED_PENDING_ACTIVATION`: visualmente pronta, efeito ainda bloqueado.
- `ACTIVE`: efeito aplicado na fronteira segura.
- `CANCELLED`: encerrada conforme política de reembolso.

## 14. Tempo de entrega e construção

Não usar cronômetros de horas ou dias no MVP. Isso faria o jogador sair da partida e aproximaria o jogo de mecânicas manipulativas de espera.

Utilizar tempo interno da partida:

- segundos ativos;
- quantidade de turnos;
- quantidade de rodadas;
- pontos de trabalho da equipe.

### Modelo recomendado

Cada obra exige `workPoints`.

Exemplo:

```text
Melhoria pequena: 20 pontos
Melhoria média: 40 pontos
Melhoria grande: 70 pontos
```

Cada equipe produz pontos por rodada:

```text
Equipe básica: 10
Equipe especializada: 15
Equipe avançada: 20
```

Exemplo:

- obra exige 40 pontos;
- equipe produz 10 por rodada;
- duração: quatro rodadas;
- bônus de planejamento pode reduzir para três;
- nunca concluir antes da fronteira segura.

## 15. Pedidos de materiais

Materiais são recursos internos abstratos, sem simular compra real.

Categorias:

- estrutura;
- acabamento;
- tecnologia;
- eficiência;
- acessibilidade;
- paisagismo.

Um pedido contém:

```text
Material
Quantidade
Custo fictício
Fornecedor fictício
Prazo em turnos
Confiabilidade
Bônus
Risco conhecido
```

### Opções de fornecedor

O jogador poderá escolher:

- entrega rápida e custo maior;
- entrega normal e custo equilibrado;
- entrega econômica e prazo maior;
- fornecedor regional com bônus temático.

Não usar caixas aleatórias pagas, sorteio monetizado ou compra com dinheiro real.

## 16. Equipes

O jogador começa com uma equipe básica e pode desbloquear especializações.

Papéis:

- manutenção;
- construção;
- planejamento;
- sustentabilidade;
- logística;
- atendimento;

Cada equipe possui:

```text
Velocidade
Especialidade
Disponibilidade
Moral simplificada
Custo operacional
Projeto atual
```

Evitar transformar trabalhadores em números descartáveis. O tom deve valorizar organização, capacitação e boas condições de trabalho.

## 17. Upgrades

Cada empreendimento poderá receber uma árvore curta.

### Eixos

#### Estrutura

- aumenta nível e capacidade;
- libera novos espaços;
- exige mais manutenção.

#### Eficiência

- reduz custo operacional;
- diminui degradação;
- aumenta estabilidade.

#### Atratividade

- melhora benefícios e contratos;
- amplia valor estratégico;
- pode exigir eventos ou recursos.

#### Sustentabilidade

- reduz consumo fictício;
- melhora reputação;
- desbloqueia contratos educacionais.

#### Acessibilidade

- melhora inclusão;
- gera reputação;
- pode atender contratos institucionais.

### Limite

Para evitar excesso:

- no máximo quatro níveis principais;
- duas especializações por prédio;
- escolhas com vantagens diferentes;
- sem árvore infinita.

## 18. Fila de obras

Cada jogador tem:

- uma obra ativa no começo;
- até três projetos planejados;
- segunda equipe desbloqueável durante a partida;
- fila reorganizável enquanto projetos ainda não começaram.

### Saldo

Separar:

- `availableBalance`;
- `reservedBalance`;

Ao aprovar obra:

- parte ou todo o custo fica reservado;
- jogador vê claramente o comprometimento;
- não pode gastar o mesmo saldo duas vezes;
- cancelamento segue regra transparente.

## 19. Contratos regionais

Contratos são objetivos curtos que aparecem durante a espera.

Exemplos:

- realizar manutenção preventiva em dois empreendimentos;
- concluir melhoria de acessibilidade;
- melhorar eficiência de um prédio;
- atender demanda cultural;
- preparar empreendimento turístico;
- conectar dois ativos do mesmo município;
- manter condição média acima de determinado valor.

Recompensas:

- créditos fictícios;
- reputação;
- desconto de obra;
- entrega acelerada;
- ponto educacional;
- benefício temporário claramente informado.

## 20. Sistema de reputação

Reputação representa qualidade de gestão.

Fontes positivas:

- manutenção preventiva;
- contratos concluídos;
- eficiência;
- acessibilidade;
- sustentabilidade;
- negociações cumpridas.

Fontes negativas:

- abandono prolongado;
- contrato aceito e ignorado;
- condição crítica frequente.

Reputação não deve criar efeito de “quem está ganhando ganha ainda mais”. Os bônus precisam ser pequenos e principalmente ampliar opções.

## 21. Análises disponíveis

Durante a espera, o jogador poderá analisar:

- fluxo de caixa;
- custo das próximas rodadas;
- condição dos imóveis;
- retorno estimado de melhoria;
- prazo de entrega;
- uso das equipes;
- concentração regional;
- contratos disponíveis;
- risco de manutenção;
- histórico de gastos;
- comparação entre projetos.

### Educação

Cada análise pode explicar conceitos:

- custo fixo;
- custo variável;
- reserva;
- manutenção preventiva;
- prazo;
- prioridade;
- custo de oportunidade.

Evitar sugerir que resultados do jogo representam investimentos reais.

## 22. Preparação antecipada

O jogador poderá preparar sua próxima jogada sem executá-la.

Exemplos:

- marcar propriedade de interesse;
- preparar uma negociação;
- montar projeto de obra;
- selecionar equipe;
- comparar fornecedores;
- definir ação preferida caso determinada situação aconteça.

Quando chegar o turno, o sistema apresenta:

> “Seu planejamento está pronto. Confirmar, revisar ou cancelar?”

Isso reduz a duração do turno principal.

## 23. Ações permitidas fora do turno

Permitidas:

- consultar;
- planejar;
- solicitar orçamento;
- reservar obra;
- fazer manutenção;
- administrar equipes;
- organizar fila;
- responder contrato;
- criar proposta;
- conversar;

Condicionais:

- iniciar obra;
- cancelar obra;
- aceitar negociação;
- vender ativo;

Proibidas:

- lançar dados;
- mover peão;
- comprar a propriedade que outro jogador está resolvendo;
- alterar aluguel durante resolução;
- executar ação especial do turno;
- declarar resultado do evento;
- alterar recursos de outro jogador.

## 24. Eventos que exigem atenção

Nem tudo deve acontecer silenciosamente.

Eventos importantes exibem notificação:

- material chegou;
- orçamento expirará;
- obra está pronta;
- contrato recebido;
- manutenção ficou crítica;
- negociação chegou;
- seu turno começará em breve.

### Aviso de turno

- alerta quando faltarem dois jogadores;
- alerta quando faltar um jogador;
- contagem de cinco segundos;
- ao começar, a Central de Gestão recolhe parcialmente;
- nenhuma obra em edição é perdida.

## 25. Interface

### Desktop

```text
┌─────────────────────────────────────────────────────────┐
│ Barra: turno | tempo | saldo | obras | alertas          │
├────────────────────────────────┬────────────────────────┤
│                                │ Central de Gestão      │
│         Tabuleiro 3D           │ - empreendimento       │
│                                │ - manutenção           │
│                                │ - obra                 │
│                                │ - contratos            │
├────────────────────────────────┴────────────────────────┤
│ Eventos recentes | chat | próxima jogada               │
└─────────────────────────────────────────────────────────┘
```

### Mobile

- tabuleiro na área principal;
- painel inferior arrastável;
- abas curtas;
- alertas agrupados;
- botão “Meu turno” retorna imediatamente;
- ações importantes acessíveis com uma mão;
- não exigir precisão pequena de toque.

## 26. Modo foco

O jogador escolhe:

- `AUTO_OPEN`: Central abre na espera.
- `COMPACT`: apenas alertas.
- `BOARD_WATCH`: acompanha o tabuleiro.

Mesmo administrando, ele deve continuar vendo:

- movimento atual;
- pagamentos relevantes;
- negociações;
- mudança de proprietário;
- início do próprio turno.

## 27. Máquina de estados paralela

Estado do jogo:

```text
WAITING
TURN_START
ROLLING
MOVING
RESOLVING_TILE
WAITING_DECISION
TURN_END
GAME_END
```

Estado de gestão do jogador:

```text
MANAGEMENT_AVAILABLE
MANAGEMENT_RESTRICTED
MANAGEMENT_SYNCING
MANAGEMENT_LOCKED
```

Estado de obra:

```text
DRAFT
QUOTING
WAITING_APPROVAL
WAITING_MATERIALS
READY_TO_START
QUEUED
IN_PROGRESS
PAUSED
COMPLETED_PENDING_ACTIVATION
ACTIVE
CANCELLED
```

As três máquinas se relacionam, mas não devem ser uma única sequência gigante.

## 28. Servidor autoritativo

O cliente envia apenas intenções:

```text
REQUEST_QUOTE
APPROVE_WORK_ORDER
ORDER_MATERIALS
ASSIGN_TEAM
START_WORK_ORDER
PAUSE_WORK_ORDER
RESUME_WORK_ORDER
CANCEL_WORK_ORDER
REORDER_QUEUE
SCHEDULE_MAINTENANCE
ACCEPT_CONTRACT
CLAIM_CONTRACT
PREPARE_TURN_ACTION
```

O servidor valida:

- proprietário;
- saldo;
- saldo reservado;
- requisitos;
- equipe;
- fase;
- limite de fila;
- versão do estado;
- comando duplicado;
- fronteira de ativação.

## 29. Eventos de rede

```text
WORK_ORDER_CREATED
QUOTE_READY
MATERIAL_ORDERED
MATERIAL_DELIVERED
TEAM_ASSIGNED
WORK_STARTED
WORK_PROGRESS_CHANGED
WORK_PAUSED
WORK_COMPLETED
WORK_ACTIVATED
MAINTENANCE_WARNING
MAINTENANCE_COMPLETED
CONTRACT_AVAILABLE
CONTRACT_ACCEPTED
CONTRACT_COMPLETED
CONTRACT_EXPIRED
MANAGEMENT_STATE_SYNCED
```

## 30. Modelo de dados

### `PropertyInstance`

```text
id
gameId
propertyDefinitionId
ownerPlayerId
level
condition
efficiency
attractiveness
operatingCost
maintenanceDueAtRound
status
version
```

### `WorkOrder`

```text
id
gameId
playerId
propertyInstanceId
upgradeDefinitionId
status
requiredWorkPoints
completedWorkPoints
reservedCost
activationPolicy
createdAtVersion
completedAtVersion
activatedAtVersion
```

### `MaterialOrder`

```text
id
workOrderId
supplierDefinitionId
itemsJson
cost
orderedAtRound
deliveryAtRound
status
```

### `TeamInstance`

```text
id
gameId
playerId
teamDefinitionId
specialization
workPointsPerRound
status
assignedWorkOrderId
```

### `RegionalContract`

```text
id
gameId
definitionId
playerId
status
acceptedAtRound
expiresAtRound
progressJson
rewardJson
```

## 31. Processamento do progresso

Para o MVP, o progresso ocorre no fim de cada turno global.

Fluxo:

1. turno termina;
2. servidor incrementa contador global;
3. entrega pedidos com prazo alcançado;
4. libera obras prontas;
5. equipes aplicam pontos de trabalho;
6. conclui obras;
7. marca como pendente de ativação;
8. atualiza contratos;
9. gera alertas;
10. cria snapshot quando necessário.

Não usar o relógio do cliente.

## 32. Ativação de upgrade

Algoritmo:

```text
se obra não está concluída:
  não ativar

se política é NEXT_OWNER_TURN:
  ativar no início do próximo turno do proprietário

se política é NEXT_ROUND:
  ativar no início da próxima rodada

após ativar:
  atualizar propriedade
  incrementar versão
  publicar evento
```

O valor utilizado numa cobrança é capturado quando a casa começa a ser resolvida. Mesmo que uma obra seja ativada logo depois, aquela cobrança não muda.

## 33. Balanceamento contra excesso de tarefas

Limites iniciais:

- máximo de três alertas críticos simultâneos;
- uma obra ativa por equipe;
- três projetos na fila;
- um contrato principal e dois opcionais;
- condição cai lentamente;
- manutenção em lote após três propriedades;
- automação básica disponível para todos.

Objetivo:

> Dar ao jogador algo útil para fazer, sem obrigá-lo a clicar o tempo inteiro.

## 34. Proteção para jogadores iniciantes

- botão “Recomendado” explica a sugestão;
- nenhuma decisão automática irreversível;
- confirmação para gasto alto;
- comparação simples;
- manutenção automática opcional;
- tutorial por etapas;
- modo família com menos sistemas;
- erros não destroem toda a partida.

## 35. Modos de complexidade

### Família

- manutenção simplificada;
- materiais automáticos;
- uma equipe;
- upgrades diretos com prazo;
- menos contratos;

### Estratégico

- equipes;
- fornecedores;
- condição;
- contratos;
- filas;
- especializações.

### Escolar

- partidas curtas;
- conceitos explicados;
- relatórios;
- sem mecânicas excessivamente punitivas;
- controles de sala para educador;
- chat controlável.

## 36. Economia

Separar:

- saldo disponível;
- saldo reservado;
- receita;
- custo operacional;
- custo de manutenção;
- custo de obra;
- patrimônio fictício;
- reputação.

Não recompensar somente a expansão. Um jogador com poucos empreendimentos bem administrados deve conseguir competir com outro que comprou muitos e os abandonou.

## 37. Condição de vitória revisada

Evitar depender exclusivamente de eliminar jogadores.

Modo recomendado:

### Desenvolvimento Regional

A partida termina após quantidade configurada de rodadas.

Pontuação:

- patrimônio fictício;
- condição dos empreendimentos;
- contratos;
- reputação;
- eficiência;
- desenvolvimento regional;
- reservas;

Isso é mais adequado para famílias e escolas do que esperar todos falirem.

### Último Gestor

Modo competitivo opcional baseado em solvência.

### Objetivo de Prosperidade

Primeiro a alcançar uma meta equilibrada de patrimônio, reputação e desenvolvimento.

## 38. Duração recomendada

| Modo | Jogadores | Rodadas | Duração-alvo |
| --- | ---: | ---: | ---: |
| Rápido | 2–4 | 8 | 25–35 min |
| Família | 2–5 | 10 | 40–60 min |
| Estratégico | 3–5 | 12 | 60–90 min |
| Grupo | 5–6 | 8 | 45–60 min |
| Escolar | 2–6 | 6 | 25–40 min |

Esses números precisam ser medidos em playtests.

## 39. Métricas de playtest

Registrar sem invadir privacidade:

- duração média do turno;
- tempo entre turnos;
- tempo usando Central de Gestão;
- quantidade de alertas ignorados;
- obras iniciadas e concluídas;
- contratos aceitos;
- frequência de manutenção;
- comandos desfeitos;
- desconexões;
- momento de abandono;
- diferença entre líderes;
- quantidade de cliques por minuto.

Indicadores:

- jogador ficou sem ação útil por mais de 30 segundos;
- Central virou trabalho repetitivo;
- turno começou enquanto jogador estava preso em modal;
- jogadores não entendem quando upgrade ativa;
- líder recebe vantagem crescente demais.

## 40. Casos de teste

### Obra durante movimento de outro jogador

- B inicia obra;
- A inicia movimento;
- obra de B conclui;
- A cai no empreendimento;
- usar valor capturado antes da ativação;
- obra ativa somente na fronteira definida.

### Comando duplicado

- cliente envia `APPROVE_WORK_ORDER` duas vezes;
- reservar custo uma vez;
- retornar acknowledgement original.

### Reconexão

- jogador possui obra em andamento;
- desconecta;
- progresso continua conforme regra;
- reconecta;
- recebe estado atual e alertas;
- nenhuma obra duplicada.

### Saldo concorrente

- jogador tenta aprovar duas obras com o mesmo saldo;
- fila serializa comandos;
- primeira reserva;
- segunda falha por saldo insuficiente.

### Turno começa com modal aberto

- preservar rascunho;
- recolher painel;
- destacar turno;
- permitir retorno ao rascunho depois.

### Cancelamento

- cancelar antes de iniciar;
- aplicar política transparente;
- liberar equipe;
- liberar ou descontar reserva corretamente.

## 41. MVP do sistema

Implementar primeiro:

1. condição do empreendimento;
2. manutenção preventiva;
3. uma equipe por jogador;
4. pedidos de obra;
5. fila de três projetos;
6. prazo em rodadas;
7. saldo reservado;
8. três tipos de upgrade;
9. ativação no próximo turno do proprietário;
10. alertas;
11. contratos simples;
12. Central de Gestão;
13. snapshot e reconexão.

Deixar para depois:

- múltiplos fornecedores complexos;
- moral detalhada;
- funcionários individuais;
- cadeias extensas de materiais;
- mercado entre jogadores;
- inteligência artificial de consultoria;
- eventos econômicos complexos;
- modo assíncrono de longa duração.

## 42. Fluxo completo de exemplo

1. Mateus compra um empreendimento fictício em Santos.
2. O empreendimento começa no nível 1 e condição 82.
3. Enquanto outro jogador realiza o turno, aparece um alerta de manutenção.
4. Mateus abre a Central de Gestão.
5. Compara manutenção preventiva e upgrade de eficiência.
6. Solicita orçamento do upgrade.
7. O servidor apresenta custo, material, duração e benefício.
8. Mateus aprova.
9. O valor fica reservado.
10. Material chegará após um turno global.
11. Enquanto isso, a equipe executa manutenção preventiva.
12. Material chega e gera alerta.
13. A obra entra automaticamente na fila.
14. A equipe fica livre e inicia a obra.
15. O progresso aumenta no fim dos turnos.
16. A obra termina enquanto outra pessoa se movimenta.
17. O upgrade fica `COMPLETED_PENDING_ACTIVATION`.
18. No começo do próximo turno de Mateus, torna-se `ACTIVE`.
19. O empreendimento recebe o novo benefício.
20. O servidor registra evento e atualiza o snapshot.

## 43. Direção final

O diferencial da Terrativa será:

> **O tabuleiro define oportunidades; a gestão determina como cada território se desenvolve.**

O jogador nunca deve sentir que está apenas esperando os outros. Fora do turno ele planeja, organiza e desenvolve. No próprio turno ele explora o mapa e transforma esse planejamento em novas oportunidades.

Ao mesmo tempo, o sistema não pode virar uma lista cansativa de tarefas. Toda decisão paralela precisa ser:

- curta;
- compreensível;
- estratégica;
- opcional quando possível;
- justa;
- confirmada pelo servidor;
- claramente separada do resultado que já está em resolução.

## 44. Decisões a confirmar

1. Obras avançam por turno global ou por rodada completa?
2. Melhorias ativam no próximo turno do proprietário ou na próxima rodada?
3. Jogador pode iniciar obra automaticamente quando material chega?
4. Quantas equipes podem ser desbloqueadas?
5. A condição diminui por rodada, uso ou evento?
6. Contratos são privados ou disputados?
7. O modo principal termina por rodadas ou por objetivo?
8. Partida padrão terá 4 ou 5 jogadores?
9. Modo Família será o padrão?
10. Manutenção automática virá ativada para iniciantes?

## 45. Recomendação de configuração inicial

```text
Jogadores ideais: 3–4
Máximo: 6
Turno principal: 40 segundos
Rodadas: 10
Obras ativas: 1 por equipe
Equipes iniciais: 1
Equipes máximas: 2
Fila: 3 projetos
Contratos simultâneos: 2
Ativação: início do próximo turno do proprietário
Manutenção: degradação lenta e alertas antecipados
Modo padrão: Família
```
