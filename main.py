#main.py has the API routes that use that connection, such as "list tasks" and "update a task".

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


# ---------- Projects & Board ----------


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
            selectinload(models.Project.columns).selectinload(models.BoardColumn.tasks)
        )
    ).one()
    return {"project": project, "columns": project.columns}


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
    get_column_or_404(db, task_in.column_id, current_user)

    task = models.Task(**task_in.model_dump())
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

    if "column_id" in data:
        new_column = get_column_or_404(db, data["column_id"], current_user)
        if new_column.project_id != task.column.project_id:
            raise HTTPException(status_code=400, detail="Can't move a task to another project")

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