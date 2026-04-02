# AGENTS.md

## Project goal
Build a side-scrolling typing shooter where:
- the player is always running
- enemies enter from the right
- each enemy has a word above its head
- each correct typed letter fires one bullet
- each hit awards score
- completing the full word destroys the enemy in an explosion
- the player has 3 lives
- each level ends with a boss that uses a longer word or multiple phases
- levels have distinct backgrounds, enemy sets, bosses, and themed word pools

## Architecture rules
- Keep gameplay systems generic and data-driven.
- Never hardcode level-specific asset paths in gameplay systems.
- All game content must live under `src/content/`.
- All assets must be referenced through manifest IDs.
- Prefer adding content files over changing engine code.
- Keep typing, bullets, combat, scoring, lives, spawning, and boss flow in separate systems.
- Validate content through scripts in `tools/`.

## Main systems
- typing-system
- target-system
- bullet-system
- combat-system
- enemy-spawn-system
- difficulty-system
- scoring-system
- life-system
- boss-system
- progression-system

## How to add a new level
1. Add a new file in `src/content/levels/`
2. Add any new enemy config in `src/content/enemies/`
3. Add a boss config in `src/content/bosses/`
4. Add themed word lists in `src/content/wordlists/`
5. Register new assets in the manifest files
6. Do not duplicate engine logic in scene code

## How to add a new enemy
1. Add its sprite and animation assets
2. Register them in `characters.manifest.json`
3. Create a config file in `src/content/enemies/`
4. Reference its ID inside one or more level enemy pools

## How to add a new boss
1. Add boss art and animation assets
2. Register them in `characters.manifest.json` and effect manifests
3. Create a config in `src/content/bosses/`
4. Reference its ID from a level file
