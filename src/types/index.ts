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
  createdAt: string
  questionCount?: number
  linkCount?: number
  attemptCount?: number
}

export interface QuestionDto {
  id: string
  eventId: string
  question: string
  options: string[]
  correctAnswer: number
  marks: number
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
  showResults: boolean
  passThreshold: number
  requireFullscreen: boolean
  createdAt: string
  expiresAt?: string | null
  event?: Pick<EventDto, "id" | "title" | "description"> & { image?: string | null }
}

/** Question as seen by the student (correctAnswer hidden). */
export interface PublicQuestion {
  id: string
  question: string
  options: string[]
  marks: number
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
  timeTaken: number | null
  status: AttemptStatus
  startedAt: string
  completedAt: string | null
  answers?: Record<string, number> | null
  questionOrder?: string[] | null
  user?: { name: string | null; email: string; image?: string | null }
  event?: { id: string; title: string }
  quizLink?: { slug: string }
}

export interface CsvRow {
  question: string
  options: string[]
  correctAnswer: number
  marks?: number
  explanation?: string
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
