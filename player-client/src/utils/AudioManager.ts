// Audio Manager for Fantasy Map Generator & Aetheria Player Client
// Manages Background Music (BGM), Sound Effects (SFX), and Dynamic Procedural Biome Synthesizers

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  src: string;
}

export const MUSIC_PLAYLIST: MusicTrack[] = [
  { id: "regular", title: "Goblins' Den", artist: "Minifantasy Dungeon OST (Leohpaz)", src: "/audio/music/goblins_den_regular.wav" },
  { id: "battle", title: "Goblins' Dance (Battle)", artist: "Minifantasy Dungeon OST (Leohpaz)", src: "/audio/music/goblins_dance_battle.wav" }
];

export const SFX_LIBRARY = {
  step: [
    "/audio/sfx/16_human_walk_stone_1.wav",
    "/audio/sfx/16_human_walk_stone_2.wav",
    "/audio/sfx/16_human_walk_stone_3.wav"
  ],
  attack: [
    "/audio/sfx/07_human_atk_sword_1.wav",
    "/audio/sfx/07_human_atk_sword_2.wav",
    "/audio/sfx/07_human_atk_sword_3.wav"
  ],
  hit: [
    "/audio/sfx/26_sword_hit_1.wav",
    "/audio/sfx/26_sword_hit_2.wav",
    "/audio/sfx/26_sword_hit_3.wav"
  ],
  miss: [
    "/audio/sfx/27_sword_miss_1.wav",
    "/audio/sfx/27_sword_miss_2.wav",
    "/audio/sfx/27_sword_miss_3.wav"
  ],
  damage: [
    "/audio/sfx/11_human_damage_1.wav",
    "/audio/sfx/11_human_damage_2.wav",
    "/audio/sfx/11_human_damage_3.wav"
  ],
  death: [
    "/audio/sfx/14_human_death_spin.wav"
  ],
  chest: [
    "/audio/sfx/01_chest_open_1.wav",
    "/audio/sfx/01_chest_open_2.wav",
    "/audio/sfx/01_chest_open_3.wav",
    "/audio/sfx/01_chest_open_4.wav"
  ],
  door: [
    "/audio/sfx/05_door_open_1.mp3",
    "/audio/sfx/05_door_open_2.mp3"
  ],
  special: [
    "/audio/sfx/10_human_special_atk_1.wav",
    "/audio/sfx/10_human_special_atk_2.wav"
  ]
};

interface ActiveSoundscape {
  biome: string;
  isUrban: boolean;
  gainNode: GainNode;
  cleanup: () => void;
}

class SoundManager {
  private musicAudio: HTMLAudioElement | null = null;
  private currentTrackIndex = 0;
  private musicVolume = 0.35;
  private sfxVolume = 0.55;
  private ambientVolume = 0.30;
  private musicMuted = false;
  private sfxMuted = false;
  private ambientMuted = false;
  private isPlayingMusic = false;
  private lastStepTime = 0;

