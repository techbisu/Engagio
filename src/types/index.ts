// Shared types for Engagio

export type ViewName =
  | "landing"
  | "login"
  | "admin"
  | "student"
  | "quiz"
  | "results"
  | "verify"

export type AdminTab =
  | "dashboard"
  | "events"
  | "questions"
  | "links"
  | "attempts"
  | "users"
  | "payments"
  | "certificates"
  | "results"

export type Role = "ADMIN" | "STUDENT"

export type AttemptStatus =
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CHEAT_DETECTED"
  | "TIMEOUT"

export interface SafeUser {
  id: string
  email: string
  name?: string | null
  image?: string | null
  role: Role
}

export type PaymentMethod = "FREE" | "RAZORPAY" | "STRIPE" | "MANUAL"
export type PaymentStatus = "NONE" | "PENDING_VERIFICATION" | "COMPLETED" | "REJECTED"
export type CertTemplate = "classic" | "modern" | "elegant" | "bold" | "minimal"
export type CertIssueCondition = "PARTICIPATION" | "COMPLETED" | "PASSED"
export type CertStatus = "VALID" | "REVOKED"
export type QuestionDifficulty = "EASY" | "MEDIUM" | "HARD"

export interface EventDto {
  id: string
  title: string
  description: string
  image?: string | null
  startDate: string
  endDate: string
  isActive: boolean
  requireRegistration: boolean
  createdAt: string
  questionCount?: number
  linkCount?: number
  attemptCount?: number
  registrationCount?: number
  fieldCount?: number
  // Payment
  paymentMethod: PaymentMethod
  paymentAmount: number // paise (INR) or cents
  paymentCurrency: string
  paymentInstructions?: string | null
  upiId?: string | null
  upiLink?: string | null
  qrCodeUrl?: string | null
  qrCodePublicId?: string | null
  requireTransactionRef: boolean
  requireScreenshot: boolean
  // Certificate
  certEnabled: boolean
  certTemplate: CertTemplate
  certIssueCondition: CertIssueCondition
  certPassingScore: number
  certAutoGenerate: boolean
  certOrgName?: string | null
  certSigneeName?: string | null
  certSigneeTitle?: string | null
  certSigneeImage?: string | null
  certSigneeImagePublicId?: string | null
  certLogo?: string | null
  certLogoPublicId?: string | null
  certificateCount?: number
}

export type EventFieldType =
  | "text"
  | "email"
  | "number"
  | "tel"
  | "textarea"
  | "select"
  | "checkbox"
  | "date"

export interface EventFieldDto {
  id: string
  eventId: string
  label: string
  type: EventFieldType
  required: boolean
  placeholder?: string | null
  helpText?: string | null
  options: string[]
  order: number
  createdAt: string
}

export interface RegistrationDto {
  id: string
  eventId: string
  userId: string
  data: Record<string, string | number | boolean>
  createdAt: string
  user?: { name: string | null; email: string; image?: string | null }
  // Payment tracking
  paymentStatus: PaymentStatus
  paymentMethod?: string | null
  transactionReference?: string | null
  screenshotUrl?: string | null
  verifiedBy?: string | null
  verifiedAt?: string | null
  rejectionReason?: string | null
}

export type QuestionType = "MCQ" | "TRUE_FALSE" | "FILL_BLANK" | "MATCHING" | "CODING"

export interface MatchPair {
  left: string
  right: string
}

export interface QuestionDto {
  id: string
  eventId: string
  question: string
  type: QuestionType
  options: string[]
  correctAnswer: number
  correctText?: string | null
  matchPairs?: MatchPair[] | null
  codeLanguage?: string | null
  marks: number
  negativeMarks: number
  category?: string | null
  order: number
  explanation?: string | null
  imageUrl?: string | null
  imageUrlPublicId?: string | null
  difficulty: QuestionDifficulty
  tags: string[]
  createdAt: string
}

