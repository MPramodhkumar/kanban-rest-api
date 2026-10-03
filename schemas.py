# models.py describes what is stored in PostgreSQL, while schemas.py describes what data your API is allowed to receive or return.
#schemas.py is mainly about what data your API should send/receive.

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