  // Web Audio API Procedural Synthesizer State
  private audioCtx: AudioContext | null = null;
  private ambientMasterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private currentSoundscape: ActiveSoundscape | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.initAudio();
    }
  }

  private initAudio() {
    try {
      this.musicAudio = new Audio();
      this.musicAudio.volume = this.musicVolume;
      this.musicAudio.addEventListener("ended", () => {
        this.nextTrack();
      });
    } catch {
      // Audio not supported or blocked
    }
  }

  /**
   * Lazily initializes the Web Audio API context upon user interaction
   */
  public getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
        this.ambientMasterGain = this.audioCtx.createGain();
        this.ambientMasterGain.gain.setValueAtTime(
          this.ambientMuted ? 0 : this.ambientVolume,
          this.audioCtx.currentTime
        );
        this.ambientMasterGain.connect(this.audioCtx.destination);
        this.initNoiseBuffer();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Synthesizes a 3-second stereo pink noise buffer for procedural wind, foliage & surf
   */
  private initNoiseBuffer() {
    if (!this.audioCtx) return;
    const sampleRate = this.audioCtx.sampleRate;
    const bufferSize = sampleRate * 3;
    const buffer = this.audioCtx.createBuffer(2, bufferSize, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const output = buffer.getChannelData(channel);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Paul Kellet's refined pink noise filter
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.09;
        b6 = white * 0.115926;
      }
    }
    this.noiseBuffer = buffer;
  }

  private createNoiseSource(): AudioBufferSourceNode | null {
    if (!this.audioCtx || !this.noiseBuffer) return null;
    const src = this.audioCtx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    return src;
  }

  // --- Music & SFX API ---

  public getPlaylist(): MusicTrack[] {
    return MUSIC_PLAYLIST;
  }

  public getCurrentTrack(): MusicTrack {
    return MUSIC_PLAYLIST[this.currentTrackIndex] || MUSIC_PLAYLIST[0];
  }

  public isMusicPlaying(): boolean {
    return this.isPlayingMusic;
  }

  public isMusicMute(): boolean {
    return this.musicMuted;
  }

  public isSfxMute(): boolean {
    return this.sfxMuted;
  }

  public isAmbientMute(): boolean {
    return this.ambientMuted;
  }

  public getMusicVolume(): number {
    return this.musicVolume;
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  public getAmbientVolume(): number {
    return this.ambientVolume;
  }

  public playMusic(index?: number) {
    if (typeof window === "undefined") return;
    this.getAudioContext();
    if (index !== undefined && index >= 0 && index < MUSIC_PLAYLIST.length) {
      this.currentTrackIndex = index;
    }
    if (!this.musicAudio) this.initAudio();
    if (!this.musicAudio) return;

    const track = MUSIC_PLAYLIST[this.currentTrackIndex];
    if (this.musicAudio.src !== window.location.origin + track.src) {
      this.musicAudio.src = track.src;
    }
    this.musicAudio.volume = this.musicMuted ? 0 : this.musicVolume;
    this.musicAudio.play().then(() => {
      this.isPlayingMusic = true;
    }).catch(() => {
      this.isPlayingMusic = false;
    });
  }

  public pauseMusic() {
    if (this.musicAudio) {
      this.musicAudio.pause();
      this.isPlayingMusic = false;
    }
  }

  public toggleMusic() {
    if (this.isPlayingMusic) {
      this.pauseMusic();
    } else {
      this.playMusic();
    }
  }

  public nextTrack() {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % MUSIC_PLAYLIST.length;
    this.playMusic(this.currentTrackIndex);
  }

  public prevTrack() {
    this.currentTrackIndex = (this.currentTrackIndex - 1 + MUSIC_PLAYLIST.length) % MUSIC_PLAYLIST.length;
    this.playMusic(this.currentTrackIndex);
  }

  public playBattleMusic() {
    const battleIndex = MUSIC_PLAYLIST.findIndex(t => t.id === "battle");
    if (battleIndex !== -1 && this.currentTrackIndex !== battleIndex) {
      this.playMusic(battleIndex);
    }
  }

  public playExplorationMusic() {
    const regularIndex = MUSIC_PLAYLIST.findIndex(t => t.id === "regular");
    if (regularIndex !== -1 && this.currentTrackIndex !== regularIndex) {
      this.playMusic(regularIndex);
    }
  }

  public setMusicVolume(val: number) {
    this.musicVolume = Math.max(0, Math.min(1, val));
    if (this.musicAudio) {
      this.musicAudio.volume = this.musicMuted ? 0 : this.musicVolume;
    }
  }

  public setSfxVolume(val: number) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
  }

  public setAmbientVolume(val: number) {
    this.ambientVolume = Math.max(0, Math.min(1, val));
    if (this.ambientMasterGain && this.audioCtx) {
      this.ambientMasterGain.gain.setValueAtTime(
        this.ambientMuted ? 0 : this.ambientVolume,
        this.audioCtx.currentTime
      );
    }
  }

  public toggleMuteMusic() {
    this.musicMuted = !this.musicMuted;
    if (this.musicAudio) {
      this.musicAudio.volume = this.musicMuted ? 0 : this.musicVolume;
    }
  }

  public toggleMuteSfx() {
    this.sfxMuted = !this.sfxMuted;
  }

  public toggleMuteAmbient() {
    this.ambientMuted = !this.ambientMuted;
    if (this.ambientMasterGain && this.audioCtx) {
      this.ambientMasterGain.gain.setValueAtTime(
        this.ambientMuted ? 0 : this.ambientVolume,
        this.audioCtx.currentTime
      );
    }
  }

  public playSfx(type: keyof typeof SFX_LIBRARY) {
    if (this.sfxMuted || typeof window === "undefined") return;
    this.getAudioContext();

    const files = SFX_LIBRARY[type];
    if (!files || files.length === 0) return;

    const src = files[Math.floor(Math.random() * files.length)];
    try {
      const sound = new Audio(src);
      sound.volume = this.sfxVolume;
      sound.playbackRate = 0.95 + Math.random() * 0.1;
      sound.play().catch(() => {});
    } catch {
      // Ignore audio error
    }
  }

  public playStep() {
    const now = Date.now();
    if (now - this.lastStepTime > 260) {
      this.lastStepTime = now;
      this.playSfx("step");
    }
  }

  // =========================================================================
  // DYNAMIC PROCEDURAL BIOME SOUNDSCAPE SYNTHESIZERS (WEB AUDIO API)
  // =========================================================================

  /**
   * Sets the active procedural soundscape for the given biome, crossfading smoothly.
   */
  public setBiomeSoundscape(biomeName: string, isUrban: boolean = false) {
    const ctx = this.getAudioContext();
    if (!ctx || !this.ambientMasterGain) return;

    const cleanBiome = (biomeName || "Wilderness").trim();

    // Avoid redundant resets if already running
    if (
      this.currentSoundscape &&
      this.currentSoundscape.biome === cleanBiome &&
      this.currentSoundscape.isUrban === isUrban
    ) {
      return;
    }

    const now = ctx.currentTime;
    const fadeDuration = 1.4;

    // Crossfade: Fade out the previous soundscape
    if (this.currentSoundscape) {
      const prev = this.currentSoundscape;
      try {
        prev.gainNode.gain.cancelScheduledValues(now);
        prev.gainNode.gain.setValueAtTime(prev.gainNode.gain.value, now);
        prev.gainNode.gain.linearRampToValueAtTime(0.0001, now + fadeDuration);
        setTimeout(() => {
          prev.cleanup();
        }, (fadeDuration + 0.1) * 1000);
      } catch {
        prev.cleanup();
      }
      this.currentSoundscape = null;
    }

    // Build the new soundscape
    const localGain = ctx.createGain();
    localGain.gain.setValueAtTime(0.0001, now);
    localGain.gain.linearRampToValueAtTime(1.0, now + fadeDuration);
    localGain.connect(this.ambientMasterGain);

    const cleanupFns: Array<() => void> = [];

    if (isUrban) {
      this.buildUrbanSynth(ctx, localGain, cleanupFns);
    } else {
      const b = cleanBiome.toLowerCase();
      if (b.includes("desert")) {
        this.buildDesertSynth(ctx, localGain, cleanupFns);
      } else if (b.includes("tundra") || b.includes("glacier")) {
        this.buildTundraSynth(ctx, localGain, cleanupFns);
      } else if (b.includes("wetland") || b.includes("swamp")) {
        this.buildWetlandSynth(ctx, localGain, cleanupFns);
      } else if (b.includes("tropical")) {
        this.buildTropicalSynth(ctx, localGain, cleanupFns);
      } else if (b.includes("forest") || b.includes("woodland") || b.includes("boreal") || b.includes("chaparral")) {
        this.buildForestSynth(ctx, localGain, cleanupFns);
      } else if (b.includes("marine") || b.includes("ocean") || b.includes("water") || b.includes("coast")) {
        this.buildMarineSynth(ctx, localGain, cleanupFns);
      } else if (b.includes("savanna") || b.includes("grassland")) {
        this.buildPlainsSynth(ctx, localGain, cleanupFns);
      } else {
        this.buildWildernessSynth(ctx, localGain, cleanupFns);
      }
    }

    this.currentSoundscape = {
      biome: cleanBiome,
      isUrban,
      gainNode: localGain,
      cleanup: () => {
        cleanupFns.forEach(fn => {
          try { fn(); } catch { /* ignore */ }
        });
        try { localGain.disconnect(); } catch { /* ignore */ }
      }
    };
  }

  // --- Biome Synthesizer Generators ---

  /** Desert: Howling bandpass noise with sweeping dune resonance & low sub drone */
  private buildDesertSynth(ctx: AudioContext, out: GainNode, cleanup: Array<() => void>) {
    const noise = this.createNoiseSource();
    if (!noise) return;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(540, ctx.currentTime);
    filter.Q.setValueAtTime(3.8, ctx.currentTime);

    // LFO for shifting desert wind gusts
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(0.09, ctx.currentTime);
    lfoGain.gain.setValueAtTime(220, ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    // Low sub drone for desolate expanse
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(55, ctx.currentTime);
    subGain.gain.setValueAtTime(0.04, ctx.currentTime);

    noise.connect(filter);
    filter.connect(out);
    sub.connect(subGain);
    subGain.connect(out);

    noise.start();
    lfo.start();
    sub.start();

    cleanup.push(() => {
      noise.stop();
      lfo.stop();
      sub.stop();
      noise.disconnect();
      filter.disconnect();
      lfo.disconnect();
      sub.disconnect();
    });
  }

  /** Tundra & Glacier: Biting highpass whistling wind with crystalline sub-zero chimes */
  private buildTundraSynth(ctx: AudioContext, out: GainNode, cleanup: Array<() => void>) {
    const noise = this.createNoiseSource();
    if (!noise) return;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1400, ctx.currentTime);
    filter.Q.setValueAtTime(5.5, ctx.currentTime);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(0.14, ctx.currentTime);
    lfoGain.gain.setValueAtTime(450, ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    // High crystalline harmonic sheen
    const crystal = ctx.createOscillator();
    const crystalGain = ctx.createGain();
    crystal.type = "sine";
    crystal.frequency.setValueAtTime(1760, ctx.currentTime);
    crystalGain.gain.setValueAtTime(0.008, ctx.currentTime);

    noise.connect(filter);
    filter.connect(out);
    crystal.connect(crystalGain);
    crystalGain.connect(out);

    noise.start();
    lfo.start();
    crystal.start();

    cleanup.push(() => {
      noise.stop();
      lfo.stop();
      crystal.stop();
      noise.disconnect();
      filter.disconnect();
      crystal.disconnect();
    });
  }

  /** Wetland & Swamp: Damp lowpass murmurs, marsh drone, and procedural water droplet blips */
  private buildWetlandSynth(ctx: AudioContext, out: GainNode, cleanup: Array<() => void>) {
    const noise = this.createNoiseSource();
    if (!noise) return;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(360, ctx.currentTime);

    const drone = ctx.createOscillator();
    const droneGain = ctx.createGain();
    drone.type = "triangle";
    drone.frequency.setValueAtTime(74, ctx.currentTime);
    droneGain.gain.setValueAtTime(0.035, ctx.currentTime);

    noise.connect(filter);
    filter.connect(out);
    drone.connect(droneGain);
    droneGain.connect(out);

    noise.start();
    drone.start();

    // Procedural periodic water droplets
    const dropTimer = setInterval(() => {
      try {
        if (!this.audioCtx || this.ambientMuted) return;
        const now = this.audioCtx.currentTime;
        const dropOsc = this.audioCtx.createOscillator();
        const dropGain = this.audioCtx.createGain();

        const startFreq = 950 + Math.random() * 250;
        dropOsc.type = "sine";
        dropOsc.frequency.setValueAtTime(startFreq, now);
        dropOsc.frequency.exponentialRampToValueAtTime(380, now + 0.08);

        dropGain.gain.setValueAtTime(0.04, now);
        dropGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

        dropOsc.connect(dropGain);
        dropGain.connect(out);
        dropOsc.start(now);
        dropOsc.stop(now + 0.1);
      } catch {
        // Safe catch on disposal
      }
    }, 2800);

    cleanup.push(() => {
      clearInterval(dropTimer);
      noise.stop();
      drone.stop();
      noise.disconnect();
      filter.disconnect();
      drone.disconnect();
    });
  }

  /** Forest & Woodland: Rustling canopy foliage, gentle breeze LFO, and warm flora presence */
  private buildForestSynth(ctx: AudioContext, out: GainNode, cleanup: Array<() => void>) {
    const noise = this.createNoiseSource();
    if (!noise) return;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(650, ctx.currentTime);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(0.2, ctx.currentTime);
    lfoGain.gain.setValueAtTime(180, ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const flora = ctx.createOscillator();
    const floraGain = ctx.createGain();
    flora.type = "sine";
    flora.frequency.setValueAtTime(130, ctx.currentTime);
    floraGain.gain.setValueAtTime(0.015, ctx.currentTime);

    noise.connect(filter);
    filter.connect(out);
    flora.connect(floraGain);
    floraGain.connect(out);

    noise.start();
    lfo.start();
    flora.start();

    cleanup.push(() => {
      noise.stop();
      lfo.stop();
      flora.stop();
      noise.disconnect();
      filter.disconnect();
      flora.disconnect();
    });
  }

  /** Tropical Forest: Humid dual bandpass filter with high-frequency canopy insect trill */
  private buildTropicalSynth(ctx: AudioContext, out: GainNode, cleanup: Array<() => void>) {
    const noise = this.createNoiseSource();
    if (!noise) return;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(850, ctx.currentTime);
    filter.Q.setValueAtTime(2.0, ctx.currentTime);

    // Cicada / insect amplitude modulation
    const insectNoise = this.createNoiseSource();
    const insectFilter = ctx.createBiquadFilter();
    insectFilter.type = "bandpass";
    insectFilter.frequency.setValueAtTime(4200, ctx.currentTime);
    insectFilter.Q.setValueAtTime(7.0, ctx.currentTime);

    const insectLfo = ctx.createOscillator();
    const insectLfoGain = ctx.createGain();
    const insectMainGain = ctx.createGain();

    insectLfo.type = "sine";
    insectLfo.frequency.setValueAtTime(14, ctx.currentTime);
    insectLfoGain.gain.setValueAtTime(0.015, ctx.currentTime);
    insectMainGain.gain.setValueAtTime(0.012, ctx.currentTime);

    insectLfo.connect(insectLfoGain);
    insectLfoGain.connect(insectMainGain.gain);

    noise.connect(filter);
    filter.connect(out);

    if (insectNoise) {
      insectNoise.connect(insectFilter);
      insectFilter.connect(insectMainGain);
      insectMainGain.connect(out);
      insectNoise.start();
    }

    noise.start();
    insectLfo.start();

    cleanup.push(() => {
      noise.stop();
      insectLfo.stop();
      if (insectNoise) insectNoise.stop();
      noise.disconnect();
      filter.disconnect();
      insectFilter.disconnect();
    });
  }

  /** Marine & Coastal: Undulating ocean surf swells with deep 8-second wave cadence */
  private buildMarineSynth(ctx: AudioContext, out: GainNode, cleanup: Array<() => void>) {
    const noise = this.createNoiseSource();
    if (!noise) return;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(450, ctx.currentTime);

    // 0.12 Hz LFO = ~8.3 second wave period
    const swellLfo = ctx.createOscillator();
    const swellGain = ctx.createGain();
    swellLfo.type = "sine";
    swellLfo.frequency.setValueAtTime(0.12, ctx.currentTime);
    swellGain.gain.setValueAtTime(320, ctx.currentTime);

    swellLfo.connect(swellGain);
    swellGain.connect(filter.frequency);

    // Deep sub tide drone
    const tideSub = ctx.createOscillator();
    const tideGain = ctx.createGain();
    tideSub.type = "sine";
    tideSub.frequency.setValueAtTime(48, ctx.currentTime);
    tideGain.gain.setValueAtTime(0.045, ctx.currentTime);

    noise.connect(filter);
    filter.connect(out);
    tideSub.connect(tideGain);
    tideGain.connect(out);

    noise.start();
    swellLfo.start();
    tideSub.start();

    cleanup.push(() => {
      noise.stop();
      swellLfo.stop();
      tideSub.stop();
      noise.disconnect();
      filter.disconnect();
      tideSub.disconnect();
    });
  }

  /** Plains & Savanna: Warm expansive breeze with open prairie resonance */
  private buildPlainsSynth(ctx: AudioContext, out: GainNode, cleanup: Array<() => void>) {
    const noise = this.createNoiseSource();
    if (!noise) return;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(620, ctx.currentTime);
    filter.Q.setValueAtTime(1.8, ctx.currentTime);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(0.16, ctx.currentTime);
    lfoGain.gain.setValueAtTime(180, ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    noise.connect(filter);
    filter.connect(out);

    noise.start();
    lfo.start();

    cleanup.push(() => {
      noise.stop();
      lfo.stop();
      noise.disconnect();
      filter.disconnect();
    });
  }

  /** Urban & Burg Settlement: Warm market murmur triad and periodic blacksmith anvil strike */
  private buildUrbanSynth(ctx: AudioContext, out: GainNode, cleanup: Array<() => void>) {
    // Low warm harmonic triad simulating urban murmur (174Hz, 220Hz, 261Hz)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const triadGain = ctx.createGain();

    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(174, ctx.currentTime);
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(220, ctx.currentTime);

    triadGain.gain.setValueAtTime(0.015, ctx.currentTime);

    osc1.connect(triadGain);
    osc2.connect(triadGain);
    triadGain.connect(out);

    osc1.start();
    osc2.start();

    // Gentle street warmth filtered noise
    const noise = this.createNoiseSource();
    if (noise) {
      const nFilter = ctx.createBiquadFilter();
      nFilter.type = "lowpass";
      nFilter.frequency.setValueAtTime(400, ctx.currentTime);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.02, ctx.currentTime);

      noise.connect(nFilter);
      nFilter.connect(nGain);
      nGain.connect(out);
      noise.start();

      cleanup.push(() => {
        noise.stop();
        noise.disconnect();
      });
    }

    // Periodic distant blacksmith forge chime
    const anvilTimer = setInterval(() => {
      try {
        if (!this.audioCtx || this.ambientMuted) return;
        const now = this.audioCtx.currentTime;
        const pingOsc = this.audioCtx.createOscillator();
        const pingFilter = this.audioCtx.createBiquadFilter();
        const pingGain = this.audioCtx.createGain();

        pingOsc.type = "sine";
        pingOsc.frequency.setValueAtTime(1320, now);

        pingFilter.type = "bandpass";
        pingFilter.frequency.setValueAtTime(1320, now);
        pingFilter.Q.setValueAtTime(8.0, now);

        pingGain.gain.setValueAtTime(0.03, now);
        pingGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

        pingOsc.connect(pingFilter);
        pingFilter.connect(pingGain);
        pingGain.connect(out);

        pingOsc.start(now);
        pingOsc.stop(now + 0.4);
      } catch {
        // Safe catch on disposal
      }
    }, 4500);

    cleanup.push(() => {
      clearInterval(anvilTimer);
      osc1.stop();
      osc2.stop();
      osc1.disconnect();
      osc2.disconnect();
      triadGain.disconnect();
    });
  }

  /** Wilderness & Mountain: Mountain wind bandpass with deep crag resonance */
  private buildWildernessSynth(ctx: AudioContext, out: GainNode, cleanup: Array<() => void>) {
    const noise = this.createNoiseSource();
    if (!noise) return;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(680, ctx.currentTime);
    filter.Q.setValueAtTime(2.2, ctx.currentTime);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(0.11, ctx.currentTime);
    lfoGain.gain.setValueAtTime(260, ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const crag = ctx.createOscillator();
    const cragGain = ctx.createGain();
    crag.type = "sine";
    crag.frequency.setValueAtTime(65, ctx.currentTime);
    cragGain.gain.setValueAtTime(0.025, ctx.currentTime);

    noise.connect(filter);
    filter.connect(out);
    crag.connect(cragGain);
    cragGain.connect(out);

    noise.start();
    lfo.start();
    crag.start();

    cleanup.push(() => {
      noise.stop();
      lfo.stop();
      crag.stop();
      noise.disconnect();
      filter.disconnect();
      crag.disconnect();
    });
  }

  public stopAmbient() {
    if (this.currentSoundscape) {
      this.currentSoundscape.cleanup();
      this.currentSoundscape = null;
    }
  }
}

export const audioManager = new SoundManager();
