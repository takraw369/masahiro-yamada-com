export type NativeXAccountReadOnly = {
  id: string;
  username: string;
  displayName: string;
  isActive: true;
};

export type NativeXReadResponse = {
  success: true;
  provider: 'x-official';
  mode: 'read_only';
  postingEnabled: false;
  schedulingEnabled: false;
  data: [NativeXAccountReadOnly];
};

export function nativeXReadEnabled(env: { X_NATIVE_READ_ENABLED?: string } | null | undefined): boolean {
  return env?.X_NATIVE_READ_ENABLED === 'true';
}

// Never pass arbitrary service responses or token-bearing errors to the browser.
export function parseNativeXReadResponse(raw: unknown): NativeXReadResponse | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const result = raw as Record<string, unknown>;
  if (result.success !== true || result.provider !== 'x-official'
    || result.mode !== 'read_only' || result.postingEnabled !== false
    || result.schedulingEnabled !== false || !Array.isArray(result.data)
    || result.data.length !== 1) return null;

  const candidate: unknown = result.data[0];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  const account = candidate as Record<string, unknown>;
  if (typeof account.id !== 'string' || !/^\d{1,25}$/.test(account.id)
    || typeof account.username !== 'string' || !/^[a-zA-Z0-9_]{1,15}$/.test(account.username)
    || account.isActive !== true) return null;

  const name = typeof account.displayName === 'string' ? account.displayName.trim().slice(0, 100) : '';
  return {
    success: true,
    provider: 'x-official',
    mode: 'read_only',
    postingEnabled: false,
    schedulingEnabled: false,
    data: [{
      id: account.id,
      username: account.username,
      displayName: name || account.username,
      isActive: true,
    }],
  };
}
