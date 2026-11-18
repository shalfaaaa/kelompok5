import json
from pathlib import Path
from typing import Literal

import joblib
import pandas as pd
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field, create_model

ROOT = Path(__file__).resolve().parent
schema = json.loads((ROOT / "model" / "schema.json").read_text(encoding="utf-8"))
model = joblib.load(ROOT / "model" / schema["model"])


class InputBase(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


fields = {}

for col, limits in schema["numeric"].items():
    fields[col] = (
        float,
        Field(..., ge=limits["min"], le=limits["max"], strict=True),
    )

for col, choices in schema["categorical"].items():
    fields[col] = (Literal[tuple(choices)], Field(...))

PredictionInput = create_model("PredictionInput", __base__=InputBase, **fields)

app = FastAPI(title="Prediksi Risiko Pelanggan Berhenti Berlangganan — Kelompok 5")
app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")


@app.get("/")
def home():
    return FileResponse(ROOT / "static" / "index.html")


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": True}


@app.get("/features")
def get_features():
    return {key: schema[key] for key in ("groups", "numeric", "categorical")}


@app.post("/predict")
def predict(payload: PredictionInput):
    row = pd.DataFrame([payload.model_dump()], columns=schema["features"])
    scores = model.predict_proba(row)[0]
    return {
        "prediction": str(model.predict(row)[0]),
        "probabilities": {
            str(label): float(score)
            for label, score in zip(model.classes_, scores)
        },
        "simulation": schema["simulation"],
    }

