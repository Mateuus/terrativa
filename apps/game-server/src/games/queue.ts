export class SerialGameQueue {
  readonly #tails = new Map<string, Promise<void>>();

  async run<T>(gameId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.#tails.get(gameId) ?? Promise.resolve();
    let release = () => {};
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => current);
    this.#tails.set(gameId, tail);
    await previous;
    try {
      return await task();
    } finally {
      release();
      if (this.#tails.get(gameId) === tail) {
        this.#tails.delete(gameId);
      }
    }
  }
}
