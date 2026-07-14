import { useNavigate } from "react-router-dom";
import { useTranslation } from "../utils/lang";

const loginStyles = `
  .login-wrapper {
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
  .login-bg-glow {
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
  }
  .login-content {
    position: relative;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 900px;
  }
  .login-title {
    font-size: clamp(2rem, 4vw, 3rem);
    font-weight: 800;
    color: #fff;
    margin-bottom: 40px;
    text-align: center;
  }
  .premium-cards-container {
    display: flex;
    gap: 24px;
    justify-content: center;
    flex-wrap: wrap;
    width: 100%;
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
  
  .back-button {
    position: absolute;
    top: 30px;
    left: 30px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #fff;
    padding: 10px 20px;
    border-radius: 20px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.3s ease;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .back-button:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: translateX(-5px);
  }
`;

export default function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <>
      <style>{loginStyles}</style>
      <div className="login-wrapper">
        <div className="login-bg-glow"></div>
        
        <button className="back-button animate-fade-in" onClick={() => navigate("/")}>
          <span>←</span> {t("back", "Retour")}
        </button>

        <div className="login-content animate-fade-up">
          <h1 className="login-title">{t("chooseSpace", "Choisissez votre espace")}</h1>
          
          <div className="premium-cards-container">
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
        </div>
      </div>
    </>
  );
}
