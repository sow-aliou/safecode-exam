import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../utils/lang';

const TYPE_CONFIG = {
  texte: { label: 'Texte', icon: '📝', btnClass: 'active-text' },
  code:  { label: 'Code',  icon: '💻', btnClass: 'active-code' },
  uml:   { label: 'UML',   icon: '📐', btnClass: 'active-uml' },
};

const emptyQuestion = () => ({ id: Date.now(), enonce: '', typeReponse: 'texte', points: 0, testCases: [] });

export default function CreateExam() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, lang } = useTranslation();
  const { sessionId = null, sessionTitle = 'Nouvelle épreuve' } = location.state || {};

  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [isFinished, setIsFinished] = useState(false);
  const [examInfo, setExamInfo] = useState({
    titre: sessionTitle,
    instructions: '',
    dureeMinutes: 120,
    examDate: '',
    examTime: '',
    langageCible: 'Java',
    sujetPdfBase64: null,
    sujetPdfName: ''
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');



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
          const dateParts = ex.date ? ex.date.split(' ') : [];
          const sessionDate = dateParts[0] || '';
          const sessionTime = dateParts[1] || '';
          const duration = ex.duree || 120;
          
          if (sessionDate && sessionTime) {
            const end = new Date(`${sessionDate}T${sessionTime}`);
            end.setMinutes(end.getMinutes() + duration);
            setIsFinished(new Date() > end);
          }

          setExamInfo({
            titre: ex.title || sessionTitle,
            instructions: ex.instructions || '',
            dureeMinutes: duration,
            examDate: sessionDate,
            examTime: sessionTime,
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



  const addQuestion = () => setQuestions(prev => [...prev, { ...emptyQuestion(), id: Date.now() }]);

  const updateQuestion = (id, field, value) =>
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));

  const deleteQuestion = (id) =>
    setQuestions(prev => prev.filter(q => q.id !== id));



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
      dateHeureDebut: examInfo.examDate && examInfo.examTime ? `${examInfo.examDate} ${examInfo.examTime}` : undefined,
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>
            {saved ? `✅ ${t('createExamPublished')}` : `💾 ${t('createExamPublish')}`}
          </button>
          {isFinished && (
            <div style={{ color: '#ef4444', padding: '6px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 4, fontSize: '0.85rem', display: 'flex', alignItems: 'center', fontWeight: 'bold' }}>
              🔒 Épreuve terminée (Dates modifiables)
            </div>
          )}
        </div>
      </header>

      <div className="create-exam-page animate-fade-up" style={{ maxWidth: 1000, margin: '0 auto', paddingTop: 24 }}>
        {error && (
          <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '12px', padding: '16px', color: '#f43f5e', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.2rem' }}>⚠️</span> {error}
          </div>
        )}

        {/* Infos générales */}
        <div className="glass-card" style={{ padding: 32, marginBottom: 32, borderRadius: 24, background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
          <h2 style={{ marginBottom: 24, fontSize: '1.2rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ background: 'rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: 12 }}>📄</span>
            {t('createExamInfoTitle')}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">{t('createExamTitreLabel')}</label>
              <input className="form-input" value={examInfo.titre}
                onChange={e => setExamInfo({...examInfo, titre: e.target.value})}
                placeholder="ex: Examen Final" disabled={isFinished} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('dateLabel')}</label>
              <input className="form-input" type="date" value={examInfo.examDate || ''}
                onChange={e => setExamInfo({...examInfo, examDate: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('startTimeLabel')}</label>
              <input className="form-input" type="time" value={examInfo.examTime || ''}
                onChange={e => setExamInfo({...examInfo, examTime: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('createExamDurationLabel')}</label>
              <input className="form-input" type="number" value={examInfo.dureeMinutes} min={15}
                onChange={e => setExamInfo({...examInfo, dureeMinutes: e.target.value})} />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 16 }}>
            <label className="form-label" style={{ fontWeight: 600, color: 'var(--accent-light)' }}>Sujet / Contexte Global de l'Épreuve</label>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
              Saisissez ici le contexte général, l'énoncé principal ou le scénario qui s'applique à toute l'épreuve.
            </p>
            <textarea className="form-textarea" rows={6}
              placeholder="Ex: Le but de cet exercice est de concevoir le système d'information de l'entreprise..."
              value={examInfo.instructions}
              onChange={e => setExamInfo({...examInfo, instructions: e.target.value})} disabled={isFinished} />
          </div>
        </div>

        {/* Upload du sujet PDF */}
        <div className="glass-card" style={{ padding: 32, marginBottom: 32, borderRadius: 24, background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
          <h2 style={{ marginBottom: 12, fontSize: '1.2rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ background: 'rgba(59,130,246,0.1)', padding: '8px 12px', borderRadius: 12 }}>📎</span>
            {t('createExamPdfTitle')}
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 24, paddingLeft: 48 }}>
            {t('createExamPdfDesc')}
          </p>

          {!examInfo.sujetPdfBase64 ? (
            <div style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius)', padding: '40px 20px', textAlign: 'center', cursor: isFinished ? 'not-allowed' : 'pointer', background: 'rgba(255,255,255,0.01)', transition: 'all 0.2s', position: 'relative' }}
              onMouseOver={e => !isFinished && (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}>
              <input type="file" accept="application/pdf" onChange={handlePdfUpload} disabled={isFinished}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: isFinished ? 'not-allowed' : 'pointer' }} />
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
                  {!isFinished && (
                    <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                      <button className="btn btn-ghost btn-sm" onClick={removePdf} style={{ color: 'var(--danger)', padding: 0 }}>
                        ✕ Supprimer
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Questions */}
        <div className="section-header" style={{ marginTop: 40, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ❓ {t('createExamQuestionsTitle')} ({questions.length})
          </h2>
          {!isFinished && (
            <div style={{ display: 'flex', gap: 12 }}>
              <button id="btn-add-question" className="btn btn-primary btn-sm" onClick={addQuestion} style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))', border: 'none', padding: '10px 20px', borderRadius: 12, fontWeight: 700, color: '#fff', boxShadow: '0 4px 15px rgba(16,185,129,0.3)' }}>
                {t('createExamAddQ')}
              </button>
            </div>
          )}
        </div>

        {questions.length === 0 ? (
          <div className="glass-card empty-state" style={{ padding: '40px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 24 }}>
            <div style={{ fontSize: '3rem', opacity: 0.5, marginBottom: 16 }}>📝</div>
            <h3 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: 8 }}>Aucune question ajoutée</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Si vous avez fourni un document PDF, l'étudiant pourra le consulter. Vous pouvez ajouter des questions spécifiques ci-dessous si besoin.</p>
          </div>
        ) : (

        <div className="question-builder">
          {questions.map((q, index) => (
            <div key={q.id} className="glass-card question-card animate-fade-up" style={{ padding: 32, marginBottom: 24, borderRadius: 24, background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 8px 25px rgba(0,0,0,0.15)' }}>
              <div className="q-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div className="q-number" style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))', color: '#fff', width: 36, height: 36, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem', boxShadow: '0 4px 10px rgba(16,185,129,0.3)' }}>
                    {index + 1}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{t('createExamPoints')}</label>
                    <input type="number" min="1" className="form-input" style={{ width: 70, background: 'transparent', border: 'none', color: '#fff', fontWeight: 700, padding: 0, textAlign: 'right' }}
                      value={q.points} onChange={e => updateQuestion(q.id, 'points', e.target.value)} disabled={isFinished} />
                  </div>
                  {!isFinished && (
                    <button className="btn btn-ghost btn-sm" style={{ color: '#f43f5e', background: 'rgba(244,63,94,0.1)', padding: '8px', borderRadius: 10 }}
                      onClick={() => deleteQuestion(q.id)} type="button" title="Supprimer la question">
                      🗑️
                    </button>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--accent-light)', fontWeight: 600 }}>{t('createExamStatementPlaceholder')}</label>
                <textarea className="form-textarea" rows={4}
                  style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)' }}
                  placeholder={`${t('createExamStatementPlaceholder')} ${index + 1}...`}
                  value={q.enonce}
                  onChange={e => updateQuestion(q.id, 'enonce', e.target.value)} disabled={isFinished} />
              </div>
            </div>
          ))}
        </div>
        )}

        <div style={{ textAlign: 'right', marginTop: 8, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Total : <strong style={{ color: 'var(--accent-light)' }}>
            {questions.reduce((a, q) => a + Number(q.points), 0)} points
          </strong>
        </div>
      </div>


    </div>
  );
}
