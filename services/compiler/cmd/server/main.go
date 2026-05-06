// Package main — Egide policy compiler entry point.
//
// Starts the Echo HTTP server on port 8003.
// Composition root: wires generators → use cases → handlers.
// cf. ADR 005 (Rego only at MVP), ADR 015 (hexagonal).
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

	"github.com/egide/egide/services/compiler/internal/application"
	"github.com/egide/egide/services/compiler/internal/generators/rego"
	"github.com/egide/egide/services/compiler/internal/infrastructure/httphandler"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8003"
	}

	// Wire the Rego generator (only target at MVP)
	regoGen := rego.New()
	compileUC := application.NewCompileUseCase(regoGen)

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

	h := httphandler.New(compileUC)
	h.Register(e)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-quit
		shutCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := e.Shutdown(shutCtx); err != nil {
			fmt.Fprintf(os.Stderr, "compiler: shutdown error: %v\n", err)
		}
	}()

	fmt.Fprintf(os.Stdout, "compiler: listening on :%s\n", port)
	if err := e.Start(":" + port); err != nil && err != http.ErrServerClosed {
		fmt.Fprintf(os.Stderr, "compiler: server error: %v\n", err)
		os.Exit(1)
	}
}
