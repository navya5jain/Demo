/* Ladder of Why — frontend.
   Talks to the FastAPI backend; holds no game rules of its own. */

(function () {
  "use strict";

  var el = {};
  [
    "setupView", "gameView", "reportView", "scenarioInput", "chipRow", "startBtn",
    "setupThinking", "setupThinkingText", "setupNotice", "historyBlock", "historyList",
    "scenarioStrip", "ladderRail", "conceptTag", "rungOf", "rungTitle", "questionText",
    "answerInput", "submitAnswerBtn", "nextRungBtn", "finishBtn", "quitBtn", "answerThinking",
    "feedbackBox", "reportTitle", "reportLine", "skillPills", "newBadges", "recapList",
    "newCaseBtn", "rankName", "xpText", "xpFill", "providerNote"
  ].forEach(function (id) { el[id] = document.getElementById(id); });

  var state = { session: null, idx: 0, lastResult: null };

  // ---------------------------------------------------------------- http
  function api(path, options) {
    return fetch("/api" + path, Object.assign({
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin"
    }, options || {})).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) throw new Error(body.detail || ("Request failed (" + res.status + ")"));
        return body;
      });
    });
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function stars(score) {
    var out = "";
    for (var i = 1; i <= 5; i++) out += i <= score ? "★" : '<span class="dim">★</span>';
    return out;
  }

  function show(view) {
    el.setupView.hidden = view !== "setup";
    el.gameView.hidden = view !== "game";
    el.reportView.hidden = view !== "report";
  }

  // ---------------------------------------------------------------- player
  function renderMe(me) {
    el.rankName.textContent = me.rank;
    el.xpText.textContent = me.xp + " XP";
    el.xpFill.style.width = Math.round(me.progress * 100) + "%";
  }

  function loadMe() {
    return api("/me").then(renderMe).catch(function () {});
  }

  function loadHistory() {
    return api("/history").then(function (data) {
      var cases = (data.cases || []).filter(function (c) { return c.answered > 0; });
      if (!cases.length) { el.historyBlock.hidden = true; return; }
      el.historyBlock.hidden = false;
      el.historyList.innerHTML = cases.map(function (c) {
        var value = c.completed_at
          ? '<span class="hv">' + c.avg_score.toFixed(1) + "/5</span>"
          : '<span class="hv open">' + c.answered + "/" + c.rungs + " rungs</span>";
        return '<div class="hrow"><span class="hs">' + escapeHtml(c.scenario) + "</span>" + value + "</div>";
      }).join("");
    }).catch(function () {});
  }

  function loadHealth() {
    return api("/health").then(function (h) {
      el.providerNote.textContent = h.live
        ? "engine: " + h.provider + " · " + h.model
        : "offline mode — template questions. Add an API key in .env for questions written for your situation.";
    }).catch(function () {
      el.providerNote.textContent = "backend unreachable";
    });
  }

  // ---------------------------------------------------------------- setup
  el.chipRow.addEventListener("click", function (e) {
    var chip = e.target.closest(".chip");
    if (!chip) return;
    el.scenarioInput.value = chip.getAttribute("data-fill");
    el.scenarioInput.focus();
  });

  el.startBtn.addEventListener("click", function () {
    var scenario = el.scenarioInput.value.trim();
    if (scenario.length < 3) {
      el.setupNotice.hidden = false;
      el.setupNotice.textContent = "Describe what happened first — one sentence is enough.";
      return;
    }
    el.setupNotice.hidden = true;
    el.startBtn.disabled = true;
    el.setupThinking.hidden = false;

    api("/sessions", { method: "POST", body: JSON.stringify({ scenario: scenario }) })
      .then(function (session) {
        state.session = session;
        state.idx = 0;
        beginGame();
      })
      .catch(function (err) {
        el.setupNotice.hidden = false;
        el.setupNotice.textContent = err.message + " — check the server log, or set LLM_PROVIDER=mock in .env to play offline.";
      })
      .finally(function () {
        el.startBtn.disabled = false;
        el.setupThinking.hidden = true;
      });
  });

  // ---------------------------------------------------------------- game
  function beginGame() {
    show("game");
    el.scenarioStrip.textContent = "“" + state.session.scenario + "”";
    renderRail();
    renderRung();
  }

  function renderRail() {
    el.ladderRail.innerHTML = state.session.rungs.map(function (r, i) {
      var cls = "rung" + (r.score != null ? " done" : (i === state.idx ? " current" : ""));
      var score = r.score != null ? '<div class="rs">' + r.score + "/5</div>" : "";
      return '<div class="' + cls + '"><div class="num">RUNG ' + (i + 1) + "</div>" +
        '<div class="rt">' + escapeHtml(r.title) + "</div>" + score + "</div>";
    }).join("");
  }

  function renderRung() {
    var r = state.session.rungs[state.idx];
    el.conceptTag.textContent = r.concept || "reasoning";
    el.rungOf.textContent = "Rung " + (state.idx + 1) + " of " + state.session.rungs.length;
    el.rungTitle.textContent = r.title;
    el.questionText.textContent = r.question;
    el.answerInput.value = "";
    el.answerInput.disabled = false;
    el.submitAnswerBtn.hidden = false;
    el.submitAnswerBtn.disabled = false;
    el.nextRungBtn.hidden = true;
    el.finishBtn.hidden = true;
    el.feedbackBox.hidden = true;
    el.answerInput.focus();
  }

  el.submitAnswerBtn.addEventListener("click", function () {
    var answer = el.answerInput.value.trim();
    if (!answer) { el.answerInput.focus(); return; }

    el.submitAnswerBtn.disabled = true;
    el.answerInput.disabled = true;
    el.answerThinking.hidden = false;

    api("/sessions/" + state.session.id + "/answers", {
      method: "POST",
      body: JSON.stringify({ idx: state.idx, answer: answer })
    }).then(function (result) {
      state.session = result.session;
      state.lastResult = result;
      renderMe(result.me);
      renderRail();

      el.feedbackBox.hidden = false;
      el.feedbackBox.innerHTML =
        '<div class="score-row"><span class="stars">' + stars(result.score) + "</span>" +
        "<span>" + result.score + '/5</span><span class="xp-gain">+' + result.xp_gained + " XP</span></div>" +
        "<div>" + escapeHtml(result.feedback) + "</div>";

      el.submitAnswerBtn.hidden = true;
      if (result.done) el.finishBtn.hidden = false;
      else el.nextRungBtn.hidden = false;
    }).catch(function (err) {
      el.feedbackBox.hidden = false;
      el.feedbackBox.innerHTML = "<div>" + escapeHtml(err.message) + "</div>";
      el.answerInput.disabled = false;
      el.submitAnswerBtn.disabled = false;
    }).finally(function () {
      el.answerThinking.hidden = true;
    });
  });

  el.nextRungBtn.addEventListener("click", function () {
    state.idx += 1;
    renderRail();
    renderRung();
  });

  el.quitBtn.addEventListener("click", function () {
    show("setup");
    el.scenarioInput.value = "";
    loadHistory();
  });

  el.finishBtn.addEventListener("click", showReport);

  // ---------------------------------------------------------------- report
  function showReport() {
    var result = state.lastResult || {};
    var session = state.session;
    var avg = result.avg_score || 0;

    show("report");
    el.reportTitle.textContent = (result.me && result.me.rank) || "Case closed";
    el.reportLine.innerHTML =
      "You climbed <strong>" + session.rungs.length + " rungs</strong> on “" +
      escapeHtml(session.scenario) + "”, averaging <strong>" + avg.toFixed(1) +
      " / 5</strong> for rigour" + (session.offline ? " (offline mode)." : ".");

    var concepts = [];
    session.rungs.forEach(function (r) {
      if (r.concept && concepts.indexOf(r.concept) === -1) concepts.push(r.concept);
    });
    el.skillPills.innerHTML = concepts.map(function (c) {
      return '<span class="skill-pill">' + escapeHtml(c) + "</span>";
    }).join("");

    el.newBadges.innerHTML = (result.new_badges || []).map(function (b) {
      return '<div class="badge-new"><span class="bn">' + escapeHtml(b.name) +
        '</span><span class="bh">' + escapeHtml(b.how) + "</span></div>";
    }).join("");

    el.recapList.innerHTML = session.rungs.map(function (r, i) {
      return '<div class="recap">' +
        '<div class="recap-head"><span>RUNG ' + (i + 1) + " · " + escapeHtml(r.concept) +
        "</span><span>" + (r.score == null ? "—" : r.score + "/5") + "</span></div>" +
        '<div class="recap-q">' + escapeHtml(r.question) + "</div>" +
        '<p class="recap-a">' + escapeHtml(r.answer) + "</p>" +
        '<p class="recap-f">' + escapeHtml(r.feedback) + "</p>" +
      "</div>";
    }).join("");

    loadHistory();
  }

  el.newCaseBtn.addEventListener("click", function () {
    show("setup");
    el.scenarioInput.value = "";
    el.scenarioInput.focus();
  });

  // ---------------------------------------------------------------- boot
  loadHealth();
  loadMe();
  loadHistory();
})();
