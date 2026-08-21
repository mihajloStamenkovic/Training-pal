type GetToken = () => Promise<string | null>;

let getTokenFn: GetToken | null = null;

export function setGetToken(fn: GetToken | null) {
  getTokenFn = fn;
}

export function getAuthToken(): Promise<string | null> {
  return getTokenFn ? getTokenFn() : Promise.resolve(null);
}
