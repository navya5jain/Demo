/* ============================================================
   modes.js — Solo / 1v1 / Team / Tournament orchestration.

   This module never draws game-specific pixels — it mounts the
   shared shell (HUD + AFE caption bar + assistant), hands the
   game module a blank container, collects its result, and moves
   on. Every mode ends by writing to Storage, which is what makes
   the leaderboard/tournament persist across sessions.
   ============================================================ */
import { AFE } from './accessibility.js';
import { Assistant } from './assistant.js';
import { Storage } from './storage.js';
import * as memoryPulse from './games/memoryPulse.js';
import * as patternBreaker from './games/patternBreaker.js';
import * as rapidLogic from './games/rapidLogic.js';
import * as signalSync from './games/signalSync.js';
import * as unityFinal from './games/unityFinal.js';

export const GAMES = [memoryPulse, patternBreaker, rapidLogic, signalSync, unityFinal];

// Tracks what the assistant panel should show right now — updated by playOne()
// before every game, read by the FAB handler so re-opening the panel never
// falls back to stale/default content.
let activeAssistantCtx = {};

/** Renders the shared HUD + caption + assistant shell into `root`, returns a play-area container. */
function mountShell(root, { title, subtitle }){
  root.innerHTML = `
    <div class="screen">
      <div class="hud">
        <div class="stat"><span class="n mono" id="hud-title">${title}</span><span class="l">${subtitle}</span></div>
      </div>
      <div class="af-caption" id="afCaption"><span class="af-icon">i</span><span class="af-text">Ready.</span></div>
      <div id="playArea"></div>
      <div class="card">
        <b style="font-size:12.5px; color:var(--ink-soft); text-transform:uppercase; letter-spacing:.05em;">Live log</b>
        <div class="log" id="afLog" style="margin-top:8px;"></div>
      </div>
    </div>
    <button class="assistant-fab" id="assistFab" aria-label="Open AI Assistant">?</button>
    <div class="assistant-panel" id="assistPanel" hidden></div>
  `;
  AFE.mount(root.querySelector('#afCaption'), root.querySelector('#afLog'));
  wireAssistant(root);
  return root.querySelector('#playArea');
}

function wireAssistant(root){
  const fab = root.querySelector('#assistFab');
  const panel = root.querySelector('#assistPanel');
  fab.addEventListener('click', ()=>{ panel.hidden = !panel.hidden; if(!panel.hidden) renderAssistant(panel, activeAssistantCtx); });
}
function renderAssistant(panel, ctx={}){
  const gameId = ctx.gameId || 'memoryPulse';
  const rulesText = Assistant.explainRules(gameId);
  const settingTip = Assistant.suggestSettings(ctx.profile || 'full');
  panel.innerHTML = `
    <b>AI Accessibility Assistant</b>
    <div class="assistant-msg">${rulesText}</div>
    <div class="assistant-msg">${settingTip}</div>
    ${ctx.hintsAllowed !== false ? `<button class="btn" id="hintBtn">Give me a hint</button>` : `<div class="assistant-msg">Hints are turned off during scored Tournament rounds to keep the match fair.</div>`}
  `;
  const hintBtn = panel.querySelector('#hintBtn');
  if(hintBtn) hintBtn.addEventListener('click', ()=>{
    const h = Assistant.hint(gameId);
    AFE.announce(h, { spoken:true });
    const msg = document.createElement('div'); msg.className='assistant-msg'; msg.textContent = h;
    panel.appendChild(msg);
  });
}

/** Applies a player's saved profile/settings to the AFE before their turn starts. */
function activate(player){
  AFE.setProfile(player.profile, player.settings || {});
}

/** Plays one game for one player (or team, for unityFinal) and resolves with the result. */
function playOne(root, gameMod, player, mode, team){
  return new Promise(resolve=>{
    activate(player);
    const container = mountShell(root, { title: gameMod.name, subtitle: `${player.name} · ${mode}` });
    const panel = root.querySelector('#assistPanel');
    activeAssistantCtx = { gameId: gameMod.id, profile: player.profile, hintsAllowed: mode!=='tournament' };
    renderAssistant(panel, activeAssistantCtx);
    gameMod.start(container, {
      AFE, player, team, difficulty:1,
      onFinish(result){
        Storage.addScore({ playerId: player.id, gameId: gameMod.id, mode, ...result });
        const wasCorrect = result.accuracyPct >= 50;
        const struggleMsg = Assistant.detectStruggle(player.id, gameMod.id, wasCorrect);
        if(struggleMsg) AFE.announce(struggleMsg, { spoken:true, alert:true });
        grantAchievements(player, gameMod, result);
        resolve(result);
      }
    });
  });
}

