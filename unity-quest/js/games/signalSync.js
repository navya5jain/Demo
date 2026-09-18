/* ============================================================
   Signal Sync — reaction/rhythm game.
   A "signal" arrives on a loose beat. Every signal fires a
   visual ring, a tone, and a vibration at the same instant, so
   the player can lock onto whichever channel suits them. Tap
   in the response window to build a streak.
   ============================================================ */
export const id = 'signalSync';
export const name = 'Signal Sync';

export function start(container, ctx){
  const { AFE, onFinish } = ctx;
  const totalSignals = 6;
  const windowMs = 650; // how long the response window stays open after a pulse
  let sent = 0, hits = 0, streak = 0, bestStreak = 0;
  let waitingFor = null; // timestamp signal fired
  let reactionSum = 0, reactionN = 0;
  let done = false;

  container.innerHTML = `
    <div class="card" style="text-align:center;">
      <div class="badge">Signal Sync</div>
      <h2 style="margin:10px 0 4px;">Tap the moment you feel/see/hear the pulse</h2>
      <p style="color:var(--ink-soft); font-size:13.5px; margin:0 0 20px;">Signal ${1} of ${totalSignals}</p>
      <div id="ss-ring" style="width:140px;height:140px;border-radius:50%;margin:0 auto 22px;border:4px solid var(--border); display:flex; align-items:center; justify-content:center; font-family:var(--font-display); font-size:14px; color:var(--ink-soft); transition:transform .15s ease, border-color .15s ease, box-shadow .15s ease;">wait</div>
      <button class="btn primary big" id="ss-tap" style="max-width:260px; margin:0 auto;">TAP</button>
      <p id="ss-status" style="margin-top:14px; font-size:13px; color:var(--ink-soft);">Streak: 0</p>
    </div>`;

  const ring = container.querySelector('#ss-ring');
  const status = container.querySelector('#ss-status');
  const progress = container.querySelector('p');
  const tapBtn = container.querySelector('#ss-tap');

  AFE.announce('Signal Sync: tap the button when a pulse arrives. It always shows, sounds, and vibrates together.', { spoken:true });
  setTimeout(scheduleNext, 900);

  function scheduleNext(){
    if(done) return;
    const delay = 900 + Math.random()*1100;
    setTimeout(fireSignal, delay);
  }

  function fireSignal(){
    if(done) return;
    sent++;
    progress.textContent = `Signal ${sent} of ${totalSignals}`;
    waitingFor = performance.now();
    ring.textContent = 'NOW';
    ring.style.borderColor = 'var(--p1)';
    ring.style.boxShadow = '0 0 30px rgba(95,211,196,.55)';
    ring.style.transform = 'scale(1.08)';
    AFE.tone(520,.15);
    AFE.vibrate([90]);
    AFE.announce('Pulse!', { alert:true });
    setTimeout(()=>{
      if(waitingFor!==null){ missSignal(); }
    }, windowMs);
  }

  function resetRing(){
    ring.style.borderColor='var(--border)'; ring.style.boxShadow='none'; ring.style.transform='scale(1)'; ring.textContent='wait';
  }

  function missSignal(){
    waitingFor = null; streak = 0;
    resetRing();
    status.textContent = 'Streak: 0 (missed)';
    checkDone();
  }

  tapBtn.addEventListener('click', ()=>{
    if(done) return;
    if(waitingFor===null) return; // tapped outside window — no penalty, just ignored
    const rt = performance.now()-waitingFor;
    reactionSum += rt; reactionN++;
    hits++; streak++; bestStreak = Math.max(bestStreak, streak);
    waitingFor = null;
    resetRing();
    ring.style.borderColor='var(--ok)';
    AFE.tone(760,.08);
    status.textContent = 'Streak: '+streak;
    AFE.announce('Synced! Streak '+streak, { spoken:false, alert:true });
    checkDone();
  });

  function checkDone(){
    if(sent>=totalSignals){ finish(); } else { scheduleNext(); }
  }

  function finish(){
    done = true;
    const accuracyPct = Math.round((hits/totalSignals)*100);
    const avgReaction = reactionN ? Math.round(reactionSum/reactionN) : windowMs;
    const points = Math.round(hits*90 + bestStreak*25 + Math.max(0, 400-avgReaction)/2);
    AFE.announce(`Done — ${hits} of ${totalSignals} synced.`, { spoken:true, alert:true });
    setTimeout(()=> onFinish({ points, reactionMs: avgReaction, accuracyPct, streak: bestStreak }), 500);
  }
}
