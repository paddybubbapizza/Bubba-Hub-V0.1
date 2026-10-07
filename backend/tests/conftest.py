import os
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get("EXPO_PUBLIC_BACKEND_URL") else None
if not BASE_URL:
    # fallback to frontend env (public URL)
    fe = Path(__file__).resolve().parents[2] / "frontend" / ".env"
    for line in fe.read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
            break


@pytest.fixture(scope="session")
def base_url():
    assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL is not set"
    return BASE_URL


def _login(base_url, username, password="password"):
    r = requests.post(f"{base_url}/api/auth/login", json={"username": username, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed for {username}: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def company_auth(base_url):
    data = _login(base_url, "paddyshepherd")
    return {"token": data["access_token"], "user": data["user"],
            "headers": {"Authorization": f"Bearer {data['access_token']}"}}


@pytest.fixture(scope="session")
def franchisee_auth(base_url):
    data = _login(base_url, "harrypatel")
    return {"token": data["access_token"], "user": data["user"],
            "headers": {"Authorization": f"Bearer {data['access_token']}"}}


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s
