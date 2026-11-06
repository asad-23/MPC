/**
 * MPC - MooN PES Competition (Mobile League Tracker)
 * Standings calculation according to standard football league rules,
 * Dynamic Top 3 Podium Leaderboard, Duplicate name cool popup validation,
 * Player Active/Disabled toggle, and Permanent auto-assigned Match numbers.
 */

const STORAGE_KEY = 'mpc_moon_pes_league_data_v2';

class MPCLeagueApp {
  constructor() {
    this.players = [];
    this.matches = [];
    this.activeTab = 'tab-standings';

    this.init();
  }

  init() {
    this.loadData();
    this.setupEventListeners();
    this.renderAll();
  }

  // --- LocalStorage & Persistence ---
  loadData() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.players = Array.isArray(parsed.players) ? parsed.players : [];
        this.matches = Array.isArray(parsed.matches) ? parsed.matches : [];
      } else {
        // Fallback check old key if any
        const oldStored = localStorage.getItem('pes_league_tournament_data_v1');
        if (oldStored) {
          const parsed = JSON.parse(oldStored);
          this.players = Array.isArray(parsed.players) ? parsed.players : [];
          this.matches = Array.isArray(parsed.matches) ? parsed.matches : [];
          this.saveData();
        } else {
          this.loadDefaultDemoData();
        }
      }
    } catch (e) {
      console.error('Failed to parse saved tournament data:', e);
      this.loadDefaultDemoData();
    }
  }

  saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        appName: 'MooN PES Competition (MPC)',
        players: this.players,
        matches: this.matches,
        lastUpdated: new Date().toISOString()
      }));
    } catch (e) {
      console.error('Error saving data to localStorage:', e);
    }
  }

  loadDefaultDemoData() {
    this.players = [
      { id: 'p_1', name: 'Alex', tag: 'Counter-Attack Specialist', color: '#00e5ff', disabled: false, createdAt: Date.now() - 400000 },
      { id: 'p_2', name: 'Marcus', tag: 'Possession King', color: '#00e676', disabled: false, createdAt: Date.now() - 300000 },
      { id: 'p_3', name: 'Leo', tag: 'Tiki-Taka Master', color: '#3b82f6', disabled: false, createdAt: Date.now() - 200000 },
      { id: 'p_4', name: 'Zaid', tag: 'High Pressing', color: '#f59e0b', disabled: false, createdAt: Date.now() - 100000 }
    ];

    this.matches = [
      { id: 'm_1', matchNumber: 1, player1Id: 'p_1', player2Id: 'p_2', score1: 3, score2: 1, timestamp: Date.now() - 180000 },
      { id: 'm_2', matchNumber: 2, player1Id: 'p_3', player2Id: 'p_4', score1: 2, score2: 2, timestamp: Date.now() - 120000 },
      { id: 'm_3', matchNumber: 3, player1Id: 'p_1', player2Id: 'p_3', score1: 1, score2: 0, timestamp: Date.now() - 60000 },
      { id: 'm_4', matchNumber: 4, player1Id: 'p_2', player2Id: 'p_4', score1: 4, score2: 2, timestamp: Date.now() - 30000 }
    ];

    this.saveData();
  }

  // --- League Table Calculation & Football Tiebreaking Rules ---
  calculateStandings() {
    // 1. Initialize stats object for every player
    const statsMap = {};
    for (const player of this.players) {
      statsMap[player.id] = {
        player: player,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        pts: 0,
        matchesHistory: []
      };
    }

    // 2. Sort matches chronologically to track form correctly
    const sortedMatches = [...this.matches].sort((a, b) => a.timestamp - b.timestamp);

    for (const match of sortedMatches) {
      const p1Stats = statsMap[match.player1Id];
      const p2Stats = statsMap[match.player2Id];

      if (!p1Stats || !p2Stats) continue;

      const s1 = Number(match.score1);
      const s2 = Number(match.score2);

      p1Stats.played += 1;
      p2Stats.played += 1;

      p1Stats.gf += s1;
      p1Stats.ga += s2;
      p2Stats.gf += s2;
      p2Stats.ga += s1;

      if (s1 > s2) {
        // Player 1 Won
        p1Stats.won += 1;
        p1Stats.pts += 3;
        p1Stats.matchesHistory.push('W');

        p2Stats.lost += 1;
        p2Stats.matchesHistory.push('L');
      } else if (s1 < s2) {
        // Player 2 Won
        p2Stats.won += 1;
        p2Stats.pts += 3;
        p2Stats.matchesHistory.push('W');

        p1Stats.lost += 1;
        p1Stats.matchesHistory.push('L');
      } else {
        // Draw
        p1Stats.drawn += 1;
        p1Stats.pts += 1;
        p1Stats.matchesHistory.push('D');

        p2Stats.drawn += 1;
        p2Stats.pts += 1;
        p2Stats.matchesHistory.push('D');
      }
    }

    // 3. Compute Goal Differences and isolate form to last 5
    const standingsList = Object.values(statsMap).map(item => {
      item.gd = item.gf - item.ga;
      item.form = item.matchesHistory.slice(-5);
      return item;
    });

    // 4. Sort table according to standard football league rules:
    // 1st: Points (desc)
    // 2nd: Goal Difference (desc)
    // 3rd: Goals For (desc)
    // 4th: Head-to-Head between tied players
    // 5th: Player Name (alphabetical)
    standingsList.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;

      const h2h = this.calculateHeadToHead(a.player.id, b.player.id);
      if (h2h.ptsDiff !== 0) return h2h.ptsDiff;
      if (h2h.gdDiff !== 0) return h2h.gdDiff;
      if (h2h.gfDiff !== 0) return h2h.gfDiff;

      return a.player.name.localeCompare(b.player.name);
    });

    return standingsList;
  }

  calculateHeadToHead(playerAId, playerBId) {
    let aPts = 0;
    let bPts = 0;
    let aGf = 0;
    let bGf = 0;

    for (const m of this.matches) {
      if ((m.player1Id === playerAId && m.player2Id === playerBId) ||
          (m.player1Id === playerBId && m.player2Id === playerAId)) {
        
        const aScore = m.player1Id === playerAId ? m.score1 : m.score2;
        const bScore = m.player1Id === playerAId ? m.score2 : m.score1;

        aGf += aScore;
        bGf += bScore;

        if (aScore > bScore) aPts += 3;
        else if (bScore > aScore) bPts += 3;
        else { aPts += 1; bPts += 1; }
      }
    }

    return {
      ptsDiff: bPts - aPts,
      gdDiff: (bGf - aGf) - (aGf - bGf),
      gfDiff: bGf - aGf
    };
  }

  // --- Dynamic Podium Leaderboard Rendering ---
  renderPodium() {
    const podiumContainer = document.getElementById('podium-leaderboard');
    if (!podiumContainer) return;

    const standings = this.calculateStandings();

    if (standings.length === 0) {
      podiumContainer.style.display = 'none';
      return;
    }

    podiumContainer.style.display = 'flex';

    const p1 = standings[0] || null;
    const p2 = standings[1] || null;
    const p3 = standings[2] || null;

    const renderSpot = (entry, rank, spotClass) => {
      if (!entry) {
        return `
          <div class="podium-spot ${spotClass}">
            <div class="podium-avatar-wrapper">
              <div class="podium-avatar" style="background:#1a233a; border-color:#2a3650; color:#64748b;">-</div>
              <span class="podium-rank-tag">${rank}</span>
            </div>
            <div class="podium-player-name" style="color:#64748b;">Waiting</div>
            <span class="podium-stats-badge">-</span>
          </div>
        `;
      }

      const initial = entry.player.name ? entry.player.name.charAt(0).toUpperCase() : '?';
      const gdSign = entry.gd > 0 ? `+${entry.gd}` : entry.gd;
      const isFirst = rank === 1;

      return `
        <div class="podium-spot ${spotClass}">
          ${isFirst ? `
            <div class="podium-crown">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5m14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
              </svg>
            </div>
          ` : ''}
          <div class="podium-avatar-wrapper">
            <div class="podium-avatar" style="background-color: ${entry.player.color || '#3b82f6'};">
              ${initial}
            </div>
            <span class="podium-rank-tag">${rank}</span>
          </div>
          <div class="podium-player-name" title="${this.escapeHtml(entry.player.name)}">
            ${this.escapeHtml(entry.player.name)}
          </div>
          <span class="podium-stats-badge">${entry.pts} PTS <span style="opacity:0.75; font-size:9px;">(${gdSign} GD)</span></span>
        </div>
      `;
    };

    podiumContainer.innerHTML = `
      ${renderSpot(p2, 2, 'spot-2')}
      ${renderSpot(p1, 1, 'spot-1')}
      ${renderSpot(p3, 3, 'spot-3')}
    `;
  }

  // --- Rendering Functions ---
  renderAll() {
    this.renderHeader();
    this.renderPodium();
    this.renderStandings();
    this.renderMatches();
    this.renderPlayers();
    this.renderStats();
    this.populatePlayerDropdowns();
  }

  renderHeader() {
    const matchCountEl = document.getElementById('header-match-count');
    if (matchCountEl) {
      matchCountEl.textContent = `${this.matches.length} Match${this.matches.length === 1 ? '' : 'es'} Recorded`;
    }
  }

  renderStandings() {
    const tbody = document.getElementById('standings-tbody');
    const emptyState = document.getElementById('standings-empty-state');
    const tableCard = document.querySelector('.standings-card');
    const playerCountEl = document.getElementById('standings-player-count');

    const standings = this.calculateStandings();

    if (playerCountEl) {
      playerCountEl.textContent = `${standings.length} Player${standings.length === 1 ? '' : 's'}`;
    }

    if (standings.length === 0) {
      if (tableCard) tableCard.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (tableCard) tableCard.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    tbody.innerHTML = '';

    standings.forEach((entry, index) => {
      const rank = index + 1;
      const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';
      
      const tr = document.createElement('tr');
      tr.className = rankClass;

      const gdDisplay = entry.gd > 0 ? `+${entry.gd}` : entry.gd;
      const gdClass = entry.gd > 0 ? 'gd-positive' : entry.gd < 0 ? 'gd-negative' : '';

      let formHtml = '<div class="form-pill-container">';
      if (entry.form.length === 0) {
        formHtml += '<span style="color:var(--text-dim);font-size:10px;">-</span>';
      } else {
        entry.form.forEach(f => {
          formHtml += `<span class="form-pill ${f.toLowerCase()}">${f}</span>`;
        });
      }
      formHtml += '</div>';

      const initial = entry.player.name ? entry.player.name.charAt(0).toUpperCase() : '?';
      const playerColor = entry.player.color || '#3b82f6';
      const isDisabled = entry.player.disabled === true;

      tr.innerHTML = `
        <td class="col-rank">
          <span class="rank-badge">${rank}</span>
        </td>
        <td class="col-player">
          <div class="player-info-cell" style="${isDisabled ? 'opacity: 0.6;' : ''}">
            <div class="player-avatar-small" style="background-color: ${playerColor}">
              ${initial}
            </div>
            <div>
              <div class="player-name-text">
                ${this.escapeHtml(entry.player.name)}
                ${isDisabled ? '<span style="font-size:9px;color:var(--accent-red);font-weight:700;margin-left:4px;">(Inactive)</span>' : ''}
              </div>
              ${entry.player.tag ? `<span class="player-tag">${this.escapeHtml(entry.player.tag)}</span>` : ''}
            </div>
          </div>
        </td>
        <td>${entry.played}</td>
        <td>${entry.won}</td>
        <td>${entry.drawn}</td>
        <td>${entry.lost}</td>
        <td>${entry.gf}</td>
        <td>${entry.ga}</td>
        <td class="col-gd ${gdClass}">${gdDisplay}</td>
        <td class="col-pts">${entry.pts}</td>
        <td>${formHtml}</td>
      `;

      tbody.appendChild(tr);
    });
  }

  renderMatches() {
    const listContainer = document.getElementById('matches-list-container');
    const emptyState = document.getElementById('matches-empty-state');
    const countBadge = document.getElementById('matches-list-count');

    if (countBadge) {
      countBadge.textContent = this.matches.length;
    }

    if (this.matches.length === 0) {
      if (listContainer) listContainer.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    // Show recent matches first
    const sorted = [...this.matches].sort((a, b) => b.timestamp - a.timestamp);

    listContainer.innerHTML = '';

    sorted.forEach((match) => {
      const p1 = this.getPlayerById(match.player1Id);
      const p2 = this.getPlayerById(match.player2Id);

      const p1Name = p1 ? p1.name : 'Unknown Player';
      const p2Name = p2 ? p2.name : 'Unknown Player';
      const p1Color = p1 ? p1.color : '#64748b';
      const p2Color = p2 ? p2.color : '#64748b';

      const s1 = Number(match.score1);
      const s2 = Number(match.score2);

      const isP1Winner = s1 > s2;
      const isP2Winner = s2 > s1;

      const dateStr = match.timestamp ? new Date(match.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const matchNumText = `Match #${match.matchNumber || match.id}`;

      const card = document.createElement('div');
      card.className = 'match-card';

      card.innerHTML = `
        <div class="match-card-header">
          <div class="match-meta-info">
            <span class="match-status-badge">MPC FT</span>
            <span style="font-weight:700; color:var(--accent-cyan);">${matchNumText}</span>
            ${dateStr ? `<span>• ${dateStr}</span>` : ''}
          </div>
          <div class="match-actions-btns">
            <button class="mini-icon-btn" title="Edit Match" onclick="app.editMatch('${match.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="mini-icon-btn delete-btn" title="Delete Match" onclick="app.deleteMatch('${match.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>

        <div class="match-scoreboard">
          <div class="match-player-side">
            <div class="player-avatar-small" style="background-color: ${p1Color}">
              ${p1Name.charAt(0).toUpperCase()}
            </div>
            <span class="player-side-name ${isP1Winner ? 'winner' : ''}">${this.escapeHtml(p1Name)}</span>
          </div>

          <div class="match-score-display">
            <span class="score-digit" style="${isP1Winner ? 'color: var(--accent-cyan);' : ''}">${s1}</span>
            <span class="score-divider">-</span>
            <span class="score-digit" style="${isP2Winner ? 'color: var(--accent-cyan);' : ''}">${s2}</span>
          </div>

          <div class="match-player-side p2">
            <div class="player-avatar-small" style="background-color: ${p2Color}">
              ${p2Name.charAt(0).toUpperCase()}
            </div>
            <span class="player-side-name ${isP2Winner ? 'winner' : ''}">${this.escapeHtml(p2Name)}</span>
          </div>
        </div>
      `;

      listContainer.appendChild(card);
    });
  }

  renderPlayers() {
    const listContainer = document.getElementById('players-list-container');
    const resetSection = document.getElementById('players-reset-section');
    if (!listContainer) return;

    if (resetSection) {
      resetSection.style.display = this.players.length > 0 ? 'block' : 'none';
    }

    if (this.players.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <h3>No Players Registered</h3>
          <p>Add individual PES players to track their stats, match history, and ranking.</p>
          <button class="btn-secondary" onclick="app.openPlayerModal()">+ Add Player</button>
        </div>
      `;
      return;
    }

    const standings = this.calculateStandings();
    const statsById = {};
    standings.forEach(s => { statsById[s.player.id] = s; });

    listContainer.innerHTML = '';

    this.players.forEach(player => {
      const stats = statsById[player.id] || { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, pts: 0 };
      const initial = player.name ? player.name.charAt(0).toUpperCase() : '?';
      const isDisabled = player.disabled === true;

      const card = document.createElement('div');
      card.className = `player-card ${isDisabled ? 'is-disabled' : ''}`;

      card.innerHTML = `
        <div class="player-main-col">
          <div class="player-avatar-large" style="background-color: ${player.color || '#3b82f6'}">
            ${initial}
          </div>
          <div>
            <div class="player-card-name">${this.escapeHtml(player.name)}</div>
            <div class="player-card-handle">${this.escapeHtml(player.tag || 'PES Competitor')}</div>
            ${isDisabled ? '<span class="disabled-pill-badge">Disabled</span>' : ''}
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 10px;">
          <div class="player-card-stats">
            <div class="player-stat-item">
              <span class="stat-item-label">PTS</span>
              <span class="stat-item-value" style="color:var(--accent-cyan); font-size:15px;">${stats.pts}</span>
            </div>
          </div>

          <!-- Status toggle button -->
          <button class="toggle-status-btn ${isDisabled ? 'disabled-state' : 'active-state'}" 
                  onclick="app.togglePlayerStatus('${player.id}')" 
                  title="${isDisabled ? 'Enable player for matches' : 'Disable player from new matches'}">
            ${isDisabled ? 'Enable' : 'Disable'}
          </button>

          <div class="player-card-actions">
            <button class="mini-icon-btn" title="Edit Player" onclick="app.editPlayer('${player.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="mini-icon-btn delete-btn" title="Delete Player" onclick="app.deletePlayer('${player.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      `;

      listContainer.appendChild(card);
    });
  }

  togglePlayerStatus(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;

    player.disabled = !player.disabled;
    this.saveData();
    this.renderAll();
    this.showToast(`${player.name} is now ${player.disabled ? 'Disabled' : 'Active'}`);
  }

  renderStats() {
    const statsContainer = document.getElementById('stats-container');
    if (!statsContainer) return;

    const standings = this.calculateStandings();
    const totalMatches = this.matches.length;
    let totalGoals = 0;
    this.matches.forEach(m => { totalGoals += (Number(m.score1) + Number(m.score2)); });
    const avgGoals = totalMatches > 0 ? (totalGoals / totalMatches).toFixed(1) : '0.0';

    let topScorer = null;
    let bestDefense = null;
    let mostWins = null;

    if (standings.length > 0) {
      const byGf = [...standings].sort((a, b) => b.gf - a.gf);
      if (byGf[0] && byGf[0].gf > 0) topScorer = byGf[0];

      const playedPlayers = standings.filter(s => s.played > 0);
      if (playedPlayers.length > 0) {
        const byGa = [...playedPlayers].sort((a, b) => (a.ga / a.played) - (b.ga / b.played));
        bestDefense = byGa[0];
      }

      const byWins = [...standings].sort((a, b) => b.won - a.won);
      if (byWins[0] && byWins[0].won > 0) mostWins = byWins[0];
    }

    statsContainer.innerHTML = `
      <div class="stat-hero-card">
        <div class="stat-hero-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
          MooN PES Competition Overview
        </div>
        <div class="leader-item">
          <span class="leader-name">Total Matches Logged</span>
          <span class="leader-val">${totalMatches}</span>
        </div>
        <div class="leader-item">
          <span class="leader-name">Total Goals Scored</span>
          <span class="leader-val">${totalGoals}</span>
        </div>
        <div class="leader-item">
          <span class="leader-name">Goals Per Match Ratio</span>
          <span class="leader-val">${avgGoals}</span>
        </div>
        <div class="leader-item">
          <span class="leader-name">Registered Competitors</span>
          <span class="leader-val">${this.players.length}</span>
        </div>
      </div>

      <div class="stat-hero-card">
        <div class="stat-hero-header" style="color: var(--accent-gold);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="8" r="7"></circle>
            <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
          </svg>
          MPC Top Honors
        </div>

        <div class="leader-item">
          <div>
            <div class="leader-name">Golden Boot (Top Scorer)</div>
            <div style="font-size:11px;color:var(--text-muted);">
              ${topScorer ? this.escapeHtml(topScorer.player.name) : 'No goals logged'}
            </div>
          </div>
          <span class="leader-val">${topScorer ? `${topScorer.gf} Goals` : '-'}</span>
        </div>

        <div class="leader-item">
          <div>
            <div class="leader-name">Best Defense (Wall)</div>
            <div style="font-size:11px;color:var(--text-muted);">
              ${bestDefense ? this.escapeHtml(bestDefense.player.name) : 'No matches'}
            </div>
          </div>
          <span class="leader-val">
            ${bestDefense ? `${bestDefense.ga} GA (${(bestDefense.ga / bestDefense.played).toFixed(1)}/m)` : '-'}
          </span>
        </div>

        <div class="leader-item">
          <div>
            <div class="leader-name">Match Winner Specialist</div>
            <div style="font-size:11px;color:var(--text-muted);">
              ${mostWins ? this.escapeHtml(mostWins.player.name) : 'None'}
            </div>
          </div>
          <span class="leader-val">${mostWins ? `${mostWins.won} Wins` : '-'}</span>
        </div>
      </div>
    `;
  }

  populatePlayerDropdowns() {
    const p1Select = document.getElementById('match-player1');
    const p2Select = document.getElementById('match-player2');
    if (!p1Select || !p2Select) return;

    const currentP1 = p1Select.value;
    const currentP2 = p2Select.value;

    p1Select.innerHTML = '<option value="">Select Player 1</option>';
    p2Select.innerHTML = '<option value="">Select Player 2</option>';

    // Filter out disabled players from new matches
    const activePlayers = this.players.filter(p => !p.disabled);

    this.players.forEach(p => {
      const isDis = p.disabled === true;
      const opt1 = document.createElement('option');
      opt1.value = p.id;
      opt1.textContent = isDis ? `${p.name} (Disabled)` : p.name;
      opt1.disabled = isDis;
      p1Select.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = p.id;
      opt2.textContent = isDis ? `${p.name} (Disabled)` : p.name;
      opt2.disabled = isDis;
      p2Select.appendChild(opt2);
    });

    if (currentP1 && this.players.some(p => p.id === currentP1)) {
      p1Select.value = currentP1;
    }
    if (currentP2 && this.players.some(p => p.id === currentP2)) {
      p2Select.value = currentP2;
    }
  }

  // --- CRUD: Match Operations with Permanent Match Count ---
  openMatchModal(matchToEdit = null) {
    const activePlayers = this.players.filter(p => !p.disabled);
    if (activePlayers.length < 2) {
      this.showCoolAlert(
        'Not Enough Active Players!',
        'You need at least 2 active players to record a match. Please add new players or enable disabled players in the Players tab.',
        null
      );
      return;
    }

    const modal = document.getElementById('modal-match');
    const title = document.getElementById('match-modal-title');
    const editIdInput = document.getElementById('match-edit-id');
    const p1Select = document.getElementById('match-player1');
    const p2Select = document.getElementById('match-player2');
    const s1Input = document.getElementById('match-score1');
    const s2Input = document.getElementById('match-score2');
    const permMatchNum = document.getElementById('modal-perm-match-num');
    const deleteBtn = document.getElementById('btn-delete-match');

    this.populatePlayerDropdowns();

    if (matchToEdit) {
      title.innerHTML = 'Edit PES Match';
      editIdInput.value = matchToEdit.id;
      p1Select.value = matchToEdit.player1Id;
      p2Select.value = matchToEdit.player2Id;
      s1Input.value = matchToEdit.score1;
      s2Input.value = matchToEdit.score2;
      if (permMatchNum) {
        permMatchNum.textContent = `Match #${matchToEdit.matchNumber || matchToEdit.id}`;
      }
      if (deleteBtn) deleteBtn.style.display = 'block';
    } else {
      title.innerHTML = 'Record PES Match';
      editIdInput.value = '';
      p1Select.value = activePlayers[0] ? activePlayers[0].id : '';
      p2Select.value = activePlayers[1] ? activePlayers[1].id : '';
      s1Input.value = '0';
      s2Input.value = '0';
      const nextMatchNum = this.getNextMatchNumber();
      if (permMatchNum) {
        permMatchNum.textContent = `Match #${nextMatchNum}`;
      }
      if (deleteBtn) deleteBtn.style.display = 'none';
    }

    modal.classList.add('open');
  }

  getNextMatchNumber() {
    let max = 0;
    for (const m of this.matches) {
      const num = Number(m.matchNumber) || 0;
      if (num > max) max = num;
    }
    return max + 1;
  }

  handleSaveMatch(event) {
    event.preventDefault();
    const editId = document.getElementById('match-edit-id').value;
    const p1Id = document.getElementById('match-player1').value;
    const p2Id = document.getElementById('match-player2').value;
    const s1 = parseInt(document.getElementById('match-score1').value, 10);
    const s2 = parseInt(document.getElementById('match-score2').value, 10);

    if (!p1Id || !p2Id) {
      this.showCoolAlert('Select Both Players', 'Please select both Player 1 and Player 2 for this match.', null);
      return;
    }

    if (p1Id === p2Id) {
      this.showCoolAlert('Invalid Match Selection', 'Player 1 and Player 2 cannot be the same person.', null);
      return;
    }

    if (isNaN(s1) || s1 < 0 || isNaN(s2) || s2 < 0) {
      this.showCoolAlert('Invalid Score', 'Match scores must be valid positive numbers (0 or higher).', null);
      return;
    }

    if (editId) {
      const matchIndex = this.matches.findIndex(m => m.id === editId);
      if (matchIndex !== -1) {
        this.matches[matchIndex].player1Id = p1Id;
        this.matches[matchIndex].player2Id = p2Id;
        this.matches[matchIndex].score1 = s1;
        this.matches[matchIndex].score2 = s2;
        this.showToast(`Match #${this.matches[matchIndex].matchNumber} updated`);
      }
    } else {
      const nextNum = this.getNextMatchNumber();
      const newMatch = {
        id: 'm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        matchNumber: nextNum,
        player1Id: p1Id,
        player2Id: p2Id,
        score1: s1,
        score2: s2,
        timestamp: Date.now()
      };
      this.matches.push(newMatch);
      this.showToast(`Match #${nextNum} logged successfully`);
    }

    this.saveData();
    this.closeModals();
    this.renderAll();
  }

  editMatch(matchId) {
    const match = this.matches.find(m => m.id === matchId);
    if (match) {
      this.openMatchModal(match);
    }
  }

  deleteMatch(matchId) {
    const match = this.matches.find(m => m.id === matchId);
    const matchLabel = match ? `Match #${match.matchNumber || match.id}` : 'this match';

    this.showCoolModal({
      title: 'Delete Match Record?',
      message: `Are you sure you want to permanently delete ${matchLabel}? The league standings table and player points will immediately recalculate.`,
      theme: 'danger',
      icon: 'trash',
      confirmText: 'Yes, Delete Match',
      cancelText: 'Keep Match',
      onConfirm: () => {
        this.matches = this.matches.filter(m => m.id !== matchId);
        this.saveData();
        this.renderAll();
        this.showToast('Match deleted');
      }
    });
  }

  handleDeleteMatchFromModal() {
    const editId = document.getElementById('match-edit-id').value;
    if (editId) {
      this.deleteMatch(editId);
      this.closeModals();
    }
  }

  adjustScore(inputId, delta) {
    const input = document.getElementById(inputId);
    if (!input) return;
    let val = parseInt(input.value, 10) || 0;
    val = Math.max(0, Math.min(99, val + delta));
    input.value = val;
  }

  // --- CRUD: Player Operations with Duplicate Name Check & Cool Popup ---
  openPlayerModal(playerToEdit = null) {
    const modal = document.getElementById('modal-player');
    const title = document.getElementById('player-modal-title');
    const editIdInput = document.getElementById('player-edit-id');
    const nameInput = document.getElementById('player-name');
    const tagInput = document.getElementById('player-tag');
    const colorSelect = document.getElementById('player-color');
    const statusSelect = document.getElementById('player-status');

    if (playerToEdit) {
      title.innerHTML = 'Edit Player Details';
      editIdInput.value = playerToEdit.id;
      nameInput.value = playerToEdit.name;
      tagInput.value = playerToEdit.tag || '';
      colorSelect.value = playerToEdit.color || '#3b82f6';
      statusSelect.value = playerToEdit.disabled ? 'disabled' : 'active';
    } else {
      title.innerHTML = 'Add PES Competitor';
      editIdInput.value = '';
      nameInput.value = '';
      tagInput.value = '';
      statusSelect.value = 'active';
      const options = colorSelect.options;
      const randIdx = Math.floor(Math.random() * options.length);
      colorSelect.selectedIndex = randIdx;
    }

    modal.classList.add('open');
    setTimeout(() => nameInput.focus(), 100);
  }

  handleSavePlayer(event) {
    event.preventDefault();
    const editId = document.getElementById('player-edit-id').value;
    const name = document.getElementById('player-name').value.trim();
    const tag = document.getElementById('player-tag').value.trim();
    const color = document.getElementById('player-color').value;
    const status = document.getElementById('player-status').value;
    const isDisabled = status === 'disabled';

    if (!name) {
      this.showCoolAlert('Player Name Required', 'Please enter a valid player name.', null);
      return;
    }

    // 2. Strict Duplicate Check (Case-Insensitive) with Cool Alert Popup
    const isDuplicate = this.players.some(p => 
      p.name.trim().toLowerCase() === name.toLowerCase() && p.id !== editId
    );

    if (isDuplicate) {
      this.showCoolAlert(
        'Player Already Exists!',
        `A player named "${name}" is already registered in MooN PES Competition. Duplicate names are not permitted. Please use a unique name or add an identifier.`,
        name
      );
      return;
    }

    if (editId) {
      const pIndex = this.players.findIndex(p => p.id === editId);
      if (pIndex !== -1) {
        this.players[pIndex].name = name;
        this.players[pIndex].tag = tag;
        this.players[pIndex].color = color;
        this.players[pIndex].disabled = isDisabled;
        this.showToast(`Updated player: ${name}`);
      }
    } else {
      const newPlayer = {
        id: 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        name: name,
        tag: tag || 'PES Competitor',
        color: color,
        disabled: isDisabled,
        createdAt: Date.now()
      };
      this.players.push(newPlayer);
      this.showToast(`Added player: ${name}`);
    }

    this.saveData();
    this.closeModals();
    this.renderAll();
  }

  editPlayer(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      this.openPlayerModal(player);
    }
  }

  deletePlayer(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;

    const associatedMatches = this.matches.filter(m => m.player1Id === playerId || m.player2Id === playerId);
    let msg = `Are you sure you want to remove competitor "${player.name}"?`;
    if (associatedMatches.length > 0) {
      msg += ` This will also delete ${associatedMatches.length} match record(s) involving this player.`;
    }

    this.showCoolModal({
      title: `Delete Player "${player.name}"?`,
      message: msg,
      theme: 'danger',
      icon: 'trash',
      confirmText: 'Yes, Delete Player',
      cancelText: 'Cancel',
      onConfirm: () => {
        this.players = this.players.filter(p => p.id !== playerId);
        this.matches = this.matches.filter(m => m.player1Id !== playerId && m.player2Id !== playerId);
        this.saveData();
        this.renderAll();
        this.showToast(`Deleted player ${player.name}`);
      }
    });
  }

  // --- Cool Popup Modal & Alert System ---
  showCoolModal({ title, message, theme = 'danger', icon = 'alert', confirmText = 'Got It', cancelText = null, onConfirm = null }) {
    const modal = document.getElementById('modal-cool-alert');
    const sheet = document.getElementById('cool-alert-sheet');
    const titleEl = document.getElementById('cool-alert-title');
    const msgEl = document.getElementById('cool-alert-message');
    const confirmBtn = document.getElementById('cool-alert-confirm-btn');
    const cancelBtn = document.getElementById('cool-alert-cancel-btn');
    const iconSvg = document.getElementById('cool-alert-icon-svg');

    if (!modal) return;

    this._coolModalCallback = onConfirm;

    // Set theme classes
    if (sheet) {
      sheet.className = `cool-alert-sheet theme-${theme}`;
    }

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.innerHTML = message;

    // Set Icon
    if (iconSvg) {
      if (icon === 'trash') {
        iconSvg.innerHTML = `
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        `;
      } else if (icon === 'refresh') {
        iconSvg.innerHTML = `
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        `;
      } else if (icon === 'info') {
        iconSvg.innerHTML = `
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        `;
      } else {
        // default warning alert
        iconSvg.innerHTML = `
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        `;
      }
    }

    // Buttons
    if (confirmBtn) {
      confirmBtn.textContent = confirmText;
      confirmBtn.className = `cool-alert-btn ${theme === 'info' ? 'theme-btn-info' : theme === 'warning' ? 'theme-btn-warning' : ''}`;
    }

    if (cancelBtn) {
      if (cancelText) {
        cancelBtn.style.display = 'inline-block';
        cancelBtn.textContent = cancelText;
      } else {
        cancelBtn.style.display = 'none';
      }
    }

    modal.classList.add('open');
  }

  showCoolAlert(title, message, playerName, theme = 'danger') {
    let formattedMessage = message;
    if (playerName) {
      formattedMessage = `The player name <span class="cool-alert-player-highlight">"${this.escapeHtml(playerName)}"</span> is already registered in MooN PES Competition. Duplicate names are not permitted. Please choose a distinct name.`;
    }

    this.showCoolModal({
      title: title,
      message: formattedMessage,
      theme: theme,
      icon: 'alert',
      confirmText: 'Understood, Got It',
      cancelText: null,
      onConfirm: null
    });
  }

  handleCoolAlertConfirm() {
    const cb = this._coolModalCallback;
    this.closeCoolAlert();
    if (typeof cb === 'function') {
      cb();
    }
  }

  closeCoolAlert(callCallback = false) {
    const modal = document.getElementById('modal-cool-alert');
    if (modal) modal.classList.remove('open');
    if (!callCallback) {
      this._coolModalCallback = null;
    }
  }

  // --- Tournament Data Management ---
  resetAllData() {
    this.showCoolModal({
      title: 'Reset Entire League?',
      message: 'Are you sure you want to reset all tournament data? This action will permanently erase all registered players, match results, and standings. This cannot be undone.',
      theme: 'danger',
      icon: 'trash',
      confirmText: 'Yes, Wipe Everything',
      cancelText: 'Cancel, Keep Data',
      onConfirm: () => {
        this.players = [];
        this.matches = [];
        this.saveData();
        this.closeModals();
        this.renderAll();
        this.showToast('League table reset completely');
      }
    });
  }

  exportData() {
    const dataStr = JSON.stringify({
      appName: 'MooN PES Competition (MPC)',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      players: this.players,
      matches: this.matches
    }, null, 2);

    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mpc_league_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast('Tournament backup downloaded');
  }

  importData(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        if (Array.isArray(json.players) && Array.isArray(json.matches)) {
          this.players = json.players;
          this.matches = json.matches;
          this.saveData();
          this.closeModals();
          this.renderAll();
          this.showToast('Tournament restored successfully!');
        } else {
          this.showCoolAlert('Invalid File Format', 'Please upload a valid MPC export JSON file.', null);
        }
      } catch (err) {
        this.showCoolAlert('Import Error', 'Failed to read file: ' + err.message, null);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  closeModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.classList.remove('open');
    });
  }

  showToast(text) {
    const toast = document.getElementById('toast-message');
    const toastText = document.getElementById('toast-text');
    if (!toast || !toastText) return;

    toastText.textContent = text;
    toast.classList.add('show');

    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // --- UI Tabs and Listeners ---
  setupEventListeners() {
    const navButtons = document.querySelectorAll('.nav-tab-btn');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });

    const quickLog = document.getElementById('quick-log-match-btn');
    if (quickLog) quickLog.addEventListener('click', () => this.openMatchModal());

    const quickPlayer = document.getElementById('quick-add-player-btn');
    if (quickPlayer) quickPlayer.addEventListener('click', () => this.openPlayerModal());

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.closeModals();
        }
      });
    });
  }

  switchTab(tabId) {
    this.activeTab = tabId;

    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    document.querySelectorAll('.tab-pane').forEach(pane => {
      if (pane.id === tabId) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });

    if (tabId === 'tab-standings') {
      this.renderPodium();
      this.renderStandings();
    }
    if (tabId === 'tab-matches') this.renderMatches();
    if (tabId === 'tab-players') this.renderPlayers();
    if (tabId === 'tab-stats') this.renderStats();
  }

  getPlayerById(id) {
    return this.players.find(p => p.id === id);
  }

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new MPCLeagueApp();
  window.app = app;
});
