"""Critical certificate/admin/intern API regression tests for ZoomIntern."""

import base64
import os
from pathlib import Path

import pytest
import requests


def _load_frontend_env() -> None:
    env_path = Path("/app/frontend/.env")
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        if not line.strip() or line.strip().startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


_load_frontend_env()
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")


@pytest.fixture(scope="session")
def api_client():
    assert BASE_URL, "REACT_APP_BACKEND_URL is missing"
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def admin_auth_header(api_client):
    """Admin auth token fixture for protected API endpoints."""
    response = api_client.post(
        f"{BASE_URL}/api/admin/login",
        json={
            "email": "abhishek@zoomintern.com",
            "password": "ZoomAdmin@2026",
        },
        timeout=30,
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["email"] == "abhishek@zoomintern.com"
    assert isinstance(payload.get("token"), str) and payload["token"]
    return {"Authorization": f"Bearer {payload['token']}"}


@pytest.fixture(scope="session")
def issued_certificate_with_phone(api_client, admin_auth_header):
    """Issue a cert with email + E.164 phone so WhatsApp and intern flows can be validated."""
    body = {
        "intern_name": "TEST_ZoomIntern Delivery",
        "intern_email": "delivered@resend.dev",
        "intern_phone": "+14155552671",
        "area": "TEST_AI Program",
        "start_date": "2026-01-01",
        "end_date": "2026-02-15",
        "issue_date": "2026-02-16",
        "send_email": True,
    }
    response = api_client.post(
        f"{BASE_URL}/api/admin/certificates",
        json=body,
        headers=admin_auth_header,
        timeout=60,
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["intern_email"] == "delivered@resend.dev"
    assert data["intern_phone"] == "+14155552671"
    assert data["email_sent"] is True
    assert data["certificate_id"].startswith("ZI-")
    yield data

    # Cleanup test certificate to keep dataset tidy
    api_client.delete(
        f"{BASE_URL}/api/admin/certificates/{data['certificate_id']}",
        headers=admin_auth_header,
        timeout=30,
    )


def test_admin_login_success(api_client):
    response = api_client.post(
        f"{BASE_URL}/api/admin/login",
        json={"email": "abhishek@zoomintern.com", "password": "ZoomAdmin@2026"},
        timeout=30,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "abhishek@zoomintern.com"
    assert isinstance(data["token"], str) and len(data["token"]) > 20


def test_issue_certificate_sets_email_sent_true(issued_certificate_with_phone):
    assert issued_certificate_with_phone["email_sent"] is True


def test_signature_metadata_endpoint(api_client, admin_auth_header):
    response = api_client.get(
        f"{BASE_URL}/api/admin/signature",
        headers=admin_auth_header,
        timeout=30,
    )
    assert response.status_code == 200
    data = response.json()
    assert "uploaded" in data
    assert isinstance(data["uploaded"], bool)


def test_signature_upload_png(api_client, admin_auth_header):
    png_bytes = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9XJ4QAAAAASUVORK5CYII="
    )
    response = requests.post(
        f"{BASE_URL}/api/admin/signature",
        headers={"Authorization": admin_auth_header["Authorization"]},
        files={"file": ("test-signature.png", png_bytes, "image/png")},
        timeout=90,
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["uploaded"] is True
    assert data["filename"] == "test-signature.png"


def test_certificate_pdf_download_content_type(api_client, issued_certificate_with_phone):
    cert_id = issued_certificate_with_phone["certificate_id"]
    response = api_client.get(f"{BASE_URL}/api/certificates/{cert_id}/pdf", timeout=60)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/pdf")
    assert len(response.content) > 500


def test_whatsapp_share_returns_wa_me_link(api_client, admin_auth_header, issued_certificate_with_phone):
    cert_id = issued_certificate_with_phone["certificate_id"]
    response = api_client.post(
        f"{BASE_URL}/api/admin/certificates/{cert_id}/whatsapp",
        headers=admin_auth_header,
        timeout=30,
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["url"].startswith("https://wa.me/")
    assert "text=" in data["url"]


def test_intern_access_request_generic_success(api_client, issued_certificate_with_phone):
    response = api_client.post(
        f"{BASE_URL}/api/intern/access/request",
        json={"email": issued_certificate_with_phone["intern_email"]},
        timeout=30,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "If a matching certificate exists, an access code has been sent."


def test_intern_access_verify_rejects_invalid_code(api_client, issued_certificate_with_phone):
    response = api_client.post(
        f"{BASE_URL}/api/intern/access/verify",
        json={"email": issued_certificate_with_phone["intern_email"], "code": "000000"},
        timeout=30,
    )
    assert response.status_code == 401
    data = response.json()
    assert "invalid or expired" in data["detail"].lower()


def test_public_certificate_verification_valid(api_client, issued_certificate_with_phone):
    cert_id = issued_certificate_with_phone["certificate_id"]
    response = api_client.get(f"{BASE_URL}/api/certificates/verify/{cert_id}", timeout=30)
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True
    assert data["certificate_id"] == cert_id
    assert data["intern_name"] == "TEST_ZoomIntern Delivery"
