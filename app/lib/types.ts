export type UserRole = 'resident' | 'admin' | 'guest'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  department?: string
  year_of_training?: number
  is_active: boolean
  password_changed_at: string
  created_at: string
}

export interface Case {
  id: string
  case_number: string
  title: string
  chief_complaint: string
  history: string
  physical_exam: string
  vital_signs?: Record<string, string>
  lab_results?: Record<string, string>
  correct_diagnosis: string
  differential_diagnoses: string[]
  scoring_rubric: ScoringRubric
  difficulty: 'easy' | 'medium' | 'hard'
  category?: string
  is_active: boolean
}

export interface ScoringRubric {
  correct_diagnosis: number
  differential_list: number
  reasoning: number
  management: number
}

export interface Result {
  id: string
  user_id: string
  case_id: string
  score: number
  is_passed: boolean
  answers: Record<string, string>
  ai_feedback?: string
  time_spent_seconds?: number
  completed_at: string
  cases?: Case
}

export interface Announcement {
  id: string
  title: string
  body: string
  is_published: boolean
  target_role: string
  published_at?: string
  created_at: string
}

export interface AuthState {
  user: User | null
  isLoading: boolean
  isTrialMode: boolean
}
