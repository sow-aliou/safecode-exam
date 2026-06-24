import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../utils/lang';

const TYPE_CONFIG = {
  texte: { label: 'Texte', icon: '📝', btnClass: 'active-text' },
  code:  { label: 'Code',  icon: '💻', btnClass: 'active-code' },
  uml:   { label: 'UML',   icon: '📐', btnClass: 'active-uml' },
};

const emptyQuestion = () => ({ id: Date.now(), enonce: '', typeReponse: 'texte', points: 1 });

export default function CreateExam() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, lang } = useTranslation();
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Banque de questions states
  const [qBank, setQBank] = useState([]);
  const [showQBankModal, setShowQBankModal] = useState(false);

  // Charger les données de l'épreuve existante
  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }

    const load = async () => {
      try {
        let ex = null;
        if (window.electronAPI) {
          // Si nous sommes sur Electron, nous devrions récupérer les détails de la session
          // La route /api/sessions/:id/exam est accessible.
        }
        const res = await fetch(`http://localhost:3000/api/sessions/${sessionId}/exam`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.exam) {
            ex = data.exam;
          }
        }
        
        if (ex) {
          setExamInfo({
            titre: ex.title || sessionTitle,
            instructions: ex.instructions || '',
            dureeMinutes: ex.duree || 120,
            langageCible: ex.langageCible || 'Java',
            sujetPdfBase64: ex.sujetPdfBase64 || null,
            sujetPdfName: ex.sujetPdfBase64 ? 'Sujet Examen.pdf' : ''
          });
          if (ex.enonceTexte) {
            try {
              const parsed = JSON.parse(ex.enonceTexte);
              if (Array.isArray(parsed) && parsed.length > 0) setQuestions(parsed);
            } catch (_) {}
          }
        }
      } catch (err) {
        console.warn('Chargement depuis le serveur impossible.', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId]);

  // Charger la banque de questions de l'enseignant
  useEffect(() => {
    const fetchQBank = async () => {
      const teacherId = sessionStorage.getItem('teacher_id') || 1;
      try {
        if (window.electronAPI) {
          const res = await window.electronAPI.getQuestionBank(teacherId);
          if (res.success) setQBank(res.questions);
        } else {
          const res = await fetch(`http://localhost:3000/api/questionbank?teacherId=${teacherId}`);
          const data = await res.json();
          if (data.success) setQBank(data.questions);
        }
      } catch (err) {
        console.error(err);
        setQBank([
          { id: 1, enonce: "Expliquez le concept d'encapsulation en POO.", typeReponse: 'texte', points: 3 },
          { id: 2, enonce: "Écrire une fonction qui vérifie si une chaîne est un palindrome.", typeReponse: 'code', points: 5 }
        ]);
      }
    };
    fetchQBank();
  }, []);

  const addQuestion = () => setQuestions(prev => [...prev, { ...emptyQuestion(), id: Date.now() }]);

  const updateQuestion = (id, field, value) =>
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));

  const deleteQuestion = (id) =>
    setQuestions(prev => prev.filter(q => q.id !== id));

  const handleImportQuestion = (qBankItem) => {
    setQuestions(prev => [...prev, {
      id: Date.now() + Math.random(),
      enonce: qBankItem.enonce,
      typeReponse: qBankItem.typeReponse,
      points: qBankItem.points
    }]);
  };

  // Gestion du PDF
  const handlePdfUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { setError("PDF uniquement."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Max: 5 Mo."); return; }
    setError('');
    const reader = new FileReader();
    reader.onload = () => setExamInfo(prev => ({ ...prev, sujetPdfBase64: reader.result, sujetPdfName: file.name }));
    reader.onerror = () => setError("Erreur de lecture PDF.");
    reader.readAsDataURL(file);
  };

  const removePdf = () => setExamInfo(prev => ({ ...prev, sujetPdfBase64: null, sujetPdfName: '' }));

  // Sauvegarde complète
  const handleSave = async () => {
    if (!examInfo.titre.trim()) { setError(t('createExamRequired')); return; }
    setError('');

    const examData = {
      title: examInfo.titre,
      duree: parseInt(examInfo.dureeMinutes) || 120,
      instructions: examInfo.instructions,
      langageCible: examInfo.langageCible,
      sujetPdfBase64: examInfo.sujetPdfBase64,
      questions: questions
    };

    try {
      if (window.electronAPI && sessionId) {
        await window.electronAPI.updateSessionExam(sessionId, examData);
      } else if (sessionId) {
        const response = await fetch(`http://localhost:3000/api/sessions/${sessionId}/exam`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(examData)
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
      }
      setSaved(true);
      setTimeout(() => { setSaved(false); navigate('/teacher/dashboard'); }, 1200);
    } catch (err) {
      console.error(err);
      setError("Erreur serveur/base de données.");
    }
  };

  if (loading) {
    return (
      <div className="gradient-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>⏳ {t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="gradient-bg" style={{ minHeight: '100vh', paddingBottom: 60 }}>
      {/* Topbar */}
      <header className="topbar">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/teacher/dashboard')}>
          ← {t('createExamBack')}
        </button>
        <div className="topbar-logo"><span>✏️ {t('createExamTitle')}</span></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>
            {saved ? `✅ ${t('createExamPublished')}` : `💾 ${t('createExamPublish')}`}
          </button>
        </div>
      </header>

      <div className="create-exam-page animate-fade-up">
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius)', padding: '16px', color: '#f87171', marginBottom: 20 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Infos générales */}
        <div className="glass-card" style={{ padding: 28, marginBottom: 24 }}>
          <h2 style={{ marginBottom: 20, fontSize: '1.1rem', fontWeight: 600 }}>📄 {t('createExamInfoTitle')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">{t('createExamTitreLabel')}</label>
              <input className="form-input" value={examInfo.titre}
                onChange={e => setExamInfo({...examInfo, titre: e.target.value})}
                placeholder="ex: Examen Final" />
            </div>
            <div className="form-group">
              <label className="form-label">{t('createExamLangLabel')}</label>
              <select className="form-select" value={examInfo.langageCible}
                onChange={e => setExamInfo({...examInfo, langageCible: e.target.value})}>
                <option>Java</option><option>Python</option><option>C</option>
                <option>C++</option><option>JavaScript</option><option>SQL</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('createExamDurationLabel')}</label>
              <input className="form-input" type="number" value={examInfo.dureeMinutes} min={15}
                onChange={e => setExamInfo({...examInfo, dureeMinutes: e.target.value})} />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 16 }}>
            <label className="form-label">{t('createExamInstructionsLabel')}</label>
            <textarea className="form-textarea"
              placeholder={t('createExamInstructionsPlaceholder')}
              value={examInfo.instructions}
              onChange={e => setExamInfo({...examInfo, instructions: e.target.value})} />
          </div>
        </div>

        {/* Upload du sujet PDF */}
        <div className="glass-card" style={{ padding: 28, marginBottom: 24 }}>
          <h2 style={{ marginBottom: 10, fontSize: '1.1rem', fontWeight: 600 }}>📎 {t('createExamPdfTitle')}</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
            {t('createExamPdfDesc')}
          </p>

          {!examInfo.sujetPdfBase64 ? (
            <div style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius)', padding: '40px 20px', textAlign: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.01)', transition: 'all 0.2s', position: 'relative' }}
              onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}>
              <input type="file" accept="application/pdf" onChange={handlePdfUpload}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: 12 }}>📥</span>
              <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 4 }}>{t('createExamPdfPlaceholder')}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>PDF (Max: 5 Mo)</p>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 'var(--radius)', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '1.8rem' }}>📄</span>
                <div>
                  <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{examInfo.sujetPdfName || 'Sujet Examen.pdf'}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--success)' }}>✅ {t('createExamPdfSuccess')}</p>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={removePdf} style={{ color: 'var(--danger)', border: 'none' }}>
                ✕ {t('close')}
              </button>
            </div>
          )}
        </div>

        {/* Questions */}
        <div className="section-header">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>❓ {t('createExamQuestionsTitle')} ({questions.length})</h2>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowQBankModal(true)}>
              📥 Importer de la banque
            </button>
            <button id="btn-add-question" className="btn btn-primary btn-sm" onClick={addQuestion}>
              {t('createExamAddQ')}
            </button>
          </div>
        </div>

        <div className="question-builder">
          {questions.map((q, index) => (
            <div key={q.id} className="glass-card question-card animate-fade-up">
              <div className="q-header">
                <div className="q-number">Q{index + 1}</div>
                <div style={{ flex: 1, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  {t('qbankTypeLabel')} :
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
                  <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>{t('createExamPoints')}</label>
                  <input type="number" min="1" className="form-input" style={{ width: 70 }}
                    value={q.points} onChange={e => updateQuestion(q.id, 'points', e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t('qbankStatementPlaceholder')}</label>
                <textarea className="form-textarea" rows={4}
                  placeholder={`${t('createExamStatementPlaceholder')} ${index + 1}...`}
                  value={q.enonce}
                  onChange={e => updateQuestion(q.id, 'enonce', e.target.value)} />
              </div>

              <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px dashed var(--border)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
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

        <div style={{ textAlign: 'right', marginTop: 8, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Total : <strong style={{ color: 'var(--accent-light)' }}>
            {questions.reduce((a, q) => a + Number(q.points), 0)} points
          </strong>
        </div>
      </div>

      {/* Modal Import Question Bank */}
      {showQBankModal && (
        <div className="modal-overlay" onClick={() => setShowQBankModal(false)}>
          <div className="modal" style={{ maxWidth: '600px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <h2>📥 Importer de la Banque de Questions</h2>
            <p>Sélectionnez une question pour l'ajouter à l'épreuve.</p>
            
            <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, margin: '20px 0' }}>
              {qBank.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucune question disponible dans la banque.</p>
              ) : (
                qBank.map(item => (
                  <div key={item.id} style={{ padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1, marginRight: 16 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                        <span className="badge badge-blue">{item.typeReponse.toUpperCase()}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--accent-light)' }}>{item.points} pts</span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0 }}>{item.enonce}</p>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => handleImportQuestion(item)}>
                      +
                    </button>
                  </div>
                ))
              )}
            </div>
            
            <div className="modal-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowQBankModal(false)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
