from fastapi import Depends, FastAPI
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
import models, schemas

app = FastAPI(title="TaskFlow API")


@app.get("/")
def root():
    return {"message": "TaskFlow API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/tasks", response_model=list[schemas.TaskOut])
def list_tasks(db: Session = Depends(get_db)):
    return db.scalars(select(models.Task).order_by(models.Task.id)).all()