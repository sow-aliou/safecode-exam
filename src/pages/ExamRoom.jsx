import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';

const TYPE_CONFIG = {
  texte: { label: 'Réponse Texte', icon: '📝', color: 'var(--student-color)' },
  code:  { label: 'Réponse Code',  icon: '💻', color: 'var(--success)' },
  uml:   { label: 'Réponse UML',   icon: '📐', color: 'var(--teacher-color)' },
};

function Timer({ totalSeconds }) {
  const [seconds, setSeconds] = useState(totalSeconds);

  useEffect(() => {
    if (seconds <= 0) return;
    const interval = setInterval(() => setSeconds(s => s - 1), 1000);
    return () => clearInterval(interval);
  }, [seconds, totalSeconds]);

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = n => String(n).padStart(2, '0');
  const pct = seconds / totalSeconds;

  const cls = pct > 0.5 ? 'normal' : pct > 0.2 ? 'warning' : '';

  return (
    <div className={`timer ${cls}`}>
      ⏱ {pad(h)}:{pad(m)}:{pad(s)}
    </div>
  );
}

export default function ExamRoom() {
  const navigate = useNavigate();
  const { sessionCode } = useParams();
  
  const matricule = sessionStorage.getItem('student_matricule') || 'DEV_001';
  const studentName = sessionStorage.getItem('student_name') || 'Etudiant Test';
  const copieId = sessionStorage.getItem('copie_id') || '1';

  // Charger les données de l'examen depuis la session
  const [examData, setExamData] = useState({
    titre: 'Examen de Programmation',
    dureeMinutes: 120,
    instructions: 'Veuillez composer calmement.',
    langageCible: 'Java',
    sujetPdfBase64: null,
    questions: [
      { id: 1, enonce: 'Rédigez vos réponses ci-dessous. Utilisez le bouton ci-dessus pour consulter le sujet PDF si disponible.', typeReponse: 'code', points: 20 }
    ]
  });

  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('answer'); // 'answer' or 'pdf'

  useEffect(() => {
    const cachedExam = sessionStorage.getItem('exam_data');
    if (cachedExam) {
      const parsed = JSON.parse(cachedExam);
      
      // Si on a un sujet PDF mais pas de questions spécifiques, on fournit une zone de réponse générale
      const questions = parsed.questions && parsed.questions.length > 0 
        ? parsed.questions 
        : [
            { id: 1, enonce: 'Rédigez la réponse globale à votre sujet ici. Si le sujet demande du code, écrivez votre code dans l\'onglet Code ci-dessus.', typeReponse: 'code', points: 20 }
          ];

      setExamData({
        titre: parsed.titre || 'Examen',
        dureeMinutes: parsed.dureeMinutes || 120,
        instructions: parsed.instructions || 'Aucune consigne spécifique.',
        langageCible: parsed.langageCible || 'Java',
        sujetPdfBase64: parsed.sujetPdfBase64 || null,
        questions: questions
      });

      setAnswers(Object.fromEntries(questions.map(q => [q.id, ''])));
    }
  }, []);

  const question = examData.questions[currentQ] || examData.questions[0];
  const answeredCount = Object.values(answers).filter(a => a.trim() !== '').length;

  const handleAnswerChange = useCallback((value) => {
    if (!question) return;
    setAnswers(prev => {
      const updated = { ...prev, [question.id]: value ?? '' };
      
      // Sauvegarde automatique SQLite via IPC
      if (window.electronAPI) {
        window.electronAPI.saveCode(JSON.stringify(updated), parseInt(copieId))
          .then(() => setLastSaved(new Date()))
          .catch(console.error);
      } else {
        setLastSaved(new Date());
      }
      
      return updated;
    });
  }, [question, copieId]);

  const handleSubmit = () => {
    setShowSubmitModal(false);
    sessionStorage.clear();
    navigate('/');
  };

  const initials = matricule.slice(0, 2).toUpperCase();

  return (
    <div className="gradient-bg exam-room">
      {/* Topbar */}
      <header className="exam-topbar">
        <div className="exam-info">
          <h2>🛡️ {examData.titre}</h2>
          <p>Session : <strong style={{ color: 'var(--accent-light)', fontFamily: 'Fira Code' }}>{sessionCode}</strong> · {studentName} ({matricule})</p>
        </div>
        <Timer totalSeconds={examData.dureeMinutes * 60} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="avatar" style={{ background: 'linear-gradient(135deg, var(--student-color), #0891b2)' }}>
            {initials}
          </div>
          <button id="btn-submit-exam" className="btn btn-danger btn-sm" onClick={() => setShowSubmitModal(true)}>
            📤 Soumettre la Copie
          </button>
        </div>
      </header>

      <div className="exam-body">
        {/* Navigation latérale */}
        <aside className="questions-sidebar">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Navigation
          </div>
          
          {examData.sujetPdfBase64 && (
            <div
              className={`q-nav-item ${activeWorkspaceTab === 'pdf' ? 'active' : ''}`}
              onClick={() => setActiveWorkspaceTab('pdf')}
              style={{ color: 'var(--accent-light)', borderColor: activeWorkspaceTab === 'pdf' ? 'var(--accent)' : 'transparent', marginBottom: 12 }}
            >
              <span style={{ fontSize: '1.2rem' }}>📄</span>
              <div className="q-nav-item-label" style={{ fontWeight: 'bold' }}>Sujet PDF</div>
            </div>
          )}

          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '12px 0 8px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Questions / Réponses
          </div>

          {examData.questions.map((q, idx) => (
            <div
              key={q.id}
              className={`q-nav-item ${idx === currentQ && activeWorkspaceTab === 'answer' ? 'active' : ''} ${answers[q.id]?.trim() ? 'answered' : ''}`}
              onClick={() => {
                setCurrentQ(idx);
                setActiveWorkspaceTab('answer');
              }}
            >
              <div className="q-dot" />
              <div className="q-nav-item-label">
                Q{idx + 1} — {TYPE_CONFIG[q.typeReponse].icon} {q.points} pts
              </div>
            </div>
          ))}
          <div style={{ 
            marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)',
            fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center'
          }}>
            {answeredCount}/{examData.questions.length} complété(s)
          </div>
        </aside>

        {/* Zone de travail */}
        <div className="question-workspace">
          {activeWorkspaceTab === 'pdf' && examData.sujetPdfBase64 ? (
            <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div className="section-header" style={{ marginBottom: 12 }}>
                <h2>📄 Sujet Officiel PDF de l'Examen</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => setActiveWorkspaceTab('answer')}>
                  Retourner à la saisie de réponse
                </button>
              </div>
              <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <iframe
                  src={examData.sujetPdfBase64}
                  title="Sujet PDF"
                  width="100%"
                  height="100%"
                  style={{ border: 'none' }}
                />
              </div>
            </div>
          ) : (
            <div className="question-panel">
              {/* Énoncé */}
              <div className="question-statement">
                <div className="q-label">Question {currentQ + 1} / {examData.questions.length}</div>
                <h3>{question?.enonce}</h3>
                <div className="response-type-badge" style={{
                  background: `${TYPE_CONFIG[question?.typeReponse]?.color || 'var(--accent)'}22`,
                  color: TYPE_CONFIG[question?.typeReponse]?.color || 'var(--accent)',
                  border: `1px solid ${TYPE_CONFIG[question?.typeReponse]?.color || 'var(--accent)'}44`,
                }}>
                  {TYPE_CONFIG[question?.typeReponse]?.icon} {TYPE_CONFIG[question?.typeReponse]?.label}
                </div>
                <div style={{ marginTop: 20, padding: 12, background: 'rgba(99,102,241,0.05)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.1)' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>📌 Instructions :</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '6px 0 0', lineHeight: 1.6 }}>
                    {examData.instructions}
                  </p>
                </div>
              </div>

              {/* Zone de réponse */}
              <div className="answer-area">
                <div className="answer-header">
                  <span>{TYPE_CONFIG[question?.typeReponse]?.icon} Saisie de réponse</span>
                  {lastSaved && (
                    <div className="autosave-indicator">
                      <div className="autosave-dot" />
                      Sauvegarde auto active ({lastSaved.toLocaleTimeString('fr-FR')})
                    </div>
                  )}
                </div>

                {question?.typeReponse === 'texte' && (
                  <div className="text-answer-area">
                    <textarea
                      id="text-answer"
                      placeholder="Rédigez votre réponse ici..."
                      value={answers[question.id] || ''}
                      onChange={e => handleAnswerChange(e.target.value)}
                      style={{ caretColor: 'var(--accent)' }}
                    />
                  </div>
                )}

                {question?.typeReponse === 'code' && (
                  <div style={{ flex: 1, overflow: 'hidden' }}>
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
                      }}
                    />
                  </div>
                )}

                {question?.typeReponse === 'uml' && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 20 }}>
                    <div style={{
                      flex: 1, background: '#fff', borderRadius: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#666', fontSize: '0.9rem'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '2.5rem', marginBottom: 8 }}>📐</p>
                        <p style={{ color: '#333' }}><strong>Zone de modélisation UML</strong></p>
                        <p style={{ fontSize: '0.8rem', color: '#777', marginTop: 4 }}>
                          Outil de dessin vectoriel et de conception diagramme UML intégré.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation bas de page */}
          <div className="exam-footer">
            <button
              className="btn btn-ghost btn-sm"
              disabled={currentQ === 0 || activeWorkspaceTab === 'pdf'}
              onClick={() => setCurrentQ(q => q - 1)}
            >
              ← Précédente
            </button>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {answeredCount} réponse(s) enregistrée(s)
            </div>
            <button
              className="btn btn-ghost btn-sm"
              disabled={currentQ === examData.questions.length - 1 || activeWorkspaceTab === 'pdf'}
              onClick={() => setCurrentQ(q => q + 1)}
            >
              Suivante →
            </button>
          </div>
        </div>
      </div>

      {/* Modal de soumission */}
      {showSubmitModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>📤 Soumettre votre copie ?</h2>
            <p>
              Vous avez répondu à <strong style={{ color: 'var(--accent-light)' }}>{answeredCount} question(s)</strong>.
              <br /><br />
              Une fois soumise, votre copie sera <strong>définitivement enregistrée et verrouillée</strong> pour correction. 
            </p>
            <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 8 }}>
              <p style={{ fontSize: '0.875rem', color: '#f87171', margin: 0 }}>
                ⚠️ Assurez-vous d'avoir relu toutes vos réponses avant de soumettre.
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowSubmitModal(false)}>Continuer l'examen</button>
              <button id="btn-confirm-submit" className="btn btn-danger" onClick={handleSubmit}>
                Confirmer la soumission
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
