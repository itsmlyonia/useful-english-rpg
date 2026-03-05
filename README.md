# Useful English RPG

A mobile-styled battle game where your vocabulary is your weapon!

## How to Play

1. **Start the Game:**
   ```bash
   npm run dev
   ```
2. **Open in Browser:**
   - Go to `http://localhost:5173`.
   - Use your browser's "Mobile View" (F12 -> Ctrl+Shift+M) for the best experience.

## Gameplay
- **Attack:** Type any valid English word.
- **Damage:** Longer words deal more damage.
  - Length > 5: +10 Bonus
  - Length > 8: +20 Bonus
  - Complex words (many unique letters): 1.5x Crit Multiplier
- **Defense:** The Syntax Error monster attacks back every turn!
- **Victory:** Reduce the monster's HP to 0.

## Dictionary
The game fetches a 10,000 word dictionary from GitHub on startup. If offline, it falls back to a simple mode where any word > 2 letters counts.
