# AgriTech - Machine Learning & Vision Service

The computer vision and disease diagnostics microservice for the **Precision AgriTech Platform**, built with **Python** and **FastAPI**.

## Overview

This service handles foliage image analysis and leaf pathology diagnostics:

- **Leaf Disease Classification**: Classifies plant health using models trained on the PlantVillage dataset.
- **Low-Latency Inference**: Runs lightweight CNN models (e.g., MobileNetV3 / EfficientNet-B0) exported to ONNX format.
- **RESTful Diagnostics API**: Ingests multipart image uploads and returns predicted disease, confidence score, pathogen type, and class probabilities.

## Prerequisites

- Python 3.10+ (Python 3.12 - 3.14 compatible)
- `pip`

## Getting Started

### 1. Make and Activate a Virtual Environment

```powershell
# Windows PowerShell
python -m venv venv
.\venv\Scripts\Activate.ps1

# macOS / Linux
python -m venv venv
source venv/bin/activate
```

### 2. Install Dependencies

```powershell
pip install -r requirements.txt
```

### 3. Run the Inference Server

```powershell
python main.py
```

Or with uvicorn directly:

```powershell
uvicorn main:app --reload --port 8000
```

- API Docs (Swagger UI): `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/api/v1/health`
- Leaf Classification Endpoint: `POST http://localhost:8000/api/v1/classify-leaf`
