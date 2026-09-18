/* ============================================================
   storage.js — the ONLY module that touches localStorage.
   Every function here mirrors a table from the architecture doc:
     players | scores | achievements | tournaments
   Swap this file's internals for real HTTP calls later and
   nothing else in the app has to change — that's the point.
   ============================================================ */

const KEY = 'unityquest_v1';

function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return blank();
    const data = JSON.parse(raw);
    return { players:[], scores:[], achievements:[], tournaments:[], ...data };
  }catch(e){ return blank(); }
}
function blank(){ return { players:[], scores:[], achievements:[], tournaments:[] }; }
function save(data){
  try{ localStorage.setItem(KEY, JSON.stringify(data)); }catch(e){ /* storage unavailable — game still runs in-memory */ }
}
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

export const Storage = {

  // ---- players ----
  getPlayers(){ return load().players; },
  addPlayer({ name, profile, settings }){
    const data = load();
    const player = { id: uid(), name: name || 'Player', profile: profile || 'full', settings: settings || {}, createdAt: Date.now() };
    data.players.push(player);
    save(data);
    return player;
  },
  updatePlayer(id, patch){
    const data = load();
    const p = data.players.find(x=>x.id===id);
    if(p){ Object.assign(p, patch); save(data); }
    return p;
  },

  // ---- scores ----
  addScore({ playerId, gameId, mode, points, reactionMs, accuracyPct, streak }){
    const data = load();
    const entry = { id: uid(), playerId, gameId, mode, points: Math.max(0, Math.round(points||0)),
      reactionMs: Math.max(0, Math.round(reactionMs||0)), accuracyPct: Math.max(0, Math.min(100, Math.round(accuracyPct||0))),
      streak: Math.max(0, Math.round(streak||0)), timestamp: Date.now() };
    data.scores.push(entry);
    save(data);
    return entry;
  },
  // Ability-Blind Mode: ranking never reads `profile`. Only performance fields are used.
  getLeaderboard({ gameId=null, mode=null, limit=20 } = {}){
    const data = load();
    const players = Object.fromEntries(data.players.map(p=>[p.id,p]));
    const totals = {};
    data.scores
      .filter(s => (!gameId || s.gameId===gameId) && (!mode || s.mode===mode))
      .forEach(s=>{
        if(!totals[s.playerId]) totals[s.playerId] = { playerId:s.playerId, points:0, reactionSum:0, accSum:0, n:0, bestStreak:0 };
        const t = totals[s.playerId];
        t.points += s.points; t.reactionSum += s.reactionMs; t.accSum += s.accuracyPct; t.n++;
        t.bestStreak = Math.max(t.bestStreak, s.streak);
      });
    return Object.values(totals)
      .map(t => ({
        playerId: t.playerId,
        name: players[t.playerId] ? players[t.playerId].name : 'Unknown',
        points: t.points,
        avgReactionMs: Math.round(t.reactionSum / t.n),
        avgAccuracy: Math.round(t.accSum / t.n),
        bestStreak: t.bestStreak
      }))
      .sort((a,b)=> b.points - a.points || a.avgReactionMs - b.avgReactionMs)
      .slice(0, limit);
  },

  // ---- achievements ----
  grantAchievement(playerId, badgeId){
    const data = load();
    if(data.achievements.some(a=>a.playerId===playerId && a.badgeId===badgeId)) return null;
    const entry = { id: uid(), playerId, badgeId, earnedAt: Date.now() };
    data.achievements.push(entry);
    save(data);
    return entry;
  },
  getAchievements(playerId){ return load().achievements.filter(a=>a.playerId===playerId); },

  // ---- tournaments (local bracket, pass-and-play) ----
  createTournament(name, playerIds){
    const data = load();
    const shuffled = [...playerIds].sort(()=>Math.random()-0.5);
    const bracket = [];
    for(let i=0;i<shuffled.length;i+=2){
      bracket.push({ p1: shuffled[i], p2: shuffled[i+1] ?? null, p1score:0, p2score:0, winner: shuffled[i+1]===undefined ? shuffled[i] : null });
    }
    const t = { id: uid(), name, playerIds, bracket, status:'active', createdAt: Date.now() };
    data.tournaments.push(t);
    save(data);
    return t;
  },
  recordMatchScore(tournamentId, matchIndex, who, points){
    const data = load();
    const t = data.tournaments.find(x=>x.id===tournamentId);
    if(!t) return null;
    const m = t.bracket[matchIndex];
    if(who==='p1') m.p1score += points; else m.p2score += points;
    save(data);
    return t;
  },
  finishMatch(tournamentId, matchIndex){
    const data = load();
    const t = data.tournaments.find(x=>x.id===tournamentId);
    if(!t) return null;
    const m = t.bracket[matchIndex];
    m.winner = m.p2===null ? m.p1 : (m.p1score >= m.p2score ? m.p1 : m.p2);
    if(t.bracket.every(x=>x.winner)) t.status='complete';
    save(data);
    return t;
  },
  getTournament(id){ return load().tournaments.find(t=>t.id===id) || null; },

  // ---- struggle tracking (used by the AI assistant, per-player + per-game) ----
  recordAttempt(playerId, gameId, wasCorrect){
    const data = load();
    data._attempts = data._attempts || {};
    const key = playerId+':'+gameId;
    const streak = data._attempts[key] || 0;
    data._attempts[key] = wasCorrect ? 0 : streak+1;
    save(data);
    return data._attempts[key];
  }
};
