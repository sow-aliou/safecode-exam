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
  .premium-cards-container {
    display: flex;
    gap: 24px;
    justify-content: center;
    flex-wrap: wrap;
    width: 100%;
    max-width: 900px;
  }
  .premium-card {
    flex: 1;
    min-width: 320px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 32px;
    padding: 40px;
    text-align: left;
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    position: relative;
    overflow: hidden;
    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
  }
  .premium-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    border-radius: inherit;
    padding: 1.5px;
    background: linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0));
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
    transition: all 0.4s ease;
  }
  .premium-card:hover {
    transform: translateY(-8px) scale(1.02);
    background: rgba(255, 255, 255, 0.04);
  }
  .premium-card.teacher:hover::before {
    background: linear-gradient(135deg, var(--teacher-light), transparent);
  }
  .premium-card.student:hover::before {
    background: linear-gradient(135deg, var(--student-light), transparent);
  }
  .premium-card.teacher:hover {
    box-shadow: 0 20px 50px rgba(245, 158, 11, 0.12), 0 0 0 1px rgba(245, 158, 11, 0.2);
  }
  .premium-card.student:hover {
    box-shadow: 0 20px 50px rgba(20, 184, 166, 0.12), 0 0 0 1px rgba(20, 184, 166, 0.2);
  }
  .premium-card-icon-wrapper {
    width: 64px;
    height: 64px;
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.2rem;
    margin-bottom: 24px;
    position: relative;
    box-shadow: inset 0 2px 0 rgba(255,255,255,0.1);
  }
  .premium-card.teacher .premium-card-icon-wrapper {
    background: linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.02));
    border: 1px solid rgba(245,158,11,0.25);
    color: var(--teacher-light);
  }
  .premium-card.student .premium-card-icon-wrapper {
    background: linear-gradient(135deg, rgba(20,184,166,0.15), rgba(20,184,166,0.02));
    border: 1px solid rgba(20,184,166,0.25);
    color: var(--student-light);
  }
  .premium-card h2 {
    font-size: 1.8rem;
    font-weight: 700;
    color: #fff;
    margin-bottom: 12px;
    letter-spacing: -0.02em;
  }
  .premium-card p {
    font-size: 1rem;
    color: var(--text-secondary);
    line-height: 1.6;
    margin-bottom: 32px;
  }
  .premium-card-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 1rem;
    transition: all 0.3s ease;
  }
  .premium-card.teacher .premium-card-btn { color: var(--teacher-light); }
  .premium-card.student .premium-card-btn { color: var(--student-light); }
  .premium-card:hover .premium-card-btn { gap: 14px; }
  
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
    background: var(--accent);
    color: #fff;
    box-shadow: 0 4px 12px rgba(16,185,129,0.3);
  }
  .lang-btn:hover:not(.active) {
    background: rgba(255,255,255,0.05);
    color: #fff;
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

        {/* Sélecteur de langue */}
        <div className="lang-switcher animate-fade-up">
          <button
            className={`lang-btn ${lang === "fr" ? "active" : ""}`}
            onClick={() => setLanguage("fr")}
          >
            🇫🇷 FR
          </button>
          <button
            className={`lang-btn ${lang === "en" ? "active" : ""}`}
            onClick={() => setLanguage("en")}
          >
            🇬🇧 EN
          </button>
        </div>

        <div className="landing-content">
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
              { icon: "🔒", text: "Mode Kiosque" },
              { icon: "💻", text: "Éditeur de Code" },
              { icon: "📐", text: "UML" },
              { icon: "📊", text: "Auto-correction" },
              { icon: "🌐", text: "Offline/Online" },
            ].map((f) => (
              <span key={f.text} className="premium-badge">
                <span style={{ fontSize: "1.1rem" }}>{f.icon}</span>
                {f.text}
              </span>
            ))}
          </div>

          <div className="premium-cards-container animate-fade-up" style={{ animationDelay: "0.4s", marginTop: "40px" }}>
            {/* Card Enseignant */}
            <div
              className="premium-card teacher"
              onClick={() => navigate("/teacher/auth")}
            >
              <div className="premium-card-icon-wrapper">👨‍🏫</div>
              <h2>{t("teacher")}</h2>
              <p>{t("teacherDesc")}</p>
              <div className="premium-card-btn">
                {t("access")} <span>→</span>
              </div>
            </div>

            {/* Card Étudiant */}
            <div
              className="premium-card student"
              onClick={() => navigate("/student/login")}
            >
              <div className="premium-card-icon-wrapper">🎓</div>
              <h2>{t("student")}</h2>
              <p>{t("studentDesc")}</p>
              <div className="premium-card-btn">
                {t("join")} <span>→</span>
              </div>
            </div>
          </div>

          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.85rem", marginTop: "80px", fontWeight: 500 }} className="animate-fade-up" style={{ animationDelay: "0.6s", marginTop: "80px" }}>
            © {new Date().getFullYear()} SAFECODE-EXAM • {t("university")}
          </p>
        </div>
      </div>
    </>
  );
}

