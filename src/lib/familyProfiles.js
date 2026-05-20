// Family profile types and their specific data fields

export const DEPENDENT_TYPES = [
  { id: 'child',      label: 'Child',           icon: '👶', plural: 'Children' },
  { id: 'dependant',  label: 'Dependant adult', icon: '👴', plural: 'Dependant adults' },
  { id: 'pet',        label: 'Pet',             icon: '🐾', plural: 'Pets' },
]

// Fields specific to each dependent type
export const PROFILE_FIELDS = {
  child: [
    { id: 'full_name',       label: 'Full name',              type: 'text',     required: true },
    { id: 'date_of_birth',   label: 'Date of birth',          type: 'date',     required: true },
    { id: 'gender',          label: 'Gender',                  type: 'select',   options: ['Male','Female','Non-binary','Prefer not to say'] },
    { id: 'nhs_number',      label: 'NHS number',             type: 'text',     sensitive: true },
    { id: 'passport_number', label: 'Passport number',        type: 'text',     sensitive: true },
    { id: 'passport_expiry', label: 'Passport expiry',        type: 'date',     expiryRelevant: true },
    { id: 'school_name',     label: 'School name',            type: 'text' },
    { id: 'school_year',     label: 'School year',            type: 'text' },
    { id: 'teacher',         label: 'Form teacher / tutor',   type: 'text' },
    { id: 'allergies',       label: 'Allergies',              type: 'textarea', sensitive: true },
    { id: 'medications',     label: 'Medications',            type: 'textarea', sensitive: true },
    { id: 'medical_notes',   label: 'Medical conditions',     type: 'textarea', sensitive: true },
    { id: 'child_benefit',   label: 'Child benefit ref',      type: 'text',     sensitive: true },
    { id: 'notes',           label: 'Additional notes',       type: 'textarea' },
  ],
  dependant: [
    { id: 'full_name',       label: 'Full name',              type: 'text',     required: true },
    { id: 'date_of_birth',   label: 'Date of birth',          type: 'date' },
    { id: 'relationship',    label: 'Relationship to you',    type: 'text',     required: true },
    { id: 'nhs_number',      label: 'NHS number',             type: 'text',     sensitive: true },
    { id: 'ni_number',       label: 'National Insurance no.', type: 'text',     sensitive: true },
    { id: 'care_provider',   label: 'Care provider / home',   type: 'text' },
    { id: 'social_worker',   label: 'Social worker',          type: 'text' },
    { id: 'power_of_attorney',label:'Power of attorney held', type: 'select',   options: ['Yes','No','Pending'] },
    { id: 'medications',     label: 'Medications',            type: 'textarea', sensitive: true },
    { id: 'allergies',       label: 'Allergies',              type: 'textarea', sensitive: true },
    { id: 'gp_name',         label: 'GP name',                type: 'text' },
    { id: 'notes',           label: 'Additional notes',       type: 'textarea' },
  ],
  pet: [
    { id: 'full_name',       label: 'Name',                   type: 'text',     required: true },
    { id: 'species',         label: 'Species / breed',        type: 'text',     required: true },
    { id: 'date_of_birth',   label: 'Date of birth',          type: 'date' },
    { id: 'microchip',       label: 'Microchip number',       type: 'text' },
    { id: 'vet_name',        label: 'Vet practice',           type: 'text' },
    { id: 'vet_phone',       label: 'Vet phone number',       type: 'text' },
    { id: 'insurance',       label: 'Pet insurance provider', type: 'text' },
    { id: 'insurance_policy',label: 'Policy number',          type: 'text',     sensitive: true },
    { id: 'medications',     label: 'Medications / conditions', type: 'textarea' },
    { id: 'feeding',         label: 'Feeding instructions',   type: 'textarea' },
    { id: 'notes',           label: 'Additional notes',       type: 'textarea' },
  ],
}

// Shared family information (applies across all children / family)
export const SHARED_FAMILY_FIELDS = [
  { id: 'gp_surgery',      label: 'GP surgery name',         type: 'text' },
  { id: 'gp_phone',        label: 'GP phone number',         type: 'text' },
  { id: 'gp_address',      label: 'GP address',              type: 'textarea' },
  { id: 'dentist',         label: 'Dentist name',            type: 'text' },
  { id: 'dentist_phone',   label: 'Dentist phone number',    type: 'text' },
  { id: 'emergency_contact',label:'Emergency contact name',  type: 'text' },
  { id: 'emergency_phone', label: 'Emergency contact phone', type: 'text' },
  { id: 'emergency_relation',label:'Relationship',           type: 'text' },
  { id: 'family_notes',    label: 'Family notes',            type: 'textarea' },
]

// Access control options after separation
export const CHILD_ACCESS_OPTIONS = [
  { id: 'owner_only',   label: 'Only me',                   detail: 'Only you can see this child\'s information' },
  { id: 'both_parents', label: 'Both parents',              detail: 'Both parents with a DR account can see this' },
  { id: 'beneficiaries',label: 'My beneficiaries only',    detail: 'Visible to your nominated beneficiaries when vault is accessed' },
]
