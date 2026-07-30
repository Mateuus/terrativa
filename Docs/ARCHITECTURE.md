Arquitetura

Visão geral

React UI ─┐
          ├─ Game Client ─ Colyseus SDK ─ WSS ─ Game Server ─ Game Engine
Babylon ──┘                                  │        │
                                            │        ├─ Snapshots/Eventos
REST Client ───────────── HTTPS/Fastify ─────┘        │
                                                     └─ Prisma ─ MySQL
                                                                  │
Redis (futuro) ─ presença, discovery, driver e cache ──────────────┘

Limites dos módulos

apps/game-client

Inicializa React e Babylon.

Autenticação, lobby, partida e perfil.

Mantém estado visual, não estado oficial.

Converte eventos confirmados em animações.

Contém adapters web e Capacitor.

apps/game-server

Expõe API REST Fastify.

Hospeda Colyseus.

Autentica conexão.

Gerencia rooms.

Executa comandos contra o game engine.

Persiste snapshots, eventos e resultados.

packages/game-engine

TypeScript puro:

domain/
  entities/
  value-objects/
  commands/
  events/
  rules/
  state-machine/
  random/
application/
  execute-command.ts
  reconstruct-state.ts
testing/
  fixtures/
  builders/

Entrada:

type ExecuteGameCommand = (
  state: GameState,
  command: GameCommand,
  context: CommandContext
) => CommandResult;

Saída:

interface CommandResult {
  accepted: boolean;
  nextState?: GameState;
  events: GameEvent[];
  error?: DomainError;
}

O pacote não importa React, Babylon, Colyseus, Fastify, Prisma ou APIs do sistema.

packages/protocol

Schemas Zod.

Tipos REST.

Tipos de comandos e eventos.

Códigos de erro.

Versão do protocolo.

Sem regras de negócio.

packages/database

Prisma schema.

Migrations.

Seed.

Client.

Repositórios e mappers.

packages/board-content

Schema de tema.

Validadores.

Seed Baixada Santista.

Ferramenta de importação/exportação JSON.

Fluxo de autenticação

Cliente envia e-mail e senha por HTTPS.

Fastify valida payload e rate limit.

Servidor localiza usuário e valida Argon2id.

Access token curto é retornado ao cliente.

Refresh token opaco fica em cookie HttpOnly.

O hash do refresh token é salvo em UserSession.

Na renovação, o token é rotacionado.

Reutilização de token antigo revoga a família da sessão.

WebSocket apresenta access token na autenticação da conexão.

A room resolve userId; nunca aceita playerId fornecido como identidade.

Fluxo da sala

Usuário autenticado solicita criação.

API/Matchmaker valida tema e configurações.

É criado código curto aleatório, não sequencial.

Colyseus cria LobbyRoom.

Dono entra com vaga reservada.

Outros jogadores entram por listagem ou código.

Room valida senha, capacidade, banimento e estado.

Jogadores escolhem cor/peão e ficam prontos.

Dono inicia quando mínimo e regras forem atendidos.

Servidor cria Game, GamePlayer, snapshot inicial e GameRoom.

Clientes recebem reserva para entrar na partida.

Fluxo de comando

Mensagem
  → autenticação da sessão
  → validação Zod
  → resolução do jogador pelo socket
  → deduplicação commandId
  → fila exclusiva da partida
  → comparação expectedStateVersion
  → validação da máquina de estados
  → game engine
  → persistência crítica
  → incremento da versão
  → atualização do Schema
  → broadcast/evento privado

Concorrência

Uma fila assíncrona por gameId.

Somente um comando mutável por partida é executado por vez.

commandId possui restrição única por partida.

expectedStateVersion detecta cliente desatualizado.

Operações críticas usam transação.

O handler não aguarda animação do cliente.

Reconexão

Cada jogador possui reconnectionKey armazenada com segurança.

Colyseus mantém vaga por uma janela configurável, sugerida em 120 segundos.

Ao sair do app, o cliente registra o estado da conexão.

Ao retornar, tenta reconectar; se falhar, reautentica e solicita retomada.

Servidor envia snapshot/estado atual e informações privadas daquele jogador.

Animações antigas são ignoradas; a tela converge ao estado oficial.

Em timeout de turno, servidor aplica AUTO_END_TURN ou decisão padrão segura.

Renderização

Um único Engine e Scene por partida.

React não guarda meshes em estado.

Babylon não manipula DOM de interface.

Eventos entram em uma AnimationQueue.

Se snapshot novo ultrapassar animações pendentes, cancelar animações obsoletas.

Peões repetidos e edifícios usam instancing quando viável.

Assets têm manifesto, versão e cache.

Escalabilidade

MVP:

Uma instância de game server.

Partidas em memória.

MySQL persistente.

Snapshots de recuperação.

Escala:

Redis presence/driver para Colyseus.

Processos múltiplos.

Afinidade ou descoberta de room.

Métricas por processo.

Separação futura entre API e game servers.

