/* ============================================================
   Pattern Breaker — find the missing element in a sequence.
   Shapes are never color-only: each has a distinct silhouette
   AND a text label AND, on request or for Blind profile,
   a spoken description of the whole row.
   ============================================================ */
export const id = 'patternBreaker';
export const name = 'Pattern Breaker';

const SHAPES = [
  { id:'circle', label:'Circle' }, { id:'square', label:'Square' },
  { id:'triangle', label:'Triangle' }, { id:'diamond', label:'Diamond' }, { id:'star', label:'Star' }
];

function shapeEl(shapeId){ const d=document.createElement('div'); d.className='shape '+shapeId; return d; }
function shuffle(a){ const b=a.slice(); for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [b[i],b[j]]=[b[j],b[i]];} return b; }

export function start(container, ctx){
  const { AFE, onFinish, player } = ctx;
  const rowLen = 5;
  const pool = shuffle(SHAPES).slice(0,3); // a repeating pattern built from 3 shapes, e.g. A B A B A
  const sequence = Array.from({length:rowLen}, (_,i)=> pool[i % pool.length]);
  const missingIndex = 1 + Math.floor(Math.random()*(rowLen-2)); // never first/last, keeps a rule visible both sides
  const correct = sequence[missingIndex];
  const optionSet = shuffle([correct, ...shuffle(SHAPES.filter(s=>s.id!==correct.id)).slice(0,3)]);

  const start_t = performance.now();
  let answered = false;

  container.innerHTML = `
    <div class="card">
      <div class="badge">Pattern Breaker</div>
      <h2 style="margin:10px 0 4px;">Find the missing shape</h2>
      <p style="color:var(--ink-soft); font-size:13.5px; margin:0 0 14px;">Every tile is labeled by name, so this works with a screen reader too.</p>
      <div class="tiles" id="pb-row" role="list" aria-label="Pattern sequence"></div>
      <div class="row" style="margin:14px 0;">
        <button class="btn" id="pb-read">🔊 Read pattern aloud</button>
      </div>
      <div class="opt-grid" id="pb-opts"></div>
    </div>`;

  const row = container.querySelector('#pb-row');
  sequence.forEach((s,i)=>{
    const t = document.createElement('div');
    t.className='tile'; t.setAttribute('role','listitem');
    if(i===missingIndex){ t.innerHTML=''; t.textContent='?'; t.setAttribute('aria-label','missing shape'); }
    else { t.appendChild(shapeEl(s.id)); t.setAttribute('aria-label', s.label); }
    row.appendChild(t);
  });

  function spokenPattern(){
    return 'Pattern: ' + sequence.map((s,i)=> i===missingIndex ? 'blank' : s.label).join(', ') + '. What fills the blank?';
  }
  container.querySelector('#pb-read').addEventListener('click', ()=> AFE.speak(spokenPattern()));
  AFE.announce('Pattern Breaker: choose the shape that completes the pattern.', { spoken:true });
  // Blind profile: read it automatically since there's nothing to look at yet.
  if(ctx.player && ctx.player.profile==='blind') setTimeout(()=> AFE.speak(spokenPattern()), 500);

  const opts = container.querySelector('#pb-opts');
  optionSet.forEach(s=>{
    const b = document.createElement('button');
    b.className='opt-btn'; b.setAttribute('aria-label', s.label);
    b.appendChild(shapeEl(s.id));
    const lab = document.createElement('span'); lab.textContent = s.label; lab.style.fontSize='12px';
    b.appendChild(lab);
    b.addEventListener('click', ()=> choose(s, b));
    opts.appendChild(b);
  });

  function choose(s, btn){
    if(answered) return;
    answered = true;
    const ok = s.id===correct.id;
    btn.classList.add(ok?'sel':'sel');
    const reactionMs = performance.now()-start_t;
    AFE.announce(ok ? 'Correct — pattern completed.' : `Not quite — the answer was ${correct.label}.`, { spoken:true, alert:true });
    AFE.tone(ok?700:180, ok?.1:.16, ok?'sine':'sawtooth');
    const points = ok ? Math.round(220 + Math.max(0,6000-reactionMs)/25) : 25;
    setTimeout(()=> onFinish({ points, reactionMs, accuracyPct: ok?100:0, streak: ok?1:0 }), 700);
  }
}
