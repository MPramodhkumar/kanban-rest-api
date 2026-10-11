from sqlalchemy import select

from database import SessionLocal
import models
from conftest import make_user


def test_register_returns_user_without_password(client):
    r = client.post("/auth/register", json={"name": "Ann", "email": "ann@example.com", "password": "password123"})
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == "ann@example.com"
    assert "password" not in body and "hashed_password" not in body


def test_password_is_stored_hashed(client):
    make_user(client, "Ann", "ann@example.com", password="password123")
    with SessionLocal() as db:
        user = db.scalars(select(models.User)).one()
    assert user.hashed_password != "password123"
    assert len(user.hashed_password) > 30


def test_duplicate_email_is_rejected_case_insensitively(client):
    make_user(client, "Ann", "ann@example.com")
    r = client.post("/auth/register", json={"name": "Ann 2", "email": "ANN@example.com", "password": "password123"})
    assert r.status_code == 409


def test_short_password_is_rejected(client):
    r = client.post("/auth/register", json={"name": "Ann", "email": "ann@example.com", "password": "short"})
    assert r.status_code == 422


def test_invalid_email_is_rejected(client):
    r = client.post("/auth/register", json={"name": "Ann", "email": "not-an-email", "password": "password123"})
    assert r.status_code == 422


def test_login_with_wrong_password_fails(client):
    make_user(client, "Ann", "ann@example.com")
    r = client.post("/auth/login", data={"username": "ann@example.com", "password": "wrong-password"})
    assert r.status_code == 401


def test_login_with_unknown_email_fails(client):
    r = client.post("/auth/login", data={"username": "nobody@example.com", "password": "password123"})
    assert r.status_code == 401


def test_me_returns_the_logged_in_user(client):
    headers = make_user(client, "Ann", "ann@example.com")
    r = client.get("/auth/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["name"] == "Ann"


def test_protected_routes_need_a_token(client):
    for method, path in [("get", "/auth/me"), ("get", "/projects"), ("get", "/tasks"), ("post", "/tasks")]:
        assert getattr(client, method)(path).status_code == 401, path


def test_garbage_token_is_rejected(client):
    r = client.get("/projects", headers={"Authorization": "Bearer not.a.real.token"})
    assert r.status_code == 401
