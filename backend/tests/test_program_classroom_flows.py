"""Program classroom + submission API regression tests for internship class workflows."""

import os
import uuid
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
    """Shared HTTP client."""
    assert BASE_URL, "REACT_APP_BACKEND_URL is missing"
    client = requests.Session()
    client.headers.update({"Content-Type": "application/json"})
    return client


@pytest.fixture(scope="session")
def admin_auth_header(api_client):
    """Admin auth token for protected APIs."""
    response = api_client.post(
        f"{BASE_URL}/api/admin/login",
        json={"email": "abhishek@zoomintern.com", "password": "ZoomAdmin@2026"},
        timeout=30,
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["email"] == "abhishek@zoomintern.com"
    return {"Authorization": f"Bearer {payload['token']}"}


@pytest.fixture(scope="session")
def created_program(api_client, admin_auth_header):
    """Create one dedicated test program and delete it after suite."""
    suffix = uuid.uuid4().hex[:8]
    body = {
        "title": f"TEST_Classroom Program {suffix}",
        "area": "Programming",
        "location": "Remote",
        "duration_weeks": 4,
        "tags": ["TEST", "classroom"],
        "description": "TEST program for class, quiz, and project submission flows",
        "active": True,
        "final_project_enabled": True,
        "final_project_instructions": "Upload one final PDF",
    }
    response = api_client.post(
        f"{BASE_URL}/api/admin/programs",
        json=body,
        headers=admin_auth_header,
        timeout=30,
    )
    assert response.status_code == 200, response.text
    program = response.json()
    assert program["title"] == body["title"]

    yield program

    api_client.delete(
        f"{BASE_URL}/api/admin/programs/{program['id']}",
        headers=admin_auth_header,
        timeout=30,
    )


@pytest.fixture(scope="session")
def created_lesson(api_client, admin_auth_header, created_program):
    """Create one mixed quiz lesson requiring class PDF project."""
    body = {
        "title": "TEST Lesson 1",
        "description": "Lesson for quiz and project validation",
        "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "position": 1,
        "requires_project": True,
        "project_instructions": "Upload class project PDF",
        "quiz_pass_score": 75,
        "quiz_questions": [
            {
                "prompt": "What is 2 + 2?",
                "question_type": "mcq",
                "options": ["3", "4", "5"],
                "correct_answer": "4",
            },
            {
                "prompt": "Explain your approach in brief.",
                "question_type": "descriptive",
                "options": [],
                "correct_answer": None,
            },
        ],
    }
    response = api_client.post(
        f"{BASE_URL}/api/admin/programs/{created_program['id']}/lessons",
        json=body,
        headers=admin_auth_header,
        timeout=30,
    )
    assert response.status_code == 200, response.text
    lesson = response.json()
    assert lesson["requires_project"] is True
    assert lesson["quiz_pass_score"] == 75
    return lesson


@pytest.fixture(scope="session")
def applied_email(api_client, created_program):
    """Create one application linked to the test program."""
    email = f"test_apply_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "program_id": created_program["id"],
        "full_name": "TEST Applicant",
        "email": email,
        "phone": "+14155552671",
        "university": "TEST University",
        "motivation": "TEST motivation",
    }
    response = api_client.post(f"{BASE_URL}/api/applications", json=payload, timeout=30)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["program_id"] == created_program["id"]
    assert data["email"] == email
    return email


def _pdf_bytes() -> bytes:
    return b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF"


# --- Admin/auth hardening checks ---
def test_admin_login_sets_cookie_and_token(api_client):
    response = api_client.post(
        f"{BASE_URL}/api/admin/login",
        json={"email": "abhishek@zoomintern.com", "password": "ZoomAdmin@2026"},
        timeout=30,
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data.get("token"), str) and len(data["token"]) > 20
    set_cookie = response.headers.get("set-cookie", "")
    assert "zi_admin_access=" in set_cookie
    assert "HttpOnly" in set_cookie


def test_admin_login_bruteforce_lockout_after_five_failures(api_client):
    target_email = f"lockout_{uuid.uuid4().hex[:8]}@example.com"
    for _ in range(5):
        bad = api_client.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": target_email, "password": "wrong-password"},
            timeout=30,
        )
        assert bad.status_code == 401

    sixth = api_client.post(
        f"{BASE_URL}/api/admin/login",
        json={"email": target_email, "password": "wrong-password"},
        timeout=30,
    )
    assert sixth.status_code == 429


def test_cors_preflight_is_handled_by_managed_preview_edge(api_client):
    origin = BASE_URL
    response = api_client.options(
        f"{BASE_URL}/api/admin/login",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
        },
        timeout=30,
    )
    assert response.status_code in [200, 204]
    assert response.headers.get("access-control-allow-origin") in {"*", origin}


# --- Classroom builder and public classroom checks ---
def test_admin_classroom_builder_lessons_api_loads(api_client, admin_auth_header, created_program, created_lesson):
    response = api_client.get(
        f"{BASE_URL}/api/admin/programs/{created_program['id']}/lessons",
        headers=admin_auth_header,
        timeout=30,
    )
    assert response.status_code == 200
    lessons = response.json()
    assert any(lesson["id"] == created_lesson["id"] for lesson in lessons)


