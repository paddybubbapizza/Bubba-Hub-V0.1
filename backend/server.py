from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict, Annotated
from datetime import datetime, timedelta, timezone
from bson import ObjectId
import bcrypt
import jwt
from jwt.exceptions import InvalidTokenError

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
TOKEN_DAYS = 30

app = FastAPI()
api_router = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants mirrored from the original Bubba Hub prototype
# ---------------------------------------------------------------------------
PW = "password"
ROLE_COMPANY = "Company account"
ROLE_FRANCHISEE = "Franchisee"
ROLE_MANAGER = "Manager"
ROLE_STAFF = "Staff"

SEED_STORES = [
    {"name": "Boronia", "owner": "Company"},
    {"name": "Langwarrin", "owner": "Harry Patel"},
    {"name": "Croydon", "owner": "Harry Patel"},
    {"name": "Wantirna South", "owner": "Anil Anil"},
    {"name": "Pakenham", "owner": "Garry Singh"},
    {"name": "Tarneit", "owner": "Company"},
]
ALL_STORES = [s["name"] for s in SEED_STORES]

SEED_USERS = [
    {"u": "paddyshepherd", "name": "Paddy Shepherd", "first": "Paddy", "role": ROLE_COMPANY, "stores": ALL_STORES},
    {"u": "jamesscott", "name": "James Scott", "first": "James", "role": ROLE_COMPANY, "stores": ALL_STORES},
    {"u": "richardharris", "name": "Richard Harris", "first": "Richard", "role": ROLE_COMPANY, "stores": ALL_STORES},
    {"u": "damianhopper", "name": "Damian Hopper", "first": "Damian", "role": ROLE_COMPANY, "stores": ALL_STORES},
    {"u": "joshuahopper", "name": "Joshua Hopper", "first": "Joshua", "role": ROLE_COMPANY, "stores": ALL_STORES},
    {"u": "benhartleymackie", "name": "Ben HartleyMackie", "first": "Ben", "role": ROLE_COMPANY, "stores": ALL_STORES},
    {"u": "harrypatel", "name": "Harry Patel", "first": "Harry", "role": ROLE_FRANCHISEE, "stores": ["Langwarrin", "Croydon"]},
    {"u": "anilanil", "name": "Anil Anil", "first": "Anil", "role": ROLE_FRANCHISEE, "stores": ["Wantirna South"]},
    {"u": "garrysingh", "name": "Garry Singh", "first": "Garry", "role": ROLE_FRANCHISEE, "stores": ["Pakenham"]},
]

SEED_ANNOUNCEMENTS = [
    {"title": "Fryer oil recall: check batch numbers today", "tag": "Urgent", "dateLabel": "Today", "urgent": True,
     "body": "Check your oil delivery against the batch numbers in the supplier email. Stop using any affected oil and log it as an incident report.", "order": 0},
    {"title": "Spring menu starts Monday", "tag": "General", "dateLabel": "Yesterday", "urgent": False,
     "body": "New posters ship this week. Everyone should read the allergen sheet before opening on Monday.", "order": 1},
    {"title": "Public holiday trading hours", "tag": "General", "dateLabel": "3 days ago", "urgent": False,
     "body": "Check the rostering page for holiday hours. Franchisees will confirm staffing with their teams.", "order": 2},
]


def temp_row(name, limit_type, limit):
    return {"name": name, "limitType": limit_type, "limit": limit}


def item_row(name):
    return {"name": name}


def row_hint(r):
    return f"{r['limit']}°C or colder" if r["limitType"] == "max" else f"{r['limit']}°C or hotter"


SEED_TEMPLATES = [
    {
        "name": "Daily Temperature Check", "k": "t", "shift": True, "order": 0,
        "rows": [temp_row("Prep fridge", "max", 5), temp_row("Walk-in fridge", "max", 5), temp_row("Freezer", "max", -18)],
        "overrides": {
            "Boronia": [temp_row("Prep fridge", "max", 5), temp_row("Walk-in fridge", "max", 5),
                        temp_row("Freezer 1", "max", -18), temp_row("Freezer 2", "max", -18), temp_row("Freezer 3", "max", -18)],
        },
    },
    {
        "name": "Cleaning Checklist", "k": "l", "shift": False, "order": 1,
        "rows": [item_row("Prep benches and equipment sanitised"), item_row("Oven and make-line wiped down"),
                 item_row("Floors swept and mopped"), item_row("Hand wash stations stocked and clean"),
                 item_row("Bins emptied and lined")],
        "overrides": {},
    },
    {
        "name": "Cooking Temperature Checks", "k": "t", "shift": False, "order": 2,
        "rows": [temp_row("Chicken", "min", 75), temp_row("Meat toppings", "min", 75), temp_row("Cooked sides", "min", 75)],
        "overrides": {},
    },
]

