import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../utils/lang';

const authStyles = `
  .auth-wrapper {
    min-height: 100vh;
    width: 100%;
    position: relative;
    overflow: hidden;
    background: #050807;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .auth-bg-glow {
    position: absolute;
    width: 60vw;
    height: 60vw;
    max-width: 600px;
    max-height: 600px;
    background: radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 60%);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 0;
    pointer-events: none;
    animation: pulse-dot 6s ease-in-out infinite alternate;
  }
  .premium-auth-card {
    position: relative;
    z-index: 10;
    width: 100%;
    max-width: 440px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border-radius: 28px;
    padding: 48px 40px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05);
  }
  .auth-icon-premium {
    width: 64px; height: 64px;
    background: linear-gradient(135deg, rgba(20,184,166,0.15), rgba(20,184,166,0.02));
    border: 1px solid rgba(20,184,166,0.25);
    color: var(--student-light);
    border-radius: 20px;
    display: flex; align-items: center; justify-content: center;
    font-size: 2.2rem;
    margin: 0 auto 24px;
    box-shadow: 0 8px 24px rgba(20,184,166,0.15), inset 0 2px 0 rgba(255,255,255,0.1);
  }
  .auth-title {
    font-size: 1.8rem;
    font-weight: 700;
    color: #fff;
    text-align: center;
    margin-bottom: 8px;
    letter-spacing: -0.02em;
  }
  .auth-subtitle {
    font-size: 0.95rem;
    color: var(--text-secondary);
    text-align: center;
    margin-bottom: 32px;
  }
  .premium-input {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    color: #fff;
    font-size: 0.95rem;
    padding: 14px 16px;
    transition: all 0.2s ease;
    width: 100%;
  }
  .premium-input:focus {
    outline: none;
    border-color: var(--student-color);
    background: rgba(20, 184, 166, 0.05);
    box-shadow: 0 0 0 4px rgba(20, 184, 166, 0.1);
  }
  .premium-btn {
    width: 100%;
    padding: 14px;
    border-radius: 12px;
    border: none;
    background: linear-gradient(135deg, var(--accent), var(--accent-dark));
    color: #fff;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s ease;
    margin-top: 10px;
    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.25);
  }
  .premium-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(16, 185, 129, 0.35);
  }
  .premium-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .lang-switcher {
    position: absolute;
    top: 32px;
    right: 32px;
    display: flex;
    gap: 4px;
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    padding: 6px;
    z-index: 50;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  }
  .lang-btn {
    background: transparent;
    color: var(--text-secondary);
    border: none;
    padding: 8px 16px;
    border-radius: 10px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 700;
    transition: all 0.2s ease;
  }
  .lang-btn.active {
    background: var(--student-subtle);
    color: var(--student-light);
    border: 1px solid rgba(20,184,166,0.2);
  }
  .lang-btn:hover:not(.active) {
    background: rgba(255,255,255,0.05);
    color: #fff;
  }
  .back-btn-premium {
    position: absolute; top: 32px; left: 32px;
    display: flex; align-items: center; gap: 8px;
    color: var(--text-secondary); font-size: 0.9rem; font-weight: 600;
    cursor: pointer; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
    padding: 8px 16px; border-radius: 12px; backdrop-filter: blur(10px);
    transition: all 0.2s ease; z-index: 50;
  }
  .back-btn-premium:hover {
    color: #fff; background: rgba(255,255,255,0.08); transform: translateX(-2px);
  }
`;

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

    const storeSession = (user, token = null) => {
      if (token) {
        sessionStorage.setItem('student_token', token);
        if (window.electronAPI) {
          window.electronAPI.invoke('set-auth-token', token);
        }
      }
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
        dateHeureDebut: user.dateHeureDebut || null,
        enonceTexte: user.enonceTexte || null
      }));
      navigate(`/exam/${examCode.trim().toUpperCase()}`);
    };

    if (window.electronAPI) {
      try {
        const response = await window.electronAPI.studentLogin(
          matricule.trim().toUpperCase(),
          examCode.trim().toUpperCase(),
          personalCode.trim().toUpperCase()
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
            password: personalCode.trim().toUpperCase()
          })
        });
        const data = await response.json();
        setLoading(false);
        if (data.success && data.user) {
          storeSession(data.user, data.token);
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
    <>
      <style>{authStyles}</style>
      <div className="auth-wrapper">
        <div className="auth-bg-glow"></div>
        
        <button className="back-btn-premium" onClick={() => navigate('/')}>
          ← {t('back')}
        </button>

        {/* Sélecteur de langue */}
        <div className="lang-switcher">
          <button className={`lang-btn ${lang === 'fr' ? 'active' : ''}`} onClick={() => setLanguage('fr')}>FR</button>
          <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLanguage('en')}>EN</button>
        </div>

        <div className="premium-auth-card animate-fade-up">
          <div className="auth-icon-premium">
            🎓
          </div>
          <h2 className="auth-title">{t('studentTitle')}</h2>
          <p className="auth-subtitle">{t('studentDesc')}</p>

          <form autoComplete="off" onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--student-color)' }}>👤</span> {t('matriculeLabel')}
              </label>
              <input
                id="matricule"
                name="matricule_student_off"
                autoComplete="off"
                className="premium-input"
                type="text"
                placeholder="ex: ETU001"
                value={matricule}
                onChange={e => setMatricule(e.target.value)}
                style={{ textTransform: 'uppercase' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--student-color)' }}>📝</span> {t('examCodeLabel')}
              </label>
              <input
                id="exam-code"
                name="session_code_off"
                autoComplete="off"
                className="premium-input"
                type="text"
                placeholder="ex: X4K9"
                value={examCode}
                onChange={e => setExamCode(e.target.value)}
                style={{ 
                  textTransform: 'uppercase', 
                  fontFamily: "'JetBrains Mono', monospace", 
                  fontSize: '1.1rem', 
                  letterSpacing: '0.15em'
                }}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#e11d48' }}>🔑</span> {t('personalCodeLabel')}
              </label>
              <input
                id="personal-code"
                name="personal_code_off"
                autoComplete="new-password"
                className="premium-input"
                type="password"
                placeholder="••••••••"
                value={personalCode}
                onChange={e => setPersonalCode(e.target.value)}
                style={{ letterSpacing: '0.1em', fontFamily: "'JetBrains Mono', monospace" }}
              />
            </div>

            {error && (
              <div style={{ 
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '10px', padding: '12px', fontSize: '0.85rem', color: '#f87171',
                textAlign: 'center', lineHeight: '1.4'
              }}>
                ⚠️ {error}
              </div>
            )}

            <button id="btn-join-exam" className="premium-btn" type="submit" disabled={loading}>
              {loading ? `⏳ ${t('verifying')}` : `🚀 ${t('launchBtn')}`}
            </button>
          </form>

        </div>
      </div>
    </>
  );
}
