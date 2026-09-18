/* ============================================================
   UNITY Final — the flagship team challenge.
   Three seats share one puzzle: Seer, Hearer, Operator. Whoever
   sits in a seat gets that seat's clue through the AFE using
   THEIR OWN profile — so a blind player can be the "Seer" and
   still get the content (spoken + vibrated), same as anyone
   else. Seats never talk to each other with real speech: they
   pass information through the Quick Signals panel (icon + text
   buttons), which works identically whether or not anyone in
   the room can hear or speak.

   In Solo/1v1, ctx.team has just one player who holds all three
   seats in turn — the mechanic still runs end-to-end so a judge
   can see it without gathering three people.
   ============================================================ */
export const id = 'unityFinal';
export const name = 'UNITY Final';

const SHAPES = [
  { id:'circle', label:'Circle' }, { id:'square', label:'Square' },
  { id:'triangle', label:'Triangle' }, { id:'diamond', label:'Diamond' }, { id:'star', label:'Star' }
];
function shapeEl(id){ const d=document.createElement('div'); d.className='shape '+id; return d; }
function shuffle(a){ const b=a.slice(); for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [b[i],b[j]]=[b[j],b[i]];} return b; }

export function start(container, ctx){
  const { AFE, onFinish } = ctx;
  const team = (ctx.team && ctx.team.length ? ctx.team : [ctx.player]);
  const seer = team[0 % team.length];
  const hearer = team[1 % team.length];
  const operator = team[2 % team.length];

  const picks = shuffle(SHAPES).slice(0,3);
  const hiddenIndex = 1; // middle position is always the shared secret
  const known = [0,2];
  let phase = 'reveal';
  let revealed = {0:false, 2:false};
  let signalSent = null;
  let answer = null;
  const start_t = performance.now();

  container.innerHTML = `
    <div class="card">
      <div class="badge">UNITY Final</div>
      <h2 style="margin:10px 0 4px;">Crack the combined signal</h2>
      <p style="color:var(--ink-soft); font-size:13.5px; margin:0 0 14px;">Seer: ${esc(seer.name)} &nbsp;·&nbsp; Hearer: ${esc(hearer.name)} &nbsp;·&nbsp; Operator: ${esc(operator.name)}</p>
      <div class="af-caption" id="step"><span class="af-icon">1</span><span class="af-text">Seer: reveal your tiles.</span></div>
    </div>
    <div class="card" id="seatSeer" style="margin-top:14px;">
      <div class="row" style="justify-content:space-between;"><b>Seer — ${esc(seer.name)}</b><span class="badge">visual</span></div>
      <div class="tiles" id="seerTiles" style="margin-top:12px;"></div>
    </div>
    <div class="card" id="seatHearer" style="margin-top:14px;">
      <div class="row" style="justify-content:space-between;"><b>Hearer — ${esc(hearer.name)}</b><span class="badge">audio</span></div>
      <button class="btn" id="playClue" style="margin-top:10px;">▶ Play the missing piece</button>
      <p style="font-size:12.5px; color:var(--ink-soft); margin:10px 0 4px;">Then send it to the Operator with a Quick Signal:</p>
      <div class="opt-grid" id="quickSignals"></div>
    </div>
    <div class="card" id="seatOperator" style="margin-top:14px;">
      <div class="row" style="justify-content:space-between;"><b>Operator — ${esc(operator.name)}</b><span class="badge">assembles</span></div>
      <p style="font-size:12.5px; color:var(--ink-soft); margin:10px 0;">Team log:</p>
      <div class="log" id="teamLog"></div>
      <div class="opt-grid" id="finalPick" style="margin-top:12px;"></div>
      <button class="btn primary" id="confirmCombo" disabled style="margin-top:12px;">Confirm combo</button>
    </div>`;

  const stepEl = container.querySelector('#step');
  const seerCard = container.querySelector('#seatSeer');
  const hearerCard = container.querySelector('#seatHearer');
  const operatorCard = container.querySelector('#seatOperator');

  function setStep(n, text){
    stepEl.querySelector('.af-icon').textContent = n;
    stepEl.querySelector('.af-text').textContent = text;
    stepEl.classList.add('alert'); setTimeout(()=>stepEl.classList.remove('alert'), 1200);
    [seerCard,hearerCard,operatorCard].forEach(c=>c.style.opacity='.4');
    [seerCard,hearerCard,operatorCard].forEach(c=>c.style.pointerEvents='none');
    const active = n==='1' ? seerCard : n==='2' ? hearerCard : operatorCard;
    active.style.opacity='1'; active.style.pointerEvents='auto';
    AFE.announce(text, { spoken:true, alert:true });
  }

  // --- Seer panel ---
  const seerTiles = container.querySelector('#seerTiles');
  [0,1,2].forEach(i=>{
    const t = document.createElement('button');
    t.className='tile';
    if(i===hiddenIndex){ t.classList.add('locked'); t.textContent='?'; t.disabled=true; }
    else {
      t.setAttribute('aria-label','reveal tile');
      t.addEventListener('click', ()=>{
        revealed[i]=true; t.classList.add('revealed'); t.innerHTML=''; t.appendChild(shapeEl(picks[i].id));
        AFE.announce(picks[i].label+' revealed.', { spoken:true });
        if(known.every(k=>revealed[k])){ phase='listen'; setStep('2','Hearer: press play, then send a Quick Signal to the Operator.'); }
      });
    }
    seerTiles.appendChild(t);
  });

  // --- Hearer panel ---
  const qs = container.querySelector('#quickSignals');
  SHAPES.forEach(s=>{
    const b=document.createElement('button'); b.className='opt-btn';
    b.appendChild(shapeEl(s.id));
    const lab=document.createElement('span'); lab.textContent=s.label; lab.style.fontSize='12px'; b.appendChild(lab);
    b.addEventListener('click', ()=>{
      if(phase!=='listen') return;
      signalSent = s.id;
      logLine(`${hearer.name} signaled: ${s.label}`);
      AFE.announce(hearer.name+' signaled '+s.label, { spoken:true, alert:true });
      phase='answer';
      setStep('3', 'Operator: pick the final piece and confirm.');
      renderFinalPick();
    });
    qs.appendChild(b);
  });
  container.querySelector('#playClue').addEventListener('click', ()=>{
    if(phase!=='listen') return;
    AFE.announce('The missing piece is '+picks[hiddenIndex].label+'.', { spoken:true, urgent:true, alert:true });
  });

  // --- Operator panel ---
  const teamLog = container.querySelector('#teamLog');
  function logLine(text){ const d=document.createElement('div'); d.textContent=text; teamLog.prepend(d); }
  const finalPickEl = container.querySelector('#finalPick');
  const confirmBtn = container.querySelector('#confirmCombo');
  function renderFinalPick(){
    finalPickEl.innerHTML='';
    shuffle(SHAPES).forEach(s=>{
      const b=document.createElement('button'); b.className='opt-btn'+(answer===s.id?' sel':'');
      b.appendChild(shapeEl(s.id));
      const lab=document.createElement('span'); lab.textContent=s.label; lab.style.fontSize='12px'; b.appendChild(lab);
      b.addEventListener('click', ()=>{ answer=s.id; renderFinalPick(); confirmBtn.disabled=false; });
      finalPickEl.appendChild(b);
    });
  }
  confirmBtn.addEventListener('click', ()=>{
    const ok = answer===picks[hiddenIndex].id;
    const reactionMs = performance.now()-start_t;
    AFE.announce(ok ? 'Combo confirmed — signal matched!' : 'Combo mismatch.', { spoken:true, alert:true });
    AFE.tone(ok?700:180, ok?.12:.16, ok?'sine':'sawtooth');
    const points = ok ? 320 : 60;
    setTimeout(()=> onFinish({ points, reactionMs, accuracyPct: ok?100:0, streak: ok?1:0 }), 700);
  });

  setStep('1','Seer: tap the tiles to reveal your two shapes.');
}

function esc(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
