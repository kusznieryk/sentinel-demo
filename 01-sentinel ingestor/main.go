package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	_ "github.com/databricks/databricks-sql-go"
	"github.com/joho/godotenv"
)

type Telemetry struct {
	EventSource   string
	Payload       string
	CorrelationID string
	ingestedAt   time.Time
}

func main() {
	err := godotenv.Load()

	token := os.Getenv("DATABRICKS_TOKEN")
	host := os.Getenv("DATABRICKS_HOST")
	httpPath := os.Getenv("DATABRICKS_HTTP_PATH")

	dsn := fmt.Sprintf(
		"token:%s@%s:443%s",
		token,
		host,
		httpPath,
	)

	db, err := sql.Open("databricks", dsn)
	if err != nil {
		panic(err)
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	defer db.Close()
	if err := db.Ping(); err != nil {
		log.Fatalf("No se puede conectar a Databricks SQL Warehouse: %v", err)
	}
	fmt.Println("Ingestor conectado exitosamente a Databricks")

	ctx, cancel := context.WithCancel(context.Background())
	var wg sync.WaitGroup

	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-ctx.Done():
				fmt.Println("Ingestor detenido")
				return
			default:
				telemetry := Telemetry{
					EventSource:   "fake_source",
					Payload:       generateFakeMetric(),
					CorrelationID: fmt.Sprintf("%d", rand.Int()),
					ingestedAt:   time.Now(),
				}
				err := insertTelemetry(db, telemetry)
				if err != nil {
					log.Printf("Error en inserción: %v", err)
				}
				time.Sleep(1 * time.Second)
			}
		}
	}()

	<-stopChan
	cancel()
	wg.Wait()
	fmt.Println("Ingestor detenido.")
}

func insertTelemetry(db *sql.DB, t Telemetry) error {
	query := `INSERT INTO bronze.raw_telemetry (event_source, payload, correlation_id, ingested_at) VALUES (?,?,?,?)`
	_, err := db.Exec(query, t.EventSource, t.Payload, t.CorrelationID, t.ingestedAt)
	return err
}

func generateFakeMetric() string {
	metrics := map[string]interface{}{
		"cpu_usage":    rand.Float64() * 100,
		"memory_usage": rand.Float64() * 100,
		"timestamp":    time.Now().Format(time.RFC3339),
	}
	bytes, _ := json.Marshal(metrics)
	return string(bytes)
}
