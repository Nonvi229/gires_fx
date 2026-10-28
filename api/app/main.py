from fastapi import FastAPI
from app.core.database import Base, engine
import app.models

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Gires FX API")
