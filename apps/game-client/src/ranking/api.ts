import type { RankingPeriod, RankingResponse } from "@terrativa/protocol";
import { getApiOrigin } from "../auth/api";

export async function loadRanking(period: RankingPeriod): Promise<RankingResponse> {
  const response = await fetch(
    `${getApiOrigin()}/api/v1/rankings?period=${encodeURIComponent(period)}`,
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { messageKey?: string };
    } | null;
    throw new Error(body?.error?.messageKey ?? "server.internalError");
  }
  return (await response.json()) as RankingResponse;
}
