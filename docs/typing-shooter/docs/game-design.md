# Game Design

## Core loop
- Player runs continuously.
- Enemies enter from the right.
- Each enemy has a target word.
- Correct keypresses:
  - fire a bullet
  - register a hit
  - award points
- Completing a word destroys the enemy.
- If an enemy reaches the player, the player loses a life.
- Each level ramps difficulty and ends with a boss.

## Player state
- 3 starting lives
- running animation during gameplay
- shooting feedback on each correct letter
- game over at 0 lives

## Boss
- Appears after wave progression or timer threshold
- Uses a longer word or multi-phase words
- Defeat ends the level
