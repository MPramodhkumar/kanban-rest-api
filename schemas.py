from datetime import datetime
from pydantic import BaseModel, ConfigDict

from models import Priority


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    column_id: int
    title: str
    description: str | None
    priority: Priority
    position: int
    created_at: datetime | None


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


class TaskCreate(BaseModel):
    column_id: int
    title: str
    description: str | None = None
    priority: Priority = Priority.medium
    position: int = 0


class TaskUpdate(BaseModel):
    column_id: int | None = None
    title: str | None = None
    description: str | None = None
    priority: Priority | None = None
    position: int | None = None