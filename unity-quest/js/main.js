/* ============================================================
   main.js — app shell / screen router.
   No framework: screens are plain functions that render into
   #app and wire their own event listeners. Player roster lives
   here; game logic lives in js/games/*, delivery logic lives in
   accessibility.js, orchestration lives in modes.js.
   ============================================================ */
import { AFE, PROFILES } from './accessibility.js';
import { Storage } from './storage.js';
import { runSolo, run1v1, runTeam, runTournamentMatch, BADGES } from './modes.js';

const app = document.getElementById('app');
let roster = Storage.getPlayers(); // in-memory working copy, synced to Storage on add

function go(renderFn){ app.innerHTML=''; renderFn(app); window.scrollTo(0,0); }

// ---------------- LANDING ----------------
function screenLanding(root){
  root.innerHTML = `
    <div class="screen" style="text-align:center; padding-top:8px;">
      <div class="card">
        <h2 style="margin:0 0 8px;">Different ways to play.</h2>
        <h2 style="margin:0 0 16px; background:linear-gradient(120deg,var(--p1),var(--p3)); -webkit-background-clip:text; background-clip:text; color:transparent;">One fair competition.</h2>
        <p style="color:var(--ink-soft); font-size:14px; max-width:52ch; margin:0 auto 22px;">
          Five mini-games. Every player — Deaf, Blind, non-speaking, or fully able-bodied — gets the exact
          same challenge and the exact same scoring. Only the delivery adapts to you.
        </p>
        <button class="btn primary big" id="beginBtn" style="max-width:260px; margin:0 auto;">Begin →</button>
      </div>
    </div>`;
  root.querySelector('#beginBtn').addEventListener('click', ()=> go(screenRoster));
}

// ---------------- ROSTER / PROFILE SETUP ----------------
function screenRoster(root){
  root.innerHTML = `
    <div class="screen">
      <div class="card">
        <h2 style="margin:0 0 4px;">Add players</h2>
        <p style="color:var(--ink-soft); font-size:13px; margin:0 0 16px;">Add everyone who's playing. Each person picks their own accessibility profile — this never affects scoring, only how information reaches them.</p>
        <label class="field">Name<input type="text" id="pname" placeholder="e.g. Priya"></label>
        <div class="profile-options" id="profileOpts" style="margin-top:12px;"></div>
        <div style="margin-top:14px;">
          <div class="toggle-row"><span>High contrast</span><label class="switch"><input type="checkbox" id="optContrast"><span class="track"></span></label></div>
          <div class="toggle-row"><span>Haptic feedback (vibration)</span><label class="switch"><input type="checkbox" id="optHaptic" checked><span class="track"></span></label></div>
          <div class="toggle-row"><span>Speech (text-to-speech)</span><label class="switch"><input type="checkbox" id="optTts" checked><span class="track"></span></label></div>
        </div>
        <button class="btn primary" id="addPlayerBtn" style="margin-top:16px;">+ Add player</button>
      </div>
      <div class="card">
        <b style="font-size:13px; text-transform:uppercase; letter-spacing:.05em; color:var(--ink-soft);">Players (${roster.length})</b>
        <div id="playerList" style="margin-top:10px; display:flex; flex-direction:column; gap:8px;"></div>
      </div>
      <button class="btn primary big" id="continueBtn" ${roster.length? '' : 'disabled'}>Continue to modes →</button>
    </div>`;

  let selectedProfile = 'full';
  const optWrap = root.querySelector('#profileOpts');
  Object.entries(PROFILES).forEach(([key,p])=>{
    const d = document.createElement('div');
    d.className = 'profile-opt' + (key===selectedProfile?' sel':'');
    d.innerHTML = `<span class="glyph">${p.glyph}</span><span>${p.label}</span>`;
    d.addEventListener('click', ()=>{
      selectedProfile = key;
      optWrap.querySelectorAll('.profile-opt').forEach(o=>o.classList.remove('sel'));
      d.classList.add('sel');
    });
    optWrap.appendChild(d);
  });

  function renderList(){
    const list = root.querySelector('#playerList');
    list.innerHTML = roster.length ? '' : '<p style="color:var(--ink-soft); font-size:13px;">No players yet.</p>';
    roster.forEach(p=>{
      const row = document.createElement('div');
      row.className = 'row'; row.style.justifyContent='space-between';
      row.innerHTML = `<span>${PROFILES[p.profile].glyph} <b>${escape(p.name)}</b> <span style="color:var(--ink-soft); font-size:12px;">— ${PROFILES[p.profile].label}</span></span>`;
      const rm = document.createElement('button'); rm.className='btn'; rm.textContent='Remove';
      rm.addEventListener('click', ()=>{ roster = roster.filter(x=>x.id!==p.id); go(screenRoster); });
      row.appendChild(rm);
      list.appendChild(row);
    });
  }
  renderList();

  root.querySelector('#addPlayerBtn').addEventListener('click', ()=>{
    const name = root.querySelector('#pname').value.trim();
    if(!name) return;
    const settings = {
      highContrast: root.querySelector('#optContrast').checked,
      hapticOn: root.querySelector('#optHaptic').checked,
      ttsOn: root.querySelector('#optTts').checked,
      ttsRate: 1
    };
    const player = Storage.addPlayer({ name, profile: selectedProfile, settings });
    roster.push(player);
    go(screenRoster);
  });

  root.querySelector('#continueBtn').addEventListener('click', ()=>{ if(roster.length) go(screenModeSelect); });
}

