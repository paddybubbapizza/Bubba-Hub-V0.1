"""Backend API tests for Incident Reports feature.
Covers: GET /api/incidents (role scoping), GET /api/incidents/options,
GET /api/stores/{store}/people, POST /api/incidents validation + happy path,
POST /api/incidents/{id}/review (franchisee/company/staff flow, double-review, 404).
"""
import re
import requests
import pytest


# ---------- helpers ----------
def _hdr(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Reference data ----------
class TestIncidentOptions:
    def test_options_shape(self, base_url, company_auth):
        r = requests.get(f"{base_url}/api/incidents/options", headers=company_auth["headers"])
        assert r.status_code == 200
        d = r.json()
        assert d["urgencies"] == ["Low", "Medium", "High", "Critical"]
        assert "Injury" in d["types"]
        assert "Equipment issue" in d["types"]
        assert "Food safety" in d["types"]
        assert len(d["types"]) >= 7

    def test_options_requires_auth(self, base_url):
        r = requests.get(f"{base_url}/api/incidents/options")
        assert r.status_code == 401


# ---------- Store people ----------
class TestStorePeople:
    def test_franchisee_own_store(self, base_url, franchisee_auth):
        r = requests.get(f"{base_url}/api/stores/Croydon/people", headers=franchisee_auth["headers"])
        assert r.status_code == 200
        people = r.json()
        # Should not include company accounts; franchisees registered to store may appear
        for p in people:
            assert p["role"] != "Company account"
            assert "id" in p and "name" in p

    def test_franchisee_forbidden_other_store(self, base_url, franchisee_auth):
        r = requests.get(f"{base_url}/api/stores/Pakenham/people", headers=franchisee_auth["headers"])
        assert r.status_code == 403

    def test_company_any_store(self, base_url, company_auth):
        r = requests.get(f"{base_url}/api/stores/Pakenham/people", headers=company_auth["headers"])
        assert r.status_code == 200


# ---------- Incidents list scoping ----------
class TestIncidentsListScoping:
    def test_franchisee_sees_only_own_stores(self, base_url, franchisee_auth):
        r = requests.get(f"{base_url}/api/incidents", headers=franchisee_auth["headers"])
        assert r.status_code == 200
        rows = r.json()
        stores = {i["store"] for i in rows}
        assert stores.issubset({"Langwarrin", "Croydon"}), f"franchisee saw outside stores: {stores}"

    def test_company_sees_all_stores(self, base_url, company_auth):
        r = requests.get(f"{base_url}/api/incidents", headers=company_auth["headers"])
        assert r.status_code == 200
        stores = {i["store"] for i in r.json()}
        # seeded incidents cover these four
        assert {"Croydon", "Boronia", "Pakenham", "Langwarrin"}.issubset(stores)

    def test_staff_scope_only_own_reports(self, base_url, franchisee_auth):
        """Create a Staff account under harrypatel on Croydon, submit an incident as that staff,
        confirm GET /incidents only returns their own report."""
        # Create staff (unique username each run)
        import time
        suffix = str(int(time.time()))[-6:]
        payload = {"first": f"TESTStaff{suffix}", "last": "Croy", "role": "Staff",
                   "stores": ["Croydon"], "password": "password"}
        r = requests.post(f"{base_url}/api/accounts", headers=franchisee_auth["headers"], json=payload)
        assert r.status_code == 200, r.text
        created = r.json()["user"]
        uid = created["id"]
        uname = created["username"]
        try:
            # Login as the staff
            lr = requests.post(f"{base_url}/api/auth/login",
                               json={"username": uname, "password": "password"})
            assert lr.status_code == 200
            staff_tok = lr.json()["access_token"]
            staff_hdr = _hdr(staff_tok)

            # Initially staff should see 0 incidents (none they filed yet)
            r0 = requests.get(f"{base_url}/api/incidents", headers=staff_hdr)
            assert r0.status_code == 200
            assert r0.json() == []

            # Staff submits an incident on Croydon
            body = {
                "store": "Croydon",
                "urgency": "Low",
                "type": "Other",
                "involved": [],
                "occurredAt": "Today 10:00am",
                "location": "Front counter",
                "description": "TEST staff scoping incident description",
                "actions": "noted",
                "followUp": False,
            }
            cr = requests.post(f"{base_url}/api/incidents", headers=staff_hdr, json=body)
            assert cr.status_code == 200, cr.text
            inc_id = cr.json()["id"]

            # Now staff should see exactly their own and only their own
            r2 = requests.get(f"{base_url}/api/incidents", headers=staff_hdr)
            assert r2.status_code == 200
            rows = r2.json()
            assert len(rows) == 1
            assert rows[0]["id"] == inc_id
            assert rows[0]["byId"] == uid
            assert rows[0]["by"].startswith(f"TESTStaff{suffix}")
        finally:
            requests.delete(f"{base_url}/api/accounts/{uid}", headers=franchisee_auth["headers"])


# ---------- Create incident ----------
class TestCreateIncident:
    def test_happy_path_returns_pending(self, base_url, franchisee_auth):
        body = {
            "store": "Croydon",
            "urgency": "High",
            "type": "Injury",
            "involved": [],
            "occurredAt": "Today 11:20am",
            "location": "Make line",
            "description": "TEST happy path incident description",
            "actions": "First aid",
            "followUp": True,
        }
        r = requests.post(f"{base_url}/api/incidents", headers=franchisee_auth["headers"], json=body)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "pending"
        assert d["by"] == "Harry Patel"
        assert d["store"] == "Croydon"
        assert d["urgency"] == "High"
        assert d["type"] == "Injury"
        assert d["followUp"] is True
        # dateLabel like "Today 7:05am" or "Today 11:20am"
        assert re.match(r"^Today \d{1,2}:\d{2}(am|pm)$", d["dateLabel"]), d["dateLabel"]

        # Verify via GET
        r2 = requests.get(f"{base_url}/api/incidents", headers=franchisee_auth["headers"])
        assert any(i["id"] == d["id"] for i in r2.json())

    def test_store_not_allowed(self, base_url, franchisee_auth):
        body = {"store": "Pakenham", "urgency": "Low", "type": "Other",
                "description": "TEST not my store at all"}
        r = requests.post(f"{base_url}/api/incidents", headers=franchisee_auth["headers"], json=body)
        assert r.status_code == 403

    def test_invalid_urgency(self, base_url, franchisee_auth):
        body = {"store": "Croydon", "urgency": "Super", "type": "Injury",
                "description": "TEST invalid urgency long enough"}
        r = requests.post(f"{base_url}/api/incidents", headers=franchisee_auth["headers"], json=body)
        assert r.status_code == 400

    def test_invalid_type(self, base_url, franchisee_auth):
        body = {"store": "Croydon", "urgency": "Low", "type": "Weirdthing",
                "description": "TEST invalid type long enough"}
        r = requests.post(f"{base_url}/api/incidents", headers=franchisee_auth["headers"], json=body)
        assert r.status_code == 400

    def test_description_too_short(self, base_url, franchisee_auth):
        body = {"store": "Croydon", "urgency": "Low", "type": "Injury", "description": "short"}
        r = requests.post(f"{base_url}/api/incidents", headers=franchisee_auth["headers"], json=body)
        assert r.status_code == 400


# ---------- Review incident ----------
class TestReviewIncident:
    def test_404_bad_id(self, base_url, company_auth):
        r = requests.post(f"{base_url}/api/incidents/not-an-id/review",
                          headers=company_auth["headers"], json={"note": "x"})
        assert r.status_code == 404
        # Valid-looking but non-existent ObjectId
        r2 = requests.post(f"{base_url}/api/incidents/507f1f77bcf86cd799439011/review",
                           headers=company_auth["headers"], json={"note": "x"})
        assert r2.status_code == 404

    def test_full_flow_and_double_review(self, base_url, franchisee_auth, company_auth):
        # Franchisee creates on Croydon
        body = {"store": "Croydon", "urgency": "Medium", "type": "Equipment issue",
                "description": "TEST review flow equipment issue"}
        c = requests.post(f"{base_url}/api/incidents", headers=franchisee_auth["headers"], json=body)
        assert c.status_code == 200
        inc_id = c.json()["id"]

        # Staff cannot review (create a staff)
        import time
        suffix = str(int(time.time()))[-6:]
        sp = {"first": f"TESTRev{suffix}", "last": "Croy", "role": "Staff",
              "stores": ["Croydon"], "password": "password"}
        sr = requests.post(f"{base_url}/api/accounts", headers=franchisee_auth["headers"], json=sp)
        assert sr.status_code == 200
        staff_user = sr.json()["user"]
        staff_tok = requests.post(f"{base_url}/api/auth/login",
                                  json={"username": staff_user["username"], "password": "password"}).json()["access_token"]
        try:
            rs = requests.post(f"{base_url}/api/incidents/{inc_id}/review",
                               headers=_hdr(staff_tok), json={"note": "nope"})
            assert rs.status_code == 403
        finally:
            requests.delete(f"{base_url}/api/accounts/{staff_user['id']}",
                            headers=franchisee_auth["headers"])

        # Franchisee on a DIFFERENT store (garrysingh - Pakenham) - 403
        gs = requests.post(f"{base_url}/api/auth/login",
                           json={"username": "garrysingh", "password": "password"})
        assert gs.status_code == 200
        rb = requests.post(f"{base_url}/api/incidents/{inc_id}/review",
                           headers=_hdr(gs.json()["access_token"]), json={"note": "boom"})
        assert rb.status_code == 403

        # Company reviews - success
        ok = requests.post(f"{base_url}/api/incidents/{inc_id}/review",
                           headers=company_auth["headers"], json={"note": "Fixed by technician"})
        assert ok.status_code == 200
        d = ok.json()
        assert d["status"] == "completed"
        assert d["rev"] == "Paddy Shepherd"
        assert d["revNote"] == "Fixed by technician"
        assert d["reviewedLabel"]  # non-empty rel_label

        # Second review -> 400 already completed
        again = requests.post(f"{base_url}/api/incidents/{inc_id}/review",
                              headers=company_auth["headers"], json={"note": "again"})
        assert again.status_code == 400
