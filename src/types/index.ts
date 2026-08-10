// Shared types for Engagio

export type ViewName =
  | "landing"
  | "login"
  | "admin"
  | "student"
  | "quiz"
  | "results"
  | "verify"
  | "activity"
  | "live-display"
  | "org-onboarding"
  | "org-dashboard"
  | "org-settings"
  | "accept-invitation"
  | "share"
  | "pricing"
  | "about"
  | "privacy"
  | "terms"
  | "contact"
  | "platform"
  | "superadmin"
  | "org-landing"
  | "event-landing"

export type AdminTab =
  | "dashboard"
  | "events"
  | "questions"
  | "links"
  | "activities"
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
  slug?: string | null
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

// ─── Activity System ────────────────────────────────────────────────────────

export type ActivityType =
  | "QUIZ"
  | "LIVE_QUIZ"
  | "POLL"
  | "SURVEY"
  | "FEEDBACK"
  | "Q_AND_A"
  | "VOTING"
  | "KNOWLEDGE_CHECK"
  | "PRE_POST_ASSESSMENT"

export type ActivityStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "LIVE"
  | "CLOSED"
  | "COMPLETED"

export type ActivityQuestionType =
  | "SINGLE_CHOICE"
  | "MULTIPLE_CHOICE"
  | "RATING"
  | "TEXT"
  | "NUMBER"
  | "YES_NO"
  | "OPEN"

export interface ActivitySettings {
  allowMultiple?: boolean
  anonymous?: boolean
  showResults?: boolean
  hideResultsUntilClosed?: boolean
  maxResponses?: number
  speedBonus?: boolean
  timePerQuestion?: number
}

export interface ActivityQuestionDto {
  id: string
  activityId: string
  text: string
  type: ActivityQuestionType
  options: string[]
  required: boolean
  sortOrder: number
  createdAt: string
}

export interface ActivityDto {
  id: string
  eventId: string
  type: ActivityType
  title: string
  description?: string | null
  status: ActivityStatus
  isEnabled: boolean
  sortOrder: number
  startsAt?: string | null
  endsAt?: string | null
  settings: ActivitySettings
  quizLinkId?: string | null
  session?: string | null
  slug?: string | null
  createdBy?: string | null
  createdAt: string
  updatedAt: string
  // Computed counts
  questionCount?: number
  responseCount?: number
  participationCount?: number
  // For QUIZ type: link to the quiz link
  quizLink?: { id: string; slug: string; timeLimit: number } | null
}

export interface ActivityResponseDto {
  id: string
  activityId: string
  questionId?: string | null
  participantId?: string | null
  participantName?: string | null
  selectedOptions: number[]
  text?: string | null
  numberValue?: number | null
  ratingValue?: number | null
  metadata: {
    upvotes?: number
    approved?: boolean
    pinned?: boolean
    answered?: boolean
    hidden?: boolean
  }
  createdAt: string
  updatedAt: string
}

export interface ActivityParticipationDto {
  id: string
  activityId: string
  participantId: string
  status: "STARTED" | "COMPLETED" | "ABANDONED"
  startedAt: string
  completedAt?: string | null
}

// Poll/Survey result aggregation
export interface PollOptionResult {
  index: number
  label: string
  count: number
  percentage: number
}

export interface ActivityResultsDto {
  activityId: string
  type: ActivityType
  totalResponses: number
  totalParticipants?: number
  // For polls/voting: per-option breakdown
  options?: PollOptionResult[]
  // For Q&A: list of questions with upvote counts
  questions?: ActivityResponseDto[]
  // For surveys: per-question breakdown
  questionResults?: Array<{
    questionId: string
    questionText: string
    questionType: ActivityQuestionType
    optionResults?: PollOptionResult[]
    averageRating?: number
    textResponses?: string[]
    responseCount: number
  }>
}

// ─── Shareable Achievement Cards ───────────────────────────────────────────

export type AchievementType =
  | "QUIZ_RESULT"
  | "LIVE_QUIZ_RESULT"
  | "KNOWLEDGE_CHECK_RESULT"
  | "PRE_POST_RESULT"
  | "CERTIFICATE_EARNED"
  | "ACTIVITY_COMPLETED"
  | "EVENT_PARTICIPATION"
  | "LEADERBOARD_ACHIEVEMENT"

export type AchievementVisibility = "PRIVATE" | "LINK_ONLY" | "PUBLIC"

export type AchievementTemplateId =
  | "minimal"
  | "modern"
  | "professional"
  | "celebration"
  | "conference"

