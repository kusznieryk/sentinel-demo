from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from dotenv import load_dotenv
from sklearn.ensemble import IsolationForest
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.sql import StatementState
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from dateutil import parser
from typing import Optional, Dict, Any
from types import SimpleNamespace
import json
import os
import asyncio
import logging
import httpx
load_dotenv()
NODE_ALERTER_URL = "http://localhost:4000/api/v1/webhook/anomaly"  # Cambia al URL de tu Alerter
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sentinel_brain")
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
state = SimpleNamespace(last_ingested_at=None, model=None)
async def fetch_latest_record_from_databricks():
    host, token, warehouse_id = get_db_config().values()
    w = WorkspaceClient(host=host, token=token)
    query = "SELECT payload, ingested_at FROM bronze.raw_telemetry ORDER BY ingested_at DESC LIMIT 1"
    
    try:
        loop = asyncio.get_event_loop()
        res = await loop.run_in_executor(None, lambda: w.statement_execution.execute_statement(
            warehouse_id=warehouse_id,
            statement=query,
            wait_timeout="10s"
        ))
        
        if res.result and res.result.data_array:
            row = res.result.data_array[0]
            raw_payload = row[0]
            ingestion_time = row[1]
            
            payload_dict = json.loads(raw_payload)
            return payload_dict, ingestion_time
        return None, None
    except Exception as e:
        logger.error(f"Error consultando Databricks: {e}")
        return None, None

async def send_alert(data):
    """Envía la alerta al Node.js (que está en Ngrok/Cloud)"""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(NODE_ALERTER_URL, json=data, timeout=5.0)
            if resp.status_code == 200:
                logger.info("✅ Alerta entregada exitosamente.")
            else:
                logger.warning(f"⚠️ Alerter respondió con error: {resp.status_code}")
        except Exception as e:
            logger.error(f"❌ No se pudo conectar con el Alerter: {e}")

async def monitor_loop():
    """El cerebro que revisa datos nuevos constantemente"""
    logger.info("👀 Iniciando vigilancia de nuevos datos...")
    
    while True:
        try:
            payload, ingested_at_str = await fetch_latest_record_from_databricks()
            print(f"Último registro obtenido: {payload} con timestamp {ingested_at_str}")
            if payload and ingested_at_str:
                current_timestamp = ingested_at_str 
                
                if state.last_ingested_at != current_timestamp:
                    telemetry = payload
                    cpu = float(telemetry.get("cpu_usage", 0))
                    memory = float(telemetry.get("memory_usage", 0))
                    
                    prediction = state.model.predict([[cpu, memory]])[0]
                    is_anomaly = True if prediction == -1 else False
                    if is_anomaly:
                        alert_payload = {
                            "is_anomaly": True,
                            "score": float(state.model.decision_function([[cpu, memory]])[0]),
                            "message": f"Lectura crítica a las {ingested_at_str}",
                            "metrics": {"cpu": cpu, "memory": memory},
                            "timestamp": current_timestamp
                        }
                        
                        await send_alert(alert_payload)
                    
                    state.last_ingested_at = current_timestamp
                else:
                    logger.debug("No hay nuevos datos desde la última revisión.")
                    pass

        except Exception as e:
            logger.error(f"Error en monitor_loop: {e}")  
            
        await asyncio.sleep(10)

@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(monitor_loop())
    ml_wrapper.load_model()
    state.model = ml_wrapper.model
    yield
    task.cancel()

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