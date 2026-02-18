# Cererbo del sistema
Este proyecto simula un microservicio desplegado en Databricks App que consulta el unity catalog, tomando datos y realiando una prediccion de los mismos en base a algun modelo cargado

## Despliegue
Tuve que configurar los secretos para poder usar el valor de mi DATABRICK_TOKEN y DATABRICK_HTTP_PATH pero luego de configurar los secretos correctamente y su regerencia en el .YAML pude desplegar el sistema con los siguientes comandos
```bash
# 1. Autenticación (OAuth U2M)
databricks auth login --host <HOST>

# 2. Sincronización en tiempo real durante el desarrollo
databricks sync --watch. /Workspace/Users/<email>/sentinel-ai

# 3. Despliegue definitivo
databricks apps deploy sentinel-brain --source-code-path /Workspace/Users/<email>/sentinel-ai

```