function summaryScreen(root, rows, onContinue){
  root.innerHTML = `
    <div class="screen">
      <div class="card">
        <h2 style="margin:0 0 6px;">Round summary</h2>
        <p style="color:var(--ink-soft); font-size:13px; margin:0 0 14px;">Ranked purely on performance — Ability-Blind Mode.</p>
        <table>
          <thead><tr><th>Player</th><th>Score</th><th>Reaction</th><th>Accuracy</th><th>Streak</th></tr></thead>
          <tbody>
            ${rows.map(r=>`<tr><td>${r.name}</td><td>🏆 ${r.points}</td><td>⚡ ${Math.round(r.reactionMs)}ms</td><td>🎯 ${Math.round(r.accuracyPct)}%</td><td>🔥 ${r.streak}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <button class="btn primary big" id="continueBtn">Continue →</button>
    </div>`;
  root.querySelector('#continueBtn').addEventListener('click', onContinue);
}

// ---------------- SOLO ----------------
export async function runSolo(root, player, onDone){
  const rows = [];
  for(const g of GAMES){
    const r = await playOne(root, g, player, 'solo', [player]);
    rows.push({ name: g.name, points:r.points, reactionMs:r.reactionMs, accuracyPct:r.accuracyPct, streak:r.streak });
  }
  const total = rows.reduce((a,r)=>a+r.points,0);
  await new Promise(res=> summaryScreen(root, [{ name: player.name, points: total,
    reactionMs: avg(rows.map(r=>r.reactionMs)), accuracyPct: avg(rows.map(r=>r.accuracyPct)), streak: Math.max(...rows.map(r=>r.streak)) }], res));
  onDone(total);
}

// ---------------- 1v1 ----------------
export async function run1v1(root, playerA, playerB, onDone){
  const totals = {};
  for(const player of [playerA, playerB]){
    let sum = 0;
    for(const g of GAMES){
      const r = await playOne(root, g, player, '1v1', [player]);
      sum += r.points;
    }
    totals[player.id] = sum;
  }
  await new Promise(res=> summaryScreen(root, [
    { name: playerA.name, points: totals[playerA.id], reactionMs:0, accuracyPct:0, streak:0 },
    { name: playerB.name, points: totals[playerB.id], reactionMs:0, accuracyPct:0, streak:0 }
  ], res));
  const winner = totals[playerA.id] >= totals[playerB.id] ? playerA : playerB;
  onDone(winner, totals);
}

// ---------------- TEAM ----------------
export async function runTeam(root, players, onDone){
  const soloGames = GAMES.filter(g=>g.id!=='unityFinal');
  const rows = [];
  let teamTotal = 0;
  for(let i=0;i<soloGames.length;i++){
    const g = soloGames[i];
    const player = players[i % players.length];
    const r = await playOne(root, g, player, 'team', players);
    teamTotal += r.points;
    rows.push({ name: `${player.name} (${g.name})`, points:r.points, reactionMs:r.reactionMs, accuracyPct:r.accuracyPct, streak:r.streak });
  }
  // UNITY Final — played together, seats assigned inside the game module
  activate(players[0]);
  const finalResult = await playOne(root, unityFinal, players[0], 'team', players);
  teamTotal += finalResult.points;
  rows.push({ name:'UNITY Final (team)', points:finalResult.points, reactionMs:finalResult.reactionMs, accuracyPct:finalResult.accuracyPct, streak:finalResult.streak });
  // credit every teammate for the shared final so it reflects on each of their leaderboard lines too
  players.forEach(p=>{ if(p.id!==players[0].id) Storage.addScore({ playerId:p.id, gameId:'unityFinal', mode:'team', ...finalResult }); });

  await new Promise(res=> summaryScreen(root, [{ name:'Team total', points: teamTotal, reactionMs: avg(rows.map(r=>r.reactionMs)), accuracyPct: avg(rows.map(r=>r.accuracyPct)), streak: Math.max(...rows.map(r=>r.streak)) }, ...rows], res));
  onDone(teamTotal);
}

// ---------------- TOURNAMENT ----------------
export async function runTournamentMatch(root, tournamentId, matchIndex, playerA, playerB, onDone){
  const totals = {};
  for(const player of [playerA, playerB].filter(Boolean)){
    let sum = 0;
    for(const g of GAMES){
      const r = await playOne(root, g, player, 'tournament', [player]);
      sum += r.points;
    }
    totals[player.id] = sum;
    Storage.recordMatchScore(tournamentId, matchIndex, player.id===playerA.id?'p1':'p2', sum);
  }
  Storage.finishMatch(tournamentId, matchIndex);
  await new Promise(res=> summaryScreen(root, [
    { name: playerA.name, points: totals[playerA.id]||0, reactionMs:0, accuracyPct:0, streak:0 },
    ...(playerB ? [{ name: playerB.name, points: totals[playerB.id]||0, reactionMs:0, accuracyPct:0, streak:0 }] : [])
  ], res));
  onDone(Storage.getTournament(tournamentId));
}

function avg(arr){ return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }

const BADGES = {
  perfect: { label: 'Perfect Round', desc:'100% accuracy on a challenge.' },
  speedster: { label: 'Speedster', desc:'Reacted in under 400ms.' },
  streak5: { label: 'Streak 5', desc:'Hit a streak of 5 or more.' },
  unityChamp: { label: 'UNITY Champion', desc:'Cracked the UNITY Final combo.' }
};
export { BADGES };

function grantAchievements(player, gameMod, result){
  const earned = [];
  if(result.accuracyPct===100){ const g=Storage.grantAchievement(player.id,'perfect'); if(g) earned.push('perfect'); }
  if(result.reactionMs>0 && result.reactionMs<400){ const g=Storage.grantAchievement(player.id,'speedster'); if(g) earned.push('speedster'); }
  if(result.streak>=5){ const g=Storage.grantAchievement(player.id,'streak5'); if(g) earned.push('streak5'); }
  if(gameMod.id==='unityFinal' && result.points>=300){ const g=Storage.grantAchievement(player.id,'unityChamp'); if(g) earned.push('unityChamp'); }
  earned.forEach(key=> AFE.announce(`Achievement unlocked: ${BADGES[key].label}!`, { spoken:true, alert:true }));
}
