// Package docs contains the generated Swagger 2.0 specification for the Legal Eagle Go API.
package docs

import "github.com/swaggo/swag"

const docTemplate = `{
    "schemes": {{ marshal .Schemes }},
    "swagger": "2.0",
    "info": {
        "description": "{{escape .Description}}",
        "title": "{{.Title}}",
        "contact": {
            "name": "Legal Eagle Engineering"
        },
        "version": "{{.Version}}"
    },
    "host": "{{.Host}}",
    "basePath": "{{.BasePath}}",
    "securityDefinitions": {
        "BearerAuth": {
            "type": "apiKey",
            "name": "Authorization",
            "in": "header",
            "description": "Type 'Bearer <JWT>' to authenticate"
        }
    },
    "paths": {
        "/auth/register": {
            "post": {
                "tags": ["Authentication"],
                "summary": "Register a new Client, Lawyer, or Law Firm account",
                "consumes": ["application/json"],
                "produces": ["application/json"],
                "responses": {
                    "201": {"description": "Created"},
                    "400": {"description": "Bad Request"},
                    "409": {"description": "Conflict"}
                }
            }
        },
        "/auth/login": {
            "post": {
                "tags": ["Authentication"],
                "summary": "Authenticate with email and Argon2id password",
                "consumes": ["application/json"],
                "produces": ["application/json"],
                "responses": {
                    "200": {"description": "OK"},
                    "401": {"description": "Unauthorized"}
                }
            }
        },
        "/auth/refresh": {
            "post": {
                "tags": ["Authentication"],
                "summary": "Rotate refresh session and issue a new short-lived access token",
                "produces": ["application/json"],
                "responses": {
                    "200": {"description": "OK"},
                    "401": {"description": "Unauthorized"}
                }
            }
        },
        "/auth/logout": {
            "post": {
                "tags": ["Authentication"],
                "summary": "Revoke current refresh session and clear cookies",
                "produces": ["application/json"],
                "responses": {
                    "200": {"description": "OK"}
                }
            }
        },
        "/auth/me": {
            "get": {
                "security": [{"BearerAuth": []}],
                "tags": ["Authentication"],
                "summary": "Return currently authenticated user",
                "produces": ["application/json"],
                "responses": {
                    "200": {"description": "OK"},
                    "401": {"description": "Unauthorized"}
                }
            }
        },
        "/lawyers": {
            "get": {
                "tags": ["Discovery"],
                "summary": "Search and paginate lawyers by practice area, city, experience, and keyword",
                "produces": ["application/json"],
                "parameters": [
                    {"name": "q", "in": "query", "type": "string"},
                    {"name": "practice", "in": "query", "type": "string"},
                    {"name": "city", "in": "query", "type": "string"},
                    {"name": "minExp", "in": "query", "type": "integer"},
                    {"name": "maxExp", "in": "query", "type": "integer"},
                    {"name": "page", "in": "query", "type": "integer"},
                    {"name": "pageSize", "in": "query", "type": "integer"}
                ],
                "responses": {"200": {"description": "OK"}}
            }
        },
        "/lawyers/{id}": {
            "get": {
                "tags": ["Profiles"],
                "summary": "Get public lawyer profile by ID",
                "produces": ["application/json"],
                "parameters": [{"name": "id", "in": "path", "required": true, "type": "string"}],
                "responses": {"200": {"description": "OK"}, "404": {"description": "Not Found"}}
            }
        },
        "/lawyers/me": {
            "patch": {
                "security": [{"BearerAuth": []}],
                "tags": ["Profiles"],
                "summary": "Update authenticated lawyer's own profile",
                "consumes": ["application/json"],
                "produces": ["application/json"],
                "responses": {"200": {"description": "OK"}, "403": {"description": "Forbidden"}}
            }
        },
        "/firms": {
            "get": {
                "tags": ["Discovery"],
                "summary": "Search and paginate law firms",
                "produces": ["application/json"],
                "responses": {"200": {"description": "OK"}}
            }
        },
        "/firms/{id}": {
            "get": {
                "tags": ["Firms"],
                "summary": "Get public law firm profile and active team directory",
                "produces": ["application/json"],
                "parameters": [{"name": "id", "in": "path", "required": true, "type": "string"}],
                "responses": {"200": {"description": "OK"}, "404": {"description": "Not Found"}}
            }
        },
        "/lawyers/{id}/availability": {
            "get": {
                "tags": ["Availability"],
                "summary": "Get lawyer consultation settings and 60-minute availability slots",
                "produces": ["application/json"],
                "parameters": [
                    {"name": "id", "in": "path", "required": true, "type": "string"},
                    {"name": "date", "in": "query", "type": "string"}
                ],
                "responses": {"200": {"description": "OK"}}
            }
        },
        "/lawyers/me/availability/rules": {
            "put": {
                "security": [{"BearerAuth": []}],
                "tags": ["Availability"],
                "summary": "Update lawyer consultation fee, modes, working days/hours, and lead time",
                "consumes": ["application/json"],
                "produces": ["application/json"],
                "responses": {"200": {"description": "OK"}}
            }
        },
        "/lawyers/me/availability/exceptions": {
            "post": {
                "security": [{"BearerAuth": []}],
                "tags": ["Availability"],
                "summary": "Block/unblock holiday dates or add/remove 60-minute slots",
                "consumes": ["application/json"],
                "produces": ["application/json"],
                "responses": {"200": {"description": "OK"}}
            }
        },
        "/booking-holds": {
            "post": {
                "security": [{"BearerAuth": []}],
                "tags": ["Bookings"],
                "summary": "Create a 10-minute slot hold and booking in PAYMENT_PENDING",
                "consumes": ["application/json"],
                "produces": ["application/json"],
                "responses": {"201": {"description": "Created"}, "409": {"description": "Conflict"}}
            }
        },
        "/bookings/me": {
            "get": {
                "security": [{"BearerAuth": []}],
                "tags": ["Bookings"],
                "summary": "List consultations for authenticated client or lawyer",
                "produces": ["application/json"],
                "responses": {"200": {"description": "OK"}}
            }
        },
        "/bookings/{id}": {
            "get": {
                "security": [{"BearerAuth": []}],
                "tags": ["Bookings"],
                "summary": "Get consultation booking details (enforces ownership)",
                "produces": ["application/json"],
                "parameters": [{"name": "id", "in": "path", "required": true, "type": "string"}],
                "responses": {"200": {"description": "OK"}, "403": {"description": "Forbidden"}}
            }
        },
        "/bookings/{id}/accept": {
            "post": {
                "security": [{"BearerAuth": []}],
                "tags": ["Bookings"],
                "summary": "Assigned lawyer accepts booking (AWAITING_LAWYER -> CONFIRMED)",
                "produces": ["application/json"],
                "parameters": [{"name": "id", "in": "path", "required": true, "type": "string"}],
                "responses": {"200": {"description": "OK"}}
            }
        },
        "/bookings/{id}/decline": {
            "post": {
                "security": [{"BearerAuth": []}],
                "tags": ["Bookings"],
                "summary": "Assigned lawyer declines booking and initiates 100% full refund",
                "consumes": ["application/json"],
                "produces": ["application/json"],
                "parameters": [{"name": "id", "in": "path", "required": true, "type": "string"}],
                "responses": {"200": {"description": "OK"}}
            }
        },
        "/bookings/{id}/reschedule-proposals": {
            "post": {
                "security": [{"BearerAuth": []}],
                "tags": ["Bookings"],
                "summary": "Assigned lawyer proposes an alternative 1-hour slot",
                "consumes": ["application/json"],
                "produces": ["application/json"],
                "parameters": [{"name": "id", "in": "path", "required": true, "type": "string"}],
                "responses": {"200": {"description": "OK"}}
            }
        },
        "/bookings/{id}/reschedule-proposals/{proposalId}/accept": {
            "post": {
                "security": [{"BearerAuth": []}],
                "tags": ["Bookings"],
                "summary": "Client accepts reschedule proposal (no extra charge)",
                "produces": ["application/json"],
                "parameters": [
                    {"name": "id", "in": "path", "required": true, "type": "string"},
                    {"name": "proposalId", "in": "path", "required": true, "type": "string"}
                ],
                "responses": {"200": {"description": "OK"}}
            }
        },
        "/bookings/{id}/reschedule-proposals/{proposalId}/reject": {
            "post": {
                "security": [{"BearerAuth": []}],
                "tags": ["Bookings"],
                "summary": "Client rejects reschedule proposal and initiates full refund",
                "produces": ["application/json"],
                "parameters": [
                    {"name": "id", "in": "path", "required": true, "type": "string"},
                    {"name": "proposalId", "in": "path", "required": true, "type": "string"}
                ],
                "responses": {"200": {"description": "OK"}}
            }
        },
        "/payments/orders": {
            "post": {
                "security": [{"BearerAuth": []}],
                "tags": ["Payments"],
                "summary": "Create a payment order for an unexpired booking hold",
                "consumes": ["application/json"],
                "produces": ["application/json"],
                "responses": {"201": {"description": "Created"}}
            }
        },
        "/payments/{id}": {
            "get": {
                "security": [{"BearerAuth": []}],
                "tags": ["Payments"],
                "summary": "Get payment transaction details",
                "produces": ["application/json"],
                "parameters": [{"name": "id", "in": "path", "required": true, "type": "string"}],
                "responses": {"200": {"description": "OK"}}
            }
        },
        "/webhooks/razorpay": {
            "post": {
                "tags": ["Payments"],
                "summary": "Verify signed payment webhook and transition payment/booking atomically",
                "consumes": ["application/json"],
                "produces": ["application/json"],
                "parameters": [{"name": "X-Razorpay-Signature", "in": "header", "required": true, "type": "string"}],
                "responses": {"200": {"description": "OK"}, "401": {"description": "Unauthorized"}}
            }
        },
        "/refunds/{id}": {
            "get": {
                "security": [{"BearerAuth": []}],
                "tags": ["Payments"],
                "summary": "Get refund status by refund ID or booking ID",
                "produces": ["application/json"],
                "parameters": [{"name": "id", "in": "path", "required": true, "type": "string"}],
                "responses": {"200": {"description": "OK"}}
            }
        },
        "/notifications": {
            "get": {
                "security": [{"BearerAuth": []}],
                "tags": ["Notifications"],
                "summary": "List in-app notifications for authenticated user",
                "produces": ["application/json"],
                "responses": {"200": {"description": "OK"}}
            }
        },
        "/notifications/{id}/read": {
            "patch": {
                "security": [{"BearerAuth": []}],
                "tags": ["Notifications"],
                "summary": "Mark notification as read",
                "produces": ["application/json"],
                "parameters": [{"name": "id", "in": "path", "required": true, "type": "string"}],
                "responses": {"200": {"description": "OK"}}
            }
        },
        "/notifications/read-all": {
            "patch": {
                "security": [{"BearerAuth": []}],
                "tags": ["Notifications"],
                "summary": "Mark all notifications as read",
                "produces": ["application/json"],
                "responses": {"200": {"description": "OK"}}
            }
        }
    }
}`

// SwaggerInfo holds exported Swagger Info so clients can modify it.
var SwaggerInfo = &swag.Spec{
	Version:          "1.0.0",
	Host:             "localhost:8080",
	BasePath:         "/api/v1",
	Schemes:          []string{"http"},
	Title:            "Legal Eagle Backend API",
	Description:      "Modular monolith Go + PostgreSQL backend for Legal Eagle: lawyer/firm discovery, 1-hour consultation booking holds, server-verified payments, rescheduling, full refunds, and notifications.",
	InfoInstanceName: "swagger",
	SwaggerTemplate:  docTemplate,
}

func init() {
	swag.Register(SwaggerInfo.InstanceName(), SwaggerInfo)
}

