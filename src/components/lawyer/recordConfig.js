import { GraduationCap, Briefcase, BadgeCheck, Award } from 'lucide-react';
import { EducationCard, ExperienceCard, QualificationCard, AchievementCard } from './RecordCards';
import { rules } from '../../utils/validators';

/**
 * Declarative config for each editable profile section. RecordManager uses it
 * to render the list, the add/edit modal form and validation — no duplication.
 */
export const RECORD_CONFIG = {
  education: {
    title: 'Education',
    singular: 'education',
    icon: GraduationCap,
    Card: EducationCard,
    empty: { institution: '', degree: '', field: '', startYear: '', endYear: '' },
    fields: [
      { name: 'institution', label: 'Institution', required: true, full: true },
      { name: 'degree', label: 'Degree', required: true, placeholder: 'e.g. LL.B.' },
      { name: 'field', label: 'Field of study', placeholder: 'e.g. Criminal Law' },
      { name: 'startYear', label: 'Start year', type: 'number', required: true },
      { name: 'endYear', label: 'End year', type: 'number', hint: 'Leave blank if ongoing' },
    ],
    schema: {
      institution: [rules.required('Institution'), rules.maxLength(120, 'Institution')],
      degree: [rules.required('Degree')],
      startYear: [rules.required('Start year'), rules.year('Start year')],
      endYear: [rules.year('End year'), (v, vals) => (!v || Number(v) >= Number(vals.startYear) ? '' : 'End year cannot be before start year.')],
    },
  },
  experience: {
    title: 'Work Experience',
    singular: 'experience',
    icon: Briefcase,
    Card: ExperienceCard,
    empty: { organization: '', designation: '', startDate: '', endDate: '', description: '' },
    fields: [
      { name: 'designation', label: 'Designation', required: true },
      { name: 'organization', label: 'Organization', required: true },
      { name: 'startDate', label: 'Start date', type: 'month', required: true },
      { name: 'endDate', label: 'End date', type: 'month', hint: 'Leave blank if current role' },
      { name: 'description', label: 'Description', as: 'textarea', full: true },
    ],
    schema: {
      designation: [rules.required('Designation')],
      organization: [rules.required('Organization')],
      startDate: [rules.required('Start date')],
      endDate: [rules.notBefore('startDate', 'End date cannot be before start date.')],
      description: [rules.maxLength(600, 'Description')],
    },
  },
  qualifications: {
    title: 'Qualifications',
    singular: 'qualification',
    icon: BadgeCheck,
    Card: QualificationCard,
    empty: { title: '', issuer: '', issueDate: '' },
    fields: [
      { name: 'title', label: 'Qualification title', required: true, full: true },
      { name: 'issuer', label: 'Issuing organization', required: true },
      { name: 'issueDate', label: 'Issue date', type: 'month', required: true },
    ],
    schema: {
      title: [rules.required('Title')],
      issuer: [rules.required('Issuing organization')],
      issueDate: [rules.required('Issue date')],
    },
  },
  achievements: {
    title: 'Achievements',
    singular: 'achievement',
    icon: Award,
    Card: AchievementCard,
    empty: { title: '', description: '', date: '' },
    fields: [
      { name: 'title', label: 'Award or achievement', required: true, full: true },
      { name: 'date', label: 'Date', type: 'month', required: true },
      { name: 'description', label: 'Description', as: 'textarea', full: true, hint: 'Keep it factual. Avoid claims about case outcomes.' },
    ],
    schema: {
      title: [rules.required('Title')],
      date: [rules.required('Date')],
      description: [rules.maxLength(400, 'Description')],
    },
  },
};
