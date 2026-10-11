"""Shared test setup.

IMPORTANT: the environment variables below are set BEFORE the app is imported,
so the tests always use a temporary SQLite file and never touch your real
PostgreSQL database (even though .env points there).
"""
import os
import tempfile

_tmp = tempfile.mkdtemp(prefix="taskzen-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["SECRET_KEY"] = "test-secret-key-that-is-long-enough-for-hs256"

import pytest
from fastapi.testclient import TestClient

from database import Base, engine
import models  # noqa: F401  (registers the tables)
from main import app


@pytest.fixture(autouse=True)
def fresh_database():
    """Every test starts with empty tables."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def client():
    return TestClient(app)


def make_user(client, name, email, password="password123"):
    """Register + log in. Returns the Authorization headers."""
    r = client.post("/auth/register", json={"name": name, "email": email, "password": password})
    assert r.status_code == 201, r.text
    r = client.post("/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["access_token"]}


@pytest.fixture
def owner(client):
    return make_user(client, "Olivia Owner", "owner@example.com")


@pytest.fixture
def member(client):
    return make_user(client, "Maya Member", "maya@example.com")


@pytest.fixture
def outsider(client):
    return make_user(client, "Eve Outsider", "eve@example.com")


@pytest.fixture
def project(client, owner):
    """A project owned by `owner` (comes with 4 default columns)."""
    r = client.post("/projects", json={"name": "Backend API"}, headers=owner)
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture
def columns(client, owner, project):
    r = client.get(f"/projects/{project['id']}/board", headers=owner)
    return r.json()["columns"]


@pytest.fixture
def team(client, owner, member, project):
    """`member` is invited into `project`."""
    r = client.post(f"/projects/{project['id']}/members", json={"email": "maya@example.com"}, headers=owner)
    assert r.status_code == 201, r.text
    return project


@pytest.fixture
def task(client, owner, columns):
    r = client.post("/tasks", json={"column_id": columns[0]["id"], "title": "Write tests", "priority": "high"}, headers=owner)
    assert r.status_code == 201, r.text
    return r.json()
