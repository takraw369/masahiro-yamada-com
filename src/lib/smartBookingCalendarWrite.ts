import type { BookingPaymentEnv, BookingRecord } from './smartBookingPayments';

type Http = typeof fetch;
export function bookingGoogleEventId(id: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('invalid_booking_id');
  return 'masa' + id.toLowerCase().replace(/-/g, '');
}
async function bookingGoogleAuth(env: BookingPaymentEnv, http: Http): Promise<string> {
  if (!env.BOOKING_GOOGLE_CLIENT_ID || !env.BOOKING_GOOGLE_CLIENT_SECRET || !env.BOOKING_GOOGLE_REFRESH_TOKEN)
    throw new Error('google_calendar_write_auth_missing');
  const r = await http('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.BOOKING_GOOGLE_CLIENT_ID,
      client_secret: env.BOOKING_GOOGLE_CLIENT_SECRET,
      refresh_token: env.BOOKING_GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!r.ok) throw new Error('google_token_unavailable');
  const obj = await r.json() as { access_token?: unknown };
  if (typeof obj?.access_token !== 'string') throw new Error('google_token_missing');
  return obj.access_token;
}
function bookingCalendarBase(env: BookingPaymentEnv): string {
  const calendarId = env.BOOKING_CONFIRM_CALENDAR_ID || '';
  const includesId = (env.BOOKING_GOOGLE_CALENDAR_IDS || '').split(',').map(x => x.trim()).includes(calendarId);
  if (!calendarId || !includesId || calendarId.length > 250) throw new Error('booking_calendar_not_verified');
  return 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(calendarId) + '/events';
}
export async function findBookingEvent(
  env: BookingPaymentEnv, bookingId: string, http: Http = fetch,
): Promise<{ eventId: string; meetingUrl: string | null } | null> {
  const base = bookingCalendarBase(env), eventId = bookingGoogleEventId(bookingId);
  const token = await bookingGoogleAuth(env, http);
  const response = await http(base + '/' + eventId, { headers: { Authorization: 'Bearer ' + token } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('booking_calendar_get_failed');
  const event = await response.json() as { id?: string; hangoutLink?: string; extendedProperties?: { private?: { booking_id?: string } } };
  if (event.id !== eventId || event.extendedProperties?.private?.booking_id !== bookingId) throw new Error('booking_calendar_id_collision');
  return { eventId, meetingUrl: event.hangoutLink || null };
}
export async function upsertBookingCalendarEvent(
  env: BookingPaymentEnv, booking: BookingRecord, customerEmail: string, http: Http = fetch,
): Promise<{ eventId: string; meetingUrl: string | null }> {
  if (!booking || booking.mode !== 'online' || booking.location_id !== 'online-private') throw new Error('booking_venue_not_supported');
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(customerEmail) || customerEmail.length > 254) throw new Error('missing_customer_email');
  if (booking.state !== 'paid' && booking.state !== 'needs_review' && booking.state !== 'confirmed') throw new Error('booking_not_paid');
  const existing = await findBookingEvent(env, booking.id, http);
  if (existing) return existing;
  const token = await bookingGoogleAuth(env, http);
  const eventId = bookingGoogleEventId(booking.id);
  const response = await http(bookingCalendarBase(env) + '?conferenceDataVersion=1&sendUpdates=all', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: eventId,
      summary: 'ACE｜90分パフォーマンス実装セッション',
      description: 'ご予約ありがとうございます。開始時間になりましたらGoogle Meetにご参加ください。',
      start: { dateTime: booking.start_at, timeZone: 'Asia/Tokyo' },
      end: { dateTime: booking.end_at, timeZone: 'Asia/Tokyo' },
      attendees: [{ email: customerEmail }],
      guestsCanInviteOthers: false,
      guestsCanSeeOtherGuests: false,
      transparency: 'opaque',
      extendedProperties: { private: { booking_id: booking.id } },
      conferenceData: {
        createRequest: { requestId: 'ace' + booking.id.replace(/-/g, ''), conferenceSolutionKey: { type: 'hangoutsMeet' } },
      },
    }),
  });
  if (response.status === 409) {
    const retry = await findBookingEvent(env, booking.id, http);
    if (retry) return retry;
    throw new Error('booking_calendar_collision');
  }
  if (!response.ok) throw new Error('booking_calendar_insert_failed');
  const event = await response.json() as { id?: string; hangoutLink?: string };
  if (event.id !== eventId) throw new Error('booking_calendar_insert_mismatch');
  return { eventId, meetingUrl: event.hangoutLink || null };
}
