def post(client, headers, task_id, text="hello"):
    return client.post(f"/tasks/{task_id}/comments", json={"text": text}, headers=headers)


def test_post_and_list_comments_in_order(client, owner, member, team, task):
    first = post(client, owner, task["id"], "  first  ")
    assert first.status_code == 201
    assert first.json()["text"] == "first"                       # trimmed
    assert first.json()["user"]["name"] == "Olivia Owner"
    assert post(client, member, task["id"], "from maya").status_code == 201
    texts = [c["text"] for c in client.get(f"/tasks/{task['id']}/comments", headers=member).json()]
    assert texts == ["first", "from maya"]


def test_blank_or_huge_comments_are_rejected(client, owner, task):
    assert post(client, owner, task["id"], "   ").status_code == 422
    assert post(client, owner, task["id"], "x" * 2001).status_code == 422


def test_outsider_cannot_read_write_or_delete_comments(client, owner, outsider, task):
    comment = post(client, owner, task["id"]).json()
    assert client.get(f"/tasks/{task['id']}/comments", headers=outsider).status_code == 404
    assert post(client, outsider, task["id"]).status_code == 404
    assert client.delete(f"/comments/{comment['id']}", headers=outsider).status_code == 404


def test_only_author_or_project_owner_can_delete(client, owner, member, team, task):
    owners_comment = post(client, owner, task["id"], "mine").json()
    members_comment = post(client, member, task["id"], "hers").json()

    # a member can't delete the owner's comment...
    assert client.delete(f"/comments/{owners_comment['id']}", headers=member).status_code == 403
    # ...but can delete their own
    assert client.delete(f"/comments/{members_comment['id']}", headers=member).status_code == 204
    # the project owner can delete anyone's
    again = post(client, member, task["id"], "again").json()
    assert client.delete(f"/comments/{again['id']}", headers=owner).status_code == 204


def test_deleting_a_missing_comment_is_404(client, owner, project):
    assert client.delete("/comments/9999", headers=owner).status_code == 404


def test_comment_count_shows_on_the_board_and_on_the_task(client, owner, member, team, task, columns):
    post(client, owner, task["id"], "one")
    post(client, member, task["id"], "two")
    assert client.get(f"/tasks/{task['id']}", headers=owner).json()["comment_count"] == 2
    board = client.get(f"/projects/{columns[0]['project_id']}/board", headers=owner).json()
    assert board["columns"][0]["tasks"][0]["comment_count"] == 2
