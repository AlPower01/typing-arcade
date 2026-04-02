export const difficultyAt = (seconds: number) => Math.min(1 + seconds / 60, 5);
