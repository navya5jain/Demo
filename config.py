"""Shared constants for the Haunted Data Detective.

Everything that describes the *world* (rooms, ghosts, difficulty levels)
lives here, so the generator, the detector and the UI all agree.
"""

from datetime import datetime

# ---------------------------------------------------------------------------
# The manor: each room has a floor and a "normal" baseline for each sensor.
# The Cellar is naturally cold and the Kitchen naturally noisy - so raw values
# alone are misleading, and the detector must compare each room to ITSELF.
# ---------------------------------------------------------------------------
ROOMS = {
    "Library":        {"floor": "ground floor",  "temp": 20.5, "emf": 18.0, "noise": 28.0},
    "Ballroom":       {"floor": "ground floor",  "temp": 21.0, "emf": 22.0, "noise": 34.0},
    "Kitchen":        {"floor": "ground floor",  "temp": 23.0, "emf": 32.0, "noise": 42.0},
    "Cellar":         {"floor": "below ground",  "temp": 14.0, "emf": 16.0, "noise": 24.0},
    "Master Bedroom": {"floor": "upper floor",   "temp": 21.0, "emf": 17.0, "noise": 25.0},
    "Attic":          {"floor": "upper floor",   "temp": 19.0, "emf": 20.0, "noise": 26.0},
}

# ---------------------------------------------------------------------------
# The suspects.  Each ghost leaves a signature "clue" that guests report.
# ---------------------------------------------------------------------------
ENTITIES = {
    "The Phantom Pianist": {
        "clue": "Piano melodies",
        "lore": "A concert pianist who never left the stage. Guests hear ghostly "
                "sonatas drifting through the walls long after midnight.",
    },
    "The Weeping Bride": {
        "clue": "Dripping water",
        "lore": "Abandoned on her wedding night, she still wanders the manor. "
                "Wherever she cries, the air turns cold and damp.",
    },
    "The Headless Butler": {
        "clue": "Heavy footsteps",
        "lore": "Loyal to the very end, he still patrols the corridors, "
                "carrying a silver tray that nobody can see.",
    },
    "The Cursed Cook": {
        "clue": "Smell of smoke",
        "lore": "Fired by a cruel master, the cook's restless spirit leaves "
                "the lingering smell of burning stew.",
    },
    "The Restless Gardener": {
        "clue": "Rustling leaves",
        "lore": "He tends the manor's dead roses even now, and leaves a trail "
                "of rustling leaves on the floorboards.",
    },
    "The Whispering Child": {
        "clue": "Child's whisper",
        "lore": "A lonely little spirit who plays hide-and-seek with guests "
                "and whispers their names in the dark.",
    },
}
CLUE_TO_ENTITY = {v["clue"]: k for k, v in ENTITIES.items()}

# ---------------------------------------------------------------------------
# Time window of the case file: one week of Halloween, hourly sensor readings.
# ---------------------------------------------------------------------------
START = datetime(2026, 10, 25, 0, 0)
DAYS = 7

# The "witching hours" in which a haunting can peak (22:00 - 04:00).
HAUNT_HOURS = [22, 23, 0, 1, 2, 3, 4]

# Size of a full-strength haunting on each sensor (scaled by difficulty).
BASE_TEMP_DROP = 9.0   # degrees C
BASE_EMF_SPIKE = 60.0  # milligauss
BASE_NOISE_SPIKE = 20.0  # decibels

# ---------------------------------------------------------------------------
# Difficulty levels.
#   strength    - how big the haunting signal is (1.0 = obvious)
#   noise_mult  - random sensor noise multiplier
#   nights      - how many of the 7 nights the ghost appears (more = easier)
#   decoys      - rooms with a harmless one-off "event" (e.g. a party)
#   glitch      - number of random faulty EMF readings in one room
#   report_hit  - chance a witness report mentions the real ghost's clue
#   report_noise- number of random, unrelated witness reports
#   par_seconds - target solving time (used for the speed bonus)
#   multiplier  - final score multiplier
# ---------------------------------------------------------------------------
DIFFICULTY = {
    "Easy": {
        "strength": 1.0, "noise_mult": 1.0, "nights": 5, "decoys": 0, "glitch": 0,
        "report_hit": 0.90, "report_noise": 6,
        "par_seconds": 360, "multiplier": 1.0,
        "blurb": "A loud, obvious haunting. Perfect for learning the tools.",
    },
    "Medium": {
        "strength": 0.22, "noise_mult": 1.4, "nights": 4, "decoys": 1, "glitch": 0,
        "report_hit": 0.70, "report_noise": 14,
        "par_seconds": 600, "multiplier": 1.5,
        "blurb": "A weaker signal and a decoy room with a one-off event.",
    },
    "Hard": {
        "strength": 0.26, "noise_mult": 1.5, "nights": 4, "decoys": 2, "glitch": 10,
        "report_hit": 0.55, "report_noise": 24,
        "par_seconds": 900, "multiplier": 2.0,
        "blurb": "Subtle signal, two decoy rooms, a faulty sensor and unreliable witnesses.",
    },
}

CASE_TITLES = [
    "The Midnight Chill", "The Silent Ballroom", "The Cellar Whispers",
    "The Crimson Candle", "The Hollow Staircase", "The Raven's Warning",
    "The Fog at Midnight", "The Cobweb Conspiracy", "The Vanishing Footsteps",
    "The Lantern in the Attic",
]

GUEST_NAMES = [
    "Edgar Holloway", "Marguerite Vance", "Thaddeus Crow", "Ophelia Marsh",
    "Barnaby Finch", "Lenora Graves", "Cornelius Pike", "Rosalind Thorne",
    "Victor Ashby", "Imelda Frost", "Silas Wren", "Cordelia Black",
]
