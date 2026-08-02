declare const brand: unique symbol;

export type Brand<TValue, TName extends string> = TValue & {
  readonly [brand]: TName;
};

export type UserId = Brand<string, 'UserId'>;

export function toUserId(value: string): UserId {
  return value as UserId;
}
