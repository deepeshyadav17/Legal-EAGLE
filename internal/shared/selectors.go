package shared

import (
	"github.com/legaleagle/backend/internal/platform/database"
	"github.com/legaleagle/backend/internal/platform/database/sqlcgen"
)

type FirmAffiliationDTO struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Logo string `json:"logo"`
}

type LawyerSummaryDTO struct {
	ID                   string              `json:"id"`
	Name                 string              `json:"name"`
	Headline             string              `json:"headline"`
	Title                string              `json:"title"`
	Photo                string              `json:"photo"`
	City                 string              `json:"city"`
	ExperienceYears      int                 `json:"experienceYears"`
	PracticeAreas        []string            `json:"practiceAreas"`
	PrimaryPracticeArea  string              `json:"primaryPracticeArea"`
	Firm                 *FirmAffiliationDTO `json:"firm"`
	ConsultationFee      float64             `json:"consultationFee"`
	AvailableModes       []string            `json:"availableModes"`
}

type FirmSummaryDTO struct {
	ID                string   `json:"id"`
	Name              string   `json:"name"`
	Logo              string   `json:"logo"`
	City              string   `json:"city"`
	Established       int      `json:"established"`
	PracticeAreas     []string `json:"practiceAreas"`
	ActiveMemberCount int      `json:"activeMemberCount"`
}

func ActiveMembershipForLawyer(s *database.Store, lawyerID string) *sqlcgen.FirmMembership {
	for _, m := range s.Memberships {
		if m.LawyerID == lawyerID && m.Status == "active" {
			return m
		}
	}
	return nil
}

func ActiveMemberIDs(s *database.Store, firmID string) []string {
	var ids []string
	for _, m := range s.Memberships {
		if m.FirmID == firmID && m.Status == "active" {
			ids = append(ids, m.LawyerID)
		}
	}
	return ids
}

func FirmAffiliation(s *database.Store, lawyerID string) *FirmAffiliationDTO {
	m := ActiveMembershipForLawyer(s, lawyerID)
	if m == nil {
		return nil
	}
	f, ok := s.Firms[m.FirmID]
	if !ok {
		return nil
	}
	return &FirmAffiliationDTO{ID: f.ID, Name: f.Name, Logo: f.Logo}
}

func ConsultationInfoForLawyer(s *database.Store, lawyerID string) *sqlcgen.ConsultationSettings {
	if cs, ok := s.ConsultationSettings[lawyerID]; ok {
		return cs
	}
	return &sqlcgen.ConsultationSettings{
		LawyerID:        lawyerID,
		Fee:             1500,
		Currency:        "INR",
		AvailableModes:  []string{"ONLINE", "IN_PERSON"},
		BookingLeadTime: 2,
		WorkingDays:     []string{"MON", "TUE", "WED", "THU", "FRI", "SAT"},
		WorkingHours:    sqlcgen.WorkingHours{Start: "10:00", End: "18:00"},
		BlockedDates:    []string{},
		OfficeLocation:  "District Court Chambers",
	}
}

func BuildLawyerSummary(s *database.Store, l *sqlcgen.LawyerProfile) LawyerSummaryDTO {
	cs := ConsultationInfoForLawyer(s, l.ID)
	primary := ""
	if len(l.PracticeAreas) > 0 {
		primary = l.PracticeAreas[0]
	}
	return LawyerSummaryDTO{
		ID:                  l.ID,
		Name:                l.Name,
		Headline:            l.Headline,
		Title:               l.Headline,
		Photo:               l.Photo,
		City:                l.City,
		ExperienceYears:     l.ExperienceYears,
		PracticeAreas:       l.PracticeAreas,
		PrimaryPracticeArea: primary,
		Firm:                FirmAffiliation(s, l.ID),
		ConsultationFee:     cs.Fee,
		AvailableModes:      cs.AvailableModes,
	}
}

// BuildLawyerPublic returns a public lawyer profile WITHOUT contact details.
func BuildLawyerPublic(s *database.Store, l *sqlcgen.LawyerProfile, includeContact bool) map[string]any {
	cs := ConsultationInfoForLawyer(s, l.ID)
	out := map[string]any{
		"id":                l.ID,
		"name":              l.Name,
		"headline":          l.Headline,
		"city":              l.City,
		"experienceYears":   l.ExperienceYears,
		"practiceAreas":     l.PracticeAreas,
		"about":             l.About,
		"photo":             l.Photo,
		"languages":         l.Languages,
		"education":         l.Education,
		"experience":        l.Experience,
		"qualifications":    l.Qualifications,
		"achievements":      l.Achievements,
		"contactVisibility": l.ContactVisibility,
		"joinedAt":          l.JoinedAt,
		"firm":              FirmAffiliation(s, l.ID),
		"consultation": map[string]any{
			"fee":             cs.Fee,
			"currency":        cs.Currency,
			"availableModes":  cs.AvailableModes,
			"bookingLeadTime": cs.BookingLeadTime,
			"officeLocation":  cs.OfficeLocation,
		},
	}
	if includeContact {
		out["contact"] = l.Contact
	}
	return out
}

func BuildFirmSummary(s *database.Store, f *sqlcgen.Firm) FirmSummaryDTO {
	return FirmSummaryDTO{
		ID:                f.ID,
		Name:              f.Name,
		Logo:              f.Logo,
		City:              f.City,
		Established:       f.Established,
		PracticeAreas:     f.PracticeAreas,
		ActiveMemberCount: len(ActiveMemberIDs(s, f.ID)),
	}
}

