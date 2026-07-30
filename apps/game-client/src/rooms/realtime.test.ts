import { describe, expect, it, vi } from "vitest";
import { waitForRealtimeState } from "./realtime";

interface TestState {
  readonly synchronized: boolean;
}

describe("realtime state synchronization", () => {
  it("waits for the first usable room state", async () => {
    let listener: ((state: TestState) => void) | undefined;
    const remove = vi.fn();
    const onStateChange = Object.assign(
      (callback: (state: TestState) => void) => {
        listener = callback;
      },
      { remove },
    );
    const room = {
      state: { synchronized: false },
      onStateChange,
    };

    const synchronized = waitForRealtimeState(
      room,
      (state) => state.synchronized,
      "room.syncTimeout",
    );
    listener?.({ synchronized: true });

    await expect(synchronized).resolves.toEqual({ synchronized: true });
    expect(remove).toHaveBeenCalledWith(listener);
  });
});