def test_public_classroom_hides_correct_answers(api_client, created_program):
    response = api_client.get(f"{BASE_URL}/api/programs/{created_program['id']}/classroom", timeout=30)
    assert response.status_code == 200
    data = response.json()
    lesson = data["lessons"][0]
    assert lesson["quiz_questions"]
    assert all("correct_answer" not in question for question in lesson["quiz_questions"])


def test_quiz_rejects_email_without_application(api_client, created_program, created_lesson):
    payload = {
        "intern_email": f"not_applied_{uuid.uuid4().hex[:8]}@example.com",
        "answers": [
            {"question_id": created_lesson["quiz_questions"][0]["id"], "answer": "4"},
            {"question_id": created_lesson["quiz_questions"][1]["id"], "answer": "desc"},
        ],
    }
    response = api_client.post(
        f"{BASE_URL}/api/programs/{created_program['id']}/lessons/{created_lesson['id']}/quiz",
        json=payload,
        timeout=30,
    )
    assert response.status_code == 403
    assert "Apply to this internship" in response.json()["detail"]


def test_quiz_submission_scores_mcq_and_flags_descriptive_pending(api_client, created_program, created_lesson, applied_email):
    payload = {
        "intern_email": applied_email,
        "answers": [
            {"question_id": created_lesson["quiz_questions"][0]["id"], "answer": "4"},
            {"question_id": created_lesson["quiz_questions"][1]["id"], "answer": "Detailed descriptive answer"},
        ],
    }
    response = api_client.post(
        f"{BASE_URL}/api/programs/{created_program['id']}/lessons/{created_lesson['id']}/quiz",
        json=payload,
        timeout=30,
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["score"] == 100
    assert data["passed"] is True
    assert data["descriptive_pending_review"] is True


def test_quiz_invalid_email_is_rejected(api_client, created_program, created_lesson):
    payload = {
        "intern_email": "not-an-email",
        "answers": [{"question_id": created_lesson["quiz_questions"][0]["id"], "answer": "4"}],
    }
    response = api_client.post(
        f"{BASE_URL}/api/programs/{created_program['id']}/lessons/{created_lesson['id']}/quiz",
        json=payload,
        timeout=30,
    )
    assert response.status_code == 422


# --- Project upload/download checks (class + final) ---
def test_class_project_upload_requires_application(api_client, created_program, created_lesson):
    response = requests.post(
        f"{BASE_URL}/api/programs/{created_program['id']}/project-submissions",
        data={
            "intern_email": f"not_applied_{uuid.uuid4().hex[:8]}@example.com",
            "submission_type": "class",
            "lesson_id": created_lesson["id"],
        },
        files={"file": ("class-project.pdf", _pdf_bytes(), "application/pdf")},
        timeout=30,
    )
    assert response.status_code == 403
    assert "Apply to this internship" in response.json()["detail"]


def test_class_project_pdf_upload_and_receipt_download(api_client, created_program, created_lesson, applied_email):
    upload = requests.post(
        f"{BASE_URL}/api/programs/{created_program['id']}/project-submissions",
        data={
            "intern_email": applied_email,
            "submission_type": "class",
            "lesson_id": created_lesson["id"],
        },
        files={"file": ("class-project.pdf", _pdf_bytes(), "application/pdf")},
        timeout=60,
    )
    assert upload.status_code == 200, upload.text
    up_data = upload.json()
    assert up_data["submission_type"] == "class"
    assert isinstance(up_data.get("receipt_token"), str) and len(up_data["receipt_token"]) > 10

    download = api_client.get(
        f"{BASE_URL}/api/project-submissions/{up_data['id']}/download",
        params={"receipt": up_data["receipt_token"]},
        timeout=60,
    )
    assert download.status_code == 200
    assert download.headers["content-type"].startswith("application/pdf")
    assert len(download.content) > 20


def test_class_project_upload_rejects_non_pdf(api_client, created_program, created_lesson, applied_email):
    response = requests.post(
        f"{BASE_URL}/api/programs/{created_program['id']}/project-submissions",
        data={
            "intern_email": applied_email,
            "submission_type": "class",
            "lesson_id": created_lesson["id"],
        },
        files={"file": ("notes.txt", b"not-a-pdf", "text/plain")},
        timeout=30,
    )
    assert response.status_code == 400
    assert "Upload a PDF" in response.json()["detail"]


def test_final_project_pdf_upload_and_receipt_download(api_client, created_program, applied_email):
    upload = requests.post(
        f"{BASE_URL}/api/programs/{created_program['id']}/project-submissions",
        data={"intern_email": applied_email, "submission_type": "final"},
        files={"file": ("final-project.pdf", _pdf_bytes(), "application/pdf")},
        timeout=60,
    )
    assert upload.status_code == 200, upload.text
    up_data = upload.json()
    assert up_data["submission_type"] == "final"
    assert up_data["lesson_id"] is None

    download = api_client.get(
        f"{BASE_URL}/api/project-submissions/{up_data['id']}/download",
        params={"receipt": up_data["receipt_token"]},
        timeout=60,
    )
    assert download.status_code == 200
    assert download.headers["content-type"].startswith("application/pdf")


def test_project_upload_missing_email_is_rejected(created_program):
    response = requests.post(
        f"{BASE_URL}/api/programs/{created_program['id']}/project-submissions",
        data={"submission_type": "final"},
        files={"file": ("final-project.pdf", _pdf_bytes(), "application/pdf")},
        timeout=30,
    )
    assert response.status_code == 422
