package shared

import "fmt"

// Booking Statuses (Section 8)
const (
	BookingPaymentPending     = "PAYMENT_PENDING"
	BookingAwaitingLawyer     = "AWAITING_LAWYER"
	BookingRescheduleProposed = "RESCHEDULE_PROPOSED"
	BookingConfirmed          = "CONFIRMED"
	BookingCompleted          = "COMPLETED"
	BookingDeclined           = "DECLINED"
	BookingPaymentFailed      = "PAYMENT_FAILED"
	BookingExpired            = "EXPIRED"
	BookingRefundPending      = "REFUND_PENDING"
	BookingRefunded           = "REFUNDED"
)

// Payment Statuses (Section 8)
const (
	PaymentPending         = "PENDING"
	PaymentPaid            = "PAID"
	PaymentFailed          = "FAILED"
	PaymentRefundInitiated = "REFUND_INITIATED"
	PaymentRefunded        = "REFUNDED"
)

// Slot Statuses (Section 5)
const (
	SlotAvailable      = "AVAILABLE"
	SlotHeld           = "HELD"
	SlotAwaitingLawyer = "AWAITING_LAWYER"
	SlotProposed       = "PROPOSED"
	SlotConfirmed      = "CONFIRMED"
	SlotBlocked        = "BLOCKED"
)

// Notification Types (Section 11)
const (
	NotifPaymentSuccess       = "PAYMENT_SUCCESS"
	NotifPaymentFailed        = "PAYMENT_FAILED"
	NotifNewBookingRequest    = "NEW_BOOKING_REQUEST"
	NotifBookingConfirmed     = "BOOKING_CONFIRMED"
	NotifRescheduleProposed   = "RESCHEDULE_PROPOSED"
	NotifRescheduleAccepted   = "RESCHEDULE_ACCEPTED"
	NotifRescheduleRejected   = "RESCHEDULE_REJECTED"
	NotifBookingDeclined      = "BOOKING_DECLINED"
	NotifBookingExpired       = "BOOKING_EXPIRED"
	NotifRefundInitiated      = "REFUND_INITIATED"
	NotifRefundCompleted      = "REFUND_COMPLETED"
	NotifConsultationReminder = "CONSULTATION_REMINDER"
)

var allowedBookingTransitions = map[string][]string{
	BookingPaymentPending:     {BookingAwaitingLawyer, BookingPaymentFailed, BookingExpired, BookingRefundPending},
	BookingAwaitingLawyer:     {BookingConfirmed, BookingRescheduleProposed, BookingDeclined, BookingExpired, BookingRefundPending},
	BookingRescheduleProposed: {BookingConfirmed, BookingExpired, BookingRefundPending},
	BookingConfirmed:          {BookingCompleted},
	BookingDeclined:           {BookingRefundPending, BookingRefunded},
	BookingExpired:            {BookingRefundPending, BookingRefunded},
	BookingRefundPending:      {BookingRefunded},
	BookingPaymentFailed:      {},
	BookingCompleted:          {},
	BookingRefunded:           {},
}

var allowedPaymentTransitions = map[string][]string{
	PaymentPending:         {PaymentPaid, PaymentFailed},
	PaymentFailed:          {PaymentPending},
	PaymentPaid:            {PaymentRefundInitiated},
	PaymentRefundInitiated: {PaymentRefunded},
	PaymentRefunded:        {},
}

// AssertBookingTransition validates whether a booking state transition is permitted.
func AssertBookingTransition(from, to string) error {
	if from == to {
		return nil
	}
	allowed := allowedBookingTransitions[from]
	for _, target := range allowed {
		if target == to {
			return nil
		}
	}
	return NewConflict(fmt.Sprintf("invalid booking status transition from %s to %s", from, to))
}

// AssertPaymentTransition validates whether a payment state transition is permitted.
func AssertPaymentTransition(from, to string) error {
	if from == to {
		return nil
	}
	allowed := allowedPaymentTransitions[from]
	for _, target := range allowed {
		if target == to {
			return nil
		}
	}
	return NewConflict(fmt.Sprintf("invalid payment status transition from %s to %s", from, to))
}

// FrontendSlotStatus maps backend canonical slot status to the React frontend badge status.
func FrontendSlotStatus(status string) string {
	switch status {
	case SlotHeld:
		return "RESERVED"
	case SlotAwaitingLawyer:
		return "AWAITING_APPROVAL"
	case SlotBlocked:
		return "UNAVAILABLE"
	default:
		return status
	}
}