SEED_CHECKS = [
    {"store": "Langwarrin", "type": "Cleaning Checklist", "shift": "", "by": "Mia", "dateLabel": "Today 7:05am", "done": 5, "total": 5, "bad": 0, "status": "awaiting", "rev": ""},
    {"store": "Croydon", "type": "Daily Temperature Check", "shift": "Open", "by": "Jake", "dateLabel": "Today 6:40am", "done": 2, "total": 3, "bad": 1, "status": "awaiting", "rev": ""},
    {"store": "Boronia", "type": "Cooking Temperature Checks", "shift": "", "by": "Tom", "dateLabel": "Today 12:15pm", "done": 3, "total": 3, "bad": 0, "status": "awaiting", "rev": ""},
    {"store": "Pakenham", "type": "Daily Temperature Check", "shift": "Close", "by": "Lily", "dateLabel": "Yesterday 7:10am", "done": 3, "total": 3, "bad": 0, "status": "approved", "rev": "Garry Singh"},
    {"store": "Wantirna South", "type": "Cleaning Checklist", "shift": "", "by": "Sanjay", "dateLabel": "Yesterday 10:15pm", "done": 3, "total": 5, "bad": 0, "status": "returned", "rev": "Anil Anil"},
    {"store": "Tarneit", "type": "Cooking Temperature Checks", "shift": "", "by": "Ellie", "dateLabel": "Yesterday 6:30pm", "done": 3, "total": 3, "bad": 0, "status": "approved", "rev": "Paddy Shepherd"},
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def hash_pw(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_pw(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except (ValueError, TypeError):
        return False


def make_token(user: dict) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": str(user["_id"]), "exp": now + timedelta(days=TOKEN_DAYS), "iat": now},
        JWT_SECRET, algorithm=JWT_ALGORITHM,
    )


def public_user(u: dict) -> dict:
    return {
        "id": str(u["_id"]),
        "username": u["username"],
        "name": u["name"],
        "first": u.get("first", ""),
        "role": u["role"],
        "stores": u.get("stores", []),
        "co": u["role"] == ROLE_COMPANY,
        "active": u.get("active", True),
        "pref": u.get("pref", ""),
        "dob": u.get("dob", ""),
        "gender": u.get("gender", ""),
        "phone": u.get("phone", ""),
        "email": u.get("email", ""),
    }


async def current_user(credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer)]) -> dict:
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    if not credentials or credentials.scheme.lower() != "bearer":
        raise unauthorized
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        uid = payload.get("sub")
        if not uid or not ObjectId.is_valid(uid):
            raise unauthorized
    except InvalidTokenError:
        raise unauthorized
    u = await db.users.find_one({"_id": ObjectId(uid), "deleted_at": None})
    if not u or not u.get("active", True):
        raise unauthorized
    return u


def require_manage(user: dict):
    if user["role"] not in (ROLE_COMPANY, ROLE_FRANCHISEE):
        raise HTTPException(status_code=403, detail="You do not have management access.")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class LoginIn(BaseModel):
    username: str
    password: str


class DetailsIn(BaseModel):
    pref: str = ""
    dob: str = ""
    gender: str = ""
    phone: str = ""
    email: str = ""


class PasswordIn(BaseModel):
    current: str
    new: str


class CheckSubmitIn(BaseModel):
    store: str
    type: str
    shift: str = ""
    values: List[Any]  # temp: numbers; checklist: booleans


class ReviewIn(BaseModel):
    action: str  # approve | return


class AccountIn(BaseModel):
    first: str
    last: str
    role: str
    stores: List[str] = []
    password: Optional[str] = None


class AccountUpdateIn(BaseModel):
    first: str
    last: str
    username: str
    role: str
    stores: List[str] = []
    password: Optional[str] = None
    active: bool = True


class LayoutIn(BaseModel):
    layout: str  # "default" or a store name
    rows: List[Dict[str, Any]]


