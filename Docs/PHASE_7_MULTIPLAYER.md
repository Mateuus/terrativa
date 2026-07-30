# Fase 7 — integração multiplayer

Status: concluída em 26 de julho de 2026.

## Entrega

A partida agora é autoritativa no servidor. O lobby valida os participantes,
cria `Game`, `GamePlayer` e o snapshot inicial em uma transação e só então envia
os clientes para a `GameRoom`.

Cada `gameId` possui uma fila serial. Um comando contém `commandId`,
`expectedStateVersion`, instante de envio, tipo e payload. A sala:

1. autentica a identidade e resolve o `GamePlayer`;
2. consulta o recibo persistido para impedir duplicação;
3. valida a versão esperada;
4. executa a engine determinística;
5. persiste recibo, eventos e snapshot com SHA-256;
6. publica o novo estado e confirma o comando.

Comandos rejeitados também recebem um recibo persistido. Repetir o mesmo
`commandId` devolve a confirmação anterior, sem executar a regra novamente.

## Estado público e privado

O estado público não transmite a ordem dos baralhos, o estado do gerador
aleatório nem os IDs reais das cartas mantidas pelos demais jogadores. A mão do
próprio jogador é enviada por `GAME_PRIVATE_STATE`, e `CARD_HELD` segue por
`GAME_PRIVATE_EVENT` somente ao seu destinatário.

## Timeout, reconexão e recuperação

`processTimeouts` é executado pela fila da própria partida. A ação automática é
persistida como `SYSTEM_TIMEOUT`, portanto também incrementa a versão e pode ser
auditada.

O Colyseus reserva a conexão por 120 segundos após uma queda inesperada. Ao
reconectar, o cliente recebe `STATE_RESYNCED` e seu estado privado atual. O banco
marca `GamePlayer` como `DISCONNECTED` durante a ausência.

Após reinício do processo, a `GameRoom` carrega o snapshot cuja versão coincide
com `Game.stateVersion`, recalcula seu SHA-256 e executa a validação completa da
engine antes de aceitar comandos.

No primeiro ciclo, um snapshot é salvo após todo comando aceito. É uma política
deliberadamente conservadora; compactação por limite de eventos poderá ser
adicionada depois de medirmos o tráfego real.

## Partidas ranqueadas

Quando uma partida oficial ranqueada termina, a mesma finalização idempotente da
Fase 5 é acionada para produzir o ledger de rating e alimentar os rankings
diário, semanal, mensal e da temporada. Salas privadas continuam inelegíveis.

## Personagens e assets

O catálogo de peões passou a usar 21 IDs estáveis:

- `quaternius-men-01` a `quaternius-men-11`;
- `quaternius-women-01` a `quaternius-women-10`.

Os IDs e a origem/licença já são sincronizados pela Fase 7. Os arquivos glTF,
rigs, combinações modulares, escala, materiais e animações entram no
`PawnRenderer` da Fase 8. Manter os binários fora desta fase evita escolher
nomes internos e transformações antes de existir um teste visual no Babylon.js.

Fontes aprovadas:

- [Ultimate Modular Men Pack](https://quaternius.com/packs/ultimatemodularcharacters.html):
  11 personagens, 24 animações, quatro partes modulares, CC0;
- [Ultimate Modular Women Pack](https://quaternius.com/packs/ultimatemodularwomen.html):
  10 personagens, 24 animações, quatro partes modulares, rig humanoide e CC0.

Ambos disponibilizam glTF, FBX, OBJ e Blend. O pipeline web adotará glTF/GLB.

## Verificação

Os testes cobrem:

- dois comandos concorrentes contra a mesma versão;
- reenvio do mesmo `commandId`;
- timeout automático persistido;
- recuperação em uma nova instância do serviço;
- rejeição de snapshot com checksum inválido;
- queda real do WebSocket e reconexão à mesma `GameRoom`.

O cliente inclui uma tela técnica temporária para rolar dados, comprar, recusar
e encerrar turno. Ela será substituída pelo tabuleiro 3D e HUD na Fase 8.
