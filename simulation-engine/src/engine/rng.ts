/**
 * Reproducible randomness for the simulation tick.
 *
 * The engine calls Math.random() in ~200 places and SQL random() in ~40. Inside runSeeded(), Math.random
 * draws from a seeded stream that belongs to that async call chain only (AsyncLocalStorage), so code in
 * the tick gets the same sequence on every replay across awaits, while HTTP requests the server handles
 * meanwhile keep ordinary randomness and do not consume the tick's stream. The tick seeds Postgres
 * random() on its own connection with seedSql().
 *
 * The seed is SIM_SEED (env, default "ostraka") mixed with the tick number: the same world state and the
 * same tick give the same day.
 */
import { AsyncLocalStorage } from "async_hooks";

/** mulberry32: small, fast, good enough for gameplay rolls. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a over a string: turns the world seed and tick into a 32-bit seed. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function tickSeed(tick: number): number {
  return hashSeed(`${process.env.SIM_SEED || "ostraka"}:${tick}`);
}

const stream = new AsyncLocalStorage<() => number>();
const nativeRandom = Math.random;
let installed = false;

function install() {
  if (installed) return;
  installed = true;
  Math.random = () => (stream.getStore() ?? nativeRandom)();
}

/** Runs fn with Math.random seeded for everything it calls, including after awaits. */
export function runSeeded<T>(seed: number, fn: () => Promise<T>): Promise<T> {
  install();
  return stream.run(mulberry32(seed), fn);
}

/** Postgres setseed() takes a double in [-1, 1]. */
export function seedSql(seed: number): number {
  return (seed / 4294967295) * 2 - 1;
}

/**
 * ORDER BY expression for a random pick that does not depend on how Postgres happens to store the rows.
 * SQL random() is seeded per tick, but it is handed out in physical row order, and that order changes
 * whenever rows are rewritten, so ORDER BY RANDOM() picked different rows on a replay of the same day.
 * This ranks rows by a hash of their key and a salt from Math.random() (seeded inside the tick): each call
 * is a fresh shuffle, the same on every replay. hashtextextended costs about what random() does (md5 was
 * three times slower); the salt is an integer, so it is safe to inline.
 */
export function sqlShuffle(key: string): string {
  return `hashtextextended((${key})::text, ${saltInt()})`;
}

function saltInt(): number {
  return Math.floor(Math.random() * 2147483647);
}

/** SQL condition true for a fraction p of rows, chosen by key and a seeded salt (see sqlShuffle). */
export function sqlChance(key: string, p: number): string {
  return `((hashtextextended((${key})::text, ${saltInt()}) & 2147483647) / 2147483648.0) < ${Number(p)}`;
}
