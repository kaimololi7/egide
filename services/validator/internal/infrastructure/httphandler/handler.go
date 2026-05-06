// Package httphandler contains the Echo HTTP handlers for the validator service.
//
// Routes:
//
//	POST /v1/validate        — run the 25 rules over a pyramid
//	GET  /v1/rag/search      — full-text / pgvector search over ontology_chunks
//	GET  /healthz            — liveness probe
package httphandler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/egide/egide/services/validator/internal/application"
	"github.com/egide/egide/services/validator/internal/domain"
)

// Handler holds the use-cases injected at startup.
type Handler struct {
	validateUC *application.ValidateUseCase
	ragUC      *application.RAGUseCase
}

// New constructs the handler.
func New(validateUC *application.ValidateUseCase, ragUC *application.RAGUseCase) *Handler {
	return &Handler{validateUC: validateUC, ragUC: ragUC}
}

// Register mounts all routes on the given Echo group.
func (h *Handler) Register(e *echo.Echo) {
	e.GET("/healthz", h.healthz)
	v1 := e.Group("/v1")
	v1.POST("/validate", h.validate)
	v1.GET("/rag/search", h.ragSearch)
}

// ── POST /v1/validate ────────────────────────────────────────────────────────

type validateRequest struct {
	TenantID    string               `json:"tenant_id"`
	PyramidID   string               `json:"pyramid_id,omitempty"`
	InlineGraph *domain.PyramidGraph `json:"graph,omitempty"`
}

func (h *Handler) validate(c echo.Context) error {
	var req validateRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
	}
	if req.TenantID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "tenant_id is required"})
	}
	if req.PyramidID == "" && req.InlineGraph == nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "pyramid_id or inline graph is required"})
	}

	result, err := h.validateUC.Execute(c.Request().Context(), application.ValidateRequest{
		TenantID:    req.TenantID,
		PyramidID:   req.PyramidID,
		InlineGraph: req.InlineGraph,
	})
	if err != nil {
		if errors.Is(err, application.ErrNotFound) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "pyramid not found"})
		}
		c.Logger().Errorf("validate: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal error"})
	}
	return c.JSON(http.StatusOK, result)
}

// ── GET /v1/rag/search ────────────────────────────────────────────────────────

func (h *Handler) ragSearch(c echo.Context) error {
	q := strings.TrimSpace(c.QueryParam("q"))
	tenantID := c.QueryParam("tenant_id")
	if q == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "q is required"})
	}
	if tenantID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "tenant_id is required"})
	}
	topK := 5
	if s := c.QueryParam("top_k"); s != "" {
		if v, err := strconv.Atoi(s); err == nil {
			topK = v
		}
	}
	var frameworks []string
	if fw := c.QueryParam("frameworks"); fw != "" {
		for _, f := range strings.Split(fw, ",") {
			f = strings.TrimSpace(f)
			if f != "" {
				frameworks = append(frameworks, f)
			}
		}
	}

	chunks, err := h.ragUC.Execute(c.Request().Context(), application.RAGSearchRequest{
		TenantID:   tenantID,
		Query:      q,
		TopK:       topK,
		Frameworks: frameworks,
	})
	if err != nil {
		c.Logger().Errorf("rag/search: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal error"})
	}
	if chunks == nil {
		chunks = []application.OntologyChunk{}
	}
	return c.JSON(http.StatusOK, map[string]any{
		"results": chunks,
		"total":   len(chunks),
	})
}

// ── GET /healthz ──────────────────────────────────────────────────────────────

func (h *Handler) healthz(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}
