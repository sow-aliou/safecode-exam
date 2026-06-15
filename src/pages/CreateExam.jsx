import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const TYPE_CONFIG = {
  texte: { label: 'Texte', icon: '📝', btnClass: 'active-text' },
  code:  { label: 'Code',  icon: '💻', btnClass: 'active-code' },
  uml:   { label: 'UML',   icon: '📐', btnClass: 'active-uml' },
};

const emptyQuestion = () => ({ id: Date.now(), enonce: '', typeReponse: 'texte', points: 1 });

export default function CreateExam() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionTitle = 'Nouvelle épreuve' } = location.state || {};

  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [examInfo, setExamInfo] = useState({
    titre: sessionTitle,
    instructions: '',
    dureeMinutes: 120,
    langageCible: 'Java'
  });
  const [saved, setSaved] = useState(false);

  const addQuestion = () => setQuestions(prev => [...prev, { ...emptyQuestion(), id: Date.now() }]);

  const updateQuestion = (id, field, value) =>
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));

  const deleteQuestion = (id) =>
    setQuestions(prev => prev.filter(q => q.id !== id));

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    // Ici on enverra les données à SQLite via IPC
  };

  return (
    <div className="gradient-bg" style={{ minHeight: '100vh' }}>
      {/* Topbar */}
      <header className="topbar">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/teacher/dashboard')}>
          ← Tableau de bord
        </button>
        <div className="topbar-logo"><span>✏️ Rédiger l'épreuve</span></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={handleSave}>
            {saved ? '✅ Sauvegardé !' : '💾 Sauvegarder'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/teacher/dashboard')}>
            ✅ Publier l'épreuve
          </button>
        </div>
      </header>

      <div className="create-exam-page animate-fade-up">
        {/* Infos générales */}
        <div className="glass-card" style={{ padding: 28, marginBottom: 24 }}>
          <h2 style={{ marginBottom: 20, fontSize: '1.1rem', fontWeight: 600 }}>📄 Informations générales</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Titre de l'épreuve</label>
              <input className="form-input" value={examInfo.titre}
                onChange={e => setExamInfo({...examInfo, titre: e.target.value})}
                placeholder="ex: Examen de Programmation Java – LP3" />
            </div>
            <div className="form-group">
              <label className="form-label">Langage principal</label>
              <select className="form-select" value={examInfo.langageCible}
                onChange={e => setExamInfo({...examInfo, langageCible: e.target.value})}>
                <option>Java</option><option>Python</option><option>C</option>
                <option>C++</option><option>JavaScript</option><option>SQL</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Durée (minutes)</label>
              <input className="form-input" type="number" value={examInfo.dureeMinutes} min={15}
                onChange={e => setExamInfo({...examInfo, dureeMinutes: e.target.value})} />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 16 }}>
            <label className="form-label">Instructions générales</label>
            <textarea className="form-textarea"
              placeholder="Rappel des règles, consignes, interdictions..."
              value={examInfo.instructions}
              onChange={e => setExamInfo({...examInfo, instructions: e.target.value})} />
          </div>
        </div>

        {/* Questions */}
        <div className="section-header">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>❓ Questions ({questions.length})</h2>
          <button id="btn-add-question" className="btn btn-ghost btn-sm" onClick={addQuestion}>
            + Ajouter une question
          </button>
        </div>

        <div className="question-builder">
          {questions.map((q, index) => (
            <div key={q.id} className="glass-card question-card animate-fade-up">
              <div className="q-header">
                <div className="q-number">Q{index + 1}</div>
                <div style={{ flex: 1, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Type de réponse attendue :
                  <div className="q-type-selector">
                    {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
                      <button
                        key={type}
                        className={`q-type-btn ${q.typeReponse === type ? cfg.btnClass : ''}`}
                        onClick={() => updateQuestion(q.id, 'typeReponse', type)}
                        type="button"
                      >
                        {cfg.icon} {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Points :</label>
                  <input type="number" min="1" className="form-input" style={{ width: 70 }}
                    value={q.points} onChange={e => updateQuestion(q.id, 'points', e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Énoncé de la question</label>
                <textarea className="form-textarea" rows={4}
                  placeholder={`Rédigez l'énoncé de la question ${index + 1}...`}
                  value={q.enonce}
                  onChange={e => updateQuestion(q.id, 'enonce', e.target.value)} />
              </div>

              {/* Aperçu du type de réponse */}
              <div style={{
                marginTop: 12, padding: '10px 14px',
                background: 'rgba(255,255,255,0.03)', borderRadius: 8,
                border: '1px dashed var(--border)',
                fontSize: '0.8rem', color: 'var(--text-muted)'
              }}>
                {q.typeReponse === 'texte' && '📝 L\'étudiant répondra par un texte libre.'}
                {q.typeReponse === 'code' && `💻 L'étudiant répondra avec un éditeur de code (${examInfo.langageCible}) avec coloration syntaxique.`}
                {q.typeReponse === 'uml' && '📐 L\'étudiant répondra en concevant un diagramme UML.'}
              </div>

              {questions.length > 1 && (
                <div className="q-delete">
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', padding: '4px 10px' }}
                    onClick={() => deleteQuestion(q.id)} type="button">
                    ✕
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Total points */}
        <div style={{ textAlign: 'right', marginTop: 8, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Total : <strong style={{ color: 'var(--accent-light)' }}>
            {questions.reduce((a, q) => a + Number(q.points), 0)} points
          </strong>
        </div>
      </div>
    </div>
  );
}
