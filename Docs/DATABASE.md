Banco de dados

Convenções

MySQL 8 com utf8mb4.

IDs UUID armazenados conforme decisão registrada em ADR.

Datas em UTC.

Prisma migrations versionadas.

Valores monetários fictícios em inteiro, nunca ponto flutuante.

JSON somente para snapshots e conteúdo flexível justificado.

Soft delete para usuário e conteúdo administrativo quando necessário.

Entidades

User

id

email unique

username unique

passwordHash

role: USER, MODERATOR, ADMIN

status: ACTIVE, SUSPENDED, DELETED

emailVerifiedAt

createdAt

updatedAt

deletedAt

UserSession

id

userId

tokenHash

tokenFamilyId

userAgentHash

ipHash opcional

expiresAt

rotatedAt

revokedAt

createdAt

UserProfile

userId

displayName

avatarKey

locale

createdAt

updatedAt

Theme

id

slug unique

name

description

status: DRAFT, ACTIVE, ARCHIVED

version

createdBy

timestamps

Board

id

themeId

slug

name

tileCount

startingBalance

passStartReward

rulesJson

version

status

timestamps

BoardTile

id

boardId

position

type

name

description

assetKey

configJson

Restrição única: (boardId, position).

PropertyGroup

id

boardId

key

name

color

upgradeCost

maxLevel

PropertyDefinition

id

tileId unique

groupId

purchasePrice

mortgageValue

unmortgageCost

rentLevel0 até rentLevel4, ou tabela filha

CardDeck

id

boardId

type

name

CardDefinition

id

deckId

key

title

publicText

effectType

effectConfigJson

tradable

enabled

Room

id

code unique

name

ownerUserId

boardId

visibility

passwordHash nullable

minPlayers

maxPlayers

turnDurationSeconds

allowSpectators

status

createdAt

expiresAt

RoomMember

id

roomId

userId

role: HOST, PLAYER, SPECTATOR

pawnKey

colorKey

ready

joinedAt

leftAt

Restrição para impedir duas participações ativas do mesmo usuário.

Game

id

roomId

boardId

boardVersion

status

stateVersion

currentPlayerId

round

startedAt

finishedAt

winnerPlayerId

finishReason

GamePlayer

id

gameId

userId

turnOrder

pawnKey

colorKey

finalPosition

finalBalance

finalNetWorth

status

disconnectedAt

bankruptAt

GameSnapshot

id

gameId

version

stateJson

checksum

reason

createdAt

Restrição única: (gameId, version).

GameCommand

id

gameId

commandId

actorPlayerId

commandType

expectedStateVersion

accepted

resultingStateVersion

acknowledgementJson

createdAt

Restrição única: (gameId, commandId).

GameEvent

id

gameId

gameCommandId

version

sequence

eventType

actorPlayerId

payloadJson

createdAt

Índices:

(gameId, version)

(gameId, sequence)

unique (gameId, sequence)

(gameCommandId, sequence)

GameResult

id

gameId unique

winnerPlayerId

durationSeconds

rounds

summaryJson

createdAt

PlayerStatistic

userId

gamesPlayed

gamesWon

propertiesPurchased

tradesCompleted

totalTurns

updatedAt

AuditLog

id

actorUserId

action

targetType

targetId

metadataJson

createdAt

Não registrar segredos.

Transações

Obrigatórias em:

criação de partida;

aceitação de troca;

resultado final;

atualização de estatística;

rotação de refresh token;

ações administrativas com múltiplas tabelas.

Snapshots

JSON canônico.

Checksum SHA-256 para detectar corrupção acidental.

Snapshot imutável.

Retenção: manter último, início e final; política completa será configurável.

O conteúdo do tabuleiro usado na partida deve permanecer identificável por versão.

Seeds

Usuário admin obtido por variáveis de ambiente ou comando seguro.

Tema Baixada Santista.

Board de 36 casas.

Grupos, propriedades e cartas.

Seeds idempotentes por slug/key.

Proibir senha padrão fixa em produção.

Configuração de conexão

Conexões de banco e Redis devem ser fornecidas exclusivamente por variáveis de
ambiente ou secret manager. A documentação e o `.env.example` devem conter
somente placeholders, nunca hosts, usuários, senhas ou nomes internos reais.

Variáveis esperadas:

DATABASE_URL

REDIS_URL

Credenciais locais fornecidas pelo responsável devem ficar somente no `.env`
ignorado pelo Git. Se a mesma senha for reutilizada fora do ambiente local de
testes, ela deverá ser rotacionada antes de staging ou produção.
