# Fase 4 — Lobby e salas

Status: implementada e validada com repositório em memória e dois clientes
Colyseus reais.

Salas criadas por jogadores são `CASUAL`. O valor `RANKED` é reservado à fila
oficial e não pode ser ativado por código, senha ou configuração do anfitrião.

## Fluxos entregues

- listar salas públicas abertas;
- criar sala pública ou privada;
- entrar por código, com validação de senha quando privada;
- sair, fechar sala vazia e transferir automaticamente o anfitrião;
- reservar a participação no REST antes do matchmaking;
- autenticar e autorizar a associação no handshake Colyseus;
- sincronizar nome, configurações, participantes e conectividade;
- escolher peão e cor com exclusividade por sala;
- marcar pronto;
- alterar duração do turno e permissão de espectadores;
- transferir anfitrião e remover participante;
- conversar no lobby com mensagens de texto de 1 a 300 caracteres;
- validar os requisitos para iniciar e passar a sala para `STARTING`;
- expirar salas abertas após seis horas.

## API REST

Todas as rotas exigem access token Bearer:

| Método | Rota | Uso |
| --- | --- | --- |
| `GET` | `/api/v1/rooms` | lista até 100 salas públicas abertas |
| `POST` | `/api/v1/rooms` | cria a sala e reserva o anfitrião |
| `GET` | `/api/v1/rooms/:code` | consulta detalhes pelo código |
| `POST` | `/api/v1/rooms/:code/join` | valida senha/capacidade e reserva a vaga |
| `POST` | `/api/v1/rooms/:code/leave` | encerra a associação ativa |

A entrada devolve o estado da sala e:

```json
{
  "realtime": {
    "roomName": "lobby",
    "roomCode": "ABC234"
  }
}
```

O cliente conecta com `joinOrCreate("lobby", { roomCode })`. O handler usa
`roomCode` como filtro, portanto todos os participantes autorizados chegam à
mesma instância da sala.

## Comandos do lobby

O canal `LOBBY_COMMAND` aceita contratos Zod discriminados:

- `SET_READY`;
- `SET_PAWN`;
- `SET_COLOR`;
- `UPDATE_ROOM_SETTINGS`;
- `TRANSFER_HOST`;
- `KICK_PLAYER`;
- `SEND_LOBBY_CHAT`;
- `START_GAME`.

Erros de domínio voltam ao cliente por `LOBBY_ERROR`. O servidor nunca confia
em `userId` para identificar o emissor: a identidade vem do access token e da
reserva persistida.

O chat mantém somente as 50 mensagens recentes no estado volátil e limita cada
usuário a cinco mensagens por janela de dez segundos. HTML não é interpretado
pelo React.

## Seed do mapa

A tabela `Room` referencia um `Board`. O seed, originalmente mínimo nesta fase,
foi ampliado pela Fase 6 e agora instala o conteúdo completo:

```bash
corepack pnpm db:seed-foundation
```

Ele usa a primeira conta ativa como autora do conteúdo. Em banco novo, cria uma
conta técnica suspensa, com segredo aleatório não utilizável e sem permissão de
login, apenas para preservar a relação `Theme.createdBy`. O seed cria o tema e
o board com IDs estáveis. A Fase 6 promove ambos para `ACTIVE` e grava 36 casas,
11 grupos, 23 propriedades, dois baralhos e 16 cartas. O comando continua
explícito: o servidor não altera automaticamente o banco configurado.

Se o comando ainda não tiver sido executado, criar sala responde
`BOARD_NOT_FOUND` / `room.boardSeedRequired`.

## Validação

Os testes cobrem:

- contratos de criação, resposta e comandos;
- código sem caracteres ambíguos;
- pública/privada e senha;
- limite de jogadores;
- reserva, entrada e saída REST autenticadas;
- exclusividade de peão e cor;
- pré-condições de pronto;
- transferência automática de anfitrião;
- erro explícito para board ausente;
- dois clientes do SDK Colyseus conectados à mesma sala, observando estado
  coerente após peão, cor e pronto.

O navegador integrado não estava disponível no ambiente desta execução. A
interface foi validada por typecheck, build e renderização React estática; o
fluxo de rede foi validado pelo teste real do SDK.

Na execução original da Fase 4 nenhuma escrita foi feita. As migrations e o seed
foram aplicados posteriormente com autorização, durante as Fases 5 e 6.
