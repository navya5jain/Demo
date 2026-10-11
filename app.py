"""Haunted Data Detective - Streamlit app.

Run with:   streamlit run app.py
"""

import time

import pandas as pd
import plotly.express as px
import streamlit as st

import db
import detect
import game
import report
import theme
from config import DIFFICULTY, ENTITIES, ROOMS

MAX_TRICK_OR_TREATS = 3  # per case: one after each of the first three scans

st.set_page_config(page_title="Haunted Data Detective", page_icon="🎃", layout="wide")
theme.inject()
db.init_db()

S = st.session_state
DEFAULTS = {
    "case": None, "start": None, "result": None, "guess": None,
    "hints": [], "penalty": 0, "scan": None, "tot_count": 0,
    "tot_outcome": None, "saved": False, "celebrate": False,
}
for key, value in DEFAULTS.items():
    if key not in S:
        S[key] = value

SENSORS = {"temperature": "Temperature (°C)", "emf": "EMF (milligauss)", "noise_db": "Noise (dB)"}


# ---------------------------------------------------------------------------
# Case lifecycle
# ---------------------------------------------------------------------------
def start_case(difficulty: str) -> None:
    case = game.new_case(difficulty)
    db.load_case(case)
    S.case, S.start, S.result, S.guess = case, time.time(), None, None
    S.hints, S.penalty, S.scan = [], 0, None
    S.tot_count, S.tot_outcome, S.saved, S.celebrate = 0, None, False, False


# ---------------------------------------------------------------------------
# Trick or Treat popup
# ---------------------------------------------------------------------------
def _roll_trick_or_treat() -> None:
    outcome = game.trick_or_treat(S.case, len(S.hints))
    if outcome["hint"]:
        S.hints.append(outcome["hint"])
    S.penalty += outcome["penalty"]
    S.tot_count += 1
    S.tot_outcome = outcome


@st.dialog("🎃 Trick or Treat? 🎃")
def trick_or_treat_dialog() -> None:
    outcome = S.tot_outcome
    if outcome is None:
        st.markdown('<div class="tot-big">🚪🎃🚪</div>', unsafe_allow_html=True)
        st.markdown(
            '<p class="tot-msg">Your scan stirred the spirits...<br>'
            "Knock on a door and see who answers!</p>",
            unsafe_allow_html=True,
        )
        left, right = st.columns(2)
        left.button("🎃 Knock on the left", key="tot_left", on_click=_roll_trick_or_treat)
        right.button("🎃 Knock on the right", key="tot_right", on_click=_roll_trick_or_treat)
        return

    if outcome["kind"] == "treat":
        st.markdown('<div class="tot-big">🍬</div>', unsafe_allow_html=True)
        st.success(outcome["message"])
        if outcome["hint"]:
            st.markdown(f"### 🔮 {outcome['hint']}")
    else:
        st.markdown('<div class="tot-big">💀</div>', unsafe_allow_html=True)
        st.error(f"TRICK! {outcome['message']}")
    if st.button("Back to the case", key="tot_close"):
        st.rerun()


# ---------------------------------------------------------------------------
# Live timer (refreshes itself every second without rerunning the whole app)
# ---------------------------------------------------------------------------
LIVE_TIMER = False  # set to True for a clock that ticks every second (needs Streamlit >= 1.37)


def live_timer() -> None:
    if S.case is None:
        return
    seconds = S.result["seconds"] if S.result else time.time() - S.start
    par = DIFFICULTY[S.case.difficulty]["par_seconds"]
    label = "⏱️ Time on the case" if LIVE_TIMER else "⏱️ Time on the case (updates when you act)"
    st.metric(label, game.fmt_time(seconds), help=f"Par time: {game.fmt_time(par)}")


if LIVE_TIMER:
    live_timer = st.fragment(run_every=1)(live_timer)


