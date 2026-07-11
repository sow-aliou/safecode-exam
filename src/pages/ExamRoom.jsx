import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { useTranslation } from '../utils/lang';
import UMLEditor from '../components/UMLEditor';

const TYPE_ICONS = { texte: '📝', code: '💻', uml: '📐' };
const TYPE_COLORS = { texte: 'var(--student-color)', code: 'var(--success)', uml: 'var(--teacher-color)' };

// ─── Composant Minuterie ─────────────────────────────────────────────────────
function Timer({ totalSeconds, onExpire }) {
  const [seconds, setSeconds] = useState(totalSeconds);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (seconds <= 0) {
      if (!expiredRef.current && onExpire) {
        expiredRef.current = true;
        onExpire();
      }
      return;
    }
    const interval = setInterval(() => setSeconds(s => s - 1), 1000);
    return () => clearInterval(interval);
  }, [seconds, onExpire]);

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = n => String(n).padStart(2, '0');
  const pct = seconds / totalSeconds;
  const cls = pct > 0.5 ? 'normal' : pct > 0.2 ? 'warning' : '';
  return <div className={`timer ${cls}`}>⏱ {pad(h)}:{pad(m)}:{pad(s)}</div>;
}

// ─── Composant principal ExamRoom ─────────────────────────────────────────────
export default function ExamRoom() {
  const navigate = useNavigate();
  const { sessionCode } = useParams();
  const { t, lang } = useTranslation();

  const matricule   = sessionStorage.getItem('student_matricule') || 'DEV_001';
  const studentName = sessionStorage.getItem('student_name')      || 'Étudiant';
  const copieId     = sessionStorage.getItem('copie_id')          || '1';

  // ── État principal ──────────────────────────────────────────────────────
  const [examData, setExamData] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers]   = useState({});
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showPdf, setShowPdf]   = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [saving, setSaving]     = useState(false);
  const [timeExpired, setTimeExpired] = useState(false);
  const saveTimer = useRef(null);
  const submittingRef = useRef(false);

  // Helpers TYPE_CONFIG avec traductions dynamiques
  const TYPE_CONFIG = {
    texte: { label: t('examRoomWorkspace'), icon: TYPE_ICONS.texte, color: TYPE_COLORS.texte },
    code:  { label: 'Code', icon: TYPE_ICONS.code, color: TYPE_COLORS.code },
    uml:   { label: 'UML', icon: TYPE_ICONS.uml, color: TYPE_COLORS.uml },
  };

  // ── Chargement de l'épreuve depuis le sessionStorage ────────────────────
  useEffect(() => {
    const raw = sessionStorage.getItem('exam_data');
    if (!raw) { navigate('/'); return; }

    const parsed = JSON.parse(raw);

    // Construire la liste de questions
    let questions = [];
    if (parsed.enonceTexte) {
      try {
        const q = JSON.parse(parsed.enonceTexte);
        if (Array.isArray(q) && q.length > 0) questions = q;
      } catch (_) {}
    }

    // Fallback : zone de réponse libre si aucune question configurée
    if (questions.length === 0) {
      questions = [{
        id: 1,
        enonce: 'Rédigez votre réponse au sujet ci-dessus.',
        typeReponse: 'code',
        points: 20
      }];
    }

    setExamData({
      titre: parsed.titre || 'Examen',
      dureeMinutes: parsed.dureeMinutes || 120,
      instructions: parsed.instructions || '',
      langageCible: parsed.langageCible || 'Java',
      sujetPdfBase64: parsed.sujetPdfBase64 || null,
      questions
    });

    // Initialiser les réponses avec le type préconfiguré ou depuis la sauvegarde
    let initialAnswers = Object.fromEntries(questions.map(q => [q.id, { type: q.typeReponse || null, content: '' }]));
    if (parsed.contenuCode) {
      try {
        const saved = JSON.parse(parsed.contenuCode);
        initialAnswers = { ...initialAnswers, ...saved };
      } catch (e) {}
    }
    setAnswers(initialAnswers);
  }, [navigate]);

  // ── Sauvegarde automatique avec debounce (1.5s) ─────────────────────────
  const saveAnswer = useCallback((updatedAnswers) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        if (window.electronAPI) {
          await window.electronAPI.saveCode(JSON.stringify(updatedAnswers), parseInt(copieId));
        } else {
          await fetch('http://localhost:3000/api/copies/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ copieId: parseInt(copieId), answers: updatedAnswers })
          });
        }
        setLastSaved(new Date());
      } catch (_) {
        setLastSaved(new Date()); // sauvegarde mémoire même si offline
      } finally {
        setSaving(false);
      }
    }, 1500);
  }, [copieId]);

  const handleAnswerChange = useCallback((value) => {
    if (!examData) return;
    const q = examData.questions[currentQ];
    if (!q) return;
    setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], content: value ?? '' } }));
  }, [examData, currentQ]);

  const handleTypeChange = useCallback((type) => {
    if (!examData) return;
    const q = examData.questions[currentQ];
    if (!q) return;
    setAnswers(prev => ({ ...prev, [q.id]: { type, content: '' } }));
  }, [examData, currentQ]);

  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      saveAnswer(answers);
    }
  }, [answers, saveAnswer]);

  // ── Soumission ──────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setShowSubmitModal(false);
    try {
      if (window.electronAPI) {
        await window.electronAPI.saveCode(JSON.stringify(answers), parseInt(copieId));
      } else {
        await fetch('http://localhost:3000/api/copies/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ copieId: parseInt(copieId), answers })
        });
      }
      await fetch('http://localhost:3000/api/copies/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ copieId: parseInt(copieId) })
      });
    } catch (_) {
      // Offline ou erreur réseau : la copie a été sauvegardée localement
    }
    sessionStorage.clear();
    navigate('/');
  }, [answers, copieId, navigate]);

  const handleTimeExpired = useCallback(() => {
    setTimeExpired(true);
    handleSubmit();
  }, [handleSubmit]);

  if (!examData) {
    return (
      <div className="gradient-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-secondary)' }}>⏳ Chargement de l'examen…</div>
      </div>
    );
  }

  const question      = examData.questions[currentQ];
  const answeredCount = Object.values(answers).filter(a => {
    if (!a) return false;
    if (typeof a === 'string') return a.trim() !== '';
    if (typeof a === 'object') return Object.keys(a).length > 0;
    return false;
  }).length;
  const totalQ        = examData.questions.length;
  const progressPct   = Math.round((answeredCount / totalQ) * 100);
  const initials      = matricule.slice(0, 2).toUpperCase();

  return (
    <div className="gradient-bg exam-room">

      {/* ── Topbar ─────────────────────────────────────────────────────── */}
      <header className="exam-topbar">
        <div className="exam-info">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
              borderRadius: 7, width: 24, height: 24,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', flexShrink: 0
            }}>🛡</span>
            {examData.titre}
          </h2>
          <p>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent-light)', fontWeight: 700, fontSize: '0.95rem' }}>{sessionCode}</span>
            <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>·</span>
            <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>{studentName}</span> <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>({matricule})</span>
          </p>
        </div>
        <Timer totalSeconds={examData.dureeMinutes * 60} onExpire={handleTimeExpired} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="avatar" style={{ background: 'linear-gradient(135deg, var(--student-color), #0d9488)' }}>
            {initials}
          </div>
          <button id="btn-submit-exam" className="btn btn-danger btn-sm" onClick={() => setShowSubmitModal(true)}>
            📤 {t('examRoomSubmitBtn')}
          </button>
        </div>
      </header>

      {/* ── Barre de progression ────────────────────────────────────────── */}
      <div style={{ height: 3, background: 'var(--border)', width: '100%' }}>
        <div style={{
          height: '100%',
          width: `${progressPct}%`,
          background: 'linear-gradient(90deg, var(--accent), var(--success))',
          transition: 'width 0.4s ease'
        }} />
      </div>

      <div className="exam-body">
        {/* ── Sidebar Navigation ──────────────────────────────────────────── */}
        <aside className="questions-sidebar" style={{ width: answers[question?.id]?.type === 'uml' ? '200px' : '260px', transition: 'width 0.3s ease' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            RÉPONSES
          </div>

          {examData.questions.map((q, idx) => {
            const rawAnswer = answers[q.id];
            const isAnswered = rawAnswer && rawAnswer.type && typeof rawAnswer.content === 'string' && rawAnswer.content.trim() !== '';
            const isCurrent  = idx === currentQ;
            return (
              <div key={q.id}
                onClick={() => setCurrentQ(idx)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 8, marginBottom: 2,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: isCurrent ? 'var(--accent-subtle)' : 'transparent',
                  border: isCurrent ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent',
                }}
                onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = 'rgba(255,255,255,0.035)'; }}
                onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
              >
                {/* Numéro/check */}
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.85rem', fontWeight: 800,
                  fontFamily: "'JetBrains Mono', monospace",
                  background: isAnswered ? 'var(--success-subtle)' : isCurrent ? 'var(--accent-subtle)' : 'rgba(255,255,255,0.04)',
                  color: isAnswered ? 'var(--success)' : isCurrent ? 'var(--accent-light)' : 'var(--text-muted)',
                  border: `1px solid ${isAnswered ? 'rgba(34,197,94,0.3)' : isCurrent ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                }}>
                  {isAnswered ? '✓' : idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: isCurrent ? 600 : 400, color: isCurrent ? 'var(--accent-light)' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {answers[q.id]?.type ? TYPE_CONFIG[answers[q.id].type]?.icon : '❓'} R{idx + 1} — {q.points} pts
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 3 }}>
                    {q.enonce?.slice(0, 30)}{q.enonce?.length > 30 ? '…' : ''}
                  </div>
                </div>
              </div>
            );
          })}
          
          <button
            className="btn btn-outline btn-sm"
            style={{ width: '100%', marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderStyle: 'dashed' }}
            onClick={() => {
              const newId = `custom-${Date.now()}`;
              const newQuestion = {
                id: newId,
                enonce: 'Nouvelle réponse libre',
                typeReponse: 'texte',
                points: 0
              };
              const newQuestions = [...examData.questions, newQuestion];
              setExamData({ ...examData, questions: newQuestions });
              setAnswers(prev => ({ ...prev, [newId]: { type: 'texte', content: '' } }));
              setCurrentQ(newQuestions.length - 1);
            }}
          >
            ➕ Ajouter une réponse
          </button>

          {/* Résumé progression */}
          <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{
              fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.03em',
              color: answeredCount === totalQ ? 'var(--success)' : 'var(--accent-light)'
            }}>
              {answeredCount}<span style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-muted)' }}>/{totalQ}</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>RÉPONSES COMPLÉTÉES</div>
            <div style={{ height: 4, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${(answeredCount/totalQ)*100}%`, height: '100%', background: answeredCount === totalQ ? 'var(--success)' : 'var(--accent)', borderRadius: 4, transition: 'width 0.4s ease' }} />
            </div>
            <div style={{ marginTop: 10, fontSize: '0.8rem', color: saving ? 'var(--warning)' : lastSaved ? 'var(--success)' : 'var(--text-muted)' }}>
              {saving ? `⏳ ${t('examRoomSaving')}` : lastSaved ? `✅ ${t('examRoomSaved')} ${lastSaved.toLocaleTimeString()}` : `● ${t('examRoomNotSaved')}`}
            </div>
          </div>
        </aside>

        {/* ── Zone de travail (Écran Partagé) ─────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
          
          {/* ─ Panneau Gauche : Sujet Global & PDF ─ */}
          <div style={{ flex: answers[question?.id]?.type === 'uml' ? '0 0 30%' : '0 0 45%', transition: 'flex 0.3s ease', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', background: 'var(--bg-card)' }}>
            <div className="section-header" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', margin: 0 }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>📄 Sujet Officiel / Contexte Global</h2>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {examData.instructions && (
                <div style={{ padding: 20, fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-secondary)', borderBottom: examData.sujetPdfBase64 ? '1px solid var(--border)' : 'none' }}>
                  {examData.instructions.split('\n').map((line, i) => <p key={i} style={{ margin: '0 0 8px 0' }}>{line}</p>)}
                </div>
              )}
              {examData.sujetPdfBase64 && (
                <div style={{ flex: 1, minHeight: 400 }}>
                  <iframe src={examData.sujetPdfBase64} title="Sujet PDF" width="100%" height="100%" style={{ border: 'none' }} />
                </div>
              )}
              {!examData.instructions && !examData.sujetPdfBase64 && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Aucun contexte global fourni par l'enseignant.
                </div>
              )}
            </div>
          </div>

          {/* ─ Panneau Droit : Zone de Travail (Question en cours) ─ */}
          <div className="question-workspace" style={{ flex: answers[question?.id]?.type === 'uml' ? '1 1 70%' : '1 1 55%', transition: 'flex 0.3s ease', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
            <div className="question-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: 0, border: 'none' }}>

              {/* En-tête question */}
              <div className="question-statement">
                {/* Fil d'Ariane */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <span style={{
                    fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    padding: '3px 10px', background: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--border)', borderRadius: 6
                  }}>
                    R{currentQ + 1}/{totalQ}
                  </span>
                  <div style={{ flex: 1, height: 2, background: 'var(--border)', borderRadius: 4 }}>
                    <div style={{ width: `${((currentQ + 1) / totalQ) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 4, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{
                    fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-light)',
                    background: 'var(--accent-subtle)', padding: '3px 12px', borderRadius: 999,
                    border: '1px solid rgba(16,185,129,0.2)',
                    fontFamily: "'JetBrains Mono', monospace"
                  }}>
                    {question?.points} pt{question?.points > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Énoncé */}
                <h3 style={{ fontSize: '1.3rem', lineHeight: 1.6, color: '#e2e8f0', marginBottom: 16, fontWeight: 700 }}>
                  {question?.enonce}
                </h3>

              </div>

              {/* Zone de réponse */}
              <div className="answer-area" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="answer-header" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 600 }}>
                    {answers[question?.id]?.type ? (
                      <>{TYPE_CONFIG[answers[question.id].type]?.icon} {t('examRoomWorkspace')}</>
                    ) : (
                      <>🛠 Choisissez votre outil de réponse</>
                    )}
                  </span>
                  {answers[question?.id]?.type && (
                     <button className="btn btn-ghost btn-sm" onClick={() => handleTypeChange(null)} style={{ fontSize: '0.8rem', padding: '4px 8px', color: 'var(--text-muted)' }}>
                       🔄 Changer d'outil
                     </button>
                  )}
                </div>

                {!answers[question?.id]?.type ? (
                  <div style={{ flex: 1, display: 'flex', gap: 16, padding: 30, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                    {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
                      <div key={type} onClick={() => handleTypeChange(type)}
                        style={{ padding: 24, background: 'var(--bg-lighter)', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', textAlign: 'center', minWidth: 150, transition: 'all 0.2s' }}
                        onMouseOver={e => Object.assign(e.currentTarget.style, { borderColor: cfg.color, transform: 'translateY(-2px)' })}
                        onMouseOut={e => Object.assign(e.currentTarget.style, { borderColor: 'var(--border)', transform: 'translateY(0)' })}>
                        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>{cfg.icon}</div>
                        <div style={{ fontWeight: 600, color: cfg.color }}>{cfg.label}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {/* Texte libre */}
                    {answers[question.id].type === 'texte' && (
                      <div className="text-answer-area" style={{ flex: 1 }}>
                        <textarea
                          id="text-answer"
                          placeholder="Rédigez votre réponse ici…"
                          value={answers[question.id].content || ''}
                          onChange={e => handleAnswerChange(e.target.value)}
                          style={{ height: '100%', resize: 'none', caretColor: 'var(--accent)' }}
                        />
                      </div>
                    )}

                    {/* Éditeur de code */}
                    {answers[question.id].type === 'code' && (
                      <div style={{ flex: 1, overflow: 'hidden', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <Editor
                          height="100%"
                          language={examData.langageCible.toLowerCase()}
                          theme="vs-dark"
                          value={answers[question.id].content || ''}
                          onChange={handleAnswerChange}
                          options={{
                            minimap: { enabled: false },
                            fontSize: 16,
                            wordWrap: 'on',
                            quickSuggestions: false,
                            suggestOnTriggerCharacters: false,
                            parameterHints: { enabled: false },
                            snippetSuggestions: 'none',
                            contextmenu: false,
                            lineNumbers: 'on',
                            scrollBeyondLastLine: false,
                            padding: { top: 12 }
                          }}
                        />
                      </div>
                    )}

                    {/* Zone UML Graphique */}
                    {answers[question.id].type === 'uml' && (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
                        <div style={{ flex: 1, minHeight: 400 }}>
                          <UMLEditor
                            value={answers[question.id].content || ''}
                            onChange={handleAnswerChange}
                            readOnly={false}
                          />
                        </div>
                        <div style={{ padding: '8px 16px', background: 'rgba(139,92,246,0.05)', borderRadius: 8, border: '1px solid rgba(139,92,246,0.15)', fontSize: '0.85rem', color: 'rgba(196,181,253,0.7)', flexShrink: 0 }}>
                          📐 Éditeur UML interactif — Ajoutez des classes, des attributs, des méthodes et reliez-les. Votre diagramme est sauvegardé automatiquement.
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Navigation bas de page */}
              <div className="exam-footer" style={{ padding: '20px 24px', background: 'rgba(10, 10, 10, 0.5)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                <button
                  className={`btn ${currentQ === 0 ? 'btn-ghost' : 'btn-outline'} btn-sm`}
                  disabled={currentQ === 0}
                  onClick={() => setCurrentQ(q => q - 1)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 16px', borderRadius: 8,
                    opacity: currentQ === 0 ? 0.5 : 1,
                    transition: 'all 0.2s'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                  <span style={{ fontWeight: 600 }}>{t('examRoomPrev').replace('←', '').trim()}</span>
                </button>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {examData.questions.map((_, idx) => (
                    <div key={idx}
                      onClick={() => setCurrentQ(idx)}
                      style={{
                        width: idx === currentQ ? 24 : 10, 
                        height: 10, 
                        borderRadius: 10, 
                        cursor: 'pointer', 
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        background: idx === currentQ ? 'var(--accent)'
                          : (() => { const a = answers[examData.questions[idx].id]; return (a && a.type && typeof a.content === 'string' && a.content.trim() !== '') ? 'var(--success)' : 'var(--border)'; })()
                      }}
                      title={`Question ${idx + 1}`}
                    />
                  ))}
                </div>

                <button
                  className={`btn ${currentQ === totalQ - 1 ? 'btn-ghost' : 'btn-primary'} btn-sm`}
                  disabled={currentQ === totalQ - 1}
                  onClick={() => setCurrentQ(q => q + 1)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 16px', borderRadius: 8,
                    opacity: currentQ === totalQ - 1 ? 0.5 : 1,
                    transition: 'all 0.2s'
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{t('examRoomNext').replace('→', '').trim()}</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal temps écoulé ─────────────────────────────────────────── */}
      {timeExpired && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>⏱ {lang === 'fr' ? 'Temps écoulé' : 'Time is up'}</h2>
            <p>{lang === 'fr' ? 'Votre copie est en cours de soumission automatique…' : 'Your exam is being submitted automatically…'}</p>
          </div>
        </div>
      )}

      {/* ── Modal de soumission ──────────────────────────────────────────── */}
      {showSubmitModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>📤 {t('examRoomSubmitConfirmTitle')}</h2>
            <p>
              {t('examRoomSubmitConfirmDesc')}{' '}
              <strong style={{ color: answeredCount === totalQ ? 'var(--success)' : 'var(--warning)' }}>
                {answeredCount} / {totalQ}
              </strong>.
            </p>
            {answeredCount < totalQ && (
              <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 12 }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--warning)', margin: 0 }}>
                  ⚠️ {t('examRoomSubmitConfirmWarning')}
                </p>
              </div>
            )}
            <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 16 }}>
              <p style={{ fontSize: '0.875rem', color: '#f87171', margin: 0 }}>
                ⛔ {t('examRoomSubmitFinalWarning')}
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowSubmitModal(false)}>{t('examRoomSubmitBtnCancel')}</button>
              <button id="btn-confirm-submit" className="btn btn-danger" onClick={handleSubmit}>
                ✔ {t('examRoomSubmitBtnConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
