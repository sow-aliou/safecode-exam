import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="gradient-bg landing-page">
      <div className="landing-hero animate-fade-up">
        <div className="landing-logo">🛡️</div>
        <h1>SAFECODE-EXAM</h1>
        <p>Plateforme d'examen sécurisée pour universités — Éditeur de code, modélisation UML et soumission cryptée dans un environnement verrouillé.</p>
      </div>

      <div className="role-cards animate-fade-up">
        <div className="glass-card role-card teacher" onClick={() => navigate('/teacher/auth')}>
          <span className="role-icon">👨‍🏫</span>
          <h2>Enseignant</h2>
          <p>Créez et gérez vos sessions d'examen, rédigez les épreuves et consultez les copies soumises.</p>
          <div className="role-btn">
            Accéder <span>→</span>
          </div>
        </div>

        <div className="glass-card role-card student" onClick={() => navigate('/student/login')}>
          <span className="role-icon">🎓</span>
          <h2>Étudiant</h2>
          <p>Saisissez vos identifiants d'examen pour accéder à votre épreuve dans l'environnement sécurisé.</p>
          <div className="role-btn">
            Rejoindre <span>→</span>
          </div>
        </div>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        © 2025 SAFECODE-EXAM • Université UIDT
      </p>
    </div>
  );
}
