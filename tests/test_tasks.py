def test_create_and_read_a_task(client, owner, columns):
    r = client.post("/tasks", json={"column_id": columns[0]["id"], "title": "Ship it"}, headers=owner)
    assert r.status_code == 201
    created = r.json()
    assert created["priority"] == "medium"          # default
    assert created["assignees"] == [] and created["comment_count"] == 0
    assert client.get(f"/tasks/{created['id']}", headers=owner).json()["title"] == "Ship it"


def test_invalid_priority_is_rejected(client, owner, columns):
    r = client.post("/tasks", json={"column_id": columns[0]["id"], "title": "x", "priority": "urgent"}, headers=owner)
    assert r.status_code == 422


def test_task_in_a_missing_column_is_404(client, owner, project):
    assert client.post("/tasks", json={"column_id": 9999, "title": "x"}, headers=owner).status_code == 404


def test_patch_changes_only_the_fields_sent(client, owner, task):
    r = client.patch(f"/tasks/{task['id']}", json={"priority": "low"}, headers=owner)
    assert r.status_code == 200
    assert r.json()["priority"] == "low"
    assert r.json()["title"] == "Write tests"       # untouched
    assert r.json()["column_id"] == task["column_id"]


def test_null_for_a_required_field_is_a_clear_422_not_a_crash(client, owner, task):
    for field in ("title", "column_id", "priority", "position"):
        r = client.patch(f"/tasks/{task['id']}", json={field: None}, headers=owner)
        assert r.status_code == 422, field
    assert client.get(f"/tasks/{task['id']}", headers=owner).json()["title"] == "Write tests"


def test_move_a_task_to_another_column(client, owner, columns, task):
    done = columns[3]["id"]
    r = client.patch(f"/tasks/{task['id']}", json={"column_id": done}, headers=owner)
    assert r.status_code == 200 and r.json()["column_id"] == done
    board = client.get(f"/projects/{columns[0]['project_id']}/board", headers=owner).json()
    assert [t["id"] for t in board["columns"][3]["tasks"]] == [task["id"]]
    assert board["columns"][0]["tasks"] == []


def test_move_to_a_missing_column_is_404(client, owner, task):
    assert client.patch(f"/tasks/{task['id']}", json={"column_id": 9999}, headers=owner).status_code == 404


def test_cannot_move_a_task_into_another_project(client, owner, task):
    other = client.post("/projects", json={"name": "Second"}, headers=owner).json()
    other_col = client.get(f"/projects/{other['id']}/board", headers=owner).json()["columns"][0]["id"]
    r = client.patch(f"/tasks/{task['id']}", json={"column_id": other_col}, headers=owner)
    assert r.status_code == 400


def test_delete_a_task(client, owner, task):
    assert client.delete(f"/tasks/{task['id']}", headers=owner).status_code == 204
    assert client.get(f"/tasks/{task['id']}", headers=owner).status_code == 404


def test_outsider_cannot_touch_someone_elses_task(client, outsider, task, columns):
    tid = task["id"]
    assert client.get(f"/tasks/{tid}", headers=outsider).status_code == 404
    assert client.patch(f"/tasks/{tid}", json={"title": "hacked"}, headers=outsider).status_code == 404
    assert client.delete(f"/tasks/{tid}", headers=outsider).status_code == 404
    assert client.post("/tasks", json={"column_id": columns[0]["id"], "title": "x"}, headers=outsider).status_code == 404
    assert client.get("/tasks", headers=outsider).json() == []


def test_assign_project_members(client, owner, member, team, columns):
    ids = [m["id"] for m in client.get(f"/projects/{team['id']}/members", headers=owner).json()]
    r = client.post("/tasks", json={"column_id": columns[0]["id"], "title": "Pair up", "assignee_ids": ids}, headers=owner)
    assert r.status_code == 201
    assert sorted(a["name"] for a in r.json()["assignees"]) == ["Maya Member", "Olivia Owner"]
    # and clear them again
    r = client.patch(f"/tasks/{r.json()['id']}", json={"assignee_ids": []}, headers=owner)
    assert r.json()["assignees"] == []


def test_cannot_assign_someone_outside_the_project(client, owner, outsider, task):
    eve_id = client.get("/auth/me", headers=outsider).json()["id"]
    r = client.patch(f"/tasks/{task['id']}", json={"assignee_ids": [eve_id]}, headers=owner)
    assert r.status_code == 400
