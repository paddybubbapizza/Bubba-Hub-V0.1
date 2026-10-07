"""Backend API tests for Bubba Pizza Hub.
Covers: auth, me/update/password, stores, announcements, templates,
checks (list/submit/review), accounts CRUD + role restrictions,
template layout management.
"""
import requests
import pytest


# ---------------------- AUTH ----------------------
class TestAuth:
    def test_login_company_ok(self, base_url):
        r = requests.post(f"{base_url}/api/auth/login",
                          json={"username": "paddyshepherd", "password": "password"})
        assert r.status_code == 200
        d = r.json()
        assert d["token_type"] == "bearer"
        assert d["user"]["role"] == "Company account"
        assert d["user"]["co"] is True
        assert len(d["user"]["stores"]) == 6

    def test_login_franchisee_ok(self, base_url):
        r = requests.post(f"{base_url}/api/auth/login",
                          json={"username": "harrypatel", "password": "password"})
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["role"] == "Franchisee"
        assert set(d["user"]["stores"]) == {"Langwarrin", "Croydon"}

    def test_login_invalid(self, base_url):
        r = requests.post(f"{base_url}/api/auth/login",
                          json={"username": "paddyshepherd", "password": "wrong"})
        assert r.status_code == 401
        assert "wrong" in r.json()["detail"].lower()

    def test_me_requires_auth(self, base_url):
        r = requests.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, base_url, company_auth):
        r = requests.get(f"{base_url}/api/auth/me", headers=company_auth["headers"])
        assert r.status_code == 200
        assert r.json()["username"] == "paddyshepherd"


# ---------------------- PROFILE UPDATE + PASSWORD ----------------------
class TestProfileAndPassword:
    """Use a short-lived user by creating one. But safest: use anilanil (unrelated to other tests)."""

    @pytest.fixture(scope="class")
    def anil(self, base_url):
        r = requests.post(f"{base_url}/api/auth/login",
                          json={"username": "anilanil", "password": "password"})
        assert r.status_code == 200
        return r.json()

    def test_patch_me(self, base_url, anil):
        h = {"Authorization": f"Bearer {anil['access_token']}"}
        r = requests.patch(f"{base_url}/api/auth/me", headers=h,
                           json={"pref": "Testy", "phone": "0400", "email": "t@x.com"})
        assert r.status_code == 200
        d = r.json()
        assert d["pref"] == "Testy"
        assert d["phone"] == "0400"
        assert d["email"] == "t@x.com"

    def test_change_password_wrong_current(self, base_url, anil):
        h = {"Authorization": f"Bearer {anil['access_token']}"}
        r = requests.post(f"{base_url}/api/auth/change-password", headers=h,
                          json={"current": "nope", "new": "newpass12"})
        assert r.status_code == 400

    def test_change_password_too_short(self, base_url, anil):
        h = {"Authorization": f"Bearer {anil['access_token']}"}
        r = requests.post(f"{base_url}/api/auth/change-password", headers=h,
                          json={"current": "password", "new": "short"})
        assert r.status_code == 400

    def test_change_password_success_then_restore(self, base_url, anil):
        h = {"Authorization": f"Bearer {anil['access_token']}"}
        r = requests.post(f"{base_url}/api/auth/change-password", headers=h,
                          json={"current": "password", "new": "newpass12"})
        assert r.status_code == 200
        # restore
        r2 = requests.post(f"{base_url}/api/auth/change-password", headers=h,
                           json={"current": "newpass12", "new": "password"})
        assert r2.status_code == 200


