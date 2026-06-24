import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../utils/lang';

export default function StudentLogin() {
  const navigate = useNavigate();
  const { t, lang, setLanguage } = useTranslation();
  const [examCode, setExamCode] = useState('');
  const [matricule, setMatricule] = useState('');
  const [personalCode, setPersonalCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!examCode.trim() || !matricule.trim() || !personalCode.trim()) {
      setError(t('fieldsRequired'));
      return;
    }
    setLoading(true);
    setError('');

    const storeSession = (user) => {
      sessionStorage.setItem('student_matricule', user.matricule);
      sessionStorage.setItem('student_name', `${user.prenom} ${user.nom}`);
      sessionStorage.setItem('session_code', examCode.trim().toUpperCase());
      sessionStorage.setItem('copie_id', user.copieId);
      sessionStorage.setItem('exam_data', JSON.stringify({
        titre: user.titre,
        dureeMinutes: user.dureeMinutes,
        instructions: user.instructions,
        langageCible: user.langageCible,
        sujetPdfBase64: user.sujetPdfBase64,
        enonceTexte: user.enonceTexte || null
      }));
      navigate(`/exam/${examCode.trim().toUpperCase()}`);
    };

    if (window.electronAPI) {
      try {
        const response = await window.electronAPI.studentLogin(
          matricule.trim().toUpperCase(),
          examCode.trim().toUpperCase(),
          personalCode.trim()
        );
        setLoading(false);
        if (response.success && response.user) {
          storeSession(response.user);
        } else {
          setError(t('authError'));
        }
      } catch (err) {
        setLoading(false);
        setError(t('authError'));
        console.error(err);
      }
    } else {
      try {
        const response = await fetch('http://localhost:3000/api/student/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matricule: matricule.trim().toUpperCase(),
            sessionCode: examCode.trim().toUpperCase(),
            password: personalCode.trim()
          })
        });
        const data = await response.json();
        setLoading(false);
        if (data.success && data.user) {
          storeSession(data.user);
        } else {
          setError(data.error || t('authError'));
        }
      } catch (err) {
        setLoading(false);
        setError(t('authError'));
        console.error(err);
      }
    }
  };

  return (
    <div className="gradient-bg auth-page">
      <button className="back-btn" onClick={() => navigate('/')}>
        ← {t('back')}
      </button>

      {/* Sélecteur de langue */}
      <div style={{ position: 'fixed', top: 20, right: 24, display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4, border: '1px solid var(--border)', zIndex: 50 }}>
        <button onClick={() => setLanguage('fr')} style={{ background: lang === 'fr' ? 'var(--accent)' : 'transparent', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 7, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>FR</button>
        <button onClick={() => setLanguage('en')} style={{ background: lang === 'en' ? 'var(--accent)' : 'transparent', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 7, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>EN</button>
      </div>

      <div className="glass-card auth-card animate-fade-up">
        <div className="auth-header">
          <div className="auth-icon" style={{ background: 'rgba(6,182,212,0.15)', color: '#67e8f9' }}>
            🎓
          </div>
          <h2>{t('studentTitle')}</h2>
          <p>{t('studentDesc')}</p>
        </div>

        <form className="auth-form" onSubmit={handleJoin}>
          <div className="form-group">
            <label className="form-label">{t('matriculeLabel')}</label>
            <input
              id="matricule"
              className="form-input"
              type="text"
              placeholder="ex: ETU-2024-001"
              value={matricule}
              onChange={e => setMatricule(e.target.value)}
              style={{ textTransform: 'uppercase' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('examCodeLabel')}</label>
            <input
              id="exam-code"
              className="form-input"
              type="text"
              placeholder="ex: XK9-2A4"
              value={examCode}
              onChange={e => setExamCode(e.target.value)}
              style={{ 
                textTransform: 'uppercase', 
                fontFamily: "'Fira Code', monospace", 
                fontSize: '1.1rem', 
                textAlign: 'center',
                letterSpacing: '0.15em'
              }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('personalCodeLabel')}</label>
            <input
              id="personal-code"
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={personalCode}
              onChange={e => setPersonalCode(e.target.value)}
              style={{ textAlign: 'center', letterSpacing: '0.1em' }}
            />
          </div>

          {error && (
            <div style={{ 
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius)', padding: '12px', fontSize: '0.875rem', color: '#f87171',
              textAlign: 'center', lineHeight: '1.4'
            }}>
              ⚠️ {error}
            </div>
          )}

          <button id="btn-join-exam" className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading}>
            {loading ? `⏳ ${t('verifying')}` : `🚀 ${t('launchBtn')}`}
          </button>
        </form>

        <p className="text-center text-muted text-sm mt-4">
          {t('studentHelpText')}
        </p>

        {/* Séparateur */}
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 20, paddingTop: 16, textAlign: 'center' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            💡 {lang === 'fr' ? 'Mode démo :' : 'Demo mode:'}{' '}
            <span style={{ fontFamily: 'Fira Code', color: 'var(--accent-light)', fontSize: '0.75rem' }}>
              DEV_001 / 1234 / PASS123
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
