export interface Question {
  id: number;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  answer: 'A' | 'B' | 'C' | 'D';
}

export interface ShuffledOption {
  text: string;
  originalKey: 'A' | 'B' | 'C' | 'D';
}

export interface ExamQuestion extends Question {
  shuffledOptions: ShuffledOption[];
}

export type QuizMode = 'practice' | 'exam';

export interface UserAnswers {
  [index: number]: 'A' | 'B' | 'C' | 'D' | null;
}
