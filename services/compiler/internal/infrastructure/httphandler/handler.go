// Package httphandler contains the Echo HTTP handlers for the compiler service.
//
// Routes:
//
//	POST /v1/compile        — compile an Intent IR to a target
//	POST /v1/compile/test   — compile then run fixtures
//	GET  /v1/intents        — list built-in controls
//	GET  /healthz           — liveness probe
package httphandler

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/egide/egide/services/compiler/internal/application"
	"github.com/egide/egide/services/compiler/internal/domain"
	"github.com/egide/egide/services/compiler/internal/generators/rego/controls"
)

// Handler holds injected use-cases.
type Handler struct {
	compileUC *application.CompileUseCase
}

// New constructs the handler.
func New(compileUC *application.CompileUseCase) *Handler {
	return &Handler{compileUC: compileUC}
}

// Register mounts all routes.
func (h *Handler) Register(e *echo.Echo) {
	e.GET("/healthz", h.healthz)
	v1 := e.Group("/v1")
	v1.POST("/compile", h.compile)
	v1.POST("/compile/test", h.compileTest)
	v1.GET("/intents", h.listIntents)
}

// ── POST /v1/compile ──────────────────────────────────────────────────────────

type compileRequest struct {
	Intent *domain.Intent `json:"intent"`
	Target string         `json:"target"`
}

func (h *Handler) compile(c echo.Context) error {
	var req compileRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
	}
	if req.Intent == nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "intent is required"})
	}
	if req.Target == "" {
		req.Target = "rego"
	}

	artifact, err := h.compileUC.Compile(c.Request().Context(), application.CompileRequest{
		Intent: req.Intent,
		Target: domain.Target(req.Target),
	})
	if err != nil {
		c.Logger().Errorf("compile: %v", err)
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, artifact)
}

// ── POST /v1/compile/test ─────────────────────────────────────────────────────

func (h *Handler) compileTest(c echo.Context) error {
	var req compileRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
	}
	if req.Intent == nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "intent is required"})
	}
	if req.Target == "" {
		req.Target = "rego"
	}

	artifact, err := h.compileUC.Compile(c.Request().Context(), application.CompileRequest{
		Intent: req.Intent,
		Target: domain.Target(req.Target),
	})
	if err != nil {
		c.Logger().Errorf("compile/test compile step: %v", err)
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	results, err := h.compileUC.Test(c.Request().Context(), artifact, req.Intent)
	if err != nil {
		c.Logger().Errorf("compile/test test step: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	passed := 0
	for _, r := range results {
		if r.Passed {
			passed++
		}
	}
	artifact.TestsPassed = passed
	artifact.TestsTotal = len(results)

	return c.JSON(http.StatusOK, map[string]any{
		"artifact": artifact,
		"results":  results,
		"passed":   passed == len(results),
	})
}

// ── GET /v1/intents ───────────────────────────────────────────────────────────

func (h *Handler) listIntents(c echo.Context) error {
	type summary struct {
		ID       string `json:"id"`
		Title    string `json:"title"`
		Severity string `json:"severity"`
		Version  string `json:"version"`
	}
	builtins := controls.All()
	out := make([]summary, len(builtins))
	for i, intent := range builtins {
		out[i] = summary{
			ID:       intent.ID,
			Title:    intent.Title,
			Severity: string(intent.Severity),
			Version:  intent.Version,
		}
	}
	return c.JSON(http.StatusOK, map[string]any{"intents": out, "total": len(out)})
}

// ── GET /healthz ──────────────────────────────────────────────────────────────

func (h *Handler) healthz(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}
