package seed

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/legaleagle/backend/internal/platform/auth"
	"github.com/legaleagle/backend/internal/platform/database"
	"github.com/legaleagle/backend/internal/platform/database/sqlcgen"
	"github.com/legaleagle/backend/internal/shared"
)

// DefaultDemoPassword is the password hashed with Argon2id for all seeded demo accounts.
const DefaultDemoPassword = "Password@123"

// Populate initializes the store with the full Legal Eagle dataset matching the React frontend.
func Populate(s *database.Store) error {
	if len(s.PracticeAreas) > 0 {
		return nil
	}

	defaultHash, err := auth.HashPassword(DefaultDemoPassword)
	if err != nil {
		return err
	}

	s.PracticeAreas = []sqlcgen.PracticeArea{
		{Slug: "criminal", Name: "Criminal Law", Description: "Bail, trials, FIRs and criminal defence."},
		{Slug: "civil", Name: "Civil Law", Description: "Civil suits, recovery and injunctions."},
		{Slug: "family", Name: "Family Law", Description: "Custody, guardianship and maintenance."},
		{Slug: "divorce", Name: "Divorce & Matrimonial Law", Description: "Divorce, alimony and matrimonial disputes."},
		{Slug: "property", Name: "Property Law", Description: "Title, tenancy, RERA and land disputes."},
		{Slug: "corporate", Name: "Corporate Law", Description: "Company formation, contracts and compliance."},
		{Slug: "cyber", Name: "Cyber Law", Description: "Online fraud, data and IT Act matters."},
		{Slug: "consumer", Name: "Consumer Law", Description: "Consumer commission complaints and claims."},
		{Slug: "employment", Name: "Employment Law", Description: "Workplace, wages and termination issues."},
		{Slug: "ip", Name: "Intellectual Property Law", Description: "Trademarks, copyright and patents."},
		{Slug: "tax", Name: "Tax Law", Description: "GST, income tax assessments and appeals."},
		{Slug: "immigration", Name: "Immigration Law", Description: "Visas, OCI, passports and citizenship."},
	}

	firms := []sqlcgen.Firm{
		{
			ID: "f1", Name: "Mehra & Associates", City: "Jaipur", Address: "C-Scheme, Jaipur, Rajasthan",
			Established: 2004, PracticeAreas: []string{"criminal", "civil", "property", "consumer"},
			About:   "Mehra & Associates is a Jaipur-based litigation practice handling criminal, civil and property matters before district courts and the High Court.",
			Email:   "office@mehra-associates.example.com", Phone: "+91 90000 10001", Website: "mehra-associates.example.com",
		},
		{
			ID: "f2", Name: "Kapoor Legal LLP", City: "Delhi", Address: "Connaught Place, New Delhi",
			Established: 1998, PracticeAreas: []string{"corporate", "tax", "ip"},
			About:   "Kapoor Legal LLP advises businesses on corporate structuring, taxation and intellectual property.",
			Email:   "contact@kapoorlegal.example.com", Phone: "+91 90000 10002", Website: "kapoorlegal.example.com",
		},
		{
			ID: "f3", Name: "Rathore Family Law Chambers", City: "Jaipur", Address: "Malviya Nagar, Jaipur, Rajasthan",
			Established: 2011, PracticeAreas: []string{"family", "divorce", "civil"},
			About:   "Rathore Family Law Chambers works on matrimonial, custody and maintenance matters with an emphasis on mediation.",
			Email:   "chambers@rathorefamilylaw.example.com", Phone: "+91 90000 10003", Website: "rathorefamilylaw.example.com",
		},
		{
			ID: "f4", Name: "Sterling Law Partners", City: "Mumbai", Address: "Bandra Kurla Complex, Mumbai",
			Established: 2008, PracticeAreas: []string{"corporate", "employment", "immigration"},
			About:   "Sterling Law Partners provides corporate, employment and immigration advisory services to organisations and individuals.",
			Email:   "hello@sterlinglaw.example.com", Phone: "+91 90000 10004", Website: "sterlinglaw.example.com",
		},
		{
			ID: "f5", Name: "Arora Cyber & Tech Law", City: "Gurugram", Address: "Cyber City, Gurugram, Haryana",
			Established: 2016, PracticeAreas: []string{"cyber", "ip", "consumer"},
			About:   "Arora Cyber & Tech Law focuses on technology-related legal matters including IT Act issues and data protection compliance.",
			Email:   "team@aroracyberlaw.example.com", Phone: "+91 90000 10005", Website: "aroracyberlaw.example.com",
		},
		{
			ID: "f6", Name: "Deshmukh & Iyer Advocates", City: "Mumbai", Address: "Fort, Mumbai, Maharashtra",
			Established: 2001, PracticeAreas: []string{"criminal", "property", "consumer", "civil"},
			About:   "Deshmukh & Iyer Advocates is a Mumbai litigation practice appearing in criminal, property and consumer matters.",
			Email:   "office@deshmukhiyer.example.com", Phone: "+91 90000 10006", Website: "deshmukhiyer.example.com",
		},
	}
	for i := range firms {
		f := firms[i]
		f.UUID = uuid.New()
		s.Firms[f.ID] = &f
	}

	type lawyerSeed struct {
		ID         string
		Name       string
		City       string
		Years      int
		Practices  []string
		Visibility string
		Fee        float64
	}

	rows := []lawyerSeed{
		{"l1", "Aarav Sharma", "Jaipur", 9, []string{"criminal", "civil"}, "clients", 1500},
		{"l2", "Kavya Mehra", "Jaipur", 18, []string{"criminal", "property"}, "clients", 2500},
		{"l3", "Rohan Bhatt", "Jaipur", 6, []string{"civil", "property"}, "clients", 1800},
		{"l4", "Sneha Agarwal", "Jaipur", 4, []string{"criminal", "consumer"}, "hidden", 1200},
		{"l5", "Ishaan Joshi", "Jaipur", 3, []string{"civil", "consumer"}, "clients", 1500},
		{"l6", "Meera Rathore", "Jaipur", 21, []string{"family", "divorce", "civil"}, "clients", 3000},
		{"l7", "Nikhil Choudhary", "Jaipur", 7, []string{"divorce", "family"}, "clients", 1800},
		{"l8", "Aditi Kapoor", "Delhi", 16, []string{"corporate", "tax"}, "clients", 2500},
		{"l9", "Karan Sethi", "Delhi", 11, []string{"ip", "corporate"}, "hidden", 2000},
		{"l10", "Pooja Nair", "Delhi", 5, []string{"tax", "corporate"}, "clients", 1500},
		{"l11", "Rahul Bansal", "Delhi", 13, []string{"criminal", "civil"}, "clients", 2000},
		{"l12", "Tanvi Saxena", "Delhi", 2, []string{"consumer", "cyber"}, "clients", 1200},
		{"l13", "Devansh Arora", "Gurugram", 10, []string{"cyber", "ip"}, "clients", 2000},
		{"l14", "Riya Khanna", "Gurugram", 6, []string{"cyber", "consumer"}, "clients", 1500},
		{"l15", "Manav Gupta", "Gurugram", 8, []string{"employment", "corporate"}, "clients", 1800},
		{"l16", "Farah Qureshi", "Mumbai", 15, []string{"corporate", "employment", "immigration"}, "clients", 2500},
		{"l17", "Aniket Deshmukh", "Mumbai", 19, []string{"criminal", "property"}, "hidden", 3000},
		{"l18", "Lakshmi Iyer", "Mumbai", 12, []string{"property", "consumer", "civil"}, "clients", 2000},
		{"l19", "Zubin Patel", "Mumbai", 4, []string{"immigration", "employment"}, "clients", 1500},
		{"l20", "Neha Kulkarni", "Pune", 9, []string{"family", "divorce", "property"}, "clients", 1800},
		{"l21", "Sameer Kohli", "Gurugram", 1, []string{"criminal", "cyber"}, "clients", 1200},
		{"l22", "Gauri Sinha", "Delhi", 7, []string{"immigration", "family"}, "clients", 1800},
	}

	officeByCity := map[string]string{
		"Jaipur":    "Chamber 204, C-Scheme Legal Complex, Ashok Marg, Jaipur",
		"Delhi":     "Suite 12, Connaught Place Bar Chambers, New Delhi",
		"Gurugram":  "4th Floor, DLF Cyber Park Chambers, Phase III, Gurugram",
		"Mumbai":    "301 Heritage Law Chambers, Fort, Mumbai",
		"Pune":      "2nd Floor, Shivajinagar District Court Road, Pune",
		"Bengaluru": "Suite 8, MG Road Advocates Arcade, Bengaluru",
	}

	for idx, r := range rows {
		enrolYear := 2026 - r.Years
		slugMail := strings.ReplaceAll(strings.ToLower(r.Name), " ", ".")
		lp := &sqlcgen.LawyerProfile{
			UUID:              uuid.New(),
			ID:                r.ID,
			Name:              r.Name,
			Headline:          fmt.Sprintf("Advocate · %s", strings.ToUpper(r.Practices[0][:1])+r.Practices[0][1:]+" Law"),
			City:              r.City,
			ExperienceYears:   r.Years,
			PracticeAreas:     r.Practices,
			About:             fmt.Sprintf("%s is an advocate based in %s with %d years of legal practice.", r.Name, r.City, r.Years),
			Photo:             "",
			Languages:         []string{"English", "Hindi"},
			Education: []sqlcgen.EducationRecord{
				{ID: r.ID + "-ed1", Institution: "National Law Institute, " + r.City, Degree: "B.A. LL.B. (Hons.)", Field: "Law", StartYear: enrolYear - 5, EndYear: enrolYear},
			},
			Experience: []sqlcgen.ExperienceRecord{
				{ID: r.ID + "-ex1", Organization: "Legal Practice, " + r.City, Designation: "Advocate", StartDate: fmt.Sprintf("%d-07", enrolYear), EndDate: "", Description: "Representing clients before district courts, tribunals and High Court benches."},
			},
			Qualifications: []sqlcgen.QualificationRecord{
				{ID: r.ID + "-q1", Title: "Enrolled Advocate", Issuer: "State Bar Council", IssueDate: fmt.Sprintf("%d-08", enrolYear)},
			},
			Achievements: []sqlcgen.AchievementRecord{
				{ID: r.ID + "-a1", Title: "Speaker, Regional Bar Association Legal Seminar", Description: "Informational professional contribution.", Date: "2025-04"},
			},
			Contact: sqlcgen.ContactInfo{
				Email: fmt.Sprintf("%s@example.com", slugMail),
				Phone: fmt.Sprintf("+91 90000 2%04d", idx+1),
			},
			ContactVisibility: r.Visibility,
			JoinedAt:          "2025-06-10",
			IsActive:          true,
		}
		s.Lawyers[r.ID] = lp

		s.ConsultationSettings[r.ID] = &sqlcgen.ConsultationSettings{
			LawyerID:        r.ID,
			Fee:             r.Fee,
			Currency:        "INR",
			AvailableModes:  []string{"ONLINE", "IN_PERSON"},
			BookingLeadTime: 2,
			WorkingDays:     []string{"MON", "TUE", "WED", "THU", "FRI", "SAT"},
			WorkingHours:    sqlcgen.WorkingHours{Start: "10:00", End: "18:00"},
			BlockedDates:    []string{"2026-11-15"},
			OfficeLocation:  officeByCity[r.City],
		}
	}

	// Active & Pending Memberships
	activeMembers := map[string][]string{
		"f1": {"l2", "l3", "l4"},
		"f2": {"l8", "l9", "l10"},
		"f3": {"l6", "l7"},
		"f4": {"l16", "l19"},
		"f5": {"l13", "l14"},
		"f6": {"l17", "l18"},
	}
	mCount := 0
	addMem := func(firmID, lawyerID, status, initiatedBy string) {
		mCount++
		id := fmt.Sprintf("m%d", mCount)
		s.Memberships[id] = &sqlcgen.FirmMembership{
			ID:          id,
			FirmID:      firmID,
			LawyerID:    lawyerID,
			MemberRole:  "MEMBER",
			Status:      status,
			InitiatedBy: initiatedBy,
			CreatedAt:   time.Now().Add(-30 * 24 * time.Hour).UTC(),
			UpdatedAt:   time.Now().Add(-30 * 24 * time.Hour).UTC(),
		}
	}
	for _, fid := range []string{"f1", "f2", "f3", "f4", "f5", "f6"} {
		for _, lid := range activeMembers[fid] {
			addMem(fid, lid, "active", "firm")
		}
	}
	addMem("f1", "l1", "pending", "firm")
	addMem("f1", "l5", "pending", "lawyer")
	addMem("f1", "l21", "pending", "lawyer")
	addMem("f5", "l12", "pending", "lawyer")
	addMem("f2", "l22", "pending", "lawyer")
	addMem("f4", "l15", "pending", "firm")

	// Demo Client Profile
	s.Clients["c1"] = &sqlcgen.ClientProfile{
		ID:    "c1",
		Name:  "Ananya Verma",
		Email: "client@demo.legaleagle.in",
		City:  "Jaipur",
		Saved: sqlcgen.SavedItems{Lawyers: []string{"l2"}, Firms: []string{"f3"}},
		Recent: []sqlcgen.RecentViewEntry{},
	}

	// Demo Users (Argon2id hashed)
	now := time.Now().UTC()
	demoUsers := []*sqlcgen.User{
		{ID: uuid.New(), ExternalID: "u1", Email: "client@demo.legaleagle.in", PasswordHash: defaultHash, Role: "CLIENT", FrontendRole: "client", Name: "Ananya Verma", ProfileID: "c1", IsActive: true, CreatedAt: now, UpdatedAt: now},
		{ID: uuid.New(), ExternalID: "u2", Email: "lawyer@demo.legaleagle.in", PasswordHash: defaultHash, Role: "LAWYER", FrontendRole: "lawyer", Name: "Aarav Sharma", ProfileID: "l1", IsActive: true, CreatedAt: now, UpdatedAt: now},
		{ID: uuid.New(), ExternalID: "u3", Email: "firm@demo.legaleagle.in", PasswordHash: defaultHash, Role: "FIRM_ADMIN", FrontendRole: "firm", Name: "Mehra & Associates", ProfileID: "f1", Representative: "Kavya Mehra", IsActive: true, CreatedAt: now, UpdatedAt: now},
		{ID: uuid.New(), ExternalID: "u4", Email: "lawyer2@demo.legaleagle.in", PasswordHash: defaultHash, Role: "LAWYER", FrontendRole: "lawyer", Name: "Manav Gupta", ProfileID: "l15", IsActive: true, CreatedAt: now, UpdatedAt: now},
		{ID: uuid.New(), ExternalID: "u5", Email: "admin@demo.legaleagle.in", PasswordHash: defaultHash, Role: "PLATFORM_ADMIN", FrontendRole: "admin", Name: "Platform Admin", ProfileID: "admin1", IsActive: true, CreatedAt: now, UpdatedAt: now},
	}
	for _, u := range demoUsers {
		s.Users[u.ExternalID] = u
	}

	// Availability Slots (60-minute fixed slots across November 2026)
	seedDates := []string{
		"2026-11-05", "2026-11-06", "2026-11-07", "2026-11-09",
		"2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13",
		"2026-11-14", "2026-11-16", "2026-11-17", "2026-11-18",
	}
	defaultHours := [][2]string{
		{"10:00", "11:00"},
		{"11:00", "12:00"},
		{"15:00", "16:00"},
		{"16:00", "17:00"},
		{"17:00", "18:00"},
	}

	ensureSlot := func(lawyerID, date, startTime, endTime, backendStatus string, bookingID *string) *sqlcgen.ConsultationSlot {
		id := fmt.Sprintf("slot_%s_%s_%s", lawyerID, date, strings.ReplaceAll(startTime, ":", ""))
		startsUTC, _ := time.Parse(time.RFC3339, fmt.Sprintf("%sT%s:00+05:30", date, startTime))
		endsUTC := startsUTC.Add(60 * time.Minute)
		slot := &sqlcgen.ConsultationSlot{
			UUID:          uuid.New(),
			ID:            id,
			LawyerID:      lawyerID,
			Date:          date,
			StartTime:     startTime,
			EndTime:       endTime,
			StartsAtUTC:   startsUTC.UTC(),
			EndsAtUTC:     endsUTC.UTC(),
			Timezone:      "Asia/Kolkata",
			BackendStatus: backendStatus,
			Status:        shared.FrontendSlotStatus(backendStatus),
			BookingID:     bookingID,
		}
		s.Slots[id] = slot
		return slot
	}

	for _, r := range rows {
		for _, d := range seedDates {
			for _, hr := range defaultHours {
				ensureSlot(r.ID, d, hr[0], hr[1], shared.SlotAvailable, nil)
			}
		}
	}
	ensureSlot("l1", "2026-11-10", "14:00", "15:00", shared.SlotAvailable, nil)
	ensureSlot("l1", "2026-11-12", "16:00", "17:00", shared.SlotAvailable, nil)

	// Seed Bookings (bk_1001 .. bk_1006)
	bk1001 := "bk_1001"
	slot1001 := ensureSlot("l1", "2026-11-10", "10:00", "11:00", shared.SlotAwaitingLawyer, &bk1001)
	pay1001 := "pay_1001"
	txn1001 := "TXN-LE-90811"
	paid1001 := time.Date(2026, 11, 2, 9, 15, 0, 0, time.UTC)
	dl1001 := time.Date(2026, 11, 9, 21, 15, 0, 0, time.UTC)
	s.Payments[pay1001] = &sqlcgen.Payment{
		ID: pay1001, BookingID: bk1001, ClientID: "c1", LawyerID: "l1",
		Amount: 1500, Currency: "INR", Provider: "MOCK", ProviderOrderID: "order_mock_1001",
		TransactionReference: &txn1001, Status: shared.PaymentPaid, PaidAt: &paid1001, CreatedAt: paid1001,
	}
	s.Bookings[bk1001] = &sqlcgen.Booking{
		UUID: uuid.New(), ID: bk1001, ClientID: "c1", LawyerID: "l1",
		OriginalSlotID: slot1001.ID, FinalSlotID: slot1001.ID, Mode: "ONLINE",
		ConsultationFee: 1500, TotalAmount: 1500, Currency: "INR",
		BookingStatus: shared.BookingAwaitingLawyer, PaymentID: &pay1001,
		ResponseDeadline: &dl1001,
		ClientNotes:      "Need legal consultation regarding a bail application and FIR quashing.",
		OfficeLocation:   officeByCity["Jaipur"],
		Timeline: []sqlcgen.TimelineStep{
			{Step: "SLOT_SELECTED", Label: "1-Hour Slot Selected (10 Nov 2026, 10:00 AM–11:00 AM)", At: paid1001.Add(-2 * time.Minute)},
			{Step: "PAYMENT_SUCCESS", Label: "Payment Verified (₹1,500 · TXN-LE-90811)", At: paid1001},
			{Step: "AWAITING_LAWYER", Label: "Booking Request Submitted — Awaiting Lawyer Approval", At: paid1001},
		},
		CreatedAt: paid1001, UpdatedAt: paid1001,
	}

	bk1002 := "bk_1002"
	f1ID := "f1"
	slot1002Orig := ensureSlot("l2", "2026-11-11", "11:00", "12:00", shared.SlotAvailable, nil)
	slot1002Prop := ensureSlot("l2", "2026-11-12", "16:00", "17:00", shared.SlotProposed, &bk1002)
	pay1002 := "pay_1002"
	txn1002 := "TXN-LE-90812"
	paid1002 := time.Date(2026, 11, 2, 8, 5, 0, 0, time.UTC)
	dl1002 := time.Date(2026, 11, 10, 10, 0, 0, 0, time.UTC)
	s.Payments[pay1002] = &sqlcgen.Payment{
		ID: pay1002, BookingID: bk1002, ClientID: "c1", LawyerID: "l2",
		Amount: 2500, Currency: "INR", Provider: "MOCK", ProviderOrderID: "order_mock_1002",
		TransactionReference: &txn1002, Status: shared.PaymentPaid, PaidAt: &paid1002, CreatedAt: paid1002,
	}
	s.Proposals["prop_2001"] = &sqlcgen.RescheduleProposal{
		ID: "prop_2001", BookingID: bk1002, LawyerID: "l2",
		OriginalSlotID: slot1002Orig.ID, ProposedSlotID: slot1002Prop.ID,
		Reason:    "I have a High Court hearing scheduled on 11 Nov morning. I have reserved 12 Nov, 4:00 PM – 5:00 PM for your consultation.",
		Status:    "PENDING", ExpiresAt: dl1002, CreatedAt: paid1002.Add(2 * time.Hour),
	}
	s.Bookings[bk1002] = &sqlcgen.Booking{
		UUID: uuid.New(), ID: bk1002, ClientID: "c1", LawyerID: "l2", FirmID: &f1ID,
		OriginalSlotID: slot1002Orig.ID, FinalSlotID: slot1002Prop.ID, Mode: "ONLINE",
		ConsultationFee: 2500, TotalAmount: 2500, Currency: "INR",
		BookingStatus: shared.BookingRescheduleProposed, PaymentID: &pay1002,
		ResponseDeadline: &dl1002,
		ClientNotes:      "Review of ancestral property partition deed and mutation documents.",
		OfficeLocation:   officeByCity["Jaipur"],
		Timeline: []sqlcgen.TimelineStep{
			{Step: "SLOT_SELECTED", Label: "1-Hour Slot Selected (11 Nov 2026, 11:00 AM–12:00 PM)", At: paid1002.Add(-5 * time.Minute)},
			{Step: "PAYMENT_SUCCESS", Label: "Payment Verified (₹2,500 · TXN-LE-90812)", At: paid1002},
			{Step: "RESCHEDULE_PROPOSED", Label: "Lawyer Proposed New Slot: 12 Nov 2026, 4:00 PM–5:00 PM", At: paid1002.Add(2 * time.Hour)},
		},
		CreatedAt: paid1002, UpdatedAt: paid1002.Add(2 * time.Hour),
	}

	bk1003 := "bk_1003"
	f3ID := "f3"
	slot1003 := ensureSlot("l6", "2026-11-09", "15:00", "16:00", shared.SlotConfirmed, &bk1003)
	pay1003 := "pay_1003"
	txn1003 := "TXN-LE-90744"
	paid1003 := time.Date(2026, 11, 1, 11, 12, 0, 0, time.UTC)
	meet1003 := "https://meet.legaleagle.example.com/session-bk_1003"
	s.Payments[pay1003] = &sqlcgen.Payment{
		ID: pay1003, BookingID: bk1003, ClientID: "c1", LawyerID: "l6",
		Amount: 3000, Currency: "INR", Provider: "MOCK", ProviderOrderID: "order_mock_1003",
		TransactionReference: &txn1003, Status: shared.PaymentPaid, PaidAt: &paid1003, CreatedAt: paid1003,
	}
	s.Bookings[bk1003] = &sqlcgen.Booking{
		UUID: uuid.New(), ID: bk1003, ClientID: "c1", LawyerID: "l6", FirmID: &f3ID,
		OriginalSlotID: slot1003.ID, FinalSlotID: slot1003.ID, Mode: "ONLINE",
		ConsultationFee: 3000, TotalAmount: 3000, Currency: "INR",
		BookingStatus: shared.BookingConfirmed, PaymentID: &pay1003,
		MeetingLink:    &meet1003,
		ClientNotes:    "Initial consultation regarding family settlement and mediation process.",
		OfficeLocation: officeByCity["Jaipur"],
		Timeline: []sqlcgen.TimelineStep{
			{Step: "SLOT_SELECTED", Label: "1-Hour Slot Selected (9 Nov 2026, 3:00 PM–4:00 PM)", At: paid1003.Add(-2 * time.Minute)},
			{Step: "PAYMENT_SUCCESS", Label: "Payment Verified (₹3,000 · TXN-LE-90744)", At: paid1003},
			{Step: "BOOKING_CONFIRMED", Label: "Appointment Confirmed by Advocate Meera Rathore", At: paid1003.Add(2 * time.Hour)},
		},
		CreatedAt: paid1003, UpdatedAt: paid1003.Add(2 * time.Hour),
	}

	// Seed Notifications
	s.CreateNotificationSync(nil, nil, "u1", &bk1002, shared.NotifRescheduleProposed,
		"Your lawyer has proposed a new consultation time",
		"Adv. Kavya Mehra proposed 12 November 2026, 4:00 PM – 5:00 PM for booking bk_1002.")
	s.CreateNotificationSync(nil, nil, "u2", &bk1001, shared.NotifNewBookingRequest,
		"New Consultation Request",
		"Ananya Verma requested a 1-hour Online consultation on 10 Nov 2026, 10:00 AM – 11:00 AM. Payment of ₹1,500 verified.")

	if s.Pool != nil {
		syncToPostgres(s)
	}

	return nil
}

