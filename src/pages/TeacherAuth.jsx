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
    background: radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 60%);
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
    background: linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.02));
    border: 1px solid rgba(245,158,11,0.25);
    color: var(--teacher-light);
    border-radius: 20px;
    display: flex; align-items: center; justify-content: center;
    font-size: 2.2rem;
    margin: 0 auto 24px;
    box-shadow: 0 8px 24px rgba(245,158,11,0.15), inset 0 2px 0 rgba(255,255,255,0.1);
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
  .premium-tabs {
    display: flex;
    gap: 6px;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 14px;
    padding: 6px;
    margin-bottom: 32px;
  }
  .premium-tab {
    flex: 1;
    padding: 10px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--text-secondary);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }
  .premium-tab.active {
    background: var(--teacher-subtle);
    color: var(--teacher-light);
    box-shadow: 0 4px 12px rgba(245,158,11,0.15);
    border: 1px solid rgba(245,158,11,0.2);
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
    border-color: var(--teacher-color);
    background: rgba(245, 158, 11, 0.05);
    box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.1);
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
    background: var(--teacher-subtle);
    color: var(--teacher-light);
    border: 1px solid rgba(245,158,11,0.2);
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

export default function TeacherAuth() {
  const navigate = useNavigate();
  const { t, lang, setLanguage } = useTranslation();
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ nom: '', prenom: '', email: '', motDePasse: '', specialite: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.motDePasse) { setError(t('fieldsRequired')); return; }
    setLoading(true); setError('');
    
    const endpoint = tab === 'login' ? '/api/teacher/login' : '/api/teacher/register';
    try {
      const response = await fetch(`http://localhost:3000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      setLoading(false);
      if (data.success) {
        const teacher = data.teacher || {};
        sessionStorage.setItem('teacher_token', data.token);
        if (window.electronAPI) {
          window.electronAPI.invoke('set-auth-token', data.token);
        }
        sessionStorage.setItem('teacher_email', teacher.email);
        sessionStorage.setItem('teacher_name', `${teacher.prenom || ''} ${teacher.nom || ''}`.trim() || 'Enseignant');
        sessionStorage.setItem('teacher_id', teacher.id || data.teacherId);
        navigate('/teacher/dashboard');
      } else {
        setError(data.error || t('authErrorMsg'));
      }
    } catch (err) {
      setLoading(false);
      // Mode démo : accès direct sans serveur
      if (tab === 'login') {
        // En mode démo on force un mock (mais on ne devrait plus être en mock avec le backend)
        sessionStorage.setItem('teacher_token', 'mock_token');
        sessionStorage.setItem('teacher_email', form.email);
        sessionStorage.setItem('teacher_name', form.prenom ? `${form.prenom} ${form.nom}` : form.email.split('@')[0]);
        sessionStorage.setItem('teacher_id', '1');
        navigate('/teacher/dashboard');
      } else {
        setError(lang === 'fr' 
          ? "Serveur hors-ligne. Connectez-vous en mode démo : utilisez n'importe quel email/mot de passe."
          : "Server offline. Login in demo mode: use any email/password.");
      }
      console.error(err);
    }
  };

  return (
    <>
      <style>{authStyles}</style>
      <div className="auth-wrapper">
        <div className="auth-bg-glow"></div>
        
        <button className="back-btn-premium" onClick={() => navigate('/')}>← {t('back')}</button>

        <div className="lang-switcher">
          <button className={`lang-btn ${lang === 'fr' ? 'active' : ''}`} onClick={() => setLanguage('fr')}>FR</button>
          <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLanguage('en')}>EN</button>
        </div>

        <div className="premium-auth-card animate-fade-up">
          <div className="auth-icon-premium">👨‍🏫</div>
          <h2 className="auth-title">{t('teacherTitle')}</h2>
          <p className="auth-subtitle">{t('teacherDesc')}</p>

          <div className="premium-tabs">
            <button className={`premium-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>
              {t('loginTab')}
            </button>
            <button className={`premium-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>
              {t('registerTab')}
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {tab === 'register' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">{t('firstName')}</label>
                    <input name="prenom" className="premium-input" placeholder="Amadou" value={form.prenom} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('lastName')}</label>
                    <input name="nom" className="premium-input" placeholder="Diallo" value={form.nom} onChange={handleChange} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('speciality')}</label>
                  <input name="specialite" className="premium-input" placeholder="Génie Logiciel, Réseaux..." value={form.specialite} onChange={handleChange} />
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">{t('emailLabel')}</label>
              <input type="email" name="email" className="premium-input" placeholder="prof@uidt.sn" value={form.email} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label className="form-label">{t('passwordLabel')}</label>
              <input type="password" name="motDePasse" className="premium-input" placeholder="••••••••" value={form.motDePasse} onChange={handleChange} />
            </div>

            {error && (
              <div style={{ padding: '12px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '10px', color: '#fb7185', fontSize: '0.85rem', textAlign: 'center' }}>
                {error}
              </div>
            )}

            <button type="submit" className="premium-btn" disabled={loading}>
              {loading ? (lang === 'fr' ? 'Chargement...' : 'Loading...') : tab === 'login' ? `🔐 ${t('authSubmitLogin')}` : `✨ ${t('authSubmitRegister')}`}
            </button>
          </form>

        </div>
      </div>
    </>
  );
}
