import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function StudentLogin() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [matricule, setMatricule] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!code.trim() || !matricule.trim()) {
      setError("Veuillez remplir tous les champs.");
      return;
    }
    setLoading(true);
    setError('');
    // Simulation : vérification du code (on redirige pour l'instant)
    setTimeout(() => {
      setLoading(false);
      // Stocker le contexte dans sessionStorage
      sessionStorage.setItem('student_matricule', matricule.toUpperCase());
      sessionStorage.setItem('session_code', code.toUpperCase());
      navigate(`/exam/${code.toUpperCase()}`);
    }, 800);
  };

  return (
    <div className="gradient-bg auth-page">
      <button className="back-btn" onClick={() => navigate('/')}>
        ← Retour
      </button>

      <div className="glass-card auth-card animate-fade-up">
        <div className="auth-header">
          <div className="auth-icon" style={{ background: 'rgba(6,182,212,0.15)', color: '#67e8f9' }}>
            🎓
          </div>
          <h2>Accès Étudiant</h2>
          <p>Saisissez vos identifiants fournis par l'enseignant</p>
        </div>

        <form className="auth-form" onSubmit={handleJoin}>
          <div className="form-group">
            <label className="form-label">Numéro de Matricule</label>
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
            <label className="form-label">Code d'Accès à l'Examen</label>
            <input
              id="exam-code"
              className="form-input"
              type="text"
              placeholder="ex: XK9-2A4"
              value={code}
              onChange={e => setCode(e.target.value)}
              style={{ 
                textTransform: 'uppercase', 
                fontFamily: "'Fira Code', monospace", 
                fontSize: '1.2rem', 
                textAlign: 'center',
                letterSpacing: '0.2em'
              }}
            />
          </div>

          {error && (
            <div style={{ 
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius)', padding: '12px', fontSize: '0.875rem', color: '#f87171'
            }}>
              {error}
            </div>
          )}

          <button id="btn-join-exam" className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading}>
            {loading ? '⏳ Vérification...' : '🚀 Accéder à l\'examen'}
          </button>
        </form>

        <p className="text-center text-muted text-sm mt-4">
          Votre code vous a été communiqué par votre enseignant.
          <br />En cas de problème, contactez le surveillant.
        </p>
      </div>
    </div>
  );
}
