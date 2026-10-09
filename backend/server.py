from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Query
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import uuid
import logging
import requests
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict, Annotated
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from bson import ObjectId

LOCAL_TZ = ZoneInfo("Australia/Melbourne")
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

# Emergent Object Storage (attachments / incident photos)
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "bubba-pizza-hub"
MAX_UPLOAD_BYTES = 15 * 1024 * 1024
storage_key = None


def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    if resp.status_code == 503:
        globals()["storage_key"] = None
        key = init_storage()
        resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 503:
        globals()["storage_key"] = None
        key = init_storage()
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

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
ROLE_RANK = {ROLE_STAFF: 0, ROLE_MANAGER: 1, ROLE_FRANCHISEE: 2, ROLE_COMPANY: 3}

ANN_URGENCIES = ["Normal", "Important", "Urgent"]
ANN_CATEGORIES = ["General", "Menu", "Operations", "Safety", "People", "Marketing"]
ANN_ROLES = [ROLE_FRANCHISEE, ROLE_MANAGER, ROLE_STAFF]

TRAINING = [
    {"key": "prep", "name": "Ingredient Prep", "icon": "nutrition", "tasks": [
        {"key": "prep-mushrooms", "name": "Mushrooms", "desc": "Wash, dry and slice to 3mm. Store in a labelled, dated tub in the prep fridge."},
        {"key": "prep-ham", "name": "Smoked Ham", "desc": "Dice into even 1cm pieces. Keep chilled and use within two days of opening."},
        {"key": "prep-prawns", "name": "Garlic Marinated Prawns", "desc": "Thaw overnight, drain well, coat in the garlic marinade and portion into 80g tubs."},
        {"key": "prep-spaghetti", "name": "Spaghetti", "desc": "Par-cook in salted water, cool fast in iced water, oil lightly and portion for service."},
        {"key": "prep-tomato", "name": "Tomato Base", "desc": "Blend tomatoes with the Bubba herb mix. Check seasoning and label with batch time."},
    ]},
    {"key": "pizza", "name": "Pizza Making", "icon": "pizza", "tasks": [
        {"key": "pizza-margherita", "name": "Margherita", "desc": "Stretch the base evenly, one ladle of tomato base, mozzarella to the edge, fresh basil after the bake."},
        {"key": "pizza-tropical", "name": "Tropical", "desc": "Tomato base, mozzarella, smoked ham and well-drained pineapple. Keep the toppings balanced."},
        {"key": "pizza-supreme", "name": "Supreme", "desc": "Follow the topping order card so every slice gets a bit of everything. Watch the bake time with heavy toppings."},
    ]},
    {"key": "pasta", "name": "Pasta Making", "icon": "restaurant", "tasks": [
        {"key": "pasta-carbonara", "name": "Carbonara", "desc": "Render the bacon first, toss pasta off the heat with the egg and cheese mix so it stays silky."},
        {"key": "pasta-pollo-funghi", "name": "Pollo Funghi", "desc": "Sear chicken, add mushrooms and cream sauce, finish with parmesan. Chicken must reach 75°C."},
        {"key": "pasta-bolognese", "name": "Bolognese", "desc": "Reheat the sauce to 75°C, toss with spaghetti and finish with parmesan and parsley."},
        {"key": "pasta-primavera", "name": "Primavera", "desc": "Quick-fry the seasonal vegetables, add the light garlic sauce and toss with pasta."},
    ]},
    {"key": "fryer", "name": "Fryer", "icon": "flame", "tasks": [
        {"key": "fryer-chips", "name": "Bubba Chips", "desc": "Fry from frozen at 180°C for 3½ minutes, shake halfway, season straight out of the basket."},
        {"key": "fryer-lamb", "name": "Lamb Snack Pack", "desc": "Chips base, sliced lamb, both sauces in the zigzag pattern, then cheese on top."},
        {"key": "fryer-mac", "name": "Mac Cheese & Bacon Bites", "desc": "Fry 6 per serve for 4 minutes until golden. Rest 1 minute before boxing."},
    ]},
    {"key": "ops", "name": "Store Ops", "icon": "storefront", "tasks": [
        {"key": "ops-opening", "name": "Opening Checklist", "desc": "Ovens on, temperature checks logged, prep fridge stocked, floor and front counter ready before doors open."},
        {"key": "ops-closing", "name": "Closing Checklist", "desc": "Equipment off and cleaned, stock dated and covered, closing temperature check logged, bins out, alarm set."},
        {"key": "ops-ordering", "name": "Stock Ordering", "desc": "Count stock against par levels, place the supplier order by the cut-off, and check the delivery against the invoice."},
    ]},
]
TRAINING_TASK_KEYS = {t["key"] for c in TRAINING for t in c["tasks"]}