class TemplateIn(BaseModel):
    name: str
    k: str  # t | l
    shift: bool = False


# ---------------------------------------------------------------------------
# Seed
# ---------------------------------------------------------------------------
def synth_entries(type_name: str, store: str, done: int, bad: int):
    """Build plausible per-row entries for a seeded check."""
    tmpl = next((t for t in SEED_TEMPLATES if t["name"] == type_name), None)
    if not tmpl:
        return []
    rows = (tmpl.get("overrides", {}) or {}).get(store) or tmpl["rows"]
    entries = []
    if tmpl["k"] == "l":
        for i, r in enumerate(rows):
            entries.append({"name": r["name"], "done": i < done})
    else:
        for i, r in enumerate(rows):
            ok = i >= bad
            if r["limitType"] == "max":
                value = r["limit"] - 1 if ok else r["limit"] + 4
            else:
                value = r["limit"] + 2 if ok else r["limit"] - 8
            entries.append({"name": r["name"], "hint": row_hint(r), "value": value, "ok": ok})
    return entries


async def seed():
    await db.users.create_index("username", unique=True)
    if await db.stores.count_documents({}) == 0:
        await db.stores.insert_many([dict(s) for s in SEED_STORES])
    if await db.announcements.count_documents({}) == 0:
        await db.announcements.insert_many([dict(a) for a in SEED_ANNOUNCEMENTS])
    if await db.templates.count_documents({}) == 0:
        await db.templates.insert_many([dict(t) for t in SEED_TEMPLATES])
    if await db.users.count_documents({}) == 0:
        docs = []
        ph = hash_pw(PW)
        for s in SEED_USERS:
            docs.append({
                "username": s["u"], "password_hash": ph, "name": s["name"], "first": s["first"],
                "role": s["role"], "stores": s["stores"], "active": True,
                "pref": "", "dob": "", "gender": "", "phone": "", "email": "",
                "deleted_at": None, "created_at": datetime.now(timezone.utc),
            })
        await db.users.insert_many(docs)
    if await db.checks.count_documents({}) == 0:
        docs = []
        for c in SEED_CHECKS:
            d = dict(c)
            tmpl = next((t for t in SEED_TEMPLATES if t["name"] == c["type"]), None)
            d["k"] = tmpl["k"] if tmpl else "t"
            d["entries"] = synth_entries(c["type"], c["store"], c["done"], c["bad"])
            d["created_at"] = datetime.now(timezone.utc)
            docs.append(d)
        await db.checks.insert_many(docs)


