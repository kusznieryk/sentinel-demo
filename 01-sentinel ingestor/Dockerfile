# ETAPA 1: Compilación (Build)
# Usamos alpine para que el entorno de construcción sea liviano
FROM golang:1.25-alpine AS builder

# Instalamos certificados (necesarios para conectar con Databricks vía TLS/HTTPS)
RUN apk --no-cache add ca-certificates

# Definimos el directorio de trabajo
WORKDIR /app

# Copiamos los archivos de dependencias primero para aprovechar el cache de Docker
COPY go.mod go.sum ./
RUN go mod download

# Copiamos el resto del código fuente
COPY . .

# Compilamos el binario de forma estática
# CGO_ENABLED=0 asegura que no dependa de librerías de C del sistema
RUN CGO_ENABLED=0 GOOS=linux go build -o ingestor main.go

# ETAPA 2: Ejecución (Runtime)
# Usamos una imagen base mínima (Alpine es ideal para esto)
FROM alpine:latest

# Copiamos los certificados de la etapa anterior
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Definimos el directorio de trabajo
WORKDIR /root/

# Copiamos solo el binario compilado desde la etapa 'builder'
COPY --from=builder /app/ingestor ./ingestor

# Ejecutamos el ingestor
CMD ["./ingestor"]