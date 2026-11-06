// Allowlist validator for RRULE strings. The engine (rrule.js) can expand more
// than Daybook v1 supports; this file is what draws the line in [C-9].

const FREQS = new Set(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']);
const ALLOWED = new Set([
  'FREQ',
  'INTERVAL',
  'COUNT',
  'UNTIL',
  'WKST',
  'BYDAY',
  'BYMONTHDAY',
  'BYMONTH',
]);
const DAY = /^(MO|TU|WE|TH|FR|SA|SU)$/;
const ORDINAL_DAY = /^[+-]?\d+(MO|TU|WE|TH|FR|SA|SU)$/;
const UNTIL = /^\d{8}(T\d{6}Z?)?$/;

/**
 * @param {string} part
 * @returns {{ key: string, value: string } | null}
 */
function splitPart(part) {
  const eq = part.indexOf('=');
  if (eq < 0) return null;
  const key = part.slice(0, eq).trim().toUpperCase();
  const value = part.slice(eq + 1).trim().toUpperCase();
  if (!key || !value) return null;
  return { key, value };
}

/**
 * @param {string} rule
 * @returns {{ supported: boolean, reason: string | null }}
 */
export function validateRrule(rule) {
  const text = (rule ?? '').trim().replace(/^RRULE:/i, '');
  if (!text) return { supported: false, reason: 'Rule is empty' };

  const parts = text.split(';').filter(Boolean);
  const seen = new Set();
  let freq = '';
  let hasCount = false;
  let hasUntil = false;

  for (const part of parts) {
    const parsed = splitPart(part);
    if (!parsed) return { supported: false, reason: `Malformed part: ${part}` };

    const { key, value } = parsed;
    if (!ALLOWED.has(key)) return { supported: false, reason: `${key} is not supported` };
    if (seen.has(key)) return { supported: false, reason: `${key} appears twice` };
    seen.add(key);

    switch (key) {
      case 'FREQ':
        if (!FREQS.has(value)) return { supported: false, reason: `${value} is not supported` };
        freq = value;
        break;
      case 'INTERVAL':
        if (!/^\d+$/.test(value) || Number(value) < 1) {
          return { supported: false, reason: `Bad INTERVAL: ${value}` };
        }
        break;
      case 'COUNT':
        if (!/^\d+$/.test(value) || Number(value) < 1) {
          return { supported: false, reason: `Bad COUNT: ${value}` };
        }
        hasCount = true;
        break;
      case 'UNTIL':
        if (!UNTIL.test(value)) return { supported: false, reason: `Bad UNTIL: ${value}` };
        hasUntil = true;
        break;
      case 'WKST':
        if (!DAY.test(value)) return { supported: false, reason: `Bad WKST: ${value}` };
        break;
      case 'BYDAY':
        for (const day of value.split(',')) {
          if (!DAY.test(day) && !ORDINAL_DAY.test(day)) {
            return { supported: false, reason: `Bad BYDAY: ${day}` };
          }
        }
        break;
      case 'BYMONTHDAY':
        for (const day of value.split(',')) {
          const number = Number(day);
          if (!/^-?\d{1,2}$/.test(day) || number === 0 || Math.abs(number) > 31) {
            return { supported: false, reason: `Bad BYMONTHDAY: ${day}` };
          }
        }
        break;
      case 'BYMONTH':
        for (const month of value.split(',')) {
          const number = Number(month);
          if (!/^\d{1,2}$/.test(month) || number < 1 || number > 12) {
            return { supported: false, reason: `Bad BYMONTH: ${month}` };
          }
        }
        break;
      default:
        break;
    }
  }

  if (!freq) return { supported: false, reason: 'FREQ is required' };
  if (hasCount && hasUntil) {
    return { supported: false, reason: 'COUNT and UNTIL cannot be combined' };
  }
  return { supported: true, reason: null };
}

/**
 * Editor-side gate: expansion accepts ordinal BYDAY from imports, but the v1
 * editor must not author it.
 * @param {string} rule
 * @returns {{ supported: boolean, reason: string | null }}
 */
export function validateEditorRrule(rule) {
  const verdict = validateRrule(rule);
  if (!verdict.supported) return verdict;

  const text = (rule ?? '').trim().replace(/^RRULE:/i, '').toUpperCase();
  for (const part of text.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq) !== 'BYDAY') continue;
    for (const day of part.slice(eq + 1).split(',')) {
      if (ORDINAL_DAY.test(day)) {
        return { supported: false, reason: 'Ordinal BYDAY is not editable here' };
      }
    }
  }
  return { supported: true, reason: null };
}
