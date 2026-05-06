// Validator service entry point.
//
// Starts the Echo HTTP server on port 8002.
// Dependencies are wired here (composition root — cf. ADR 015 hexagonal).
package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"github.com/egide/egide/services/validator/internal/application"
	"github.com/egide/egide/services/validator/internal/domain"
	"github.com/egide/egide/services/validator/internal/infrastructure/httphandler"
	"github.com/egide/egide/services/validator/internal/infrastructure/postgres"
	"github.com/egide/egide/services/validator/internal/rules"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://egide:egide@localhost:5432/egide?sslmode=disable"
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8002"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pg, err := postgres.New(ctx, dsn)
	if err != nil {
		fmt.Fprintf(os.Stderr, "validator: DB connect: %v\n", err)
		os.Exit(1)
	}
	defer pg.Close()

	engine := domain.NewEngine(rules.All())

	validateUC := application.NewValidateUseCase(pg, engine)
	ragUC := application.NewRAGUseCase(pg)

	e := echo.New()
	e.HideBanner = true
	e.Use(middleware.Recover())
	e.Use(middleware.RequestID())
	e.Use(middleware.Logger())
	e.Use(middleware.SecureWithConfig(middleware.SecureConfig{
		XSSProtection:         "1; mode=block",
		ContentTypeNosniff:    "nosniff",
		XFrameOptions:         "DENY",
		HSTSMaxAge:            31536000,
		ContentSecurityPolicy: "default-src 'none'",
	}))

	h := httphandler.New(validateUC, ragUC)
	h.Register(e)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-quit
		shutCtx, shutCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer shutCancel()
		if err := e.Shutdown(shutCtx); err != nil {
			fmt.Fprintf(os.Stderr, "validator: shutdown error: %v\n", err)
		}
	}()

	fmt.Fprintf(os.Stdout, "validator: listening on :%s\n", port)
	if err := e.Start(":" + port); err != nil && err != http.ErrServerClosed {
		fmt.Fprintf(os.Stderr, "validator: server error: %v\n", err)
		os.Exit(1)
	}
}
