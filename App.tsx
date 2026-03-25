/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  BookOpen, 
  BrainCircuit, 
  History, 
  Settings, 
  Mic, 
  Play, 
  Pause, 
  CheckCircle2, 
  XCircle,
  Award,
  ChevronRight,
  ChevronDown,
  Loader2,
  ShieldCheck,
  Globe,
  Sparkles,
  Volume2,
  AlertTriangle,
  Zap,
  DollarSign,
  Star
} from 'lucide-react';
import { Session, QuizQuestion } from './types';

type AIProvider = 'gemini' | 'chatgpt' | 'claude';

const PROVIDER_META: Record<AIProvider, { label: string; desc: string; icon: React.ReactNode; badge: string; badgeColor: string }> = {
  gemini: {
    label: 'Gemini',
    desc: 'Google Gemini 1.5 Flash — fast & free',
    icon: <Zap size={16} />,
    badge: 'Primary',
    badgeColor: 'bg-brand-teal/20 text-brand-teal border-brand-teal/30',
  },
  chatgpt: {
    label: 'ChatGPT',
    desc: 'OpenAI GPT-4o mini — solid alternative',
    icon: <Star size={16} />,
    badge: 'Alternative',
    badgeColor: 'bg-brand-gold/20 text-brand-gold border-brand-gold/30',
  },
  claude: {
    label: 'Claude',
    desc: 'Anthropic Claude 3.5 Sonnet — best quality',
    icon: <DollarSign size={16} />,
    badge: 'Premium',
    badgeColor: 'bg-brand-rose/20 text-brand-rose border-brand-rose/30',
  },
};

type View = 'home' | 'learn' | 'quiz' | 'history';

interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  label?: string;
}

