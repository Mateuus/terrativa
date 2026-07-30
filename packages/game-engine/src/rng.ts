export function seedToUint32(seed: string | number): number {
  if (typeof seed === "number") {
    const normalized = seed >>> 0;
    return normalized === 0 ? 0x6d2b79f5 : normalized;
  }
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  const normalized = hash >>> 0;
  return normalized === 0 ? 0x6d2b79f5 : normalized;
}

export function nextUint32(state: number): { readonly state: number; readonly value: number } {
  let next = state >>> 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  next >>>= 0;
  return { state: next, value: next };
}

export function randomInteger(
  state: number,
  minimum: number,
  maximum: number,
): { readonly state: number; readonly value: number } {
  if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum) || maximum < minimum) {
    throw new RangeError("Invalid deterministic random range");
  }
  const next = nextUint32(state);
  return {
    state: next.state,
    value: minimum + (next.value % (maximum - minimum + 1)),
  };
}

export function shuffleDeterministically<T>(
  values: readonly T[],
  initialState: number,
): { readonly state: number; readonly values: readonly T[] } {
  const shuffled = [...values];
  let state = initialState;
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const next = randomInteger(state, 0, index);
    state = next.state;
    const current = shuffled[index] as T;
    shuffled[index] = shuffled[next.value] as T;
    shuffled[next.value] = current;
  }
  return { state, values: shuffled };
}
