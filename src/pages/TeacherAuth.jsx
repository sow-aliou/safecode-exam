import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../utils/lang';

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
        const teacher = data.teacher || form;
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
      if (tab === 'login' && form.email && form.motDePasse) {
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
    <div className="gradient-bg auth-page">
      <button className="back-btn" onClick={() => navigate('/')}>← {t('back')}</button>

      {/* Sélecteur de langue */}
      <div style={{ position: 'fixed', top: 20, right: 24, display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4, border: '1px solid var(--border)', zIndex: 50 }}>
        <button onClick={() => setLanguage('fr')} style={{ background: lang === 'fr' ? 'var(--accent)' : 'transparent', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 7, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>FR</button>
        <button onClick={() => setLanguage('en')} style={{ background: lang === 'en' ? 'var(--accent)' : 'transparent', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 7, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>EN</button>
      </div>

      <div className="glass-card auth-card animate-fade-up">
        <div className="auth-header">
          <div className="auth-icon" style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd' }}>
            👨‍🏫
          </div>
          <h2>{t('teacherTitle')}</h2>
          <p>{t('teacherDesc')}</p>
        </div>

        <div className="auth-tabs">
          <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>
            {t('loginTab')}
          </button>
          <button className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>
            {t('registerTab')}
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {tab === 'register' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">{t('firstName')}</label>
                  <input name="prenom" className="form-input" placeholder="Amadou" value={form.prenom} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('lastName')}</label>
                  <input name="nom" className="form-input" placeholder="Diallo" value={form.nom} onChange={handleChange} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{t('speciality')}</label>
                <input name="specialite" className="form-input" placeholder="Génie Logiciel, Réseaux..." value={form.specialite} onChange={handleChange} />
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">{t('emailLabel')}</label>
            <input id="teacher-email" name="email" type="email" className="form-input" placeholder="prof@uidt.sn" value={form.email} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label className="form-label">{t('passwordLabel')}</label>
            <input id="teacher-password" name="motDePasse" type="password" className="form-input" placeholder="••••••••" value={form.motDePasse} onChange={handleChange} />
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius)', padding: '12px', fontSize: '0.875rem', color: '#f87171' }}>
              ⚠️ {error}
            </div>
          )}

          <button id="btn-teacher-auth" className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading}>
            {loading ? `⏳ ${t('loading')}` : tab === 'login' ? `🔐 ${t('authSubmitLogin')}` : `✨ ${t('authSubmitRegister')}`}
          </button>
        </form>

        {/* Aide connexion démo */}
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 20, paddingTop: 16, textAlign: 'center' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            💡 {lang === 'fr' ? 'Sans serveur : connectez-vous avec n\'importe quel email/mot de passe.' : 'Without server: login with any email/password (demo mode).'}
          </p>
        </div>
      </div>
    </div>
  );
}
