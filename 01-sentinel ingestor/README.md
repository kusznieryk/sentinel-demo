# Que es Data Ingestion?
Es la lectura cruda de datos y la carga en un tipo de datalake. Tenemos 2 versiones
1. Batch. Una carga agendada donde se carga un bloque de datos, herramientas como fivertan, kafka y airbyte
2. Streaming. Carga constante de datos, cada dato es agregado apenas es accesible. Capaz se controla tamaños de ventanas. Herramientas como kafka, amazon kinesis y debezium
Siempre podemos hacer custom scripts para cualquier forma 

Est programa simula la ingesta de datos por streaming
# Instrucciones para construir y correr con Docker

## 1. Construcción de la imagen Docker

Desde la carpeta `01-sentinel ingestor`, ejecuta:

```bash
# Construye la imagen Docker con el tag deseado (por ejemplo, v1)
docker build -t sentinel-ingest:v1 .
```

## 2. Configuración de variables de entorno

Crea un archivo `.env` en la misma carpeta con el siguiente contenido (ajusta los valores según tu entorno):

```env
DATABRICKS_TOKEN=tu_token
DATABRICKS_HOST=tu_host
DATABRICKS_HTTP_PATH=tu_http_path
```

## 3. Ejecución del contenedor

Para correr el programa usando Docker y el archivo `.env`:

```bash
docker run --env-file .env sentinel-ingest:v1
```

Esto iniciará el proceso de ingesta de datos según la configuración definida en las variables de entorno.