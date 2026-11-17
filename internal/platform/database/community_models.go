package database

import "time"

type AdvocateVerification struct {
	ProfileID       string     `json:"profileId"`
	BarCouncil      string     `json:"barCouncil"`
	EnrollmentNumber string   `json:"enrollmentNumber"`
	Status          string     `json:"status"`
	SubmittedAt     time.Time  `json:"submittedAt"`
	ReviewedAt      *time.Time `json:"reviewedAt,omitempty"`
	ReviewedBy      string     `json:"-"`
}

type DirectConversation struct {
	ID           string    `json:"id"`
	ParticipantA string    `json:"-"`
	ParticipantB string    `json:"-"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type DirectMessage struct {
	ID             string    `json:"id"`
	ConversationID string    `json:"conversationId"`
	SenderProfileID string   `json:"senderProfileId"`
	Body           string    `json:"body"`
	CreatedAt      time.Time `json:"createdAt"`
}
