/* ============================================================
   Rapid Logic — short logic puzzle against a timer.
   Pure text by nature, which makes it screen-reader friendly
   automatically; we add auto-read for Blind profile and a
   visual + audio + haptic countdown so Deaf/Blind both get the
   time pressure through a channel that works for them.
   ============================================================ */
export const id = 'rapidLogic';
export const name = 'Rapid Logic';

const BANK = [
  { q:'Which number does not belong: 2, 4, 6, 9, 8', opts:['2','9','6','8'], a:'9' },
  { q:'Complete: 1, 1, 2, 3, 5, ?', opts:['6','7','8','9'], a:'8' },
  { q:'Which does not belong: Circle, Square, Triangle, Red', opts:['Circle','Square','Triangle','Red'], a:'Red' },
  { q:'If all Zips are Zops, and all Zops are Zaps, are all Zips definitely Zaps?', opts:['Yes','No','Not enough info','Only sometimes'], a:'Yes' },
  { q:'Complete: 3, 6, 12, 24, ?', opts:['30','36','48','28'], a:'48' },
  { q:'Which does not belong: Monday, Tuesday, March, Friday', opts:['Monday','Tuesday','March','Friday'], a:'March' },
  { q:'A is taller than B. B is taller than C. Who is shortest?', opts:['A','B','C','Cannot tell'], a:'C' }
];

export function start(container, ctx){
  const { AFE, onFinish, player } = ctx;
  const item = BANK[Math.floor(Math.random()*BANK.length)];
  const budget = 20;
  let timeLeft = budget;
  let answered = false;
  const start_t = performance.now();

  container.innerHTML = `
    <div class="card">
      <div class="row" style="justify-content:space-between;">
        <div class="badge">Rapid Logic</div>
        <div class="timerbar" id="rl-bar"><i id="rl-fill" style="width:100%"></i></div>
      </div>
      <h2 style="margin:14px 0 16px; font-size:19px;">${item.q}</h2>
      <div class="opt-grid" id="rl-opts"></div>
      <div class="row" style="margin-top:14px;">
        <button class="btn" id="rl-read">🔊 Read question aloud</button>
      </div>
    </div>`;

  const opts = container.querySelector('#rl-opts');
  item.opts.forEach(o=>{
    const b = document.createElement('button');
    b.className='opt-btn'; b.style.padding='16px 14px';
    const lab=document.createElement('span'); lab.textContent=o; lab.style.fontSize='14.5px'; lab.style.fontWeight='600';
    b.appendChild(lab);
    b.addEventListener('click', ()=> choose(o,b));
    opts.appendChild(b);
  });

  function speakQuestion(){ AFE.speak(item.q + '. Options: ' + item.opts.join(', ')); }
  container.querySelector('#rl-read').addEventListener('click', speakQuestion);
  AFE.announce('Rapid Logic: solve it before the timer runs out.', { spoken:true });
  if(player && player.profile==='blind') setTimeout(speakQuestion, 500);

  const bar = container.querySelector('#rl-bar');
  const fill = container.querySelector('#rl-fill');
  const timer = setInterval(()=>{
    timeLeft--;
    fill.style.width = Math.max(0,(timeLeft/budget)*100)+'%';
    bar.classList.toggle('low', timeLeft<=5);
    if(timeLeft<=5 && timeLeft>0){ AFE.tone(520,.08); AFE.vibrate([40]); AFE.announce(timeLeft+' seconds left.', { alert:true }); }
    if(timeLeft<=0){ clearInterval(timer); choose(null,null); }
  },1000);

  function choose(val, btn){
    if(answered) return;
    answered = true;
    clearInterval(timer);
    const ok = val===item.a;
    if(btn) btn.classList.add('sel');
    const reactionMs = performance.now()-start_t;
    AFE.announce(ok ? 'Correct!' : (val ? `Not quite — the answer was ${item.a}.` : `Time’s up — the answer was ${item.a}.`), { spoken:true, alert:true });
    AFE.tone(ok?700:180, ok?.1:.16, ok?'sine':'sawtooth');
    const points = ok ? Math.round(180 + Math.max(0,20000-reactionMs)/40) : 15;
    setTimeout(()=> onFinish({ points, reactionMs, accuracyPct: ok?100:0, streak: ok?1:0 }), 700);
  }
}
