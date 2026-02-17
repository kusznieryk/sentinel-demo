from fastapi import FastAPI, HTTPException, Depends
from contextlib import asynccontextmanager
from pydantic import BaseModel
import pandas as pd
from dotenv import load_dotenv
from sklearn.ensemble import IsolationForest
from databricks.sdk import WorkspaceClient
import os

load_dotenv()  

class AnomalyResponse(BaseModel):
    is_anomaly: bool
    score: float
    message: str

def get_warehouse_id():
    return os.getenv("DATABRICKS_HTTP_PATH").split("/")[-1]

@asynccontextmanager
async def lifespan(app: FastAPI):
    model = IsolationForest(contamination=0.1)
    dummy_data = [[10, 10], [8, 9], [9, 5], ]
    model.fit(dummy_data)
    app.state.model = model
    print("🧠 Sentinel Brain: Modelo cargado y listo")
    yield
    print("🛑 Sentinel Brain: Apagando recursos")

app = FastAPI(lifespan=lifespan, title="Sentinel Brain API")

def get_databricks_client():
    return WorkspaceClient(
        host=os.getenv("DATABRICKS_HOST"),
        token=os.getenv("DATABRICKS_TOKEN")
    )
@app.post("/analyze-latest", response_model=AnomalyResponse)
async def analyze_latest(client: WorkspaceClient = Depends(get_databricks_client)):
    try:
        warehouse_id = get_warehouse_id() 
    
        query = "SELECT payload FROM bronze.raw_telemetry ORDER BY ingested_at DESC LIMIT 1"
        response = client.statement_execution.execute_statement(
            warehouse_id=warehouse_id,
            statement=query
        )

        raw_data = response.result.data_array 
        #... (lógica de parsing)...
        
        # Simulación de Inferencia
        prediction = app.state.model.predict([[85.5, 40.2]])
        is_anomaly = True if prediction == -1 else False
        
        return AnomalyResponse(
            is_anomaly=is_anomaly,
            score=0.95 if is_anomaly else 0.05,
            message="Anomalía detectada en métricas de sistema" if is_anomaly else "Sistema estable"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {"status": "healthy", "version": "1.0.0"}