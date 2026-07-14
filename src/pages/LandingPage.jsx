import { useNavigate } from "react-router-dom";
import { useTranslation } from "../utils/lang";

const landingStyles = `
  @keyframes float-slow {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-15px) rotate(2deg); }
  }
  @keyframes float-slower {
    0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
    50% { transform: translateY(15px) rotate(-2deg) scale(1.05); }
  }
  .landing-wrapper {
    min-height: 100vh;
    width: 100%;
    position: relative;
    overflow: hidden;
    background: #050807; /* Très sombre, légèrement teinté émeraude */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .landing-bg-glow {
    position: absolute;
    width: 70vw;
    height: 70vw;
    max-width: 800px;
    max-height: 800px;
    background: radial-gradient(circle, rgba(16,185,129,0.12) 0%, rgba(20,184,166,0.03) 40%, transparent 70%);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 0;
    pointer-events: none;
    animation: pulse-dot 8s ease-in-out infinite alternate;
  }
  .landing-bg-orb1 {
    position: absolute; width: 450px; height: 450px; top: -100px; left: -100px;
    background: radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%);
    border-radius: 50%; filter: blur(50px); animation: float-slow 12s ease-in-out infinite; z-index: 0;
    pointer-events: none;
  }
  .landing-bg-orb2 {
    position: absolute; width: 550px; height: 550px; bottom: -150px; right: -150px;
    background: radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 70%);
    border-radius: 50%; filter: blur(60px); animation: float-slower 15s ease-in-out infinite; z-index: 0;
    pointer-events: none;
  }
  .landing-content {
    position: relative;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 1100px;
    padding: 60px 20px;
  }
  .landing-logo-premium {
    width: 88px; height: 88px;
    background: linear-gradient(135deg, var(--accent), var(--accent-dark));
    border-radius: 28px;
    display: flex; align-items: center; justify-content: center;
    font-size: 2.6rem;
    margin-bottom: 32px;
    box-shadow: 0 0 0 1px rgba(16,185,129,0.3), 0 24px 48px var(--accent-glow), inset 0 2px 0 rgba(255,255,255,0.2);
    animation: float 4s ease-in-out infinite;
  }
  .premium-badge-container {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
    margin-bottom: 24px;
    animation: fadeUp 0.6s ease forwards;
  }
  .premium-badge {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: 40px;
    padding: 8px 18px;
    font-size: 0.85rem;
    font-weight: 500;
    color: #e2e8f0;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s ease;
  }
  .premium-badge:hover {
    transform: translateY(-2px);
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.2);
    color: #fff;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  }
  .premium-title {
    font-size: clamp(3.5rem, 7vw, 5.5rem);
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1.05;
    text-align: center;
    margin: 0 0 20px;
    background: linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.7) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 4px 24px rgba(0,0,0,0.5));
  }
  .premium-subtitle {
    font-size: clamp(1.1rem, 2vw, 1.25rem);
    color: var(--text-secondary);
    text-align: center;
    max-width: 650px;
    line-height: 1.6;
    margin-bottom: 64px;
  }
  .landing-header {
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 80px;
    padding: 0 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 100;
    background: rgba(5, 8, 7, 0.7);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  .header-logo {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 1.5rem;
    font-weight: 800;
    color: #fff;
    text-decoration: none;
  }
  .header-logo-icon {
    width: 40px; height: 40px;
    background: linear-gradient(135deg, var(--accent), var(--accent-dark));
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.2rem;
    box-shadow: 0 0 0 1px rgba(16,185,129,0.3), 0 8px 16px rgba(16,185,129,0.2);
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  
  .lang-switcher {
    display: flex;
    gap: 4px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    padding: 6px;
  }
  .lang-btn {
    background: transparent;
    color: var(--text-secondary);
    border: none;
    padding: 6px 12px;
    border-radius: 10px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 700;
    transition: all 0.2s ease;
  }
  .lang-btn.active {
    background: var(--accent);
    color: #fff;
    box-shadow: 0 4px 12px rgba(16,185,129,0.3);
  }
  .lang-btn:hover:not(.active) {
    background: rgba(255,255,255,0.05);
    color: #fff;
  }
  
  .login-button {
    background: #fff;
    color: #050807;
    border: none;
    padding: 12px 24px;
    border-radius: 14px;
    font-weight: 700;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .login-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(255,255,255,0.2);
  }
  
  .landing-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding-top: 80px;
  }
  .hero-cta {
    margin-top: 40px;
    background: linear-gradient(135deg, var(--accent), var(--accent-dark));
    color: white;
    border: none;
    padding: 16px 40px;
    border-radius: 20px;
    font-size: 1.2rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 0 0 1px rgba(16,185,129,0.3), 0 12px 30px var(--accent-glow);
    transition: all 0.3s ease;
    animation: fadeUp 0.6s ease forwards;
    animation-delay: 0.5s;
    opacity: 0;
  }
  .hero-cta:hover {
    transform: translateY(-4px) scale(1.02);
    box-shadow: 0 0 0 1px rgba(16,185,129,0.5), 0 20px 40px var(--accent-glow);
  }
`;