func syncToPostgres(s *database.Store) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	for _, pa := range s.PracticeAreas {
		_, _ = s.Pool.Exec(ctx, `
			INSERT INTO practice_areas (slug, name, description)
			VALUES ($1, $2, $3)
			ON CONFLICT (slug) DO NOTHING
		`, pa.Slug, pa.Name, pa.Description)
	}

	for _, u := range s.Users {
		_, _ = s.Pool.Exec(ctx, `
			INSERT INTO users (id, external_id, email, password_hash, role, name, profile_id, representative, is_active, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			ON CONFLICT (email) DO NOTHING
		`, u.ID, u.ExternalID, u.Email, u.PasswordHash, u.Role, u.Name, u.ProfileID, u.Representative, u.IsActive, u.CreatedAt, u.UpdatedAt)
	}

	for _, cp := range s.Clients {
		_, _ = s.Pool.Exec(ctx, `
			INSERT INTO client_profiles (external_id, name, email, city, saved_lawyers, saved_firms)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (external_id) DO NOTHING
		`, cp.ID, cp.Name, cp.Email, cp.City, cp.Saved.Lawyers, cp.Saved.Firms)
	}

	for _, lp := range s.Lawyers {
		cs := s.ConsultationSettings[lp.ID]
		fee := 1500.0
		currency := "INR"
		modes := []string{"ONLINE", "IN_PERSON"}
		lead := 2
		office := ""
		if cs != nil {
			fee = cs.Fee
			currency = cs.Currency
			modes = cs.AvailableModes
			lead = cs.BookingLeadTime
			office = cs.OfficeLocation
		}
		_, _ = s.Pool.Exec(ctx, `
			INSERT INTO lawyer_profiles (id, external_id, user_id, name, headline, city, experience_years, about, photo_url, languages, contact_email, contact_phone, contact_visibility, consultation_fee, currency, available_modes, booking_lead_hours, office_location, is_active)
			VALUES ($1, $2, (SELECT id FROM users WHERE profile_id = $2 AND role = 'LAWYER' LIMIT 1), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, TRUE)
			ON CONFLICT (external_id) DO UPDATE
			SET user_id = COALESCE(lawyer_profiles.user_id, EXCLUDED.user_id)
		`, lp.UUID, lp.ID, lp.Name, lp.Headline, lp.City, lp.ExperienceYears, lp.About, lp.Photo, lp.Languages, lp.Contact.Email, lp.Contact.Phone, lp.ContactVisibility, fee, currency, modes, lead, office)
	}

	for _, fm := range s.Firms {
		_, _ = s.Pool.Exec(ctx, `
			INSERT INTO firms (id, external_id, name, city, address, established, practice_areas, about, email, phone, website, logo_url, cover_url)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
			ON CONFLICT (external_id) DO NOTHING
		`, fm.UUID, fm.ID, fm.Name, fm.City, fm.Address, fm.Established, fm.PracticeAreas, fm.About, fm.Email, fm.Phone, fm.Website, fm.Logo, fm.Cover)
	}

	// Hydrate any previously registered users & profiles from PostgreSQL back into memory
	rows, err := s.Pool.Query(ctx, `
		SELECT id, COALESCE(external_id, ''), email, password_hash, role, name, profile_id, COALESCE(representative, ''), is_active, created_at, updated_at
		FROM users
	`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var u sqlcgen.User
			if scanErr := rows.Scan(&u.ID, &u.ExternalID, &u.Email, &u.PasswordHash, &u.Role, &u.Name, &u.ProfileID, &u.Representative, &u.IsActive, &u.CreatedAt, &u.UpdatedAt); scanErr == nil {
				if u.ExternalID == "" {
					u.ExternalID = "u_" + u.ID.String()[:8]
				}
				_, fRole, _ := auth.NormalizeRole(u.Role)
				u.FrontendRole = fRole
				if _, exists := s.Users[u.ExternalID]; !exists {
					uCopy := u
					s.Users[u.ExternalID] = &uCopy
				}
			}
		}
	}
}


