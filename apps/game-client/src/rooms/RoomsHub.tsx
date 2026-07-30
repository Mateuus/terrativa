import { Client } from "@colyseus/sdk";
import { characterPawnCatalog } from "@terrativa/board-content/characters";
import { officialModules } from "@terrativa/board-content/modules";
import type {
  CreateRoomRequest,
  PresentationMode,
  RoomEntryResponse,
  RoomMember,
  RoomSummary,
  UserProfile,
} from "@terrativa/protocol";
import type { FormEvent } from "react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAccessToken, getApiOrigin } from "../auth/api";
import { characterDisplayName, preloadCharacterAsset } from "../game/characterAssets";
import { isGameSoundEnabled, playGameSound, setGameSoundEnabled } from "../game/gameAudio";
import {
  clearActiveGameSession,
  readActiveGameSession,
  writeActiveGameSession,
} from "./activeGame";
import { createRoom, joinRoom, leaveRoom, listRooms } from "./api";
import { waitForRealtimeState } from "./realtime";

const LiveGameCanvas = lazy(() =>
  import("../game/LiveGameCanvas").then((module) => ({ default: module.LiveGameCanvas })),
);
const CharacterPicker3D = lazy(() =>
  import("../game/CharacterPicker3D").then((module) => ({
    default: module.CharacterPicker3D,
  })),
);

interface RoomsHubProps {
  readonly user: UserProfile;
  readonly initialView: "browse" | "code" | "create";
  readonly onClose: () => void;
}

interface LobbyMemberWire extends RoomMember {
  readonly connected: boolean;
}

interface LobbyChatWire {
  readonly id: string;
  readonly userId: string;
  readonly displayName: string;
  readonly text: string;
  readonly sentAt: number;
}

interface LobbyStateWire {
  readonly roomCode: string;
  readonly roomName: string;
  readonly boardName: string;
  readonly mode: "CASUAL" | "RANKED";
  readonly presentationMode: PresentationMode;
  readonly ownerUserId: string;
  readonly status: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly turnDurationSeconds: number;
  readonly allowSpectators: boolean;
  readonly members: Map<string, LobbyMemberWire>;
  readonly chat: LobbyChatWire[];
}

interface LobbySnapshot extends Omit<LobbyStateWire, "members" | "chat"> {
  readonly members: LobbyMemberWire[];
  readonly chat: LobbyChatWire[];
}

interface GameStateWire {
  readonly gameId: string;
  readonly status: string;
  readonly phase: string;
  readonly version: number;
  readonly round: number;
  readonly currentPlayerId: string;
  readonly turnDeadlineAt: number;
  readonly snapshotJson: string;
}

interface PublicGamePlayerWire {
  readonly id: string;
  readonly userId: string;
  readonly displayName: string;
  readonly pawnKey: string;
  readonly colorKey: string;
  readonly turnOrder: number;
  readonly status: "ACTIVE" | "BANKRUPT";
  readonly position: number;
  readonly balance: number;
  readonly inspectionTurns: number;
}

interface PublicPropertyWire {
  readonly propertyId: string;
  readonly ownerPlayerId: string | null;
  readonly level: number;
  readonly mortgaged: boolean;
}

interface PublicGameStateWire {
  readonly gameId: string;
  readonly board: {
    readonly id: string;
  };
  readonly mode: "CASUAL" | "RANKED";
  readonly status: "ACTIVE" | "FINISHED";
  readonly phase:
    | "AWAITING_ROLL"
    | "AWAITING_PURCHASE"
    | "MANAGING"
    | "DEBT_RESOLUTION"
    | "FINISHED";
  readonly round: number;
  readonly turnNumber: number;
  readonly turnDurationSeconds: number;
  readonly currentPlayerId: string | null;
  readonly turnDeadlineAt: number;
  readonly winnerPlayerId: string | null;
  readonly players: Readonly<Record<string, PublicGamePlayerWire>>;
  readonly properties: Readonly<Record<string, PublicPropertyWire>>;
  readonly activeDecision: {
    readonly type: "PURCHASE_PROPERTY";
    readonly playerId: string;
    readonly propertyId: string;
    readonly expiresAt: number;
  } | null;
  readonly pendingDebt: {
    readonly debtorPlayerId: string;
    readonly creditorPlayerId: string | null;
    readonly amount: number;
    readonly reason: string;
  } | null;
}

interface GameSnapshotWire extends Omit<GameStateWire, "snapshotJson"> {
  readonly state: PublicGameStateWire;
}

interface PrivateGameStateWire {
  readonly playerId?: string;
  readonly heldCardIds?: readonly unknown[];
  readonly [key: string]: unknown;
}

interface GameEventWire {
  readonly stateVersion: number;
  readonly type: string;
  readonly actorPlayerId: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
}

interface DiceWire {
  readonly dieOne: number;
  readonly dieTwo: number;
  readonly sequence: number;
}

const pawns = [...characterPawnCatalog.map((pawn) => [pawn.key, pawn.label] as const)] as const;
const colors = [
  ["ocean", "Azul oceano"],
  ["mangrove", "Verde mangue"],
  ["sun", "Amarelo solar"],
  ["coral", "Coral"],
  ["violet", "Violeta"],
  ["sand", "Areia"],
] as const;
const pawnAccentColors: Readonly<Record<string, string>> = {
  ocean: "#25A8D6",
  mangrove: "#49B477",
  sun: "#F2B84B",
  coral: "#F08069",
  violet: "#8E72D8",
  sand: "#E8D5A9",
};
const assetReferences = [
  {
    label: "Kenney · Pirate Kit 2.1",
    url: "https://kenney.nl/assets/pirate-kit",
    usage: "Praia 3D aplicada: areia, palmeiras, pedras, píer e barco; licença CC0.",
  },
  {
    label: "OpenGameArt · Dice por RobinJ24",
    url: "https://opengameart.org/content/dice-3",
    usage: "Dado 3D aplicado e convertido para GLB quantizado; licença CC0.",
  },
  {
    label: "Quaternius · Ultimate Modular Characters",
    url: "https://quaternius.com/packs/ultimatemodularcharacters.html",
    usage: "Personagens masculinos low poly; licença CC0.",
  },
  {
    label: "Quaternius · Ultimate Modular Women",
    url: "https://quaternius.com/packs/ultimatemodularwomen.html",
    usage: "Personagens femininos low poly; licença CC0.",
  },
  {
    label: "KayKit · Forest",
    url: "https://kaylousberg.itch.io/kaykit-forest",
    usage: "Referência para vegetação e ambientação estilizada; licença CC0.",
  },
  {
    label: "Quaternius · Modular Streets",
    url: "https://quaternius.com/packs/modularstreets.html",
    usage: "Referência planejada para o módulo Cidade 3D; licença CC0.",
  },
  {
    label: "Quaternius · Cars",
    url: "https://quaternius.com/packs/cars.html",
    usage: "Referência planejada para deslocamento no módulo Cidade 3D; licença CC0.",
  },
] as const;

