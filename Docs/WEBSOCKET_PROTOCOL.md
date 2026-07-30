Protocolo WebSocket

Transporte

Colyseus sobre wss:// em produção.

REST sobre HTTPS para conta e dados fora da partida.

Protocol version enviada no handshake.

Payloads validados no cliente e obrigatoriamente no servidor.

Envelope de comando

interface CommandEnvelope<TType extends string, TPayload> {
  protocolVersion: 1;
  commandId: string;
  type: TType;
  expectedStateVersion: number;
  sentAt: string;
  payload: TPayload;
}

userId, playerId, roomId e gameId não são confiados quando enviados pelo cliente. O servidor resolve esses dados pela conexão e pela room.

Resultado

interface CommandAcknowledgement {
  commandId: string;
  accepted: boolean;
  stateVersion: number;
  error?: {
    code: ErrorCode;
    message: string;
    retryable: boolean;
  };
}

Comandos de lobby

SET_READY

SET_PAWN

SET_COLOR

UPDATE_ROOM_SETTINGS

TRANSFER_HOST

KICK_PLAYER

SEND_LOBBY_CHAT

START_GAME

Comandos de partida

ROLL_DICE

BUY_PROPERTY

DECLINE_PROPERTY

BUILD_UPGRADE

SELL_UPGRADE

MORTGAGE_PROPERTY

UNMORTGAGE_PROPERTY

CREATE_TRADE

ACCEPT_TRADE

REJECT_TRADE

CANCEL_TRADE

USE_CARD

PAY_INSPECTION_FEE

DECLARE_BANKRUPTCY

END_TURN

SEND_GAME_CHAT

REQUEST_SYNC

Eventos

GAME_STARTED

TURN_STARTED

DICE_ROLLED

PLAYER_MOVED

PASSED_START

TILE_RESOLVED

DECISION_REQUIRED

PROPERTY_PURCHASED

RENT_PAID

UPGRADE_BUILT

UPGRADE_SOLD

PROPERTY_MORTGAGED

PROPERTY_UNMORTGAGED

TRADE_CREATED

TRADE_ACCEPTED

TRADE_REJECTED

TRADE_CANCELLED

CARD_DRAWN_PUBLIC

BALANCE_CHANGED

PLAYER_DISCONNECTED

PLAYER_RECONNECTED

PLAYER_BANKRUPT

TURN_ENDED

GAME_FINISHED

STATE_RESYNCED

Estado sincronizado

class PublicGameState {
  version: number;
  status: string;
  boardId: string;
  round: number;
  currentPlayerId: string;
  turnDeadlineAt: number;
  players: MapSchema<PublicPlayerState>;
  properties: MapSchema<PropertyState>;
  activeDecision?: PublicDecisionState;
  recentEvents: ArraySchema<PublicEventSummary>;
}

Não manter um log ilimitado no Schema. Conservar somente eventos recentes; histórico completo fica no banco.

Erros padronizados

UNAUTHENTICATED
FORBIDDEN
INVALID_PAYLOAD
ROOM_NOT_FOUND
ROOM_FULL
ROOM_ALREADY_STARTED
INVALID_ROOM_PASSWORD
PLAYER_NOT_READY
NOT_YOUR_TURN
INVALID_GAME_PHASE
STATE_VERSION_MISMATCH
DUPLICATE_COMMAND
DECISION_EXPIRED
INSUFFICIENT_BALANCE
PROPERTY_UNAVAILABLE
INVALID_UPGRADE
INVALID_TRADE
RATE_LIMITED
SERVER_BUSY
INTERNAL_ERROR

Mensagens da interface são traduzidas pelo cliente usando o código. O servidor não expõe stack trace.

Idempotência

commandId em UUID/ULID.

Cache rápido dos IDs recentes na room.

Restrição única em (gameId, commandId) para eventos persistidos.

Repetição retorna o acknowledgement anterior quando possível.

Nunca executar duas vezes compra, pagamento ou troca.

Versionamento

Toda mutação aceita incrementa stateVersion.

Cliente manda a versão esperada.

Divergência retorna STATE_VERSION_MISMATCH.

Servidor pode responder com patch ou exigir snapshot.

Alterações incompatíveis criam protocolVersion nova.

Reconexão

Cliente tenta reconnect com credencial temporária.

Servidor valida sessão e vaga.

Reconecta à mesma identidade.

Recebe estado público atual.

Recebe estado privado próprio.

Limpa animações incompatíveis.

Confirma STATE_RESYNCED.

Chat

Mensagem entre 1 e 300 caracteres.

Rate limit por usuário.

Sanitização e escape na apresentação.

Sem HTML arbitrário.

Bloqueio e denúncia ficam para fase posterior.

Persistência limitada e política de retenção documentada.

