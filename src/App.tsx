import React, { useState, useEffect, useMemo, useRef, ChangeEvent } from 'react';
import { QUESTION_BANK } from './questions';
import { Question, ExamQuestion, QuizMode, UserAnswers } from './types';
import { QuizCard } from './components/QuizCard';
import { db } from './firebase';
import { collection, doc, setDoc, getDocs, onSnapshot, query, orderBy, writeBatch, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { QuizReview } from './components/QuizReview';
import logoImg from './Logo.png';
import logo2Img from './Logo2.png';
import { 
  Award, 
  Clock, 
  HelpCircle, 
  Play, 
  BookOpen, 
  CheckCircle2, 
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  BookMarked,
  Layers,
  Sparkles,
  Info,
  Menu,
  X,
  Plus,
  AlertCircle,
  Trash2,
  Calendar,
  User,
  LogOut,
  Eye,
  EyeOff,
  ChevronDown,
  GripVertical,
  Download,
  Sun,
  Moon,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const formatSubmitDateTime = (date: Date): string => {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  const HH = String(date.getHours()).padStart(2, '0');
  const MM = String(date.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} ${HH}:${MM}`;
};

const formatDuration = (secs: number | undefined): string => {
  if (secs === undefined || isNaN(secs)) return '--:--';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

interface HistoryRecord {
  id?: string;
  name: string;
  examTitle: string;
  time: string;
  score: string;
  duration?: number;
  mode?: string;
}

// Robust custom exam plain text parser
function parseCustomExamText(text: string): Question[] {
  let questionsPart = '';
  let answersPart = '';

  const dapAnIndex = text.toLowerCase().indexOf('đáp án:');
  if (dapAnIndex !== -1) {
    questionsPart = text.substring(0, dapAnIndex);
    answersPart = text.substring(dapAnIndex + 8);
  } else {
    questionsPart = text;
  }

  const lines = questionsPart.split('\n').map(l => l.trim()).filter(Boolean);
  
  let currentQuestionText = '';
  let optionsMap: Record<string, string> = {};
  const tempQuestionsList: { question: string; options: Record<string, string> }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const optionMatch = line.match(/^([A-D])\s*[:\.]\s*(.*)/i);

    if (optionMatch) {
      const optionKey = optionMatch[1].toUpperCase();
      const optionText = optionMatch[2].trim();
      optionsMap[optionKey] = optionText;
    } else {
      // If we see a non-option line but already have some options saved, 
      // the previous question block is deemed complete.
      if (Object.keys(optionsMap).length > 0 && currentQuestionText) {
        tempQuestionsList.push({
          question: currentQuestionText,
          options: { ...optionsMap }
        });
        currentQuestionText = '';
        optionsMap = {};
      }

      let cleanLine = line;
      const matchesPrefix = line.match(/^(?:Câu\s*\d+\s*[:\.]|Câu\s*hỏi\s*\d*\s*[:\.]|Câu\s*\d+|^\d+[\.\):])\s*/i);
      if (matchesPrefix) {
        cleanLine = line.substring(matchesPrefix[0].length).trim();
      }
      
      if (currentQuestionText) {
        currentQuestionText += ' ' + cleanLine;
      } else {
        currentQuestionText = cleanLine;
      }
    }
  }

  if (currentQuestionText && Object.keys(optionsMap).length > 0) {
    tempQuestionsList.push({
      question: currentQuestionText,
      options: { ...optionsMap }
    });
  }

  // Parse answers map: e.g. "1A", "2B", "3C", "Câu 4: D", "5: B", etc.
  const answersMap: Record<number, 'A' | 'B' | 'C' | 'D'> = {};
  const answerLines = answersPart.split('\n').map(l => l.trim()).filter(Boolean);
  
  for (const line of answerLines) {
    const matches = line.matchAll(/(\d+)\s*[\.\):-]?\s*([A-D])/gi);
    for (const match of matches) {
      const qNum = parseInt(match[1], 10);
      const ansVal = match[2].toUpperCase() as 'A' | 'B' | 'C' | 'D';
      answersMap[qNum] = ansVal;
    }
  }

  const finalQuestions: Question[] = tempQuestionsList.map((item, index) => {
    const qNum = index + 1;
    const answer = answersMap[qNum] || 'A';
    return {
      id: qNum,
      question: item.question,
      options: {
        A: item.options['A'] || '',
        B: item.options['B'] || '',
        C: item.options['C'] || '',
        D: item.options['D'] || '',
      },
      answer
    };
  }).filter(q => q.question && (q.options.A || q.options.B || q.options.C || q.options.D));

  return finalQuestions;
}

export default function App() {
  // User Profile States
  const [userName, setUserName] = useState<string>('');
  const [tempName, setTempName] = useState<string>('');
  const [nameSubmitted, setNameSubmitted] = useState<boolean>(false);

  // Redirection Gate State
  const [gatewayUnlocked, setGatewayUnlocked] = useState<boolean>(true);
  const [gatewayCode, setGatewayCode] = useState<string>('');

  // Custom Exam States
  const [exams, setExams] = useState<any[]>(() => {
    const sysExam = {
      id: 'default',
      title: 'Sát hạch ĐĐV và Trưởng kíp TTĐK',
      creator: 'Hệ thống',
      createdAt: 'Mặc định',
      questions: QUESTION_BANK
    };
    try {
      const stored = localStorage.getItem('custom_exams');
      if (stored) {
        return [sysExam, ...JSON.parse(stored)];
      }
    } catch (e) {}
    return [sysExam];
  });
  const [selectedExamId, setSelectedExamId] = useState<string>('default');
  const [examsOrder, setExamsOrder] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('exams_order') || '[]');
    } catch {
      return [];
    }
  });
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Creation Modals & Inputs
  const [showAddExamModal, setShowAddExamModal] = useState<boolean>(false);
  const [showExamNamingStep, setShowExamNamingStep] = useState<boolean>(false);
  const [pasteText, setPasteText] = useState<string>('');
  const [customExamTitle, setCustomExamTitle] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [parsedQuestions, setParsedQuestions] = useState<Question[]>([]);

  // History state
  const [history, setHistory] = useState<HistoryRecord[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('quiz_history') || '[]');
    } catch {
      return [];
    }
  });

  // App Phase: 'intro' | 'quiz' | 'result'
  const [phase, setPhase] = useState<'intro' | 'quiz' | 'result'>('intro');
  const [logo2Error, setLogo2Error] = useState(false);
  const [showLogoModal, setShowLogoModal] = useState<boolean>(false);
  
  // Game Configuration Parameters
  const [targetCount, setTargetCount] = useState<number>(10);
  const [isCustomTarget, setIsCustomTarget] = useState<boolean>(false);
  const [customInputText, setCustomInputText] = useState<string>('');
  const [quizMode, setQuizMode] = useState<QuizMode>('exam');
  const [shuffleOptionsRule, setShuffleOptionsRule] = useState<boolean>(false);
  const [shuffleQuestionsRule, setShuffleQuestionsRule] = useState<boolean>(false);

  // Core Quiz State
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({});
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  
  // Sidebar visibility on mobile
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Timer States
  const [timeSpent, setTimeSpent] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Set page title once
  useEffect(() => {
    document.title = "Trắc Nghiệm Quy Trình Hệ Thống Điện";
  }, []);

  // Listen and sync custom exams live from Firebase Firestore
  useEffect(() => {
    // Listen to real-time custom order
    const unsubOrder = onSnapshot(doc(db, 'settings', 'exam_order'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (Array.isArray(data.order)) {
          setExamsOrder(data.order);
          localStorage.setItem('exams_order', JSON.stringify(data.order));
        }
      }
    }, (error) => {
      console.error('Error fetching exams order from Firestore:', error);
    });

    const unsubscribe = onSnapshot(collection(db, 'exams'), (snapshot) => {
      const fbExams: any[] = [];
      let defaultMetadata: { title?: string; isHidden?: boolean } | null = null;
      
      snapshot.forEach((docRef) => {
        const data = docRef.data();
        if (docRef.id === 'default') {
          defaultMetadata = data;
        } else {
          fbExams.push({
            ...data,
            id: docRef.id
          });
        }
      });

      // Update titles dictionary live
      setCustomExamTitles((prev) => {
        const next = { ...prev };
        snapshot.forEach((docRef) => {
          const data = docRef.data();
          if (data.title) {
            next[docRef.id] = data.title;
          }
        });
        localStorage.setItem('custom_exam_titles', JSON.stringify(next));
        return next;
      });

      const baseSysExam = {
        id: 'default',
        title: defaultMetadata?.title || 'Sát hạch ĐĐV và Trưởng kíp TTĐK',
        creator: 'Hệ thống',
        createdAt: 'Mặc định',
        questions: QUESTION_BANK,
        isHidden: defaultMetadata?.isHidden ?? false
      };

      setExams([baseSysExam, ...fbExams]);
    }, (error) => {
      console.error('Error fetching exams from Firestore:', error);
    });

    return () => {
      unsubOrder();
      unsubscribe();
    };
  }, []);

  // Listen and sync submission history live from Firebase Firestore
  useEffect(() => {
    const q = query(collection(db, 'history'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fbHistory: HistoryRecord[] = [];
      snapshot.forEach((docRef) => {
        const data = docRef.data();
        let formattedTime = data.time || '';
        if (data.createdAt) {
          try {
            const createdDate = typeof data.createdAt.toDate === 'function'
              ? data.createdAt.toDate()
              : new Date(data.createdAt);
            if (!isNaN(createdDate.getTime())) {
              formattedTime = formatSubmitDateTime(createdDate);
            }
          } catch (e) {
            console.error('Error parsing createdAt Date:', e);
          }
        }
        fbHistory.push({
          id: docRef.id,
          name: data.name || 'Học viên',
          examTitle: data.examTitle || 'Đề thi',
          time: formattedTime,
          score: data.score || '',
          duration: data.duration !== undefined ? Number(data.duration) : undefined,
          mode: data.mode || 'Thi thử'
        });
      });
      setHistory(fbHistory);
      localStorage.setItem('quiz_history', JSON.stringify(fbHistory));
    }, (error) => {
      console.error('Error fetching history:', error);
    });
    return () => unsubscribe();
  }, []);

  // User custom modifications (Rename)
  const [customExamTitles, setCustomExamTitles] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('custom_exam_titles') || '{}');
    } catch {
      return {};
    }
  });

  const enrichedExams = useMemo(() => {
    const sorted = exams.map((ex) => ({
      ...ex,
      questions: ex.questions || [],
      title: customExamTitles[ex.id] || ex.title,
      isHidden: !!ex.isHidden,
    }));

    if (examsOrder && examsOrder.length > 0) {
      sorted.sort((a, b) => {
        const indexA = examsOrder.indexOf(a.id);
        const indexB = examsOrder.indexOf(b.id);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return 0;
      });
    }
    return sorted;
  }, [exams, customExamTitles, examsOrder]);

  const getPracticeRanges = () => {
    const total = activeQuestionsCount;
    if (total <= 0) {
      return { r1: '1-1', r2: '1-1', r3: '1-1', s1: 1, e1: 1, s2: 1, e2: 1, s3: 1, e3: 1 };
    }
    
    let end1 = Math.round((total / 3) / 10) * 10;
    if (end1 < 10) end1 = Math.min(10, total);
    if (end1 >= total) end1 = Math.max(1, total - 2);

    let end2 = Math.round((2 * total / 3) / 10) * 10;
    if (end2 <= end1) end2 = Math.min(end1 + 10, total);
    if (end2 >= total) end2 = Math.max(end1 + 1, total - 1);

    const start1 = 1;
    const start2 = Math.min(end1 + 1, total);
    const start3 = Math.min(end2 + 1, total);
    const end3 = total;

    return {
      r1: `${start1}-${end1}`,
      r2: `${start2}-${end2}`,
      r3: `${start3}-${end3}`,
      s1: start1,
      e1: end1,
      s2: start2,
      e2: end2,
      s3: start3,
      e3: end3
    };
  };

  const isRangeSelected = (rStr: string) => {
    if (!isCustomTarget || !customInputText) return false;
    
    const partsCurrent = customInputText.split('-').map(p => parseInt(p.trim(), 10));
    const partsRange = rStr.split('-').map(p => parseInt(p, 10));
    
    if (partsCurrent.length === 2 && partsRange.length === 2) {
      return partsCurrent[0] === partsRange[0] && partsCurrent[1] === partsRange[1];
    }
    return false;
  };

  const visibleExams = useMemo(() => {
    if (userName === 'Admin-AMT') return enrichedExams;
    return enrichedExams.filter((e) => !e.isHidden);
  }, [enrichedExams, userName]);

  const activeExam = useMemo(() => {
    const current = enrichedExams.find((e) => e.id === selectedExamId);
    if (current && (userName === 'Admin-AMT' || !current.isHidden)) {
      return current;
    }
    const defaultVisible = enrichedExams.find((e) => !e.isHidden) || enrichedExams[0];
    return defaultVisible || { id: 'default', title: 'Sát hạch ĐĐV và Trưởng kíp TTĐK', questions: [], isHidden: false };
  }, [enrichedExams, selectedExamId, userName]);

  const [editingExamTitle, setEditingExamTitle] = useState<string>('');

  // Pre-select the top-most exam whenever the user logs in
  const hasSelectedOnLogin = useRef<boolean>(false);

  useEffect(() => {
    if (!nameSubmitted) {
      hasSelectedOnLogin.current = false;
      return;
    }

    if (nameSubmitted && !hasSelectedOnLogin.current && visibleExams.length > 0) {
      setSelectedExamId(visibleExams[0].id);
      hasSelectedOnLogin.current = true;
    }
  }, [nameSubmitted, visibleExams]);

  useEffect(() => {
    if (activeExam) {
      setEditingExamTitle(activeExam.title);
    }
  }, [activeExam]);

  const handleRenameExam = async (newTitle: string) => {
    if (!newTitle.trim()) return;
    const updatedTitles = {
      ...customExamTitles,
      [selectedExamId]: newTitle.trim(),
    };
    setCustomExamTitles(updatedTitles);
    localStorage.setItem('custom_exam_titles', JSON.stringify(updatedTitles));

    // Update in Firestore
    try {
      await setDoc(doc(db, 'exams', selectedExamId), {
        id: selectedExamId,
        title: newTitle.trim()
      }, { merge: true });
    } catch (err) {
      console.error('Error renaming exam in Firestore:', err);
    }
  };

  const handleToggleHideExam = async () => {
    const targetExam = exams.find((e) => e.id === selectedExamId);
    const isCurrentlyHidden = targetExam ? !!targetExam.isHidden : false;

    // Update in Firestore
    try {
      await setDoc(doc(db, 'exams', selectedExamId), {
        id: selectedExamId,
        isHidden: !isCurrentlyHidden
      }, { merge: true });
    } catch (err) {
      console.error('Error toggling hide exam in Firestore:', err);
    }
  };

  const handleDeleteExam = async () => {
    if (selectedExamId === 'default') {
      alert('Không thể xóa kỳ thi mặc định của hệ thống.');
      return;
    }
    if (window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn kỳ thi "${activeExam.title}" trên cơ sở dữ liệu đám mây?`)) {
      try {
        await deleteDoc(doc(db, 'exams', selectedExamId));

        const storedExams = localStorage.getItem('custom_exams');
        let customExamsList = [];
        if (storedExams) {
          try {
            customExamsList = JSON.parse(storedExams);
          } catch (e) {}
        }
        const updatedCustomExams = customExamsList.filter((e: any) => e.id !== selectedExamId);
        localStorage.setItem('custom_exams', JSON.stringify(updatedCustomExams));

        // Sync exam order after deleting
        const nextOrder = examsOrder.filter(id => id !== selectedExamId);
        await handleUpdateExamsOrder(nextOrder);

        setSelectedExamId('default');
      } catch (err) {
        console.error('Error deleting exam from Firestore:', err);
        alert('Lỗi khi xóa kỳ thi: ' + (err instanceof Error ? err.message : String(err)));
      }
    }
  };

  const handleUpdateExamsOrder = async (newOrder: string[]) => {
    setExamsOrder(newOrder);
    localStorage.setItem('exams_order', JSON.stringify(newOrder));
    try {
      await setDoc(doc(db, 'settings', 'exam_order'), { order: newOrder }, { merge: true });
    } catch (err) {
      console.error('Error saving exams order to Firestore:', err);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const reordered = [...visibleExams];
    const draggedItem = reordered[draggedIndex];
    reordered.splice(draggedIndex, 1);
    reordered.splice(index, 0, draggedItem);
    
    setDraggedIndex(index);
    const orderIds = reordered.map((ex) => ex.id);
    setExamsOrder(orderIds);
  };

  const handleDragEnd = async () => {
    setDraggedIndex(null);
    const orderIds = visibleExams.map((ex) => ex.id);
    await handleUpdateExamsOrder(orderIds);
  };

  const activeQuestionsCount = activeExam?.questions?.length || 0;

  // Adjust targetCount if it exceeds available count
  useEffect(() => {
    if (targetCount > activeQuestionsCount) {
      setTargetCount(activeQuestionsCount);
    }
  }, [activeQuestionsCount, targetCount]);

  // When switching to practice mode or switching exams, default to custom range input and leave it empty
  useEffect(() => {
    if (quizMode === 'practice') {
      setCustomInputText('');
      setIsCustomTarget(true);
    }
  }, [quizMode, selectedExamId]);

  // Timer effect
  useEffect(() => {
    if (phase === 'quiz') {
      timerRef.current = setInterval(() => {
        setTimeSpent((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [phase]);

  // Name entry submission handler
  const handleNameSubmit = () => {
    const trimmed = tempName.trim();
    if (!trimmed) return;
    setUserName(trimmed);
    setNameSubmitted(true);
  };

  // Custom exam creation handler functions
  const handleParseAndPromptExamName = () => {
    if (!pasteText.trim()) {
      setErrorMsg('Vui lòng dán dữ liệu đề thi vào trước.');
      return;
    }

    const qs = parseCustomExamText(pasteText);
    if (qs.length === 0) {
      setErrorMsg('Không tìm thấy câu hỏi hợp lệ nào trong dữ liệu dán vào. Vui lòng dán theo đúng dạng đề yêu cầu.');
      return;
    }

    setParsedQuestions(qs);
    setErrorMsg('');
    setCustomExamTitle('');
    setShowExamNamingStep(true);
  };

  const handleFinalCreateExam = async () => {
    if (!customExamTitle.trim() || parsedQuestions.length === 0) return;

    const now = new Date();
    const dateTimeStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    const newExam = {
      id: 'exam_' + Date.now(),
      title: customExamTitle.trim(),
      creator: userName || 'Admin-AMT',
      createdAt: dateTimeStr,
      questions: parsedQuestions,
      isHidden: false
    };

    // Save to Firestore
    try {
      await setDoc(doc(db, 'exams', newExam.id), {
        id: newExam.id,
        title: newExam.title,
        creator: newExam.creator,
        createdAt: newExam.createdAt,
        questions: newExam.questions,
        isHidden: false
      });
    } catch (err) {
      console.error('Error saving exam to Firestore:', err);
    }

    // Update synchronized exam order so the new exam appears at the top
    const nextOrder = [newExam.id, ...examsOrder.filter(id => id !== newExam.id)];
    handleUpdateExamsOrder(nextOrder);

    const storedExams = localStorage.getItem('custom_exams');
    let customExamsList = [];
    try {
      if (storedExams) {
        customExamsList = JSON.parse(storedExams);
      }
    } catch (e) {}

    const updatedCustomExams = [newExam, ...customExamsList];
    localStorage.setItem('custom_exams', JSON.stringify(updatedCustomExams));

    const defaultExam = {
      id: 'default',
      title: 'Sát hạch ĐĐV và Trưởng kíp TTĐK',
      creator: 'Hệ thống',
      createdAt: 'Mặc định',
      questions: QUESTION_BANK,
      isHidden: false
    };

    setExams([defaultExam, ...updatedCustomExams]);
    setSelectedExamId(newExam.id);

    // Reset modals
    setShowExamNamingStep(false);
    setShowAddExamModal(false);
    setPasteText('');
    setCustomExamTitle('');
    setParsedQuestions([]);
    setErrorMsg('');
  };

  // Start the Exam Session
  const handleStartQuiz = () => {
    const activeExam = enrichedExams.find((e) => e.id === selectedExamId) || enrichedExams[0] || { id: 'default', title: '', questions: [] };
    const sourceQuestions: Question[] = activeExam.questions || [];

    if (quizMode === 'practice' && isCustomTarget) {
      if (!customInputText.trim()) {
        alert("Vui lòng nhập khoảng câu hỏi muốn ôn tập (ví dụ: 25-50) hoặc chọn một phần có sẵn bên dưới.");
        return;
      }
      if (!customInputText.includes('-')) {
        alert("Vui lòng nhập khoảng câu hỏi theo định dạng 'Bắt đầu - Kết thúc' (ví dụ: 25-50).");
        return;
      }
      const parts = customInputText.split('-');
      if (parts.length !== 2) {
        alert("Vui lòng nhập khoảng câu hỏi theo định dạng 'Bắt đầu - Kết thúc' (ví dụ: 25-50).");
        return;
      }
      const startVal = parseInt(parts[0].trim(), 10);
      const endVal = parseInt(parts[1].trim(), 10);
      if (isNaN(startVal) || isNaN(endVal) || startVal < 1 || endVal < 1) {
        alert("Khoảng câu hỏi phải là các số nguyên dương (ví dụ: 25-50).");
        return;
      }
      if (startVal > sourceQuestions.length || endVal > sourceQuestions.length) {
        alert(`Số câu hỏi vượt quá tổng số câu trong bộ đề (${sourceQuestions.length} câu). Vui lòng nhập lại.`);
        return;
      }
    }

    // 1. Filter and choose questions from current exam
    let selectedQuestions: Question[] = [];
    if (quizMode === 'practice' && isCustomTarget && customInputText.includes('-')) {
      const parts = customInputText.split('-');
      let startIdx = 0;
      let endIdx = sourceQuestions.length - 1;

      if (parts.length === 2) {
        const startVal = parseInt(parts[0].trim(), 10);
        const endVal = parseInt(parts[1].trim(), 10);

        if (!isNaN(startVal) && startVal >= 1) {
          startIdx = Math.min(startVal - 1, sourceQuestions.length - 1);
        }
        if (!isNaN(endVal) && endVal >= 1) {
          endIdx = Math.min(endVal - 1, sourceQuestions.length - 1);
        }
      }

      // Ensure startIdx <= endIdx
      if (startIdx > endIdx) {
        const temp = startIdx;
        startIdx = endIdx;
        endIdx = temp;
      }

      const slicedOriginal = sourceQuestions.slice(startIdx, endIdx + 1);

      if (shuffleQuestionsRule) {
        selectedQuestions = shuffleArray(slicedOriginal);
      } else {
        selectedQuestions = slicedOriginal;
      }
    } else {
      // Adjust target count dynamically to prevent exceeding available size
      let countNum = sourceQuestions.length;
      if (isCustomTarget) {
        const parsedVal = parseInt(customInputText, 10);
        if (!isNaN(parsedVal) && parsedVal > 0) {
          countNum = Math.min(parsedVal, sourceQuestions.length);
        } else {
          countNum = sourceQuestions.length;
        }
      } else {
        countNum = Math.min(targetCount, sourceQuestions.length);
      }

      if (shuffleQuestionsRule) {
        selectedQuestions = shuffleArray(sourceQuestions).slice(0, countNum);
      } else {
        selectedQuestions = [...sourceQuestions].slice(0, countNum);
      }
    }

    // 2. Wrap into ExamQuestion, shuffling choices if configured
    const prepared: ExamQuestion[] = selectedQuestions.map((q) => {
      const originalOpts = [
        { text: q.options.A, originalKey: 'A' },
        { text: q.options.B, originalKey: 'B' },
        { text: q.options.C, originalKey: 'C' },
        { text: q.options.D, originalKey: 'D' },
      ];

      // Check if the question contains options like "Cả ...", "đều đúng", "đều sai", "đáp án trên", etc., or combinations of A, B, C, D (e.g., A và B, B & C)
      const hasSpecialAnswers = [q.options.A, q.options.B, q.options.C, q.options.D].some((text) => {
        if (!text) return false;
        const lower = text.toLowerCase().trim();
        // Check for specific Vietnamese keywords indicating combinations or reference to other options
        const hasKeywords = (
          lower.startsWith('cả') ||
          lower.includes(' cả ') ||
          lower.includes('đều đúng') ||
          lower.includes('đều sai') ||
          lower.includes('đáp án trên') ||
          lower.includes('phương án trên') ||
          lower.includes('câu trên') ||
          (lower.includes('tất cả') && (lower.includes('đúng') || lower.includes('sai')))
        );

        // Regex to match combinations like "A và B", "A hoặc B", "A & B", "A, B, C", "A,B,C" (case-insensitive)
        const combinationRegex = /\b[A-D]\b\s*(?:và|hoặc|&|,)\s*\b[A-D]\b/i;
        const hasCombinations = combinationRegex.test(text);

        return hasKeywords || hasCombinations;
      });

      const shouldShuffle = shuffleOptionsRule && !hasSpecialAnswers;
      const shuffledOpts = shouldShuffle ? shuffleArray(originalOpts) : originalOpts;

      return {
        ...q,
        shuffledOptions: shuffledOpts,
      } as ExamQuestion;
    });

    setExamQuestions(prepared);
    setUserAnswers({});
    setCurrentIndex(0);
    setTimeSpent(0);
    setPhase('quiz');
    setSidebarOpen(false);
  };

  // Answer selection callback
  const handleSelectAnswer = (optionKey: 'A' | 'B' | 'C' | 'D') => {
    setUserAnswers((prev) => {
      const updated = { ...prev, [currentIndex]: optionKey };
      
      // In practice mode, don't auto-advance immediately to let user digest explanation.
      // In exam/thi-thử mode, we can optionally auto-advance to next question if it is not the last one
      if (quizMode === 'exam' && currentIndex < examQuestions.length - 1) {
        setTimeout(() => {
          setCurrentIndex((idx) => Math.min(idx + 1, examQuestions.length - 1));
        }, 300);
      }
      
      return updated;
    });
  };

  // Skip / Navigation functions
  const handlePrevious = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(prev + 1, examQuestions.length - 1));
  };

  // Submit and open results screen
  const handleSubmitQuiz = async () => {
    // Confirm logic
    const unansweredCount = examQuestions.length - Object.keys(userAnswers).filter(k => userAnswers[Number(k)] !== null).length;
    
    if (unansweredCount > 0) {
      const confirmSubmit = window.confirm(`Bạn còn ${unansweredCount} câu chưa trả lời. Bạn có chắc muốn nộp bài?`);
      if (!confirmSubmit) return;
    }

    // Save submission records immediately
    let correctCount = 0;
    examQuestions.forEach((q, index) => {
      const ans = userAnswers[index];
      if (ans === q.answer) {
        correctCount++;
      }
    });

    const activeExam = enrichedExams.find((e) => e.id === selectedExamId) || enrichedExams[0];
    const now = new Date();
    const formattedTime = formatSubmitDateTime(now);
    
    const newRecord: HistoryRecord = {
      name: userName || 'Học viên',
      examTitle: activeExam.title,
      time: formattedTime,
      score: `${correctCount}/${examQuestions.length}`,
      duration: timeSpent,
      mode: quizMode === 'exam' ? 'Thi thử' : 'Ôn tập'
    };

    // Save to Firestore history collection
    try {
      const historyRef = doc(collection(db, 'history'));
      await setDoc(historyRef, {
        name: userName || 'Học viên',
        examTitle: activeExam.title,
        time: formattedTime,
        score: `${correctCount}/${examQuestions.length}`,
        duration: timeSpent,
        mode: quizMode === 'exam' ? 'Thi thử' : 'Ôn tập',
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error saving history record to Firestore:', err);
    }

    const savedHistory = JSON.parse(localStorage.getItem('quiz_history') || '[]');
    const updatedHistory = [newRecord, ...savedHistory];
    localStorage.setItem('quiz_history', JSON.stringify(updatedHistory));
    setHistory(updatedHistory);

    setPhase('result');
  };

  const handleExportData = () => {
    const parseDateTime = (timeStr: string) => {
      const parts = timeStr.split(' ');
      if (parts.length === 2) {
        const dateParts = parts[0].split('/');
        const timeParts = parts[1].split(':');
        if (dateParts.length === 3 && timeParts.length === 2) {
          const day = parseInt(dateParts[0], 10);
          const month = parseInt(dateParts[1], 10) - 1;
          const year = parseInt('20' + dateParts[2], 10);
          const hour = parseInt(timeParts[0], 10);
          const minute = parseInt(timeParts[1], 10);
          return new Date(year, month, day, hour, minute).getTime();
        }
      }
      return 0;
    };

    const sortedHistory = [...history].sort((a, b) => {
      return parseDateTime(a.time) - parseDateTime(b.time);
    });

    const headers = [
      'Tên học viên',
      'Kỳ thi đã thi',
      'Chế độ làm bài',
      'Ngày giờ nộp bài',
      'Thời gian làm bài',
      'Kết quả',
      'Điểm (%)',
      'Đánh giá'
    ];

    const rows = sortedHistory.map(h => {
      let percentStr = '00';
      let evaluation = 'KHÔNG ĐẠT';
      if (h.score) {
        const parts = h.score.split('/');
        if (parts.length === 2 && parts[1]) {
          const correct = parseInt(parts[0], 10);
          const total = parseInt(parts[1], 10);
          if (!isNaN(correct) && !isNaN(total) && total > 0) {
            const pct = Math.round((correct / total) * 100);
            percentStr = String(pct);
            evaluation = pct >= 80 ? 'ĐẠT' : 'KHÔNG ĐẠT';
          }
        }
      }

      let durStr = '';
      if (h.duration !== undefined && !isNaN(h.duration)) {
        const hr = Math.floor(h.duration / 3600);
        const mn = Math.floor((h.duration % 3600) / 60);
        const sc = h.duration % 60;
        if (hr > 0) {
          durStr = `${hr} giờ ${mn} phút ${sc} giây`;
        } else {
          durStr = `${mn} phút ${sc} giây`;
        }
      } else {
        durStr = '--';
      }
      const scoreValue = h.score && h.score.includes('/') ? `="${h.score}"` : h.score;

      return [
        h.name,
        h.examTitle,
        h.mode || 'Thi thử',
        h.time,
        durStr,
        scoreValue,
        percentStr,
        evaluation
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Lich_su_nop_bai_hoc_vien.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format second state counter to readable presentation
  const formatTimerLabel = (secs: number) => {
    const mm = Math.floor(secs / 60);
    const ss = secs % 60;
    return `${mm < 10 ? '0' : ''}${mm}:${ss < 10 ? '0' : ''}${ss}`;
  };

  // Score count during quiz
  const answeredCount = Object.keys(userAnswers).length;

  const containerStyle = isDarkMode ? {
    background: `radial-gradient(circle at 20% 10%, rgba(97,218,251,.15), transparent 28%),
                 radial-gradient(circle at 80% 40%, rgba(120,255,180,.08), transparent 24%),
                 radial-gradient(circle at 50% 100%, rgba(97,218,251,.08), transparent 35%),
                 #05070b`,
    color: 'white'
  } : {
    backgroundColor: '#f1f5f9',
    color: '#1e293b'
  };

  return (
    <div 
      id="quiz-root-wrapper" 
      className={`min-h-screen flex flex-col font-sans relative overflow-x-hidden transition-all duration-300 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
      style={containerStyle}
    >
      {isDarkMode && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute -top-32 left-[10%] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgba(97,218,251,.18),transparent_70%)] blur-3xl"></div>
          <div className="absolute bottom-0 right-[5%] h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,rgba(120,255,180,.1),transparent_70%)] blur-3xl"></div>
          <div 
            className="absolute inset-0 opacity-[0.25]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)`,
              backgroundSize: '110px 110px',
              maskImage: 'radial-gradient(circle at center, black 30%, transparent 78%)',
              WebkitMaskImage: 'radial-gradient(circle at center, black 30%, transparent 78%)'
            }}
          />
        </div>
      )}
      
      {/* Upper Navigation Bar */}
      <header 
        id="app-global-header" 
        className={`sticky top-0 z-40 shrink-0 h-16 flex items-center transition-all duration-300 border-b ${
          isDarkMode 
            ? 'bg-[#05070b]/85 border-white/10 backdrop-blur-xl shadow-lg' 
            : 'bg-white border-slate-100 shadow-xs'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!logo2Error ? (
              <div className={`w-8 h-8 rounded-lg overflow-hidden border shadow-xs flex items-center justify-center bg-slate-50 transition-colors duration-300 ${
                isDarkMode ? 'border-white/10 bg-white/5' : 'border-slate-150 bg-slate-50'
              }`}>
                <img
                  src={logo2Img}
                  alt="Logo 2"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  onError={() => setLogo2Error(true)}
                />
              </div>
            ) : (
              <div className="w-8 h-8 bg-indigo-600 rounded-lg text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-xs">
                E
              </div>
            )}
            <div className="flex flex-col items-center justify-center text-center font-serif">
              <p className={`text-[11px] sm:text-[13px] font-normal uppercase tracking-normal leading-tight transition-colors duration-300 ${
                isDarkMode ? 'text-slate-300' : 'text-slate-800'
              }`}>
                CÔNG TY ĐIỆN LỰC AN GIANG
              </p>
              <p className={`text-xs sm:text-sm font-bold uppercase tracking-normal leading-tight mt-0.5 transition-colors duration-300 ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}>
                PHÒNG ĐIỀU ĐỘ
              </p>
              <div className={`w-12 border-b mt-1 transition-colors duration-300 ${
                isDarkMode ? 'border-indigo-400' : 'border-slate-950'
              }`}></div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Dark/Light mode Toggle Switch */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer shadow-sm border ${
                isDarkMode 
                  ? 'bg-white/[0.06] hover:bg-white/[0.12] text-amber-400 border-white/10 hover:border-white/20' 
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-150'
              }`}
              title={isDarkMode ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
            >
              {isDarkMode ? (
                <>
                  <Moon className="w-3.5 h-3.5 fill-current text-indigo-350" />
                  <span>DARK</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 fill-current text-amber-500" />
                  <span>LIGHT</span>
                </>
              )}
            </button>

            {phase === 'quiz' && (
              <>
                {/* Progress bar in navbar */}
                <div className="hidden md:flex flex-col items-end">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Tiến độ hoàn thành</span>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Câu hỏi {currentIndex + 1} / {examQuestions.length}</span>
                    <div className={`w-40 h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-white/10' : 'bg-slate-100'}`}>
                      <div 
                        className="bg-indigo-600 h-full transition-all duration-300" 
                        style={{ width: `${((currentIndex + 1) / examQuestions.length) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className={`h-8 w-px mx-1 hidden md:block ${isDarkMode ? 'bg-white/10' : 'bg-slate-250'}`}></div>

                {/* Timer Clock display */}
                <div id="exam-dashboard-timer" className="flex flex-col items-end">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Thời gian làm bài</span>
                  <span className={`text-lg font-mono font-bold leading-tight ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>
                    {formatTimerLabel(timeSpent)}
                  </span>
                </div>

                {/* Mobile sidebar toggle button */}
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className={`lg:hidden p-2 rounded-xl border transition-colors duration-150 ${
                    isDarkMode 
                      ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' 
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Menu className="w-5 h-5" />
                </button>
              </>
            )}
            


            {userName && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold shadow-xs border transition-colors ${
                isDarkMode 
                  ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' 
                  : 'bg-indigo-50 border-indigo-100 text-indigo-700'
              }`}>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
                <span className="truncate max-w-[120px]">{(userName === 'Admin-AMT' || userName === 'TPĐĐ') ? '\u00A0' : userName}</span>
                {userName === 'Admin-AMT' && (
                  <span className="rainbow-pill rounded-full text-[9px] px-2 py-0.5 font-extrabold uppercase tracking-widest flex items-center justify-center shrink-0 shadow-xs">Admin</span>
                )}
                <button
                  onClick={() => {
                    setUserName('');
                    setNameSubmitted(false);
                  }}
                  className={`p-1 rounded-full transition cursor-pointer ${
                    isDarkMode ? 'hover:bg-white/10 text-slate-400 hover:text-rose-400' : 'hover:bg-slate-200/50 text-slate-400 hover:text-rose-600'
                  }`}
                  title="Đổi tên đăng nhập"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Arena */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 flex flex-col justify-start">
        <AnimatePresence mode="wait">
          
          {/* Phase 1: Welcome & Intro configuration panel */}
          {phase === 'intro' && (
            <div className={`w-full flex flex-col items-center ${!nameSubmitted && gatewayUnlocked ? 'pt-4 sm:pt-6 md:pt-8 lg:pt-12 pb-6 gap-6' : 'gap-8'}`}>
              {!gatewayUnlocked ? (
                /* Redirection Interstitial Gate */
                <motion.div
                  key="gateway-screen"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  id="gateway-container"
                  className={`relative max-w-xl mx-auto w-full rounded-3xl p-8 sm:p-12 text-center transition-all duration-300 ${
                    isDarkMode 
                      ? 'bg-[#0f172a]/65 border border-white/10 backdrop-blur-xl shadow-2xl' 
                      : 'bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-100'
                  } my-auto min-h-[300px] flex flex-col items-center justify-center`}
                >
                  {/* Top-right subtle capsule input */}
                  <div className="absolute top-4 right-4">
                    <input
                      type="text"
                      value={gatewayCode}
                      onChange={(e) => {
                        const val = e.target.value;
                        setGatewayCode(val);
                        if (val === '9630anh') {
                          setGatewayUnlocked(true);
                          try {
                            localStorage.setItem('gateway_unlocked', 'true');
                          } catch (err) {}
                        }
                      }}
                      className={`w-24 h-7 text-center font-mono text-xs rounded-full border outline-none transition-all ${
                        isDarkMode 
                          ? 'bg-white/5 border-white/10 text-white focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20' 
                          : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100'
                      }`}
                      style={{ borderRadius: '9999px' }}
                    />
                  </div>

                  {/* Icon / Interstitial Header */}
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-6 transition-colors duration-300 ${
                    isDarkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
                  }`}>
                    <ExternalLink className="w-6 h-6 animate-pulse" />
                  </div>

                  <h2 className={`text-lg sm:text-xl font-extrabold tracking-tight mb-4 transition-colors duration-300 ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                    Thông Báo Di Chuyển Trang Web
                  </h2>

                  <p className={`text-sm sm:text-base leading-relaxed mb-6 transition-colors duration-300 ${
                    isDarkMode ? 'text-slate-300' : 'text-slate-600'
                  }`}>
                    Trang web đã được chuyển sang link mới --&gt;{' '}
                    <a
                      href="https://tracnghiem-dta.vercel.app/"
                      className="inline-block font-extrabold text-indigo-500 hover:text-indigo-400 underline transition-all duration-200 hover:scale-[1.01] break-all"
                    >
                      https://tracnghiem-dta.vercel.app/
                    </a>
                  </p>

                  <p className="text-xs text-slate-400 font-medium leading-normal max-w-sm">
                    Vui lòng nhấn vào liên kết phía trên để tự động chuyển hướng đến hệ thống mới.
                  </p>
                </motion.div>
              ) : (
                <>
                  <motion.div
                    key="intro-screen"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    id="intro-container"
                    className={`max-w-3xl mx-auto w-full ${!nameSubmitted ? 'space-y-6' : 'space-y-8'}`}
                  >
              {/* Premium Title Section */}
              <div className="text-center space-y-2 py-2 px-2">
                <span className={`text-base min-[380px]:text-lg sm:text-xl font-extrabold uppercase tracking-widest block leading-normal transition-colors duration-300 ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  CHƯƠNG TRÌNH
                </span>
                <h1 className={`text-lg min-[380px]:text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight leading-normal max-w-full mx-auto py-1 transition-all duration-300 ${
                  isDarkMode ? 'text-indigo-400 drop-shadow-[0_0_15px_rgba(129,140,248,0.25)]' : 'text-indigo-600 drop-shadow-xs'
                }`}>
                  ÔN LUYỆN TRẮC NGHIỆM
                </h1>
              </div>

              {!nameSubmitted ? (
                /* Name collection view */
                <div className={`rounded-3xl p-5 sm:p-6 space-y-4 text-center transition-all duration-300 ${
                  isDarkMode 
                    ? 'bg-[#0f172a]/65 border border-white/10 backdrop-blur-xl shadow-2xl' 
                    : 'bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-100'
                } max-w-md mx-auto`}>
                  <div>
                    <h3 className={`text-base sm:text-lg font-extrabold tracking-wide uppercase transition-colors duration-300 ${
                      isDarkMode ? 'text-slate-200' : 'text-slate-800'
                    }`}>Nhập tên thí sinh</h3>
                  </div>
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleNameSubmit(); }}
                      placeholder="Nhập tên của bạn (Ví dụ: Nguyễn Văn A)"
                      className={`w-full px-4 py-4 rounded-2xl text-base font-bold transition-all text-center focus:outline-none shadow-sm placeholder:font-medium ${
                        isDarkMode 
                          ? 'bg-white/5 border-2 border-indigo-500/50 hover:border-indigo-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/20 text-white placeholder:text-slate-500' 
                          : 'bg-slate-50 border-2 border-indigo-400 hover:border-indigo-500 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 text-slate-900 placeholder:text-slate-400'
                      }`}
                      autoFocus
                    />
                    <button
                      onClick={handleNameSubmit}
                      className={`w-full py-3.5 font-bold rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2 text-sm ${
                        isDarkMode 
                          ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' 
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      <Play className="w-4 h-4 fill-current animate-pulse" />
                      VÀO ÔN LUYỆN
                    </button>
                  </div>
                </div>
              ) : (
                /* Normal configurations widget after name supplied */
                <>
                  <div className={`rounded-3xl p-4 sm:p-6 md:p-8 space-y-4 md:space-y-6 transition-all duration-300 ${
                    isDarkMode 
                      ? 'bg-[#0f172a]/45 border border-white/10 backdrop-blur-xl shadow-2xl text-white' 
                      : 'bg-white border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
                  }`}>
                    
                    {/* Header with Selector & Admin plus */}
                    <div className={`border-b pb-2.5 space-y-2 transition-colors duration-300 ${
                      isDarkMode ? 'border-white/10' : 'border-slate-100'
                    }`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <h3 className={`text-base font-bold flex items-center gap-1.5 transition-colors duration-300 ${
                          isDarkMode ? 'text-slate-100' : 'text-slate-800'
                        }`}>
                          <Layers className={`w-4.5 h-4.5 transition-colors duration-300 ${
                            isDarkMode ? 'text-indigo-400' : 'text-indigo-600'
                          }`} />
                          Tùy chọn
                        </h3>
                        
                        <div className="flex items-center gap-2 relative">
                          <label className="text-xs font-bold text-slate-400 whitespace-nowrap uppercase">Chọn Bộ đề:</label>
                          
                          <div className="relative inline-block text-left">
                            <button
                              onClick={() => setDropdownOpen(!dropdownOpen)}
                              className={`border text-xs font-bold rounded-xl px-3.5 py-2 focus:outline-none cursor-pointer flex items-center justify-between gap-2 max-w-[220px] transition-all shadow-xs ${
                                isDarkMode 
                                  ? 'bg-white/[0.04] hover:bg-white/[0.08] border-white/15 text-slate-200 focus:ring-2 focus:ring-indigo-500' 
                                  : 'bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 focus:ring-2 focus:ring-indigo-500'
                              }`}
                              title="Nhấp vào để chọn hoặc sắp xếp kì thi"
                            >
                              <span className="truncate">{activeExam.title}</span>
                              <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            </button>

                            {dropdownOpen && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                                <div className={`absolute right-0 mt-2 z-50 min-w-[280px] w-[320px] max-w-[90vw] rounded-2xl shadow-xl p-2 overflow-hidden transition-all duration-300 ${
                                  isDarkMode 
                                    ? 'bg-[#0f172a] border border-white/10 text-white shadow-[0_12px_40px_rgba(0,0,0,0.5)]' 
                                    : 'bg-white border border-slate-200/80 shadow-[0_12px_36px_-6px_rgba(0,0,0,0.12)]'
                                }`}>
                                  <div className={`text-[10px] font-extrabold uppercase tracking-widest px-3 py-1.5 border-b mb-1 flex items-center justify-between ${
                                    isDarkMode ? 'text-slate-400 border-white/5' : 'text-slate-400 border-slate-50'
                                  }`}>
                                    <span className="normal-case">Danh sách Bộ đề:</span>
                                    {userName === 'Admin-AMT' && (
                                      <span className={`text-[9px] px-2 py-0.5 rounded font-extrabold normal-case leading-relaxed ${
                                        isDarkMode ? 'text-indigo-300 bg-indigo-500/10' : 'text-indigo-600 bg-indigo-50'
                                      }`}>kéo & thả để sắp xếp</span>
                                    )}
                                  </div>
                                  <div className="max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                    {visibleExams.map((ex, index) => {
                                      const isActive = ex.id === selectedExamId;
                                      return (
                                        <div
                                          key={ex.id}
                                          draggable={userName === 'Admin-AMT'}
                                          onDragStart={(e) => handleDragStart(e, index)}
                                          onDragOver={(e) => handleDragOver(e, index)}
                                          onDragEnd={handleDragEnd}
                                          onDrop={(e) => e.preventDefault()}
                                          onClick={() => {
                                            setSelectedExamId(ex.id);
                                            setDropdownOpen(false);
                                          }}
                                          className={`group px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center justify-between text-xs gap-2 border select-none ${
                                            isActive
                                              ? isDarkMode
                                                ? 'bg-indigo-500 border-indigo-500 text-white font-bold shadow-md shadow-indigo-500/20'
                                                : 'bg-indigo-600 border-indigo-600 text-white font-bold shadow-md'
                                              : isDarkMode
                                                ? 'bg-transparent hover:bg-white/5 border-transparent text-slate-350 hover:text-white font-semibold'
                                                : 'bg-white hover:bg-slate-50 border-transparent text-slate-700 hover:text-slate-900 font-semibold'
                                          } ${draggedIndex === index ? (isDarkMode ? 'opacity-40 scale-95 border-dashed border-indigo-500' : 'opacity-40 scale-95 border-dashed border-indigo-400') : ''}`}
                                        >
                                          <div className="flex items-center gap-2 min-w-0 flex-1">
                                            {userName === 'Admin-AMT' && (
                                              <div 
                                                className={`cursor-grab active:cursor-grabbing shrink-0 p-1 rounded-md transition-colors ${
                                                  isActive 
                                                    ? isDarkMode 
                                                      ? 'text-indigo-200 hover:text-white hover:bg-indigo-600' 
                                                      : 'text-indigo-200 hover:text-white hover:bg-indigo-700' 
                                                    : isDarkMode 
                                                      ? 'text-slate-500 hover:text-indigo-400 hover:bg-white/5' 
                                                      : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100'
                                                }`}
                                                title="Nắm và kéo để sắp xếp"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <GripVertical className="w-3.5 h-3.5" />
                                              </div>
                                            )}
                                            <span className="truncate flex-1">{ex.title}</span>
                                          </div>
                                          
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            {ex.isHidden && (
                                              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-0.5 leading-none ${
                                                isActive 
                                                  ? 'bg-indigo-700 text-indigo-100' 
                                                  : isDarkMode
                                                    ? 'bg-rose-500/10 text-rose-350 border border-rose-500/20'
                                                    : 'bg-rose-50 text-rose-600 border border-rose-100'
                                              }`} title="Kỳ thi đang ẩn với học viên">
                                                <EyeOff className="w-2.5 h-2.5" />
                                                Ẩn
                                              </span>
                                            )}
                                            <span className={`text-[10px] font-mono whitespace-nowrap px-1.5 py-0.5 rounded ${
                                              isActive 
                                                ? 'bg-indigo-700 text-indigo-100' 
                                                : isDarkMode
                                                  ? 'bg-white/5 text-slate-400'
                                                  : 'bg-slate-100 text-slate-500'
                                            }`}>
                                              {(ex.questions || []).length} câu
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>

                          {userName === 'Admin-AMT' && (
                            <button
                              onClick={() => setShowAddExamModal(true)}
                              className={`p-2 rounded-xl shadow-md cursor-pointer flex items-center justify-center transition-colors shrink-0 text-white ${
                                isDarkMode ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-indigo-600 hover:bg-indigo-700'
                              }`}
                              title="Tải lên/Tạo kỳ thi mới"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Admin controls for renaming / hiding/showing selected exam */}
                      {userName === 'Admin-AMT' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className={`flex flex-col sm:flex-row gap-2 mt-2 p-3 rounded-2xl border transition-colors duration-300 ${
                            isDarkMode 
                              ? 'bg-amber-950/20 border-amber-900/35 text-amber-200' 
                              : 'bg-amber-50/50 rounded-2xl border border-amber-100/50'
                          }`}
                        >
                          <div className="flex-1 flex gap-2 items-center">
                            <span className={`text-[10px] font-bold uppercase shrink-0 ${isDarkMode ? 'text-amber-400' : 'text-amber-800'}`}>Chỉnh sửa:</span>
                            <input
                              type="text"
                              value={editingExamTitle}
                              onChange={(e) => setEditingExamTitle(e.target.value)}
                              placeholder="Đổi tên kỳ thi..."
                              className={`flex-1 min-w-[150px] px-3 py-1.5 rounded-lg text-xs font-semibold focus:outline-none transition-colors ${
                                isDarkMode 
                                  ? 'bg-white/5 border border-white/10 text-white focus:border-amber-500/50' 
                                  : 'bg-white border border-slate-200 text-slate-800'
                              }`}
                            />
                            <button
                              onClick={() => handleRenameExam(editingExamTitle)}
                              className={`px-3 py-1.5 text-white font-bold text-[10px] rounded-lg cursor-pointer transition uppercase shrink-0 ${
                                isDarkMode ? 'bg-amber-700 hover:bg-amber-600' : 'bg-amber-600 hover:bg-amber-750'
                              }`}
                            >
                              Lưu tên
                            </button>
                          </div>
                          
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={handleToggleHideExam}
                              className={`px-3 py-1.5 font-bold text-[10px] rounded-lg cursor-pointer transition flex items-center gap-1 text-white uppercase ${
                                activeExam.isHidden 
                                  ? 'bg-rose-500 hover:bg-rose-600' 
                                  : isDarkMode 
                                    ? 'bg-emerald-650 hover:bg-emerald-555' 
                                    : 'bg-emerald-600 hover:bg-emerald-705'
                              }`}
                            >
                              {activeExam.isHidden ? (
                                <>
                                  <EyeOff className="w-3.5 h-3.5" />
                                  Kỳ thi đang Ẩn (Hiện)
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3.5 h-3.5" />
                                  Kỳ thi đang Hiện (Ẩn)
                                </>
                              )}
                            </button>

                            {selectedExamId !== 'default' && (
                              <button
                                onClick={handleDeleteExam}
                                className={`px-3 py-1.5 font-bold text-[10px] rounded-lg cursor-pointer transition flex items-center gap-1 text-white uppercase ${
                                  isDarkMode ? 'bg-rose-600 hover:bg-rose-500' : 'bg-rose-650 hover:bg-rose-750'
                                }`}
                                title="Xóa kỳ thi vĩnh viễn"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Xóa kỳ thi
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-stretch">
                      {/* Mode Option Selection */}
                      <div className="flex flex-col justify-between h-full space-y-2">
                        <label className={`block text-xs font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Chế độ làm bài</label>
                        <div className="grid grid-cols-2 gap-3 flex-grow">
                          <button
                            onClick={() => {
                              setQuizMode('exam');
                              setIsCustomTarget(false);
                              setTargetCount(10);
                            }}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 h-full min-h-[90px] ${
                              quizMode === 'exam'
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg ring-4 ring-indigo-100'
                                : 'bg-slate-50/50 border-slate-100 text-slate-700 hover:border-indigo-600 hover:bg-white'
                            }`}
                          >
                            <Award className={`w-6 h-6 shrink-0 transition-colors ${quizMode === 'exam' ? 'text-amber-300' : 'text-amber-500'}`} />
                            <span className="text-sm sm:text-base font-extrabold tracking-wide font-sans">Thi Thử</span>
                          </button>

                          <button
                            onClick={() => {
                              setQuizMode('practice');
                              setIsCustomTarget(true);
                            }}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 h-full min-h-[90px] ${
                              quizMode === 'practice'
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg ring-4 ring-indigo-100'
                                : 'bg-slate-50/50 border-slate-100 text-slate-700 hover:border-indigo-600 hover:bg-white'
                            }`}
                          >
                            <BookOpen className={`w-6 h-6 shrink-0 transition-colors ${quizMode === 'practice' ? 'text-sky-300' : 'text-sky-500'}`} />
                            <span className="text-sm sm:text-base font-extrabold tracking-wide font-sans">Ôn Tập</span>
                          </button>
                        </div>
                      </div>

                      {/* Limits Parameter */}
                      <div className="flex flex-col justify-between h-full space-y-2">
                        <label className={`block text-xs font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Số lượng câu hỏi</label>
                        <div className="grid grid-cols-2 gap-3 flex-grow">
                          {quizMode === 'practice' ? (
                            (() => {
                              const ranges = getPracticeRanges();
                              const pad = (n: number) => String(n).padStart(2, '0');
                              const is1Active = isRangeSelected(ranges.r1);
                              const is2Active = isRangeSelected(ranges.r2);
                              const is3Active = isRangeSelected(ranges.r3);
                              
                              return (
                                <>
                                  {/* Ô thứ nhất */}
                                  <button
                                    onClick={() => {
                                      setIsCustomTarget(true);
                                      setCustomInputText(ranges.r1);
                                    }}
                                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center font-bold text-xs sm:text-sm transition-all cursor-pointer h-full ${
                                      is1Active
                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md ring-4 ring-indigo-100'
                                        : 'bg-slate-50/50 border-slate-100 text-slate-700 hover:border-indigo-600 hover:bg-white'
                                    }`}
                                  >
                                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">Phần 1/3</span>
                                    <span>Câu {pad(ranges.s1)} &rarr; {pad(ranges.e1)}</span>
                                  </button>

                                  {/* Ô thứ hai */}
                                  <button
                                    onClick={() => {
                                      setIsCustomTarget(true);
                                      setCustomInputText(ranges.r2);
                                    }}
                                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center font-bold text-xs sm:text-sm transition-all cursor-pointer h-full ${
                                      is2Active
                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md ring-4 ring-indigo-100'
                                        : 'bg-slate-50/50 border-slate-100 text-slate-700 hover:border-indigo-600 hover:bg-white'
                                    }`}
                                  >
                                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">Phần 2/3</span>
                                    <span>Câu {pad(ranges.s2)} &rarr; {pad(ranges.e2)}</span>
                                  </button>

                                  {/* Ô thứ ba */}
                                  <button
                                    onClick={() => {
                                      setIsCustomTarget(true);
                                      setCustomInputText(ranges.r3);
                                    }}
                                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center font-bold text-xs sm:text-sm transition-all cursor-pointer h-full ${
                                      is3Active
                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md ring-4 ring-indigo-100'
                                        : 'bg-slate-50/50 border-slate-100 text-slate-700 hover:border-indigo-600 hover:bg-white'
                                    }`}
                                  >
                                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">Phần 3/3</span>
                                    <span>Câu {pad(ranges.s3)} &rarr; {pad(ranges.e3)}</span>
                                  </button>
                                </>
                              );
                            })()
                          ) : (
                            <>
                              {/* 10 Câu */}
                              <button
                                onClick={() => {
                                  setTargetCount(Math.min(10, activeQuestionsCount));
                                  setIsCustomTarget(false);
                                }}
                                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center font-bold text-xs sm:text-sm transition-all cursor-pointer h-full ${
                                  !isCustomTarget && targetCount === Math.min(10, activeQuestionsCount)
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md ring-4 ring-indigo-100'
                                    : 'bg-slate-50/50 border-slate-100 text-slate-700 hover:border-indigo-600 hover:bg-white'
                                }`}
                              >
                                <span>{Math.min(10, activeQuestionsCount)} câu</span>
                              </button>

                              {/* 50 Câu */}
                              <button
                                onClick={() => {
                                  setTargetCount(Math.min(50, activeQuestionsCount));
                                  setIsCustomTarget(false);
                                }}
                                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center font-bold text-xs sm:text-sm transition-all cursor-pointer h-full ${
                                  !isCustomTarget && targetCount === Math.min(50, activeQuestionsCount) && Math.min(50, activeQuestionsCount) !== Math.min(10, activeQuestionsCount)
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md ring-4 ring-indigo-100'
                                    : 'bg-slate-50/50 border-slate-100 text-slate-700 hover:border-indigo-600 hover:bg-white'
                                }`}
                              >
                                <span>{Math.min(50, activeQuestionsCount)} câu</span>
                              </button>

                              {/* Tất cả */}
                              <button
                                onClick={() => {
                                  setTargetCount(activeQuestionsCount);
                                  setIsCustomTarget(false);
                                }}
                                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center font-bold text-xs sm:text-sm transition-all cursor-pointer h-full ${
                                  !isCustomTarget && (targetCount === activeQuestionsCount || targetCount === 0)
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md ring-4 ring-indigo-100'
                                    : 'bg-slate-50/50 border-slate-100 text-slate-700 hover:border-indigo-600 hover:bg-white'
                                }`}
                              >
                                <span>Tất cả</span>
                                <span className="text-[10px] font-normal opacity-85 mt-0.5">({activeQuestionsCount} câu)</span>
                              </button>
                            </>
                          )}

                          {/* Số câu tùy chọn / Từ câu...đến câu... */}
                          <div
                            onClick={() => {
                              setIsCustomTarget(true);
                            }}
                            className={`p-2 rounded-xl border flex flex-col items-center justify-center h-full transition-all cursor-pointer ${
                              (() => {
                                if (quizMode === 'practice') {
                                  const ranges = getPracticeRanges();
                                  const is1Active = isRangeSelected(ranges.r1);
                                  const is2Active = isRangeSelected(ranges.r2);
                                  const is3Active = isRangeSelected(ranges.r3);
                                  return isCustomTarget && !is1Active && !is2Active && !is3Active;
                                }
                                return isCustomTarget;
                              })()
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md ring-4 ring-indigo-100'
                                : 'bg-slate-50/50 border-slate-100 text-slate-700 hover:border-indigo-600 hover:bg-white'
                            }`}
                          >
                            <span className="text-[10px] uppercase tracking-wider font-extrabold opacity-95 mb-1 text-center">
                              {quizMode === 'practice' ? 'Từ câu...đến câu...' : 'Số câu tùy chọn'}
                            </span>
                            <input
                              type="text"
                              value={customInputText}
                              onChange={(e) => {
                                setIsCustomTarget(true);
                                const val = e.target.value;
                                if (quizMode === 'practice') {
                                  // Allow numbers, hyphens, and spaces
                                  const filtered = val.replace(/[^0-9\-\s]/g, '');
                                  setCustomInputText(filtered);
                                } else {
                                  if (val === '') {
                                    setCustomInputText('');
                                  } else {
                                    // Remove any safe characters to extract standard digit
                                    const digits = val.replace(/[^0-9]/g, '');
                                    const parsed = parseInt(digits, 10);
                                    if (!isNaN(parsed)) {
                                      setCustomInputText(String(Math.min(parsed, activeQuestionsCount)));
                                    } else {
                                      setCustomInputText('');
                                    }
                                  }
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleStartQuiz();
                                }
                              }}
                              placeholder={
                                quizMode === 'practice'
                                  ? `Ví dụ: 25-50`
                                  : `Tối đa: ${activeQuestionsCount}`
                              }
                              className={`w-full font-bold text-center text-xs py-1 px-2 rounded-lg border-none focus:outline-none transition-colors ${
                                (() => {
                                  if (quizMode === 'practice') {
                                    const ranges = getPracticeRanges();
                                    const is1Active = isRangeSelected(ranges.r1);
                                    const is2Active = isRangeSelected(ranges.r2);
                                    const is3Active = isRangeSelected(ranges.r3);
                                    return isCustomTarget && !is1Active && !is2Active && !is3Active;
                                  }
                                  return isCustomTarget;
                                })()
                                  ? 'bg-white text-indigo-950 focus:ring-2 focus:ring-indigo-300'
                                  : 'bg-slate-150 text-slate-700 focus:ring-2 focus:ring-indigo-500'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsCustomTarget(true);
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Extra detailed Toggles */}
                    <div className={`space-y-2.5 pt-3.5 border-t ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
                      <h4 className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Tùy chọn xáo trộn nâng cao</h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className={`flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl border cursor-pointer transition ${
                          isDarkMode 
                            ? 'bg-white/[0.02] border-white/10 hover:border-indigo-500 hover:bg-white/[0.04]' 
                            : 'bg-slate-50/50 border-slate-100 hover:bg-white hover:border-indigo-600'
                        }`}>
                          <input
                            type="checkbox"
                            checked={shuffleQuestionsRule}
                            onChange={(e) => setShuffleQuestionsRule(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                          />
                          <div>
                            <span className={`text-xs sm:text-sm font-semibold block ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Xáo trộn thứ tự các câu hỏi</span>
                            <p className="text-[9px] text-slate-400 font-medium">Chọn ngẫu nhiên câu hỏi từ ngân hàng đề</p>
                          </div>
                        </label>

                        <label className={`flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl border cursor-pointer transition ${
                          isDarkMode 
                            ? 'bg-white/[0.02] border-white/10 hover:border-indigo-500 hover:bg-white/[0.04]' 
                            : 'bg-slate-50/50 border-slate-100 hover:bg-white hover:border-indigo-600'
                        }`}>
                          <input
                            type="checkbox"
                            checked={shuffleOptionsRule}
                            onChange={(e) => setShuffleOptionsRule(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                          />
                          <div>
                            <span className={`text-xs sm:text-sm font-semibold block ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Xáo trộn 4 đáp án lựa chọn</span>
                            <p className="text-[9px] text-slate-400 font-medium">Thứ tự A, B, C, D thay đổi ngẫu nhiên</p>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Confirm Action Button */}
                    <div className="pt-1.5">
                      <motion.button
                        onClick={handleStartQuiz}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        id="btn-start-quiz"
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Play className="w-4.5 h-4.5 fill-current" />
                        BẮT ĐẦU LÀM BÀI NGAY
                      </motion.button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>

            {/* Submission history for Admin and TPĐĐ (OUTSIDE intro-container for landscape view) */}
            {nameSubmitted && (userName === 'Admin-AMT' || userName === 'TPĐĐ') && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-6 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 w-full max-w-7xl space-y-5"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-lg font-bold text-slate-800">Lịch sử nộp bài học viên</h3>
                  </div>
                  {history.length > 0 && userName === 'Admin-AMT' && (
                    <button
                      onClick={async () => {
                        if (window.confirm('Xác nhận xóa sạch toàn bộ lịch sử nộp bài của học viên trên cơ sở dữ liệu đám mây?')) {
                          try {
                            const snapshot = await getDocs(collection(db, 'history'));
                            const batch = writeBatch(db);
                            snapshot.docs.forEach((docRef) => {
                              batch.delete(docRef.ref);
                            });
                            await batch.commit();
                            localStorage.removeItem('quiz_history');
                            setHistory([]);
                          } catch (err) {
                            console.error('Error clearing history:', err);
                          }
                        }
                      }}
                      className="text-xs font-bold text-red-500 hover:text-red-700 cursor-pointer"
                    >
                      Xóa lịch sử
                    </button>
                  )}
                </div>

                {history.length === 0 ? (
                  <p className="text-slate-400 text-xs italic text-center py-4">Chưa có lượt nộp bài nào được ghi nhận.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-xl border border-slate-100">
                      <table className="min-w-full divide-y divide-slate-150 text-left text-xs font-medium text-slate-600">
                        <thead className="bg-slate-50 text-slate-500 font-bold">
                          <tr>
                            <th className="px-4 py-3 min-w-[120px]">Tên học viên</th>
                            <th className="px-4 py-3 min-w-[220px]">Kỳ thi đã thi</th>
                            <th className="px-4 py-3 min-w-[120px]">Chế độ làm bài</th>
                            <th className="px-4 py-3 min-w-[140px]">Ngày giờ nộp bài</th>
                            <th className="px-4 py-3 min-w-[120px]">Thời gian làm bài</th>
                            <th className="px-4 py-3 text-right min-w-[70px]">Kết quả</th>
                            <th className="px-4 py-3 text-center min-w-[70px]">Điểm</th>
                            <th className="px-4 py-3 text-center min-w-[90px]">Đánh giá</th>
                            {userName === 'Admin-AMT' && (
                              <th className="w-12 px-4 py-3"></th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-slate-700">
                          {history.map((h, i) => {
                            let percentStr = '00';
                            let isPassed = false;
                            if (h.score) {
                              const parts = h.score.split('/');
                              if (parts.length === 2 && parts[1]) {
                                const correct = parseInt(parts[0], 10);
                                const total = parseInt(parts[1], 10);
                                if (!isNaN(correct) && !isNaN(total) && total > 0) {
                                  const pct = Math.round((correct / total) * 100);
                                  percentStr = String(pct).padStart(2, '0');
                                  isPassed = pct >= 80;
                                }
                              }
                            }
                            return (
                              <tr key={i} className="hover:bg-slate-50/50 transition group">
                                <td className="px-4 py-3 font-semibold text-slate-900">{h.name}</td>
                                <td className="px-4 py-3 truncate max-w-[280px]" title={h.examTitle}>{h.examTitle}</td>
                                <td className="px-4 py-3 text-slate-600 font-medium">{h.mode || 'Thi thử'}</td>
                                <td className="px-4 py-3 font-mono text-slate-500">{h.time}</td>
                                <td className="px-4 py-3 font-mono text-slate-500">{formatDuration(h.duration)}</td>
                                <td className="px-4 py-3 font-mono text-right font-medium text-slate-500">{h.score}</td>
                                <td className="px-4 py-3 font-mono text-center font-bold text-indigo-600">{percentStr}</td>
                                <td className="px-4 py-3 text-center whitespace-nowrap">
                                  {isPassed ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      ĐẠT
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                                      KHÔNG ĐẠT
                                    </span>
                                  )}
                                </td>
                                {userName === 'Admin-AMT' && (
                                  <td className="px-4 py-3 text-center whitespace-nowrap w-12">
                                    <button
                                      onClick={async () => {
                                        if (window.confirm(`Xác nhận xóa kết quả của học viên "${h.name}"?`)) {
                                          try {
                                            if (h.id) {
                                              await deleteDoc(doc(db, 'history', h.id));
                                            }
                                          } catch (err) {
                                            console.error('Error deleting submission record:', err);
                                            alert('Lỗi khi xóa: ' + (err instanceof Error ? err.message : String(err)));
                                          }
                                        }
                                      }}
                                      className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition duration-150 cursor-pointer inline-flex items-center justify-center align-middle"
                                      title="Xóa dòng này"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={handleExportData}
                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow transition duration-150 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        Xuất dữ liệu Excel
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </>
        )}
      </div>
    )}

          {/* Phase 2: Active testing experience */}
          {phase === 'quiz' && (
            <motion.div
              key="quiz-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full flex-grow flex flex-col lg:flex-row gap-8 items-start"
            >
              {/* Question container card (Left Side) */}
              <div className={`flex-1 w-full rounded-2xl p-4 sm:p-5 lg:p-7 shadow-lg transition-colors duration-300 border ${
                isDarkMode 
                  ? 'bg-[#0f172a]/60 border-white/10 text-white backdrop-blur-xl' 
                  : 'bg-white border-slate-100 text-slate-800'
              }`}>
                
                {/* Embedded Progress indicator */}
                <div className={`w-full h-1.5 rounded-full overflow-hidden mb-4 md:hidden ${
                  isDarkMode ? 'bg-white/10' : 'bg-slate-100'
                }`}>
                  <motion.div
                    className="bg-indigo-600 h-full rounded-full"
                    id="exam-progress-bar-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentIndex + 1) / examQuestions.length) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>

                <QuizCard
                  question={examQuestions[currentIndex]}
                  currentIndex={currentIndex}
                  totalQuestions={examQuestions.length}
                  selectedAnswer={userAnswers[currentIndex] ?? null}
                  onSelectAnswer={handleSelectAnswer}
                  mode={quizMode}
                  isDarkMode={isDarkMode}
                />

                {/* Sub Navigation Panel */}
                <div className={`flex flex-wrap items-center justify-between border-t pt-4 mt-5 gap-3 transition-colors ${
                  isDarkMode ? 'border-white/10' : 'border-slate-100'
                }`}>
                  <button
                    onClick={handleSubmitQuiz}
                    className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition shadow-lg shadow-red-100 hover:shadow-xl flex items-center justify-center gap-1.5 cursor-pointer text-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Nộp bài
                  </button>

                  <div className="hidden sm:flex items-center gap-1 text-xs text-slate-400 font-mono">
                    Đã hoàn thành <strong className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>{answeredCount}</strong>/{examQuestions.length} câu
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrevious}
                      disabled={currentIndex === 0}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition shadow-lg shadow-indigo-100 hover:shadow-xl flex items-center justify-center gap-1.5 cursor-pointer text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Câu trước</span>
                    </button>

                    {currentIndex < examQuestions.length - 1 && (
                      <button
                        onClick={handleNext}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition shadow-lg shadow-indigo-100 hover:shadow-xl flex items-center justify-center gap-1.5 cursor-pointer text-sm"
                      >
                        <span>Kế tiếp</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Sidebar Quick Jump - Question Grid Mapping (Right Side on desktop, mobile slide-over) */}
              <div
                id="sidebar-jump-panel"
                className={`fixed lg:relative top-0 right-0 h-full lg:h-auto z-50 lg:z-0 w-80 lg:w-72 border-l lg:border-l-0 lg:border-none p-5 lg:p-0 flex flex-col gap-5 transition-all duration-300 shadow-xl lg:shadow-none ${
                  isDarkMode 
                    ? 'bg-[#0f172a] lg:bg-transparent border-white/10' 
                    : 'bg-white lg:bg-transparent border-slate-200'
                } ${
                  sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
                }`}
              >
                {/* Mobile sidebar header */}
                <div className={`flex lg:hidden items-center justify-between border-b pb-4 ${
                  isDarkMode ? 'border-white/10' : 'border-slate-200'
                }`}>
                  <h3 className={`font-extrabold text-sm uppercase ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>Sơ đồ làm bài</h3>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className={`p-1.5 rounded-lg border ${
                      isDarkMode 
                        ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10' 
                        : 'bg-slate-150 border-slate-200 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Grid Navigation container */}
                <div className={`transition-colors duration-300 rounded-2xl p-4 sm:p-5 shadow-lg border space-y-4 ${
                  isDarkMode 
                    ? 'bg-[#0f172a]/60 border-white/10 text-white backdrop-blur-xl' 
                    : 'bg-white border-slate-100 text-slate-800'
                }`}>
                  <div className={`flex items-center justify-between border-b pb-3 ${
                    isDarkMode ? 'border-white/5' : 'border-slate-50'
                  }`}>
                    <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-400 flex items-center gap-2">
                      <BookMarked className={`w-4 h-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                      Danh sách {examQuestions.length} câu
                    </h4>
                    <span className={`text-xs font-bold font-mono px-2.5 py-1 rounded-full ${
                      isDarkMode ? 'text-indigo-300 bg-indigo-500/10' : 'text-indigo-700 bg-indigo-50'
                    }`}>
                      {answeredCount}/{examQuestions.length}
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-normal font-medium">
                    Nhấp vào số để chuyển câu hỏi nhanh. Màu xanh nhạt là câu hỏi bạn đã điền đáp án.
                  </p>

                  <div className="grid grid-cols-5 gap-2 max-h-96 overflow-y-auto pr-1">
                    {examQuestions.map((_, index) => {
                      const isOptionSelected = userAnswers[index] !== undefined && userAnswers[index] !== null;
                      const isCurrent = currentIndex === index;

                      let cellClass = "w-full aspect-square rounded-xl flex items-center justify-center font-bold text-xs transition border cursor-pointer font-mono ";
                      if (isCurrent) {
                        cellClass += isDarkMode 
                          ? "bg-indigo-500 border-indigo-500 text-white font-bold ring-4 ring-indigo-500/20 shadow-sm "
                          : "bg-indigo-600 border-indigo-600 text-white font-bold ring-4 ring-indigo-100 shadow-sm ";
                      } else if (isOptionSelected) {
                        cellClass += isDarkMode
                          ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 "
                          : "bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100/50 ";
                      } else {
                        cellClass += isDarkMode
                          ? "bg-white/[0.03] border-white/10 text-slate-400 hover:bg-white/10 hover:border-slate-400 "
                          : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-350 ";
                      }

                      return (
                        <button
                          key={index}
                          onClick={() => {
                            setCurrentIndex(index);
                            setSidebarOpen(false); // close sidebar on mobile jump
                          }}
                          className={cellClass}
                        >
                          {index + 1}
                        </button>
                      );
                    })}
                  </div>

                  {/* Submission CTA directly inside the navigations panel */}
                  <div className={`pt-3 border-t ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
                    <button
                      onClick={handleSubmitQuiz}
                      className={`w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs tracking-wider uppercase rounded-xl transition duration-150 text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                        isDarkMode ? '' : 'shadow-md shadow-red-50'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Nộp bài kết quả
                    </button>
                  </div>
                </div>
              </div>

            {/* Backdrop cover overlay on mobile */}
            {phase === 'quiz' && sidebarOpen && (
              <div
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-40 lg:hidden"
              />
            )}
          </motion.div>
          )}

          {/* Phase 3: Detailed Score review dashboard */}
          {phase === 'result' && (
            <motion.div
              key="result-screen"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full"
            >
              <QuizReview
                questions={examQuestions}
                userAnswers={userAnswers}
                timeSpent={timeSpent}
                onRestart={() => setPhase('intro')}
                isDarkMode={isDarkMode}
                studentName={userName || 'Học viên'}
                examTitle={activeExam?.title || 'Bộ đề thi'}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Upload/Custom Exam creation modal (Admin-AMT only) */}
      {showAddExamModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl max-w-xl w-full border border-slate-100 space-y-6 relative max-h-[90vh] overflow-y-auto"
          >
            {/* Close button */}
            <button
              onClick={() => {
                setShowAddExamModal(false);
                setShowExamNamingStep(false);
                setErrorMsg('');
              }}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {!showExamNamingStep ? (
              /* Step 1: Input text dán đề hoặc kéo tệp */
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-indigo-600">
                    <Plus className="w-5 h-5" />
                    <h3 className="text-xl font-extrabold font-sans">Tạo kỳ thi tùy chỉnh mới</h3>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    Nhập/Dán nội dung câu hỏi kèm danh sách đáp án tương ứng. Hệ thống sẽ tự động phân tích và tạo bài tập ngay.
                  </p>
                </div>

                {/* Formatted Guide Box */}
                <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-4 text-xs text-amber-900 space-y-2">
                  <span className="font-extrabold uppercase tracking-wide text-[10px] text-amber-800">Quy chuẩn định dạng dữ liệu dán:</span>
                  <pre className="font-mono text-[10px] leading-relaxed select-all bg-white/60 p-2 rounded-lg border border-amber-100/50">
{`Câu hỏi 1: Nội dung câu hỏi...
A: Lựa chọn A
B: Lựa chọn B
C: Lựa chọn C
D: Lựa chọn D

... đến câu hỏi cuối cùng

Đáp án:
1A 2B 3C 4D...`}
                  </pre>
                </div>

                {/* Main data input textarea */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase">Nội dung đề thi hoặc Đáp án</label>
                  <textarea
                    rows={12}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Hãy dán nội dung đoạn câu hỏi và phần đáp án phía cuối vào đây..."
                    className="w-full p-4 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl text-xs font-mono transition resize-none focus:outline-none"
                  />
                </div>

                {/* Errors display if any */}
                {errorMsg && (
                  <div className="flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-xl text-xs font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Footer submit block */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowAddExamModal(false);
                      setErrorMsg('');
                    }}
                    className="px-5 py-2.5 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl text-xs font-bold cursor-pointer transition"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    onClick={handleParseAndPromptExamName}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition"
                  >
                    Tiếp tục phân tích đề
                  </button>
                </div>
              </>
            ) : (
              /* Step 2: Đặt tên cho bài kì thi */
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-indigo-600">
                    <Sparkles className="w-5 h-5" />
                    <h3 className="text-xl font-extrabold font-sans">Đặt tên bài thi của bạn</h3>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    Hệ thống đã phân tích thành công <strong className="text-indigo-600">{parsedQuestions.length} câu hỏi</strong>. Hãy đặt một tên gợi nhớ cho đề này.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase">Tên bài thi / Đề kỳ thi</label>
                    <input
                      type="text"
                      value={customExamTitle}
                      onChange={(e) => setCustomExamTitle(e.target.value)}
                      placeholder="Ví dụ: Đề Ôn Tập Đợt 2 - Quy Trình Điều Độ"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl text-sm font-semibold transition focus:outline-none"
                      autoFocus
                    />
                  </div>

                  {/* Summary of parsed sample */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Xem thử câu hỏi 1:</span>
                    <p className="text-xs font-bold text-slate-800 leading-normal line-clamp-2">{parsedQuestions[0]?.text}</p>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 font-medium pt-1">
                      <div>A: {parsedQuestions[0]?.options[0] || 'N/A'}</div>
                      <div>B: {parsedQuestions[0]?.options[1] || 'N/A'}</div>
                      <div>C: {parsedQuestions[0]?.options[2] || 'N/A'}</div>
                      <div>D: {parsedQuestions[0]?.options[3] || 'N/A'}</div>
                    </div>
                    <span className="inline-block mt-1 font-mono text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-extrabold">Đáp án đúng câu 1: {parsedQuestions[0]?.correctAnswer}</span>
                  </div>
                </div>

                {/* Action buttons footer */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowExamNamingStep(false)}
                    className="px-5 py-2.5 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl text-xs font-bold cursor-pointer transition"
                  >
                    Quay lại sửa đề
                  </button>
                  <button
                    onClick={handleFinalCreateExam}
                    disabled={!customExamTitle.trim()}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    TẠO BÀI TẬP
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}

      {/* Footer copyright */}
      <footer id="app-global-footer" className="text-center text-xs text-slate-400 font-medium">
      </footer>

      {/* Dev Sticky Badge Capsule */}
      <div 
        onClick={() => setShowLogoModal(true)}
        className={`fixed z-50 flex items-center select-none bg-white/95 backdrop-blur-md border border-slate-200/90 text-slate-600 hover:scale-105 hover:bg-white transition-all duration-300 cursor-pointer active:scale-95 ${
          phase === 'quiz'
            ? 'bottom-1 right-1 px-2 py-0.5 rounded-lg gap-1 scale-90 opacity-60 hover:opacity-100 hover:scale-95 shadow-md'
            : 'bottom-4 right-4 px-3 py-1.5 rounded-full gap-2 shadow-lg'
        }`}
      >
        {phase !== 'quiz' && (
          <span className="text-[11px] font-semibold text-slate-500">Dev:</span>
        )}
        <span className={`font-handwritten font-bold text-slate-800 tracking-normal leading-none ${
          phase === 'quiz' ? 'text-sm mb-0' : 'text-lg mb-0.5'
        }`}>
          Đoàn Trọng Anh
        </span>
        <div className={`rounded-full overflow-hidden border border-slate-200 shadow-xs bg-slate-50 shrink-0 ${
          phase === 'quiz' ? 'w-4 h-4' : 'w-6 h-6 ml-0.5'
        }`}>
          <img
            src={logoImg}
            alt="Dev Avatar"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=150&h=150&q=80";
            }}
          />
        </div>
      </div>

      {/* Logo Lightbox Modal */}
      {showLogoModal && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 transition-all duration-300 animate-in fade-in"
          onClick={() => setShowLogoModal(false)}
        >
          <div 
            className="relative max-w-sm w-full bg-white rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              onClick={() => setShowLogoModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-all cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {/* Logo Image */}
            <div className="w-64 h-64 rounded-2xl overflow-hidden border border-slate-100 shadow-md bg-slate-50 mt-4">
              <img
                src={logoImg}
                alt="Logo Full"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=400&h=400&q=80";
                }}
              />
            </div>
            
            {/* Caption */}
            <div className="text-center space-y-1">
              <h4 className="font-handwritten font-bold text-slate-800 text-3xl tracking-normal">
                Đoàn Trọng Anh
              </h4>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                Creator & Developer
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
