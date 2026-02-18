# 1.Resumen
Este proyecto integra un pipeline de datos de alta velocidad con una capa de inteligencia artificial para monitoreo en tiempo real. Utiliza Go por su eficiencia concurrente, Databricks como núcleo de inteligencia de datos, Node.js para orquestación de notificaciones y React/Shadcn UI para la interfaz visual. Todo el sistema está diseñado para ser desplegado de forma segura bajo la gobernanza de Unity Catalog.

# 2.Arquitectura
## A. Sentinel Ingestor (Go)
Objetivo: Simular un flujo masivo de datos hacia la nube.
Implementación:
Uso de goroutines y channels para paralelizar el envío de métricas simuladas.
Conexión a Databricks mediante el driver oficial de SQL para Go.
Docker: Construcción multi-stage usando golang:alpine para un binario ligero.
Escalabilidad: Configurar HorizontalPodAutoscaler (HPA) en Kubernetes basado en CPU para este servicio.
## B. Sentinel Brain (Databricks App / Python FastAPI)
Objetivo: Procesar datos y predecir anomalías mediante IA.
Implementación:
Backend desarrollado en FastAPI cargando un modelo de Isolation Forest (Scikit-learn) durante el evento lifespan.
Configuración de app.yaml para despliegue directo en el serverless de Databricks.31
Validación estricta de esquemas de datos usando Pydantic.15
Gobernanza: Implementar autenticación M2M para consultar tablas de Unity Catalog.
## C. Sentinel Alerter (Node.js)
Objetivo: Orquestar notificaciones y webhooks.
Implementación:
Servidor con Express o NestJS que recibe alertas del Brain.
Gestión asíncrona de eventos para no bloquear el loop de ejecución en picos de tráfico.
D. Sentinel Dashboard (React + Shadcn UI)
Objetivo: Interfaz de usuario "Data-First".
Implementación:
Uso de Shadcn UI para componentes de tablas (DataTable) y visualización de estados (Skeletons/Badges) .
Integración de Recharts para gráficos temporales de métricas.
Patrón de diseño de "layout shell" para mantener estabilidad en cambios de ruta.
