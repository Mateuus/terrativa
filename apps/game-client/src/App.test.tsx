import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { AuthDialog } from "./auth/AuthDialog";
import { RankingPanel } from "./ranking/RankingPanel";
import { RoomsHub } from "./rooms/RoomsHub";

describe("Terrativa game client", () => {
  it("renders the branded map shell and account entry points", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("Terrativa");
    expect(markup).toContain("Explore, negocie");
    expect(markup).toContain("Criar conta");
    expect(markup).toContain("Ranking");
    expect(markup).toContain("Ver salas públicas abertas");
    expect(markup).toContain("Mapa real");
    expect(markup).toContain("Tabuleiro 3D");
    expect(markup).toContain("OpenStreetMap");
  });

  it("renders daily, weekly, monthly and seasonal ranking periods", () => {
    const markup = renderToStaticMarkup(<RankingPanel onClose={() => undefined} />);

    expect(markup).toContain("Ranking oficial");
    expect(markup).toContain("Hoje");
    expect(markup).toContain("Semana");
    expect(markup).toContain("Mês");
    expect(markup).toContain("Temporada");
    expect(markup).toContain("salas privadas nunca alteram o ranking");
  });

  it("renders the multiplayer room browser and creation entry points", () => {
    const markup = renderToStaticMarkup(
      <RoomsHub
        initialView="browse"
        onClose={() => undefined}
        user={{
          id: "d0c6d752-a03a-4f4f-a720-4bf5d671fd13",
          email: "player@example.com",
          username: "player",
          role: "USER",
          status: "ACTIVE",
          displayName: "Exploradora",
          avatarKey: null,
          locale: "pt-BR",
          emailVerified: false,
        }}
      />,
    );

    expect(markup).toContain("Salas públicas");
    expect(markup).toContain("Entrar por código");
    expect(markup).toContain("Criar sala");
  });

  it("renders an accessible registration dialog with the password policy", () => {
    const markup = renderToStaticMarkup(
      <AuthDialog
        mode="register"
        onAuthenticated={() => undefined}
        onClose={() => undefined}
        onModeChange={() => undefined}
      />,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("Nome de jogador");
    expect(markup).toContain('minLength="12"');
    expect(markup).toContain("Seus recursos e propriedades são sempre fictícios.");
  });
});