# ---------------------------------------------------------------------------
# Tabs
# ---------------------------------------------------------------------------
def tab_case_file(case) -> None:
    cfg = DIFFICULTY[case.difficulty]
    st.markdown(
        f'<div class="card"><h4>📜 Case {case.case_id}: {case.title}</h4>'
        "Blackwood Manor, a hotel built on cursed ground, has been shaken by strange nights. "
        "Guests report cold spots, humming electronics and things that go bump in the dark. "
        "Seven days of sensor data, a guest register and witness reports have landed on your desk.<br><br>"
        "<b>Your mission:</b> find <b>which room</b> is haunted, <b>at what hour</b> the haunting "
        "peaks, and <b>which ghost</b> is responsible.</div>",
        unsafe_allow_html=True,
    )
    c1, c2, c3 = st.columns(3)
    c1.metric("Difficulty", case.difficulty, help=cfg["blurb"])
    c2.metric("Sensor readings", f"{len(case.readings):,}")
    c3.metric("Witness reports", len(case.reports))

    st.subheader("How to investigate")
    st.markdown(
        "1. **Evidence Board** - look for a room that runs cold and electric at the same hour every night.\n"
        "2. **SQL Lab** - query the data yourself to confirm what the charts suggest.\n"
        "3. **Ghost Scan** - let the detection algorithms hunt for anomalies. "
        "Each scan may knock on the door of the spirit world (trick or treat!).\n"
        "4. **Witness reports** reveal *which* ghost it is. Match the most common clue in the "
        "haunted room to the dossier below.\n"
        "5. **Accuse** - you get one final accusation. Accuracy and speed both count."
    )

    st.subheader("Spirit dossier")
    dossier = pd.DataFrame(
        [{"Ghost": name, "Signature clue": d["clue"], "Legend": d["lore"]}
         for name, d in ENTITIES.items()]
    )
    st.dataframe(dossier, hide_index=True, use_container_width=True)

    st.subheader("Guest register")
    guests = case.guests.copy()
    guests["check_in"] = guests["check_in"].dt.strftime("%a %d %b")
    guests["check_out"] = guests["check_out"].dt.strftime("%a %d %b")
    st.dataframe(guests.rename(columns=lambda c: c.replace("_", " ").title()),
                 hide_index=True, use_container_width=True)


def tab_evidence(case) -> None:
    st.caption("Tip: every room has its own normal. The Cellar is always cold and the "
               "Kitchen is always noisy, so compare each room with itself.")
    sensor = st.radio("Sensor", list(SENSORS), format_func=SENSORS.get, horizontal=True, key="ev_sensor")

    rooms_shown = st.multiselect("Rooms", list(ROOMS), default=list(ROOMS), key="ev_rooms")
    df = case.readings[case.readings["room"].isin(rooms_shown)]
    fig = px.line(df, x="timestamp", y=sensor, color="room",
                  color_discrete_sequence=theme.PALETTE, labels={"timestamp": "", sensor: SENSORS[sensor]})
    fig.update_layout(title="Sensor timeline (one week)")
    st.plotly_chart(theme.style_fig(fig), use_container_width=True)

    heat = case.readings.assign(hour=case.readings["timestamp"].dt.hour)
    pivot = heat.pivot_table(index="room", columns="hour", values=sensor, aggfunc="mean").round(1)
    scale = theme.HEAT_SCALE[::-1] if sensor == "temperature" else theme.HEAT_SCALE
    fig2 = px.imshow(pivot, aspect="auto", color_continuous_scale=scale,
                     labels={"x": "Hour of day", "y": "", "color": SENSORS[sensor]})
    fig2.update_layout(title="Average by room and hour of day"
                             + (" (coldest = brightest)" if sensor == "temperature" else ""))
    st.plotly_chart(theme.style_fig(fig2), use_container_width=True)

    counts = case.reports.groupby(["room", "keyword"]).size().reset_index(name="reports")
    fig3 = px.bar(counts, x="room", y="reports", color="keyword",
                  color_discrete_sequence=theme.PALETTE, labels={"room": "", "reports": "Witness reports"})
    fig3.update_layout(title="What are guests reporting, and where?")
    st.plotly_chart(theme.style_fig(fig3), use_container_width=True)


def tab_sql(case) -> None:
    st.caption("Query the case database with SQL. Use `:case` in your WHERE clause "
               "(e.g. `WHERE case_id = :case`) to look only at this case. Read-only.")
    with st.expander("Tables and columns"):
        st.markdown(
            "- `readings`(case_id, timestamp, room, temperature, emf, noise_db)\n"
            "- `reports`(case_id, timestamp, room, keyword)\n"
            "- `guests`(case_id, guest, room, check_in, check_out)"
        )
    preset = st.selectbox("Detective's queries", list(db.PRESET_QUERIES), key="sql_preset")
    sql = st.text_area("SQL (edit it freely!)", value=db.PRESET_QUERIES[preset], height=190,
                       key=f"sql_text_{preset}")
    if st.button("🔎 Run query", key="sql_run"):
        try:
            st.dataframe(db.run_query(sql, case.case_id), hide_index=True, use_container_width=True)
        except Exception as exc:  # show SQL mistakes to the player instead of crashing
            st.error(f"The spirits rejected that query: {exc}")


