import type { Workout } from '../store/useStore';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const hex = (n: number, len: number) => (n >>> 0).toString(16).padStart(len, '0').slice(-len);

function format(b: [number, number, number, number]): string {
  const a = hex(b[0], 8), c = hex(b[1], 8), d = hex(b[2], 8), e = hex(b[3], 8);
  // version 4, RFC 4122 variant
  const v = '4' + c.slice(5, 8);
  const variant = ((parseInt(d.slice(0, 1), 16) & 0x3) | 0x8).toString(16) + d.slice(1, 4);
  return `${a}-${c.slice(0, 4)}-${v}-${variant}-${d.slice(4, 8)}${e}`;
}

/** Random RFC 4122 v4 UUID. Uses the platform CSPRNG when there is one, Math.random otherwise. */
export function uuid(): string {
  const b: [number, number, number, number] = [0, 0, 0, 0];
  const c: any = (globalThis as any).crypto;
  if (c?.getRandomValues) {
    const arr = new Uint32Array(4);
    c.getRandomValues(arr);
    for (let i = 0; i < 4; i++) b[i] = arr[i];
  } else {
    for (let i = 0; i < 4; i++) b[i] = Math.floor(Math.random() * 0x100000000);
  }
  return format(b);
}

/** cyrb128 hash: 4 x 32 bits from a string. */
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

/**
 * Valid UUIDs pass through (lower-cased). Anything else (the short ids older versions of the app
 * generated) maps deterministically to a UUID, so every device converts the same old id to the same new one.
 */
export function toUuid(id: string): string {
  if (UUID_RE.test(id)) return id.toLowerCase();
  return format(cyrb128('liftrank:' + id));
}

/** Give a workout (and everything in it) UUID ids. Returns the same object when nothing changes. */
export function uuidifyWorkout(w: Workout): Workout {
  let changed = !UUID_RE.test(w.id);
  const exercises = w.exercises.map((e) => {
    const sets = e.sets.map((s) => {
      if (UUID_RE.test(s.id)) return s;
      changed = true;
      return { ...s, id: toUuid(s.id) };
    });
    if (UUID_RE.test(e.id) && sets.every((s, i) => s === e.sets[i])) return e;
    changed = true;
    return { ...e, id: toUuid(e.id), sets };
  });
  return changed ? { ...w, id: toUuid(w.id), exercises } : w;
}
