"""
Phonic AI Interview Agent - Backend API Tests
Tests: auth, interviews, jd, settings endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# ── Auth Tests ──────────────────────────────────────────────────────────────────

class TestAuth:
    def test_login_success(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@phonic.ai", "password": "phonic123"
        })
        assert r.status_code == 200
        data = r.json()
        assert "token" in data or "access_token" in data
        print("Login success:", list(data.keys()))

    def test_login_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@test.com", "password": "bad"
        })
        assert r.status_code in [401, 400, 403]

    def test_health(self):
        r = requests.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


# ── Fixtures ────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@phonic.ai", "password": "phonic123"
    })
    data = r.json()
    token = data.get("token") or data.get("access_token")
    if not token:
        pytest.skip("Could not get auth token")
    return token

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


# ── Interviews Tests ─────────────────────────────────────────────────────────────

class TestInterviews:
    def test_get_stats(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/interviews/stats", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        print("Stats:", data)

    def test_get_interviews_list(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/interviews", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "sessions" in data
        assert "total" in data

    def test_create_interview(self, auth_headers):
        payload = {
            "candidate_name": "TEST_John Doe",
            "candidate_email": "test_john@example.com",
            "candidate_phone": "+1234567890",
            "job_title": "Software Engineer",
            "accent": "us",
            "llm_provider": "ollama",
            "mode": "browser"
        }
        r = requests.post(f"{BASE_URL}/api/interviews", json=payload, headers=auth_headers)
        assert r.status_code in [200, 201]
        data = r.json()
        assert "session_id" in data
        print("Created interview:", data.get("session_id"))

    def test_create_and_get_interview(self, auth_headers):
        payload = {
            "candidate_name": "TEST_Jane Smith",
            "candidate_email": "test_jane@example.com",
            "candidate_phone": "+9876543210",
            "job_title": "QA Engineer",
            "accent": "us",
            "llm_provider": "ollama",
            "mode": "browser"
        }
        r = requests.post(f"{BASE_URL}/api/interviews", json=payload, headers=auth_headers)
        assert r.status_code in [200, 201]
        data = r.json()
        session_id = data.get("session_id")
        assert session_id

        # GET the created session
        r2 = requests.get(f"{BASE_URL}/api/interviews/{session_id}", headers=auth_headers)
        assert r2.status_code == 200
        detail = r2.json()
        assert detail.get("session_id") == session_id


# ── Settings Tests ──────────────────────────────────────────────────────────────

class TestSettings:
    def test_get_settings(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        print("Settings keys:", list(data.keys()))

    def test_patch_settings(self, auth_headers):
        r = requests.patch(f"{BASE_URL}/api/settings", json={"llm_provider": "ollama"}, headers=auth_headers)
        assert r.status_code in [200, 204]

    def test_test_llm(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/settings/test-llm", headers=auth_headers)
        # Ollama may not be running - both success and error are acceptable
        assert r.status_code in [200, 400, 500, 503]
        print("test-llm response:", r.status_code, r.text[:200])


# ── JD Tests ────────────────────────────────────────────────────────────────────

class TestJD:
    def test_get_jd_list(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/jd", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) or isinstance(data, dict)

    def test_parse_jd(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/jd/parse", json={
            "text": "Software Engineer with 3+ years Python experience. Must know FastAPI and MongoDB."
        }, headers=auth_headers)
        assert r.status_code in [200, 201]
        print("Parsed JD:", r.json())

    def test_save_jd(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/jd/save", json={
            "title": "TEST_Software Engineer",
            "raw_text": "TEST_JD for testing. Python FastAPI MongoDB required.",
        }, headers=auth_headers)
        assert r.status_code in [200, 201]
        data = r.json()
        print("Saved JD:", data)
