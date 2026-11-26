/** Small seeded random number generators. Deterministic: the same seed gives the same sequence. */

/** mulberry32: a fast 32-bit generator. Returns numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Mixes a seed with a string key (FNV-1a), so each activity gets its own independent stream. */
export function hashSeed(seed: number, key: string): number {
  let h = (0x811c9dc5 ^ seed) >>> 0
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

/** A generator for one key under a seed. Independent of the order keys are used in. */
export function rngFor(seed: number, key: string): () => number {
  return mulberry32(hashSeed(seed, key))
}
