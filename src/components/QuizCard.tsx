import React from 'react';
import { ExamQuestion, QuizMode } from '../types';
import { motion } from 'motion/react';
import { HelpCircle, Check, X, ShieldAlert } from 'lucide-react';

interface QuizCardProps {
  question: ExamQuestion;
  currentIndex: number;
  totalQuestions: number;
  selectedAnswer: 'A' | 'B' | 'C' | 'D' | null;
  onSelectAnswer: (key: 'A' | 'B' | 'C' | 'D') => void;
  mode: QuizMode;
  isDarkMode?: boolean;
}

export const QuizCard: React.FC<QuizCardProps> = ({
  question,
  currentIndex,
  totalQuestions,
  selectedAnswer,
  onSelectAnswer,
  mode,
  isDarkMode = false,
}) => {
  // If we are in practice mode and the user has answered, reveal the correctness
  const isAnswered = selectedAnswer !== null;

  return (
    <div id="quiz-card-container" className="flex flex-col gap-4 w-full">
      {/* Header Info */}
      <div id="quiz-card-header" className={`flex items-center justify-between border-b pb-3 ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${
            mode === 'exam' 
              ? isDarkMode ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-indigo-50 text-indigo-700' 
              : isDarkMode ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700'
          }`}>
            {mode === 'exam' ? 'Thi thử' : 'Luyện tập'}
          </span>
        </div>
        <span className={`text-xs uppercase tracking-widest font-bold font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>
          Câu {currentIndex + 1} / {totalQuestions}
        </span>
      </div>

      {/* Question Content */}
      <div id="quiz-question-wrapper" className="space-y-2">
        <div className="flex gap-3 items-start">
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold shrink-0 mt-0.5 font-mono ${
            isDarkMode ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/35' : 'bg-indigo-50 text-indigo-700'
          }`}>
            CÂU {currentIndex + 1}
          </span>
          <h2 id="quiz-question-text" className={`text-base sm:text-lg font-semibold leading-relaxed font-sans ${
            isDarkMode ? 'text-slate-100' : 'text-slate-850'
          }`}>
            {question.question}
          </h2>
        </div>
      </div>

      {/* Options Grid */}
      <div id="quiz-options-grid" className="grid grid-cols-1 gap-2.5 sm:gap-3 mt-3">
        {question.shuffledOptions.map((option, idx) => {
          const { originalKey, text } = option;
          const isSelected = selectedAnswer === originalKey;
          const isCorrect = originalKey === question.answer;

          // Determine Tailwind styles for option buttons
          let buttonClass = "group flex items-center w-full p-3.5 sm:p-4 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer text-xs sm:text-sm leading-relaxed ";
          let labelClass = "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold mr-3 shrink-0 transition-all border ";

          if (mode === 'practice' && isAnswered) {
            // practice mode with answer revealed
            if (isCorrect) {
              // This is the correct option
              if (isDarkMode) {
                buttonClass += "border-emerald-500 bg-emerald-500/10 text-emerald-250 shadow-xs ";
                labelClass += "bg-emerald-500 text-white border-emerald-500 ";
              } else {
                buttonClass += "border-emerald-500 bg-emerald-50/40 text-emerald-950 shadow-xs ";
                labelClass += "bg-emerald-500 text-white border-emerald-500 ";
              }
            } else if (isSelected) {
              // User selected this and it's incorrect
              if (isDarkMode) {
                buttonClass += "border-rose-500 bg-rose-500/15 text-rose-250 ";
                labelClass += "bg-rose-500 text-white border-rose-500 ";
              } else {
                buttonClass += "border-rose-400 bg-rose-50/40 text-rose-950 ";
                labelClass += "bg-rose-500 text-white border-rose-500 ";
              }
            } else {
              // Unselected and incorrect options
              if (isDarkMode) {
                buttonClass += "border-white/5 bg-white/[0.01] text-slate-500 opacity-40 cursor-not-allowed ";
                labelClass += "bg-white/5 text-slate-500 border-white/10 ";
              } else {
                buttonClass += "border-slate-100 bg-slate-50/20 text-slate-400 opacity-50 cursor-not-allowed ";
                labelClass += "bg-slate-100 text-slate-450 border-slate-200 ";
              }
            }
          } else {
            // Exam mode or practice mode before answering
            if (isSelected) {
              if (isDarkMode) {
                buttonClass += "border-indigo-500 bg-indigo-500/10 text-indigo-100 shadow-[0_0_15px_rgba(99,102,241,0.3)] ring-4 ring-indigo-500/20 ";
                labelClass += "bg-indigo-500 text-white border-indigo-500 ";
              } else {
                buttonClass += "border-indigo-700 bg-indigo-50/30 text-indigo-950 shadow-sm ring-4 ring-indigo-100/50 ";
                labelClass += "bg-indigo-700 text-white border-indigo-700 ";
              }
            } else {
              if (isDarkMode) {
                buttonClass += "border-white/10 bg-white/[0.03] hover:border-indigo-400 hover:bg-white/[0.07] text-slate-300 ";
                labelClass += "bg-white/5 border-white/15 text-slate-300 group-hover:bg-indigo-500 group-hover:text-white group-hover:border-indigo-500 ";
              } else {
                buttonClass += "border-slate-200 bg-slate-50/40 hover:border-indigo-500 hover:bg-indigo-50/15 text-slate-700 ";
                labelClass += "bg-slate-100 border-slate-300 text-slate-600 group-hover:bg-indigo-700 group-hover:text-white group-hover:border-indigo-700 ";
              }
            }
          }

          // Option Alphabet prefix A, B, C, D (based on vertical index of this block)
          const optionLetter = String.fromCharCode(65 + idx);

          return (
            <motion.button
              key={`${question.id}-opt-${idx}`}
              id={`option-${idx}`}
              onClick={() => {
                if (mode === 'practice' && isAnswered) return; // disable clicks once answered in practice mode
                onSelectAnswer(originalKey);
              }}
              whileTap={{ scale: mode === 'practice' && isAnswered ? 1 : 0.995 }}
              className={buttonClass}
              disabled={mode === 'practice' && isAnswered}
            >
              <span className={labelClass}>
                {optionLetter}
              </span>
              <span className={`flex-1 font-normal pr-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-750'}`}>{text}</span>

              {/* Status Icons for practice mode */}
              {mode === 'practice' && isAnswered && (
                <div className="flex-shrink-0 ml-2">
                  {isCorrect && (
                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                  {isSelected && !isCorrect && (
                    <div className="w-6 h-6 rounded-full bg-rose-500 flex items-center justify-center text-white">
                      <X className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>


    </div>
  );
};
