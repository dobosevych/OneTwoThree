from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import ParticipantCreate, ParticipantRead
from app.services import participants as service

router = APIRouter(prefix="/participants", tags=["participants"])


@router.get("", response_model=list[ParticipantRead])
def list_participants(q: str | None = None, db: Session = Depends(get_db)):
    return service.list_participants(db, q)


@router.post("", response_model=ParticipantRead, status_code=status.HTTP_201_CREATED)
def create_participant(data: ParticipantCreate, db: Session = Depends(get_db)):
    return service.create_participant(db, data)


@router.delete("/{participant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_participant(participant_id: UUID, db: Session = Depends(get_db)):
    service.delete_participant(db, participant_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
