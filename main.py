from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from database import get_db
import models, schemas, security

app = FastAPI(title="TaskFlow API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DEFAULT_COLUMNS = ["To Do", "In Progress", "In Review", "Done"]
members = models.project_members


# ---------- Access helpers: a user may only touch projects they belong to ----------


def get_project_or_404(db: Session, project_id: int, user: models.User) -> models.Project:
    project = db.scalars(
        select(models.Project)
        .join(members, members.c.project_id == models.Project.id)
        .where(models.Project.id == project_id, members.c.user_id == user.id)
    ).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def get_column_or_404(db: Session, column_id: int, user: models.User) -> models.BoardColumn:
    column = db.scalars(
        select(models.BoardColumn)
        .join(members, members.c.project_id == models.BoardColumn.project_id)
        .where(models.BoardColumn.id == column_id, members.c.user_id == user.id)
    ).first()
    if column is None:
        raise HTTPException(status_code=404, detail="Column not found")
    return column


def get_task_or_404(db: Session, task_id: int, user: models.User) -> models.Task:
    task = db.scalars(
        select(models.Task)
        .join(models.BoardColumn, models.Task.column_id == models.BoardColumn.id)
        .join(members, members.c.project_id == models.BoardColumn.project_id)
        .where(models.Task.id == task_id, members.c.user_id == user.id)
    ).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


def load_assignees(db: Session, project_id: int, user_ids: list[int]) -> list[models.User]:
    """Only members of the project can be assigned to its tasks."""
    ids = set(user_ids)
    if not ids:
        return []
    users = db.scalars(
        select(models.User)
        .join(members, members.c.user_id == models.User.id)
        .where(members.c.project_id == project_id, models.User.id.in_(ids))
    ).all()
    if len(users) != len(ids):
        raise HTTPException(status_code=400, detail="Assignees must be project members")
    return list(users)


@app.get("/")
def root():
    return {"message": "TaskFlow API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


# ---------- Auth ----------


@app.post("/auth/register", response_model=schemas.UserOut, status_code=201)
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    email = user_in.email.lower()
    if db.scalars(select(models.User).where(models.User.email == email)).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = models.User(
        name=user_in.name,
        email=email,
        hashed_password=security.hash_password(user_in.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/auth/login", response_model=schemas.Token)
def login(
    form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    user = db.scalars(
        select(models.User).where(models.User.email == form.username.lower())
    ).first()
    if user is None or not security.verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {"access_token": security.create_access_token(user.id), "token_type": "bearer"}


@app.get("/auth/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(security.get_current_user)):
    return current_user


# ---------- Projects, members & board ----------


@app.get("/projects", response_model=list[schemas.ProjectOut])
def list_projects(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    return db.scalars(
        select(models.Project)
        .join(members, members.c.project_id == models.Project.id)
        .where(members.c.user_id == current_user.id)
        .order_by(models.Project.id)
    ).all()


@app.post("/projects", response_model=schemas.ProjectOut, status_code=201)
def create_project(
    project_in: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    project = models.Project(
        name=project_in.name,
        description=project_in.description,
        owner_id=current_user.id,
    )
    project.columns = [
        models.BoardColumn(name=name, position=i + 1)
        for i, name in enumerate(DEFAULT_COLUMNS)
    ]
    db.add(project)
    db.flush()  # gets project.id without finishing the transaction
    db.execute(members.insert().values(project_id=project.id, user_id=current_user.id))
    db.commit()
    db.refresh(project)
    return project


@app.get("/projects/{project_id}/board", response_model=schemas.BoardOut)
def get_board(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    get_project_or_404(db, project_id, current_user)  # membership check
    project = db.scalars(
        select(models.Project)
        .where(models.Project.id == project_id)
        .options(
            selectinload(models.Project.columns)
            .selectinload(models.BoardColumn.tasks)
            .selectinload(models.Task.assignees)
        )
    ).one()
    return {"project": project, "columns": project.columns}


@app.get("/projects/{project_id}/members", response_model=list[schemas.UserBrief])
def list_members(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    get_project_or_404(db, project_id, current_user)
    return db.scalars(
        select(models.User)
        .join(members, members.c.user_id == models.User.id)
        .where(members.c.project_id == project_id)
        .order_by(models.User.name)
    ).all()


@app.post(
    "/projects/{project_id}/members",
    response_model=schemas.UserBrief,
    status_code=201,
)
def add_member(
    project_id: int,
    body: schemas.MemberAdd,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    project = get_project_or_404(db, project_id, current_user)
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the project owner can invite people")

    user = db.scalars(
        select(models.User).where(models.User.email == body.email.lower())
    ).first()
    if user is None:
        raise HTTPException(status_code=404, detail="No account with that email")

    already = db.execute(
        select(members).where(
            members.c.project_id == project_id, members.c.user_id == user.id
        )
    ).first()
    if already:
        raise HTTPException(status_code=409, detail="Already a member")

    db.execute(members.insert().values(project_id=project_id, user_id=user.id))
    db.commit()
    return user


# ---------- Tasks ----------


@app.get("/tasks", response_model=list[schemas.TaskOut])
def list_tasks(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    return db.scalars(
        select(models.Task)
        .join(models.BoardColumn, models.Task.column_id == models.BoardColumn.id)
        .join(members, members.c.project_id == models.BoardColumn.project_id)
        .where(members.c.user_id == current_user.id)
        .order_by(models.Task.id)
    ).all()


@app.post("/tasks", response_model=schemas.TaskOut, status_code=201)
def create_task(
    task_in: schemas.TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    column = get_column_or_404(db, task_in.column_id, current_user)

    task = models.Task(**task_in.model_dump(exclude={"assignee_ids"}))
    task.assignees = load_assignees(db, column.project_id, task_in.assignee_ids)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@app.get("/tasks/{task_id}", response_model=schemas.TaskOut)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    return get_task_or_404(db, task_id, current_user)


@app.patch("/tasks/{task_id}", response_model=schemas.TaskOut)
def update_task(
    task_id: int,
    changes: schemas.TaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    task = get_task_or_404(db, task_id, current_user)
    data = changes.model_dump(exclude_unset=True)
    assignee_ids = data.pop("assignee_ids", None)

    if "column_id" in data:
        new_column = get_column_or_404(db, data["column_id"], current_user)
        if new_column.project_id != task.column.project_id:
            raise HTTPException(status_code=400, detail="Can't move a task to another project")

    if assignee_ids is not None:
        task.assignees = load_assignees(db, task.column.project_id, assignee_ids)

    for field, value in data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return task


@app.delete("/tasks/{task_id}", status_code=204)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    task = get_task_or_404(db, task_id, current_user)
    db.delete(task)
    db.commit()


# ---------- Comments ----------


@app.get("/tasks/{task_id}/comments", response_model=list[schemas.CommentOut])
def list_comments(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    get_task_or_404(db, task_id, current_user)  # membership check
    return db.scalars(
        select(models.Comment)
        .where(models.Comment.task_id == task_id)
        .options(selectinload(models.Comment.user))
        .order_by(models.Comment.created_at, models.Comment.id)
    ).all()


@app.post("/tasks/{task_id}/comments", response_model=schemas.CommentOut, status_code=201)
def add_comment(
    task_id: int,
    body: schemas.CommentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    get_task_or_404(db, task_id, current_user)
    comment = models.Comment(task_id=task_id, user_id=current_user.id, text=body.text)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@app.delete("/comments/{comment_id}", status_code=204)
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    comment = db.get(models.Comment, comment_id)
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")

    task = get_task_or_404(db, comment.task_id, current_user)  # membership check
    project = db.get(models.Project, task.column.project_id)
    if comment.user_id != current_user.id and project.owner_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Only the author or the project owner can delete this comment"
        )

    db.delete(comment)
    db.commit()
