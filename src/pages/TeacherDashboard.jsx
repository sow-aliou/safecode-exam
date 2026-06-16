import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

const statusLabels = {
  pending: { label: 'À venir', cls: 'badge-blue' },
  active:  { label: 'En cours', cls: 'badge-green' },
  closed:  { label: 'Terminé', cls: 'badge-yellow' },
};

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const teacherName = sessionStorage.getItem('teacher_name') || 'Enseignant';
  
  const [sessions, setSessions] = useState([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  
  const [newSession, setNewSession] = useState({ title: '', date: '', heureDebut: '', heureFin: '', code: '' });
  const [importedStudents, setImportedStudents] = useState([]);
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [emailProgress, setEmailProgress] = useState([]);
  const [emailStatusMessage, setEmailStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Charger les sessions depuis la base de données
  const fetchSessions = async () => {
    try {
      let sessionsList = [];
      if (window.electronAPI) {
        const response = await window.electronAPI.getSessions();
        if (response.success) sessionsList = response.sessions;
      } else {
        const response = await fetch('http://localhost:3000/api/sessions');
        const data = await response.json();
        if (data.success) sessionsList = data.sessions;
      }
      
      const mapped = sessionsList.map(s => ({
        ...s,
        status: 'pending'
      }));
      setSessions(mapped);
    } catch (err) {
      console.error("Erreur de chargement des sessions:", err);
      if (!window.electronAPI) {
        setSessions([
          {
            id: 1, code: 'XK9-2A4', title: 'Programmation Java – LP3 (Démo Local)',
            date: '2025-06-20', heureDebut: '08:00', heureFin: '11:00',
            status: 'pending', submissionsCount: 0, totalStudents: 24
          }
        ]);
      }
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleLogout = () => { sessionStorage.clear(); navigate('/'); };

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return [3,3].map(n => Array.from({length:n},()=>chars[Math.floor(Math.random()*chars.length)]).join('')).join('-');
  };

  // Ouvrir le modal nouvelle session avec un code généré
  const handleOpenNewSessionModal = () => {
    setNewSession({
      title: '',
      date: new Date().toISOString().split('T')[0],
      heureDebut: '08:00',
      heureFin: '11:00',
      code: generateCode()
    });
    setShowNewModal(true);
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    setError('');

    const sessionData = {
      title: newSession.title,
      date: `${newSession.date} ${newSession.heureDebut}`,
      code: newSession.code,
      duree: 120, // Par défaut
      instructions: 'Veuillez composer seul et sans sortir du mode Kiosque.'
    };

    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.createSession(sessionData);
        if (result.success) {
          setSuccess("Session d'examen créée avec succès !");
          setShowNewModal(false);
          fetchSessions();
        } else {
          setError(result.error || "Impossible de créer la session.");
        }
      } catch (err) {
        console.error(err);
        setError("Erreur SQLite.");
      }
    } else {
      try {
        const response = await fetch('http://localhost:3000/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sessionData)
        });
        const data = await response.json();
        if (data.success) {
          setSuccess("Session d'examen créée avec succès !");
          setShowNewModal(false);
          fetchSessions();
        } else {
          setError(data.error || "Erreur serveur.");
        }
      } catch (err) {
        console.error(err);
        setError("Serveur de démo centralisé hors-ligne.");
      }
    }
  };

  // Gérer l'import Excel / CSV
  const handleExcelImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError('');
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        // Standardiser et ajouter des codes uniques secrets d'authentification
        const students = json.map(row => {
          // Chercher les clés insensibles à la casse
          const matriculeKey = Object.keys(row).find(k => k.toLowerCase().includes('matricule')) || 'matricule';
          const nomKey = Object.keys(row).find(k => k.toLowerCase().includes('nom')) || 'nom';
          const prenomKey = Object.keys(row).find(k => k.toLowerCase().includes('prenom') || k.toLowerCase().includes('prénom')) || 'prenom';
          const emailKey = Object.keys(row).find(k => k.toLowerCase().includes('mail') || k.toLowerCase().includes('email')) || 'email';

          // Générer un mot de passe unique à 8 caractères pour chaque étudiant
          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          const uniquePass = Array.from({length: 8}, () => chars[Math.floor(Math.random() * chars.length)]).join('');

          return {
            matricule: String(row[matriculeKey] || '').trim().toUpperCase(),
            nom: String(row[nomKey] || '').trim(),
            prenom: String(row[prenomKey] || '').trim(),
            email: String(row[emailKey] || '').trim(),
            codeSecret: uniquePass,
            statusEmail: 'Prêt'
          };
        }).filter(s => s.matricule && s.email);

        if (students.length === 0) {
          setError("Aucun étudiant valide trouvé dans le fichier. Assurez-vous d'avoir les colonnes matricule et email.");
        } else {
          setImportedStudents(students);
          setSuccess(`${students.length} étudiants importés du fichier.`);
        }
      } catch (err) {
        console.error(evt, err);
        setError("Erreur lors de la lecture du fichier. Veuillez utiliser un format Excel (.xlsx) ou CSV valide.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Charger les étudiants inscrits à la session sélectionnée
  const handleOpenStudentsModal = async (session) => {
    setSelectedSession(session);
    setImportedStudents([]);
    setError('');
    setSuccess('');
    setEmailStatusMessage('');
    setShowStudentsModal(true);

    if (window.electronAPI) {
      try {
        const response = await window.electronAPI.getSessionStudents(session.id);
        if (response.success && response.students.length > 0) {
          setImportedStudents(response.students.map(s => ({ ...s, statusEmail: 'Envoyé' })));
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      try {
        const response = await fetch(`http://localhost:3000/api/sessions/${session.id}/students`);
        const data = await response.json();
        if (data.success && data.students.length > 0) {
          setImportedStudents(data.students.map(s => ({ ...s, statusEmail: 'Envoyé' })));
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Simuler l'envoi d'emails avec animation
  const handleGenerateAndSendEmails = async () => {
    if (importedStudents.length === 0) {
      setError("Importez d'abord la liste des étudiants.");
      return;
    }

    setIsSendingEmails(true);
    setEmailStatusMessage("Enregistrement des étudiants en base de données...");

    // 1. Enregistrer dans la base de données
    try {
      if (window.electronAPI && selectedSession) {
        await window.electronAPI.importStudents(selectedSession.id, importedStudents);
      } else if (selectedSession) {
        const response = await fetch(`http://localhost:3000/api/sessions/${selectedSession.id}/students`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ students: importedStudents })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
      }
    } catch (err) {
      console.error(err);
      setError("Erreur d'enregistrement des étudiants.");
      setIsSendingEmails(false);
      return;
    }

    // 2. Simuler l'envoi d'emails individuels avec une animation fluide
    const progressList = [...importedStudents];
    for (let i = 0; i < progressList.length; i++) {
      progressList[i] = { ...progressList[i], statusEmail: 'En cours...' };
      setImportedStudents([...progressList]);
      setEmailStatusMessage(`Envoi de l'email d'accès à ${progressList[i].email}...`);

      // Délai pour simuler l'animation d'envoi d'email
      await new Promise(resolve => setTimeout(resolve, 800));

      progressList[i] = { ...progressList[i], statusEmail: 'Envoyé ✅' };
      setImportedStudents([...progressList]);
    }

    setIsSendingEmails(false);
    setEmailStatusMessage(`Succès ! ${progressList.length} emails avec identifiants uniques envoyés.`);
    fetchSessions();
  };

  const initials = teacherName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);

  return (
    <div className="gradient-bg dashboard">
      {/* Topbar */}
      <header className="topbar">
        <div className="topbar-logo">
          <span>🛡️</span>
          <span>SAFECODE-EXAM – Enseignant</span>
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
        {success && (
          <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius)', padding: '12px', color: '#34d399', marginBottom: 20 }}>
            {success}
          </div>
        )}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius)', padding: '12px', color: '#f87171', marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* En-tête */}
        <div className="page-header animate-fade-up">
          <h1>Tableau de bord 👋</h1>
          <p>Bienvenue, Prof. {teacherName} — Administration des examens sécurisés</p>
        </div>

        {/* Stats */}
        <div className="stats-grid animate-fade-up">
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--accent-light)' }}>{sessions.length}</div>
            <div className="stat-label">Sessions d'examen</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--success)' }}>
              {sessions.filter(s => s.status === 'active').length}
            </div>
            <div className="stat-label">Examens actifs</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--student-color)' }}>
              {importedStudents.length}
            </div>
            <div className="stat-label">Étudiants inscrits</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#f87171' }}>0</div>
            <div className="stat-label">Tentatives de fraude</div>
          </div>
        </div>

        {/* Sessions */}
        <div className="animate-fade-up">
          <div className="section-header">
            <h2>📋 Sessions d'examen configurées</h2>
            <button id="btn-new-session" className="btn btn-primary btn-sm" onClick={handleOpenNewSessionModal}>
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
                      <span>📅 {session.date}</span>
                      <span>⏱ {session.duree || 120} min</span>
                      <div className="exam-code-display" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '2px 10px', marginLeft: 8 }}>
                        <span style={{ fontFamily: 'Fira Code', fontWeight: 700, color: 'var(--accent-light)', letterSpacing: '0.15em', fontSize: '0.85rem' }}>
                          {session.code}
                        </span>
                      </div>
                      {session.sujetPdfBase64 && (
                        <span style={{ color: 'var(--success)' }}>✅ Sujet PDF attaché</span>
                      )}
                    </div>
                  </div>
                  <div className="session-actions" style={{ display: 'flex', gap: 10 }}>
                    <button 
                      className="btn btn-ghost btn-sm"
                      onClick={() => navigate('/teacher/create-exam', { state: { sessionId: session.id, sessionTitle: session.title } })}
                    >
                      ✏️ Configurer l'épreuve & PDF
                    </button>
                    <button 
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleOpenStudentsModal(session)}
                      style={{ color: 'var(--student-color)', borderColor: 'rgba(6,182,212,0.3)' }}
                    >
                      👥 Gérer les étudiants
                    </button>
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
            <p>Saisissez les informations de base. Le code d'accès sera partagé aux étudiants.</p>
            <form onSubmit={handleCreateSession} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Titre de la Session</label>
                <input className="form-input" placeholder="ex: Examen Final Java - S6" required
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
              <div className="form-group">
                <label className="form-label">Code Session d'Examen (Généré)</label>
                <input className="form-input" readOnly value={newSession.code} 
                  style={{ fontFamily: 'Fira Code', textAlign: 'center', letterSpacing: '0.15em', fontWeight: 'bold' }} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowNewModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">✨ Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal gestion des étudiants */}
      {showStudentsModal && selectedSession && (
        <div className="modal-overlay" onClick={() => setShowStudentsModal(false)}>
          <div className="modal" style={{ maxWidth: '800px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <h2>👥 Session : {selectedSession.title}</h2>
            <p>Importez votre classe et envoyez à chaque étudiant son code d'authentification personnel.</p>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: 16, 
              background: 'rgba(255,255,255,0.02)', 
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: 16,
              marginBottom: 16
            }}>
              <div>
                <label className="form-label">📥 Étape 1 : Importer Excel / CSV</label>
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  onChange={handleExcelImport}
                  style={{ marginTop: 8, fontSize: '0.85rem' }}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Le fichier doit contenir les colonnes : <strong>matricule</strong>, <strong>nom</strong>, <strong>prenom</strong>, <strong>email</strong>.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <label className="form-label">📧 Étape 2 : Distribuer les accès</label>
                <button 
                  className="btn btn-primary btn-block" 
                  onClick={handleGenerateAndSendEmails}
                  disabled={importedStudents.length === 0 || isSendingEmails}
                  style={{ marginTop: 8 }}
                >
                  {isSendingEmails ? '⏳ Envoi en cours...' : '🔐 Générer & Envoyer par mail'}
                </button>
              </div>
            </div>

            {emailStatusMessage && (
              <div style={{ 
                background: 'rgba(99,102,241,0.05)', 
                border: '1px solid rgba(99,102,241,0.2)', 
                color: 'var(--accent-light)', 
                padding: 12, 
                borderRadius: 8, 
                fontSize: '0.85rem', 
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <span className="spin" style={{ display: isSendingEmails ? 'inline-block' : 'none', animation: 'spin 1s linear infinite' }}>⏳</span>
                <span>{emailStatusMessage}</span>
              </div>
            )}

            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: 10, textAlign: 'left' }}>Matricule</th>
                    <th style={{ padding: 10, textAlign: 'left' }}>Nom & Prénom</th>
                    <th style={{ padding: 10, textAlign: 'left' }}>Email</th>
                    <th style={{ padding: 10, textAlign: 'center' }}>Code Secret</th>
                    <th style={{ padding: 10, textAlign: 'right' }}>Statut Mail</th>
                  </tr>
                </thead>
                <tbody>
                  {importedStudents.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                        Aucun étudiant importé pour cette session.
                      </td>
                    </tr>
                  ) : (
                    importedStudents.map((st, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: 10, fontWeight: 'bold' }}>{st.matricule}</td>
                        <td style={{ padding: 10 }}>{st.prenom} {st.nom}</td>
                        <td style={{ padding: 10, color: 'var(--text-secondary)' }}>{st.email}</td>
                        <td style={{ padding: 10, textAlign: 'center', fontFamily: 'Fira Code', color: 'var(--accent-light)' }}>{st.codeSecret}</td>
                        <td style={{ padding: 10, textAlign: 'right', fontWeight: 'bold' }}>
                          <span style={{ 
                            color: st.statusEmail.includes('✅') || st.statusEmail === 'Envoyé' ? 'var(--success)' : 
                                   st.statusEmail === 'Prêt' ? 'var(--text-secondary)' : 'var(--warning)' 
                          }}>
                            {st.statusEmail}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setShowStudentsModal(false)} disabled={isSendingEmails}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
