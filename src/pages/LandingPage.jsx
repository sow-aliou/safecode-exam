import { useNavigate } from "react-router-dom";
import { useTranslation } from "../utils/lang";

export default function LandingPage() {
  const navigate = useNavigate();
  const { t, lang, setLanguage } = useTranslation();

  return (
    <div className="gradient-bg landing-page" style={{ position: "relative" }}>
      {/* Sélecteur de langue en haut à droite */}
      <div
        style={{
          position: "absolute",
          top: 24,
          right: 24,
          display: "flex",
          gap: 4,
          background: "rgba(255,255,255,0.04)",
          borderRadius: 10,
          padding: 4,
          border: "1px solid var(--border)",
        }}
      > 
        <button
          onClick={() => setLanguage("fr")}
          style={{
            background: lang === "fr" ? "var(--accent)" : "transparent",
            color: "#fff",
            border: "none",
            padding: "6px 12px",
            borderRadius: 7,
            cursor: "pointer",
            fontSize: "0.8rem",
            fontWeight: 700,
            transition: "background 0.2s",
          }}
        >
          🇫🇷 FR
        </button>
        <button
          onClick={() => setLanguage("en")}
          style={{
            background: lang === "en" ? "var(--accent)" : "transparent",
            color: "#fff",
            border: "none",
            padding: "6px 12px",
            borderRadius: 7,
            cursor: "pointer",
            fontSize: "0.8rem",
            fontWeight: 700,
            transition: "background 0.2s",
          }}
        >
          🇬🇧 EN
        </button>
      </div>

      <div className="landing-hero animate-fade-up">
        <div className="landing-logo">🛡️</div>
        <h1>SAFECODE-EXAM</h1>
        <p>{t("landingTitle")}</p>
        <p
          style={{
            fontSize: "0.9rem",
            color: "var(--text-muted)",
            marginTop: 8,
          }}
        >
          {t("landingDesc")}
        </p>
      </div>

      {/* Feature badges */}
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          justifyContent: "center",
          animation: "fadeUp 0.6s ease forwards",
        }}
      >
        {[
          "🔒 Mode Kiosque",
          "💻 Code Editor",
          "📐 UML",
          "📊 Auto-correction",
          "🌐 Offline/Online",
        ].map((f) => (
          <span
            key={f}
            style={{
              background: "var(--accent-subtle)",
              border: "1px solid rgba(16,185,129,0.2)",
              borderRadius: 20,
              padding: "4px 14px",
              fontSize: "0.78rem",
              color: "var(--accent-light)",
              fontWeight: 500,
            }}
          >
            {f}
          </span>
        ))}
      </div>

      <div className="role-cards animate-fade-up">
        {/* Card Enseignant */}
        <div
          className="glass-card role-card teacher"
          onClick={() => navigate("/teacher/auth")}
        >
          <span className="role-icon">👨‍🏫</span>
          <h2>{t("teacher")}</h2>
          <p>{t("teacherDesc")}</p>
          <div className="role-btn">
            {t("access")} <span>→</span>
          </div>
        </div>

        {/* Card Étudiant */}
        <div
          className="glass-card role-card student"
          onClick={() => navigate("/student/login")}
        >
          <span className="role-icon">🎓</span>
          <h2>{t("student")}</h2>
          <p>{t("studentDesc")}</p>
          <div className="role-btn">
            {t("join")} <span>→</span>
          </div>
        </div>
      </div>

      <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
        © 2025 SAFECODE-EXAM • {t("university")}
      </p>
    </div>
  );
}
