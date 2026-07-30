interface StateChangeSignal<State> {
  (callback: (state: State) => void): unknown;
  remove(callback: (state: State) => void): void;
}

interface StatefulRealtimeRoom<State> {
  readonly state: State;
  readonly onStateChange: StateChangeSignal<State>;
}

export function waitForRealtimeState<State>(
  room: StatefulRealtimeRoom<State>,
  isReady: (state: State) => boolean,
  timeoutMessage: string,
  timeoutMs = 5_000,
): Promise<State> {
  if (isReady(room.state)) {
    return Promise.resolve(room.state);
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      room.onStateChange.remove(handleStateChange);
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    function handleStateChange(state: State) {
      if (!isReady(state)) return;

      clearTimeout(timeout);
      room.onStateChange.remove(handleStateChange);
      resolve(state);
    }

    room.onStateChange(handleStateChange);
  });
}