# Which checks are due and how often ("daily" = once per local day, "monthly" = once per calendar month)
CHECK_SCHEDULE = [
    {"type": "Daily Temperature Check", "shift": "Open", "freq": "daily"},
    {"type": "Daily Temperature Check", "shift": "Close", "freq": "daily"},
    {"type": "Cleaning Checklist", "shift": "", "freq": "daily"},
    {"type": "Cooking Temperature Checks", "shift": "", "freq": "monthly"},
]

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
    {"u": "tomwalker", "name": "Tom Walker", "first": "Tom", "role": ROLE_MANAGER, "stores": ["Boronia"]},
    {"u": "elliemoore", "name": "Ellie Moore", "first": "Ellie", "role": ROLE_MANAGER, "stores": ["Tarneit"]},
    {"u": "miachen", "name": "Mia Chen", "first": "Mia", "role": ROLE_STAFF, "stores": ["Langwarrin"]},
    {"u": "jakeryan", "name": "Jake Ryan", "first": "Jake", "role": ROLE_STAFF, "stores": ["Croydon"]},
    {"u": "lilybrown", "name": "Lily Brown", "first": "Lily", "role": ROLE_STAFF, "stores": ["Pakenham"]},
    {"u": "sanjaykumar", "name": "Sanjay Kumar", "first": "Sanjay", "role": ROLE_STAFF, "stores": ["Wantirna South"]},
]

