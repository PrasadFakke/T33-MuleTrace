import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings

class TestMuleTrace(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_health_check(self):
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "healthy")

    def test_dashboard_summary(self):
        res = self.client.get("/api/dashboard/summary")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("kpis", data)
        self.assertGreaterEqual(data["kpis"]["total_accounts"], 40038)
        self.assertGreaterEqual(data["kpis"]["transactions_analyzed"], 7424845)
        self.assertIn("pattern_breakdown", data)
        self.assertIn("recent_alerts", data)
        self.assertIn("top_suspicious_accounts", data)

    def test_alerts_pagination_and_filter(self):
        res = self.client.get("/api/alerts?page=1&page_size=5&severity=CRITICAL")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("items", data)
        self.assertLessEqual(len(data["items"]), 5)
        for alert in data["items"]:
            self.assertEqual(alert["severity"], "CRITICAL")

    def test_accounts_search(self):
        res = self.client.get("/api/accounts?page=1&page_size=5&search=ACCT_149010")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreaterEqual(len(data["items"]), 1)
        self.assertEqual(data["items"][0]["account_id"], "ACCT_149010")

    def test_account_profile_and_risk(self):
        res = self.client.get("/api/accounts/ACCT_149010")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("account", data)
        self.assertIn("risk", data)
        self.assertIn("customer", data)
        self.assertGreater(data["risk"]["risk_score"], 60)
        self.assertGreater(len(data["risk"]["evidence_reasons"]), 0)

    def test_account_transactions(self):
        res = self.client.get("/api/accounts/ACCT_149010/transactions?page=1&page_size=10")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("items", data)
        self.assertGreater(data["total"], 0)

    def test_account_network_bipartite_graph(self):
        res = self.client.get("/api/accounts/ACCT_149010/network")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("nodes", data)
        self.assertIn("edges", data)
        self.assertGreater(len(data["nodes"]), 1)
        self.assertGreater(len(data["edges"]), 0)
        node_types = {n["type"] for n in data["nodes"]}
        self.assertIn("ACCOUNT", node_types)
        self.assertIn("COUNTERPARTY", node_types)

    def test_investigation_status_update(self):
        res = self.client.post("/api/investigations/ACCT_149010/status", json={
            "status": "UNDER_REVIEW",
            "analyst_notes": "Unit test verified suspicious pass-through flow"
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["new_status"], "UNDER_REVIEW")

        # Test REDO / reset back to previous state
        res_redo = self.client.post("/api/investigations/ACCT_149010/status", json={
            "status": "REDO",
            "analyst_notes": ""
        })
        self.assertEqual(res_redo.status_code, 200)
        data_redo = res_redo.json()
        self.assertTrue(data_redo["success"])
        self.assertEqual(data_redo["new_status"], "NEW")

    def test_analytics_endpoint(self):
        res = self.client.get("/api/analytics")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("monthly_volume", data)
        self.assertIn("channel_distribution", data)
        self.assertIn("risk_score_distribution", data)
        self.assertIn("pass_through_distribution", data)

    def test_settings_get_and_post(self):
        res = self.client.get("/api/settings")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["fan_in_min_cps"], settings.FAN_IN_MIN_CPS)

    def test_account_history_endpoint(self):
        res = self.client.get("/api/accounts/ACCT_149010/history?min_amount=1000&max_amount=100000&page=1&page_size=10")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("summary", data)
        self.assertIn("chart_data", data)
        self.assertIn("items", data)
        self.assertEqual(data["summary"]["account_id"], "ACCT_149010")
        self.assertGreater(data["total"], 0)
        self.assertGreater(data["summary"]["total_transactions"], 0)
        self.assertGreater(data["summary"]["total_inflow"], 0)

if __name__ == "__main__":
    unittest.main()