# ---------------------- REFERENCE DATA ----------------------
class TestReferenceData:
    def test_stores_requires_auth(self, base_url):
        r = requests.get(f"{base_url}/api/stores")
        assert r.status_code == 401

    def test_stores(self, base_url, company_auth):
        r = requests.get(f"{base_url}/api/stores", headers=company_auth["headers"])
        assert r.status_code == 200
        names = {s["name"] for s in r.json()}
        assert names == {"Boronia", "Langwarrin", "Croydon", "Wantirna South", "Pakenham", "Tarneit"}

    def test_announcements_auth_required(self, base_url):
        r = requests.get(f"{base_url}/api/announcements")
        assert r.status_code == 401

    def test_announcements(self, base_url, company_auth):
        r = requests.get(f"{base_url}/api/announcements", headers=company_auth["headers"])
        assert r.status_code == 200
        anns = r.json()
        assert len(anns) >= 3
        assert anns[0]["urgent"] is True

    def test_templates(self, base_url, company_auth):
        r = requests.get(f"{base_url}/api/templates", headers=company_auth["headers"])
        assert r.status_code == 200
        tmpls = r.json()
        names = {t["name"] for t in tmpls}
        assert {"Daily Temperature Check", "Cleaning Checklist", "Cooking Temperature Checks"}.issubset(names)
        dtc = next(t for t in tmpls if t["name"] == "Daily Temperature Check")
        # Boronia override has 5 rows
        assert "Boronia" in dtc["overrides"]
        assert len(dtc["overrides"]["Boronia"]) == 5


