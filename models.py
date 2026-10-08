# models.py converts your database design into Python classes so SQLAlchemy knows what your tables, columns, foreign keys, and relationships look like.
#models.py describes your tables (projects, columns, tasks) in Python, so the backend knows how to read and write them.


import enum
from datetime import datetime

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Priority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime | None]

class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    owner_id: Mapped[int]
    created_at: Mapped[datetime | None]

    columns: Mapped[list["BoardColumn"]] = relationship(
        back_populates="project", order_by="BoardColumn.position"
    )


class BoardColumn(Base):
    __tablename__ = "board_columns"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    name: Mapped[str] = mapped_column(String(50))
    position: Mapped[int]

    project: Mapped["Project"] = relationship(back_populates="columns")
    tasks: Mapped[list["Task"]] = relationship(
        back_populates="column", order_by="Task.position"
    )

class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    column_id: Mapped[int] = mapped_column(ForeignKey("board_columns.id"))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[Priority] = mapped_column(Enum(Priority, name="priority_level"))
    position: Mapped[int]
    created_at: Mapped[datetime | None]

    column: Mapped["BoardColumn"] = relationship(back_populates="tasks")