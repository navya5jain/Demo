/* ============================================================
   Memory Pulse — remember a sequence, reproduce it.
   Every flash fires THREE channels at once: a visual highlight,
   a tone (pitch varies by node), and a vibration pulse. A Blind
   player plays this entirely by ear/touch; a Deaf player plays
   it entirely by sight. Nobody gets a shorter sequence.
   ============================================================ */
export const id = 'memoryPulse';
export const name = 'Memory Pulse';

const NODES = [
  { id:'n1', label:'1', freq:392 },
  { id:'n2', label:'2', freq:440 },
  { id:'n3', label:'3', freq:523 },
  { id:'n4', label:'4', freq:587 }
];

export function start(container, ctx){
  const { AFE, onFinish, difficulty=1 } = ctx;
  const length = 4 + Math.min(2, difficulty); // 4-6 nodes
  const seq = Array.from({length}, ()=> NODES[Math.floor(Math.random()*NODES.length)].id);
  let input = [];
  let mistakes = 0;
  let phase = 'watch';
  let inputStart = 0;

  container.innerHTML = `
    <div class="card">
      <div class="badge">Memory Pulse</div>
      <h2 style="margin:10px 0 4px;">Watch the sequence</h2>
      <p style="color:var(--ink-soft); font-size:13.5px; margin:0 0 16px;">It plays once — then reproduce it in order.</p>
      <div class="tiles" id="mp-grid"></div>
      <div class="row" style="margin-top:16px;">
        <button class="btn" id="mp-replay">Watch again (2 left)</button>
      </div>
    </div>`;

  const grid = container.querySelector('#mp-grid');
  NODES.forEach(n=>{
    const t = document.createElement('button');
    t.className = 'tile'; t.id = 'tile-'+n.id; t.textContent = n.label;
    t.setAttribute('aria-label', 'Node '+n.label);
    t.addEventListener('click', ()=> onTap(n.id, t));
    grid.appendChild(t);
  });

  let replaysLeft = 2;
  const replayBtn = container.querySelector('#mp-replay');
  replayBtn.addEventListener('click', ()=>{
    if(phase!=='input' || replaysLeft<=0) return;
    replaysLeft--; replayBtn.textContent = `Watch again (${replaysLeft} left)`;
    replayBtn.disabled = replaysLeft<=0;
    playSequence();
  });

  AFE.announce('Memory Pulse: watch the sequence, then repeat it.', { spoken:true });
  setTimeout(playSequence, 500);

  function playSequence(){
    phase = 'watch';
    input = [];
    replayBtn.disabled = true;
    seq.forEach((nid, i)=>{
      setTimeout(()=>{
        const el = container.querySelector('#tile-'+nid);
        const node = NODES.find(n=>n.id===nid);
        el.classList.add('active');
        AFE.tone(node.freq, .18);
        AFE.vibrate([70]);
        setTimeout(()=> el.classList.remove('active'), 420);
      }, i*650);
    });
    setTimeout(()=>{
      phase = 'input';
      inputStart = performance.now();
      replayBtn.disabled = replaysLeft<=0;
      AFE.announce('Your turn — tap the nodes in the same order.', { spoken:true, alert:true });
    }, seq.length*650 + 300);
  }

  function onTap(nid, el){
    if(phase!=='input') return;
    const expected = seq[input.length];
    if(nid===expected){
      input.push(nid);
      el.classList.add('correct'); AFE.tone(700,.08); AFE.vibrate([30]);
      setTimeout(()=>el.classList.remove('correct'),250);
      if(input.length===seq.length) finish(true);
    } else {
      mistakes++;
      el.classList.add('wrong'); AFE.tone(180,.15,'sawtooth'); AFE.vibrate([120]);
      setTimeout(()=>el.classList.remove('wrong'),300);
      input = [];
      AFE.announce('Not quite — sequence reset, try again.', { spoken:true, alert:true });
      if(mistakes>=4) finish(false);
    }
  }

  function finish(success){
    phase = 'done';
    const reactionMs = performance.now() - inputStart;
    const accuracyPct = Math.max(0, 100 - mistakes*15);
    const points = success ? Math.round(200 + Math.max(0, 2500-reactionMs)/10 - mistakes*20) : Math.round(40 - mistakes*5);
    AFE.announce(success ? 'Sequence matched!' : 'Sequence failed.', { spoken:true, alert:true });
    onFinish({ points: Math.max(0,points), reactionMs, accuracyPct, streak: success ? (seq.length-mistakes) : 0 });
  }
}
