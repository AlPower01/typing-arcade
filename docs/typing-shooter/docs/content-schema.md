# Content Schemas

## Level config
- id
- name
- order
- backgroundId
- musicId
- playerSkinId
- enemyPool
- bossId
- wordPools
- spawnRules
- difficultyRules
- scoringRules
- lifeRules
- completionRules

## Enemy config
- id
- name
- spriteId
- animations
- moveSpeed
- spawnWeight
- wordDifficultyBias
- hitEffectId
- deathEffectId
- tags
- specialBehaviorHook

## Boss config
- id
- name
- spriteId
- animations
- bossWordMode
- wordData
- hitEffectId
- deathEffectId
- bonusScore
- behaviorMetadata

## Instance map
The instance map links each level to the exact scene, player skin, enemies, boss, bullet effect, hit effect, explosion effect, and UI skin IDs used at runtime.
