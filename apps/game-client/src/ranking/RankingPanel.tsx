import type { RankingPeriod, RankingResponse } from "@terrativa/protocol";
import { useEffect, useState } from "react";
import { loadRanking } from "./api";

interface RankingPanelProps {
  readonly onClose: () => void;
}

const periods: readonly { readonly value: RankingPeriod; readonly label: string }[] = [
  { value: "DAY", label: "Hoje" },
  { value: "WEEK", label: "Semana" },
  { value: "MONTH", label: "Mês" },
  { value: "SEASON", label: "Temporada" },
];

export function RankingPanel({ onClose }: RankingPanelProps) {
  const [period, setPeriod] = useState<RankingPeriod>("SEASON");
  const [ranking, setRanking] = useState<RankingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void loadRanking(period)
      .then((response) => {
        if (active) setRanking(response);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error && cause.message === "ranking.seasonUnavailable"
              ? "A próxima temporada ranqueada ainda não começou."
              : "Não foi possível carregar o ranking.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [period]);

  return (
    <div className="rooms-overlay">
      <section
        aria-label="Ranking competitivo"
        aria-modal="true"
        className="ranking-page"
        role="dialog"
      >
        <header className="ranking-header">
          <div>
            <div className="eyebrow">Terrativa competitiva</div>
            <h2>Ranking oficial</h2>
            <p>Rating sazonal e destaques por desempenho em partidas oficiais.</p>
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

        <nav aria-label="Período do ranking" className="rooms-tabs ranking-tabs">
          {periods.map((item) => (
            <button
              aria-pressed={period === item.value}
              key={item.value}
              onClick={() => setPeriod(item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>

        {ranking && (
          <div className="ranking-season">
            <strong>{ranking.season.name}</strong>
            <span>
              Período UTC: {formatDate(ranking.from)} – {formatDate(ranking.to)}
            </span>
          </div>
        )}
        {error && (
          <p className="rooms-error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <div className="ranking-empty">Calculando classificação…</div>
        ) : ranking?.entries.length ? (
          <div className="ranking-table-wrap">
            <table className="ranking-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Jogador</th>
                  <th>Rating</th>
                  <th>Pontos</th>
                  <th>Δ rating</th>
                  <th>Partidas</th>
                  <th>Vitórias</th>
                  <th>Falências</th>
                  <th>Colocação média</th>
                </tr>
              </thead>
              <tbody>
                {ranking.entries.map((entry) => (
                  <tr key={entry.userId}>
                    <td>
                      <strong>{entry.position}</strong>
                    </td>
                    <td>{entry.displayName}</td>
                    <td>{entry.rating}</td>
                    <td>{entry.periodPoints}</td>
                    <td className={entry.ratingDelta >= 0 ? "rating-up" : "rating-down"}>
                      {entry.ratingDelta >= 0 ? "+" : ""}
                      {entry.ratingDelta}
                    </td>
                    <td>{entry.gamesPlayed}</td>
                    <td>{entry.wins}</td>
                    <td>{entry.bankruptcies}</td>
                    <td>{entry.averagePlacement.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="ranking-empty">
            <strong>Ainda não há resultados neste período.</strong>
            <span>Somente partidas da fila ranqueada oficial entram aqui.</span>
          </div>
        )}

        <aside className="ranking-formula">
          <strong>Como a pontuação funciona</strong>
          <p>
            O rating compara a expectativa contra os adversários com colocação, patrimônio relativo
            e solvência. Falência reduz o desempenho. O cálculo é server-side, versionado e
            zero-sum; salas privadas nunca alteram o ranking.
          </p>
        </aside>
      </section>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}
