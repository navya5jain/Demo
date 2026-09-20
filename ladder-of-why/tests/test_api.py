"""End-to-end tests against the offline provider - no API key, no network.

    python -m unittest discover -s tests -v
"""

import os
import tempfile
import unittest

# Must be set before the backend package reads them.
os.environ["LLM_PROVIDER"] = "mock"
os.environ["LADDER_DB"] = os.path.join(tempfile.mkdtemp(), "test.db")

from backend import game, llm  # noqa: E402
from backend.app import app  # noqa: E402


class ApiTests(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

    # ---------------------------------------------------------------- setup

    def start_case(self, scenario):
        response = self.client.post("/api/sessions", json={"scenario": scenario})
        self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
        return response.get_json()

    # ---------------------------------------------------------------- tests

    def test_health_reports_offline_provider(self):
        body = self.client.get("/api/health").get_json()
        self.assertTrue(body["ok"])
        self.assertEqual(body["provider"], "mock")
        self.assertFalse(body["live"])

    def test_ladder_shape(self):
        body = self.start_case(
            "There was an accident on the road when I was going to college."
        )
        self.assertTrue(3 <= len(body["rungs"]) <= 5)
        self.assertEqual(body["rungs"][0]["type"], "immediate")
        self.assertEqual(body["rungs"][-1]["type"], "principle")
        self.assertEqual(body["current_idx"], 0)
        for rung in body["rungs"]:
            self.assertTrue(rung["question"].endswith("?"))
            # The grading rubric must never reach the client.
            self.assertNotIn("good_answer", rung)

    def test_short_scenario_gets_a_shorter_ladder(self):
        self.assertEqual(len(self.start_case("I missed the bus.")["rungs"]), 3)

    def test_empty_scenario_is_rejected(self):
        self.assertEqual(self.client.post("/api/sessions", json={"scenario": " "}).status_code, 400)

    def test_full_case_awards_xp_and_badges(self):
        session = self.start_case("My friend suddenly stopped replying to my texts.")
        strong = (
            "I think it happened because he was overloaded with submissions that week, "
            "since he told me he had three deadlines, although I am assuming his silence "
            "was about workload and not about our argument on Friday, which could also "
            "explain it if he was actually upset with me."
        )

        last = None
        for i in range(len(session["rungs"])):
            response = self.client.post(
                f"/api/sessions/{session['id']}/answers", json={"idx": i, "answer": strong}
            )
            self.assertEqual(response.status_code, 200)
            last = response.get_json()
            self.assertTrue(1 <= last["score"] <= 5)

        self.assertTrue(last["done"])
        self.assertIsNotNone(last["avg_score"])
        self.assertGreater(last["me"]["xp"], 0)
        self.assertEqual(last["me"]["cases_closed"], 1)
        self.assertIn("first_case", {b["code"] for b in last["new_badges"]})

    def test_weak_answer_scores_below_strong_answer(self):
        session = self.start_case("The lab demo crashed in front of the whole class.")
        weak = self.client.post(
            f"/api/sessions/{session['id']}/answers", json={"idx": 0, "answer": "bad luck"}
        ).get_json()
        session2 = self.start_case("The lab demo crashed in front of the whole class again.")
        strong = self.client.post(
            f"/api/sessions/{session2['id']}/answers",
            json={
                "idx": 0,
                "answer": (
                    "It crashed because the port was already in use from an earlier run, "
                    "which meant the server never bound, and I had assumed the old process "
                    "had exited when I closed the terminal, although it was still running."
                ),
            },
        ).get_json()
        self.assertLess(weak["score"], strong["score"])

    def test_cannot_answer_the_same_rung_twice(self):
        session = self.start_case("I lost my wallet.")
        payload = {"idx": 0, "answer": "I left it on the canteen table because I was rushing."}
        url = f"/api/sessions/{session['id']}/answers"
        self.assertEqual(self.client.post(url, json=payload).status_code, 200)
        self.assertEqual(self.client.post(url, json=payload).status_code, 409)

    def test_rung_out_of_range_is_rejected(self):
        session = self.start_case("I missed the bus.")
        response = self.client.post(
            f"/api/sessions/{session['id']}/answers", json={"idx": 9, "answer": "because"}
        )
        self.assertEqual(response.status_code, 400)

    def test_unknown_session_is_404(self):
        self.assertEqual(self.client.get("/api/sessions/nope").status_code, 404)

    def test_session_can_be_resumed(self):
        session = self.start_case("I forgot my assignment deadline.")
        self.client.post(
            f"/api/sessions/{session['id']}/answers",
            json={"idx": 0, "answer": "I never wrote the deadline down because I trusted memory."},
        )
        resumed = self.client.get(f"/api/sessions/{session['id']}").get_json()
        self.assertEqual(resumed["current_idx"], 1)
        self.assertIsNotNone(resumed["rungs"][0]["score"])

    def test_history_lists_played_cases(self):
        session = self.start_case("The projector would not connect during my presentation.")
        self.client.post(
            f"/api/sessions/{session['id']}/answers",
            json={"idx": 0, "answer": "The cable was HDMI but the laptop only has USB-C."},
        )
        cases = self.client.get("/api/history").get_json()["cases"]
        self.assertTrue(
            any(c["scenario"].startswith("The projector") for c in cases), cases
        )

    def test_frontend_is_served(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Ladder of Why", response.data)


class UnitTests(unittest.TestCase):
    def test_extract_json_tolerates_prose_and_fences(self):
        self.assertEqual(llm.extract_json('```json\n{"score": 4}\n```'), {"score": 4})
        self.assertEqual(llm.extract_json('Here you go: {"score": 2} - hope that helps'), {"score": 2})
        with self.assertRaises(llm.LLMError):
            llm.extract_json("no json at all")

    def test_ranks_climb_with_xp(self):
        self.assertEqual(game.rank_for_xp(0)["rank"], "Curious Novice")
        self.assertEqual(game.rank_for_xp(1500)["rank"], "Rigorous Epistemologist")
        self.assertEqual(game.rank_for_xp(1500)["progress"], 1.0)
        self.assertTrue(0 < game.rank_for_xp(200)["progress"] < 1)

    def test_badges_reward_the_hard_rungs(self):
        codes = game.badges_earned(
            [
                {"type": "immediate", "score": 3},
                {"type": "assumptions_evidence", "score": 5},
                {"type": "principle", "score": 2},
            ],
            cases_closed=1,
        )
        self.assertIn("assumption_buster", codes)
        self.assertNotIn("principle_seeker", codes)
        self.assertNotIn("clean_climb", codes)


if __name__ == "__main__":
    unittest.main()