@app.on_event("startup")
async def on_startup():
    await db.command("ping")
    await seed()
    logger.info("Bubba Hub backend ready")


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api_router.post("/auth/login")
async def login(data: LoginIn):
    uname = data.username.strip().lower()
    u = await db.users.find_one({"username": uname, "deleted_at": None})
    if not u or not verify_pw(data.password, u["password_hash"]):
        raise HTTPException(status_code=401, detail="Username or password is wrong. Check both and try again.")
    if not u.get("active", True):
        raise HTTPException(status_code=403, detail="This account is turned off. Contact your franchisee or head office.")
    return {"access_token": make_token(u), "token_type": "bearer", "user": public_user(u)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return public_user(user)


@api_router.patch("/auth/me")
async def update_me(data: DetailsIn, user: dict = Depends(current_user)):
    patch = {"pref": data.pref.strip(), "dob": data.dob, "gender": data.gender,
             "phone": data.phone.strip(), "email": data.email.strip()}
    await db.users.update_one({"_id": user["_id"]}, {"$set": patch})
    u = await db.users.find_one({"_id": user["_id"]})
    return public_user(u)


@api_router.post("/auth/change-password")
async def change_password(data: PasswordIn, user: dict = Depends(current_user)):
    if not verify_pw(data.current, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Your current password is wrong.")
    if len(data.new) < 8:
        raise HTTPException(status_code=400, detail="Use at least 8 characters for the new password.")
    if data.new == data.current:
        raise HTTPException(status_code=400, detail="Choose a password that is different from your current one.")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"password_hash": hash_pw(data.new)}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Reference data
# ---------------------------------------------------------------------------
@api_router.get("/stores")
async def get_stores(user: dict = Depends(current_user)):
    stores = await db.stores.find().to_list(1000)
    return [{"name": s["name"], "owner": s.get("owner", "")} for s in stores]


@api_router.get("/announcements")
async def get_announcements(user: dict = Depends(current_user)):
    anns = await db.announcements.find().sort("order", 1).to_list(1000)
    return [{"title": a["title"], "tag": a["tag"], "dateLabel": a["dateLabel"],
             "urgent": a.get("urgent", False), "body": a["body"]} for a in anns]


async def template_map() -> Dict[str, dict]:
    tmpls = await db.templates.find().to_list(1000)
    return {t["name"]: t for t in tmpls}


def rows_for(tmpl: dict, store: str):
    ov = tmpl.get("overrides", {}) or {}
    return ov.get(store) or tmpl["rows"]


def serialize_template(t: dict) -> dict:
    return {
        "name": t["name"], "k": t["k"], "shift": t.get("shift", False),
        "rows": t["rows"], "overrides": t.get("overrides", {}) or {},
    }


@api_router.get("/templates")
async def get_templates(user: dict = Depends(current_user)):
    tmpls = await db.templates.find().sort("order", 1).to_list(1000)
    return [serialize_template(t) for t in tmpls]


# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------
def serialize_check(c: dict) -> dict:
    return {
        "id": str(c["_id"]), "store": c["store"], "type": c["type"], "shift": c.get("shift", ""),
        "by": c["by"], "dateLabel": c["dateLabel"], "done": c["done"], "total": c["total"],
        "bad": c["bad"], "status": c["status"], "rev": c.get("rev", ""), "k": c.get("k", "t"),
        "entries": c.get("entries", []),
    }


@api_router.get("/checks")
async def get_checks(user: dict = Depends(current_user)):
    stores = ALL_STORES if user["role"] == ROLE_COMPANY else user.get("stores", [])
    cursor = db.checks.find({"store": {"$in": stores}}).sort("created_at", -1)
    checks = await cursor.to_list(1000)
    tmap = await template_map()
    out = []
    for c in checks:
        d = serialize_check(c)
        t = tmap.get(c["type"])
        d["k"] = t["k"] if t else "t"
        out.append(d)
    return out


@api_router.post("/checks")
async def submit_check(data: CheckSubmitIn, user: dict = Depends(current_user)):
    allowed = ALL_STORES if user["role"] == ROLE_COMPANY else user.get("stores", [])
    if data.store not in allowed:
        raise HTTPException(status_code=403, detail="You cannot submit a check for that store.")
    tmap = await template_map()
    tmpl = tmap.get(data.type)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Unknown check type.")
    rows = rows_for(tmpl, data.store)
    total = len(rows)
    bad = 0
    entries = []
    if tmpl["k"] == "l":
        done = sum(1 for v in data.values if v)
        for i, row in enumerate(rows):
            entries.append({"name": row["name"], "done": bool(data.values[i]) if i < len(data.values) else False})
    else:
        for i, row in enumerate(rows):
            try:
                v = float(data.values[i])
            except (IndexError, TypeError, ValueError):
                v = None
            ok = True
            if v is None:
                bad += 1
                ok = False
            elif row["limitType"] == "max":
                if v > row["limit"]:
                    bad += 1
                    ok = False
            else:
                if v < row["limit"]:
                    bad += 1
                    ok = False
            entries.append({"name": row["name"], "hint": row_hint(row), "value": v, "ok": ok})
        done = total - bad
    doc = {
        "store": data.store, "type": data.type, "shift": data.shift or "",
        "by": user["name"], "dateLabel": "Just now", "done": done, "total": total,
        "bad": bad, "status": "awaiting", "rev": "", "k": tmpl["k"], "entries": entries,
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.checks.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize_check(doc)


@api_router.post("/checks/{check_id}/review")
async def review_check(check_id: str, data: ReviewIn, user: dict = Depends(current_user)):
    if user["role"] == ROLE_STAFF:
        raise HTTPException(status_code=403, detail="You cannot review checks.")
    if not ObjectId.is_valid(check_id):
        raise HTTPException(status_code=404, detail="Check not found.")
    c = await db.checks.find_one({"_id": ObjectId(check_id)})
    if not c:
        raise HTTPException(status_code=404, detail="Check not found.")
    allowed = ALL_STORES if user["role"] == ROLE_COMPANY else user.get("stores", [])
    if c["store"] not in allowed:
        raise HTTPException(status_code=403, detail="That check is not for your store.")
    new_status = "approved" if data.action == "approve" else "returned"
    await db.checks.update_one({"_id": c["_id"]}, {"$set": {"status": new_status, "rev": user["name"]}})
    c["status"] = new_status
    c["rev"] = user["name"]
    return serialize_check(c)


# ---------------------------------------------------------------------------
# Account management
# ---------------------------------------------------------------------------
def can_see_account(viewer: dict, acct: dict) -> bool:
    if viewer["role"] == ROLE_COMPANY:
        return True
    # franchisee: staff/managers whose stores are all within theirs
    if acct["role"] not in (ROLE_STAFF, ROLE_MANAGER):
        return False
    vstores = set(viewer.get("stores", []))
    return all(s in vstores for s in acct.get("stores", []))


@api_router.get("/accounts")
async def get_accounts(user: dict = Depends(current_user)):
    require_manage(user)
    accts = await db.users.find({"deleted_at": None}).to_list(1000)
    visible = [a for a in accts if user["role"] == ROLE_COMPANY or can_see_account(user, a) or a["_id"] == user["_id"]]
    return [public_user(a) for a in visible]


@api_router.post("/accounts")
async def create_account(data: AccountIn, user: dict = Depends(current_user)):
    require_manage(user)
    if user["role"] == ROLE_FRANCHISEE and data.role not in (ROLE_STAFF, ROLE_MANAGER):
        raise HTTPException(status_code=403, detail="Franchisees can only add staff and managers.")
    first = " ".join(data.first.split())
    last = " ".join(data.last.split())
    if not first or not last:
        raise HTTPException(status_code=400, detail="Enter a first and last name.")
    uname = (first + last).lower()
    import re
    uname = re.sub(r"[^a-z0-9]", "", uname)
    if await db.users.find_one({"username": uname, "deleted_at": None}):
        raise HTTPException(status_code=400, detail=f"The username {uname} is already taken.")
    role = data.role
    if role == ROLE_COMPANY:
        if user["role"] != ROLE_COMPANY:
            raise HTTPException(status_code=403, detail="Only company accounts can add company accounts.")
        stores = ALL_STORES
    elif role in (ROLE_FRANCHISEE, ROLE_MANAGER):
        stores = data.stores
        if not stores:
            raise HTTPException(status_code=400, detail=f"Choose at least one store for a {role.lower()}.")
    else:
        role = ROLE_STAFF
        stores = data.stores[:1]
        if not stores or not stores[0]:
            raise HTTPException(status_code=400, detail="Choose a store.")
    if user["role"] == ROLE_FRANCHISEE and any(s not in user.get("stores", []) for s in stores):
        raise HTTPException(status_code=403, detail="You can only assign your own stores.")
    doc = {
        "username": uname, "password_hash": hash_pw(data.password or PW),
        "name": first + " " + last, "first": first, "role": role, "stores": stores,
        "active": True, "pref": "", "dob": "", "gender": "", "phone": "", "email": "",
        "deleted_at": None, "created_at": datetime.now(timezone.utc),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    return {"user": public_user(doc), "message": f"{first} {last} added. Username: {uname}"}


@api_router.patch("/accounts/{acct_id}")
async def update_account(acct_id: str, data: AccountUpdateIn, user: dict = Depends(current_user)):
    require_manage(user)
    if not ObjectId.is_valid(acct_id):
        raise HTTPException(status_code=404, detail="Account not found.")
    a = await db.users.find_one({"_id": ObjectId(acct_id), "deleted_at": None})
    if not a:
        raise HTTPException(status_code=404, detail="Account not found.")
    first = " ".join(data.first.split())
    last = " ".join(data.last.split())
    uname = data.username.strip().lower()
    import re
    if not first or not last:
        raise HTTPException(status_code=400, detail="Enter a first and last name.")
    if not re.fullmatch(r"[a-z0-9]+", uname):
        raise HTTPException(status_code=400, detail="Usernames can only use lowercase letters and numbers.")
    other = await db.users.find_one({"username": uname, "deleted_at": None, "_id": {"$ne": a["_id"]}})
    if other:
        raise HTTPException(status_code=400, detail=f"The username {uname} is already taken.")
    role = data.role
    if role == ROLE_COMPANY:
        stores = ALL_STORES
    elif role in (ROLE_FRANCHISEE, ROLE_MANAGER):
        stores = data.stores
        if not stores:
            raise HTTPException(status_code=400, detail="Choose at least one store.")
    else:
        role = ROLE_STAFF
        stores = data.stores[:1]
        if not stores or not stores[0]:
            raise HTTPException(status_code=400, detail="Choose a store.")
    if user["role"] == ROLE_FRANCHISEE:
        if role not in (ROLE_STAFF, ROLE_MANAGER):
            raise HTTPException(status_code=403, detail="Franchisees can only manage staff and managers.")
        if any(s not in user.get("stores", []) for s in stores):
            raise HTTPException(status_code=403, detail="You can only assign your own stores.")
    patch = {"username": uname, "name": first + " " + last, "first": first,
             "role": role, "stores": stores, "active": data.active}
    if data.password:
        if len(data.password) < 8:
            raise HTTPException(status_code=400, detail="Use at least 8 characters for the new password.")
        patch["password_hash"] = hash_pw(data.password)
    await db.users.update_one({"_id": a["_id"]}, {"$set": patch})
    u = await db.users.find_one({"_id": a["_id"]})
    return public_user(u)


@api_router.delete("/accounts/{acct_id}")
async def delete_account(acct_id: str, user: dict = Depends(current_user)):
    require_manage(user)
    if not ObjectId.is_valid(acct_id):
        raise HTTPException(status_code=404, detail="Account not found.")
    if str(user["_id"]) == acct_id:
        raise HTTPException(status_code=400, detail="You cannot remove your own account.")
    await db.users.update_one({"_id": ObjectId(acct_id)}, {"$set": {"deleted_at": datetime.now(timezone.utc)}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Template management (company only)
# ---------------------------------------------------------------------------
@api_router.post("/templates")
async def create_template(data: TemplateIn, user: dict = Depends(current_user)):
    if user["role"] != ROLE_COMPANY:
        raise HTTPException(status_code=403, detail="Only company accounts can add checks.")
    name = " ".join(data.name.split())
    if not name:
        raise HTTPException(status_code=400, detail="Enter a check name.")
    if await db.templates.find_one({"name": name}):
        raise HTTPException(status_code=400, detail="Enter a check name that isn't already used.")
    is_temp = data.k == "t"
    rows = [temp_row("Reading 1", "max", 5)] if is_temp else [item_row("Item 1")]
    count = await db.templates.count_documents({})
    doc = {"name": name, "k": "t" if is_temp else "l", "shift": bool(data.shift),
           "rows": rows, "overrides": {}, "order": count}
    await db.templates.insert_one(doc)
    return serialize_template(doc)


@api_router.put("/templates/{name}/layout")
async def set_layout(name: str, data: LayoutIn, user: dict = Depends(current_user)):
    if user["role"] != ROLE_COMPANY:
        raise HTTPException(status_code=403, detail="Only company accounts can edit checks.")
    t = await db.templates.find_one({"name": name})
    if not t:
        raise HTTPException(status_code=404, detail="Check not found.")
    if not data.rows:
        raise HTTPException(status_code=400, detail="Keep at least one row.")
    if data.layout == "default":
        await db.templates.update_one({"_id": t["_id"]}, {"$set": {"rows": data.rows}})
    else:
        overrides = t.get("overrides", {}) or {}
        overrides[data.layout] = data.rows
        await db.templates.update_one({"_id": t["_id"]}, {"$set": {"overrides": overrides}})
    t = await db.templates.find_one({"_id": t["_id"]})
    return serialize_template(t)


@api_router.delete("/templates/{name}/layout/{store}")
async def reset_layout(name: str, store: str, user: dict = Depends(current_user)):
    if user["role"] != ROLE_COMPANY:
        raise HTTPException(status_code=403, detail="Only company accounts can edit checks.")
    t = await db.templates.find_one({"name": name})
    if not t:
        raise HTTPException(status_code=404, detail="Check not found.")
    overrides = t.get("overrides", {}) or {}
    overrides.pop(store, None)
    await db.templates.update_one({"_id": t["_id"]}, {"$set": {"overrides": overrides}})
    t = await db.templates.find_one({"_id": t["_id"]})
    return serialize_template(t)


@api_router.get("/")
async def root():
    return {"message": "Bubba Hub API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