// ---------------- MODE SELECT ----------------
function screenModeSelect(root){
  root.innerHTML = `
    <div class="screen">
      <div class="grid cols-2">
        <button class="mode-card" id="modeSolo"><b>🎯 Solo</b><span>One player, all 5 challenges, personal best on the leaderboard.</span></button>
        <button class="mode-card" id="mode1v1"><b>⚔️ 1v1</b><span>Two players take turns through all 5 challenges — higher total wins.</span></button>
        <button class="mode-card" id="modeTeam"><b>🤝 Team</b><span>2–4 players split the challenges and finish with the UNITY Final together.</span></button>
        <button class="mode-card" id="modeTourney"><b>🏆 Tournament</b><span>Pair up every added player into a bracket, Ability-Blind ranking.</span></button>
      </div>
      <button class="btn" id="viewLeaderboard">View leaderboard</button>
      <button class="btn" id="backRoster">← Manage players</button>
    </div>`;
  root.querySelector('#modeSolo').addEventListener('click', ()=> go(r=>screenPickPlayers(r,1,'Solo',(sel)=>runSolo(playArea(r),sel[0],()=>go(screenLeaderboard)))));
  root.querySelector('#mode1v1').addEventListener('click', ()=> go(r=>screenPickPlayers(r,2,'1v1',(sel)=>run1v1(playArea(r),sel[0],sel[1],()=>go(screenLeaderboard)))));
  root.querySelector('#modeTeam').addEventListener('click', ()=> go(r=>screenPickPlayers(r,[2,4],'Team',(sel)=>runTeam(playArea(r),sel,()=>go(screenLeaderboard)))));
  root.querySelector('#modeTourney').addEventListener('click', ()=> go(screenTournamentSetup));
  root.querySelector('#viewLeaderboard').addEventListener('click', ()=> go(screenLeaderboard));
  root.querySelector('#backRoster').addEventListener('click', ()=> go(screenRoster));
}

function playArea(root){ const d=document.createElement('div'); root.appendChild(d); return d; }

// ---------------- PLAYER PICKER (shared by Solo/1v1/Team) ----------------
function screenPickPlayers(root, countSpec, label, onGo){
  const min = Array.isArray(countSpec) ? countSpec[0] : countSpec;
  const max = Array.isArray(countSpec) ? countSpec[1] : countSpec;
  const selected = new Set();
  root.innerHTML = `
    <div class="screen">
      <div class="card">
        <h2 style="margin:0 0 6px;">${label} — choose players</h2>
        <p style="color:var(--ink-soft); font-size:13px; margin:0 0 14px;">Pick ${min===max? min : (min+'–'+max)} player(s).</p>
        <div id="pickList" style="display:flex; flex-direction:column; gap:8px;"></div>
      </div>
      <button class="btn primary big" id="goBtn" disabled>Start →</button>
      <button class="btn" id="back">← Back</button>
    </div>`;
  const list = root.querySelector('#pickList');
  roster.forEach(p=>{
    const row = document.createElement('label');
    row.className = 'toggle-row';
    row.innerHTML = `<span>${PROFILES[p.profile].glyph} ${escape(p.name)}</span>`;
    const cb = document.createElement('input'); cb.type='checkbox';
    cb.addEventListener('change', ()=>{
      if(cb.checked){ if(selected.size>=max){ cb.checked=false; return; } selected.add(p.id); }
      else selected.delete(p.id);
      root.querySelector('#goBtn').disabled = selected.size < min || selected.size > max;
    });
    row.prepend(cb);
    list.appendChild(row);
  });
  root.querySelector('#goBtn').addEventListener('click', ()=>{
    const sel = roster.filter(p=>selected.has(p.id));
    go(r=>{ r.innerHTML=''; onGo(sel); });
  });
  root.querySelector('#back').addEventListener('click', ()=> go(screenModeSelect));
}

