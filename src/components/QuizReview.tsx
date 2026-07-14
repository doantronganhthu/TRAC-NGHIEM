import React, { useState } from 'react';
import { ExamQuestion, UserAnswers } from '../types';
import { Award, RotateCcw, Check, X, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface QuizReviewProps {
  questions: ExamQuestion[];
  userAnswers: UserAnswers;
  timeSpent: number; // in seconds
  onRestart: () => void;
}

export const QuizReview: React.FC<QuizReviewProps> = ({
  questions,
  userAnswers,
  timeSpent,
  onRestart,
}) => {
  const [filter, setFilter] = useState<'all' | 'correct' | 'incorrect'>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Calculate results
  const total = questions.length;
  let correctCount = 0;
  let skippedCount = 0;

  questions.forEach((q, index) => {
    const ans = userAnswers[index];
    if (ans === null || ans === undefined) {
      skippedCount++;
    } else if (ans === q.answer) {
      correctCount++;
    }
  });

  const incorrectCount = total - correctCount - skippedCount;
  const scorePercent = Math.round((correctCount / total) * 100);

  // Format time
  const formatTime = (secs: number) => {
    const min = Math.floor(secs / 60);
    const sec = secs % 60;
    return `${min} phút ${sec < 10 ? '0' : ''}${sec} giây`;
  };

  // Determine feedback message
  let feedbackTitle = '';
  let feedbackDesc = '';
  let feedbackColor = '';

  if (scorePercent === 100) {
    feedbackTitle = 'Thật xuất sắc!';
    feedbackDesc = 'Bạn quả là một Thiên tài!';
    feedbackColor = 'text-emerald-700 bg-emerald-50';
  } else if (scorePercent >= 80) {
    feedbackTitle = 'Làm tốt lắm!';
    feedbackDesc = 'Bạn đã vượt qua kỳ thi này!';
    feedbackColor = 'text-indigo-700 bg-indigo-50';
  } else {
    feedbackTitle = 'Cố gắng lên!';
    feedbackDesc = 'Bạn sẽ làm tốt hơn ở lần sau!';
    feedbackColor = 'text-rose-600 bg-rose-50';
  }

  // Filtered list
  const filteredQuestions = questions.filter((q, index) => {
    const ans = userAnswers[index];
    const isCorrect = ans === q.answer;
    if (filter === 'correct') return isCorrect;
    if (filter === 'incorrect') return !isCorrect;
    return true;
  });

  const toggleExpand = (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
    }
  };

  return (
    <div id="quiz-review-container" className="space-y-8 w-full max-w-4xl mx-auto">
      {/* Score Header Card */}
      <div id="score-header-card" className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-center gap-8">
        
        {/* Progress Circle Visualizer */}
        <div id="score-meter-visual" className="flex-shrink-0 relative w-40 h-40 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            {/* Background Track */}
            <circle
              cx="80"
              cy="80"
              r="70"
              className="stroke-slate-100 fill-none"
              strokeWidth="12"
            />
            {/* Active Percentage Path */}
            <motion.circle
              cx="80"
              cy="80"
              r="70"
              id="progress-ring-circle"
              className={`fill-none ${
                scorePercent >= 80 ? 'stroke-emerald-500' : scorePercent >= 50 ? 'stroke-indigo-500' : 'stroke-rose-500'
              }`}
              strokeWidth="12"
              strokeDasharray={440}
              initial={{ strokeDashoffset: 440 }}
              animate={{ strokeDashoffset: 440 - (440 * scorePercent) / 100 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute text-center">
            <span className="text-3xl font-extrabold text-slate-800 font-mono">
              {scorePercent}%
            </span>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-0.5">
              Hoàn Thành
            </p>
          </div>
        </div>

        {/* Text Analytics */}
        <div className="flex-1 space-y-4 text-center md:text-left w-full">
          <div className={`inline-block px-4 py-2 rounded-2xl text-sm font-bold ${feedbackColor}`}>
            {feedbackTitle}
          </div>
          <h1 className="text-2xl font-bold text-slate-800 leading-tight">
            Kết quả: {correctCount}/{total} câu đúng
          </h1>
          <p className="text-slate-600 text-sm leading-relaxed max-w-lg">
            {feedbackDesc}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-2">
            <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100/50 text-center col-span-1">
              <span className="block text-xs font-semibold text-emerald-600">Đúng</span>
              <span className="text-sm font-bold text-emerald-700 font-mono mt-0.5 inline-block">
                {correctCount}
              </span>
            </div>
            <div className="bg-rose-50/50 p-3 rounded-2xl border border-rose-100/50 text-center col-span-1">
              <span className="block text-xs font-semibold text-rose-600">Sai</span>
              <span className="text-sm font-bold text-rose-700 font-mono mt-0.5 inline-block">
                {incorrectCount + skippedCount}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center col-span-2">
              <span className="block text-xs font-semibold text-slate-500">Thời gian làm bài</span>
              <span className="text-sm font-bold text-slate-800 font-mono mt-0.5 inline-block">
                {formatTime(timeSpent)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary CTA and Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div id="results-filter-tabs" className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 bg-transparent'
            }`}
          >
            Tất cả ({total})
          </button>
          <button
            onClick={() => setFilter('correct')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filter === 'correct'
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'text-emerald-600 hover:bg-emerald-50/60 bg-transparent'
            }`}
          >
            Đúng ({correctCount})
          </button>
          <button
            onClick={() => setFilter('incorrect')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filter === 'incorrect'
                ? 'bg-rose-500 text-white shadow-xs'
                : 'text-rose-600 hover:bg-rose-50/60 bg-transparent'
            }`}
          >
            Sai ({incorrectCount + skippedCount})
          </button>
        </div>

        <button
          onClick={onRestart}
          id="quiz-restart-after-results"
          className="w-full sm:w-auto px-6 py-3 bg-indigo-650 hover:bg-slate-800 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer bg-slate-900"
        >
          <RotateCcw className="w-4 h-4" />
          Về Trang Chủ
        </button>
      </div>

      {/* Question Review List */}
      <div id="questions-review-list" className="space-y-4">
        {filteredQuestions.length === 0 ? (
          <div className="p-12 text-center bg-slate-50 border border-slate-100 rounded-2xl">
            <p className="text-slate-500 text-sm">Không tìm thấy câu hỏi nào tương ứng.</p>
          </div>
        ) : (
          filteredQuestions.map((q, idx) => {
            // Find absolute index in the exam state list
            const originalExamIdx = questions.findIndex(item => item.id === q.id);
            const selectedAns = userAnswers[originalExamIdx];
            const isCorrect = selectedAns === q.answer;
            const isSkipped = selectedAns === null || selectedAns === undefined;
            const isExpanded = expandedId === q.id;

            return (
              <div
                key={`review-${q.id}`}
                id={`review-item-${q.id}`}
                className={`bg-white border rounded-2xl overflow-hidden shadow-xs transition-all ${
                  isCorrect
                    ? 'border-emerald-100 hover:border-emerald-200'
                    : isSkipped
                    ? 'border-slate-200 hover:border-slate-350'
                    : 'border-rose-100 hover:border-rose-200'
                }`}
              >
                {/* Accordion Trigger Header */}
                <div
                  onClick={() => toggleExpand(q.id)}
                  className="p-4 sm:p-5 flex items-start gap-4 cursor-pointer select-none"
                >
                  <div className="mt-1 flex-shrink-0">
                    {isCorrect ? (
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <Check className="w-4 h-4" />
                      </div>
                    ) : isSkipped ? (
                      <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-mono">
                        ?
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-750 flex items-center justify-center">
                        <X className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 font-mono">
                        Câu {originalExamIdx + 1}
                      </span>
                      {isSkipped && (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded">
                          Chưa trả lời
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-slate-800 font-sans leading-relaxed">
                      {q.question}
                    </p>
                  </div>

                  <div className="flex-shrink-0 text-slate-400 mt-1">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>

                {/* Expanded Answer Keying Layout */}
                {isExpanded && (
                  <div className="border-t border-slate-50 bg-slate-50/50 p-4 sm:p-5 space-y-4">
                    <div className="grid grid-cols-1 gap-3.5">
                      {q.shuffledOptions.map((opt, oIdx) => {
                        const isOptSelected = selectedAns === opt.originalKey;
                        const isOptCorrect = opt.originalKey === q.answer;

                        let optClass = "p-3.5 text-xs sm:text-sm rounded-xl border bg-white flex items-start gap-3 ";
                        if (isOptCorrect) {
                          optClass += "border-emerald-300 bg-emerald-50/50 text-emerald-900";
                        } else if (isOptSelected) {
                          optClass += "border-rose-300 bg-rose-50/50 text-rose-900";
                        } else {
                          optClass += "border-slate-100 text-slate-800 opacity-90";
                        }

                        const letter = String.fromCharCode(65 + oIdx);

                        return (
                          <div key={oIdx} className={optClass}>
                            <span className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                              isOptCorrect
                                ? 'bg-emerald-500 text-white'
                                : isOptSelected
                                ? 'bg-rose-500 text-white'
                                : 'bg-slate-100 text-slate-500'
                            }`}>
                              {letter}
                            </span>
                            <div className="flex-1">
                              <p className="leading-normal">{opt.text}</p>
                              {isOptCorrect && (
                                <span className="inline-block mt-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                                  Đáp án đúng (nguyên gốc: {q.answer})
                                </span>
                              )}
                              {isOptSelected && !isOptCorrect && (
                                <span className="inline-block mt-1 text-[10px] font-bold text-rose-800 bg-rose-100 px-1.5 py-0.5 rounded">
                                  Lựa chọn của bạn
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
