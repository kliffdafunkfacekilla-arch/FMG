/**
 * CANVAS EFFECT & PERFORMANCE HELPER
 * ==================================
 * - Floating Combat Text Particles (Damage, Hits, Heals, Procs)
 * - Offscreen Terrain Buffer Caching for 60 FPS Blitting
 * - Sub-tile Position Lerping for Smooth Animation
 */

export interface FloatingTextParticle {
  id: string;
  x: number; // screen pixel X
  y: number; // screen pixel Y
  text: string;
  color: string;
  size: number;
  alpha: number;
  vy: number;
  life: number;
  maxLife: number;
}

export class CombatParticleManager {
  private particles: FloatingTextParticle[] = [];

  public spawn(screenX: number, screenY: number, text: string, color = '#f87171', size = 14): void {
    this.particles.push({
      id: `part_${Date.now()}_${Math.random()}`,
      x: screenX + (Math.random() * 12 - 6),
      y: screenY - 8,
      text,
      color,
      size,
      alpha: 1.0,
      vy: -1.2,
      life: 0,
      maxLife: 45 // ~45 frames (~0.75 seconds)
    });
  }

  public updateAndDraw(ctx: CanvasRenderingContext2D): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life++;
      p.y += p.vy;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.font = `bold ${p.size}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Drop shadow for crisp readability
      ctx.fillStyle = '#000000';
      ctx.fillText(p.text, p.x + 1, p.y + 1);

      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }
  }

  public clear(): void {
    this.particles = [];
  }

  public hasActiveParticles(): boolean {
    return this.particles.length > 0;
  }
}

/**
 * Offscreen Terrain Prerender Cache
 * Caches static terrain tiles so each frame only performs a fast blit.
 */
export class TerrainPrerenderCache {
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;
  private cachedSectorKey: string | null = null;

  public init(width: number, height: number): void {
    if (typeof document === 'undefined') return;
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = width;
    this.offscreenCanvas.height = height;
    this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    if (this.offscreenCtx) {
      this.offscreenCtx.imageSmoothingEnabled = false;
    }
  }

  public isCached(sectorKey: string): boolean {
    return this.cachedSectorKey === sectorKey;
  }

  public getContext(): CanvasRenderingContext2D | null {
    return this.offscreenCtx;
  }

  public getCanvas(): HTMLCanvasElement | null {
    return this.offscreenCanvas;
  }

  public markCached(sectorKey: string): void {
    this.cachedSectorKey = sectorKey;
  }

  public invalidate(): void {
    this.cachedSectorKey = null;
  }
}

/**
 * Linear interpolation helper
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