// ---------------- TOURNAMENT ----------------
function screenTournamentSetup(root){
  const selected = new Set();
  root.innerHTML = `
    <div class="screen">
      <div class="card">
        <h2 style="margin:0 0 6px;">Tournament — choose players</h2>
        <p style="color:var(--ink-soft); font-size:13px; margin:0 0 14px;">Pick at least 2. Odd numbers get one bye.</p>
        <div id="pickList" style="display:flex; flex-direction:column; gap:8px;"></div>
      </div>
      <button class="btn primary big" id="goBtn" disabled>Create bracket →</button>
      <button class="btn" id="back">← Back</button>
    </div>`;
  const list = root.querySelector('#pickList');
  roster.forEach(p=>{
    const row = document.createElement('label'); row.className='toggle-row';
    row.innerHTML = `<span>${PROFILES[p.profile].glyph} ${escape(p.name)}</span>`;
    const cb = document.createElement('input'); cb.type='checkbox';
    cb.addEventListener('change', ()=>{
      if(cb.checked) selected.add(p.id); else selected.delete(p.id);
      root.querySelector('#goBtn').disabled = selected.size < 2;
    });
    row.prepend(cb); list.appendChild(row);
  });
  root.querySelector('#goBtn').addEventListener('click', ()=>{
    const ids = [...selected];
    const t = Storage.createTournament('Local Tournament', ids);
    go(r=>screenTournamentRun(r, t.id, 0));
  });
  root.querySelector('#back').addEventListener('click', ()=> go(screenModeSelect));
}

function screenTournamentRun(root, tournamentId, matchIndex){
  const t = Storage.getTournament(tournamentId);
  if(!t || matchIndex >= t.bracket.length){ go(screenLeaderboard); return; }
  const match = t.bracket[matchIndex];
  const pA = roster.find(p=>p.id===match.p1);
  const pB = match.p2 ? roster.find(p=>p.id===match.p2) : null;
  if(!pB){ go(r=>screenTournamentRun(r, tournamentId, matchIndex+1)); return; }
  root.innerHTML = `<div class="card"><h2 style="margin:0;">Match ${matchIndex+1}: ${escape(pA.name)} vs ${escape(pB.name)}</h2></div>`;
  const area = document.createElement('div'); root.appendChild(area);
  runTournamentMatch(area, tournamentId, matchIndex, pA, pB, ()=>{
    go(r=>screenTournamentRun(r, tournamentId, matchIndex+1));
  });
}

// ---------------- LEADERBOARD ----------------
function screenLeaderboard(root){
  const rows = Storage.getLeaderboard();
  root.innerHTML = `
    <div class="screen">
      <div class="card">
        <h2 style="margin:0 0 4px;">Leaderboard</h2>
        <p style="color:var(--ink-soft); font-size:12.5px; margin:0 0 14px;">Ability-Blind Mode — ranked on performance only.</p>
        <table>
          <thead><tr><th>#</th><th>Player</th><th>Score</th><th>Avg reaction</th><th>Avg accuracy</th><th>Best streak</th><th>Badges</th></tr></thead>
          <tbody>
            ${rows.length ? rows.map((r,i)=>{
              const badges = Storage.getAchievements(r.playerId).map(a=>BADGES[a.badgeId]?BADGES[a.badgeId].label:a.badgeId);
              const badgeText = badges.length ? badges.join(', ') : '—';
              return `<tr><td>${i+1}</td><td>${escape(r.name)}</td><td>${r.points}</td><td>${r.avgReactionMs}ms</td><td>${r.avgAccuracy}%</td><td>${r.bestStreak}</td><td style="font-size:11.5px; color:var(--ink-soft);">${escape(badgeText)}</td></tr>`;
            }).join('') : '<tr><td colspan="7" style="color:var(--ink-soft);">No scores yet — play a round!</td></tr>'}
          </tbody>
        </table>
      </div>
      <button class="btn primary big" id="again">Play again</button>
      <button class="btn" id="menu">← Mode select</button>
    </div>`;
  root.querySelector('#again').addEventListener('click', ()=> go(screenModeSelect));
  root.querySelector('#menu').addEventListener('click', ()=> go(screenModeSelect));
}

function escape(s){ const d=document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ---------------- boot ----------------
window.addEventListener('unityquest:gotoRoster', ()=> go(screenRoster));
go(screenLanding);
