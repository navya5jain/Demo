"""Halloween look and feel: CSS, animated pumpkin, floating ghost."""

import streamlit as st

PALETTE = ["#ff7518", "#b57cf2", "#7bd88f", "#ffd166", "#5ec8ff", "#ff4d6d"]
# dark purple -> orange -> yellow, used for heatmaps
HEAT_SCALE = ["#1a1128", "#5b1f8a", "#ff7518", "#ffd166"]

CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Creepster&family=Nunito:wght@400;600;800&display=swap');

html, body, [class*="css"] { font-family: 'Nunito', sans-serif; }
.stApp {
    background: radial-gradient(circle at 15% 0%, #2d1347 0%, #0d0a14 55%),
                #0d0a14;
}
h1, h2, h3 { font-family: 'Creepster', cursive !important; letter-spacing: 2px; }
h2, h3 { color: #ff7518 !important; }

/* ---------- hero banner ---------- */
.hero {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.6rem 1.2rem; margin-bottom: 0.8rem;
    border: 1px solid #ff751855; border-radius: 16px;
    background: linear-gradient(90deg, #1a1226 0%, #2b1442 100%);
    box-shadow: 0 0 24px #ff751833;
}
.hero h1 { margin: 0; padding: 0; font-size: 3rem; color: #ff7518; text-shadow: 0 0 14px #ff751888; }
.hero p { margin: 0; color: #cdb8ee; }
.pumpkin { font-size: 4rem; display: inline-block; margin-right: 1rem;
           animation: bob 3s ease-in-out infinite; filter: drop-shadow(0 0 14px #ff7518); }
.ghost { font-size: 3rem; display: inline-block;
         animation: drift 5s ease-in-out infinite; opacity: 0.9; }
.hero-left { display: flex; align-items: center; }
@keyframes bob { 0%,100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-9px) rotate(4deg); } }
@keyframes drift { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-18px,-8px); } }

/* ---------- cards ---------- */
.card {
    background: #1a1226; border: 1px solid #6a0dad66; border-radius: 14px;
    padding: 1rem 1.2rem; margin-bottom: 0.8rem;
}
.card h4 { color: #ff7518; margin-top: 0; }
.verdict-win  { border-left: 6px solid #7bd88f; }
.verdict-lose { border-left: 6px solid #ff4d6d; }

/* ---------- trick or treat popup ---------- */
.tot-big { font-size: 4.5rem; text-align: center; animation: bob 2.5s ease-in-out infinite;
           filter: drop-shadow(0 0 16px #ff7518); }
.tot-msg { text-align: center; font-size: 1.15rem; }

/* ---------- widgets ---------- */
.stButton > button, .stFormSubmitButton > button {
    border: 1px solid #ff7518; border-radius: 10px; font-weight: 800;
}
.stButton > button:hover, .stFormSubmitButton > button:hover {
    background: #ff7518; color: #0d0a14; box-shadow: 0 0 14px #ff7518aa;
}
[data-testid="stSidebar"] { border-right: 1px solid #ff751833; }
[data-testid="stMetricValue"] { color: #ffd166; }
.stTabs [data-baseweb="tab"] { font-weight: 800; }
</style>
"""


def inject() -> None:
    st.markdown(CSS, unsafe_allow_html=True)


def hero(subtitle: str = "Solve the haunting with data.") -> None:
    st.markdown(
        '<div class="hero"><div class="hero-left"><span class="pumpkin">🎃</span>'
        f'<div><h1>Haunted Data Detective</h1><p>{subtitle}</p></div></div>'
        '<span class="ghost">👻</span></div>',
        unsafe_allow_html=True,
    )


def style_fig(fig):
    """Make a Plotly figure match the dark Halloween theme."""
    fig.update_layout(
        template="plotly_dark",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(26,18,38,0.6)",
        font=dict(color="#f1e9ff"),
        margin=dict(l=10, r=10, t=40, b=10),
        legend_title_text="",
    )
    return fig
