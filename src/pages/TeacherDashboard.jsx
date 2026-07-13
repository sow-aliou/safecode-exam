import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useTranslation } from '../utils/lang';
import UMLEditor from '../components/UMLEditor';

// Calcule le statut d'une session à partir de sa date + durée
function computeStatus(dateStr, dureeMinutes) {
  if (!dateStr) return 'pending';
  const start = new Date(dateStr);
  const end = new Date(start.getTime() + (dureeMinutes || 120) * 60000);
  const now = new Date();
  if (now < start) return 'pending';
  if (now >= start && now <= end) return 'active';
  return 'closed';
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { t, lang, setLanguage } = useTranslation();
  const teacherName = sessionStorage.getItem('teacher_name') || 'Enseignant';

  // Navigation tab state
  const [activeTab, setActiveTab] = useState('sessions'); // 'sessions' | 'results'

  // Sessions Tab States
  const [sessions, setSessions] = useState([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  
  const [newSession, setNewSession] = useState({ title: '', date: '', heureDebut: '', duree: 120, code: '' });
  const [importedStudents, setImportedStudents] = useState([]);
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [emailStatusMessage, setEmailStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const showSuccessMessage = (msg) => {
    setSuccess(msg);
    setTimeout(() => {
      setSuccess('');
    }, 4000);
  };



  // Results & Grading Tab States
  const [selectedResultSession, setSelectedResultSession] = useState('');
  const [sessionResults, setSessionResults] = useState([]);
  const [showGradingModal, setShowGradingModal] = useState(false);
  const [activeCopie, setActiveCopie] = useState(null);
  const [currentGrades, setCurrentGrades] = useState({}); // { qId: score }
  const [currentComment, setCurrentComment] = useState('');
  const [isAutoGrading, setIsAutoGrading] = useState(false);
  const [autoGradeResult, setAutoGradeResult] = useState(null);
  const [showPdfPanel, setShowPdfPanel] = useState(false);

  // Charger les sessions depuis la base de données
  const fetchSessions = async () => {
    try {
      let sessionsList = [];
      const tId = sessionStorage.getItem('teacher_id');
      if (window.electronAPI) {
        const response = await window.electronAPI.getSessions(tId);
        if (response.success) sessionsList = response.sessions;
      } else {
        const url = tId ? `/api/sessions?teacherId=${tId}` : '/api/sessions';
        const token = sessionStorage.getItem('teacher_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch(url, { headers });
        const data = await response.json();
        if (data.success) sessionsList = data.sessions;
      }
      
      const mapped = sessionsList.map(s => ({
        ...s,
        status: computeStatus(s.date, s.duree)
      }));
      setSessions(mapped);
    } catch (err) {
      console.error("Erreur de chargement des sessions:", err);
      if (!window.electronAPI) {
        setSessions([
          {
            id: 1, code: 'XK9-2A4', title: 'Programmation Java – LP3 (Démo Local)',
            date: '2025-06-20 08:00', duree: 180,
            status: 'pending', submissionsCount: 0, totalStudents: 24,
            enonceTexte: JSON.stringify([
              { id: 1, enonce: "Qu'est-ce que le polymorphisme en Java ?", typeReponse: 'texte', points: 5 },
              { id: 2, enonce: "Écrire une fonction récursive qui calcule le factoriel d'un entier.", typeReponse: 'code', points: 7 },
              { id: 3, enonce: "Dessiner le diagramme de classes pour un système de gestion de bibliothèque.", typeReponse: 'uml', points: 8 }
            ])
          }
        ]);
      }
    }
  };



  // Charger les résultats pour la session sélectionnée
  const fetchSessionResults = async (sessionId) => {
    if (!sessionId) {
      setSessionResults([]);
      return;
    }
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.getSessionResults(sessionId);
        if (res.success) setSessionResults(res.results);
      } else {
        const token = sessionStorage.getItem('teacher_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch(`/api/sessions/${sessionId}/results`, { headers });
        const data = await res.json();
        if (data.success) setSessionResults(data.results);
      }
    } catch (err) {
      console.error("Erreur de chargement des résultats:", err);
      // Mode démo locale
      setSessionResults([
        {
          studentId: 101, matricule: "ETU-2024-001", nom: "Diallo", prenom: "Mariama", email: "m.diallo@uidt.sn",
          copieId: 50, contenuCode: JSON.stringify({
            "1": "Le polymorphisme est la capacité d'un objet à prendre plusieurs formes. Par exemple, une référence de classe mère peut pointer vers un objet enfant.",
            "2": "public int factorielle(int n) {\n  if (n <= 1) return 1;\n  return n * factorielle(n - 1);\n}",
            "3": "Class Bibliotheque {\n  - nom : String\n}\n\nBibliotheque --[0..*]--> Livre"
          }),
          fluxUML: "", estValidee: 1, notesJSON: "{}", noteFinale: null, commentaire: "", horodatageDerniereModif: "2026-06-17T12:00:00Z"
        },
        {
          studentId: 102, matricule: "ETU-2024-002", nom: "Sow", prenom: "Ibrahima", email: "i.sow@uidt.sn",
          copieId: 51, contenuCode: JSON.stringify({
            "1": "C'est quand on surcharge les méthodes.",
            "2": "public int fact(int n) { return n * fact(n-1); }"
          }),
          fluxUML: "", estValidee: 0, notesJSON: "{}", noteFinale: null, commentaire: "", horodatageDerniereModif: "2026-06-17T11:45:00Z"
        }
      ]);
    }
  };

  useEffect(() => {
    const token = sessionStorage.getItem('teacher_token');
    if (!token) {
      navigate('/teacher/auth');
      return;
    }
    if (window.electronAPI) {
      window.electronAPI.invoke('set-auth-token', token).then(() => fetchSessions());
    } else {
      fetchSessions();
    }
  }, []);

  // Auto-sélectionner la session la plus récente dans l'onglet résultats
  useEffect(() => {
    if (activeTab === 'results' && !selectedResultSession && sessions.length > 0) {
      const sortedSessions = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date));
      setSelectedResultSession(sortedSessions[0].id.toString());
      fetchSessionResults(sortedSessions[0].id);
    }
  }, [activeTab, selectedResultSession, sessions]);

  const handleLogout = () => { sessionStorage.clear(); navigate('/'); };

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return [3,3].map(n => Array.from({length:n},()=>chars[Math.floor(Math.random()*chars.length)]).join('')).join('-');
  };

  // Ouvrir le modal nouvelle session
  const handleOpenNewSessionModal = () => {
    setNewSession({
      title: '',
      date: new Date().toISOString().split('T')[0],
      heureDebut: '08:00',
      duree: 120,
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
      duree: Number(newSession.duree) || 120,
      instructions: 'Veuillez composer seul et sans sortir du mode Kiosque.',
      teacherId: sessionStorage.getItem('teacher_id')
    };

    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.createSession(sessionData);
        if (result.success) {
          showSuccessMessage(t('success'));
          setShowNewModal(false);
          fetchSessions();
        } else {
          setError(result.error || "Erreur de création.");
        }
      } catch (err) {
        console.error(err);
        setError("Erreur SQLite.");
      }
    } else {
      try {
        const token = sessionStorage.getItem('teacher_token');
        const response = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify(sessionData)
        });
        const data = await response.json();
        if (data.success) {
          showSuccessMessage(t('success'));
          setShowNewModal(false);
          fetchSessions();
        } else {
          setError(data.error || "Erreur serveur.");
        }
      } catch (err) {
        console.error(err);
        setError("Serveur hors-ligne.");
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

        const students = json.map(row => {
          const matriculeKey = Object.keys(row).find(k => k.toLowerCase().includes('matricule')) || 'matricule';
          const nomKey = Object.keys(row).find(k => k.toLowerCase().includes('nom')) || 'nom';
          const prenomKey = Object.keys(row).find(k => k.toLowerCase().includes('prenom') || k.toLowerCase().includes('prénom')) || 'prenom';
          const emailKey = Object.keys(row).find(k => k.toLowerCase().includes('mail') || k.toLowerCase().includes('email')) || 'email';

          return {
            matricule: String(row[matriculeKey] || '').trim().toUpperCase(),
            nom: String(row[nomKey] || '').trim(),
            prenom: String(row[prenomKey] || '').trim(),
            email: String(row[emailKey] || '').trim(),
            codeSecret: '', // Généré à l'envoi
            statusEmail: 'Prêt'
          };
        }).filter(s => s.matricule && s.email);

        if (students.length === 0) {
          setError("Aucun étudiant valide. Le fichier doit avoir les colonnes matricule et email.");
        } else {
          setImportedStudents(students);
          showSuccessMessage(`${students.length} étudiants importés.`);
        }
      } catch (err) {
        console.error(evt, err);
        setError("Erreur de format de fichier.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Ouvrir la gestion des étudiants
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
        const token = sessionStorage.getItem('teacher_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch(`/api/sessions/${session.id}/students`, { headers });
        const data = await response.json();
        if (data.success && data.students.length > 0) {
          setImportedStudents(data.students.map(s => ({ ...s, statusEmail: 'Envoyé' })));
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Simuler l'envoi d'emails
  const handleGenerateAndSendEmails = async () => {
    if (importedStudents.length === 0) {
      setError(t('stepImportHelp'));
      return;
    }

    setIsSendingEmails(true);
    setEmailStatusMessage(t('savingStudents'));

    // Générer les codes secrets manquants
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const studentsWithCode = importedStudents.map(st => {
      if (!st.codeSecret) {
        return { ...st, codeSecret: Array.from({length: 8}, () => chars[Math.floor(Math.random() * chars.length)]).join('') };
      }
      return st;
    });
    setImportedStudents(studentsWithCode);

    try {
      if (window.electronAPI && selectedSession) {
        await window.electronAPI.importStudents(selectedSession.id, studentsWithCode);
      } else if (selectedSession) {
        const token = sessionStorage.getItem('teacher_token');
        const response = await fetch(`/api/sessions/${selectedSession.id}/students`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ students: studentsWithCode })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
      }
    } catch (err) {
      console.error(err);
      setError("Erreur SQL.");
      setIsSendingEmails(false);
      return;
    }

    const progressList = [...studentsWithCode];
    for (let i = 0; i < progressList.length; i++) {
      progressList[i] = { ...progressList[i], statusEmail: 'En cours...' };
      setImportedStudents([...progressList]);
      setEmailStatusMessage(`${t('sendingTo')} ${progressList[i].email}...`);

      if (window.electronAPI) {
        const response = await window.electronAPI.sendEmail(progressList[i], selectedSession.code);
        if (response.success) {
          progressList[i] = { ...progressList[i], statusEmail: 'Envoyé ✅' };
        } else {
          progressList[i] = { ...progressList[i], statusEmail: 'Échec ❌' };
          console.error("Erreur d'envoi:", response.error);
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 300));
        progressList[i] = { ...progressList[i], statusEmail: 'Envoyé ✅' };
      }

      setImportedStudents([...progressList]);
    }

    setIsSendingEmails(false);
    setEmailStatusMessage(`${progressList.length} ${t('emailSuccess')}`);
    fetchSessions();
  };



  // Results / Grading handlers
  const handleOpenGradingModal = (copie) => {
    setActiveCopie(copie);
    let parsedNotes = {};
    try {
      parsedNotes = JSON.parse(copie.notesJSON || '{}');
    } catch (_) {
      parsedNotes = {};
    }
    
    // Si aucune note n'est enregistrée, initialiser à 0 pour chaque question
    const currentSessionObj = sessions.find(s => s.id === Number(selectedResultSession));
    let examQs = [];
    if (currentSessionObj && currentSessionObj.enonceTexte) {
      try { examQs = JSON.parse(currentSessionObj.enonceTexte); } catch (_) {}
    }
    
    const initialNotes = {};
    examQs.forEach(q => {
      initialNotes[q.id] = parsedNotes[q.id] !== undefined ? parsedNotes[q.id] : 0;
    });

    setCurrentGrades(initialNotes);
    setCurrentComment(copie.commentaire || '');
    setShowGradingModal(true);
  };

  const handleUpdateQuestionGrade = (qId, value) => {
    setCurrentGrades(prev => ({ ...prev, [qId]: Number(value) }));
  };

  const handleSaveGrading = async () => {
    if (!activeCopie) return;
    const finalScore = Object.values(currentGrades).reduce((acc, pts) => acc + Number(pts), 0);
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.saveGrade(activeCopie.copieId, currentGrades, finalScore, currentComment);
        if (res.success) {
          showSuccessMessage(t('gradingSaved'));
          setShowGradingModal(false);
          fetchSessionResults(selectedResultSession);
        }
      } else {
        const token = sessionStorage.getItem('teacher_token');
        const res = await fetch(`/api/copies/${activeCopie.copieId}/grade`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ notesJSON: currentGrades, noteFinale: finalScore, commentaire: currentComment })
        });
        const data = await res.json();
        if (data.success) {
          showSuccessMessage(t('gradingSaved'));
          setShowGradingModal(false);
          fetchSessionResults(selectedResultSession);
        }
      }
    } catch (err) {
      console.error(err);
      // SQLite local ou démo fallback
      const updated = sessionResults.map(r => r.copieId === activeCopie.copieId ? { ...r, notesJSON: JSON.stringify(currentGrades), noteFinale: finalScore, commentaire: currentComment } : r);
      setSessionResults(updated);
      showSuccessMessage(t('gradingSaved'));
      setShowGradingModal(false);
    }
  };


  const handleExportResults = () => {
    if (sessionResults.length === 0) return;
    const currentSessionObj = sessions.find(s => s.id === Number(selectedResultSession));
    const examTitle = currentSessionObj ? currentSessionObj.title : 'Examen';

    const formattedData = sessionResults.map(res => {
      return {
        [t('resultsTableMatricule')]: res.matricule,
        [t('resultsTableStudent')]: `${res.prenom} ${res.nom}`,
        [t('resultsTableGrade')]: res.noteFinale !== null ? res.noteFinale : 'Non corrigé'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Notes");
    XLSX.writeFile(workbook, `Notes_${examTitle.replace(/\s+/g, '_')}.xlsx`);
  };

  const initials = teacherName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);

  return (
    <div className="gradient-bg dashboard">
      {/* Navbar supérieure */}
      <header className="topbar">
        <div className="topbar-logo">
          <span>🛡️</span>
          <span>SAFECODE-EXAM</span>
        </div>
        
        {/* Liens de navigation */}
        <nav className="topbar-nav">
          <a href="#" className={`nav-link ${activeTab === 'sessions' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('sessions'); }}>
            {t('tabSessions')}
          </a>

          <a href="#" className={`nav-link ${activeTab === 'results' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('results'); }}>
            {t('tabResults')}
          </a>
        </nav>

        {/* Sélecteur de langue et Profil */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Langue toggle */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 3, border: '1px solid var(--border)' }}>
            <button 
              onClick={() => setLanguage('fr')} 
              style={{
                background: lang === 'fr' ? 'var(--accent)' : 'transparent',
                color: '#fff', border: 'none', padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600
              }}>
              FR
            </button>
            <button 
              onClick={() => setLanguage('en')} 
              style={{
                background: lang === 'en' ? 'var(--accent)' : 'transparent',
                color: '#fff', border: 'none', padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600
              }}>
              EN
            </button>
          </div>

          <div className="topbar-user">
            <span>Prof. {teacherName}</span>
            <div className="avatar" style={{ background: 'linear-gradient(135deg, var(--teacher-color), #6d28d9)' }}>
              {initials}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ marginLeft: 8 }}>
              {t('logout')}
            </button>
          </div>
        </div>
      </header>

      <div className="dashboard-content">
        {loading && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <span className="spin" style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
            {' '}{t('loading')}
          </div>
        )}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius)', padding: '12px', color: '#f87171', marginBottom: 20 }}>
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius)', padding: '12px', color: '#34d399', marginBottom: 20 }}>
            ✅ {success}
          </div>
        )}

        {/* ─── TAB SESSIONS ────────────────────────────────────────────────── */}
        {activeTab === 'sessions' && (
          <div className="animate-fade-up">
            <div className="page-header">
              <h1>{t('dashboardTitle')} 👋</h1>
              <p>Prof. {teacherName} — {t('adminSubtitle')}</p>
            </div>

            {/* Stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--accent-light)' }}>{sessions.length}</div>
                <div className="stat-label">{t('statSessions')}</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--success)' }}>
                  {sessions.filter(s => s.status === 'active').length}
                </div>
                <div className="stat-label">{t('statActive')}</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--warning)' }}>
                  {sessions.filter(s => s.status === 'closed').length}
                </div>
                <div className="stat-label">{t('statClosed')}</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: '#60a5fa' }}>
                  {sessions.filter(s => s.status === 'pending').length}
                </div>
                <div className="stat-label">{lang === 'fr' ? 'À venir' : 'Pending'}</div>
              </div>
            </div>

            <div className="section-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <h2>📋 {t('configuredSessions')}</h2>
                <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '12px' }}>
                  <button 
                    onClick={() => setFilterStatus('all')} 
                    style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: filterStatus === 'all' ? 'rgba(255,255,255,0.1)' : 'transparent', color: filterStatus === 'all' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s' }}>
                    Toutes
                  </button>
                  <button 
                    onClick={() => setFilterStatus('active')} 
                    style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: filterStatus === 'active' ? 'rgba(34,197,94,0.15)' : 'transparent', color: filterStatus === 'active' ? '#4ade80' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s' }}>
                    En cours
                  </button>
                  <button 
                    onClick={() => setFilterStatus('pending')} 
                    style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: filterStatus === 'pending' ? 'rgba(16,185,129,0.15)' : 'transparent', color: filterStatus === 'pending' ? 'var(--accent-light)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s' }}>
                    En attente
                  </button>
                  <button 
                    onClick={() => setFilterStatus('closed')} 
                    style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: filterStatus === 'closed' ? 'rgba(245,158,11,0.15)' : 'transparent', color: filterStatus === 'closed' ? '#fbbf24' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s' }}>
                    Terminées
                  </button>
                </div>
              </div>
              <button id="btn-new-session" className="btn btn-primary btn-sm" onClick={handleOpenNewSessionModal} style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))', border: 'none', padding: '10px 16px', borderRadius: '10px', fontWeight: 700, color: '#fff', boxShadow: '0 4px 15px rgba(16,185,129,0.3)' }}>
                {t('newSessionBtn')}
              </button>
            </div>

            {(() => {
              if (sessions.length === 0) {
                return (
                  <div className="glass-card empty-state">
                    <div className="empty-icon">📋</div>
                    <p>{t('noSessions')}</p>
                  </div>
                );
              }

              const filteredSessions = [...sessions]
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .filter(session => filterStatus === 'all' ? true : session.status === filterStatus);

              if (filteredSessions.length === 0) {
                return (
                  <div className="glass-card empty-state" style={{ padding: '60px 40px', textAlign: 'center', background: 'rgba(255,255,255,0.015)' }}>
                    <div className="empty-icon" style={{ fontSize: '3rem', opacity: 0.5, marginBottom: '16px' }}>🔍</div>
                    <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '8px' }}>
                      {lang === 'fr' ? 'Aucune session trouvée' : 'No sessions found'}
                    </h3>
                    <p style={{ color: 'var(--text-secondary)' }}>
                      {lang === 'fr' 
                        ? 'Aucune session ne correspond à ce filtre actuellement.' 
                        : 'No sessions match this filter currently.'}
                    </p>
                    <button 
                      onClick={() => setFilterStatus('all')} 
                      className="btn btn-ghost" 
                      style={{ marginTop: '24px', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: '12px' }}
                    >
                      {lang === 'fr' ? 'Afficher toutes les sessions' : 'Show all sessions'}
                    </button>
                  </div>
                );
              }

              return (
                <div className="sessions-list">
                  {filteredSessions.map(session => (
                    <div key={session.id} className="glass-card session-card">
                      <div className={`session-card-accent ${session.status}`} />
                      <div className="session-card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                        <div className="session-info" style={{ flex: 1, minWidth: 300 }}>
                          <h3 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                            {session.title}
                            <span className={`status-badge ${session.status}`}>
                              <span className="status-dot" />
                              {session.status === 'active' ? t('statusActive') : session.status === 'closed' ? t('statusClosed') : t('statusPending')}
                            </span>
                          </h3>

                          <div className="session-meta">
                            <span className="session-meta-item">
                              📅 {session.date ? new Date(session.date).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </span>
                          </div>
                        </div>

                        <div className="session-actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div className="session-code-badge" title={t('sessionCodeTooltip')} style={{ margin: 0 }}>
                            {session.code}
                          </div>
                          
                          {/* Actions pour les sessions EN COURS */}
                          {session.status === 'active' && (
                            <>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => navigate(`/teacher/live/${session.id}`)}
                                style={{ color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }}
                              >
                                📡 Direct
                              </button>
                            </>
                          )}

                          {/* Actions pour les sessions À VENIR (Pending) */}
                          {session.status === 'pending' && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => navigate('/teacher/create-exam', { state: { sessionId: session.id, sessionTitle: session.title } })}
                            >
                              ✏️ Modifier
                            </button>
                          )}

                          {/* Actions pour les sessions TERMINÉES */}
                          {session.status === 'closed' && (
                            <>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => {
                                  setActiveTab('results');
                                  setSelectedResultSession(session.id);
                                  fetchSessionResults(session.id);
                                }}
                                style={{ color: '#8b5cf6', borderColor: 'rgba(139,92,246,0.3)' }}
                              >
                                📊 Résultats
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => navigate('/teacher/create-exam', { state: { sessionId: session.id, sessionTitle: session.title, readOnly: true } })}
                              >
                                👁️ Épreuve
                              </button>
                            </>
                          )}

                          {/* Le bouton Étudiants est visible partout */}
                          <button
                            className="btn btn-sm"
                            onClick={() => handleOpenStudentsModal(session)}
                            style={{ background: 'rgba(6,182,212,0.1)', color: 'var(--student-color)', border: '1px solid rgba(6,182,212,0.25)' }}
                          >
                            👥 {t('studentsBtn')}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}



        {/* ─── TAB CORRECTIONS & RESULTATS ───────────────────────────────── */}
        {activeTab === 'results' && (
          <div className="animate-fade-up">
            <div className="page-header">
              <h1>📊 {t('resultsTitle')}</h1>
              <p>{t('resultsDesc')}</p>
            </div>

            <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
              <label className="form-label">{t('resultsSelectSession')}</label>
              <select className="form-select" style={{ marginTop: 8 }}
                value={selectedResultSession} onChange={e => {
                  setSelectedResultSession(e.target.value);
                  fetchSessionResults(e.target.value);
                }}>
                <option value="">-- {t('resultsSelectSession').replace(':', '')} --</option>
                {[...sessions].sort((a, b) => new Date(b.date) - new Date(a.date)).map(s => (
                  <option key={s.id} value={s.id}>{s.title} ({s.code})</option>
                ))}
              </select>
            </div>

            {!selectedResultSession ? (
              <div className="glass-card empty-state">
                <div className="empty-icon">📊</div>
                <p>{t('resultsNoSelectedSession')}</p>
              </div>
            ) : (
              <div className="glass-card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                  <h3 style={{ margin: 0 }}>👥 Candidats ({sessionResults.length})</h3>
                  <button className="btn btn-ghost btn-sm" onClick={handleExportResults} disabled={sessionResults.length === 0}>
                    {t('resultsExportBtn')}
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                        <th style={{ padding: 12, textAlign: 'left' }}>{t('resultsTableMatricule')}</th>
                        <th style={{ padding: 12, textAlign: 'left' }}>{t('resultsTableStudent')}</th>
                        <th style={{ padding: 12, textAlign: 'left' }}>{t('resultsTableStatus')}</th>
                        <th style={{ padding: 12, textAlign: 'left' }}>{t('resultsTableDate')}</th>
                        <th style={{ padding: 12, textAlign: 'center' }}>{t('resultsTableGrade')}</th>
                        <th style={{ padding: 12, textAlign: 'right' }}>{t('resultsTableActions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionResults.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                            {t('noStudents')}
                          </td>
                        </tr>
                      ) : (
                        sessionResults.map(res => {
                          const currentSessionObj = sessions.find(s => s.id === Number(selectedResultSession));
                          const isClosed = currentSessionObj ? currentSessionObj.status === 'closed' : false;
                          const isViewable = res.estValidee === 1 || isClosed;
                          
                          return (
                            <tr key={res.copieId} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: 12, fontWeight: 'bold' }}>{res.matricule}</td>
                              <td style={{ padding: 12 }}>{res.prenom} {res.nom}</td>
                              <td style={{ padding: 12 }}>
                                {res.estValidee === 1 ? (
                                  <span className="status-badge submitted"><span className="status-dot" />{t('resultsStatusSubmitted')}</span>
                                ) : isClosed ? (
                                  <span className="status-badge timeout"><span className="status-dot" />{t('resultsStatusFinishedTime')}</span>
                                ) : (
                                  <span className="status-badge inprogress"><span className="status-dot" />{t('resultsStatusInProgress')}</span>
                                )}
                              </td>
                              <td style={{ padding: 12, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                {res.horodatageDerniereModif ? new Date(res.horodatageDerniereModif).toLocaleString() : '—'}
                              </td>
                              <td style={{ padding: 12, textAlign: 'center', fontWeight: 'bold', color: 'var(--accent-light)' }}>
                                {res.noteFinale !== null ? `${res.noteFinale} pts` : '—'}
                              </td>
                              <td style={{ padding: 12, textAlign: 'right' }}>
                                <button className="btn btn-ghost btn-sm"
                                  style={{
                                    color: isViewable ? 'var(--accent-light)' : 'var(--text-muted)',
                                    borderColor: isViewable ? 'rgba(99,102,241,0.2)' : 'transparent',
                                    cursor: isViewable ? 'pointer' : 'not-allowed'
                                  }}
                                  onClick={() => {
                                    if (!isViewable) {
                                      alert(t('resultsLockWarning'));
                                      return;
                                    }
                                    handleOpenGradingModal(res);
                                  }}>
                                  {t('resultsActionCorrect')}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── MODAL NOUVELLE SESSION ────────────────────────────────────── */}
      {showNewModal && (
        <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>📋 {t('newSessionTitle')}</h2>
            <p>{t('newSessionDesc')}</p>
            <form onSubmit={handleCreateSession} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">{t('sessionTitleLabel')}</label>
                <input className="form-input" placeholder="ex: Examen Final Java - S6" required
                  value={newSession.title} onChange={e => setNewSession({...newSession, title: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('dateLabel')}</label>
                <input className="form-input" type="date" required
                  value={newSession.date} onChange={e => setNewSession({...newSession, date: e.target.value})} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">{t('startTimeLabel')}</label>
                  <input className="form-input" type="time" required
                    value={newSession.heureDebut} onChange={e => setNewSession({...newSession, heureDebut: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('createExamDurationLabel') || 'Durée (minutes)'}</label>
                  <input className="form-input" type="number" min="15" required
                    value={newSession.duree} onChange={e => setNewSession({...newSession, duree: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{t('sessionCodeLabel')}</label>
                <input className="form-input" readOnly value={newSession.code} 
                  style={{ fontFamily: 'Fira Code', textAlign: 'center', letterSpacing: '0.15em', fontWeight: 'bold' }} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowNewModal(false)}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary">✨ {t('createBtn')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL GESTION DES ETUDIANTS ────────────────────────────────── */}
      {showStudentsModal && selectedSession && (
        <div className="modal-overlay" onClick={() => setShowStudentsModal(false)}>
          <div className="modal" style={{ maxWidth: '800px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <h2>👥 {t('studentsModalTitle')}{selectedSession.title}</h2>
            <p>{t('studentsModalDesc')}</p>
            
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
                <label className="form-label">{t('stepImport')}</label>
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  onChange={handleExcelImport}
                  style={{ marginTop: 8, fontSize: '0.85rem' }}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  {t('stepImportHelp')}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <label className="form-label">{t('stepEmail')}</label>
                <button 
                  className="btn btn-primary btn-block" 
                  onClick={handleGenerateAndSendEmails}
                  disabled={importedStudents.length === 0 || isSendingEmails}
                  style={{ marginTop: 8 }}
                >
                  {isSendingEmails ? `⏳ ${t('sendingEmails')}` : `🔐 ${t('sendEmailsBtn')}`}
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
                    <th style={{ padding: 10, textAlign: 'left' }}>{t('tableMatricule')}</th>
                    <th style={{ padding: 10, textAlign: 'left' }}>{t('tableFullName')}</th>
                    <th style={{ padding: 10, textAlign: 'left' }}>{t('tableEmail')}</th>
                    <th style={{ padding: 10, textAlign: 'center' }}>{t('tableSecretCode')}</th>
                    <th style={{ padding: 10, textAlign: 'right' }}>{t('tableEmailStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {importedStudents.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                        {t('noStudents')}
                      </td>
                    </tr>
                  ) : (
                    importedStudents.map((st, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: 10, fontWeight: 'bold' }}>{st.matricule}</td>
                        <td style={{ padding: 10 }}>{st.prenom} {st.nom}</td>
                        <td style={{ padding: 10, color: 'var(--text-secondary)' }}>{st.email}</td>
                        <td style={{ padding: 10, textAlign: 'center', fontFamily: 'Fira Code', color: st.codeSecret ? 'var(--accent-light)' : 'var(--text-muted)' }}>{st.codeSecret || '— À générer —'}</td>
                        <td style={{ padding: 10, textAlign: 'right', fontWeight: 'bold' }}>
                          <span className={`status-badge ${
                            st.statusEmail.includes('✅') || st.statusEmail === 'Envoyé' ? 'email-sent' : 
                            st.statusEmail === 'Prêt' ? 'email-ready' : 'email-progress'
                          }`}>
                            <span className="status-dot" />
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
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}



      {/* ─── MODAL CORRECTION / GRADING ───────────────────────────────── */}
      {showGradingModal && activeCopie && (() => {
        const currentSessionObj = sessions.find(s => s.id === Number(selectedResultSession));
        const examQs = currentSessionObj && currentSessionObj.enonceTexte ? JSON.parse(currentSessionObj.enonceTexte) : [];
        
        let studentAnswers = {};
        try {
          studentAnswers = JSON.parse(activeCopie.contenuCode || '{}');
        } catch (e) {
          studentAnswers = {};
        }

        const examQsToDisplay = [...examQs];
        Object.keys(studentAnswers).forEach((key) => {
          if (!examQsToDisplay.find(q => q.id.toString() === key.toString())) {
            examQsToDisplay.push({
              id: key,
              enonce: 'Réponse libre ajoutée par l\'étudiant',
              typeReponse: studentAnswers[key]?.type || 'texte',
              points: 0
            });
          }
        });
        
        return (
          <div className="modal-overlay" onClick={() => setShowGradingModal(false)} style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
            <div className="modal glass-card" style={{ maxWidth: showPdfPanel ? '1400px' : '900px', width: '95%', maxHeight: '90vh', overflowY: 'auto', padding: 32, borderRadius: 24, border: '1px solid rgba(255,255,255,0.05)', background: '#0a0d0c', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', transition: 'max-width 0.3s ease' }} onClick={e => e.stopPropagation()}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ background: 'rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: 12 }}>📝</span>
                {t('gradingTitle')}{activeCopie.prenom} {activeCopie.nom}
              </h2>
              <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Numéro Étudiant:</span> <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: 6 }}>{activeCopie.matricule}</span> 
                  <span style={{ color: 'var(--text-muted)' }}>•</span> 
                  <span style={{ color: 'var(--text-secondary)' }}>{t('gradingCopieStatus')}:</span> 
                  {activeCopie.estValidee ? (
                    <span className="status-badge submitted" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 20, padding: '4px 12px', fontWeight: 600, fontSize: '0.8rem' }}><span className="status-dot" style={{ background: '#10b981', boxShadow: '0 0 8px #10b981' }} />{t('resultsStatusSubmitted')}</span>
                  ) : (
                    <span className="status-badge timeout" style={{ background: 'rgba(244,63,94,0.1)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 20, padding: '4px 12px', fontWeight: 600, fontSize: '0.8rem' }}><span className="status-dot" style={{ background: '#f43f5e', boxShadow: '0 0 8px #f43f5e' }} />{t('resultsStatusFinishedTime')}</span>
                  )}
                </div>
                
                {currentSessionObj && currentSessionObj.sujetPdfBase64 && (
                  <button onClick={() => setShowPdfPanel(!showPdfPanel)} style={{ background: showPdfPanel ? 'var(--accent)' : 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '6px 14px', color: '#fff', fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'all 0.2s', fontWeight: 600 }}>
                    {showPdfPanel ? '❌ Fermer le PDF' : '📄 Ouvrir le Sujet (PDF)'}
                  </button>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: 32, flexDirection: showPdfPanel ? 'row' : 'column', alignItems: 'flex-start' }}>
                
                {/* PDF Viewer Panel */}
                {showPdfPanel && currentSessionObj && currentSessionObj.sujetPdfBase64 && (
                  <div style={{ flex: '1', width: '100%', height: 'calc(90vh - 200px)', minHeight: 500, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: '#fff', position: 'sticky', top: 0 }}>
                    <iframe src={currentSessionObj.sujetPdfBase64} style={{ width: '100%', height: '100%', border: 'none' }} title="Sujet PDF" />
                  </div>
                )}

                {/* Grading Panel */}
                <div style={{ flex: '1', width: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {examQsToDisplay.map((q, idx) => {
                  const answerObj = studentAnswers[q.id] || {};
                  const answerType = answerObj.type || q.typeReponse || 'texte'; // fallback s'il y a un type hérité
                  const answerContent = answerObj.content !== undefined ? answerObj.content : (typeof studentAnswers[q.id] === 'string' ? studentAnswers[q.id] : '');
                  
                  const score = currentGrades[q.id] || 0;
                  return (
                    <div key={q.id} style={{ padding: 24, background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h4 style={{ margin: 0, color: 'var(--accent-light)', fontSize: '1.1rem', fontWeight: 700 }}>
                          {answerType === 'code' ? '💻 ' : answerType === 'uml' ? '📐 ' : '📝 '}
                          Question {idx + 1} <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 400 }}>({q.points} pt{q.points > 1 ? 's' : ''})</span>
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.03)', padding: '6px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{t('gradingQuestionPoints')}</label>
                          <input type="number" min="0" max={q.points} step="0.5" className="form-input" style={{ width: 80, padding: '8px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontWeight: 700, borderRadius: 8, textAlign: 'center' }}
                            value={score} onChange={e => handleUpdateQuestionGrade(q.id, e.target.value)} />
                        </div>
                      </div>
                      <p style={{ fontSize: '1rem', color: '#fff', marginBottom: 16, fontStyle: 'normal', fontWeight: 500, paddingLeft: 12, borderLeft: '3px solid var(--accent-light)', lineHeight: 1.5 }}>
                        {q.enonce}
                      </p>
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.2)' }}>
                        {answerType === 'code' ? (
                          <pre style={{ margin: 0, fontFamily: 'Fira Code, monospace', fontSize: '0.85rem', color: '#c4b5fd', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                            {answerContent || '// Aucune réponse fournie'}
                          </pre>
                        ) : answerType === 'uml' ? (
                          <div style={{ height: 400, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, overflow: 'hidden' }}>
                            {answerContent ? (
                              <UMLEditor
                                value={answerContent}
                                onChange={() => {}}
                                readOnly={true}
                              />
                            ) : (
                              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: 16 }}>Aucun diagramme UML fourni.</p>
                            )}
                          </div>
                        ) : answerType === 'qcm' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {(q.options || []).map(opt => {
                              let studentSelected = false;
                              try { studentSelected = JSON.parse(answerContent || '[]').includes(opt.id); } catch(e){}
                              
                              const isExpected = opt.isCorrect;
                              
                              let bg = 'rgba(255,255,255,0.03)';
                              let border = '1px solid rgba(255,255,255,0.05)';
                              let icon = '⬜';
                              
                              if (studentSelected && isExpected) {
                                bg = 'rgba(16,185,129,0.1)'; border = '1px solid var(--success)'; icon = '✅';
                              } else if (studentSelected && !isExpected) {
                                bg = 'rgba(244,63,94,0.1)'; border = '1px solid var(--danger)'; icon = '❌';
                              } else if (!studentSelected && isExpected) {
                                bg = 'rgba(245,158,11,0.1)'; border = '1px solid var(--warning)'; icon = '⚠️ (Manqué)';
                              }
                              
                              return (
                                <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: bg, border: border, borderRadius: 8 }}>
                                  <span style={{ fontSize: '1.2rem' }}>{icon}</span>
                                  <span style={{ fontSize: '0.95rem', color: '#fff', opacity: (studentSelected || isExpected) ? 1 : 0.6 }}>{opt.text}</span>
                                </div>
                              );
                            })}
                            {!answerContent && <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>(Aucune réponse sélectionnée)</p>}
                          </div>
                        ) : (
                          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                            {answerContent || '(Aucune réponse fournie)'}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="form-group" style={{ marginBottom: 24, marginTop: 32 }}>
                <label className="form-label" style={{ color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.85rem' }}>{t('gradingCommentLabel')}</label>
                <textarea className="form-textarea" placeholder={t('gradingCommentPlaceholder')}
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, minHeight: 100 }}
                  value={currentComment} onChange={e => setCurrentComment(e.target.value)} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                   <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>{t('gradingFinalScore')}</div>
                   <div style={{ fontSize: '1.8rem', fontWeight: 800, background: 'linear-gradient(135deg, var(--accent-light), var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                     {Object.values(currentGrades).reduce((acc, pts) => acc + Number(pts), 0)} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', WebkitTextFillColor: 'var(--text-muted)' }}>/ {examQs.reduce((acc, q) => acc + Number(q.points), 0)} pts</span>
                   </div>
                </div>
                <div className="modal-actions" style={{ display: 'flex', gap: 12 }}>
                  <button className="btn btn-ghost" style={{ padding: '12px 24px', borderRadius: 12, color: 'var(--text-secondary)' }} onClick={() => setShowGradingModal(false)}>{t('cancel')}</button>
                  <button className="btn btn-primary" style={{ padding: '12px 24px', borderRadius: 12, background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))', border: 'none', fontWeight: 700, boxShadow: '0 8px 20px rgba(16,185,129,0.3)' }} onClick={handleSaveGrading}>{t('gradingSaveBtn')}</button>
                </div>
              </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
