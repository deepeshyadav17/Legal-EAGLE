package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/legaleagle/backend/db/seed"
	"github.com/legaleagle/backend/internal/config"
	"github.com/legaleagle/backend/internal/modules/bookings"
	"github.com/legaleagle/backend/internal/modules/payments"
	"github.com/legaleagle/backend/internal/platform/database"
	"github.com/legaleagle/backend/internal/platform/logger"
	"github.com/legaleagle/backend/internal/workers"
)

func main() {
	cfg := config.Load()
	log := logger.New(cfg.AppEnv)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	store, err := database.NewStore(ctx, cfg, log)
	if err != nil {
		log.Error("failed to initialize store", "err", err)
		os.Exit(1)
	}
	defer store.Close()

	if cfg.AutoSeed {
		_ = seed.Populate(store)
	}

	paymentSvc := payments.NewService(store, cfg)
	bookingSvc := bookings.NewService(store, paymentSvc, cfg)
	worker := workers.NewCoordinator(store, bookingSvc, log, cfg.WorkerPollInterval)

	worker.Start(ctx)
}

