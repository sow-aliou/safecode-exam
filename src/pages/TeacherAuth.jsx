import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function TeacherAuth() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ nom: '', prenom: '', email: '', motDePasse: '', specialite: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.motDePasse) { setError("Champs obligatoires manquants."); return; }
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
        setError(data.error || "Une erreur est survenue lors de l'authentification.");
      }
    } catch (err) {
      setLoading(false);
      setError("Impossible de contacter le serveur central. Assurez-vous que le backend est démarré.");
      console.error(err);
    }
  };

  return (
    <div className="gradient-bg auth-page">
      <button className="back-btn" onClick={() => navigate('/')}>← Retour</button>

      <div className="glass-card auth-card animate-fade-up">
        <div className="auth-header">
          <div className="auth-icon" style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd' }}>
            👨‍🏫
          </div>
          <h2>Espace Enseignant</h2>
          <p>Gérez vos sessions d'examen et vos épreuves</p>
        </div>

        <div className="auth-tabs">
          <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>
            Connexion
          </button>
          <button className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>
            Inscription
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {tab === 'register' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Prénom</label>
                  <input name="prenom" className="form-input" placeholder="Amadou" value={form.prenom} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Nom</label>
                  <input name="nom" className="form-input" placeholder="Diallo" value={form.nom} onChange={handleChange} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Spécialité</label>
                <input name="specialite" className="form-input" placeholder="Génie Logiciel, Réseaux..." value={form.specialite} onChange={handleChange} />
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Email institutionnel</label>
            <input id="teacher-email" name="email" type="email" className="form-input" placeholder="prof@uidt.sn" value={form.email} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label className="form-label">Mot de passe</label>
            <input id="teacher-password" name="motDePasse" type="password" className="form-input" placeholder="••••••••" value={form.motDePasse} onChange={handleChange} />
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius)', padding: '12px', fontSize: '0.875rem', color: '#f87171' }}>
              {error}
            </div>
          )}

          <button id="btn-teacher-auth" className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading}>
            {loading ? '⏳ Chargement...' : tab === 'login' ? '🔐 Se connecter' : '✨ Créer mon compte'}
          </button>
        </form>
      </div>
    </div>
  );
}
