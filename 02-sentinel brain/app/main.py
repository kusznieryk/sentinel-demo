from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from dotenv import load_dotenv
from sklearn.ensemble import IsolationForest
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.sql import StatementState
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any
import json
import os
import asyncio

load_dotenv()

class AnomalyResponse(BaseModel):
    is_anomaly: bool
    score: float
    message: str

def get_warehouse_id():
    path = os.getenv("DATABRICKS_HTTP_PATH")
    if not path:
        return None
    return path.split("/")[-1]

class MLModelWrapper:
    def __init__(self):
        self.model = None

    def load_model(self):
        # EL modelo deberia de estar enterenado previamente y cargarlo al comienzo. No entrenarlo cada vez
        model = IsolationForest(contamination=0.1)
        dummy_data = [[10, 10], [8, 9], [9, 5], ]
        model.fit(dummy_data)
        self.model = model
    

    def predict(self, cpu: float, memory: float) -> tuple[bool, float]:
        if not self.model:
            raise RuntimeError("El modelo no está cargado.")
        
        # IsolationForest: -1 es anomalía, 1 es normal
        pred = self.model.predict([[cpu, memory]])[0]
        score = self.model.decision_function([[cpu, memory]])[0] 
        
        is_anomaly = True if pred == -1 else False
        return is_anomaly, float(score)

ml_wrapper = MLModelWrapper()

@asynccontextmanager
async def lifespan(app: FastAPI):
    ml_wrapper.load_model()
    yield

app = FastAPI(lifespan=lifespan, title="Sentinel Brain API")
thread_pool = ThreadPoolExecutor(max_workers=5)
def get_db_config() -> dict:
    host = os.getenv("DATABRICKS_HOST")
    token = os.getenv("DATABRICKS_TOKEN")
    http_path = os.getenv("DATABRICKS_HTTP_PATH")
    
    if not all([host, token, http_path]):
        raise HTTPException(status_code=500, detail="Faltan variables de entorno de Databricks.")
    
    warehouse_id = http_path.split("/")[-1]
    return {"host": host, "token": token, "warehouse_id": warehouse_id}

async def execute_databricks_query_async(query: str):
    config = get_db_config()
    
    def _blocking_call():
        w = WorkspaceClient(host=config["host"], token=config["token"])
        
        response = w.statement_execution.execute_statement(
            warehouse_id=config["warehouse_id"],
            statement=query,
            wait_timeout="10s"
        )
        
        statement_id = response.statement_id
        
        while response.status.state in [StatementState.PENDING, StatementState.RUNNING]:
             response = w.statement_execution.get_statement(statement_id)
             if response.status.state in [StatementState.SUCCEEDED, StatementState.FAILED, StatementState.CANCELED]:
                 break
        
        if response.status.state != StatementState.SUCCEEDED:
            raise Exception(f"Query falló con estado: {response.status.state}")
            
        return response

    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(thread_pool, _blocking_call)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail="Error de comunicación con Data Warehouse")

@app.post("/analyze-latest", response_model=AnomalyResponse)
async def analyze_latest():
    query = "SELECT payload FROM bronze.raw_telemetry ORDER BY ingested_at DESC LIMIT 1"
    db_result = await execute_databricks_query_async(query)
    try:
        if not db_result.result or not db_result.result.data_array:
            raise HTTPException(status_code=404, detail="No se encontraron datos de telemetría.")
            
        raw_val = db_result.result.data_array[0][0]
        
        if isinstance(raw_val, str):
            payload = json.loads(raw_val)
        else:
            payload = raw_val
            
        cpu = float(payload.get("cpu_usage", 0))
        memory = float(payload.get("memory_usage", 0))
        
    except (json.JSONDecodeError, ValueError, IndexError) as e:
        raise HTTPException(status_code=500, detail="Formato de datos corrupto desde Databricks")

    is_anomaly, score = ml_wrapper.predict(cpu, memory)
    
    msg = "¡Alerta! Anomalía detectada." if is_anomaly else "Sistema operando en parámetros normales."
    
    return AnomalyResponse(
        is_anomaly=is_anomaly,
        score=score,
        message=msg,
        telemetry_data={"cpu": cpu, "memory": memory}
    )
        
@app.get("/health")
def health():
    return {"status": "healthy", "version": "1.0.0"}