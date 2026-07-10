"""
Единственный REST-эндпоинт GET /api/markers.
Список меток теперь пустой — все точки добавляются вручную через интерфейс
(кнопка "Добавить метку" на карте), метки хранятся локально в IndexedDB на устройстве.
Этот эндпоинт можно использовать позже, если понадобится синхронизация с сервером.
Запускать: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Gelendzhik Map API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


class MarkerOut(BaseModel):
    id: str
    lat: float
    lng: float
    title: str
    description: str | None = None


MARKERS: list[MarkerOut] = []


@app.get("/api/markers", response_model=list[MarkerOut])
def get_markers():
    return MARKERS
