import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { useTranslation } from '../utils/lang';

const TYPE_ICONS = { texte: '📝', code: '💻', uml: '📐' };
const TYPE_COLORS = { texte: 'var(--student-color)', code: 'var(--success)', uml: 'var(--teacher-color)' };

// ─── Composant Minuterie ─────────────────────────────────────────────────────
function Timer({ totalSeconds }) {
  const [seconds, setSeconds] = useState(totalSeconds);
  useEffect(() => {
    if (seconds <= 0) return;
    const interval = setInterval(() => setSeconds(s => s - 1), 1000);
    return () => clearInterval(interval);
  }, [seconds]);

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
  const { t } = useTranslation();

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
  const saveTimer = useRef(null);

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

    // Initialiser les réponses vides
    setAnswers(Object.fromEntries(questions.map(q => [q.id, ''])));
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
    setAnswers(prev => {
      const updated = { ...prev, [q.id]: value ?? '' };
      saveAnswer(updated);
      return updated;
    });
  }, [examData, currentQ, saveAnswer]);

  // ── Soumission ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setShowSubmitModal(false);
    try {
      if (window.electronAPI) {
        // Sauvegarder une dernière fois avant soumission
        await window.electronAPI.saveCode(JSON.stringify(answers), parseInt(copieId));
      }
      // Marquer la copie comme validée sur le serveur central
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
  };

  if (!examData) {
    return (
      <div className="gradient-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-secondary)' }}>⏳ Chargement de l'examen…</div>
      </div>
    );
  }

  const question      = examData.questions[currentQ];
  const answeredCount = Object.values(answers).filter(a => a?.trim() !== '').length;
  const totalQ        = examData.questions.length;
  const progressPct   = Math.round((answeredCount / totalQ) * 100);
  const initials      = matricule.slice(0, 2).toUpperCase();

  return (
    <div className="gradient-bg exam-room">

      {/* ── Topbar ─────────────────────────────────────────────────────── */}
      <header className="exam-topbar">
        <div className="exam-info">
          <h2>🛡️ {examData.titre}</h2>
          <p>{t('examRoomSession')} <strong style={{ color: 'var(--accent-light)', fontFamily: 'Fira Code' }}>{sessionCode}</strong>
            &nbsp;·&nbsp;{studentName} ({matricule})
          </p>
        </div>
        <Timer totalSeconds={examData.dureeMinutes * 60} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {examData.sujetPdfBase64 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowPdf(v => !v)}
              style={{ borderColor: showPdf ? 'var(--accent)' : undefined }}>
              📄 {showPdf ? t('examRoomHidePdf') : t('examRoomShowPdf')}
            </button>
          )}
          <div className="avatar" style={{ background: 'linear-gradient(135deg, var(--student-color), #0891b2)' }}>
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
        <aside className="questions-sidebar">
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {t('examRoomQuestionTitle')}S
          </div>

          {examData.questions.map((q, idx) => {
            const isAnswered = answers[q.id]?.trim() !== '';
            const isCurrent  = idx === currentQ && !showPdf;
            return (
              <div key={q.id}
                onClick={() => { setCurrentQ(idx); setShowPdf(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10, marginBottom: 4,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: isCurrent ? 'rgba(99,102,241,0.15)' : 'transparent',
                  border: isCurrent ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                }}
                onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
              >
                {/* Indicateur de complétion */}
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700,
                  background: isAnswered ? 'rgba(16,185,129,0.15)' : isCurrent ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                  color: isAnswered ? 'var(--success)' : isCurrent ? 'var(--accent-light)' : 'var(--text-muted)',
                  border: `1px solid ${isAnswered ? 'rgba(16,185,129,0.3)' : isCurrent ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                }}>
                  {isAnswered ? '✓' : idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: isCurrent ? 600 : 400, color: isCurrent ? '#fff' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {TYPE_CONFIG[q.typeReponse]?.icon} Q{idx + 1} — {q.points} pts
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {q.enonce?.slice(0, 32)}{q.enonce?.length > 32 ? '…' : ''}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Résumé en bas */}
          <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: answeredCount === totalQ ? 'var(--success)' : 'var(--accent-light)' }}>
              {answeredCount}/{totalQ}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('examRoomProgress')}</div>
            {/* Indicateur de sauvegarde */}
            <div style={{ marginTop: 10, fontSize: '0.7rem', color: saving ? 'var(--warning)' : lastSaved ? 'var(--success)' : 'var(--text-muted)' }}>
              {saving ? `⏳ ${t('examRoomSaving')}` : lastSaved ? `✅ ${t('examRoomSaved')} ${lastSaved.toLocaleTimeString()}` : `● ${t('examRoomNotSaved')}`}
            </div>
          </div>
        </aside>

        {/* ── Zone de travail ─────────────────────────────────────────────── */}
        <div className="question-workspace">

          {/* ─ Vue PDF ─ */}
          {showPdf && examData.sujetPdfBase64 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', padding: 16 }}>
              <div className="section-header" style={{ marginBottom: 12 }}>
                <h2>📄 Sujet Officiel de l'Examen</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowPdf(false)}>← Retour aux questions</button>
              </div>
              <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <iframe src={examData.sujetPdfBase64} title="Sujet PDF" width="100%" height="100%" style={{ border: 'none' }} />
              </div>
            </div>
          ) : (
            /* ─ Vue question ─ */
            <div className="question-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

              {/* En-tête question */}
              <div className="question-statement">
                {/* Fil d'Ariane */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    QUESTION {currentQ + 1} SUR {totalQ}
                  </span>
                  <div style={{ flex: 1, height: 2, background: 'var(--border)', borderRadius: 4 }}>
                    <div style={{ width: `${((currentQ + 1) / totalQ) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 4, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{
                    padding: '2px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
                    background: `${TYPE_CONFIG[question?.typeReponse]?.color || 'var(--accent)'}22`,
                    color: TYPE_CONFIG[question?.typeReponse]?.color || 'var(--accent)',
                    border: `1px solid ${TYPE_CONFIG[question?.typeReponse]?.color || 'var(--accent)'}44`,
                  }}>
                    {TYPE_CONFIG[question?.typeReponse]?.icon} {TYPE_CONFIG[question?.typeReponse]?.label}
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-light)', background: 'rgba(99,102,241,0.1)', padding: '2px 10px', borderRadius: 20, border: '1px solid rgba(99,102,241,0.2)' }}>
                    {question?.points} pt{question?.points > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Énoncé */}
                <h3 style={{ fontSize: '1.05rem', lineHeight: 1.7, color: '#e2e8f0', marginBottom: 12 }}>
                  {question?.enonce}
                </h3>

                {/* Instructions générales */}
                {examData.instructions && (
                  <div style={{ padding: '10px 14px', background: 'rgba(99,102,241,0.05)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.1)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    📌 {examData.instructions}
                  </div>
                )}
              </div>

              {/* Zone de réponse */}
              <div className="answer-area" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="answer-header">
                  <span>{TYPE_CONFIG[question?.typeReponse]?.icon} {t('examRoomWorkspace')}</span>
                </div>

                {/* Texte libre */}
                {question?.typeReponse === 'texte' && (
                  <div className="text-answer-area" style={{ flex: 1 }}>
                    <textarea
                      id="text-answer"
                      placeholder="Rédigez votre réponse ici…"
                      value={answers[question.id] || ''}
                      onChange={e => handleAnswerChange(e.target.value)}
                      style={{ height: '100%', resize: 'none', caretColor: 'var(--accent)' }}
                    />
                  </div>
                )}

                {/* Éditeur de code */}
                {question?.typeReponse === 'code' && (
                  <div style={{ flex: 1, overflow: 'hidden', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <Editor
                      height="100%"
                      language={examData.langageCible.toLowerCase()}
                      theme="vs-dark"
                      value={answers[question.id] || ''}
                      onChange={handleAnswerChange}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
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

                {/* Zone UML */}
                {question?.typeReponse === 'uml' && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <textarea
                      placeholder={`Décrivez votre modélisation UML ici (entités, relations, attributs, méthodes)...\n\nEx:\nClasse Etudiant\n  - matricule : String\n  - nom : String\n  + getMatricule() : String\n\nRelation: Etudiant --[1..N]--> Copie`}
                      value={answers[question.id] || ''}
                      onChange={e => handleAnswerChange(e.target.value)}
                      style={{
                        flex: 1, resize: 'none', fontFamily: "'Fira Code', monospace",
                        fontSize: '0.85rem', lineHeight: 1.7,
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--border)', borderRadius: 8,
                        color: 'var(--text-primary)', padding: 16,
                        caretColor: 'var(--teacher-color)'
                      }}
                    />
                    <div style={{ padding: '8px 14px', background: 'rgba(139,92,246,0.05)', borderRadius: 8, border: '1px solid rgba(139,92,246,0.15)', fontSize: '0.75rem', color: 'rgba(196,181,253,0.7)' }}>
                      📐 Décrivez vos classes, attributs, méthodes et relations. Un éditeur UML graphique sera intégré prochainement.
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation bas de page */}
              <div className="exam-footer">
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={currentQ === 0}
                  onClick={() => setCurrentQ(q => q - 1)}
                >
                  {t('examRoomPrev')}
                </button>

                <div style={{ display: 'flex', gap: 6 }}>
                  {examData.questions.map((_, idx) => (
                    <div key={idx}
                      onClick={() => setCurrentQ(idx)}
                      style={{
                        width: 8, height: 8, borderRadius: '50%', cursor: 'pointer', transition: 'all 0.2s',
                        background: idx === currentQ ? 'var(--accent)' :
                                    answers[examData.questions[idx].id]?.trim() ? 'var(--success)' : 'var(--border)'
                      }}
                    />
                  ))}
                </div>

                <button
                  className="btn btn-ghost btn-sm"
                  disabled={currentQ === totalQ - 1}
                  onClick={() => setCurrentQ(q => q + 1)}
                  style={currentQ === totalQ - 1 ? {} : { color: 'var(--accent-light)', borderColor: 'rgba(99,102,241,0.3)' }}
                >
                  {t('examRoomNext')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

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
