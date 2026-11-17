package main

import (
	"context"
	"flag"
	"os"

	"github.com/legaleagle/backend/db/seed"
	"github.com/legaleagle/backend/internal/config"
	"github.com/legaleagle/backend/internal/platform/database"
	"github.com/legaleagle/backend/internal/platform/logger"
)

func main() {
	direction := flag.String("dir", "up", "Migration direction: up or down")
	withSeed := flag.Bool("seed", true, "Populate demo seed data after up migration")
	flag.Parse()

	cfg := config.Load()
	log := logger.New(cfg.AppEnv)
	ctx := context.Background()

	store, err := database.NewStore(ctx, cfg, log)
	if err != nil {
		log.Error("failed to initialize database connection", "err", err)
		os.Exit(1)
	}
	defer store.Close()

	migrationFile := "db/migrations/001_initial_schema.up.sql"
	if *direction == "down" {
		migrationFile = "db/migrations/001_initial_schema.down.sql"
	}

	if err := store.RunMigrations(ctx, migrationFile); err != nil {
		log.Error("migration failed", "file", migrationFile, "err", err)
		os.Exit(1)
	}

	if *direction == "up" && *withSeed {
		if err := seed.Populate(store); err != nil {
			log.Error("seed failed", "err", err)
			os.Exit(1)
		}
		log.Info("PostgreSQL migration and seed completed successfully")
	}
}