SEED_ANNOUNCEMENTS = [
    {"title": "Fryer oil recall: check batch numbers today", "urgency": "Urgent", "category": "Safety", "tags": ["Recall"],
     "body": "Check your oil delivery against the batch numbers in the supplier email. Stop using any affected oil and log it as an incident report.",
     "audienceRoles": [], "stores": [], "compulsory": True, "attachments": [],
     "author": "Paddy Shepherd", "authorRole": ROLE_COMPANY, "hours_ago": 3},
    {"title": "Spring menu starts Monday", "urgency": "Important", "category": "Menu", "tags": ["New menu"],
     "body": "New posters ship this week. Everyone should read the allergen sheet before opening on Monday.",
     "audienceRoles": [], "stores": [], "compulsory": False, "attachments": [],
     "author": "James Scott", "authorRole": ROLE_COMPANY, "hours_ago": 26},
    {"title": "Public holiday trading hours", "urgency": "Normal", "category": "Operations", "tags": [],
     "body": "Check the rostering page for holiday hours. Franchisees will confirm staffing with their teams.",
     "audienceRoles": [ROLE_FRANCHISEE, ROLE_MANAGER], "stores": [], "compulsory": False, "attachments": [],
     "author": "Richard Harris", "authorRole": ROLE_COMPANY, "hours_ago": 70},
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

SEED_INCIDENTS = [
    {"store": "Croydon", "urgency": "High", "type": "Injury", "involved": [], "occurredAt": "Today 11:20am",
     "location": "Make line", "description": "Jake cut his hand on the dough cutter while prepping. First aid applied and bleeding stopped after 10 minutes.",
     "actions": "First aid kit used, Jake sent home for the rest of shift.", "followUp": True, "by": "Jake", "byId": None,
     "status": "pending", "rev": "", "revNote": "", "hours_ago": 2},
    {"store": "Boronia", "urgency": "Medium", "type": "Equipment issue", "involved": [], "occurredAt": "Today 9:05am",
     "location": "Kitchen", "description": "Walk-in fridge compressor making a loud grinding noise. Temperature still in range for now.",
     "actions": "Moved high-risk stock to prep fridge. Called the repair technician.", "followUp": True, "by": "Tom", "byId": None,
     "status": "pending", "rev": "", "revNote": "", "hours_ago": 4},
    {"store": "Pakenham", "urgency": "Low", "type": "Customer complaint", "involved": [], "occurredAt": "Yesterday 7:40pm",
     "location": "Front counter", "description": "Customer complained their order was missing garlic bread. Replacement given at no charge.",
     "actions": "Refunded the item and apologised.", "followUp": False, "by": "Lily", "byId": None,
     "status": "completed", "rev": "Garry Singh", "revNote": "Handled well, no further action.", "hours_ago": 26},
    {"store": "Langwarrin", "urgency": "Critical", "type": "Food safety", "involved": [], "occurredAt": "Yesterday 3:15pm",
     "location": "Dry store", "description": "Fryer oil batch matched the recalled batch numbers in the supplier email.",
     "actions": "Oil quarantined and supplier contacted for replacement.", "followUp": True, "by": "Mia", "byId": None,
     "status": "completed", "rev": "Harry Patel", "revNote": "Replacement oil arriving tomorrow. Logged with head office.", "hours_ago": 30},
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def rel_label(dt: datetime) -> str:
    """Human label like 'Today 7:05am' / 'Yesterday 3:15pm' / '12 Jun 9:40am'."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    dt = dt.astimezone(LOCAL_TZ)
    now = datetime.now(LOCAL_TZ)
    hour = dt.hour % 12 or 12
    tm = f"{hour}:{dt.minute:02d}{'am' if dt.hour < 12 else 'pm'}"
    days = (now.date() - dt.date()).days
    if days <= 0:
        return f"Today {tm}"
    if days == 1:
        return f"Yesterday {tm}"
    return f"{dt.day} {dt.strftime('%b')} {tm}"


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


class CheckModifyIn(BaseModel):
    shift: str = ""
    values: List[Any]


class AnnouncementIn(BaseModel):
    title: str
    body: str
    urgency: str = "Normal"
    category: str = "General"
    tags: List[str] = []
    audienceRoles: List[str] = []   # empty = everyone
    stores: List[str] = []          # empty = all stores the author can post to
    compulsory: bool = False
    attachments: List[str] = []     # file ids from /upload


class TrainingToggleIn(BaseModel):
    task: str
    done: bool


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


INCIDENT_URGENCIES = ["Low", "Medium", "High", "Critical"]
INCIDENT_TYPES = ["Injury", "Equipment issue", "Food safety", "Customer complaint",
                  "Property damage", "Security or theft", "Event", "Other"]


class InvolvedIn(BaseModel):
    id: str
    name: str


class IncidentIn(BaseModel):
    store: str
    urgency: str
    type: str
    involved: List[InvolvedIn] = []
    occurredAt: str = ""
    location: str = ""
    description: str
    actions: str = ""
    followUp: bool = False
    attachments: List[str] = []


class IncidentReviewIn(BaseModel):
    note: str = ""


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
    # Announcements were re-shaped (urgency/category/audience); drop the old prototype rows.
    if await db.announcements.count_documents({"urgency": {"$exists": False}}) > 0:
        await db.announcements.delete_many({"urgency": {"$exists": False}})
    if await db.templates.count_documents({}) == 0:
        await db.templates.insert_many([dict(t) for t in SEED_TEMPLATES])
    # Insert any seed users that are missing (idempotent, so new demo accounts can be added later)
    ph = None
    for s in SEED_USERS:
        if await db.users.find_one({"username": s["u"]}):
            continue
        ph = ph or hash_pw(PW)
        await db.users.insert_one({
            "username": s["u"], "password_hash": ph, "name": s["name"], "first": s["first"],
            "role": s["role"], "stores": s["stores"], "active": True,
            "pref": "", "dob": "", "gender": "", "phone": "", "email": "",
            "deleted_at": None, "created_at": datetime.now(timezone.utc),
        })
    if await db.announcements.count_documents({}) == 0:
        docs = []
        for a in SEED_ANNOUNCEMENTS:
            d = dict(a)
            hours = d.pop("hours_ago")
            author = next((u for u in SEED_USERS if u["name"] == d["author"]), None)
            au = await db.users.find_one({"username": author["u"]}) if author else None
            d["authorId"] = str(au["_id"]) if au else None
            d["readBy"] = []
            d["created_at"] = datetime.now(timezone.utc) - timedelta(hours=hours)
            docs.append(d)
        await db.announcements.insert_many(docs)
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
    if await db.incidents.count_documents({}) == 0:
        docs = []
        for inc in SEED_INCIDENTS:
            d = dict(inc)
            hours = d.pop("hours_ago")
            d["created_at"] = datetime.now(timezone.utc) - timedelta(hours=hours)
            d["reviewed_at"] = d["created_at"] + timedelta(hours=1) if d["status"] == "completed" else None
            docs.append(d)
        await db.incidents.insert_many(docs)


@app.on_event("startup")
async def on_startup():
    await db.command("ping")
    await seed()
    try:
        await run_in_threadpool(init_storage)
    except Exception as e:  # storage is optional at boot; uploads will retry init
        logger.warning("Object storage init failed: %s", e)
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


# ---------------------------------------------------------------------------
# Files (Emergent Object Storage)
# ---------------------------------------------------------------------------
def serialize_file(f: dict) -> dict:
    return {"id": str(f["_id"]), "name": f["name"], "contentType": f["contentType"], "size": f["size"],
            "url": f"/api/files/{str(f['_id'])}", "isImage": f["contentType"].startswith("image/")}


@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(current_user)):
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="That file is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Files must be under 15MB.")
    name = file.filename or "file"
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else "bin"
    content_type = file.content_type or "application/octet-stream"
    path = f"{APP_NAME}/uploads/{str(user['_id'])}/{uuid.uuid4().hex}.{ext}"
    try:
        result = await run_in_threadpool(put_object, path, data, content_type)
    except requests.HTTPError as e:
        code = e.response.status_code if e.response is not None else 500
        if code == 402:
            raise HTTPException(status_code=402, detail="File storage is out of credits. Try again later.")
        raise HTTPException(status_code=502, detail="Could not store the file. Try again.")
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Could not reach file storage. Try again.")
    doc = {"owner_id": str(user["_id"]), "storage_path": result["path"], "name": name,
           "contentType": content_type, "size": len(data), "created_at": datetime.now(timezone.utc)}
    res = await db.files.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize_file(doc)


@api_router.get("/files/{file_id}")
async def download_file(file_id: str, token: Optional[str] = Query(default=None),
                        credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer)] = None):
    # Web <img> tags cannot send headers, so a bearer token in the query string is accepted too.
    raw = credentials.credentials if credentials else token
    if not raw:
        raise HTTPException(status_code=401, detail="Sign in to view this file.")
    try:
        payload = jwt.decode(raw, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except InvalidTokenError:
        raise HTTPException(status_code=401, detail="Sign in to view this file.")
    if not ObjectId.is_valid(file_id):
        raise HTTPException(status_code=404, detail="File not found.")
    f = await db.files.find_one({"_id": ObjectId(file_id)})
    if not f or not payload.get("sub"):
        raise HTTPException(status_code=404, detail="File not found.")
    try:
        content, ctype = await run_in_threadpool(get_object, f["storage_path"])
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Could not load the file.")
    return Response(content=content, media_type=ctype,
                    headers={"Cache-Control": "private, max-age=86400",
                             "Content-Disposition": f'inline; filename="{f["name"]}"'})


async def files_by_ids(ids: List[str]) -> List[dict]:
    oids = [ObjectId(i) for i in ids if ObjectId.is_valid(i)]
    if not oids:
        return []
    docs = await db.files.find({"_id": {"$in": oids}}).to_list(100)
    by_id = {str(d["_id"]): d for d in docs}
    return [serialize_file(by_id[i]) for i in ids if i in by_id]


# ---------------------------------------------------------------------------
# Announcements
# ---------------------------------------------------------------------------
def ann_labels(a: dict) -> List[str]:
    labels = []
    if a.get("compulsory"):
        labels.append("Compulsory")
    roles = a.get("audienceRoles") or []
    if roles:
        if roles == [ROLE_FRANCHISEE]:
            labels.append("Franchisee Only")
        elif roles == [ROLE_MANAGER]:
            labels.append("Managers Only")
        elif roles == [ROLE_STAFF]:
            labels.append("Staff Only")
        else:
            labels.append(" & ".join(r.replace(ROLE_FRANCHISEE, "Franchisees").replace(ROLE_MANAGER, "Managers") for r in roles))
    stores = a.get("stores") or []
    if stores:
        labels.append(stores[0] if len(stores) == 1 else f"{len(stores)} stores")
    labels.extend(a.get("tags") or [])
    return labels


def can_edit_ann(user: dict, a: dict) -> bool:
    if a.get("authorId") == str(user["_id"]):
        return True
    return ROLE_RANK[user["role"]] > ROLE_RANK.get(a.get("authorRole", ROLE_COMPANY), 3)


async def serialize_ann(a: dict, user: dict) -> dict:
    return {
        "id": str(a["_id"]), "title": a["title"], "body": a["body"], "urgency": a.get("urgency", "Normal"),
        "category": a.get("category", "General"), "tags": a.get("tags", []),
        "audienceRoles": a.get("audienceRoles", []), "stores": a.get("stores", []),
        "compulsory": bool(a.get("compulsory", False)),
        "attachments": await files_by_ids(a.get("attachments", [])),
        "author": a.get("author", ""), "authorRole": a.get("authorRole", ""),
        "dateLabel": rel_label(a["created_at"]), "labels": ann_labels(a),
        "read": str(user["_id"]) in (a.get("readBy") or []), "canEdit": can_edit_ann(user, a),
        "readCount": len(a.get("readBy") or []),
    }


def ann_visible(user: dict, a: dict) -> bool:
    if user["role"] == ROLE_COMPANY or a.get("authorId") == str(user["_id"]):
        return True
    roles = a.get("audienceRoles") or []
    if roles and user["role"] not in roles:
        return False
    stores = a.get("stores") or []
    if stores and not any(s in user.get("stores", []) for s in stores):
        return False
    return True


@api_router.get("/announcements/options")
async def announcement_options(user: dict = Depends(current_user)):
    return {"urgencies": ANN_URGENCIES, "categories": ANN_CATEGORIES, "roles": ANN_ROLES}


@api_router.get("/announcements")
async def get_announcements(user: dict = Depends(current_user)):
    anns = await db.announcements.find().sort("created_at", -1).to_list(1000)
    return [await serialize_ann(a, user) for a in anns if ann_visible(user, a)]


def validate_ann(data: AnnouncementIn, user: dict) -> dict:
    title = " ".join(data.title.split())
    body = data.body.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Give the announcement a title.")
    if not body:
        raise HTTPException(status_code=400, detail="Write the announcement message.")
    if data.urgency not in ANN_URGENCIES:
        raise HTTPException(status_code=400, detail="Choose an urgency.")
    if data.category not in ANN_CATEGORIES:
        raise HTTPException(status_code=400, detail="Choose a category.")
    if any(r not in ANN_ROLES for r in data.audienceRoles):
        raise HTTPException(status_code=400, detail="Choose who can read this from the list.")
    stores = data.stores
    if user["role"] != ROLE_COMPANY:
        mine = user.get("stores", [])
        stores = stores or mine
        if any(s not in mine for s in stores):
            raise HTTPException(status_code=403, detail="You can only post to your own stores.")
    else:
        if any(s not in ALL_STORES for s in stores):
            raise HTTPException(status_code=400, detail="Unknown store.")
    tags = [" ".join(t.split()) for t in data.tags if t.strip()][:8]
    return {"title": title, "body": body, "urgency": data.urgency, "category": data.category, "tags": tags,
            "audienceRoles": data.audienceRoles, "stores": stores, "compulsory": data.compulsory,
            "attachments": [a for a in data.attachments if ObjectId.is_valid(a)][:6]}


@api_router.post("/announcements")
async def create_announcement(data: AnnouncementIn, user: dict = Depends(current_user)):
    if user["role"] == ROLE_STAFF:
        raise HTTPException(status_code=403, detail="Staff cannot post announcements.")
    doc = validate_ann(data, user)
    doc.update({"author": user["name"], "authorId": str(user["_id"]), "authorRole": user["role"],
                "readBy": [str(user["_id"])], "created_at": datetime.now(timezone.utc)})
    res = await db.announcements.insert_one(doc)
    doc["_id"] = res.inserted_id
    return await serialize_ann(doc, user)


async def load_ann_for_edit(ann_id: str, user: dict) -> dict:
    if user["role"] == ROLE_STAFF:
        raise HTTPException(status_code=403, detail="Staff cannot edit announcements.")
    if not ObjectId.is_valid(ann_id):
        raise HTTPException(status_code=404, detail="Announcement not found.")
    a = await db.announcements.find_one({"_id": ObjectId(ann_id)})
    if not a:
        raise HTTPException(status_code=404, detail="Announcement not found.")
    if not can_edit_ann(user, a):
        raise HTTPException(status_code=403, detail="You can only edit your own announcements or ones from accounts below yours.")
    return a


@api_router.patch("/announcements/{ann_id}")
async def update_announcement(ann_id: str, data: AnnouncementIn, user: dict = Depends(current_user)):
    a = await load_ann_for_edit(ann_id, user)
    patch = validate_ann(data, user)
    await db.announcements.update_one({"_id": a["_id"]}, {"$set": patch})
    a.update(patch)
    return await serialize_ann(a, user)


@api_router.delete("/announcements/{ann_id}")
async def delete_announcement(ann_id: str, user: dict = Depends(current_user)):
    a = await load_ann_for_edit(ann_id, user)
    await db.announcements.delete_one({"_id": a["_id"]})
    return {"ok": True}


@api_router.post("/announcements/{ann_id}/read")
async def read_announcement(ann_id: str, user: dict = Depends(current_user)):
    if not ObjectId.is_valid(ann_id):
        raise HTTPException(status_code=404, detail="Announcement not found.")
    await db.announcements.update_one({"_id": ObjectId(ann_id)}, {"$addToSet": {"readBy": str(user["_id"])}})
    return {"ok": True}


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
    date_label = rel_label(c["created_at"]) if c.get("dateLabel") == "Just now" else c["dateLabel"]
    return {
        "id": str(c["_id"]), "store": c["store"], "type": c["type"], "shift": c.get("shift", ""),
        "by": c["by"], "byId": c.get("byId"), "dateLabel": date_label, "done": c["done"], "total": c["total"],
        "bad": c["bad"], "status": c["status"], "rev": c.get("rev", ""), "k": c.get("k", "t"),
        "entries": c.get("entries", []), "modifiedBy": c.get("modifiedBy", ""),
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


def compute_entries(tmpl: dict, rows: list, values: list):
    total = len(rows)
    bad = 0
    entries = []
    if tmpl["k"] == "l":
        done = sum(1 for v in values if v)
        for i, row in enumerate(rows):
            entries.append({"name": row["name"], "done": bool(values[i]) if i < len(values) else False})
    else:
        for i, row in enumerate(rows):
            try:
                v = float(values[i])
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
    return done, total, bad, entries


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
    done, total, bad, entries = compute_entries(tmpl, rows, data.values)
    doc = {
        "store": data.store, "type": data.type, "shift": data.shift or "",
        "by": user["name"], "byId": str(user["_id"]), "dateLabel": "Just now", "done": done, "total": total,
        "bad": bad, "status": "awaiting", "rev": "", "k": tmpl["k"], "entries": entries,
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.checks.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize_check(doc)


async def load_check_for_edit(check_id: str, user: dict) -> dict:
    if not ObjectId.is_valid(check_id):
        raise HTTPException(status_code=404, detail="Check not found.")
    c = await db.checks.find_one({"_id": ObjectId(check_id)})
    if not c:
        raise HTTPException(status_code=404, detail="Check not found.")
    if c["store"] not in user_stores(user):
        raise HTTPException(status_code=403, detail="That check is not for your store.")
    is_author = c.get("byId") == str(user["_id"])
    if user["role"] == ROLE_STAFF and not (is_author and c["status"] == "awaiting"):
        raise HTTPException(status_code=403, detail="You can only change your own checks while they are awaiting review.")
    return c


@api_router.patch("/checks/{check_id}")
async def modify_check(check_id: str, data: CheckModifyIn, user: dict = Depends(current_user)):
    c = await load_check_for_edit(check_id, user)
    tmap = await template_map()
    tmpl = tmap.get(c["type"])
    if not tmpl:
        raise HTTPException(status_code=404, detail="Unknown check type.")
    rows = rows_for(tmpl, c["store"])
    done, total, bad, entries = compute_entries(tmpl, rows, data.values)
    patch = {"shift": data.shift if tmpl.get("shift") else "", "done": done, "total": total, "bad": bad,
             "entries": entries, "status": "awaiting", "rev": "",
             "modifiedBy": user["name"], "modified_at": datetime.now(timezone.utc)}
    await db.checks.update_one({"_id": c["_id"]}, {"$set": patch})
    c.update(patch)
    return serialize_check(c)


@api_router.delete("/checks/{check_id}")
async def delete_check(check_id: str, user: dict = Depends(current_user)):
    c = await load_check_for_edit(check_id, user)
    await db.checks.delete_one({"_id": c["_id"]})
    return {"ok": True}


@api_router.get("/checks/due")
async def checks_due(user: dict = Depends(current_user)):
    """What still needs doing today (or this month) for each of the user's stores."""
    now_local = datetime.now(LOCAL_TZ)
    day_start = now_local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    month_start = now_local.replace(day=1, hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    stores = user_stores(user)
    recent = await db.checks.find({"store": {"$in": stores}, "created_at": {"$gte": month_start}}).to_list(5000)
    out = []
    for store in stores:
        items = []
        for s in CHECK_SCHEDULE:
            since = day_start if s["freq"] == "daily" else month_start
            done = any(
                c["store"] == store and c["type"] == s["type"] and (c.get("shift", "") == s["shift"])
                and c["created_at"].replace(tzinfo=timezone.utc) >= since
                for c in recent
            )
            label = s["type"] + (f" ({s['shift']})" if s["shift"] else "")
            items.append({"type": s["type"], "shift": s["shift"], "freq": s["freq"], "label": label, "done": done})
        out.append({"store": store, "pending": sum(1 for i in items if not i["done"]), "items": items})
    return out


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
# Incident reports
# ---------------------------------------------------------------------------
def user_stores(user: dict) -> List[str]:
    return ALL_STORES if user["role"] == ROLE_COMPANY else user.get("stores", [])


async def serialize_incident(i: dict) -> dict:
    return {
        "attachments": await files_by_ids(i.get("attachments", [])),
        "id": str(i["_id"]), "store": i["store"], "urgency": i["urgency"], "type": i["type"],
        "involved": i.get("involved", []), "occurredAt": i.get("occurredAt", ""),
        "location": i.get("location", ""), "description": i["description"],
        "actions": i.get("actions", ""), "followUp": bool(i.get("followUp", False)),
        "by": i["by"], "byId": i.get("byId"), "dateLabel": rel_label(i["created_at"]),
        "status": i["status"], "rev": i.get("rev", ""), "revNote": i.get("revNote", ""),
        "reviewedLabel": rel_label(i["reviewed_at"]) if i.get("reviewed_at") else "",
    }


@api_router.get("/stores/{store}/people")
async def store_people(store: str, user: dict = Depends(current_user)):
    """People registered to a store (for the 'who was involved' picker)."""
    if store not in user_stores(user):
        raise HTTPException(status_code=403, detail="That store is not yours.")
    people = await db.users.find({"deleted_at": None, "active": True, "stores": store,
                                  "role": {"$ne": ROLE_COMPANY}}).sort("name", 1).to_list(1000)
    return [{"id": str(p["_id"]), "name": p["name"], "role": p["role"]} for p in people]


@api_router.get("/incidents/options")
async def incident_options(user: dict = Depends(current_user)):
    return {"urgencies": INCIDENT_URGENCIES, "types": INCIDENT_TYPES}


@api_router.get("/incidents")
async def get_incidents(user: dict = Depends(current_user)):
    query: Dict[str, Any] = {"store": {"$in": user_stores(user)}}
    if user["role"] == ROLE_STAFF:
        query["byId"] = str(user["_id"])
    docs = await db.incidents.find(query).sort("created_at", -1).to_list(1000)
    return [await serialize_incident(d) for d in docs]


@api_router.post("/incidents")
async def create_incident(data: IncidentIn, user: dict = Depends(current_user)):
    if data.store not in user_stores(user):
        raise HTTPException(status_code=403, detail="You cannot report an incident for that store.")
    if data.urgency not in INCIDENT_URGENCIES:
        raise HTTPException(status_code=400, detail="Choose an urgency level.")
    if data.type not in INCIDENT_TYPES:
        raise HTTPException(status_code=400, detail="Choose an incident type.")
    description = data.description.strip()
    if len(description) < 10:
        raise HTTPException(status_code=400, detail="Describe what happened in at least 10 characters.")
    doc = {
        "store": data.store, "urgency": data.urgency, "type": data.type,
        "involved": [{"id": p.id, "name": p.name} for p in data.involved],
        "occurredAt": data.occurredAt.strip(), "location": data.location.strip(),
        "description": description, "actions": data.actions.strip(), "followUp": data.followUp,
        "attachments": [a for a in data.attachments if ObjectId.is_valid(a)][:6],
        "by": user["name"], "byId": str(user["_id"]), "status": "pending", "rev": "", "revNote": "",
        "created_at": datetime.now(timezone.utc), "reviewed_at": None,
    }
    res = await db.incidents.insert_one(doc)
    doc["_id"] = res.inserted_id
    return await serialize_incident(doc)


@api_router.post("/incidents/{incident_id}/review")
async def review_incident(incident_id: str, data: IncidentReviewIn, user: dict = Depends(current_user)):
    if user["role"] == ROLE_STAFF:
        raise HTTPException(status_code=403, detail="You cannot review incident reports.")
    if not ObjectId.is_valid(incident_id):
        raise HTTPException(status_code=404, detail="Report not found.")
    inc = await db.incidents.find_one({"_id": ObjectId(incident_id)})
    if not inc:
        raise HTTPException(status_code=404, detail="Report not found.")
    if inc["store"] not in user_stores(user):
        raise HTTPException(status_code=403, detail="That report is not for your store.")
    if inc["status"] == "completed":
        raise HTTPException(status_code=400, detail="This report has already been completed.")
    patch = {"status": "completed", "rev": user["name"], "revNote": data.note.strip(),
             "reviewed_at": datetime.now(timezone.utc)}
    await db.incidents.update_one({"_id": inc["_id"]}, {"$set": patch})
    inc.update(patch)
    return await serialize_incident(inc)


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------
def can_train(viewer: dict, trainee: dict) -> bool:
    """Can `viewer` tick off training for `trainee`? Must outrank them and share a store."""
    if ROLE_RANK[viewer["role"]] <= ROLE_RANK[trainee["role"]]:
        return False
    if viewer["role"] == ROLE_COMPANY:
        return True
    return any(s in viewer.get("stores", []) for s in trainee.get("stores", []))


@api_router.get("/training/catalogue")
async def training_catalogue(user: dict = Depends(current_user)):
    return TRAINING


@api_router.get("/training/people")
async def training_people(user: dict = Depends(current_user)):
    if user["role"] == ROLE_STAFF:
        raise HTTPException(status_code=403, detail="Staff cannot view other people's training.")
    people = await db.users.find({"deleted_at": None, "active": True}).sort("name", 1).to_list(1000)
    rows = [p for p in people if can_train(user, p)]
    ids = [str(p["_id"]) for p in rows]
    progress = await db.training_progress.find({"userId": {"$in": ids}, "done": True}).to_list(100000)
    counts: Dict[str, int] = {}
    for pr in progress:
        counts[pr["userId"]] = counts.get(pr["userId"], 0) + 1
    return [{"id": str(p["_id"]), "name": p["name"], "role": p["role"], "stores": p.get("stores", []),
             "done": counts.get(str(p["_id"]), 0), "total": len(TRAINING_TASK_KEYS)} for p in rows]


@api_router.get("/training/{user_id}")
async def training_progress(user_id: str, user: dict = Depends(current_user)):
    if user_id == "me":
        user_id = str(user["_id"])
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=404, detail="Person not found.")
    trainee = await db.users.find_one({"_id": ObjectId(user_id), "deleted_at": None})
    if not trainee:
        raise HTTPException(status_code=404, detail="Person not found.")
    is_me = trainee["_id"] == user["_id"]
    if not is_me and not can_train(user, trainee):
        raise HTTPException(status_code=403, detail="You cannot view that person's training.")
    rows = await db.training_progress.find({"userId": user_id, "done": True}).to_list(1000)
    return {
        "user": {"id": user_id, "name": trainee["name"], "role": trainee["role"]},
        "canEdit": not is_me and can_train(user, trainee),
        "done": {r["task"]: {"by": r.get("by", ""), "dateLabel": rel_label(r["at"]) if r.get("at") else ""} for r in rows},
    }


@api_router.post("/training/{user_id}/toggle")
async def training_toggle(user_id: str, data: TrainingToggleIn, user: dict = Depends(current_user)):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=404, detail="Person not found.")
    trainee = await db.users.find_one({"_id": ObjectId(user_id), "deleted_at": None})
    if not trainee:
        raise HTTPException(status_code=404, detail="Person not found.")
    if trainee["_id"] == user["_id"] or not can_train(user, trainee):
        raise HTTPException(status_code=403, detail="Only a manager, franchisee or company account can sign off training.")
    if data.task not in TRAINING_TASK_KEYS:
        raise HTTPException(status_code=404, detail="Unknown training task.")
    await db.training_progress.update_one(
        {"userId": user_id, "task": data.task},
        {"$set": {"done": data.done, "by": user["name"], "at": datetime.now(timezone.utc)}}, upsert=True)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Account management
# ---------------------------------------------------------------------------
async def unique_username(first: str, last: str, exclude_id: Optional[ObjectId] = None) -> str:
    base = re.sub(r"[^a-z0-9]", "", (first + last).lower()) or "user"
    candidate = base
    n = 1
    while True:
        q: Dict[str, Any] = {"username": candidate, "deleted_at": None}
        if exclude_id is not None:
            q["_id"] = {"$ne": exclude_id}
        if not await db.users.find_one(q):
            return candidate
        n += 1
        candidate = f"{base}{n}"


@api_router.get("/accounts/username-preview")
async def username_preview(first: str = "", last: str = "", user: dict = Depends(current_user)):
    require_manage(user)
    first = " ".join(first.split())
    last = " ".join(last.split())
    if not first or not last:
        return {"username": ""}
    return {"username": await unique_username(first, last)}

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
    uname = await unique_username(first, last)
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
