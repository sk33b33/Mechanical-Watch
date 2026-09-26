/**
 * Minimal structural decoders for untrusted input (saved files, browser
 * storage). Each decoder either returns a value of the expected shape or
 * throws DecodeError naming the exact path, so a bad file is rejected
 * with a precise message and never partially loaded.
 */
export class DecodeError extends Error {
  constructor(
    readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
  }
}

export type Decoder<T> = (value: unknown, path: string) => T;

export function object(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new DecodeError(path, "expected an object");
  }
  return value as Record<string, unknown>;
}

export function field<T>(o: Record<string, unknown>, key: string, decoder: Decoder<T>, path: string): T {
  if (!(key in o)) throw new DecodeError(`${path}.${key}`, "missing");
  return decoder(o[key], `${path}.${key}`);
}

export const string: Decoder<string> = (value, path) => {
  if (typeof value !== "string") throw new DecodeError(path, "expected a string");
  return value;
};

export const boolean: Decoder<boolean> = (value, path) => {
  if (typeof value !== "boolean") throw new DecodeError(path, "expected a boolean");
  return value;
};

/** Any number, including NaN/±Infinity (restored by the format's reviver): invalid values are the validator's job, not the loader's. */
export const number: Decoder<number> = (value, path) => {
  if (typeof value !== "number") throw new DecodeError(path, "expected a number");
  return value;
};

export function nullable<T>(decoder: Decoder<T>): Decoder<T | null> {
  return (value, path) => (value === null ? null : decoder(value, path));
}

export function literal<const T extends string>(expected: T): Decoder<T> {
  return (value, path) => {
    if (value !== expected) throw new DecodeError(path, `expected "${expected}"`);
    return expected;
  };
}

export function oneOf<const T extends string>(options: readonly T[]): Decoder<T> {
  return (value, path) => {
    if (typeof value !== "string" || !(options as readonly string[]).includes(value)) {
      throw new DecodeError(path, `expected one of ${options.join(", ")}`);
    }
    return value as T;
  };
}

export function arrayOf<T>(decoder: Decoder<T>): Decoder<T[]> {
  return (value, path) => {
    if (!Array.isArray(value)) throw new DecodeError(path, "expected an array");
    return value.map((item, i) => decoder(item, `${path}[${String(i)}]`));
  };
}

/** A record of entities keyed by their own `id`. A key that disagrees with its entity's id is rejected. */
export function entityRecord<T extends { id: string }>(decoder: Decoder<T>): Decoder<Record<string, T>> {
  return (value, path) => {
    const o = object(value, path);
    const out: Record<string, T> = {};
    for (const [key, item] of Object.entries(o)) {
      const entity = decoder(item, `${path}.${key}`);
      if (entity.id !== key) throw new DecodeError(`${path}.${key}.id`, `does not match its key`);
      out[key] = entity;
    }
    return out;
  };
}