def tab_scan(case) -> None:
    st.caption("Per-room robust z-scores and an Isolation Forest hunt for readings that are "
               "cold, electric or just plain weird. A ghost *returns*, so the best suspects "
               "are flagged on several different nights.")
    c1, c2, c3 = st.columns(3)
    method = c1.selectbox("Detection method", detect.METHODS, index=2, key="scan_method")
    z_threshold = c2.slider("Alert threshold (z-score)", 2.0, 8.0, 4.0, 0.5, key="scan_z",
                            help="Lower = more alerts (and more false alarms).")
    contamination = c3.slider("Isolation Forest sensitivity", 0.01, 0.10, 0.03, 0.01, key="scan_c",
                              help="Expected share of readings that are anomalies.")

    if st.button("🔦 Run ghost scan", key="scan_run"):
        S.scan = detect.detect(case.readings, method, z_threshold, contamination)
        if S.tot_count < MAX_TRICK_OR_TREATS:
            S.tot_outcome = None
            trick_or_treat_dialog()

    result = S.scan
    if result is None:
        st.info("Run a scan to see the suspects.")
        return

    left, right = st.columns(2)
    left.metric("Readings flagged", result.n_flagged)
    best = detect.top_suspect(result)
    right.metric("Top suspect", f"{best[0]} at {game.fmt_hour(best[1])}" if best else "None")

    st.subheader("Ranked suspects")
    table = result.suspects.copy()
    if table.empty:
        st.warning("Nothing flagged. Try lowering the threshold.")
    else:
        table["hour"] = table["hour"].map(game.fmt_hour)
        table = table.rename(columns={"room": "Room", "hour": "Hour", "hits": "Flagged readings",
                                      "nights": "Different nights", "avg_score": "Avg haunting score"})
        st.dataframe(table, hide_index=True, use_container_width=True)

    sc = result.scored.assign(Status=result.scored["flagged"].map({True: "Flagged", False: "Normal"}))
    fig = px.scatter(sc, x="z_temp", y="z_emf", color="Status",
                     color_discrete_map={"Flagged": "#ff7518", "Normal": "#6f5f8f"},
                     hover_data=["room", "hour"],
                     labels={"z_temp": "Temperature z-score (negative = colder than usual)",
                             "z_emf": "EMF z-score (positive = more electric than usual)"})
    fig.update_layout(title="Every reading, compared with its own room")
    st.plotly_chart(theme.style_fig(fig), use_container_width=True)

    if st.checkbox("Compare all three methods on this case", key="scan_compare"):
        rows = []
        for m in detect.METHODS:
            r = detect.detect(case.readings, m, z_threshold, contamination)
            t = detect.top_suspect(r)
            rows.append({"Method": m, "Readings flagged": r.n_flagged,
                         "Top suspect": f"{t[0]} at {game.fmt_hour(t[1])}" if t else "None"})
        st.dataframe(pd.DataFrame(rows), hide_index=True, use_container_width=True)
        st.caption("If the methods disagree, trust the evidence that agrees: charts, SQL and witnesses.")


