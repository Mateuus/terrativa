import { terrativaModuleRegistry } from "@terrativa/board-content/modules";
import type { UserProfile } from "@terrativa/protocol";
import { ActionButton, BrandMark } from "@terrativa/ui";
import { lazy, Suspense, useEffect, useState } from "react";
import { AuthDialog, type AuthMode } from "./auth/AuthDialog";
import { logout, restoreSession } from "./auth/api";
import { clearActiveGameSession, readActiveGameSession } from "./rooms/activeGame";

const moduleCatalog = terrativaModuleRegistry.list();
const defaultModuleSlug = moduleCatalog[0]?.slug ?? "";
const GameCanvas = lazy(() =>
  import("./game/GameCanvas").then((module) => ({ default: module.GameCanvas })),
);
const TerritoryMap = lazy(() =>
  import("./game/TerritoryMap").then((module) => ({ default: module.TerritoryMap })),
);
const RoomsHub = lazy(() =>
  import("./rooms/RoomsHub").then((module) => ({ default: module.RoomsHub })),
);
const RankingPanel = lazy(() =>
  import("./ranking/RankingPanel").then((module) => ({ default: module.RankingPanel })),
);

export function App() {
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [roomsView, setRoomsView] = useState<"browse" | "code" | "create" | null>(null);
  const [rankingOpen, setRankingOpen] = useState(false);
  const [activeModuleSlug, setActiveModuleSlug] = useState(defaultModuleSlug);
  const [previewMode, setPreviewMode] = useState<"map" | "board">("map");
  const activeModule = terrativaModuleRegistry.get(activeModuleSlug);
  const activeBoard = activeModule?.boards[0] ?? null;
  const activeMap = activeBoard ? terrativaModuleRegistry.getMap(activeBoard.slug) : null;
  const mapModeActive = previewMode === "map" && activeMap !== null;

  useEffect(() => {
    void restoreSession()
      .then((auth) => {
        setUser(auth?.user ?? null);
        if (auth?.user && readActiveGameSession()) {
          setRoomsView("browse");
        }
      })
      .catch(() => setUser(null));
  }, []);

  async function handleLogout() {
    await logout();
    clearActiveGameSession();
    setUser(null);
    setRoomsView(null);
  }

  return (
    <main className="shell">
      <Suspense fallback={<div aria-hidden="true" className="canvas-fallback" />}>
        {activeBoard &&
          (mapModeActive && activeMap ? (
            <TerritoryMap
              definition={activeMap}
              territoryName={activeModule?.territory.regionName ?? activeBoard.name}
            />
          ) : (
            <GameCanvas board={activeBoard} />
          ))}
      </Suspense>
      <div className="atmosphere" aria-hidden="true" />

      <header className="topbar">
        <BrandMark logoSrc="/assets/terrativa-logo-v1.png" />
        <div className="topbar__account">
          <button className="account-action" onClick={() => setRankingOpen(true)} type="button">
            Ranking
          </button>
          <div className="topbar__status">
            <span className="status-dot" aria-hidden="true" />
            {user ? `Olá, ${user.displayName}` : "Terrativa online"}
          </div>
          {user ? (
            <button className="account-action" onClick={() => void handleLogout()} type="button">
              Sair
            </button>
          ) : (
            <>
              <button className="account-action" onClick={() => setAuthMode("login")} type="button">
                Entrar
              </button>
              <button
                className="account-action account-action--primary"
                onClick={() => setAuthMode("register")}
                type="button"
              >
                Criar conta
              </button>
            </>
          )}
        </div>
      </header>

      <section className="hero">
        <div className="eyebrow">{activeModule?.name ?? "Terrativa"}</div>
        <h1>
          Explore, negocie
          <span className="hero__accent"> e desenvolva.</span>
        </h1>
        <p>
          Percorra cidades, administre recursos fictícios e transforme o território com boas
          decisões em uma experiência multiplayer para todas as idades.
        </p>
        <div className="hero__actions">
          <ActionButton
            onClick={() => (user ? setRoomsView("create") : setAuthMode("login"))}
            title={user ? "Criar uma nova sala" : "Entre para criar uma sala"}
          >
            Criar sala
          </ActionButton>
          <ActionButton
            onClick={() => (user ? setRoomsView("code") : setAuthMode("login"))}
            title={user ? "Usar um código de convite" : "Entre para acessar uma sala"}
            tone="quiet"
          >
            Entrar por código
          </ActionButton>
        </div>
        <button
          className="phase-note phase-note--link"
          onClick={() => (user ? setRoomsView("browse") : setAuthMode("login"))}
          type="button"
        >
          Ver salas públicas abertas
        </button>
      </section>

      <aside className="board-card">
        <div className="board-card__topline">
          <span>Primeiro território</span>
          <span>v{activeBoard?.version ?? 0}</span>
        </div>
        <strong>{activeBoard?.name ?? "Nenhum módulo instalado"}</strong>
        {moduleCatalog.length > 1 && (
          <label className="module-select">
            Módulo
            <select
              onChange={(event) => {
                setActiveModuleSlug(event.target.value);
                setPreviewMode("map");
              }}
              value={activeModuleSlug}
            >
              {moduleCatalog.map((module) => (
                <option key={module.slug} value={module.slug}>
                  {module.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <fieldset className="preview-toggle">
          <legend className="sr-only">Visualização do território</legend>
          <button
            aria-pressed={mapModeActive}
            disabled={!activeMap}
            onClick={() => setPreviewMode("map")}
            type="button"
          >
            Mapa real
          </button>
          <button
            aria-pressed={!mapModeActive}
            onClick={() => setPreviewMode("board")}
            type="button"
          >
            Tabuleiro 3D
          </button>
        </fieldset>
        <ul className="city-list" aria-label="Cidades do circuito">
          {activeBoard?.cities.slice(0, 5).map((city) => (
            <li key={city.key}>{city.name}</li>
          ))}
          {(activeBoard?.cities.length ?? 0) > 5 && (
            <li>+{(activeBoard?.cities.length ?? 5) - 5}</li>
          )}
        </ul>
        <div className="board-card__meta">
          <span>{activeBoard?.tileCount ?? 0} casas</span>
          <span>2–6 jogadores</span>
          <span>100% fictício</span>
        </div>
      </aside>

      <footer className="footer">
        <span>Terrativa · OpenStreetMap · Multiplayer autoritativo</span>
        <span>Diversão, estratégia e aprendizado em cada território.</span>
      </footer>

      {authMode && (
        <AuthDialog
          mode={authMode}
          onAuthenticated={(authenticatedUser) => {
            setUser(authenticatedUser);
            setAuthMode(null);
            if (readActiveGameSession()) {
              setRoomsView("browse");
            }
          }}
          onClose={() => setAuthMode(null)}
          onModeChange={setAuthMode}
        />
      )}
      {roomsView && user && (
        <Suspense
          fallback={
            <div aria-label="Carregando salas" className="rooms-overlay" role="status">
              Carregando salas…
            </div>
          }
        >
          <RoomsHub initialView={roomsView} onClose={() => setRoomsView(null)} user={user} />
        </Suspense>
      )}
      {rankingOpen && (
        <Suspense
          fallback={
            <div aria-label="Carregando ranking" className="rooms-overlay" role="status">
              Carregando ranking…
            </div>
          }
        >
          <RankingPanel onClose={() => setRankingOpen(false)} />
        </Suspense>
      )}
    </main>
  );
}
