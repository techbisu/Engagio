// Shared types for QuizMaster Pro

export type ViewName =
  | "landing"
  | "login"
  | "admin"
  | "student"
  | "quiz"
  | "results"

export type AdminTab =
  | "dashboard"
  | "events"
  | "questions"
  | "links"
  | "attempts"
  | "users"

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

/** Question as seen by the student (correctAnswer/correctText hidden). */
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
  /** True iff scoring is visible to student (`!publishResults || publishedAt != null`). */
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
