from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints

from models import Priority


# ---------- Users & auth ----------


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    created_at: datetime | None


class UserBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str


class Token(BaseModel):
    access_token: str
    token_type: str


# ---------- Tasks ----------


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    column_id: int
    title: str
    description: str | None
    priority: Priority
    position: int
    created_at: datetime | None
    assignees: list[UserBrief] = []
    comment_count: int = 0


class TaskCreate(BaseModel):
    column_id: int
    title: str
    description: str | None = None
    priority: Priority = Priority.medium
    position: int = 0
    assignee_ids: list[int] = []


class TaskUpdate(BaseModel):
    column_id: int | None = None
    title: str | None = None
    description: str | None = None
    priority: Priority | None = None
    position: int | None = None
    assignee_ids: list[int] | None = None


# ---------- Projects & board ----------


class ColumnOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    name: str
    position: int


class ColumnWithTasks(ColumnOut):
    tasks: list[TaskOut]


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    owner_id: int
    created_at: datetime | None


class BoardOut(BaseModel):
    project: ProjectOut
    columns: list[ColumnWithTasks]


class ProjectCreate(BaseModel):
    name: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
    ]
    description: str | None = None


class MemberAdd(BaseModel):
    email: EmailStr


# ---------- Comments ----------


class CommentCreate(BaseModel):
    text: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)
    ]


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    text: str
    created_at: datetime | None
    user: UserBrief
