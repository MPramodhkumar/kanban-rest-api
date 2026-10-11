def preflight(client, origin):
    return client.options(
        "/projects",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )


def test_local_frontend_is_allowed(client):
    r = preflight(client, "http://localhost:5173")
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_unknown_website_is_not_allowed(client):
    r = preflight(client, "https://evil.example.com")
    assert "access-control-allow-origin" not in r.headers
