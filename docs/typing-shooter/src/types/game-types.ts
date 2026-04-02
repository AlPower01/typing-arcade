export interface WordProgress {
  fullWord: string;
  typedCount: number;
}

export interface ActorInstance {
  id: string;
  type: "player" | "enemy" | "boss";
  configId: string;
  spriteId: string;
  x: number;
  y: number;
}

export interface ScoreEvent {
  reason: "letter-hit" | "enemy-kill" | "boss-kill" | "combo";
  value: number;
}
