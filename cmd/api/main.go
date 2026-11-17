package main

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/legaleagle/backend/db/seed"
	"github.com/legaleagle/backend/docs"
	"github.com/legaleagle/backend/internal/config"
	"github.com/legaleagle/backend/internal/platform/database"
	"github.com/legaleagle/backend/internal/platform/logger"
	"github.com/legaleagle/backend/internal/server"
	"github.com/legaleagle/backend/internal/workers"
)

// @title Legal Eagle Backend API
// @version 1.0.0
// @description Modular monolith Go + PostgreSQL backend for Legal Eagle.
// @host localhost:8080
// @BasePath /api/v1
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
func main() {
	cfg := config.Load()
	log := logger.New(cfg.AppEnv)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	store, err := database.NewStore(ctx, cfg, log)
	if err != nil {
		log.Error("failed to initialize database store", "err", err)
		os.Exit(1)
	}
	defer store.Close()

	if cfg.AutoMigrate {
		if err := store.RunMigrations(ctx, "db/migrations/001_initial_schema.up.sql"); err != nil {
			log.Warn("migration warning", "err", err)
		}
	}

	if cfg.AutoSeed {
		if err := seed.Populate(store); err != nil {
			log.Error("failed to seed initial data", "err", err)
			os.Exit(1)
		}
		log.Info("seed data loaded", "lawyers", len(store.Lawyers), "firms", len(store.Firms), "slots", len(store.Slots))
	}

	bundle := server.NewRouter(cfg, store)

	if cfg.EmbedWorker {
		worker := workers.NewCoordinator(store, bundle.BookingSvc, log, cfg.WorkerPollInterval)
		go worker.Start(ctx)
	}

	ln, activePort, bindErr := listenAvailablePort(cfg.Port, log)
	if bindErr != nil {
		log.Error("HTTP server failed to bind port", "err", bindErr)
		os.Exit(1)
	}
	cfg.Port = activePort
	docs.SwaggerInfo.Host = "localhost:" + activePort

	srv := &http.Server{
		Addr:         ":" + activePort,
		Handler:      bundle.Router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Info("Legal Eagle Go API listening",
			"addr", "http://localhost:"+activePort,
			"swagger", "http://localhost:"+activePort+"/swagger/index.html",
		)
		if err := srv.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("HTTP server failed", "err", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	log.Info("shutting down Legal Eagle API gracefully...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
}

func listenAvailablePort(preferredPort string, log interface{ Warn(string, ...any) }) (net.Listener, string, error) {
	basePort, err := strconv.Atoi(preferredPort)
	if err != nil {
		basePort = 8080
	}
	for offset := 0; offset < 10; offset++ {
		p := strconv.Itoa(basePort + offset)
		ln, err := net.Listen("tcp", ":"+p)
		if err == nil {
			if offset > 0 {
				log.Warn("port "+preferredPort+" was already in use; automatically bound to next free port", "port", p)
			}
			return ln, p, nil
		}
	}
	return nil, "", fmt.Errorf("no free port found in range %d-%d", basePort, basePort+9)
}

