# MPC — MooN PES Competition (Mobile League Tracker)

A mobile-first competition tracker designed specifically for **PES / eFootball** player tournaments. Instead of team clubs, it tracks individual persons/players, provides a live Top 3 Podium leaderboard, full CRUD capabilities, strict duplicate name prevention with custom popup alerts, player activation/disabling, permanent match order numbering, and automatic football league standings sorting with 100% persistent storage (`localStorage`).

---

### Features & Highlights

1. **Live Dynamic Top 3 Podium Leaderboard**
   - Renders a tournament podium (1st Place Gold with crown in center, 2nd Place Silver on left, 3rd Place Bronze on right).
   - Dynamically recalculates and moves players across podium ranks in real-time as match results are recorded or edited.

2. **Player-Centric Competition (MPC Focus)**
   - Tracks individual people / players (e.g., Asad, Alex, Marcus, Leo) rather than clubs.
   - Assign custom PES playstyle tags and custom badge colors.

3. **Strict Duplicate Name Prevention with Cool Alert Popup**
   - Two players cannot have the same name (case-insensitive check).
   - Triggers an animated warning modal with a glowing alert ring instead of a boring browser alert.

4. **Player Enable / Disable Option**
   - Easily toggle a player between **Active** and **Disabled** with one tap.
   - Disabled players are paused from match scheduling (excluded from match creation dropdowns) while preserving their tournament match history.

5. **Permanent Match Count System**
   - No need to manually type or change round names.
   - Every recorded game is automatically assigned a permanent sequence (`Match #1`, `Match #2`, `Match #3`, etc.).

6. **Official Football League Standings Table**
   - Ranked according to standard football criteria:
     1. **Points (PTS)**: 3 points for a Win, 1 point for a Draw, 0 for a Loss.
     2. **Goal Difference (GD)**: `GF - GA`.
     3. **Goals For (GF)**: Total goals scored.
     4. **Head-to-Head (H2H)**: Direct points and goal difference between tied players.
     5. **Player Name**: Alphabetical fallback.
   - Columns: **Rank (#)**, **Player**, **P** (Played), **W** (Won), **D** (Drawn), **L** (Lost), **GF** (Goals For), **GA** (Goals Against), **GD** (Goal Difference), **PTS** (Points), **Form** (Last 5 matches with W/D/L badges).

7. **100% Persistent Storage (`localStorage`) & Reset Action**
   - All player profiles, disabled statuses, scores, and match logs persist when closing or reloading the app.
   - Includes a dedicated **Reset All League Data** action located directly in the **Players** tab protected by a custom confirmation popup alert before wiping data.

8. **Tournament Honors & Stats**
   - Golden Boot (Top Scorer), Best Defense (Wall), Match Winner Specialist.

6. **Mobile App Design**
   - Native mobile app feel with bottom tab navigation (`Table`, `Matches`, `Players`, `Stats`).
   - Dark eSports / PES aesthetic with glowing neon accents.
   - Installable as a Progressive Web App (PWA) on iOS & Android.

---

### How to Run

You can open `index.html` directly in any web browser, or start a local server:

```bash
cd /home/asad/.gemini/antigravity/scratch/pes-league-tracker
python3 -m http.server 3000
```

Then visit:
```
http://localhost:3000
```
