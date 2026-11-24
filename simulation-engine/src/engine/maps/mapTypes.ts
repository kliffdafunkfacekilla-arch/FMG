/**
 * Pure tactical sector map result contract and deterministic seed helpers (Phase 12.4, zero DB imports).
 */
export interface SectorMapResult {
  grid: Uint8Array;
  compressed: Buffer;
  props: Array<{
    id: string;
    name: string;
    pos: [number, number];
    tags: string[];
    hp: number;
    maxHp: number;
    description: string;
  }>;
  npcs: Array<{
    id: string;
    entity_ref?: string;
    name: string;
    role: string;
    pos: [number, number];
    tags: string[];
    faction: string;
    hp: number;
    maxHp: number;
    disposition: number;
    alive: boolean;
    equippedWeapon?: string;
    equippedArmor?: string;
    statAffinity?: string;
    memoryNotes?: string[];
    stats?: Record<string, number>;
    want?: string;
    flaw?: string;
    lineWontCross?: string;
  }>;
  poiType: string;
  name: string;
  features: Record<string, any>;
}

export const SIZE = 256;
export const CENTER = 128;

export function sfc32(a: number, b: number, c: number, d: number) {
  return function () {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function hashSeed(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return sfc32(h, h ^ 0xdeadbeef, h ^ 0xcafebabe, h ^ 0x12345678);
}