export function RoomsHub({ user, initialView, onClose }: RoomsHubProps) {
  const [view, setView] = useState(initialView);
  const [rooms, setRooms] = useState<readonly RoomSummary[]>([]);
  const [connection, setConnection] = useState<ConnectedRoom | null>(null);
  const [lobby, setLobby] = useState<LobbySnapshot | null>(null);
  const [gameConnection, setGameConnection] = useState<ConnectedGameRoom | null>(null);
  const [game, setGame] = useState<GameSnapshotWire | null>(null);
  const [privateGame, setPrivateGame] = useState<PrivateGameStateWire | null>(null);
  const [gameEvents, setGameEvents] = useState<readonly GameEventWire[]>([]);
  const [dice, setDice] = useState<DiceWire | null>(null);
  const [presentationMode, setPresentationMode] = useState<PresentationMode>("BOARD");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const resumeAttempted = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reconnection must run exactly once.
  useEffect(() => {
    if (resumeAttempted.current) return;
    resumeAttempted.current = true;
    const activeGame = readActiveGameSession();
    if (!activeGame) return;
    setBusy(true);
    void enterGame(activeGame.gameId, activeGame.roomCode, activeGame.presentationMode ?? "BOARD")
      .catch((cause: unknown) => {
        clearActiveGameSession();
        setError(readableError(cause));
      })
      .finally(() => setBusy(false));
  }, []);

  useEffect(() => {
    if (view !== "browse" || connection) {
      return;
    }
    void listRooms()
      .then(setRooms)
      .catch((cause: unknown) => setError(readableError(cause)));
  }, [view, connection]);

  useEffect(
    () => () => {
      connection?.leave();
      gameConnection?.leave();
    },
    [connection, gameConnection],
  );

  async function refreshRooms() {
    try {
      setRooms(await listRooms());
    } catch (cause) {
      setError(readableError(cause));
    }
  }

  async function enterGame(
    gameId: string | undefined,
    roomCode: string,
    selectedPresentationMode: PresentationMode,
  ) {
    setPresentationMode(selectedPresentationMode);
    const connectedGame = await connectGameRealtime(gameId, roomCode);
    const updateGame = (state: GameStateWire) =>
      setGame({
        gameId: state.gameId,
        status: state.status,
        phase: state.phase,
        version: state.version,
        round: state.round,
        currentPlayerId: state.currentPlayerId,
        turnDeadlineAt: state.turnDeadlineAt,
        state: JSON.parse(state.snapshotJson) as PublicGameStateWire,
      });
    await waitForRealtimeState(
      connectedGame,
      (state) => Boolean(state?.gameId && state.snapshotJson),
      "game.syncTimeout",
    );
    connectedGame.onStateChange(updateGame);
    connectedGame.onMessage("GAME_STATE", () => undefined);
    connectedGame.onMessage("STATE_RESYNCED", () => undefined);
    connectedGame.onMessage("GAME_PRIVATE_STATE", (state: PrivateGameStateWire) =>
      setPrivateGame(state),
    );
    connectedGame.onMessage("GAME_EVENT", (event: GameEventWire) => {
      setGameEvents((current) => [event, ...current].slice(0, 8));
      if (event.type === "DICE_ROLLED") {
        const dieOne = event.payload["dieOne"];
        const dieTwo = event.payload["dieTwo"];
        if (typeof dieOne === "number" && typeof dieTwo === "number") {
          setDice({ dieOne, dieTwo, sequence: Date.now() });
        }
      }
    });
    connectedGame.onMessage("GAME_ERROR", (message: { messageKey?: string; code?: string }) => {
      setError(
        readableError(new Error(message.messageKey ?? message.code ?? "server.internalError")),
      );
    });
    connectedGame.onMessage(
      "GAME_ACK",
      (acknowledgement: { accepted?: boolean; reasonCode?: string }) => {
        if (acknowledgement.accepted) {
          setError(null);
          return;
        }
        setError(readableError(new Error(acknowledgement.reasonCode ?? "server.internalError")));
      },
    );
    updateGame(connectedGame.state);
    writeActiveGameSession({
      gameId: connectedGame.state.gameId,
      roomCode,
      presentationMode: selectedPresentationMode,
    });
    setGameConnection(connectedGame);
  }

  async function enter(entry: RoomEntryResponse) {
    setBusy(true);
    setError(null);
    try {
      const room = await connectRealtime(entry.realtime.roomCode);
      const update = (state: LobbyStateWire) => setLobby(snapshot(state));
      await waitForRealtimeState(
        room,
        (state) => Boolean(state?.roomCode && state.members && state.chat),
        "room.syncTimeout",
      );
      room.onStateChange(update);
      update(room.state);
      room.onMessage("LOBBY_ERROR", (message: { messageKey?: string }) => {
        setError(readableError(new Error(message.messageKey ?? "server.internalError")));
      });
      room.onMessage(
        "GAME_START_PENDING",
        (message: { gameId?: string; roomCode: string; presentationMode?: PresentationMode }) => {
          void enterGame(
            message.gameId,
            message.roomCode,
            message.presentationMode ?? room.state.presentationMode ?? "BOARD",
          ).catch((cause: unknown) => setError(readableError(cause)));
        },
      );
      setConnection(room);
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const visibility = String(form.get("visibility")) as "PUBLIC" | "PRIVATE";
    const input: CreateRoomRequest = {
      name: String(form.get("name") ?? ""),
      mode: "CASUAL",
      presentationMode: String(form.get("presentationMode")) === "CITY_3D" ? "CITY_3D" : "BOARD",
      visibility,
      minPlayers: Number(form.get("minPlayers")),
      maxPlayers: Number(form.get("maxPlayers")),
      turnDurationSeconds: Number(form.get("turnDurationSeconds")) as 30 | 60 | 90 | 120,
      allowSpectators: form.get("allowSpectators") === "on",
      ...(visibility === "PRIVATE" ? { password: String(form.get("password") ?? "") } : {}),
    };
    setBusy(true);
    setError(null);
    try {
      await enter(await createRoom(input));
    } catch (cause) {
      setError(readableError(cause));
      setBusy(false);
    }
  }

  async function handleCodeJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await joinByCode(
      String(form.get("code") ?? ""),
      String(form.get("password") ?? "") || undefined,
    );
  }

  async function joinByCode(code: string, password?: string) {
    setBusy(true);
    setError(null);
    try {
      await enter(await joinRoom(code.trim().toUpperCase(), { password, asSpectator: false }));
    } catch (cause) {
      setError(readableError(cause));
      setBusy(false);
    }
  }

  async function handleLeave() {
    const code = lobby?.roomCode;
    connection?.leave();
    gameConnection?.leave();
    setConnection(null);
    setGameConnection(null);
    setLobby(null);
    setGame(null);
    setPrivateGame(null);
    setGameEvents([]);
    setDice(null);
    setError(null);
    clearActiveGameSession();
    if (code) {
      try {
        await leaveRoom(code);
      } catch {
        // The local room is already closed; REST cleanup is best effort.
      }
    }
    setView("browse");
  }

  if (gameConnection && game) {
    return (
      <GamePhaseView
        connection={gameConnection}
        dice={dice}
        error={error}
        events={gameEvents}
        game={game}
        onLeave={() => void handleLeave()}
        privateGame={privateGame}
        presentationMode={presentationMode}
        user={user}
      />
    );
  }

  if (connection && lobby) {
    return (
      <LobbyView
        connection={connection}
        error={error}
        lobby={lobby}
        onLeave={() => void handleLeave()}
        user={user}
      />
    );
  }

  return (
    <div className="rooms-overlay" role="presentation">
      <section aria-label="Salas multiplayer" aria-modal="true" className="rooms-hub" role="dialog">
        <header className="rooms-hub__header">
          <div>
            <div className="eyebrow">Multiplayer Terrativa</div>
            <h2>Escolha seu ponto de partida</h2>
          </div>
          <button
            aria-label="Fechar"
            className="auth-dialog__close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <nav className="rooms-tabs" aria-label="Opções de sala">
          <button aria-pressed={view === "browse"} onClick={() => setView("browse")} type="button">
            Salas públicas
          </button>
          <button aria-pressed={view === "code"} onClick={() => setView("code")} type="button">
            Entrar por código
          </button>
          <button aria-pressed={view === "create"} onClick={() => setView("create")} type="button">
            Criar sala
          </button>
        </nav>

        {error && (
          <p className="rooms-error" role="alert">
            {error}
          </p>
        )}

        {view === "browse" && (
          <div className="room-list">
            {rooms.length === 0 ? (
              <div className="rooms-empty">
                <strong>Nenhuma sala pública aberta.</strong>
                <span>Crie a primeira expedição pela Baixada Santista.</span>
              </div>
            ) : (
              rooms.map((room) => (
                <article className="room-list__item" key={room.id}>
                  <div>
                    <strong>{room.name}</strong>
                    <span>
                      {room.boardName} ·{" "}
                      {room.presentationMode === "CITY_3D" ? "Cidade 3D" : "Tabuleiro"} · código{" "}
                      {room.code}
                    </span>
                  </div>
                  <div className="room-list__capacity">
                    {room.playerCount}/{room.maxPlayers}
                  </div>
                  <button disabled={busy} onClick={() => void joinByCode(room.code)} type="button">
                    Entrar
                  </button>
                </article>
              ))
            )}
            <button className="rooms-refresh" onClick={() => void refreshRooms()} type="button">
              Atualizar lista
            </button>
          </div>
        )}

        {view === "code" && (
          <form className="room-form room-form--compact" onSubmit={handleCodeJoin}>
            <label>
              Código da sala
              <input
                autoComplete="off"
                maxLength={6}
                minLength={6}
                name="code"
                placeholder="ABC234"
                required
              />
            </label>
            <label>
              Senha, se houver
              <input autoComplete="off" minLength={4} name="password" type="password" />
            </label>
            <button disabled={busy} type="submit">
              {busy ? "Conectando…" : "Entrar no lobby"}
            </button>
          </form>
        )}

        {view === "create" && (
          <form className="room-form" onSubmit={handleCreate}>
            <label className="room-form__wide">
              Nome da sala
              <input
                defaultValue={`Expedição de ${user.displayName}`}
                minLength={3}
                name="name"
                required
              />
            </label>
            <fieldset className="room-mode-picker room-form__wide">
              <legend>Como você quer jogar?</legend>
              <label>
                <input defaultChecked name="presentationMode" type="radio" value="BOARD" />
                <span>
                  <strong>Tabuleiro 3D</strong>
                  <small>Casas, cartas, peões animados e o mar ao redor.</small>
                </span>
              </label>
              <label>
                <input name="presentationMode" type="radio" value="CITY_3D" />
                <span>
                  <strong>Cidade 3D</strong>
                  <small>Base pronta para ruas e carros; usa o tabuleiro nesta fase.</small>
                </span>
              </label>
            </fieldset>
            <label>
              Visibilidade
              <select defaultValue="PUBLIC" name="visibility">
                <option value="PUBLIC">Pública</option>
                <option value="PRIVATE">Privada com senha</option>
              </select>
            </label>
            <label>
              Senha para sala privada
              <input minLength={4} name="password" type="password" />
            </label>
            <label>
              Mínimo de jogadores
              <select defaultValue="2" name="minPlayers">
                {[2, 3, 4, 5, 6].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Máximo de jogadores
              <select defaultValue="6" name="maxPlayers">
                {[2, 3, 4, 5, 6].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Tempo por turno
              <select defaultValue="60" name="turnDurationSeconds">
                <option value="30">30 segundos</option>
                <option value="60">60 segundos</option>
                <option value="90">90 segundos</option>
                <option value="120">120 segundos</option>
              </select>
            </label>
            <label className="room-form__check">
              <input name="allowSpectators" type="checkbox" />
              Permitir espectadores
            </label>
            <button className="room-form__submit" disabled={busy} type="submit">
              {busy ? "Preparando lobby…" : "Criar e entrar"}
            </button>
            <small className="room-form__wide">
              Salas personalizadas são sempre casuais. Partidas ranqueadas usam a fila oficial.
            </small>
          </form>
        )}
      </section>
    </div>
  );
}

interface LobbyViewProps {
  readonly connection: ConnectedRoom;
  readonly error: string | null;
  readonly lobby: LobbySnapshot;
  readonly user: UserProfile;
  readonly onLeave: () => void;
}

function LobbyView({ connection, error, lobby, user, onLeave }: LobbyViewProps) {
  const me = lobby.members.find((member) => member.userId === user.id);
  const isHost = me?.role === "HOST";
  const players = lobby.members.filter((member) => member.role !== "SPECTATOR");
  const missingPlayerCount = Math.max(0, lobby.minPlayers - players.length);
  const unpreparedPlayerCount = players.filter(
    (member) => !member.ready || !member.pawnKey || !member.colorKey,
  ).length;
  const canStart = missingPlayerCount === 0 && unpreparedPlayerCount === 0;
  const occupiedPawnKeys = new Set(
    players
      .filter((member) => member.userId !== user.id)
      .map((member) => member.pawnKey)
      .filter((pawnKey): pawnKey is string => Boolean(pawnKey)),
  );
  const availablePawns = pawns.filter(([key]) => !occupiedPawnKeys.has(key));
  const displayedPawnKey =
    me?.pawnKey ?? availablePawns[0]?.[0] ?? pawns[0]?.[0] ?? "quaternius-men-01";
  const displayedPawnIndex = availablePawns.findIndex(([key]) => key === displayedPawnKey);
  const displayedPawnName = characterDisplayName(displayedPawnKey);
  const startStatus =
    missingPlayerCount > 0
      ? `Aguardando ${missingPlayerCount} ${
          missingPlayerCount === 1 ? "jogador" : "jogadores"
        }. Esta sala exige no mínimo ${lobby.minPlayers}.`
      : unpreparedPlayerCount > 0
        ? `${unpreparedPlayerCount} ${
            unpreparedPlayerCount === 1 ? "jogador ainda precisa" : "jogadores ainda precisam"
          } escolher peão, cor e confirmar que está pronto.`
        : "Todos os requisitos foram cumpridos. A partida pode começar.";

  useEffect(() => {
    if (me?.pawnKey) preloadCharacterAsset(me.pawnKey);
  }, [me?.pawnKey]);

  function send(command: object) {
    connection.send("LOBBY_COMMAND", command);
  }

  function selectRelativePawn(direction: -1 | 1) {
    if (availablePawns.length === 0) return;
    const currentIndex = displayedPawnIndex >= 0 ? displayedPawnIndex : direction > 0 ? -1 : 0;
    const nextIndex = (currentIndex + direction + availablePawns.length) % availablePawns.length;
    const nextPawn = availablePawns[nextIndex];
    if (nextPawn) send({ type: "SET_PAWN", pawnKey: nextPawn[0] });
  }

  function handleChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = String(data.get("message") ?? "").trim();
    if (text) {
      send({ type: "SEND_LOBBY_CHAT", text });
      form.reset();
    }
  }

  return (
    <div className="rooms-overlay">
      <section aria-label="Lobby da sala" aria-modal="true" className="lobby" role="dialog">
        <header className="lobby__header">
          <div>
            <div className="eyebrow">{lobby.boardName}</div>
            <h2>{lobby.roomName}</h2>
            <span className="lobby__code">
              {lobby.mode === "RANKED" ? "Ranqueada" : "Casual"} · Código{" "}
              <strong>{lobby.roomCode}</strong> ·{" "}
              {lobby.presentationMode === "CITY_3D" ? "Cidade 3D" : "Tabuleiro 3D"}
            </span>
          </div>
          <button className="account-action" onClick={onLeave} type="button">
            Sair da sala
          </button>
        </header>

        {error && (
          <p className="rooms-error lobby__error" role="alert">
            {error}
          </p>
        )}

        <div className="lobby__layout">
          <section className="lobby__players">
            <div className="lobby__section-title">
              <strong>Exploradores</strong>
              <span>
                {lobby.members.filter((member) => member.role !== "SPECTATOR").length}/
                {lobby.maxPlayers}
              </span>
            </div>
            {lobby.members.map((member) => (
              <article
                className={`lobby-player ${member.userId === user.id ? "lobby-player--me" : ""}`}
                key={member.userId}
              >
                <span className={`connection-dot ${member.connected ? "is-online" : ""}`} />
                <div>
                  <strong>{member.displayName}</strong>
                  <small>
                    {member.role === "HOST"
                      ? "Anfitrião"
                      : member.role === "SPECTATOR"
                        ? "Espectador"
                        : "Jogador"}
                  </small>
                </div>
                <span>
                  {member.pawnKey ? characterDisplayName(member.pawnKey) : "Sem personagem"}
                </span>
                <span className={`ready-chip ${member.ready ? "is-ready" : ""}`}>
                  {member.ready ? "Pronto" : "Preparando"}
                </span>
                {isHost && member.userId !== user.id && member.role !== "SPECTATOR" && (
                  <div className="host-actions">
                    <button
                      onClick={() => send({ type: "TRANSFER_HOST", userId: member.userId })}
                      type="button"
                    >
                      Promover
                    </button>
                    <button
                      onClick={() => send({ type: "KICK_PLAYER", userId: member.userId })}
                      type="button"
                    >
                      Remover
                    </button>
                  </div>
                )}
              </article>
            ))}

            {me && me.role !== "SPECTATOR" && (
              <div className="lobby__choices">
                <section aria-label="Escolha do personagem" className="character-picker">
                  <header className="character-picker__header">
                    <div>
                      <span>Seu personagem</span>
                      <strong>{displayedPawnName}</strong>
                    </div>
                    <small>Arraste para girar</small>
                  </header>
                  <div className="character-picker__stage">
                    <Suspense
                      fallback={
                        <div className="character-picker__module-loading">
                          Preparando visualizador 3D
                        </div>
                      }
                    >
                      <CharacterPicker3D
                        accentColor={pawnAccentColors[me.colorKey ?? "ocean"] ?? "#25A8D6"}
                        label={displayedPawnName}
                        pawnKey={displayedPawnKey}
                      />
                    </Suspense>
                    <button
                      aria-label="Personagem anterior"
                      className="character-picker__arrow is-previous"
                      onClick={() => selectRelativePawn(-1)}
                      type="button"
                    >
                      ‹
                    </button>
                    <button
                      aria-label="Próximo personagem"
                      className="character-picker__arrow is-next"
                      onClick={() => selectRelativePawn(1)}
                      type="button"
                    >
                      ›
                    </button>
                    <span className="character-picker__counter">
                      {Math.max(0, displayedPawnIndex) + 1}/{availablePawns.length}
                    </span>
                  </div>
                  <footer className="character-picker__footer">
                    <label>
                      Ver todos
                      <select
                        value={me.pawnKey ?? ""}
                        onChange={(event) =>
                          send({ type: "SET_PAWN", pawnKey: event.target.value })
                        }
                      >
                        <option disabled value="">
                          Escolha seu personagem
                        </option>
                        {pawns.map(([key]) => (
                          <option disabled={occupiedPawnKeys.has(key)} key={key} value={key}>
                            {characterDisplayName(key)}
                            {occupiedPawnKeys.has(key) ? " · em uso" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <span>
                      {me.pawnKey
                        ? "Selecionado para esta partida"
                        : "Use as setas ou escolha na lista"}
                    </span>
                  </footer>
                </section>
                <label>
                  Sua cor
                  <select
                    value={me.colorKey ?? ""}
                    onChange={(event) => send({ type: "SET_COLOR", colorKey: event.target.value })}
                  >
                    <option disabled value="">
                      Escolha
                    </option>
                    {colors.map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className={`ready-button ${me.ready ? "is-ready" : ""}`}
                  disabled={!me.pawnKey || !me.colorKey}
                  onClick={() => send({ type: "SET_READY", ready: !me.ready })}
                  type="button"
                >
                  {me.ready ? "Cancelar pronto" : "Estou pronto"}
                </button>
              </div>
            )}

            {isHost && (
              <div className="lobby__host-settings">
                <label>
                  Visual
                  <select
                    value={lobby.presentationMode}
                    onChange={(event) =>
                      send({
                        type: "UPDATE_ROOM_SETTINGS",
                        settings: {
                          presentationMode: event.target.value as PresentationMode,
                        },
                      })
                    }
                  >
                    <option value="BOARD">Tabuleiro 3D</option>
                    <option value="CITY_3D">Cidade 3D (protótipo)</option>
                  </select>
                </label>
                <label>
                  Turno
                  <select
                    value={lobby.turnDurationSeconds}
                    onChange={(event) =>
                      send({
                        type: "UPDATE_ROOM_SETTINGS",
                        settings: { turnDurationSeconds: Number(event.target.value) },
                      })
                    }
                  >
                    {[30, 60, 90, 120].map((seconds) => (
                      <option key={seconds} value={seconds}>
                        {seconds}s
                      </option>
                    ))}
                  </select>
                </label>
                <label className="room-form__check">
                  <input
                    checked={lobby.allowSpectators}
                    onChange={(event) =>
                      send({
                        type: "UPDATE_ROOM_SETTINGS",
                        settings: { allowSpectators: event.target.checked },
                      })
                    }
                    type="checkbox"
                  />
                  Espectadores
                </label>
                <button
                  aria-describedby="start-game-status"
                  className="start-button"
                  disabled={!canStart}
                  onClick={() => send({ type: "START_GAME" })}
                  type="button"
                >
                  Iniciar partida
                </button>
                <p
                  className={`lobby__start-status ${canStart ? "is-ready" : ""}`}
                  id="start-game-status"
                >
                  {startStatus}
                </p>
              </div>
            )}
          </section>

          <aside className="lobby-chat">
            <div className="lobby__section-title">
              <strong>Conversa da sala</strong>
            </div>
            <div aria-live="polite" className="lobby-chat__messages">
              {lobby.chat.length === 0 && <span>A conversa começa aqui.</span>}
              {lobby.chat.map((message) => (
                <p key={message.id}>
                  <strong>{message.displayName}</strong>
                  {message.text}
                </p>
              ))}
            </div>
            <form onSubmit={handleChat}>
              <input maxLength={300} name="message" placeholder="Escreva uma mensagem…" required />
              <button type="submit">Enviar</button>
            </form>
          </aside>
        </div>
      </section>
    </div>
  );
}

interface GamePhaseViewProps {
  readonly connection: ConnectedGameRoom;
  readonly dice: DiceWire | null;
  readonly error: string | null;
  readonly events: readonly GameEventWire[];
  readonly game: GameSnapshotWire;
  readonly privateGame: PrivateGameStateWire | null;
  readonly presentationMode: PresentationMode;
  readonly onLeave: () => void;
  readonly user: UserProfile;
}

function GamePhaseView({
  connection,
  dice,
  error,
  events,
  game,
  privateGame,
  presentationMode,
  onLeave,
  user,
}: GamePhaseViewProps) {
  const playerId =
    typeof privateGame?.playerId === "string"
      ? privateGame.playerId
      : (Object.values(game.state.players).find((player) => player.userId === user.id)?.id ?? "");
  const state = game.state;
  const players = useMemo(() => Object.values(state.players), [state.players]);
  const properties = useMemo(() => Object.values(state.properties), [state.properties]);
  const sortedPlayers = useMemo(
    () => [...players].sort((left, right) => left.turnOrder - right.turnOrder),
    [players],
  );
  const me = players.find((player) => player.id === playerId);
  const currentPlayer = players.find((player) => player.id === state.currentPlayerId);
  const isMyTurn = playerId === state.currentPlayerId;
  const heldCardIds = Array.isArray(privateGame?.heldCardIds)
    ? privateGame.heldCardIds.filter((cardId): cardId is string => typeof cardId === "string")
    : [];
  const board =
    officialModules
      .flatMap((module) => module.boards)
      .find((candidate) => candidate.id === state.board.id) ??
    officialModules[0]?.boards[0] ??
    null;
  const [selectedTileIndex, setSelectedTileIndex] = useState(
    me?.position ?? currentPlayer?.position ?? 0,
  );
  const [cardsOpen, setCardsOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(isGameSoundEnabled);
  const [clock, setClock] = useState(Date.now());
  const handleSceneReady = useCallback(() => setSceneReady(true), []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSelectedTileIndex(me?.position ?? currentPlayer?.position ?? 0);
  }, [currentPlayer?.position, me?.position]);

  useEffect(() => {
    if (dice) playGameSound("dice");
  }, [dice]);

  useEffect(() => {
    const event = events[0];
    if (!event) return;
    if (event.type === "PROPERTY_PURCHASED" || event.type === "RENT_PAID") {
      playGameSound("credits");
    } else if (event.type === "GAME_FINISHED") {
      playGameSound("success");
    } else if (event.type.includes("CARD") || event.type === "TILE_RESOLVED") {
      playGameSound("event");
    }
  }, [events]);

  useEffect(() => {
    if (error) playGameSound("error");
  }, [error]);

  function command(type: string, payload: Record<string, unknown> = {}) {
    playGameSound("ui");
    connection.send("GAME_COMMAND", {
      protocolVersion: 1,
      commandId: crypto.randomUUID(),
      type,
      expectedStateVersion: game.version,
      sentAt: new Date().toISOString(),
      payload,
    });
  }

  if (!board) {
    return (
      <div className="game-stage game-stage--unavailable">
        <img alt="Terrativa" src="/assets/terrativa-logo-v1.png" />
        <h2>O módulo desta partida não está instalado.</h2>
        <p>Instale o conteúdo do tabuleiro {state.board.id} para continuar.</p>
        <button onClick={onLeave} type="button">
          Voltar
        </button>
      </div>
    );
  }

  const selectedTile =
    board.tiles.find((tile) => tile.position === selectedTileIndex) ?? board.tiles[0];
  const cardCatalog = new Map(
    board.decks.flatMap((deck) => deck.cards.map((card) => [card.id, card] as const)),
  );
  const heldCards = heldCardIds
    .map((cardId) => cardCatalog.get(cardId))
    .filter((card): card is NonNullable<typeof card> => Boolean(card));
  const selectedProperty = selectedTile?.property ?? null;
  const selectedPropertyState = selectedProperty
    ? state.properties[selectedProperty.id]
    : undefined;
  const selectedOwner = selectedPropertyState?.ownerPlayerId
    ? state.players[selectedPropertyState.ownerPlayerId]
    : undefined;
  const selectedGroup = selectedProperty
    ? board.groups.find((group) => group.key === selectedProperty.groupKey)
    : undefined;
  const decision = state.activeDecision;
  const decisionTile = decision
    ? board.tiles.find((tile) => tile.property?.id === decision.propertyId)
    : undefined;
  const remainingSeconds = Math.max(0, Math.ceil((state.turnDeadlineAt - clock) / 1_000));
  const decisionSeconds = decision
    ? Math.max(0, Math.ceil((decision.expiresAt - clock) / 1_000))
    : 0;
  const winner = state.winnerPlayerId ? state.players[state.winnerPlayerId] : undefined;

  return (
    <main aria-label={`Partida em ${board.name}`} className="game-stage">
      <Suspense fallback={null}>
        <LiveGameCanvas
          board={board}
          currentPlayerId={state.currentPlayerId}
          dice={dice}
          onReady={handleSceneReady}
          onTileSelect={setSelectedTileIndex}
          players={players}
          properties={properties}
          selectedTileIndex={selectedTileIndex}
        />
      </Suspense>
      <div aria-hidden="true" className="game-stage__shade" />

      <header className="game-hud__topbar">
        <div className="game-hud__brand">
          <img alt="Terrativa" src="/assets/terrativa-logo-v1.png" />
          <div>
            <strong>{board.name}</strong>
            <span>{state.mode === "RANKED" ? "Partida ranqueada" : "Partida casual"}</span>
            <span>
              {presentationMode === "CITY_3D" ? "Cidade 3D · base do tabuleiro" : "Tabuleiro 3D"}
            </span>
          </div>
        </div>
        <div className="game-hud__turn">
          <span>Rodada {state.round}</span>
          <strong>{isMyTurn ? "Sua vez" : `Vez de ${currentPlayer?.displayName ?? "..."}`}</strong>
          <time className={remainingSeconds <= 10 ? "is-urgent" : ""}>{remainingSeconds}s</time>
        </div>
        <div className="game-hud__account">
          <button
            aria-pressed={soundEnabled}
            className="game-hud__utility-button"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              setGameSoundEnabled(next);
            }}
            title={soundEnabled ? "Desativar sons" : "Ativar sons"}
            type="button"
          >
            {soundEnabled ? "Som ligado" : "Som desligado"}
          </button>
          <button
            className="game-hud__utility-button"
            onClick={() => setCardsOpen((current) => !current)}
            type="button"
          >
            Cartas <strong>{heldCards.length}</strong>
          </button>
          <button
            className="game-hud__utility-button"
            onClick={() => setSourcesOpen((current) => !current)}
            type="button"
          >
            Fontes
          </button>
          <div>
            <span>Seu saldo</span>
            <strong>{formatCredits(me?.balance ?? 0)}</strong>
          </div>
          <button
            className="game-hud__leave game-button--danger-subtle"
            onClick={onLeave}
            type="button"
          >
            Sair
          </button>
        </div>
      </header>

      <aside aria-label="Jogadores" className="game-hud__players">
        <div className="game-hud__menu-title">
          <span>Exploradores</span>
          <strong>{sortedPlayers.length} em campo</strong>
        </div>
        {sortedPlayers.map((player) => (
          <article
            className={`game-player-card ${
              player.id === state.currentPlayerId ? "is-current" : ""
            } ${player.id === playerId ? "is-me" : ""}`}
            key={player.id}
          >
            <span className={`game-player-card__pawn is-${player.colorKey}`} />
            <div>
              <strong>{player.displayName}</strong>
              <span>
                Casa {player.position} · {formatCredits(player.balance)}
              </span>
            </div>
            {player.status === "BANKRUPT" && <em>Falido</em>}
          </article>
        ))}
      </aside>

      <aside aria-label="Informações da casa" className="game-hud__inspector">
        <div className="game-hud__panel-heading">
          <span>
            Casa {selectedTile?.position ?? 0} ·{" "}
            {selectedTile ? tileTypeLabel(selectedTile.type) : ""}
          </span>
          <button
            aria-label="Voltar para o seu peão"
            onClick={() => setSelectedTileIndex(me?.position ?? 0)}
            type="button"
          >
            Meu peão
          </button>
        </div>
        <h2>{selectedTile?.name ?? board.name}</h2>
        {selectedTile?.media && (
          <figure className="game-location-media">
            <img alt={selectedTile.media.alt} src={selectedTile.media.imageUrl} />
            <figcaption>
              <span>{selectedTile.media.credit}</span>
              <a href={selectedTile.media.sourceUrl} rel="noreferrer" target="_blank">
                {selectedTile.media.license} · ver fonte
              </a>
            </figcaption>
          </figure>
        )}
        <p>{selectedTile?.description}</p>
        {selectedTile?.type === "START" && (
          <div className="game-start-reward">
            <span>Linha de partida</span>
            <strong>+ {formatCredits(board.passStartReward)}</strong>
            <small>Receba ao cruzar esta linha e completar uma volta.</small>
          </div>
        )}
        {selectedProperty && (
          <div className="game-property-card">
            <span
              className="game-property-card__color"
              style={{ background: selectedGroup?.color ?? "#75c7b5" }}
            />
            <div>
              <span>{selectedGroup?.name ?? "Propriedade"}</span>
              <strong>{formatCredits(selectedProperty.purchasePrice)}</strong>
            </div>
            <dl>
              <div>
                <dt>Proprietário</dt>
                <dd>{selectedOwner?.displayName ?? "Disponível"}</dd>
              </div>
              <div>
                <dt>Nível</dt>
                <dd>{selectedPropertyState?.level ?? 0}</dd>
              </div>
              <div>
                <dt>Aluguel</dt>
                <dd>
                  {formatCredits(
                    selectedProperty.rentByLevel[selectedPropertyState?.level ?? 0] ?? 0,
                  )}
                </dd>
              </div>
            </dl>
            {selectedPropertyState?.ownerPlayerId === playerId &&
              isMyTurn &&
              state.phase === "MANAGING" && (
                <div className="game-property-card__actions">
                  <button
                    className="game-button--build"
                    onClick={() => command("BUILD_UPGRADE", { propertyId: selectedProperty.id })}
                    type="button"
                  >
                    Melhorar
                  </button>
                  <button
                    className="game-button--mortgage"
                    onClick={() =>
                      command(
                        selectedPropertyState.mortgaged
                          ? "UNMORTGAGE_PROPERTY"
                          : "MORTGAGE_PROPERTY",
                        { propertyId: selectedProperty.id },
                      )
                    }
                    type="button"
                  >
                    {selectedPropertyState.mortgaged ? "Quitar hipoteca" : "Hipotecar"}
                  </button>
                </div>
              )}
          </div>
        )}
        <div className="game-hud__education">
          <strong>Você sabia?</strong>
          <p>{selectedTile?.educationalText}</p>
        </div>
      </aside>

      <section aria-label="Eventos recentes" className="game-hud__events">
        <strong>Agora no território</strong>
        {events.length === 0 ? (
          <p>A partida começou. Role os dados para explorar.</p>
        ) : (
          events
            .slice(0, 4)
            .map((event) => (
              <p
                key={`${event.stateVersion}-${event.type}-${event.actorPlayerId}-${JSON.stringify(
                  event.payload,
                )}`}
              >
                {gameEventLabel(event, state.players, board)}
              </p>
            ))
        )}
      </section>

      <section aria-live="polite" className="game-hud__actions">
        <div className="game-hud__phase">
          <span>{phaseLabel(state.phase)}</span>
          <strong>
            {dice ? `${dice.dieOne} + ${dice.dieTwo} = ${dice.dieOne + dice.dieTwo}` : "—"}
          </strong>
        </div>

        {!isMyTurn && state.status === "ACTIVE" && (
          <p>Acompanhe o movimento de {currentPlayer?.displayName ?? "outro jogador"}.</p>
        )}

        {isMyTurn && state.phase === "AWAITING_ROLL" && (
          <button
            className="game-action game-action--primary game-action--roll"
            onClick={() => command("ROLL_DICE")}
            type="button"
          >
            Rolar os dados
          </button>
        )}

        {decision?.playerId === playerId && state.phase === "AWAITING_PURCHASE" && (
          <div className="game-hud__decision">
            <p>
              Comprar <strong>{decisionTile?.name ?? "esta propriedade"}</strong>?
              <span>{decisionSeconds}s para decidir</span>
            </p>
            <button
              className="game-action game-action--primary game-action--buy"
              onClick={() => command("BUY_PROPERTY")}
              type="button"
            >
              Comprar por {formatCredits(decisionTile?.property?.purchasePrice ?? 0)}
            </button>
            <button
              className="game-action game-action--quiet"
              onClick={() => command("DECLINE_PROPERTY")}
              type="button"
            >
              Recusar
            </button>
          </div>
        )}

        {isMyTurn && state.phase === "MANAGING" && (
          <button
            className="game-action game-action--primary game-action--end"
            onClick={() => command("END_TURN")}
            type="button"
          >
            Encerrar turno
          </button>
        )}

        {state.phase === "DEBT_RESOLUTION" && state.pendingDebt?.debtorPlayerId === playerId && (
          <div className="game-hud__decision">
            <p>
              Resolva uma dívida de <strong>{formatCredits(state.pendingDebt.amount)}</strong>.
            </p>
            <button
              className="game-action game-action--danger"
              onClick={() => command("DECLARE_BANKRUPTCY")}
              type="button"
            >
              Declarar falência
            </button>
          </div>
        )}

        <button
          className="game-hud__cards"
          onClick={() => setCardsOpen((current) => !current)}
          type="button"
        >
          Minha mão: {heldCards.length}
        </button>
      </section>

      {cardsOpen && (
        <aside aria-label="Cartas na sua mão" className="game-hud__drawer game-hud__hand">
          <header>
            <div>
              <span>Sua estratégia</span>
              <h2>Cartas na mão</h2>
            </div>
            <button aria-label="Fechar cartas" onClick={() => setCardsOpen(false)} type="button">
              ×
            </button>
          </header>
          {heldCards.length === 0 ? (
            <p className="game-hud__drawer-empty">
              Você ainda não guardou cartas. Algumas cartas têm efeito imediato; outras ficam aqui
              até serem usadas.
            </p>
          ) : (
            <div className="game-card-list">
              {heldCards.map((card) => {
                const canUse =
                  card.effect.type === "GET_OUT_OF_INSPECTION" &&
                  Boolean(me && me.inspectionTurns > 0 && isMyTurn) &&
                  state.phase === "AWAITING_ROLL";
                return (
                  <article className="game-card" key={card.id}>
                    <span>
                      {card.effect.type === "GET_OUT_OF_INSPECTION"
                        ? "Carta guardada"
                        : "Carta especial"}
                    </span>
                    <h3>{card.title}</h3>
                    <p>{card.publicText}</p>
                    <small>{card.educationalText}</small>
                    {card.effect.type === "GET_OUT_OF_INSPECTION" && (
                      <button
                        disabled={!canUse}
                        onClick={() => command("USE_CARD", { cardId: card.id })}
                        type="button"
                      >
                        {canUse ? "Usar agora" : "Disponível na fiscalização"}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </aside>
      )}

      {sourcesOpen && (
        <aside aria-label="Fontes e assets" className="game-hud__drawer game-hud__sources">
          <header>
            <div>
              <span>Transparência do módulo</span>
              <h2>Fontes e assets</h2>
            </div>
            <button aria-label="Fechar fontes" onClick={() => setSourcesOpen(false)} type="button">
              ×
            </button>
          </header>
          <p>
            O tabuleiro é ficcional e usa referências públicas para contextualização. Modelos 3D são
            carregados localmente.
          </p>
          <div className="game-source-list">
            {board.sources.map((source) => (
              <a href={source.url} key={source.url} rel="noreferrer" target="_blank">
                <strong>{source.label}</strong>
                <span>{source.usage}</span>
              </a>
            ))}
            {assetReferences.map((source) => (
              <a href={source.url} key={source.url} rel="noreferrer" target="_blank">
                <strong>{source.label}</strong>
                <span>{source.usage}</span>
              </a>
            ))}
          </div>
        </aside>
      )}

      {error && (
        <div className="game-hud__error" role="alert">
          {error}
        </div>
      )}

      {!sceneReady && (
        <div aria-live="polite" className="game-loading" role="status">
          <img alt="Terrativa" src="/assets/terrativa-logo-v1.png" />
          <div>
            <span>Entrando no território...</span>
            <strong>Preparando {board.name}</strong>
            <div className="game-loading__track">
              <i />
            </div>
            <small>Sincronizando tabuleiro, peões e propriedades</small>
          </div>
        </div>
      )}

      {state.status === "FINISHED" && (
        <div className="game-finished" role="dialog" aria-modal="true">
          <img alt="Terrativa" src="/assets/terrativa-logo-v1.png" />
          <span>Partida encerrada</span>
          <h2>{winner ? `${winner.displayName} venceu!` : "Território concluído"}</h2>
          <button onClick={onLeave} type="button">
            Voltar ao início
          </button>
        </div>
      )}
    </main>
  );
}

function formatCredits(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace("R$", "T$");
}

function phaseLabel(phase: PublicGameStateWire["phase"]): string {
  const labels: Record<PublicGameStateWire["phase"], string> = {
    AWAITING_ROLL: "Hora de explorar",
    AWAITING_PURCHASE: "Decisão de compra",
    MANAGING: "Administre seus negócios",
    DEBT_RESOLUTION: "Resolva suas finanças",
    FINISHED: "Partida encerrada",
  };
  return labels[phase];
}

function tileTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    START: "Partida",
    PROPERTY: "Negócio",
    TRANSPORT: "Transporte",
    UTILITY: "Serviço",
    REGIONAL_EVENT: "Evento regional",
    COMMUNITY_BENEFIT: "Benefício comunitário",
    MUNICIPAL_FEE: "Taxa municipal",
    INSPECTION: "Fiscalização",
    VISITING: "Visita",
    REST: "Descanso",
    MOVE: "Deslocamento",
  };
  return labels[type] ?? type;
}

function gameEventLabel(
  event: GameEventWire,
  players: Readonly<Record<string, PublicGamePlayerWire>>,
  board: (typeof officialModules)[number]["boards"][number],
): string {
  const player = event.actorPlayerId ? players[event.actorPlayerId] : undefined;
  const name = player?.displayName ?? "A partida";
  const propertyId =
    typeof event.payload["propertyId"] === "string" ? event.payload["propertyId"] : undefined;
  const tile = propertyId
    ? board.tiles.find((candidate) => candidate.property?.id === propertyId)
    : undefined;
  switch (event.type) {
    case "DICE_ROLLED":
      return `${name} rolou ${String(event.payload["total"] ?? "os dados")}.`;
    case "PLAYER_MOVED":
      return `${name} avançou até a casa ${String(event.payload["to"] ?? "")}.`;
    case "PROPERTY_PURCHASED":
      return `${name} comprou ${tile?.name ?? "uma propriedade"}.`;
    case "PROPERTY_DECLINED":
      return `${name} recusou ${tile?.name ?? "uma propriedade"}.`;
    case "PASSED_START":
      return `${name} cruzou a partida e recebeu ${formatCredits(
        typeof event.payload["reward"] === "number"
          ? event.payload["reward"]
          : board.passStartReward,
      )}.`;
    case "CARD_DRAWN_PUBLIC":
      return typeof event.payload["title"] === "string"
        ? `${name} recebeu a carta “${event.payload["title"]}”.`
        : `${name} recebeu uma carta reservada.`;
    case "CARD_USED":
      return `${name} usou uma carta da mão.`;
    case "UPGRADE_BUILT":
      return `${name} melhorou ${tile?.name ?? "um negócio"}.`;
    case "PROPERTY_MORTGAGED":
      return `${name} hipotecou ${tile?.name ?? "uma propriedade"}.`;
    case "PLAYER_BANKRUPT":
      return `${name} declarou falência.`;
    case "TURN_STARTED":
      return `Começou a vez de ${name}.`;
    case "GAME_FINISHED":
      return "A partida chegou ao fim.";
    default:
      return `${name}: ${event.type.toLocaleLowerCase("pt-BR").replaceAll("_", " ")}.`;
  }
}

async function connectRealtime(roomCode: string) {
  const token = getAccessToken();
  if (!token) {
    throw new Error("auth.sessionExpired");
  }
  const client = new Client(getApiOrigin());
  client.auth.token = token;
  return client.joinOrCreate<LobbyStateWire>("lobby", { roomCode });
}

type ConnectedRoom = Awaited<ReturnType<typeof connectRealtime>>;

async function connectGameRealtime(gameId: string | undefined, roomCode: string) {
  const token = getAccessToken();
  if (!token) throw new Error("auth.sessionExpired");
  const client = new Client(getApiOrigin());
  client.auth.token = token;
  return client.joinOrCreate<GameStateWire>("game", gameId ? { gameId } : { roomCode });
}

type ConnectedGameRoom = Awaited<ReturnType<typeof connectGameRealtime>>;

function snapshot(state: LobbyStateWire): LobbySnapshot {
  return {
    roomCode: state.roomCode,
    roomName: state.roomName,
    boardName: state.boardName,
    mode: state.mode,
    presentationMode: state.presentationMode,
    ownerUserId: state.ownerUserId,
    status: state.status,
    minPlayers: state.minPlayers,
    maxPlayers: state.maxPlayers,
    turnDurationSeconds: state.turnDurationSeconds,
    allowSpectators: state.allowSpectators,
    members: Array.from(state.members.values(), (member) => ({ ...member })),
    chat: Array.from(state.chat, (message) => ({ ...message })),
  };
}

const errorMessages: Record<string, string> = {
  "auth.sessionExpired": "Sua sessão expirou. Entre novamente.",
  "room.boardSeedRequired": "O mapa Baixada Santista ainda precisa ser preparado no banco.",
  "room.invalidPassword": "A senha da sala está incorreta.",
  "room.full": "A sala já está cheia.",
  "room.notFound": "Sala não encontrada ou expirada.",
  "room.alreadyStarted": "A partida desta sala já começou.",
  "room.pawnUnavailable": "Esse peão já foi escolhido.",
  "room.colorUnavailable": "Essa cor já foi escolhida.",
  "room.playersNotReady":
    "A partida exige o número mínimo de jogadores, todos com peão, cor e status pronto.",
  "room.chatRateLimited": "Muitas mensagens seguidas. Aguarde alguns segundos.",
  "room.syncTimeout": "A sala conectou, mas demorou para sincronizar. Tente novamente.",
  "game.syncTimeout": "A partida conectou, mas demorou para sincronizar. Tente novamente.",
  "request.invalidPayload": "Confira os dados informados.",
  "server.internalError": "Não foi possível concluir agora.",
};

function readableError(cause: unknown): string {
  const key = cause instanceof Error ? cause.message : "server.internalError";
  return errorMessages[key] ?? errorMessages["server.internalError"] ?? "";
}
