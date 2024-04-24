export type Failure = {
  message: string;
  payload?: unknown;
};

export const failure =
  (message: string) =>
  (payload?: unknown): Failure => ({
    message,
    payload,
  });
