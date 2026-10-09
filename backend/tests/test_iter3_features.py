"""Iteration 3 backend tests:
- Announcements (RBAC, visibility, labels, read, compulsory)
- Checks (patch/delete/due/negative temps/cleaning due flip)
- Training (catalogue, people RBAC, toggle, me)
- Accounts (username-preview, suffix)
- Files/uploads (image upload, token-based download, incident attachments)
"""
import io
import struct
import zlib
import pytest
import requests


PW = "password"


def _login(base_url, username):
    r = requests.post(f"{base_url}/api/auth/login", json={"username": username, "password": PW}, timeout=20)
    assert r.status_code == 200, f"login {username} -> {r.status_code} {r.text}"
    d = r.json()
    return d["access_token"], d["user"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def users(base_url):
    out = {}
    for u in ["paddyshepherd", "harrypatel", "tomwalker", "jakeryan", "miachen", "garrysingh"]:
        tok, user = _login(base_url, u)
        out[u] = {"tok": tok, "user": user, "h": _h(tok)}
    return out


def _png_bytes():
    # minimal 1x1 PNG
    sig = b"\x89PNG\r\n\x1a\n"
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
    idat = chunk(b"IDAT", zlib.compress(b"\x00\xff\x00\x00"))
    iend = chunk(b"IEND", b"")
    return sig + ihdr + idat + iend


# ---------------------- ANNOUNCEMENTS ----------------------
class TestAnnouncements:
    @pytest.fixture
    def created(self, base_url, users):
        payload = {
            "title": "TEST_IT3 Must Read Croydon Staff",
            "body": "Please read this important TEST announcement.",
            "urgency": "Urgent", "category": "Safety",
            "tags": ["TEST"], "audienceRoles": ["Staff"],
            "stores": ["Croydon"], "compulsory": True, "attachments": [],
        }
        r = requests.post(f"{base_url}/api/announcements", headers=users["harrypatel"]["h"], json=payload)
        assert r.status_code == 200, r.text
        ann = r.json()
        yield ann
        # cleanup via company (which can always delete)
        requests.delete(f"{base_url}/api/announcements/{ann['id']}", headers=users["paddyshepherd"]["h"])

    def test_options(self, base_url, users):
        r = requests.get(f"{base_url}/api/announcements/options", headers=users["harrypatel"]["h"])
        assert r.status_code == 200
        d = r.json()
        assert "Urgent" in d["urgencies"]
        assert "Safety" in d["categories"]
        assert set(d["roles"]) == {"Franchisee", "Manager", "Staff"}

    def test_labels_and_metadata(self, base_url, users, created):
        assert set(["Compulsory", "Staff Only", "Croydon", "TEST"]).issubset(set(created["labels"]))
        assert created["compulsory"] is True
        assert created["urgency"] == "Urgent"
        assert created["authorRole"] == "Franchisee"
        assert created["canEdit"] is True  # author sees own as editable

    def test_staff_in_store_sees_it(self, base_url, users, created):
        r = requests.get(f"{base_url}/api/announcements", headers=users["jakeryan"]["h"])
        assert r.status_code == 200
        ids = [a["id"] for a in r.json()]
        assert created["id"] in ids

    def test_staff_other_store_cannot_see(self, base_url, users, created):
        r = requests.get(f"{base_url}/api/announcements", headers=users["miachen"]["h"])
        assert created["id"] not in [a["id"] for a in r.json()]

    def test_manager_other_role_cannot_see(self, base_url, users, created):
        # tomwalker is Manager at Boronia -> not in audienceRoles=['Staff'] and not in Croydon -> hidden
        r = requests.get(f"{base_url}/api/announcements", headers=users["tomwalker"]["h"])
        assert created["id"] not in [a["id"] for a in r.json()]

    def test_company_sees_all(self, base_url, users, created):
        r = requests.get(f"{base_url}/api/announcements", headers=users["paddyshepherd"]["h"])
        assert created["id"] in [a["id"] for a in r.json()]

    def test_staff_cannot_post(self, base_url, users):
        r = requests.post(f"{base_url}/api/announcements", headers=users["jakeryan"]["h"], json={
            "title": "x", "body": "y", "urgency": "Normal", "category": "General",
            "tags": [], "audienceRoles": [], "stores": [], "compulsory": False, "attachments": []})
        assert r.status_code == 403

    def test_franchisee_cannot_post_other_store(self, base_url, users):
        r = requests.post(f"{base_url}/api/announcements", headers=users["harrypatel"]["h"], json={
            "title": "TEST wrong store", "body": "nope zzz", "urgency": "Normal", "category": "General",
            "tags": [], "audienceRoles": [], "stores": ["Boronia"], "compulsory": False, "attachments": []})
        assert r.status_code == 403

    def test_patch_as_author(self, base_url, users, created):
        payload = {"title": "TEST_IT3 Modified", "body": created["body"], "urgency": "Important",
                   "category": "Safety", "tags": ["TEST"], "audienceRoles": ["Staff"],
                   "stores": ["Croydon"], "compulsory": True, "attachments": []}
        r = requests.patch(f"{base_url}/api/announcements/{created['id']}",
                           headers=users["harrypatel"]["h"], json=payload)
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_IT3 Modified"

    def test_lower_rank_manager_cannot_patch_franchisee_ann(self, base_url, users, created):
        payload = {"title": "hack", "body": "hack hack hack", "urgency": "Normal",
                   "category": "General", "tags": [], "audienceRoles": [],
                   "stores": ["Boronia"], "compulsory": False, "attachments": []}
        r = requests.patch(f"{base_url}/api/announcements/{created['id']}",
                           headers=users["tomwalker"]["h"], json=payload)
        assert r.status_code == 403

    def test_higher_rank_company_can_patch(self, base_url, users, created):
        payload = {"title": "TEST_IT3 CompanyEdit", "body": created["body"], "urgency": "Normal",
                   "category": "Safety", "tags": ["TEST"], "audienceRoles": ["Staff"],
                   "stores": ["Croydon"], "compulsory": True, "attachments": []}
        r = requests.patch(f"{base_url}/api/announcements/{created['id']}",
                           headers=users["paddyshepherd"]["h"], json=payload)
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_IT3 CompanyEdit"

    def test_mark_read(self, base_url, users, created):
        r = requests.post(f"{base_url}/api/announcements/{created['id']}/read",
                          headers=users["jakeryan"]["h"])
        assert r.status_code == 200
        # verify read=true as jake
        r2 = requests.get(f"{base_url}/api/announcements", headers=users["jakeryan"]["h"])
        a = next(x for x in r2.json() if x["id"] == created["id"])
        assert a["read"] is True
        # read is per-user: miachen (even if she can't see this specific one) - verify paddy sees unread
        r3 = requests.get(f"{base_url}/api/announcements", headers=users["paddyshepherd"]["h"])
        a2 = next(x for x in r3.json() if x["id"] == created["id"])
        # paddy already was author? No - harrypatel was author. Paddy hasn't read it.
        assert a2["read"] is False

    def test_delete_lower_rank_forbidden_then_company_ok(self, base_url, users):
        # fresh ann by harrypatel
        payload = {"title": "TEST_IT3 Delete me", "body": "to be deleted sample body",
                   "urgency": "Normal", "category": "General", "tags": [],
                   "audienceRoles": [], "stores": ["Croydon"], "compulsory": False, "attachments": []}
        r = requests.post(f"{base_url}/api/announcements", headers=users["harrypatel"]["h"], json=payload)
        aid = r.json()["id"]
        rd = requests.delete(f"{base_url}/api/announcements/{aid}", headers=users["tomwalker"]["h"])
        assert rd.status_code == 403
        rd2 = requests.delete(f"{base_url}/api/announcements/{aid}", headers=users["paddyshepherd"]["h"])
        assert rd2.status_code == 200


# ---------------------- CHECKS (patch/delete/due/neg temp) ----------------------
class TestChecks:
    def test_due_structure(self, base_url, users):
        r = requests.get(f"{base_url}/api/checks/due", headers=users["harrypatel"]["h"])
        assert r.status_code == 200
        data = r.json()
        stores = [d["store"] for d in data]
        assert set(stores) == {"Langwarrin", "Croydon"}
        for row in data:
            assert len(row["items"]) == 4
            assert "pending" in row
            assert set(it["type"] for it in row["items"]) == {
                "Daily Temperature Check", "Cleaning Checklist", "Cooking Temperature Checks"}

    def test_cleaning_flips_due_to_done(self, base_url, users):
        # pick Langwarrin
        before = requests.get(f"{base_url}/api/checks/due", headers=users["harrypatel"]["h"]).json()
        lang_before = next(d for d in before if d["store"] == "Langwarrin")
        cleaning_before = next(it for it in lang_before["items"] if it["type"] == "Cleaning Checklist")
        pending_before = lang_before["pending"]
        # submit a cleaning checklist
        payload = {"store": "Langwarrin", "type": "Cleaning Checklist", "shift": "",
                   "values": [True, True, True, True, True]}
        r = requests.post(f"{base_url}/api/checks", headers=users["harrypatel"]["h"], json=payload)
        assert r.status_code == 200
        after = requests.get(f"{base_url}/api/checks/due", headers=users["harrypatel"]["h"]).json()
        lang_after = next(d for d in after if d["store"] == "Langwarrin")
        cleaning_after = next(it for it in lang_after["items"] if it["type"] == "Cleaning Checklist")
        assert cleaning_after["done"] is True
        if not cleaning_before["done"]:
            assert lang_after["pending"] == pending_before - 1

    def test_negative_temp_accepted(self, base_url, users):
        # Daily Temperature Check Freezer row has limitType=max limit=-18. -20 is ok.
        payload = {"store": "Croydon", "type": "Daily Temperature Check", "shift": "Open",
                   "values": [3, 4, -20]}
        r = requests.post(f"{base_url}/api/checks", headers=users["harrypatel"]["h"], json=payload)
        assert r.status_code == 200
        d = r.json()
        # Freezer entry (index 2) must be ok
        assert d["entries"][2]["value"] == -20
        assert d["entries"][2]["ok"] is True
        assert d["bad"] == 0

    def test_patch_recomputes_and_resets_status(self, base_url, users):
        # Create a check, then approve, then PATCH as franchisee -> should go back to awaiting
        payload = {"store": "Croydon", "type": "Cleaning Checklist",
                   "values": [True, True, True, True, True]}
        r = requests.post(f"{base_url}/api/checks", headers=users["harrypatel"]["h"], json=payload)
        cid = r.json()["id"]
        # approve
        requests.post(f"{base_url}/api/checks/{cid}/review", headers=users["paddyshepherd"]["h"],
                      json={"action": "approve"})
        # modify with one false
        r2 = requests.patch(f"{base_url}/api/checks/{cid}", headers=users["harrypatel"]["h"],
                            json={"shift": "", "values": [True, False, True, True, True]})
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        assert d2["status"] == "awaiting"
        assert d2["done"] == 4
        assert d2["rev"] == ""

    def test_staff_cannot_patch_others_check(self, base_url, users):
        # harrypatel submits in Croydon
        payload = {"store": "Croydon", "type": "Cleaning Checklist",
                   "values": [True, True, True, True, True]}
        r = requests.post(f"{base_url}/api/checks", headers=users["harrypatel"]["h"], json=payload)
        cid = r.json()["id"]
        # jakeryan (staff Croydon) tries to patch
        r2 = requests.patch(f"{base_url}/api/checks/{cid}", headers=users["jakeryan"]["h"],
                            json={"shift": "", "values": [False] * 5})
        assert r2.status_code == 403

    def test_staff_can_patch_own_awaiting(self, base_url, users):
        # jake submits one
        payload = {"store": "Croydon", "type": "Cleaning Checklist",
                   "values": [True, True, True, True, True]}
        r = requests.post(f"{base_url}/api/checks", headers=users["jakeryan"]["h"], json=payload)
        assert r.status_code == 200
        cid = r.json()["id"]
        r2 = requests.patch(f"{base_url}/api/checks/{cid}", headers=users["jakeryan"]["h"],
                            json={"shift": "", "values": [True, False, True, True, True]})
        assert r2.status_code == 200
        # staff cannot delete after approval, but can delete own awaiting
        rd = requests.delete(f"{base_url}/api/checks/{cid}", headers=users["jakeryan"]["h"])
        assert rd.status_code == 200

    def test_delete_check_permissions(self, base_url, users):
        payload = {"store": "Croydon", "type": "Cleaning Checklist",
                   "values": [True, True, True, True, True]}
        r = requests.post(f"{base_url}/api/checks", headers=users["harrypatel"]["h"], json=payload)
        cid = r.json()["id"]
        # jake (staff, same store, but not author) can NOT delete
        rd = requests.delete(f"{base_url}/api/checks/{cid}", headers=users["jakeryan"]["h"])
        assert rd.status_code == 403
        # franchisee can delete own
        rd2 = requests.delete(f"{base_url}/api/checks/{cid}", headers=users["harrypatel"]["h"])
        assert rd2.status_code == 200


# ---------------------- TRAINING ----------------------
class TestTraining:
    def test_catalogue(self, base_url, users):
        r = requests.get(f"{base_url}/api/training/catalogue", headers=users["harrypatel"]["h"])
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 5
        by_key = {c["key"]: c for c in data}
        assert len(by_key["prep"]["tasks"]) == 5
        assert len(by_key["pizza"]["tasks"]) == 3
        assert len(by_key["pasta"]["tasks"]) == 4
        assert len(by_key["fryer"]["tasks"]) == 3
        assert len(by_key["ops"]["tasks"]) == 3

    def test_people_franchisee_scope(self, base_url, users):
        r = requests.get(f"{base_url}/api/training/people", headers=users["harrypatel"]["h"])
        assert r.status_code == 200
        names = {p["name"] for p in r.json()}
        # Harry (franchisee at Langwarrin/Croydon) outranks Staff/Managers in those stores
        assert "Jake Ryan" in names
        assert "Mia Chen" in names
        # should not include company accounts or self
        assert "Paddy Shepherd" not in names
        assert "Harry Patel" not in names

    def test_people_company_sees_all_non_company(self, base_url, users):
        r = requests.get(f"{base_url}/api/training/people", headers=users["paddyshepherd"]["h"])
        assert r.status_code == 200
        people = r.json()
        roles = {p["role"] for p in people}
        assert "Company account" not in roles
        names = {p["name"] for p in people}
        assert {"Jake Ryan", "Mia Chen", "Tom Walker", "Harry Patel"}.issubset(names)

    def test_staff_people_forbidden(self, base_url, users):
        r = requests.get(f"{base_url}/api/training/people", headers=users["jakeryan"]["h"])
        assert r.status_code == 403

    def test_me_as_staff(self, base_url, users):
        r = requests.get(f"{base_url}/api/training/me", headers=users["jakeryan"]["h"])
        assert r.status_code == 200
        d = r.json()
        assert d["canEdit"] is False
        assert isinstance(d["done"], dict)

    def test_toggle_as_franchisee_ok(self, base_url, users):
        jake_id = users["jakeryan"]["user"]["id"]
        # tick
        r = requests.post(f"{base_url}/api/training/{jake_id}/toggle",
                          headers=users["harrypatel"]["h"],
                          json={"task": "prep-mushrooms", "done": True})
        assert r.status_code == 200
        # verify
        rv = requests.get(f"{base_url}/api/training/{jake_id}", headers=users["harrypatel"]["h"])
        assert "prep-mushrooms" in rv.json()["done"]
        assert rv.json()["done"]["prep-mushrooms"]["by"] == "Harry Patel"
        # untick cleanup
        requests.post(f"{base_url}/api/training/{jake_id}/toggle",
                      headers=users["harrypatel"]["h"],
                      json={"task": "prep-mushrooms", "done": False})

    def test_toggle_self_forbidden(self, base_url, users):
        jake_id = users["jakeryan"]["user"]["id"]
        r = requests.post(f"{base_url}/api/training/{jake_id}/toggle",
                          headers=users["jakeryan"]["h"],
                          json={"task": "prep-mushrooms", "done": True})
        assert r.status_code == 403

    def test_toggle_cross_store_forbidden(self, base_url, users):
        jake_id = users["jakeryan"]["user"]["id"]  # Croydon
        # miachen (staff Langwarrin) - staff role same rank so can_train returns False
        r = requests.post(f"{base_url}/api/training/{jake_id}/toggle",
                          headers=users["miachen"]["h"],
                          json={"task": "prep-mushrooms", "done": True})
        assert r.status_code == 403


# ---------------------- ACCOUNTS (username-preview) ----------------------
class TestAccountsUsername:
    def test_preview_suffix(self, base_url, users):
        r = requests.get(f"{base_url}/api/accounts/username-preview",
                         params={"first": "Harry", "last": "Patel"},
                         headers=users["paddyshepherd"]["h"])
        assert r.status_code == 200
        # harrypatel seeded -> expect harrypatel2
        assert r.json()["username"] == "harrypatel2"

    def test_preview_empty(self, base_url, users):
        r = requests.get(f"{base_url}/api/accounts/username-preview",
                         params={"first": "", "last": ""},
                         headers=users["paddyshepherd"]["h"])
        assert r.status_code == 200
        assert r.json()["username"] == ""

    def test_create_duplicate_name_assigns_suffix_then_cleanup(self, base_url, users):
        # harrypatel (franchisee) creates another 'Harry Patel' Staff at Croydon
        r = requests.post(f"{base_url}/api/accounts", headers=users["harrypatel"]["h"], json={
            "first": "Harry", "last": "Patel", "role": "Staff",
            "stores": ["Croydon"], "password": "password"})
        assert r.status_code == 200, r.text
        d = r.json()["user"]
        assert d["username"] == "harrypatel2"
        # cleanup
        requests.delete(f"{base_url}/api/accounts/{d['id']}", headers=users["harrypatel"]["h"])


# ---------------------- FILES / UPLOADS ----------------------
class TestFiles:
    def test_upload_download_png(self, base_url, users):
        png = _png_bytes()
        files = {"file": ("TEST_tiny.png", io.BytesIO(png), "image/png")}
        r = requests.post(f"{base_url}/api/upload", headers=users["harrypatel"]["h"], files=files)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["isImage"] is True
        assert "id" in d
        # GET without token -> 401
        r_no = requests.get(f"{base_url}/api/files/{d['id']}")
        assert r_no.status_code == 401
        # GET with ?token=
        r_ok = requests.get(f"{base_url}/api/files/{d['id']}",
                            params={"token": users["harrypatel"]["tok"]})
        assert r_ok.status_code == 200
        assert r_ok.headers.get("content-type", "").startswith("image/")
        assert len(r_ok.content) > 0

    def test_incident_with_attachment(self, base_url, users):
        png = _png_bytes()
        files = {"file": ("TEST_incpng.png", io.BytesIO(png), "image/png")}
        up = requests.post(f"{base_url}/api/upload", headers=users["harrypatel"]["h"], files=files).json()
        payload = {
            "store": "Croydon", "urgency": "Low", "type": "Equipment issue",
            "involved": [], "occurredAt": "2026-01-10 09:00",
            "location": "Oven", "description": "TEST attachment incident sample",
            "actions": "noted it", "followUp": False, "attachments": [up["id"]],
        }
        r = requests.post(f"{base_url}/api/incidents", headers=users["harrypatel"]["h"], json=payload)
        assert r.status_code == 200, r.text
        inc = r.json()
        assert isinstance(inc["attachments"], list) and len(inc["attachments"]) == 1
        assert inc["attachments"][0]["isImage"] is True
