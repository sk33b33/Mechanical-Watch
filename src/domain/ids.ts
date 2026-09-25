export type EntityId<Prefix extends string = string> = string & { readonly __prefix: Prefix };

export function createId<Prefix extends string>(prefix: Prefix): EntityId<Prefix> {
  return `${prefix}_${crypto.randomUUID()}` as EntityId<Prefix>;
}