function CustomSelect({ value, onChange, options, label }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-2 relative">
      {label && <label className="text-sm font-medium text-white/60">{label}</label>}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full bg-white/5 border border-white/10 rounded-xl p-3 pr-10 text-left focus:outline-none focus:border-brand-purple/50 hover:bg-white/10 transition-all flex items-center justify-between"
        >
          <span className="truncate">{value}</span>
          <ChevronDown 
            size={18} 
            className={`text-white/40 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
          />
        </button>

        <AnimatePresence>
          {isOpen && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setIsOpen(false)} 
              />
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full left-0 right-0 mt-2 z-20 glass rounded-2xl overflow-hidden shadow-2xl border-white/20"
              >
                <div className="max-h-60 overflow-y-auto py-2">
                  {options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => {
                        onChange(opt);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm transition-colors hover:bg-white/10 ${
                        value === opt ? 'text-brand-teal font-semibold bg-white/5' : 'text-white/80'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Murf Voice ID map per language ──────────────────────────────────────────
const MURF_VOICE_MAP: Record<string, string> = {
  'English': 'en-US-natalie',
  'Hindi':   'hi-IN-isha',
  'Telugu':  'te-IN-bhavani',
  'Tamil':   'ta-IN-nizhoni',
  'Spanish': 'es-ES-alvaro',
  'French':  'fr-FR-maxime',
};

// ─── API helpers ──────────────────────────────────────────────────────────────
function buildAIHeaders(geminiKey: string, openaiKey: string, claudeKey: string, preferredModel: AIProvider) {
  return {
    'Content-Type': 'application/json',
    ...(geminiKey  ? { 'X-Gemini-Key':  geminiKey  } : {}),
    ...(openaiKey  ? { 'X-Openai-Key':  openaiKey  } : {}),
    ...(claudeKey  ? { 'X-Claude-Key':  claudeKey  } : {}),
    'X-AI-Model': preferredModel,
  };
}

async function apiExplain(
  topic: string, level: string, language: string,
  geminiKey: string, openaiKey: string, claudeKey: string, preferredModel: AIProvider
): Promise<{ explanation: string; provider: string }> {
  const res = await fetch('/api/explain', {
    method: 'POST',
    headers: buildAIHeaders(geminiKey, openaiKey, claudeKey, preferredModel),
    body: JSON.stringify({ topic, level, language }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'AI explanation failed');
  return { explanation: data.explanation as string, provider: data.provider as string };
}

async function apiGenerateVoice(
  text: string, language: string, murfKey: string
): Promise<string> {
  const voiceId = MURF_VOICE_MAP[language] || 'en-US-natalie';
  const res = await fetch('/api/generate-voice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Murf-Key': murfKey,
    },
    body: JSON.stringify({ text, voiceId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Voice generation failed');
  return data.audioUrl as string;
}

async function apiGenerateQuiz(
  topic: string, level: string,
  geminiKey: string, openaiKey: string, claudeKey: string, preferredModel: AIProvider
): Promise<QuizQuestion[]> {
  const res = await fetch('/api/generate-quiz', {
    method: 'POST',
    headers: buildAIHeaders(geminiKey, openaiKey, claudeKey, preferredModel),
    body: JSON.stringify({ topic, level }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Quiz generation failed');
  return data.quiz as QuizQuestion[];
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeView, setActiveView] = useState<View>('home');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // BYOK keys — stored in localStorage, never sent to server storage
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('voicelearn_gemini_key') || '');
  const [openaiKey, setOpenaiKey] = useState(localStorage.getItem('voicelearn_openai_key') || '');
  const [claudeKey, setClaudeKey] = useState(localStorage.getItem('voicelearn_claude_key') || '');
  const [murfKey, setMurfKey] = useState(localStorage.getItem('voicelearn_murf_key') || '');
  const [preferredModel, setPreferredModel] = useState<AIProvider>(
    (localStorage.getItem('voicelearn_preferred_model') as AIProvider) || 'gemini'
  );

  const [sessions, setSessions] = useState<Session[]>([]);

  // Learn View State
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('Beginner');
  const [language, setLanguage] = useState('English');
  const [isExplaining, setIsExplaining] = useState(false);
  const [currentExplanation, setCurrentExplanation] = useState('');
  const [providerUsed, setProviderUsed] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [apiError, setApiError] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);

  // Quiz View State
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>([]);
  const [showQuizResults, setShowQuizResults] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('voicelearn_sessions');
    if (saved) setSessions(JSON.parse(saved));
  }, []);

  const saveSession = (newSession: Session) => {
    const updated = [newSession, ...sessions];
    setSessions(updated);
    localStorage.setItem('voicelearn_sessions', JSON.stringify(updated));
  };

  // ── Audio control ────────────────────────────────────────────────────────
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  };

  // ── handleExplain ────────────────────────────────────────────────────────
  const handleExplain = async () => {
    if (!topic) return;
    setIsExplaining(true);
    setApiError('');
    setCurrentExplanation('');
    setProviderUsed('');
    setAudioUrl('');
    setIsPlaying(false);
    setQuiz([]);

    try {
      const { explanation, provider } = await apiExplain(topic, level, language, geminiKey, openaiKey, claudeKey, preferredModel);
      setCurrentExplanation(explanation);
      setProviderUsed(provider);

      const newSession: Session = {
        id: Math.random().toString(36).substr(2, 9),
        topic,
        level,
        language,
        explanation,
        timestamp: Date.now(),
      };
      saveSession(newSession);

      // Generate voice if Murf key is set
      if (murfKey) {
        setIsGeneratingVoice(true);
        try {
          const url = await apiGenerateVoice(explanation, language, murfKey);
          setAudioUrl(url);
        } catch (e: unknown) {
          console.warn('Voice generation failed:', e);
        } finally {
          setIsGeneratingVoice(false);
        }
      }
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : 'Unknown error occurred');
    } finally {
      setIsExplaining(false);
    }
  };

  // ── handleGoToQuiz ───────────────────────────────────────────────────────
  const handleGoToQuiz = async () => {
    setActiveView('quiz');
    if (quiz.length === 0 && topic) {
      setIsLoadingQuiz(true);
      try {
        const generated = await apiGenerateQuiz(topic, level, geminiKey, openaiKey, claudeKey, preferredModel);
        setQuiz(generated);
        setQuizAnswers(new Array(generated.length).fill(null));
      } catch (e: unknown) {
        console.warn('Quiz generation failed:', e);
      } finally {
        setIsLoadingQuiz(false);
      }
    }
  };

  const handleReview = (session: Session) => {
    setTopic(session.topic);
    setLevel(session.level);
    setLanguage(session.language);
    setCurrentExplanation(session.explanation);
    setAudioUrl(session.audioUrl || '');
    setQuiz([]);
    setActiveView('learn');
  };

  // ── Render Home ──────────────────────────────────────────────────────────
  const renderHome = () => (
    <div className="flex flex-col items-center text-center pt-12 pb-24 px-4 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
        className="max-w-3xl relative"
      >
        <div className="absolute -inset-10 bg-brand-purple/10 blur-[100px] -z-10 rounded-full" />
        
        <motion.span 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="px-5 py-2 rounded-full bg-white/5 text-brand-teal text-xs font-bold mb-8 inline-block border border-white/10 tracking-widest uppercase"
        >
          Intelligence in every word
        </motion.span>
        
        <h1 className="text-6xl md:text-8xl font-bold mb-8 tracking-tighter leading-[0.9] text-white">
          Making Learning <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-purple via-brand-teal to-brand-purple bg-[length:200%_auto] animate-gradient-x">
            Accessible to All
          </span>
        </h1>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-xl text-white/50 mb-12 max-w-xl mx-auto font-medium leading-relaxed"
        >
          Personalized AI tutoring that speaks your language. Master any topic with voice explanations and interactive quizzes.
        </motion.p>
        
        <motion.button 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          onClick={() => setActiveView('learn')}
          className="btn-primary flex items-center gap-3 mx-auto group"
        >
          Start Learning 
          <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
        </motion.button>
      </motion.div>

      <motion.div 
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.1, delayChildren: 0.8 } }
        }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-24 w-full max-w-6xl"
      >
        {[
          { icon: <BrainCircuit className="text-brand-purple" />, title: "AI Explain", desc: "Complex topics simplified by Claude or Gemini." },
          { icon: <Mic className="text-brand-teal" />, title: "Murf Voice", desc: "High-fidelity voice synthesis by Murf AI." },
          { icon: <Award className="text-brand-rose" />, title: "Smart Quizzes", desc: "AI-generated quizzes tailored to your topic." },
          { icon: <Globe className="text-brand-gold" />, title: "Multi-language", desc: "Learn in your native tongue effortlessly." }
        ].map((feature, i) => (
          <motion.div
            key={i}
            variants={{
              hidden: { opacity: 0, y: 30 },
              visible: { opacity: 1, y: 0 }
            }}
            transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
            className="glass-card text-left group"
          >
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-6 border border-white/10 group-hover:border-white/20 group-hover:bg-white/10 transition-all">
              {feature.icon}
            </div>
            <h3 className="text-2xl font-bold mb-3 tracking-tight">{feature.title}</h3>
            <p className="text-white/40 text-sm leading-relaxed font-medium">{feature.desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );

  // ── Render Learn ─────────────────────────────────────────────────────────
  const renderLearn = () => (
    <div className="max-w-4xl mx-auto pt-8 pb-32 px-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-8"
      >
        <div className="glass-card space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/60">What do you want to learn today?</label>
            <textarea 
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. How do quantum computers work?"
              className="glass-input min-h-[120px] resize-none"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CustomSelect 
              label="Learning Level"
              value={level}
              onChange={setLevel}
              options={['Beginner', 'School Level', 'Exam Prep']}
            />
            <CustomSelect 
              label="Language"
              value={language}
              onChange={setLanguage}
              options={['English', 'Hindi', 'Telugu', 'Tamil', 'Spanish', 'French']}
            />
          </div>

          {/* API key warning */}
          {!geminiKey && !openaiKey && !claudeKey && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-brand-gold/5 border border-brand-gold/20">
              <AlertTriangle size={18} className="text-brand-gold mt-0.5 shrink-0" />
              <p className="text-sm text-brand-gold/80 leading-relaxed">
                No user API key set — using server Gemini fallback. Add your keys in{' '}
                <button onClick={() => setIsSettingsOpen(true)} className="underline font-bold hover:text-brand-gold transition-colors">Settings</button>{' '}
                for full control.
              </p>
            </div>
          )}

          <button 
            onClick={handleExplain}
            disabled={isExplaining || !topic}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {isExplaining ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                AI is thinking...
              </>
            ) : (
              <>
                <Sparkles size={20} />
                Explain Topic
              </>
            )}
          </button>
        </div>

        {/* Error banner */}
        {apiError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-4 rounded-xl bg-brand-rose/10 border border-brand-rose/30"
          >
            <XCircle size={18} className="text-brand-rose mt-0.5 shrink-0" />
            <p className="text-sm text-brand-rose/90">{apiError}</p>
          </motion.div>
        )}

        {currentExplanation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="glass-card">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-bold tracking-tighter">Explanation</h2>
                  {providerUsed && (
                    <span className={`mt-1 inline-block text-xs font-bold px-2 py-0.5 rounded-full border ${
                      providerUsed === 'gemini'  ? 'bg-brand-teal/10 text-brand-teal border-brand-teal/20' :
                      providerUsed === 'chatgpt' ? 'bg-brand-gold/10 text-brand-gold border-brand-gold/20' :
                                                   'bg-brand-rose/10 text-brand-rose border-brand-rose/20'
                    }`}>
                      via {providerUsed === 'gemini' ? 'Gemini' : providerUsed === 'chatgpt' ? 'ChatGPT' : 'Claude'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {/* Audio player */}
                  {isGeneratingVoice ? (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/40 text-sm">
                      <Loader2 className="animate-spin" size={16} />
                      Generating voice…
                    </div>
                  ) : audioUrl ? (
                    <>
                      <audio
                        ref={audioRef}
                        src={audioUrl}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnded={() => setIsPlaying(false)}
                      />
                      <button 
                        onClick={togglePlay}
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                          isPlaying 
                            ? 'bg-brand-teal text-bg-dark shadow-[0_0_30px_rgba(0,229,195,0.4)]' 
                            : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                      </button>
                    </>
                  ) : (
                    !murfKey && (
                      <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/40 text-sm hover:bg-white/10 transition-all"
                      >
                        <Volume2 size={16} />
                        Add Murf key for voice
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Waveform animation while playing */}
              {isPlaying && (
                <div className="flex items-end gap-1.5 h-16 mb-10 justify-center">
                  {[...Array(12)].map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{ height: [15, 60, 20, 50, 15] }}
                      transition={{ 
                        repeat: Infinity, 
                        duration: 1 + Math.random(), 
                        delay: i * 0.05,
                        ease: "easeInOut"
                      }}
                      className={`w-2.5 rounded-full ${i % 2 === 0 ? 'bg-brand-teal' : 'bg-brand-purple'}`}
                    />
                  ))}
                </div>
              )}

              <div className="prose prose-invert max-w-none text-white/80 leading-relaxed whitespace-pre-wrap">
                {currentExplanation}
              </div>

              <div className="mt-8 pt-8 border-t border-white/10 flex justify-between items-center">
                <p className="text-sm text-white/40 italic">Ready to test your knowledge?</p>
                <button 
                  onClick={handleGoToQuiz}
                  className="btn-outline py-2 px-6 text-sm flex items-center gap-2"
                >
                  Take Quiz <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );

  // ── Render Quiz ──────────────────────────────────────────────────────────
  const renderQuiz = () => {
    if (isLoadingQuiz) {
      return (
        <div className="flex flex-col items-center justify-center py-32 gap-6">
          <div className="w-20 h-20 rounded-3xl bg-brand-purple/10 border border-brand-purple/20 flex items-center justify-center">
            <Loader2 className="text-brand-purple animate-spin" size={36} />
          </div>
          <p className="text-white/50 font-medium">Generating your quiz…</p>
        </div>
      );
    }

    if (quiz.length === 0) {
      return (
        <div className="max-w-3xl mx-auto pt-8 pb-32 px-4 text-center">
          <div className="glass-card py-20">
            <BrainCircuit size={48} className="text-white/20 mx-auto mb-4" />
            <p className="text-white/40 font-medium mb-6">No quiz loaded yet. Go to Learn and explain a topic first.</p>
            <button onClick={() => setActiveView('learn')} className="btn-primary mx-auto flex items-center gap-2">
              <BookOpen size={18} /> Go to Learn
            </button>
          </div>
        </div>
      );
    }

    const score = quizAnswers.filter((ans, i) => ans === quiz[i]?.correctAnswer).length;

    return (
      <div className="max-w-3xl mx-auto pt-8 pb-32 px-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-3xl font-bold">Quick Quiz</h2>
            <div className="px-4 py-1 rounded-full bg-white/5 border border-white/10 text-sm">
              Topic: {topic || 'General'}
            </div>
          </div>

          {!showQuizResults ? (
            <>
              {quiz.map((q, qIdx) => (
                <div key={qIdx} className="glass-card space-y-4">
                  <p className="text-lg font-medium">{qIdx + 1}. {q.question}</p>
                  <div className="grid grid-cols-1 gap-3">
                    {q.options.map((opt, oIdx) => (
                      <button
                        key={oIdx}
                        onClick={() => {
                          const newAns = [...quizAnswers];
                          newAns[qIdx] = oIdx;
                          setQuizAnswers(newAns);
                        }}
                        className={`text-left p-4 rounded-xl border transition-all ${
                          quizAnswers[qIdx] === oIdx 
                            ? 'bg-brand-purple/20 border-brand-purple' 
                            : 'bg-white/5 border-white/10 hover:border-white/30'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button 
                onClick={() => setShowQuizResults(true)}
                disabled={quizAnswers.includes(null)}
                className="btn-primary w-full"
              >
                Submit Quiz
              </button>
            </>
          ) : (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass-card text-center py-16 relative overflow-hidden"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-brand-teal/20 blur-[100px] -z-10 rounded-full" />
              
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
                className="w-32 h-32 rounded-3xl bg-gradient-to-br from-brand-teal to-brand-purple flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-brand-teal/20"
              >
                <Award size={64} className="text-bg-dark" />
              </motion.div>
              
              <h3 className="text-5xl font-bold mb-3 tracking-tighter">Quiz Complete!</h3>
              <p className="text-xl text-white/50 mb-12 font-medium">
                You mastered <span className="text-brand-teal">{score}</span> out of <span className="text-brand-teal">{quiz.length}</span> concepts.
              </p>
              
              <div className="space-y-4 text-left mb-12 max-w-xl mx-auto">
                {quiz.map((q, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + (i * 0.1) }}
                    className="p-5 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-4 hover:bg-white/10 transition-colors group"
                  >
                    {quizAnswers[i] === q.correctAnswer ? (
                      <div className="w-8 h-8 rounded-lg bg-brand-teal/20 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="text-brand-teal" size={18} />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-brand-rose/20 flex items-center justify-center shrink-0 mt-0.5">
                        <XCircle className="text-brand-rose" size={18} />
                      </div>
                    )}
                    <div>
                      <p className="text-base font-bold mb-1 group-hover:text-white transition-colors">{q.question}</p>
                      <p className="text-sm text-white/40 font-medium">Correct: <span className="text-brand-teal/80">{q.options[q.correctAnswer]}</span></p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="flex flex-col md:flex-row gap-4 max-w-xl mx-auto">
                <button 
                  onClick={() => {
                    setQuizAnswers(new Array(quiz.length).fill(null));
                    setShowQuizResults(false);
                  }}
                  className="btn-outline flex-1 py-4"
                >
                  Try Again
                </button>
                <button 
                  onClick={() => setActiveView('learn')}
                  className="btn-primary flex-1 py-4"
                >
                  Next Lesson
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  };

  // ── Render History ───────────────────────────────────────────────────────
  const renderHistory = () => (
    <div className="max-w-5xl mx-auto pt-8 pb-32 px-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-10"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: "Topics Learned", val: sessions.length, icon: <BookOpen className="text-brand-purple" />, },
            { label: "Sessions This Week", val: sessions.filter(s => Date.now() - s.timestamp < 7 * 86400000).length, icon: <Award className="text-brand-teal" />, },
            { label: "Languages Used", val: [...new Set(sessions.map(s => s.language))].length, icon: <Globe className="text-brand-rose" />, }
          ].map((stat, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-card flex items-center gap-5 group"
            >
              <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                {stat.icon}
              </div>
              <div>
                <p className="text-sm font-bold text-white/40 uppercase tracking-widest">{stat.label}</p>
                <p className="text-3xl font-bold tracking-tighter">{stat.val}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold tracking-tighter">Past Sessions</h2>
            <div className="text-sm text-white/40 font-medium">{sessions.length} Total Sessions</div>
          </div>
          
          <div className="space-y-4">
            {sessions.length === 0 ? (
              <div className="glass-card text-center py-20 text-white/30 font-medium">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 opacity-50">
                  <History size={32} />
                </div>
                No sessions yet. Start learning to see your history!
              </div>
            ) : (
              sessions.map((s, i) => (
                <motion.div 
                  key={s.id} 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-card flex flex-col md:flex-row md:items-center justify-between gap-6 group"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-xl bg-brand-purple/10 flex items-center justify-center border border-brand-purple/20 text-brand-purple shrink-0">
                      <BookOpen size={24} />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold mb-1 group-hover:text-brand-teal transition-colors">{s.topic}</h4>
                      <div className="flex items-center gap-3 text-xs font-bold text-white/30 uppercase tracking-wider">
                        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">{s.level}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><Globe size={12} /> {s.language}</span>
                        <span>•</span>
                        <span>{new Date(s.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleReview(s)}
                      className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10 transition-all active:scale-95"
                    >
                      Review
                    </button>
                    <button 
                      onClick={async () => {
                        setTopic(s.topic);
                        setLevel(s.level);
                        setActiveView('quiz');
                        setIsLoadingQuiz(true);
                        setQuiz([]);
                        setQuizAnswers([]);
                        setShowQuizResults(false);
                        try {
                           const generated = await apiGenerateQuiz(s.topic, s.level, geminiKey, openaiKey, claudeKey, preferredModel);
                          setQuiz(generated);
                          setQuizAnswers(new Array(generated.length).fill(null));
                        } catch { /* ignore */ }
                        finally { setIsLoadingQuiz(false); }
                      }}
                      className="px-6 py-3 rounded-xl bg-brand-purple/20 border border-brand-purple/30 text-brand-purple text-sm font-bold hover:bg-brand-purple/30 transition-all active:scale-95 shadow-lg shadow-brand-purple/10"
                    >
                      Quiz
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );

  // ── Root render ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen relative overflow-hidden selection:bg-brand-purple/30 selection:text-white">
      {/* Global Noise Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-[100] bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')]" />

      {/* Background Elements */}
      <div className="orb orb-purple -top-40 -left-40" />
      <div className="orb orb-teal top-1/4 -right-40" />
      <div className="orb orb-purple bottom-0 left-1/4 opacity-10" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 px-6 py-5 flex justify-between items-center backdrop-blur-xl border-b border-white/5">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3 cursor-pointer group" 
          onClick={() => setActiveView('home')}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-purple to-brand-teal flex items-center justify-center shadow-lg shadow-brand-purple/20 group-hover:scale-110 transition-transform">
            <Mic size={20} className="text-bg-dark" />
          </div>
          <span className="text-2xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">VoiceLearn</span>
        </motion.div>
        <motion.button 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => setIsSettingsOpen(true)}
          className="w-11 h-11 rounded-xl glass flex items-center justify-center hover:bg-white/10 transition-all hover:border-white/20 active:scale-90"
        >
          <Settings size={22} className="text-white/70" />
        </motion.button>
      </header>

      {/* Main Content */}
      <main className="pt-28 pb-36">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          >
            {activeView === 'home' && renderHome()}
            {activeView === 'learn' && renderLearn()}
            {activeView === 'quiz' && renderQuiz()}
            {activeView === 'history' && renderHistory()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
        <div className="glass rounded-3xl p-2 flex items-center gap-2 shadow-2xl border-white/10">
          {[
            { id: 'home', icon: <Home size={20} />, label: 'Home' },
            { id: 'learn', icon: <BookOpen size={20} />, label: 'Learn' },
            { id: 'quiz', icon: <BrainCircuit size={20} />, label: 'Quiz' },
            { id: 'history', icon: <History size={20} />, label: 'History' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as View)}
              className={`relative flex items-center gap-2 px-6 py-3.5 rounded-2xl transition-all duration-300 ${
                activeView === item.id 
                  ? 'text-white' 
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5'
              }`}
            >
              {activeView === item.id && (
                <motion.div
                  layoutId="nav-bg"
                  className="absolute inset-0 bg-brand-purple rounded-2xl shadow-[0_0_20px_rgba(124,111,252,0.3)]"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10">{item.icon}</span>
              {activeView === item.id && (
                <motion.span 
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="relative z-10 text-sm font-bold tracking-tight"
                >
                  {item.label}
                </motion.span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Settings / BYOK Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto py-8 px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-bg-dark/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 40 }}
              transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
              className="glass-card w-full max-w-lg relative z-10 p-8 border-white/20 shadow-[0_0_50px_rgba(0,0,0,0.5)] my-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-3xl font-bold tracking-tighter">Configuration</h3>
                  <p className="text-sm text-white/40 font-medium mt-1">Your keys are stored locally only</p>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)} 
                  className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <div className="space-y-4">

                {/* Provider Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-white/60 uppercase tracking-widest">AI Provider Priority</label>
                  <div className="space-y-2">
                    {(Object.keys(PROVIDER_META) as AIProvider[]).map((provider) => {
                      const meta = PROVIDER_META[provider];
                      const isSelected = preferredModel === provider;
                      return (
                        <button
                          key={provider}
                          onClick={() => {
                            setPreferredModel(provider);
                            localStorage.setItem('voicelearn_preferred_model', provider);
                          }}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                            isSelected
                              ? 'bg-brand-purple/20 border-brand-purple/50'
                              : 'bg-white/5 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-brand-purple/30 text-white' : 'bg-white/5 text-white/30'
                          }`}>
                            {meta.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm">{meta.label}</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${meta.badgeColor}`}>{meta.badge}</span>
                            </div>
                            <p className="text-xs text-white/40 mt-0.5">{meta.desc}</p>
                          </div>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-brand-purple shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-white/30 pl-1">Falls back automatically if the selected provider's key isn't set.</p>
                </div>

                {/* Gemini Key */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
                    <Zap size={12} className="text-brand-teal" /> Gemini API Key
                    <span className="text-[10px] px-1.5 py-0.5 rounded border bg-brand-teal/10 text-brand-teal border-brand-teal/20">Primary</span>
                  </label>
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => { setGeminiKey(e.target.value); localStorage.setItem('voicelearn_gemini_key', e.target.value); }}
                    placeholder="AIzaSy..."
                    className="glass-input"
                  />
                </div>

                {/* OpenAI Key */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
                    <Star size={12} className="text-brand-gold" /> OpenAI API Key
                    <span className="text-[10px] px-1.5 py-0.5 rounded border bg-brand-gold/10 text-brand-gold border-brand-gold/20">Alternative</span>
                  </label>
                  <input
                    type="password"
                    value={openaiKey}
                    onChange={(e) => { setOpenaiKey(e.target.value); localStorage.setItem('voicelearn_openai_key', e.target.value); }}
                    placeholder="sk-proj-..."
                    className="glass-input"
                  />
                </div>

                {/* Claude Key */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
                    <DollarSign size={12} className="text-brand-rose" /> Claude API Key
                    <span className="text-[10px] px-1.5 py-0.5 rounded border bg-brand-rose/10 text-brand-rose border-brand-rose/20">Premium</span>
                  </label>
                  <input
                    type="password"
                    value={claudeKey}
                    onChange={(e) => { setClaudeKey(e.target.value); localStorage.setItem('voicelearn_claude_key', e.target.value); }}
                    placeholder="sk-ant-..."
                    className="glass-input"
                  />
                </div>

                {/* Murf Key */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
                    <Volume2 size={12} className="text-brand-purple" /> Murf API Key
                  </label>
                  <input
                    type="password"
                    value={murfKey}
                    onChange={(e) => { setMurfKey(e.target.value); localStorage.setItem('voicelearn_murf_key', e.target.value); }}
                    placeholder="murf-..."
                    className="glass-input"
                  />
                  <p className="text-xs text-white/30 pl-1">Required for voice synthesis. Get yours at <span className="text-brand-teal">murf.ai</span></p>
                </div>

                {/* Security notice */}
                <div className="p-4 rounded-2xl bg-brand-gold/5 border border-brand-gold/20 flex gap-3">
                  <ShieldCheck className="text-brand-gold shrink-0 mt-0.5" size={18} />
                  <p className="text-xs text-brand-gold/70 leading-relaxed">
                    Keys live in your browser's <code className="font-mono">localStorage</code> only — never stored on our servers.
                  </p>
                </div>

                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="btn-primary w-full py-5 text-lg"
                >
                  Save Configuration
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
