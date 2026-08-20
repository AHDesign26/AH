// Minimal RFC 5545 VEVENT builder, enough for a single call invitation.
//
// Sending the invite as an .ics attachment is what removes the need for write
// access to anyone's calendar: both sides accept it in their own client, and
// our next free/busy lookup then sees the call like any other event.

export interface IcsEvent {
  uid: string;
  startMs: number;
  endMs: number;
  stampMs: number;
  summary: string;
  description?: string;
  organizer: { name?: string; email: string };
  attendee: { name?: string; email: string };
}

function icsTimestamp(ms: number): string {
  return new Date(ms)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/** Escape per RFC 5545 §3.3.11. Backslash first, or it double-escapes. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Fold to 75 octets per line, continuing with a leading space. Measured in
 * UTF-8 bytes rather than characters, and never split inside a character, or
 * a name with a non-ASCII letter can land a broken sequence at the boundary.
 */
function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const out: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Walk back off a continuation byte so a character stays intact.
    while (end > start && end < bytes.length && (bytes[end]! & 0xc0) === 0x80) end--;
    out.push(new TextDecoder().decode(bytes.subarray(start, end)));
    start = end;
    limit = 74; // continuation lines carry a leading space
  }
  return out.join('\r\n ');
}

function person(prefix: string, who: { name?: string; email: string }): string {
  const cn = who.name ? `;CN=${escapeText(who.name)}` : '';
  return `${prefix}${cn}:mailto:${who.email}`;
}

export function buildIcs(event: IcsEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AH Design//Call Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${icsTimestamp(event.stampMs)}`,
    `DTSTART:${icsTimestamp(event.startMs)}`,
    `DTEND:${icsTimestamp(event.endMs)}`,
    `SUMMARY:${escapeText(event.summary)}`,
    ...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
    person('ORGANIZER', event.organizer),
    person('ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE', event.attendee),
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/**
 * Base64 for the SMTP attachment. btoa only accepts code points below 256, so
 * the UTF-8 bytes have to be widened to a binary string first; a single
 * accented name in a summary would otherwise throw.
 */
export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