export default function LandingPage() {
  const navigate = useNavigate();
  const { t, lang, setLanguage } = useTranslation();

  return (
    <>
      <style>{landingStyles}</style>
      <div className="landing-wrapper">
        {/* Background Animations */}
        <div className="landing-bg-orb1"></div>
        <div className="landing-bg-orb2"></div>
        <div className="landing-bg-glow"></div>

        <header className="landing-header">
          <div className="header-logo">
            <div className="header-logo-icon">🛡️</div>
            SafeCode-Exam
          </div>
          <div className="header-actions">
            {/* Sélecteur de langue */}
            <div className="lang-switcher">
              <button
                className={`lang-btn ${lang === "fr" ? "active" : ""}`}
                onClick={() => setLanguage("fr")}
              >
                FR
              </button>
              <button
                className={`lang-btn ${lang === "en" ? "active" : ""}`}
                onClick={() => setLanguage("en")}
              >
                EN
              </button>
            </div>
            {/* Bouton de connexion */}
            <button className="login-button" onClick={() => navigate("/login")}>
              {t("back", "Se connecter")} <span>→</span>
            </button>
          </div>
        </header>

        <div className="landing-content landing-hero">
          <div className="landing-logo-premium animate-fade-up">🛡️</div>
          
          <h1 className="premium-title animate-fade-up" style={{ animationDelay: "0.1s" }}>
            SAFECODE-EXAM
          </h1>
          
          <p className="premium-subtitle animate-fade-up" style={{ animationDelay: "0.2s" }}>
            {t("landingTitle")}. {t("landingDesc")}
          </p>

          {/* Feature badges */}
          <div className="premium-badge-container" style={{ animationDelay: "0.3s" }}>
            {[
              { icon: "🔒", text: "Environnement Sécurisé" },
              { icon: "💻", text: "Éditeur de Code en direct" },
              { icon: "📐", text: "Génération d'UML" },
              { icon: "📊", text: "Tableau de Bord Professeur" },
              { icon: "🚀", text: "Performance Maximale" },
            ].map((f) => (
              <span key={f.text} className="premium-badge">
                <span style={{ fontSize: "1.1rem" }}>{f.icon}</span>
                {f.text}
              </span>
            ))}
          </div>

          <button className="hero-cta" onClick={() => navigate("/login")}>
            Commencer maintenant
          </button>

          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.85rem", fontWeight: 500 }} className="animate-fade-up" style={{ animationDelay: "0.6s", marginTop: "80px" }}>
            © {new Date().getFullYear()} SAFECODE-EXAM • {t("university")}
          </p>
        </div>
      </div>
    </>
  );
}

