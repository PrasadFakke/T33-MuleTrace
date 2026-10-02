import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import io
import uuid
import unittest
from fastapi.testclient import TestClient
from app.main import app

class TestDynamicIngestion(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.tag = uuid.uuid4().hex[:6].upper()
        cls.acct_id = f"ACCT_DYN_{cls.tag}"
        cls.cust_id = f"CUST_DYN_{cls.tag}"
        cls.batch_id = None

    def test_01_upload_and_preview(self):
        csv_content = f"""account_id,customer_id,transaction_id,transaction_timestamp,amount,txn_type,counterparty_id,channel
{self.acct_id},{self.cust_id},TXN_{self.tag}_001,2025-08-01 10:00:00,50000,C,CP_FEEDER_{self.tag},UPC
{self.acct_id},{self.cust_id},TXN_{self.tag}_002,2025-08-01 10:05:00,48000,D,CP_CASHOUT_{self.tag},UPD
{self.acct_id},{self.cust_id},TXN_{self.tag}_003,2025-08-01 10:10:00,30000,C,CP_FEEDER2_{self.tag},UPC
{self.acct_id},{self.cust_id},TXN_{self.tag}_004,2025-08-01 10:15:00,29500,D,CP_CASHOUT2_{self.tag},UPD
"""
        file_obj = io.BytesIO(csv_content.encode("utf-8"))
        res = self.client.post(
            "/api/ingestion/upload",
            files={"file": (f"test_batch_{self.tag}.csv", file_obj, "text/csv")}
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["total_rows"], 4)
        self.assertEqual(data["valid_rows"], 4)
        self.assertEqual(data["new_accounts_count"], 1)
        self.assertEqual(data["new_customers_count"], 1)
        self.assertGreater(len(data["preview_samples"]), 0)

        # Check frontend-required fields
        sample = data["preview_samples"][0]
        self.assertIn("row_num", sample)
        self.assertIn("account_id", sample)
        self.assertIn("counterparty", sample)
        self.assertIn("resolution", sample)
        self.assertIsInstance(sample["amount"], (int, float))

        TestDynamicIngestion.batch_id = data["batch_id"]

    def test_02_commit_batch(self):
        self.assertIsNotNone(self.batch_id)
        res = self.client.post("/api/ingestion/commit", json={"batch_id": self.batch_id})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["records_imported"], 4)
        self.assertEqual(data["new_accounts_created"], 1)
        self.assertIn("fraud_reanalysis", data)
        self.assertGreaterEqual(data["fraud_reanalysis"]["accounts_reanalyzed"], 1)

    def test_03_account_profile_and_risk(self):
        res = self.client.get(f"/api/accounts/{self.acct_id}")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["account"]["account_id"], self.acct_id)
        self.assertGreater(data["risk"]["risk_score"], 0)
        self.assertIn(data["risk"]["risk_level"], ["LOW", "MEDIUM", "HIGH", "CRITICAL"])
        self.assertGreater(len(data["risk"]["evidence_reasons"]), 0)

    def test_04_account_transactions(self):
        res = self.client.get(f"/api/accounts/{self.acct_id}/transactions?page=1&page_size=10")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["total"], 4)
        self.assertEqual(len(data["items"]), 4)
        self.assertEqual(data["items"][0]["account_id"], self.acct_id)

    def test_05_account_network_graph(self):
        res = self.client.get(f"/api/accounts/{self.acct_id}/network")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("nodes", data)
        self.assertIn("edges", data)
        node_ids = {n["id"] for n in data["nodes"]}
        self.assertIn(self.acct_id, node_ids)

    def test_06_ingestion_history(self):
        res = self.client.get("/api/ingestion/history")
        self.assertEqual(res.status_code, 200)
        batches = res.json()
        if isinstance(batches, dict):
            batches = batches.get("batches", [])
        batch_ids = [b["batch_id"] for b in batches]
        self.assertIn(self.batch_id, batch_ids)

    def test_07_rollback_batch(self):
        res = self.client.post(f"/api/ingestion/{self.batch_id}/rollback")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["transactions_removed"], 4)

        # Account should be removed
        res_acct = self.client.get(f"/api/accounts/{self.acct_id}")
        self.assertEqual(res_acct.status_code, 404)

    def test_08_upload_invalid_file(self):
        res = self.client.post(
            "/api/ingestion/upload",
            files={"file": ("malicious.exe", io.BytesIO(b"binary"), "application/octet-stream")}
        )
        self.assertEqual(res.status_code, 400)

if __name__ == "__main__":
    unittest.main()
