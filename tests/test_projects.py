def test_new_project_gets_four_default_columns(client, owner, project):
    r = client.get(f"/projects/{project['id']}/board", headers=owner)
    assert r.status_code == 200
    assert [c["name"] for c in r.json()["columns"]] == ["To Do", "In Progress", "In Review", "Done"]


def test_project_name_is_required(client, owner):
    assert client.post("/projects", json={"name": "   "}, headers=owner).status_code == 422
    assert client.post("/projects", json={}, headers=owner).status_code == 422


def test_users_only_see_their_own_projects(client, owner, outsider, project):
    assert [p["id"] for p in client.get("/projects", headers=owner).json()] == [project["id"]]
    assert client.get("/projects", headers=outsider).json() == []


def test_outsider_cannot_open_a_board(client, outsider, project):
    assert client.get(f"/projects/{project['id']}/board", headers=outsider).status_code == 404
    assert client.get(f"/projects/{project['id']}/members", headers=outsider).status_code == 404


def test_missing_project_is_404(client, owner):
    assert client.get("/projects/9999/board", headers=owner).status_code == 404


def test_owner_can_invite_a_member_who_then_sees_the_project(client, owner, member, team):
    projects = client.get("/projects", headers=member).json()
    assert [p["id"] for p in projects] == [team["id"]]
    names = [m["name"] for m in client.get(f"/projects/{team['id']}/members", headers=owner).json()]
    assert names == ["Maya Member", "Olivia Owner"]


def test_invite_unknown_email_is_404(client, owner, project):
    r = client.post(f"/projects/{project['id']}/members", json={"email": "ghost@example.com"}, headers=owner)
    assert r.status_code == 404


def test_inviting_twice_is_409(client, owner, team):
    r = client.post(f"/projects/{team['id']}/members", json={"email": "maya@example.com"}, headers=owner)
    assert r.status_code == 409


def test_only_the_owner_can_invite(client, member, outsider, team):
    r = client.post(f"/projects/{team['id']}/members", json={"email": "eve@example.com"}, headers=member)
    assert r.status_code == 403
