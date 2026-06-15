import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function StudentLogin() {
  const navigate = useNavigate();
  const [examCode, setExamCode] = useState('');
  const [matricule, setMatricule] = useState('');
  const [personalCode, setPersonalCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!examCode.trim() || !matricule.trim() || !personalCode.trim()) {
      setError("Veuillez remplir tous les champs.");
      return;
    }
    setLoading(true);
    setError('');

    if (window.electronAPI) {
      try {
        const response = await window.electronAPI.studentLogin(
          matricule.trim().toUpperCase(),
          examCode.trim().toUpperCase(),
          personalCode.trim()
        );
        setLoading(false);
        if (response.success && response.user) {
          const user = response.user;
          sessionStorage.setItem('student_matricule', user.matricule);
          sessionStorage.setItem('student_name', `${user.prenom} ${user.nom}`);
          sessionStorage.setItem('session_code', examCode.trim().toUpperCase());
          sessionStorage.setItem('copie_id', user.copieId);
          sessionStorage.setItem('exam_data', JSON.stringify({
            titre: user.titre,
            dureeMinutes: user.dureeMinutes,
            instructions: user.instructions,
            langageCible: user.langageCible,
            sujetPdfBase64: user.sujetPdfBase64
          }));
          navigate(`/exam/${examCode.trim().toUpperCase()}`);
        } else {
          setError("Identifiants incorrects ou session introuvable.");
        }
      } catch (err) {
        setLoading(false);
        setError("Erreur lors de la connexion à la base de données.");
        console.error(err);
      }
    } else {
      // Simulation pour le navigateur web
      setTimeout(() => {
        setLoading(false);
        if (matricule.toUpperCase() === 'DEV_001' && examCode === '1234' && personalCode === 'PASS123') {
          sessionStorage.setItem('student_matricule', 'DEV_001');
          sessionStorage.setItem('student_name', 'Etudiant Test');
          sessionStorage.setItem('session_code', '1234');
          sessionStorage.setItem('copie_id', '1');
          navigate(`/exam/1234`);
        } else {
          setError("Identifiants de test : Matricule: DEV_001, Session: 1234, Code: PASS123");
        }
      }, 800);
    }
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
          <h2>Accès Sécurisé Étudiant</h2>
          <p>Entrez vos identifiants uniques reçus par email</p>
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
            <label className="form-label">Code de la Session d'Examen</label>
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
            <label className="form-label">Code d'Accès Personnel (Email)</label>
            <input
              id="personal-code"
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={personalCode}
              onChange={e => setPersonalCode(e.target.value)}
              style={{ 
                textAlign: 'center',
                letterSpacing: '0.1em'
              }}
            />
          </div>

          {error && (
            <div style={{ 
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius)', padding: '12px', fontSize: '0.875rem', color: '#f87171',
              textAlign: 'center', lineHeight: '1.4'
            }}>
              {error}
            </div>
          )}

          <button id="btn-join-exam" className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading}>
            {loading ? '⏳ Vérification...' : '🚀 Lancer l\'Examen'}
          </button>
        </form>

        <p className="text-center text-muted text-sm mt-4">
          Vos accès individuels ont été envoyés sur votre email universitaire.
          <br />En cas d'absence d'email, contactez votre enseignant.
        </p>
      </div>
    </div>
  );
}
