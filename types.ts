export interface Session {
  id: string;
  topic: string;
  level: string;
  language: string;
  explanation: string;
  timestamp: number;
  audioUrl?: string;
  quizScore?: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}
