export type WordPoolPhase = "early" | "mid" | "late" | "boss";

export interface LevelConfig {
  id: string;
  name: string;
  order: number;
  backgroundId: string;
  musicId: string;
  playerSkinId: string;
  enemyPool: string[];
  bossId: string;
  wordPools: Record<WordPoolPhase, string[]>;
  spawnRules: {
    baseRate: number;
    rateRampPerMinute: number;
    maxConcurrentEnemies: number;
    bossSpawnTimeSec: number;
  };
  difficultyRules: {
    startWordLength: number;
    maxWordLength: number;
    wordComplexityRamp: number;
    enemyVarietyUnlockTimeSec: number;
  };
  scoringRules: {
    pointsPerLetterHit: number;
    pointsPerEnemyKill: number;
    pointsPerBossKill: number;
    comboBonusPerTier: number;
  };
  lifeRules: {
    startingLives: number;
    damageOnEnemyReachPlayer: number;
  };
  completionRules: {
    bossRequired: boolean;
    autoAdvanceOnBossDefeat: boolean;
  };
}

export interface EnemyConfig {
  id: string;
  name: string;
  spriteId: string;
  animations: {
    run: string;
    hit: string;
    death: string;
  };
  moveSpeed: number;
  spawnWeight: number;
  wordDifficultyBias: number;
  hitEffectId: string;
  deathEffectId: string;
  tags: string[];
  specialBehaviorHook?: string | null;
}

export interface BossConfig {
  id: string;
  name: string;
  spriteId: string;
  animations: {
    intro: string;
    idle: string;
    hit: string;
    death: string;
  };
  bossWordMode: "singleLongWord" | "multiPhaseWords";
  wordData: {
    value?: string;
    phases?: string[];
  };
  hitEffectId: string;
  deathEffectId: string;
  bonusScore: number;
  behaviorMetadata: Record<string, number | string>;
}
