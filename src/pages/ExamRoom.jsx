import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';

// Questions de démonstration
const DEMO_EXAM = {
  titre: 'Programmation Java – LP3',
  dureeMinutes: 120,
  instructions: 'Lisez attentivement chaque question. Toute tentative de sortie de l\'application sera enregistrée.',
  langageCible: 'java',
  questions: [
    { id: 1, enonce: 'Expliquez la différence entre une classe abstraite et une interface en Java. Donnez un exemple concret d\'utilisation de chacune.', typeReponse: 'texte', points: 4 },
    { id: 2, enonce: 'Implémentez en Java une méthode `public static int[] trier(int[] tableau)` qui trie un tableau d\'entiers en ordre croissant en utilisant l\'algorithme du tri à bulles. Commentez chaque étape de votre code.', typeReponse: 'code', points: 6 },
    { id: 3, enonce: 'Concevez le diagramme de classes UML pour un système de gestion de bibliothèque comportant : des Livres, des Membres, des Emprunts (avec date de début et de fin) et une méthode de vérification de disponibilité.', typeReponse: 'uml', points: 5 },
    { id: 4, enonce: 'Quelle est la complexité temporelle du tri à bulles dans le pire des cas ? Justifiez votre réponse.', typeReponse: 'texte', points: 2 },
    { id: 5, enonce: 'Écrivez une classe Java `Pile<T>` générique utilisant une `ArrayList`, avec les méthodes `push(T item)`, `pop()`, `peek()` et `isEmpty()`.', typeReponse: 'code', points: 8 },
  ]
};

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
  }, []);

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
  const matricule = sessionStorage.getItem('student_matricule') || 'ÉTUDIANT';

  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState(
    Object.fromEntries(DEMO_EXAM.questions.map(q => [q.id, '']))
  );
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  const question = DEMO_EXAM.questions[currentQ];
  const answeredCount = Object.values(answers).filter(a => a.trim() !== '').length;

  const handleAnswerChange = useCallback((value) => {
    setAnswers(prev => ({ ...prev, [question.id]: value ?? '' }));
    // Auto-save via Electron IPC si disponible
    if (window.electronAPI) {
      window.electronAPI.saveCode(JSON.stringify(answers)).catch(console.error);
    }
    setLastSaved(new Date());
  }, [question.id, answers]);

  const handleSubmit = () => {
    setShowSubmitModal(false);
    navigate('/');
  };

  const initials = matricule.slice(0, 2).toUpperCase();

  return (
    <div className="gradient-bg exam-room">
      {/* Topbar */}
      <header className="exam-topbar">
        <div className="exam-info">
          <h2>🛡️ {DEMO_EXAM.titre}</h2>
          <p>Code : <strong style={{ color: 'var(--accent-light)', fontFamily: 'Fira Code' }}>{sessionCode}</strong> · Matricule : {matricule}</p>
        </div>
        <Timer totalSeconds={DEMO_EXAM.dureeMinutes * 60} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="avatar" style={{ background: 'linear-gradient(135deg, var(--student-color), #0891b2)' }}>
            {initials}
          </div>
          <button id="btn-submit-exam" className="btn btn-danger btn-sm" onClick={() => setShowSubmitModal(true)}>
            📤 Soumettre
          </button>
        </div>
      </header>

      <div className="exam-body">
        {/* Navigation latérale */}
        <aside className="questions-sidebar">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Questions
          </div>
          {DEMO_EXAM.questions.map((q, idx) => (
            <div
              key={q.id}
              className={`q-nav-item ${idx === currentQ ? 'active' : ''} ${answers[q.id]?.trim() ? 'answered' : ''}`}
              onClick={() => setCurrentQ(idx)}
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
            {answeredCount}/{DEMO_EXAM.questions.length} réponses
          </div>
        </aside>

        {/* Zone de travail */}
        <div className="question-workspace">
          <div className="question-panel">
            {/* Énoncé */}
            <div className="question-statement">
              <div className="q-label">Question {currentQ + 1} / {DEMO_EXAM.questions.length}</div>
              <h3>{question.enonce}</h3>
              <div className="response-type-badge" style={{
                background: `${TYPE_CONFIG[question.typeReponse].color}22`,
                color: TYPE_CONFIG[question.typeReponse].color,
                border: `1px solid ${TYPE_CONFIG[question.typeReponse].color}44`,
              }}>
                {TYPE_CONFIG[question.typeReponse].icon} {TYPE_CONFIG[question.typeReponse].label}
              </div>
              <div style={{ marginTop: 20, padding: 12, background: 'rgba(99,102,241,0.05)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.1)' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>📌 Instructions :</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '6px 0 0', lineHeight: 1.6 }}>
                  {DEMO_EXAM.instructions}
                </p>
              </div>
            </div>

            {/* Zone de réponse */}
            <div className="answer-area">
              <div className="answer-header">
                <span>{TYPE_CONFIG[question.typeReponse].icon} Votre réponse</span>
                {lastSaved && (
                  <div className="autosave-indicator">
                    <div className="autosave-dot" />
                    Sauvegardé à {lastSaved.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                )}
              </div>

              {question.typeReponse === 'texte' && (
                <div className="text-answer-area">
                  <textarea
                    id="text-answer"
                    placeholder="Rédigez votre réponse ici..."
                    value={answers[question.id]}
                    onChange={e => handleAnswerChange(e.target.value)}
                    style={{ caretColor: 'var(--accent)' }}
                  />
                </div>
              )}

              {question.typeReponse === 'code' && (
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <Editor
                    height="100%"
                    language={DEMO_EXAM.langageCible}
                    theme="vs-dark"
                    value={answers[question.id]}
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

              {question.typeReponse === 'uml' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 20 }}>
                  <div style={{
                    flex: 1, background: '#fff', borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#666', fontSize: '0.9rem'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '2rem', marginBottom: 8 }}>📐</p>
                      <p><strong>Zone de modélisation UML</strong></p>
                      <p style={{ fontSize: '0.8rem', color: '#999', marginTop: 4 }}>
                        L'outil UML interactif sera intégré ici (Draw.io / React Flow)
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Navigation bas de page */}
          <div className="exam-footer">
            <button
              className="btn btn-ghost btn-sm"
              disabled={currentQ === 0}
              onClick={() => setCurrentQ(q => q - 1)}
            >
              ← Précédente
            </button>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {answeredCount} réponse(s) sur {DEMO_EXAM.questions.length}
            </div>
            <button
              className="btn btn-ghost btn-sm"
              disabled={currentQ === DEMO_EXAM.questions.length - 1}
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
              Vous avez répondu à <strong style={{ color: 'var(--accent-light)' }}>{answeredCount} question(s)</strong> sur {DEMO_EXAM.questions.length}.
              <br /><br />
              Une fois soumise, votre copie sera <strong>chiffrée et envoyée à l'enseignant</strong>. 
              Cette action est irréversible.
            </p>
            <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 8 }}>
              <p style={{ fontSize: '0.875rem', color: '#f87171', margin: 0 }}>
                ⚠️ Assurez-vous d'avoir complété toutes vos réponses avant de soumettre.
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
