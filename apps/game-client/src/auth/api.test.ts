// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { restoreSession } from "./api";

describe("auth session restoration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shares one refresh request between simultaneous callers", async () => {
    vi.spyOn(document, "cookie", "get").mockReturnValue("terrativa_csrf=csrf-token");
    const fetchMock = vi.fn(async () => new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([restoreSession(), restoreSession()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:2567/api/v1/auth/refresh",
      expect.objectContaining({
        credentials: "include",
        method: "POST",
      }),
    );
  });
});
