/* ============================================================
   assistant.js — AI Accessibility Assistant (rule-based scaffold)

   This ships as a deterministic rule engine so the MVP has zero
   external dependencies / API keys. Every function below is a
   clean seam for swapping in a real LLM call later — replace the
   body of `explainRules`, `hint`, and `suggestSettings` with a
   fetch() to your model of choice; the panel/UI code never
   changes because it only calls these three functions.

   FAIRNESS RULE: hint() is disabled by the caller during scored
   Tournament rounds (see modes.js) — the assistant may teach and
   configure, but it must never hand out an answer mid-competition.
   ============================================================ */

import { Storage } from './storage.js';

const RULES = {
  memoryPulse: 'Watch the nodes light up in order, then click them back in the same order. Every flash is also a tone and a vibration, so you can play this by sight, sound, or touch.',
  patternBreaker: 'A sequence of shapes has one missing. Pick the option that keeps the pattern consistent. Every shape has a name label too, so screen readers can read the whole row.',
  rapidLogic: 'A short logic question appears as plain text. Pick the correct answer before the timer runs out. Turn on auto-read in settings to have every question spoken aloud.',
  signalSync: 'A signal pulses on a rhythm — ring, tone, and vibration together. Tap the button in time with each pulse to build your sync streak.',
  unityFinal: 'Your team splits the clue: one teammate sees it, one hears it, one holds the input. Use the Quick Signals panel to pass what you know — nobody needs to talk.'
};

const SETTING_TIPS = {
  blind: 'Try Settings → increase TTS rate if instructions feel slow, and confirm Haptics is on for an extra confirmation channel.',
  deaf: 'Try Settings → High Contrast, and make sure the caption bar is visible on screen at all times.',
  nonspeaking: 'Everything here runs on clicks and taps — you never need voice input. Try the Quick Signals panel in Team mode for fast responses.',
  full: 'Try High Contrast or a slower TTS rate if the pace feels too fast — settings are always one tap away.'
};

export const Assistant = {
  explainRules(gameId){
    return RULES[gameId] || 'Pick the correct response before time runs out. Every challenge ships with at least two accessible channels.';
  },

  suggestSettings(profile){
    return SETTING_TIPS[profile] || SETTING_TIPS.full;
  },

  /** One light nudge, not an answer. Safe to disable during scored rounds. */
  hint(gameId, gameState){
    switch(gameId){
      case 'memoryPulse': return 'Hint: use "Watch again" if you have replays left — re-checking beats guessing.';
      case 'patternBreaker': return 'Hint: read the sequence aloud to yourself (or press Read Pattern) — the missing shape keeps the same rule as the others.';
      case 'rapidLogic': return 'Hint: eliminate the option that breaks the pattern first, rather than solving from scratch.';
      case 'signalSync': return 'Hint: focus on the rhythm, not the exact moment the ring appears — tap on the beat.';
      case 'unityFinal': return 'Hint: whoever holds the input should ask the other two "what do you have?" before entering anything.';
      default: return 'Hint: take a breath, re-read the goal at the top of the screen, and try one step at a time.';
    }
  },

  /** Called after every attempt. Returns a struggle message or null. Never seen during Tournament scoring. */
  detectStruggle(playerId, gameId, wasCorrect){
    const streak = Storage.recordAttempt(playerId, gameId, wasCorrect);
    if(streak >= 3){
      return `Noticed a few misses in a row on ${gameId}. ${this.hint(gameId)}`;
    }
    return null;
  }
};