export interface QuizLinkDto {
  id: string
  eventId: string
  slug: string
  isActive: boolean
  shuffleQuestions: boolean
  shuffleOptions: boolean
  timeLimit: number
  maxAttempts: number
  questionCount: number
  showResults: boolean
  publishResults: boolean
  // Email + leaderboard are independent of result visibility
  emailOnPublish: boolean
  leaderboardEnabled: boolean
  passThreshold: number
  // Security toggles
  requireFullscreen: boolean
  autoSubmitOnExit: boolean
  tabSwitchDetection: boolean
  copyPasteBlocking: boolean
  rightClickDisable: boolean
  keyboardShortcutBlocking: boolean
  devtoolsDetection: boolean
  antiScreenshot: boolean
  watermarkOverlay: boolean
  // AI Proctor
  aiProctor: boolean
  aiProctorFaceDetection: boolean
  aiProctorMultiFace: boolean
  aiProctorLookAway: boolean
  createdAt: string
  expiresAt?: string | null
  event?: Pick<EventDto, "id" | "title" | "description"> & { image?: string | null }
}

/** Question as seen by the participant (correctAnswer/correctText hidden). */
export interface PublicQuestion {
  id: string
  question: string
  type: QuestionType
  options: string[]
  matchPairs?: MatchPair[] | null
  codeLanguage?: string | null
  marks: number
  negativeMarks: number
  category?: string | null
  order: number
  imageUrl?: string | null
  difficulty: QuestionDifficulty
  tags: string[]
}

export interface QuizAttemptDto {
  id: string
  userId: string
  quizLinkId: string
  eventId: string
  score: number | null
  totalMarks: number | null
  percentage: number | null
  passed: boolean | null
  tabSwitches: number
  fullscreenExits: number
  copyAttempts: number
  rightClicks: number
  devtoolsOpen: number
  screenshotAttempts: number
  keyboardViolations: number
  faceNotDetected: number
  multiFaceAlerts: number
  lookAwayAlerts: number
  timeTaken: number | null
  status: AttemptStatus
  startedAt: string
  completedAt: string | null
  publishedAt: string | null
  /** True iff scoring is visible to participant (`!publishResults || publishedAt != null`). */
  published?: boolean
  /** For convenience: event.title via joined select. */
  ipAddress?: string | null
  userAgent?: string | null
  answers?: Record<string, number | string | Record<string, string>> | null
  questionOrder?: string[] | null
  flaggedQuestions?: string[] | null
  user?: { name: string | null; email: string; image?: string | null }
  event?: { id: string; title: string }
  quizLink?: { slug: string; publishResults?: boolean }
}

export interface CsvRow {
  question: string
  options: string[]
  correctAnswer: number
  marks?: number
  explanation?: string
  /** One of MCQ | TRUE_FALSE | FILL_BLANK | MATCHING | CODING (default MCQ). */
  type?: QuestionType
  /** Optional category tag. */
  category?: string
  /** Optional negative marks (default 0). */
  negativeMarks?: number
  /** Optional correct text (FILL_BLANK / CODING reference solution). */
  correctText?: string
  /** Optional difficulty (default MEDIUM). */
  difficulty?: QuestionDifficulty
  /** Optional tags (comma-separated in CSV). */
  tags?: string[]
}

export interface QuizConfig {
  shuffleQuestions: boolean
  shuffleOptions: boolean
  timeLimit: number
  maxAttempts: number
  showResults: boolean
  passThreshold: number
  requireFullscreen: boolean
}

export interface CertificateDto {
  id: string
  eventId: string
  userId: string
  attemptId?: string | null
  certificateNumber: string
  verificationToken: string
  template: CertTemplate
  eligibilityType: CertIssueCondition
  recipientName: string
  issuedAt: string
  issuedBy?: string | null
  status: CertStatus
  certificateUrl?: string | null
  certificatePublicId?: string | null
  generatedAutomatically: boolean
  manualOverride: boolean
  revokedAt?: string | null
  revokedBy?: string | null
  revocationReason?: string | null
  createdAt: string
  event?: {
    id: string
    title: string
    certOrgName?: string | null
    certSigneeName?: string | null
    certSigneeTitle?: string | null
    certSigneeImage?: string | null
    certLogo?: string | null
    certTemplate?: CertTemplate | null
    certPassingScore?: number | null
  }
  user?: { name: string | null; email: string }
}