# ---------------------- CHECKS ----------------------
class TestChecks:
    def test_company_sees_all(self, base_url, company_auth):
        r = requests.get(f"{base_url}/api/checks", headers=company_auth["headers"])
        assert r.status_code == 200
        checks = r.json()
        stores = {c["store"] for c in checks}
        # should include stores from all 6
        assert len(stores) >= 5  # at least seeded ones

    def test_franchisee_scoped(self, base_url, franchisee_auth):
        r = requests.get(f"{base_url}/api/checks", headers=franchisee_auth["headers"])
        assert r.status_code == 200
        checks = r.json()
        stores = {c["store"] for c in checks}
        assert stores.issubset({"Langwarrin", "Croydon"})

    def test_submit_checklist(self, base_url, franchisee_auth):
        payload = {"store": "Langwarrin", "type": "Cleaning Checklist", "shift": "",
                   "values": [True, True, True, False, True]}
        r = requests.post(f"{base_url}/api/checks", headers=franchisee_auth["headers"], json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["done"] == 4
        assert d["total"] == 5
        assert d["bad"] == 0
        assert d["status"] == "awaiting"
        assert d["k"] == "l"

    def test_submit_temp_with_bad(self, base_url, franchisee_auth):
        # Croydon Daily Temperature Check: Prep fridge max 5, Walk-in max 5, Freezer max -18
        # Put freezer at -10 -> bad (greater than -18)
        payload = {"store": "Croydon", "type": "Daily Temperature Check", "shift": "Open",
                   "values": [3, 4, -10]}
        r = requests.post(f"{base_url}/api/checks", headers=franchisee_auth["headers"], json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] == 3
        assert d["bad"] == 1
        assert d["done"] == 2
        assert d["status"] == "awaiting"

    def test_submit_wrong_store_forbidden(self, base_url, franchisee_auth):
        payload = {"store": "Boronia", "type": "Cleaning Checklist", "values": [True]}
        r = requests.post(f"{base_url}/api/checks", headers=franchisee_auth["headers"], json=payload)
        assert r.status_code == 403

    def test_review_approve(self, base_url, franchisee_auth, company_auth):
        # submit then company approves
        payload = {"store": "Croydon", "type": "Cleaning Checklist",
                   "values": [True, True, True, True, True]}
        r = requests.post(f"{base_url}/api/checks", headers=franchisee_auth["headers"], json=payload)
        cid = r.json()["id"]
        r2 = requests.post(f"{base_url}/api/checks/{cid}/review",
                           headers=company_auth["headers"], json={"action": "approve"})
        assert r2.status_code == 200
        d = r2.json()
        assert d["status"] == "approved"
        assert d["rev"] == "Paddy Shepherd"

    def test_review_return(self, base_url, franchisee_auth, company_auth):
        payload = {"store": "Langwarrin", "type": "Cleaning Checklist",
                   "values": [True, True, True, True, True]}
        r = requests.post(f"{base_url}/api/checks", headers=franchisee_auth["headers"], json=payload)
        cid = r.json()["id"]
        r2 = requests.post(f"{base_url}/api/checks/{cid}/review",
                           headers=franchisee_auth["headers"], json={"action": "return"})
        assert r2.status_code == 200
        assert r2.json()["status"] == "returned"
        assert r2.json()["rev"] == "Harry Patel"


# ---------------------- ACCOUNTS ----------------------
class TestAccounts:
    def test_requires_manage(self, base_url, company_auth, franchisee_auth):
        for h in [company_auth["headers"], franchisee_auth["headers"]]:
            r = requests.get(f"{base_url}/api/accounts", headers=h)
            assert r.status_code == 200

    def test_create_staff_and_full_lifecycle(self, base_url, company_auth):
        h = company_auth["headers"]
        # create
        payload = {"first": "TESTStaff", "last": "User", "role": "Staff",
                   "stores": ["Boronia"], "password": "password"}
        r = requests.post(f"{base_url}/api/accounts", headers=h, json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        uid = d["user"]["id"]
        assert d["user"]["role"] == "Staff"
        assert d["user"]["stores"] == ["Boronia"]

        # update
        upd = {"first": "TESTStaff", "last": "User", "username": d["user"]["username"],
               "role": "Manager", "stores": ["Boronia", "Tarneit"], "active": True}
        r2 = requests.patch(f"{base_url}/api/accounts/{uid}", headers=h, json=upd)
        assert r2.status_code == 200
        assert r2.json()["role"] == "Manager"

        # verify via GET list
        r3 = requests.get(f"{base_url}/api/accounts", headers=h)
        assert any(a["id"] == uid for a in r3.json())

        # delete (soft)
        r4 = requests.delete(f"{base_url}/api/accounts/{uid}", headers=h)
        assert r4.status_code == 200

        # verify gone from list
        r5 = requests.get(f"{base_url}/api/accounts", headers=h)
        assert not any(a["id"] == uid for a in r5.json())

    def test_create_requires_store_for_staff(self, base_url, company_auth):
        r = requests.post(f"{base_url}/api/accounts", headers=company_auth["headers"],
                          json={"first": "TESTBad", "last": "Nostore", "role": "Staff", "stores": []})
        assert r.status_code == 400

    def test_franchisee_cannot_create_company(self, base_url, franchisee_auth):
        r = requests.post(f"{base_url}/api/accounts", headers=franchisee_auth["headers"],
                          json={"first": "TESTFCo", "last": "Nope", "role": "Company account", "stores": []})
        assert r.status_code == 403

    def test_franchisee_can_create_staff_in_their_store(self, base_url, franchisee_auth):
        payload = {"first": "TESTFranStaff", "last": "User", "role": "Staff",
                   "stores": ["Langwarrin"]}
        r = requests.post(f"{base_url}/api/accounts", headers=franchisee_auth["headers"], json=payload)
        assert r.status_code == 200
        uid = r.json()["user"]["id"]
        # cleanup
        requests.delete(f"{base_url}/api/accounts/{uid}", headers=franchisee_auth["headers"])


# ---------------------- TEMPLATE MANAGEMENT ----------------------
class TestTemplateManagement:
    def test_non_company_forbidden(self, base_url, franchisee_auth):
        r = requests.put(f"{base_url}/api/templates/Cleaning%20Checklist/layout",
                         headers=franchisee_auth["headers"],
                         json={"layout": "default", "rows": [{"name": "x"}]})
        assert r.status_code == 403

    def test_company_can_edit_and_reset(self, base_url, company_auth):
        h = company_auth["headers"]
        # Set custom layout for Tarneit on Cooking Temperature Checks
        rows = [{"name": "Chicken", "limitType": "min", "limit": 75},
                {"name": "Beef", "limitType": "min", "limit": 70}]
        r = requests.put(f"{base_url}/api/templates/Cooking Temperature Checks/layout",
                         headers=h, json={"layout": "Tarneit", "rows": rows})
        assert r.status_code == 200
        assert "Tarneit" in r.json()["overrides"]
        assert len(r.json()["overrides"]["Tarneit"]) == 2

        # reset
        r2 = requests.delete(f"{base_url}/api/templates/Cooking Temperature Checks/layout/Tarneit",
                             headers=h)
        assert r2.status_code == 200
        assert "Tarneit" not in r2.json()["overrides"]

    def test_edit_default_rows_requires_at_least_one(self, base_url, company_auth):
        r = requests.put(f"{base_url}/api/templates/Cleaning Checklist/layout",
                         headers=company_auth["headers"],
                         json={"layout": "default", "rows": []})
        assert r.status_code == 400
