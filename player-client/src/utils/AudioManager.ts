// Audio Manager for Fantasy Map Generator & Aetheria Player Client
// Manages Background Music (BGM) & Sound Effects (SFX)

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  src: string;
}

export const MUSIC_PLAYLIST: MusicTrack[] = [
  { id: 'regular', title: "Goblins' Den", artist: 'Minifantasy Dungeon OST (Leohpaz)', src: '/audio/music/goblins_den_regular.wav' },
  { id: 'battle', title: "Goblins' Dance (Battle)", artist: 'Minifantasy Dungeon OST (Leohpaz)', src: '/audio/music/goblins_dance_battle.wav' }
];

export const SFX_LIBRARY = {
  step: [
    '/audio/sfx/16_human_walk_stone_1.wav',
    '/audio/sfx/16_human_walk_stone_2.wav',
    '/audio/sfx/16_human_walk_stone_3.wav'
  ],
  attack: [
    '/audio/sfx/07_human_atk_sword_1.wav',
    '/audio/sfx/07_human_atk_sword_2.wav',
    '/audio/sfx/07_human_atk_sword_3.wav'
  ],
  hit: [
    '/audio/sfx/26_sword_hit_1.wav',
    '/audio/sfx/26_sword_hit_2.wav',
    '/audio/sfx/26_sword_hit_3.wav'
  ],
  miss: [
    '/audio/sfx/27_sword_miss_1.wav',
    '/audio/sfx/27_sword_miss_2.wav',
    '/audio/sfx/27_sword_miss_3.wav'
  ],
  damage: [
    '/audio/sfx/11_human_damage_1.wav',
    '/audio/sfx/11_human_damage_2.wav',
    '/audio/sfx/11_human_damage_3.wav'
  ],
  death: [
    '/audio/sfx/14_human_death_spin.wav'
  ],
  chest: [
    '/audio/sfx/01_chest_open_1.wav',
    '/audio/sfx/01_chest_open_2.wav',
    '/audio/sfx/01_chest_open_3.wav',
    '/audio/sfx/01_chest_open_4.wav'
  ],
  door: [
    '/audio/sfx/05_door_open_1.mp3',
    '/audio/sfx/05_door_open_2.mp3'
  ],
  special: [
    '/audio/sfx/10_human_special_atk_1.wav',
    '/audio/sfx/10_human_special_atk_2.wav'
  ]
};

class SoundManager {
  private musicAudio: HTMLAudioElement | null = null;
  private currentTrackIndex = 0;
  private musicVolume = 0.35;
  private sfxVolume = 0.55;
  private musicMuted = false;
  private sfxMuted = false;
  private isPlayingMusic = false;
  private lastStepTime = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initAudio();
    }
  }

  private initAudio() {
    try {
      this.musicAudio = new Audio();
      this.musicAudio.volume = this.musicVolume;
      this.musicAudio.addEventListener('ended', () => {
        this.nextTrack();
      });
    } catch {
      // Audio not supported or blocked
    }
  }

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

  public getMusicVolume(): number {
    return this.musicVolume;
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  public playMusic(index?: number) {
    if (typeof window === 'undefined') return;
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
      // Autoplay blocked until user interaction
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
    const battleIndex = MUSIC_PLAYLIST.findIndex(t => t.id === 'battle');
    if (battleIndex !== -1 && this.currentTrackIndex !== battleIndex) {
      this.playMusic(battleIndex);
    }
  }

  public playExplorationMusic() {
    const regularIndex = MUSIC_PLAYLIST.findIndex(t => t.id === 'regular');
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

  public toggleMuteMusic() {
    this.musicMuted = !this.musicMuted;
    if (this.musicAudio) {
      this.musicAudio.volume = this.musicMuted ? 0 : this.musicVolume;
    }
  }

  public toggleMuteSfx() {
    this.sfxMuted = !this.sfxMuted;
  }

  // Play Sound Effect from Library
  public playSfx(type: keyof typeof SFX_LIBRARY) {
    if (this.sfxMuted || typeof window === 'undefined') return;

    const files = SFX_LIBRARY[type];
    if (!files || files.length === 0) return;

    // Pick random variant
    const src = files[Math.floor(Math.random() * files.length)];
    try {
      const sound = new Audio(src);
      sound.volume = this.sfxVolume;
      // Slight pitch variation for variety
      sound.playbackRate = 0.95 + Math.random() * 0.1;
      sound.play().catch(() => {});
    } catch {
      // Ignore audio error
    }
  }

  // Throttled footstep sound for walking on tiles
  public playStep() {
    const now = Date.now();
    if (now - this.lastStepTime > 260) {
      this.lastStepTime = now;
      this.playSfx('step');
    }
  }
}

export const audioManager = new SoundManager();