def tab_accuse(case) -> None:
    if S.result is None:
        st.markdown("### ⚖️ Name the culprit")
        st.caption("You get one final accusation per case. Tricks you collected cost points.")
        with st.form("accuse_form"):
            room = st.selectbox("Which room is haunted?", list(ROOMS))
            hour = st.selectbox("At what hour does the haunting peak?", list(range(24)),
                                format_func=game.fmt_hour, index=2)
            entity = st.selectbox("Which ghost is responsible?", list(ENTITIES))
            submitted = st.form_submit_button("⚖️ Submit final accusation")
        if submitted:
            seconds = time.time() - S.start
            S.guess = {"room": room, "hour": hour, "entity": entity}
            S.result = game.score_accusation(case, room, hour, entity, seconds, S.penalty)
            S.celebrate = S.result["solved"]
            st.rerun()
        return

    r, guess, truth = S.result, S.guess, case.answer
    if S.celebrate:
        st.balloons()
        S.celebrate = False
    if r["solved"]:
        st.success("🎉 CASE CLOSED! You named the room, the hour and the ghost.")
    elif r["accuracy"] >= 55:
        st.warning("😨 So close... part of your accusation was right.")
    else:
        st.error("💀 The ghost laughs at your accusation...")

    check = lambda ok: "✅" if ok else "❌"  # noqa: E731
    breakdown = pd.DataFrame([
        {"": "Room", "Your answer": guess["room"], "Truth": truth["room"], "Points": 40 if r["room_ok"] else 0},
        {"": "Hour", "Your answer": game.fmt_hour(guess["hour"]), "Truth": game.fmt_hour(truth["hour"]),
         "Points": r["hour_pts"]},
        {"": "Ghost", "Your answer": guess["entity"], "Truth": truth["entity"],
         "Points": 30 if r["entity_ok"] else 0},
    ])
    breakdown[""] = [f"{check(r['room_ok'])} Room", f"{check(r['hour_exact'])} Hour",
                     f"{check(r['entity_ok'])} Ghost"]
    st.dataframe(breakdown, hide_index=True, use_container_width=True)

    a, b, c, d = st.columns(4)
    a.metric("Accuracy", f"{r['accuracy']}%")
    b.metric("Speed bonus", f"+{r['speed_bonus']}")
    c.metric("Trick penalties", f"-{r['penalty']}")
    d.metric(f"Final score (x{r['multiplier']:g})", r["final"])

    st.markdown(report.ghost_report(case))

    st.divider()
    if not S.saved:
        with st.form("save_form"):
            name = st.text_input("Detective name", max_chars=24, placeholder="e.g. Navya")
            if st.form_submit_button("🏆 Save my score to the leaderboard"):
                db.add_score(name, r["final"], r["accuracy"], r["seconds"], case.difficulty, case.title)
                S.saved = True
                st.rerun()
    else:
        st.success("Your score is on the leaderboard! Check the 🏆 tab.")
    st.caption("Want another chance? Open a new case from the sidebar. Every case has brand-new data.")


def tab_leaderboard() -> None:
    st.markdown("### 🏆 Hall of Fame")
    st.caption("Ranked by score, then by speed. Score = accuracy + speed bonus - trick penalties, "
               "multiplied by the difficulty.")
    pick = st.selectbox("Difficulty", ["All"] + list(DIFFICULTY), key="lb_filter")
    board = db.top_scores(pick, 10)
    if board.empty:
        st.info("No detectives on the board yet. Be the first!")
        return
    medals = ["🥇", "🥈", "🥉"]
    board.insert(0, "Rank", [medals[i] if i < 3 else str(i + 1) for i in range(len(board))])
    board["seconds"] = board["seconds"].map(game.fmt_time)
    board["accuracy"] = board["accuracy"].astype(str) + "%"
    board = board.rename(columns={"detective": "Detective", "score": "Score", "accuracy": "Accuracy",
                                  "seconds": "Time", "difficulty": "Level", "case_title": "Case"})
    st.dataframe(board, hide_index=True, use_container_width=True)


# ---------------------------------------------------------------------------
# Page layout
# ---------------------------------------------------------------------------
with st.sidebar:
    st.markdown("## 🕯️ Case Desk")
    chosen = st.selectbox("Difficulty", list(DIFFICULTY), key="difficulty")
    st.caption(DIFFICULTY[chosen]["blurb"])
    if st.button("🕯️ Open a new case", key="new_case"):
        start_case(chosen)

    if S.case is not None:
        st.divider()
        st.markdown(f"**Case {S.case.case_id}**  \n*{S.case.title}*")
        st.metric("Trick penalties", f"-{S.penalty}")
        st.markdown("**🔮 Clues from the spirits**")
        if S.hints:
            for hint in S.hints:
                st.markdown(f"- {hint}")
        else:
            st.caption("Run a ghost scan and knock for a treat.")

theme.hero("Blackwood Manor is haunted. The data knows who did it.")

if S.case is None:
    st.markdown(
        '<div class="card"><h4>Welcome, detective 🕷️</h4>'
        "Blackwood Manor has been haunted all week. Sensor logs, guest registers and witness "
        "reports are waiting. Use <b>SQL</b>, <b>charts</b> and <b>anomaly detection</b> to find the room, "
        "the hour and the ghost.<br><br>"
        "👈 Pick a difficulty in the sidebar and click <b>Open a new case</b>.</div>",
        unsafe_allow_html=True,
    )
    tab_leaderboard()
    st.stop()

live_timer()
tabs = st.tabs(["📜 Case File", "📊 Evidence Board", "🗃️ SQL Lab", "🔦 Ghost Scan",
                "⚖️ Accuse", "🏆 Leaderboard"])
with tabs[0]:
    tab_case_file(S.case)
with tabs[1]:
    tab_evidence(S.case)
with tabs[2]:
    tab_sql(S.case)
with tabs[3]:
    tab_scan(S.case)
with tabs[4]:
    tab_accuse(S.case)
with tabs[5]:
    tab_leaderboard()
