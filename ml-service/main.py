"""
Precision AgriTech - Machine Learning & Vision Inference Service
FastAPI application for crop disease classification and leaf diagnostics.
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional

app = FastAPI(
    title="AgriTech ML & Vision Service",
    description="Inference API for leaf disease detection and crop health diagnostics",
    version="0.1.0",
)

# Enable CORS for local development (Frontend access)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str


class ClassificationResponse(BaseModel):
    crop: str
    disease_name: str
    confidence: float
    pathogen_type: str
    risk_level: str
    model_version: str
    inference_time_ms: int
    class_probabilities: Dict[str, float]


@app.get("/api/v1/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint for container orchestrators and API gateways."""
    return HealthResponse(
        status="healthy",
        service="agritech-ml-service",
        version="0.1.0",
    )


@app.post("/api/v1/classify-leaf", response_model=ClassificationResponse)
async def classify_leaf(file: UploadFile = File(...)):
    """
    Classify leaf disease from an uploaded image.
    In Phase 1, this endpoint will run inference via trained ONNX model.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    # Placeholder response during project groundwork phase
    return ClassificationResponse(
        crop="Tomato",
        disease_name="Early Blight",
        confidence=0.9421,
        pathogen_type="Fungal",
        risk_level="High",
        model_version="mobilenetv3_large_v1.0.0_stub",
        inference_time_ms=45,
        class_probabilities={
            "Tomato___Early_blight": 0.9421,
            "Tomato___Late_blight": 0.0384,
            "Tomato___healthy": 0.0195,
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
