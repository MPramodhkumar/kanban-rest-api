# TaskZen

A Trello-style Kanban board with a **FastAPI + PostgreSQL** REST API and a **React** frontend.
Teams create projects, invite members, move tasks across columns by drag and drop, assign people,
and discuss work in comment threads.

![Dashboard](docs/screenshots/dashboard-dark.png)

## Features

- **Accounts and login:** registration, Argon2 password hashing, JWT access tokens.
- **Projects per user:** you only see projects you belong to; every project starts with To Do, In Progress, In Review and Done.
- **Team:** the project owner invites existing users by email.
- **Board:** drag and drop cards between columns and reorder them; changes are saved to the database.
- **Tasks:** title, description, priority (low, medium, high), and one or more assignees.
- **Comments:** a thread on every task; authors (and the project owner) can delete comments.
- **Dashboard:** completion ring, tasks by priority, tasks per column, high-priority tasks that need attention.
- **Light and dark themes**, responsive layout.
- **Access control on every route:** non-members get a 404, so they can't even tell a project exists.

| Board | Task and comments |
|---|---|
| ![Board](docs/screenshots/board-dark.png) | ![Task](docs/screenshots/task-comments-dark.png) |

| Light theme | Login |
|---|---|
| ![Light](docs/screenshots/board-light.png) | ![Login](docs/screenshots/login.png) |

## Tech stack

| Layer | Tools |
|---|---|
| Backend | Python, FastAPI, SQLAlchemy 2, Pydantic 2, PyJWT, pwdlib (Argon2) |
| Database | PostgreSQL |
| Frontend | React 18, Vite, lucide-react (plain CSS, no UI framework) |
| Tests | pytest, FastAPI TestClient |

## How it fits together

```
Browser (React, :5173)  ──HTTP + JWT──▶  FastAPI (:8000)  ──SQLAlchemy──▶  PostgreSQL
```

The frontend never talks to the database. Every action is an HTTP request to the API, which checks
the login token, checks that the user belongs to the project, and then reads or writes PostgreSQL.

```
main.py          routes and access checks
models.py        SQLAlchemy tables (User, Project, BoardColumn, Task, Comment)
schemas.py       Pydantic input/output shapes (passwords are never returned)
security.py      password hashing and JWT
database.py      engine, session, get_db
schema.sql       PostgreSQL tables
tests/           pytest suite
frontend/        React app (src/api.js is the only place that knows the API address)
```

## Getting started (Windows PowerShell)

You need Python 3.11+, Node.js 18+ and PostgreSQL.

**1. Database.** Create an empty database named `taskzen`, then run `schema.sql` in pgAdmin's Query Tool.

**2. Backend.**

```powershell
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file next to `main.py` (it is ignored by Git):

```
DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/taskzen
SECRET_KEY=a-long-random-string
```

Generate a secret key without printing it to the screen:

```powershell
python -c "import secrets; open('.env','a').write('\nSECRET_KEY=' + secrets.token_hex(32) + '\n')"
```

Start the API (interactive docs at http://127.0.0.1:8000/docs):

```powershell
uvicorn main:app --reload
```

**3. Frontend** (in a second terminal).

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173, create an account, then create your first project with the folder button in the header.

## Running the tests

```powershell
pip install pytest httpx
pytest
```

The tests use a temporary SQLite file and set their own secret key, so they never touch your PostgreSQL database.
They cover registration and login, password hashing, project and column access, invitations, task create/update/move/delete,
assignee rules, comment permissions, and rejection of invalid input.

## API overview

| Method | Path | What it does |
|---|---|---|
| POST | `/auth/register` | Create an account |
| POST | `/auth/login` | Log in (form fields `username` = email, `password`); returns a token |
| GET | `/auth/me` | The logged-in user |
| GET, POST | `/projects` | List your projects, create a project |
| GET | `/projects/{id}/board` | Columns with their tasks, assignees and comment counts |
| GET, POST | `/projects/{id}/members` | List members, invite one (owner only) |
| GET, POST | `/tasks` | List your tasks, create a task |
| GET, PATCH, DELETE | `/tasks/{id}` | Read, change, or delete a task |
| GET, POST | `/tasks/{id}/comments` | List or add comments |
| DELETE | `/comments/{id}` | Delete a comment (author or project owner) |

Everything except register and login needs `Authorization: Bearer <token>`.

## Security notes

- Passwords are stored only as Argon2 hashes and are never returned by the API.
- Tokens expire after 8 hours.
- `.env` holds the database password and signing key and must never be committed.
- Anyone who is not a project member gets a 404 for its columns, tasks and comments.
- CORS only allows the local frontend (`localhost:5173`); change it in `main.py` when you deploy.

## Roadmap

- [x] Authentication, projects, board, tasks, assignees, comments, dashboard
- [x] Automated tests (pytest)
- [ ] Alembic migrations
- [ ] Reports page and notifications
- [ ] Real-time updates (WebSockets)
- [ ] Docker and CI/CD (GitHub Actions)
