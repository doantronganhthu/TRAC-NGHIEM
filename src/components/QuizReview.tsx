import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ExamQuestion, UserAnswers } from '../types';
import { Award, RotateCcw, Check, X, ChevronDown, ChevronUp, AlertCircle, Printer, Info } from 'lucide-react';
import { motion } from 'motion/react';

interface QuizReviewProps {
  questions: ExamQuestion[];
  userAnswers: UserAnswers;
  timeSpent: number; // in seconds
  onRestart: () => void;
  isDarkMode?: boolean;
  studentName?: string;
  examTitle?: string;
}

export const QuizReview: React.FC<QuizReviewProps> = ({
  questions,
  userAnswers,
  timeSpent,
  onRestart,
  isDarkMode = false,
  studentName = 'Học viên',
  examTitle = 'Bộ đề thi',
}) => {
  const [filter, setFilter] = useState<'all' | 'correct' | 'incorrect'>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showPrintConfirm, setShowPrintConfirm] = useState(false);

  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();

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
    feedbackColor = isDarkMode ? 'text-emerald-300 bg-emerald-500/20 border border-emerald-500/30' : 'text-emerald-700 bg-emerald-50';
  } else if (scorePercent >= 80) {
    feedbackTitle = 'Làm tốt lắm!';
    feedbackDesc = 'Bạn đã vượt qua kỳ thi này!';
    feedbackColor = isDarkMode ? 'text-indigo-300 bg-indigo-500/20 border border-indigo-500/30' : 'text-indigo-700 bg-indigo-50';
  } else {
    feedbackTitle = 'Cố gắng lên!';
    feedbackDesc = 'Bạn sẽ làm tốt hơn ở lần sau!';
    feedbackColor = isDarkMode ? 'text-rose-300 bg-rose-500/20 border border-rose-500/30' : 'text-rose-600 bg-rose-50';
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

  const handlePrintButtonClick = () => {
    setShowPrintConfirm(true);
  };

  const executePrint = () => {
    setShowPrintConfirm(false);
    // Call window.print directly inside user event to satisfy browser heuristics
    window.print();
  };

  return (
    <>
      <div id="quiz-review-container" className="space-y-8 w-full max-w-4xl mx-auto">
        {/* Score Header Card */}
        <div id="score-header-card" className={`relative border rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center gap-8 ${
          isDarkMode 
            ? 'bg-[#0f172a]/60 border-white/10 text-white backdrop-blur-xl shadow-2xl' 
            : 'bg-white border-slate-100 text-slate-900 shadow-sm'
        }`}>
          {/* Export PDF Button */}
          <button
            onClick={handlePrintButtonClick}
            title="In kết quả / Xuất PDF"
            className={`absolute top-4 right-4 p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              isDarkMode 
                ? 'bg-white/5 hover:bg-white/15 border-white/10 hover:border-indigo-400 text-indigo-300' 
                : 'bg-slate-50 hover:bg-indigo-50 border-slate-200 hover:border-indigo-300 text-indigo-600'
            }`}
          >
            <Printer className="w-5 h-5" />
          </button>
        
        {/* Progress Circle Visualizer */}
        <div id="score-meter-visual" className="flex-shrink-0 relative w-40 h-40 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            {/* Background Track */}
            <circle
              cx="80"
              cy="80"
              r="70"
              className={`fill-none ${isDarkMode ? 'stroke-white/5' : 'stroke-slate-100'}`}
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
            <span className={`text-3xl font-extrabold font-mono ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              {scorePercent}%
            </span>
            <p className={`text-xs font-semibold uppercase tracking-widest mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Hoàn Thành
            </p>
          </div>
        </div>

        {/* Text Analytics */}
        <div className="flex-1 space-y-4 text-center md:text-left w-full">
          <div className={`inline-block px-4 py-2 rounded-2xl text-sm font-bold ${feedbackColor}`}>
            {feedbackTitle}
          </div>
          <h1 className={`text-2xl font-bold leading-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
            Kết quả: {correctCount}/{total} câu đúng
          </h1>
          <p className={`text-sm leading-relaxed max-w-lg ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            {feedbackDesc}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-2">
            <div className={`p-3 rounded-2xl text-center col-span-1 border ${
              isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-350' : 'bg-emerald-50/50 border-emerald-100/50 text-emerald-700'
            }`}>
              <span className="block text-xs font-semibold opacity-90">Đúng</span>
              <span className="text-sm font-bold font-mono mt-0.5 inline-block">
                {correctCount}
              </span>
            </div>
            <div className={`p-3 rounded-2xl text-center col-span-1 border ${
              isDarkMode ? 'bg-rose-500/10 border-rose-500/20 text-rose-350' : 'bg-rose-50/50 border-rose-100/50 text-rose-700'
            }`}>
              <span className="block text-xs font-semibold opacity-90">Sai</span>
              <span className="text-sm font-bold font-mono mt-0.5 inline-block">
                {incorrectCount + skippedCount}
              </span>
            </div>
            <div className={`p-3 rounded-2xl text-center col-span-2 border ${
              isDarkMode ? 'bg-white/[0.03] border-white/10 text-slate-250' : 'bg-slate-50 border-slate-100 text-slate-800'
            }`}>
              <span className={`block text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Thời gian làm bài</span>
              <span className="text-sm font-bold font-mono mt-0.5 inline-block">
                {formatTime(timeSpent)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary CTA and Controls */}
      <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 border-b pb-5 ${
        isDarkMode ? 'border-white/10' : 'border-slate-100'
      }`}>
        <div id="results-filter-tabs" className={`flex p-1 rounded-xl ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-slate-100'}`}>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filter === 'all'
                ? isDarkMode ? 'bg-white text-slate-950 shadow-md' : 'bg-slate-800 text-white shadow-xs'
                : isDarkMode ? 'text-slate-400 hover:text-white bg-transparent' : 'text-slate-600 hover:text-slate-900 bg-transparent'
            }`}
          >
            Tất cả ({total})
          </button>
          <button
            onClick={() => setFilter('correct')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filter === 'correct'
                ? 'bg-emerald-500 text-white shadow-xs'
                : isDarkMode ? 'text-emerald-400 hover:bg-emerald-500/10 bg-transparent' : 'text-emerald-600 hover:bg-emerald-50/60 bg-transparent'
            }`}
          >
            Đúng ({correctCount})
          </button>
          <button
            onClick={() => setFilter('incorrect')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filter === 'incorrect'
                ? 'bg-rose-500 text-white shadow-xs'
                : isDarkMode ? 'text-rose-400 hover:bg-rose-500/10 bg-transparent' : 'text-rose-600 hover:bg-rose-50/60 bg-transparent'
            }`}
          >
            Sai ({incorrectCount + skippedCount})
          </button>
        </div>

        <button
          onClick={onRestart}
          id="quiz-restart-after-results"
          className={`w-full sm:w-auto px-6 py-3 font-bold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
            isDarkMode 
              ? 'bg-indigo-500 hover:bg-indigo-650 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' 
              : 'bg-slate-900 hover:bg-slate-800 text-white'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          Về Trang Chủ
        </button>
      </div>

      {/* Question Review List */}
      <div id="questions-review-list" className="space-y-4">
        {filteredQuestions.length === 0 ? (
          <div className={`p-12 text-center border rounded-2xl ${
            isDarkMode ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50 border-slate-100'
          }`}>
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
                className={`border rounded-2xl overflow-hidden shadow-xs transition-all ${
                  isDarkMode
                    ? isCorrect
                      ? 'border-emerald-500/20 bg-white/[0.03] hover:border-emerald-500/40 hover:bg-white/[0.05]'
                      : isSkipped
                      ? 'border-white/5 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]'
                      : 'border-rose-500/20 bg-white/[0.03] hover:border-rose-500/40 hover:bg-white/[0.05]'
                    : isCorrect
                    ? 'border-emerald-100 hover:border-emerald-200 bg-white'
                    : isSkipped
                    ? 'border-slate-200 hover:border-slate-350 bg-white'
                    : 'border-rose-100 hover:border-rose-200 bg-white'
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
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono ${
                        isDarkMode ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'
                      }`}>
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
                      <span className={`text-xs font-bold font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>
                        Câu {originalExamIdx + 1}
                      </span>
                      {isSkipped && (
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                          isDarkMode ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-600'
                        }`}>
                          Chưa trả lời
                        </span>
                      )}
                    </div>
                    <p className={`text-sm font-medium font-sans leading-relaxed ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                      {q.question}
                    </p>
                  </div>

                  <div className={`flex-shrink-0 mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>

                {/* Expanded Answer Keying Layout */}
                {isExpanded && (
                  <div className={`border-t p-4 sm:p-5 space-y-4 ${
                    isDarkMode ? 'border-white/5 bg-white/[0.01]' : 'border-slate-50 bg-slate-50/50'
                  }`}>
                    <div className="grid grid-cols-1 gap-3.5">
                      {q.shuffledOptions.map((opt, oIdx) => {
                        const isOptSelected = selectedAns === opt.originalKey;
                        const isOptCorrect = opt.originalKey === q.answer;

                        let optClass = "p-3.5 text-xs sm:text-sm rounded-xl border flex items-start gap-3 transition-colors ";
                        if (isOptCorrect) {
                          if (isDarkMode) {
                            optClass += "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
                          } else {
                            optClass += "border-emerald-300 bg-emerald-50/50 text-emerald-900";
                          }
                        } else if (isOptSelected) {
                          if (isDarkMode) {
                            optClass += "border-rose-500/35 bg-rose-500/10 text-rose-200";
                          } else {
                            optClass += "border-rose-300 bg-rose-50/50 text-rose-900";
                          }
                        } else {
                          if (isDarkMode) {
                            optClass += "border-white/5 bg-white/[0.02] text-slate-300 opacity-90";
                          } else {
                            optClass += "border-slate-100 bg-white text-slate-800 opacity-90";
                          }
                        }

                        const letter = String.fromCharCode(65 + oIdx);

                        return (
                          <div key={oIdx} className={optClass}>
                            <span className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                              isOptCorrect
                                ? 'bg-emerald-500 text-white'
                                : isOptSelected
                                ? 'bg-rose-500 text-white'
                                : isDarkMode ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-500'
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

    {showPrintConfirm && (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md no-print">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`w-full max-w-sm p-6 rounded-2xl border shadow-2xl space-y-4 text-left ${
            isDarkMode 
              ? 'bg-slate-900 border-white/10 text-white' 
              : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold">In kết quả bài thi</h3>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Bạn có chắc chắn muốn in kết quả này?</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              onClick={() => setShowPrintConfirm(false)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                isDarkMode 
                  ? 'bg-white/5 hover:bg-white/10 text-slate-300' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Hủy bỏ
            </button>
            <button
              onClick={executePrint}
              className="px-5 py-2 rounded-xl text-xs font-bold cursor-pointer bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white shadow-md shadow-indigo-500/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Xác nhận in
            </button>
          </div>
        </motion.div>
      </div>
    )}

    {createPortal(
      <div id="quiz-print-area" className="hidden print:block bg-white text-slate-900 p-8">
        {/* Header matching user template */}
        <div className="text-center pb-5 mb-6 space-y-2">
          <h1 className="text-2xl font-extrabold text-slate-900 uppercase tracking-tight">
            KẾT QUẢ KỲ THI
          </h1>
          <h2 className="text-lg font-bold text-slate-800">
            {examTitle}
          </h2>
          <p className="text-xs text-slate-500 italic">
            Ngày {day} tháng {month} năm {year}
          </p>
          <p className="text-sm text-slate-800 pt-1">
            <span className="font-bold underline">Nhân viên:</span>{' '}
            <span className="font-extrabold text-indigo-600 px-3 py-1 rounded-xl bg-indigo-50 border border-indigo-100 shadow-sm inline-block">
              {studentName}
            </span>
          </p>
        </div>

        {/* Stats Card */}
        <div className="border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-row items-center gap-8 bg-slate-50/50 mb-4 page-break-avoid">
          {/* Circle Visualizer using static SVG */}
          <div className="flex-shrink-0 relative w-24 h-24 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="48" cy="48" r="40" className="fill-none stroke-slate-200" strokeWidth="8" />
              <circle
                cx="48"
                cy="48"
                r="40"
                className={`fill-none ${
                  scorePercent >= 80 ? 'stroke-emerald-500' : scorePercent >= 50 ? 'stroke-indigo-500' : 'stroke-rose-500'
                }`}
                strokeWidth="8"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 - (251.2 * scorePercent) / 100}
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-xl font-extrabold font-mono text-slate-800">
                {scorePercent}%
              </span>
              <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Đạt</p>
            </div>
          </div>

          {/* Score Text */}
          <div className="flex-1 space-y-2">
            <div className={`inline-block px-3 py-1 rounded-xl text-xs font-bold ${
              scorePercent >= 80 ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : scorePercent >= 50 ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'bg-rose-100 text-rose-850 border border-rose-200'
            }`}>
              {feedbackTitle}
            </div>
            <h2 className="text-base font-bold text-slate-800">
              Kết quả: {correctCount}/{total} câu đúng
            </h2>
            <p className="text-xs text-slate-600">
              {feedbackDesc}
            </p>

            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="p-2 rounded-xl text-center border bg-white border-slate-200">
                <span className="block text-[9px] font-bold uppercase text-slate-500">Đúng</span>
                <span className="text-xs font-bold font-mono mt-0.5 inline-block text-emerald-600">{correctCount}</span>
              </div>
              <div className="p-2 rounded-xl text-center border bg-white border-slate-200">
                <span className="block text-[9px] font-bold uppercase text-slate-500">Sai / Bỏ qua</span>
                <span className="text-xs font-bold font-mono mt-0.5 inline-block text-rose-600">{incorrectCount + skippedCount}</span>
              </div>
              <div className="p-2 rounded-xl text-center border bg-white border-slate-200">
                <span className="block text-[9px] font-bold uppercase text-slate-500">Thời gian</span>
                <span className="text-xs font-bold font-mono mt-0.5 inline-block text-slate-700">{formatTime(timeSpent)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Custom requested gap to fill vertical portrait A4 page perfectly with exactly 1 question */}
        <div className="h-36 no-print-height" />

        {/* List of Questions */}
        <div className="space-y-6">
          <h3 className="text-base font-extrabold text-slate-900 border-b-2 border-slate-900 pb-1 mb-6 uppercase inline-block">
            <u>DANH SÁCH CÂU HỎI ĐÃ LÀM:</u>
          </h3>

          {/* FIRST QUESTION (Always on page 1) */}
          {questions.length > 0 && (() => {
            const q = questions[0];
            const selectedAns = userAnswers[0];
            const isCorrect = selectedAns === q.answer;
            const isSkipped = selectedAns === null || selectedAns === undefined;

            return (
              <div className="border border-slate-200 rounded-2xl overflow-hidden page-break-avoid bg-white">
                <div className="p-4 sm:p-5 flex items-start gap-4 bg-slate-50/30">
                  <div className="mt-0.5 flex-shrink-0">
                    {isCorrect ? (
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                        ✓
                      </div>
                    ) : isSkipped ? (
                      <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xs">
                        ?
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">
                        ✗
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold font-mono text-slate-400">CÂU 1</span>
                      {isSkipped && (
                        <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-slate-100 text-slate-600">
                          Chưa trả lời
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed">
                      {q.question}
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-100 bg-white p-4 sm:p-5 space-y-2.5">
                  {q.shuffledOptions.map((opt, oIdx) => {
                    const isOptSelected = selectedAns === opt.originalKey;
                    const isOptCorrect = opt.originalKey === q.answer;

                    let optClass = "p-3 text-xs rounded-xl border flex items-start gap-3 bg-white border-slate-200 text-slate-800";
                    if (isOptCorrect) {
                      optClass = "p-3 text-xs rounded-xl border flex items-start gap-3 bg-emerald-50 border-emerald-300 text-emerald-900";
                    } else if (isOptSelected) {
                      optClass = "p-3 text-xs rounded-xl border flex items-start gap-3 bg-rose-50 border-rose-300 text-rose-900";
                    }

                    const letter = String.fromCharCode(65 + oIdx);

                    return (
                      <div key={oIdx} className={optClass}>
                        <span className={`w-5 h-5 rounded flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                          isOptCorrect
                            ? 'bg-emerald-500 text-white'
                            : isOptSelected
                            ? 'bg-rose-500 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {letter}
                        </span>
                        <div className="flex-1">
                          <p className="leading-normal font-medium">{opt.text}</p>
                          {isOptCorrect && (
                            <span className="inline-block mt-1 text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                              Đáp án đúng
                            </span>
                          )}
                          {isOptSelected && !isOptCorrect && (
                            <span className="inline-block mt-1 text-[9px] font-bold text-rose-800 bg-rose-100 px-1.5 py-0.5 rounded">
                              Lựa chọn của bạn
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* REMAINING QUESTIONS (Pushed to page 2 and onwards) */}
          {questions.length > 1 && (
            <>
              {/* Force clean page break after page 1's question */}
              <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }} />

              <div className="space-y-6 pt-4">
                {questions.slice(1).map((q, idx) => {
                  const qIdx = idx + 1;
                  const selectedAns = userAnswers[qIdx];
                  const isCorrect = selectedAns === q.answer;
                  const isSkipped = selectedAns === null || selectedAns === undefined;

                  return (
                    <div
                      key={q.id}
                      className="border border-slate-200 rounded-2xl overflow-hidden page-break-avoid bg-white"
                    >
                      <div className="p-4 sm:p-5 flex items-start gap-4 bg-slate-50/30">
                        <div className="mt-0.5 flex-shrink-0">
                          {isCorrect ? (
                            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                              ✓
                            </div>
                          ) : isSkipped ? (
                            <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xs">
                              ?
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">
                              ✗
                            </div>
                          )}
                        </div>

                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold font-mono text-slate-400">CÂU {qIdx + 1}</span>
                            {isSkipped && (
                              <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-slate-100 text-slate-600">
                                Chưa trả lời
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed">
                            {q.question}
                          </p>
                        </div>
                      </div>

                      {/* Options */}
                      <div className="border-t border-slate-100 bg-white p-4 sm:p-5 space-y-2.5">
                        {q.shuffledOptions.map((opt, oIdx) => {
                          const isOptSelected = selectedAns === opt.originalKey;
                          const isOptCorrect = opt.originalKey === q.answer;

                          let optClass = "p-3 text-xs rounded-xl border flex items-start gap-3 bg-white border-slate-200 text-slate-800";
                          if (isOptCorrect) {
                            optClass = "p-3 text-xs rounded-xl border flex items-start gap-3 bg-emerald-50 border-emerald-300 text-emerald-900";
                          } else if (isOptSelected) {
                            optClass = "p-3 text-xs rounded-xl border flex items-start gap-3 bg-rose-50 border-rose-300 text-rose-900";
                          }

                          const letter = String.fromCharCode(65 + oIdx);

                          return (
                            <div key={oIdx} className={optClass}>
                              <span className={`w-5 h-5 rounded flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                                isOptCorrect
                                  ? 'bg-emerald-500 text-white'
                                  : isOptSelected
                                  ? 'bg-rose-500 text-white'
                                  : 'bg-slate-100 text-slate-500'
                              }`}>
                                {letter}
                              </span>
                              <div className="flex-1">
                                <p className="leading-normal font-medium">{opt.text}</p>
                                {isOptCorrect && (
                                  <span className="inline-block mt-1 text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                                    Đáp án đúng
                                  </span>
                                )}
                                {isOptSelected && !isOptCorrect && (
                                  <span className="inline-block mt-1 text-[9px] font-bold text-rose-800 bg-rose-100 px-1.5 py-0.5 rounded">
                                    Lựa chọn của bạn
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>,
      document.body
    )}

    </>
  );
};
