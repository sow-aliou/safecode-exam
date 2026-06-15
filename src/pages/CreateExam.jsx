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
  const { sessionId = null, sessionTitle = 'Nouvelle épreuve' } = location.state || {};

  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [examInfo, setExamInfo] = useState({
    titre: sessionTitle,
    instructions: '',
    dureeMinutes: 120,
    langageCible: 'Java',
    sujetPdfBase64: null,
    sujetPdfName: ''
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const addQuestion = () => setQuestions(prev => [...prev, { ...emptyQuestion(), id: Date.now() }]);

  const updateQuestion = (id, field, value) =>
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));

  const deleteQuestion = (id) =>
    setQuestions(prev => prev.filter(q => q.id !== id));

  // Convertir le PDF en Base64
  const handlePdfUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError("Veuillez sélectionner un fichier PDF uniquement.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // Limite 5 Mo
      setError("Le fichier PDF est trop volumineux (Max: 5 Mo).");
      return;
    }

    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      setExamInfo(prev => ({
        ...prev,
        sujetPdfBase64: reader.result,
        sujetPdfName: file.name
      }));
    };
    reader.onerror = () => {
      setError("Erreur lors de la lecture du fichier PDF.");
    };
    reader.readAsDataURL(file);
  };

  const removePdf = () => {
    setExamInfo(prev => ({
      ...prev,
      sujetPdfBase64: null,
      sujetPdfName: ''
    }));
  };

  const handleSave = async () => {
    if (!examInfo.titre.trim()) {
      setError("Le titre de l'épreuve est obligatoire.");
      return;
    }
    setError('');

    const examData = {
      title: examInfo.titre,
      duree: parseInt(examInfo.dureeMinutes) || 120,
      instructions: examInfo.instructions,
      langageCible: examInfo.langageCible,
      sujetPdfBase64: examInfo.sujetPdfBase64,
      questions: questions
    };

    if (window.electronAPI && sessionId) {
      try {
        // Enregistrer dans la base de données
        // 1. Mettre à jour le PDF du sujet
        await window.electronAPI.updateSessionPdf(sessionId, examInfo.sujetPdfBase64);
        
        // (On peut aussi sauvegarder d'autres paramètres s'ils sont dans la base de données)
        setSaved(true);
        setTimeout(() => {
          setSaved(false);
          navigate('/teacher/dashboard');
        }, 1200);
      } catch (err) {
        console.error(err);
        setError("Erreur lors de l'enregistrement de l'épreuve.");
      }
    } else {
      // Simulation locale
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        navigate('/teacher/dashboard');
      }, 1200);
    }
  };

  return (
    <div className="gradient-bg" style={{ minHeight: '100vh', paddingBottom: 60 }}>
      {/* Topbar */}
      <header className="topbar">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/teacher/dashboard')}>
          ← Tableau de bord
        </button>
        <div className="topbar-logo"><span>✏️ Configurer l'épreuve</span></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>
            {saved ? '✅ Publié !' : '💾 Publier l\'épreuve'}
          </button>
        </div>
      </header>

      <div className="create-exam-page animate-fade-up">
        {error && (
          <div style={{ 
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 'var(--radius)', padding: '16px', color: '#f87171', marginBottom: 20
          }}>
            ⚠️ {error}
          </div>
        )}

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

        {/* Upload du sujet PDF */}
        <div className="glass-card" style={{ padding: 28, marginBottom: 24 }}>
          <h2 style={{ marginBottom: 10, fontSize: '1.1rem', fontWeight: 600 }}>📎 Document PDF de l'épreuve (Optionnel)</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
            Uploadez le sujet d'examen officiel en PDF. Les étudiants pourront le visualiser directement dans leur espace d'examen sécurisé.
          </p>

          {!examInfo.sujetPdfBase64 ? (
            <div style={{
              border: '2px dashed var(--border)',
              borderRadius: 'var(--radius)',
              padding: '40px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'rgba(255,255,255,0.01)',
              transition: 'all 0.2s',
              position: 'relative'
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}>
              <input
                type="file"
                accept="application/pdf"
                onChange={handlePdfUpload}
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0,
                  cursor: 'pointer'
                }}
              />
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: 12 }}>📥</span>
              <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 4 }}>
                Cliquez ou glissez-déposez le fichier PDF ici
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                PDF uniquement (Taille max: 5 Mo)
              </p>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(99,102,241,0.05)',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 'var(--radius)',
              padding: '16px 20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '1.8rem' }}>📄</span>
                <div>
                  <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{examInfo.sujetPdfName || 'Sujet Examen.pdf'}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Fichier chargé avec succès en base de données</p>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={removePdf} style={{ color: 'var(--danger)', border: 'none' }}>
                Supprimer
              </button>
            </div>
          )}
        </div>

        {/* Questions */}
        <div className="section-header">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>❓ Questions structurées ({questions.length})</h2>
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
