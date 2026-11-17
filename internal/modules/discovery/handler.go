package discovery

import (
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/legaleagle/backend/internal/platform/database"
	"github.com/legaleagle/backend/internal/shared"
)

type Handler struct {
	store *database.Store
}

func NewHandler(store *database.Store) *Handler {
	return &Handler{store: store}
}

// GetPracticeAreas godoc
// @Summary List all legal practice areas
// @Tags Discovery
// @Produce json
// @Success 200 {array} sqlcgen.PracticeArea
// @Router /practice-areas [get]
func (h *Handler) GetPracticeAreas(c *gin.Context) {
	c.JSON(http.StatusOK, h.store.PracticeAreas)
}

// SearchLawyers godoc
// @Summary Search and paginate lawyers by keyword, practice area, city, and experience
// @Tags Discovery
// @Produce json
// @Param q query string false "Keyword (name, headline, city, firm)"
// @Param practice query string false "Practice area slug"
// @Param city query string false "City filter"
// @Param minExp query int false "Minimum years of experience"
// @Param maxExp query int false "Maximum years of experience"
// @Param page query int false "Page number (default 1)"
// @Param pageSize query int false "Page size (default 6)"
// @Success 200 {object} map[string]any
// @Router /lawyers [get]
func (h *Handler) SearchLawyers(c *gin.Context) {
	q := strings.ToLower(strings.TrimSpace(c.Query("q")))
	practice := strings.TrimSpace(c.Query("practice"))
	city := strings.TrimSpace(c.Query("city"))
	minExpStr := strings.TrimSpace(c.Query("minExp"))
	maxExpStr := strings.TrimSpace(c.Query("maxExp"))
	page := parsePositiveInt(c.Query("page"), 1)
	pageSize := parsePositiveInt(c.Query("pageSize"), 6)

	var minExp, maxExp *int
	if minExpStr != "" {
		if v, err := strconv.Atoi(minExpStr); err == nil {
			minExp = &v
		}
	}
	if maxExpStr != "" {
		if v, err := strconv.Atoi(maxExpStr); err == nil {
			maxExp = &v
		}
	}

	var matched []shared.LawyerSummaryDTO
	for _, l := range h.store.Lawyers {
		if !l.IsActive {
			continue
		}
		if practice != "" && !containsSlug(l.PracticeAreas, practice) {
			continue
		}
		if city != "" && !strings.EqualFold(l.City, city) {
			continue
		}
		if minExp != nil && l.ExperienceYears < *minExp {
			continue
		}
		if maxExp != nil && l.ExperienceYears > *maxExp {
			continue
		}
		summary := shared.BuildLawyerSummary(h.store, l)
		if q != "" {
			firmName := ""
			if summary.Firm != nil {
				firmName = summary.Firm.Name
			}
			haystack := strings.ToLower(strings.Join(append([]string{l.Name, l.Headline, l.City, firmName}, l.PracticeAreas...), " "))
			if !strings.Contains(haystack, q) {
				continue
			}
		}
		matched = append(matched, summary)
	}

	sort.Slice(matched, func(i, j int) bool {
		return matched[i].Name < matched[j].Name
	})

	total := len(matched)
	totalPages := int(math.Max(1, math.Ceil(float64(total)/float64(pageSize))))
	if page > totalPages {
		page = totalPages
	}
	start := (page - 1) * pageSize
	end := start + pageSize
	if start > total {
		start = total
	}
	if end > total {
		end = total
	}

	c.JSON(http.StatusOK, gin.H{
		"items":      matched[start:end],
		"total":      total,
		"page":       page,
		"pageSize":   pageSize,
		"totalPages": totalPages,
	})
}

// SearchFirms godoc
// @Summary Search and paginate law firms by keyword, practice area, and city
// @Tags Discovery
// @Produce json
// @Param q query string false "Keyword"
// @Param practice query string false "Practice area slug"
// @Param city query string false "City filter"
// @Param page query int false "Page number (default 1)"
// @Param pageSize query int false "Page size (default 6)"
// @Success 200 {object} map[string]any
// @Router /firms [get]
func (h *Handler) SearchFirms(c *gin.Context) {
	q := strings.ToLower(strings.TrimSpace(c.Query("q")))
	practice := strings.TrimSpace(c.Query("practice"))
	city := strings.TrimSpace(c.Query("city"))
	page := parsePositiveInt(c.Query("page"), 1)
	pageSize := parsePositiveInt(c.Query("pageSize"), 6)

	var matched []shared.FirmSummaryDTO
	for _, f := range h.store.Firms {
		if practice != "" && !containsSlug(f.PracticeAreas, practice) {
			continue
		}
		if city != "" && !strings.EqualFold(f.City, city) {
			continue
		}
		if q != "" {
			haystack := strings.ToLower(strings.Join(append([]string{f.Name, f.City, f.About}, f.PracticeAreas...), " "))
			if !strings.Contains(haystack, q) {
				continue
			}
		}
		matched = append(matched, shared.BuildFirmSummary(h.store, f))
	}

	sort.Slice(matched, func(i, j int) bool {
		return matched[i].Name < matched[j].Name
	})

	total := len(matched)
	totalPages := int(math.Max(1, math.Ceil(float64(total)/float64(pageSize))))
	if page > totalPages {
		page = totalPages
	}
	start := (page - 1) * pageSize
	end := start + pageSize
	if start > total {
		start = total
	}
	if end > total {
		end = total
	}

	c.JSON(http.StatusOK, gin.H{
		"items":      matched[start:end],
		"total":      total,
		"page":       page,
		"pageSize":   pageSize,
		"totalPages": totalPages,
	})
}

// GetDiscoverData returns homepage practice area counts and neutral featured samples.
func (h *Handler) GetDiscoverData(c *gin.Context) {
	counts := make(map[string]int, len(h.store.PracticeAreas))
	for _, pa := range h.store.PracticeAreas {
		counts[pa.Slug] = 0
	}
	var lawyers []shared.LawyerSummaryDTO
	for _, l := range h.store.Lawyers {
		for _, slug := range l.PracticeAreas {
			counts[slug]++
		}
		lawyers = append(lawyers, shared.BuildLawyerSummary(h.store, l))
	}
	sort.Slice(lawyers, func(i, j int) bool {
		return lawyers[i].ID < lawyers[j].ID
	})
	if len(lawyers) > 4 {
		lawyers = lawyers[:4]
	}

	var firms []shared.FirmSummaryDTO
	for _, f := range h.store.Firms {
		firms = append(firms, shared.BuildFirmSummary(h.store, f))
	}
	sort.Slice(firms, func(i, j int) bool {
		return firms[i].ID < firms[j].ID
	})
	if len(firms) > 3 {
		firms = firms[:3]
	}

	c.JSON(http.StatusOK, gin.H{
		"practiceCounts": counts,
		"lawyers":        lawyers,
		"firms":          firms,
		"totals": gin.H{
			"lawyers":       len(h.store.Lawyers),
			"firms":         len(h.store.Firms),
			"practiceAreas": len(h.store.PracticeAreas),
		},
	})
}

func containsSlug(list []string, target string) bool {
	for _, item := range list {
		if strings.EqualFold(item, target) {
			return true
		}
	}
	return false
}

func parsePositiveInt(val string, fallback int) int {
	if n, err := strconv.Atoi(strings.TrimSpace(val)); err == nil && n > 0 {
		return n
	}
	return fallback
}

