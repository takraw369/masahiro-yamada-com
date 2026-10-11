// Same-origin, user-initiated reuse of the reviewed JEV profile in an existing form.
// This module never reads localStorage, writes data, or sends network requests.
export const PROFILE_STORAGE_KEY = 'masa.profile.v1';

export function parseProfileForContact(serialized) {
  if (typeof serialized !== 'string' || serialized.length > 8192) return null;
  let stored;
  try {
    stored = JSON.parse(serialized);
  } catch {
    return null;
  }
  if (!stored || stored.version !== 1 || typeof stored.fields !== 'object'
    || !stored.fields || Array.isArray(stored.fields)) return null;

  const fullName = stored.fields.fullName;
  const email = stored.fields.email;
  const name = typeof fullName === 'string' ? fullName.trim() : '';
  const address = typeof email === 'string' ? email.trim() : '';
  const safeName = name.length > 0 && name.length <= 100 && !/[<>\r\n\u0000-\u001f]/.test(name)
    ? name : '';
  const safeEmail = address.length <= 254
    && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address) ? address : '';

  return safeName || safeEmail ? { name: safeName, email: safeEmail } : null;
}
