package shared

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

// AppError represents a structured domain/service error with an HTTP status code.
type AppError struct {
	Status  int    `json:"status"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *AppError) Error() string {
	return e.Message
}

func NewBadRequest(msg string) *AppError {
	return &AppError{Status: http.StatusBadRequest, Code: "BAD_REQUEST", Message: msg}
}

func NewUnauthorized(msg string) *AppError {
	return &AppError{Status: http.StatusUnauthorized, Code: "UNAUTHORIZED", Message: msg}
}

func NewForbidden(msg string) *AppError {
	return &AppError{Status: http.StatusForbidden, Code: "FORBIDDEN", Message: msg}
}

func NewNotFound(msg string) *AppError {
	return &AppError{Status: http.StatusNotFound, Code: "NOT_FOUND", Message: msg}
}

func NewConflict(msg string) *AppError {
	return &AppError{Status: http.StatusConflict, Code: "CONFLICT", Message: msg}
}

// RespondError writes a consistent JSON error envelope to the Gin response.
func RespondError(c *gin.Context, err error) {
	var appErr *AppError
	if errors.As(err, &appErr) {
		c.JSON(appErr.Status, gin.H{
			"error":   appErr.Code,
			"message": appErr.Message,
			"status":  appErr.Status,
		})
		return
	}
	c.JSON(http.StatusInternalServerError, gin.H{
		"error":   "INTERNAL_ERROR",
		"message": err.Error(),
		"status":  http.StatusInternalServerError,
	})
}

