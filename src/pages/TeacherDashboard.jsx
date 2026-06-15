import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Données de démonstration
const DEMO_SESSIONS = [
  {
    id: 1, code: 'XK9-2A4', title: 'Programmation Java – LP3',
    date: '2025-06-20', heureDebut: '08:00', heureFin: '11:00',
    status: 'pending', submissionsCount: 0, totalStudents: 24
  },
  {
    id: 2, code: 'PY7-Z1B', title: 'Bases de Données Avancées',
    date: '2025-06-18', heureDebut: '14:00', heureFin: '16:00',
    status: 'closed', submissionsCount: 22, totalStudents: 25
  }
];

const statusLabels = {
  pending: { label: 'À venir', cls: 'badge-blue' },
  active:  { label: 'En cours', cls: 'badge-green' },
  closed:  { label: 'Terminé', cls: 'badge-yellow' },
};

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const teacherName = sessionStorage.getItem('teacher_name') || 'Enseignant';
  const [sessions, setSessions] = useState(DEMO_SESSIONS);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newSession, setNewSession] = useState({ title: '', date: '', heureDebut: '', heureFin: '' });

  const handleLogout = () => { sessionStorage.clear(); navigate('/'); };

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return [3,3].map(n => Array.from({length:n},()=>chars[Math.floor(Math.random()*chars.length)]).join('')).join('-');
  };

  const handleCreateSession = (e) => {
    e.preventDefault();
    const code = generateCode();
    setSessions(prev => [{
      id: Date.now(), code, ...newSession,
      status: 'pending', submissionsCount: 0, totalStudents: 0
    }, ...prev]);
    setShowNewModal(false);
    setNewSession({ title: '', date: '', heureDebut: '', heureFin: '' });
  };

  const initials = teacherName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);

  return (
    <div className="gradient-bg dashboard">
      {/* Topbar */}
      <header className="topbar">
        <div className="topbar-logo">
          <span>🛡️</span>
          <span>SAFECODE-EXAM</span>
        </div>
        <div className="topbar-user">
          <span>Prof. {teacherName}</span>
          <div className="avatar" style={{ background: 'linear-gradient(135deg, var(--teacher-color), #6d28d9)' }}>
            {initials}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Déconnexion</button>
        </div>
      </header>

      <div className="dashboard-content">
        {/* En-tête */}
        <div className="page-header animate-fade-up">
          <h1>Tableau de bord 👋</h1>
          <p>Bienvenue, Prof. {teacherName} — Gérez vos sessions d'examen</p>
        </div>

        {/* Stats */}
        <div className="stats-grid animate-fade-up">
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--accent-light)' }}>{sessions.length}</div>
            <div className="stat-label">Sessions créées</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--success)' }}>
              {sessions.filter(s => s.status === 'active').length}
            </div>
            <div className="stat-label">Sessions actives</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--warning)' }}>
              {sessions.reduce((a, s) => a + s.submissionsCount, 0)}
            </div>
            <div className="stat-label">Copies reçues</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#f87171' }}>0</div>
            <div className="stat-label">Incidents signalés</div>
          </div>
        </div>

        {/* Sessions */}
        <div className="animate-fade-up">
          <div className="section-header">
            <h2>📋 Sessions d'examen</h2>
            <button id="btn-new-session" className="btn btn-primary btn-sm" onClick={() => setShowNewModal(true)}>
              + Nouvelle session
            </button>
          </div>

          {sessions.length === 0 ? (
            <div className="glass-card empty-state">
              <div className="empty-icon">📋</div>
              <p>Aucune session pour l'instant.<br />Créez votre première session d'examen.</p>
            </div>
          ) : (
            <div className="sessions-list">
              {sessions.map(session => (
                <div key={session.id} className="glass-card session-card">
                  <div className="session-info">
                    <h3>{session.title}</h3>
                    <div className="session-meta">
                      <span>📅 {session.date} &nbsp;·&nbsp; {session.heureDebut} – {session.heureFin}</span>
                      <span>👥 {session.submissionsCount}/{session.totalStudents} copies</span>
                      <div className="exam-code-display" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '2px 10px', marginLeft: 8 }}>
                        <span style={{ fontFamily: 'Fira Code', fontWeight: 700, color: 'var(--accent-light)', letterSpacing: '0.15em', fontSize: '0.85rem' }}>
                          {session.code}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="session-actions">
                    <span className={`badge ${statusLabels[session.status].cls}`}>
                      {statusLabels[session.status].label}
                    </span>
                    <button 
                      className="btn btn-ghost btn-sm"
                      onClick={() => navigate('/teacher/create-exam', { state: { sessionId: session.id, sessionTitle: session.title } })}
                    >
                      ✏️ Épreuve
                    </button>
                    <button className="btn btn-ghost btn-sm">📥 Copies</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal nouvelle session */}
      {showNewModal && (
        <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>📋 Nouvelle Session d'Examen</h2>
            <p>Un code d'accès unique sera généré automatiquement pour les étudiants.</p>
            <form onSubmit={handleCreateSession} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Titre de l'épreuve</label>
                <input className="form-input" placeholder="ex: Programmation Java – LP3" required
                  value={newSession.title} onChange={e => setNewSession({...newSession, title: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" required
                  value={newSession.date} onChange={e => setNewSession({...newSession, date: e.target.value})} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Heure de début</label>
                  <input className="form-input" type="time" required
                    value={newSession.heureDebut} onChange={e => setNewSession({...newSession, heureDebut: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Heure de fin</label>
                  <input className="form-input" type="time" required
                    value={newSession.heureFin} onChange={e => setNewSession({...newSession, heureFin: e.target.value})} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowNewModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">✨ Créer la session</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