export type SharePlatform =
  | "NATIVE"
  | "WHATSAPP"
  | "LINKEDIN"
  | "FACEBOOK"
  | "X"
  | "COPY_LINK"
  | "DOWNLOAD"

export interface AchievementData {
  beforeScore?: number
  afterScore?: number
  improvement?: number // percentage points
  certificateNumber?: string
  certificateVerifyUrl?: string
  eventTitle?: string
  activityTitle?: string
  orgName?: string
  orgLogoUrl?: string
  [key: string]: unknown
}

export interface ShareableAchievementDto {
  id: string
  organizationId: string
  eventId?: string | null
  activityId?: string | null
  participantId?: string | null
  participantName: string
  type: AchievementType
  title: string
  subtitle?: string | null
  score?: number | null
  totalScore?: number | null
  percentage?: number | null
  rank?: number | null
  totalParticipants?: number | null
  achievementData: AchievementData
  publicToken: string
  visibility: AchievementVisibility
  imageUrl?: string | null
  imagePublicId?: string | null
  templateId: AchievementTemplateId
  certificateId?: string | null
  dataVersion: number
  createdAt: string
  updatedAt: string
  shareCount?: number
}

export interface PublicAchievementDto {
  // Only the safe, public fields — no internal IDs beyond the token
  type: AchievementType
  title: string
  subtitle?: string | null
  participantName: string
  score?: number | null
  totalScore?: number | null
  percentage?: number | null
  rank?: number | null
  totalParticipants?: number | null
  achievementData: AchievementData
  imageUrl?: string | null
  templateId: AchievementTemplateId
  visibility: AchievementVisibility
  createdAt: string
  // For OG metadata
  ogTitle: string
  ogDescription: string
}

export interface OrgAchievementStatsDto {
  totalAchievements: number
  totalShares: number
  sharesByPlatform: Record<SharePlatform, number>
}

// ─── Event Landing Page Builder ─────────────────────────────────────────────

export type LandingSectionType =
  | "HERO"
  | "ABOUT"
  | "SPEAKERS"
  | "SCHEDULE"
  | "SPONSORS"
  | "VENUE"
  | "AGENDA"
  | "FAQ"
  | "GALLERY"
  | "CTA"
  | "STATS"
  | "CUSTOM"

export interface LandingSectionBaseData {
  [key: string]: unknown
}

export interface LandingSectionDto {
  id: string
  eventId: string
  type: LandingSectionType
  title: string | null
  subtitle: string | null
  data: LandingSectionBaseData
  order: number
  isVisible: boolean
  createdAt: string
  updatedAt: string
}

// ── Per-type data shapes (informational — kept loose on the wire) ────────────
export interface HeroSectionData {
  title?: string
  subtitle?: string
  backgroundImageUrl?: string
  buttonText?: string
  buttonUrl?: string
}

export interface AboutSectionData {
  body?: string
}

export interface SpeakerItem {
  id: string
  name: string
  title?: string
  company?: string
  bio?: string
  avatarUrl?: string
}

export interface SpeakersSectionData {
  speakers: SpeakerItem[]
}

export interface ScheduleItem {
  id: string
  date?: string
  time?: string
  title: string
  description?: string
  speakerName?: string
  track?: string
}

export interface ScheduleSectionData {
  items: ScheduleItem[]
}

export interface SponsorItem {
  id: string
  name: string
  logoUrl?: string
  tier?: "gold" | "silver" | "bronze"
  websiteUrl?: string
}

export interface SponsorsSectionData {
  sponsors: SponsorItem[]
}

export interface VenueSectionData {
  name?: string
  address?: string
  mapUrl?: string
  imageUrl?: string
  capacity?: number
}

export interface AgendaItem {
  id: string
  time: string
  title: string
  description?: string
  location?: string
}

export interface AgendaSectionData {
  items: AgendaItem[]
}

export interface FaqItem {
  id: string
  question: string
  answer: string
}

export interface FaqSectionData {
  items: FaqItem[]
}

export interface GalleryItem {
  id: string
  imageUrl: string
  caption?: string
}

export interface GallerySectionData {
  items: GalleryItem[]
}

export interface CtaSectionData {
  buttonText?: string
  buttonUrl?: string
}

export interface StatItem {
  id: string
  label: string
  value: string
  icon?: string
}

export interface StatsSectionData {
  items: StatItem[]
}

export interface CustomSectionData {
  body?: string
}
