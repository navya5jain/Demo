/* ============================================================
   accessibility.js — the Adaptive Fairness Engine (AFE)

   Game code never touches the DOM to tell a player something.
   It calls AFE.announce(text, opts) with a sense-neutral message
   and the AFE decides which channels to fire, based on the
   ACTIVE player's profile. All channels are always attempted —
   a profile only changes emphasis, never withholds information
   from someone who could use it too.

   opts:
     spoken  (bool) — should this go through TTS
     urgent  (bool) — should this vibrate
     alert   (bool) — should the caption bar flash for salience
   ============================================================ */

export const PROFILES = {
  blind:      { label: 'Blind / Visually impaired', glyph: '◉', speak: true,  vibrate: true,  flash: false },
  deaf:       { label: 'Deaf / Hard of hearing',     glyph: '◈', speak: false, vibrate: false, flash: true  },
  nonspeaking:{ label: 'Non-speaking',                glyph: '◐', speak: true,  vibrate: false, flash: true  },
  full:       { label: 'Fully able-bodied',           glyph: '●', speak: true,  vibrate: false, flash: true  }
};

class AdaptiveFairnessEngine {
  constructor(){
    this.activeProfile = 'full';
    this.settings = { ttsRate: 1, ttsOn: true, hapticOn: true, highContrast: false };
    this.captionEl = null;
    this.logEl = null;
    this._flashTimer = null;
  }

  mount(captionEl, logEl){
    this.captionEl = captionEl;
    this.logEl = logEl;
  }

  setProfile(profileId, settings={}){
    this.activeProfile = PROFILES[profileId] ? profileId : 'full';
    this.settings = { ...this.settings, ...settings };
    document.body.dataset.contrast = this.settings.highContrast ? 'high' : 'normal';
  }

  /** Core broadcast — call this instead of writing to the DOM directly. */
  announce(text, opts={}){
    const prof = PROFILES[this.activeProfile];
    // 1) Visual caption — ALWAYS. This alone covers Deaf + fully-abled players completely.
    if(this.captionEl){
      this.captionEl.querySelector('.af-text') && (this.captionEl.querySelector('.af-text').textContent = text);
      if(opts.alert && (prof.flash)){
        this.captionEl.classList.add('alert');
        clearTimeout(this._flashTimer);
        this._flashTimer = setTimeout(()=> this.captionEl.classList.remove('alert'), 2200);
      }
    }
    if(this.logEl){
      const line = document.createElement('div');
      line.textContent = text;
      this.logEl.prepend(line);
      while(this.logEl.children.length > 12) this.logEl.removeChild(this.logEl.lastChild);
    }
    // 2) Speech — for profiles that benefit from audio, if the player hasn't muted it.
    if(opts.spoken && prof.speak && this.settings.ttsOn) this.speak(text);
    // 3) Haptics — redundant confirmation channel, mainly for Blind players.
    if(opts.urgent && prof.vibrate && this.settings.hapticOn) this.vibrate([60,40,60]);
  }

  speak(text){
    try{
      if(!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = this.settings.ttsRate || 1;
      window.speechSynthesis.speak(u);
    }catch(e){ /* no TTS available — caption text already covers it */ }
  }

  vibrate(pattern){
    try{ if(navigator.vibrate) navigator.vibrate(pattern); }catch(e){}
  }

  /** Short audio tone via Web Audio — used for timers/feedback, always paired with a visual cue by callers. */
  tone(freq=440, dur=0.12, type='sine'){
    try{
      this._ctx = this._ctx || new (window.AudioContext||window.webkitAudioContext)();
      const o = this._ctx.createOscillator(), g = this._ctx.createGain();
      o.type = type; o.frequency.value = freq; g.gain.value = 0.05;
      o.connect(g); g.connect(this._ctx.destination);
      o.start(); o.stop(this._ctx.currentTime + dur);
    }catch(e){}
  }
}

export const AFE = new AdaptiveFairnessEngine();
