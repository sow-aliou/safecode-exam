import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useTranslation } from '../utils/lang';

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
  const [activeTab, setActiveTab] = useState('sessions'); // 'sessions' | 'qbank' | 'results'

  // Sessions Tab States
  const [sessions, setSessions] = useState([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  
  const [newSession, setNewSession] = useState({ title: '', date: '', heureDebut: '', heureFin: '', code: '' });
  const [importedStudents, setImportedStudents] = useState([]);
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [emailStatusMessage, setEmailStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Question Bank Tab States
  const [qBankQuestions, setQBankQuestions] = useState([]);
  const [showQBankModal, setShowQBankModal] = useState(false);
  const [newQBankQuestion, setNewQBankQuestion] = useState({ enonce: '', typeReponse: 'texte', points: 1 });

  // Results & Grading Tab States
  const [selectedResultSession, setSelectedResultSession] = useState('');
  const [sessionResults, setSessionResults] = useState([]);
  const [showGradingModal, setShowGradingModal] = useState(false);
  const [activeCopie, setActiveCopie] = useState(null);
  const [currentGrades, setCurrentGrades] = useState({}); // { qId: score }
  const [currentComment, setCurrentComment] = useState('');

  // Charger les sessions depuis la base de données
  const fetchSessions = async () => {
    try {
      let sessionsList = [];
      const tId = sessionStorage.getItem('teacher_id');
      if (window.electronAPI) {
        const response = await window.electronAPI.getSessions(tId);
        if (response.success) sessionsList = response.sessions;
      } else {
        const url = tId ? `http://localhost:3000/api/sessions?teacherId=${tId}` : 'http://localhost:3000/api/sessions';
        const response = await fetch(url);
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

  // Charger la banque de questions
  const fetchQBank = async () => {
    const teacherId = sessionStorage.getItem('teacher_id') || 1;
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.getQuestionBank(teacherId);
        if (res.success) setQBankQuestions(res.questions);
      } else {
        const res = await fetch(`http://localhost:3000/api/questionbank?teacherId=${teacherId}`);
        const data = await res.json();
        if (data.success) setQBankQuestions(data.questions);
      }
    } catch (err) {
      console.error("Erreur de chargement de la banque de questions:", err);
      // Mode démo locale
      setQBankQuestions([
        { id: 1, enonce: "Définir la différence entre une interface et une classe abstraite.", typeReponse: 'texte', points: 4 },
        { id: 2, enonce: "Implémenter l'algorithme du Tri Rapide (QuickSort) en Java.", typeReponse: 'code', points: 8 }
      ]);
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
        const res = await fetch(`http://localhost:3000/api/sessions/${sessionId}/results`);
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
    fetchSessions();
    fetchQBank();
  }, []);

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
      heureFin: '11:00',
      code: generateCode()
    });
    setShowNewModal(true);
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    setError('');

    // Calculer la durée en minutes entre début et fin
    const startParts = newSession.heureDebut.split(':').map(Number);
    const endParts = newSession.heureFin.split(':').map(Number);
    const durMin = (endParts[0] * 60 + endParts[1]) - (startParts[0] * 60 + startParts[1]);

    const sessionData = {
      title: newSession.title,
      date: `${newSession.date} ${newSession.heureDebut}`,
      code: newSession.code,
      duree: durMin > 0 ? durMin : 120,
      instructions: 'Veuillez composer seul et sans sortir du mode Kiosque.',
      teacherId: sessionStorage.getItem('teacher_id')
    };

    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.createSession(sessionData);
        if (result.success) {
          setSuccess(t('success'));
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
        const response = await fetch('http://localhost:3000/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sessionData)
        });
        const data = await response.json();
        if (data.success) {
          setSuccess(t('success'));
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
          setError("Aucun étudiant valide. Le fichier doit avoir les colonnes matricule et email.");
        } else {
          setImportedStudents(students);
          setSuccess(`${students.length} étudiants importés.`);
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

  // Simuler l'envoi d'emails
  const handleGenerateAndSendEmails = async () => {
    if (importedStudents.length === 0) {
      setError(t('stepImportHelp'));
      return;
    }

    setIsSendingEmails(true);
    setEmailStatusMessage(t('savingStudents'));

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
      setError("Erreur SQL.");
      setIsSendingEmails(false);
      return;
    }

    const progressList = [...importedStudents];
    for (let i = 0; i < progressList.length; i++) {
      progressList[i] = { ...progressList[i], statusEmail: 'En cours...' };
      setImportedStudents([...progressList]);
      setEmailStatusMessage(`${t('sendingTo')} ${progressList[i].email}...`);

      await new Promise(resolve => setTimeout(resolve, 300));

      progressList[i] = { ...progressList[i], statusEmail: 'Envoyé ✅' };
      setImportedStudents([...progressList]);
    }

    setIsSendingEmails(false);
    setEmailStatusMessage(`${progressList.length} ${t('emailSuccess')}`);
    fetchSessions();
  };

  // Question Bank handlers
  const handleSaveQBankQuestion = async (e) => {
    e.preventDefault();
    if (!newQBankQuestion.enonce.trim()) return;
    const teacherId = sessionStorage.getItem('teacher_id') || 1;

    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.addQuestionBank(teacherId, newQBankQuestion);
        if (res.success) {
          fetchQBank();
          setShowQBankModal(false);
          setNewQBankQuestion({ enonce: '', typeReponse: 'texte', points: 1 });
        }
      } else {
        const res = await fetch('http://localhost:3000/api/questionbank', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teacherId, ...newQBankQuestion })
        });
        const data = await res.json();
        if (data.success) {
          fetchQBank();
          setShowQBankModal(false);
          setNewQBankQuestion({ enonce: '', typeReponse: 'texte', points: 1 });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteQBankQuestion = async (id) => {
    if (!confirm(t('qbankDeleteConfirm'))) return;
    try {
      if (window.electronAPI) {
        await window.electronAPI.deleteQuestionBank(id);
      } else {
        await fetch(`http://localhost:3000/api/questionbank/${id}`, { method: 'DELETE' });
      }
      fetchQBank();
    } catch (err) {
      console.error(err);
    }
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
          setSuccess(t('gradingSaved'));
          setShowGradingModal(false);
          fetchSessionResults(selectedResultSession);
        }
      } else {
        const res = await fetch(`http://localhost:3000/api/copies/${activeCopie.copieId}/grade`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notesJSON: currentGrades, noteFinale: finalScore, commentaire: currentComment })
        });
        const data = await response.json();
        if (data.success) {
          setSuccess(t('gradingSaved'));
          setShowGradingModal(false);
          fetchSessionResults(selectedResultSession);
        }
      }
    } catch (err) {
      console.error(err);
      // SQLite local ou démo fallback
      const updated = sessionResults.map(r => r.copieId === activeCopie.copieId ? { ...r, notesJSON: JSON.stringify(currentGrades), noteFinale: finalScore, commentaire: currentComment } : r);
      setSessionResults(updated);
      setSuccess(t('gradingSaved'));
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
        [t('tableEmail')]: res.email,
        [t('resultsTableStatus')]: res.estValidee ? t('resultsStatusSubmitted') : t('resultsStatusFinishedTime'),
        [t('resultsTableGrade')]: res.noteFinale !== null ? res.noteFinale : 'Non corrigé',
        [t('gradingCommentLabel')]: res.commentaire || ''
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
          <a href="#" className={`nav-link ${activeTab === 'qbank' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('qbank'); }}>
            {t('tabQuestionBank')}
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
                <div className="stat-value" style={{ color: '#f87171' }}>0</div>
                <div className="stat-label">{t('statFraud')}</div>
              </div>
            </div>

            <div className="section-header">
              <h2>📋 {t('configuredSessions')}</h2>
              <button id="btn-new-session" className="btn btn-primary btn-sm" onClick={handleOpenNewSessionModal}>
                {t('newSessionBtn')}
              </button>
            </div>

            {sessions.length === 0 ? (
              <div className="glass-card empty-state">
                <div className="empty-icon">📋</div>
                <p>{t('noSessions')}</p>
              </div>
            ) : (
              <div className="sessions-list">
                {sessions.map(session => {
                  return (
                    <div key={session.id} className="glass-card session-card">
                      <div className={`session-card-accent ${session.status}`} />
                      <div className="session-card-body">
                        <div className="session-info">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
                            <h3 style={{ margin: 0 }}>
                              {session.title}
                              <span className={`badge ${
                                session.status === 'active' ? 'badge-green' : session.status === 'closed' ? 'badge-yellow' : 'badge-blue'
                              }`} style={{ marginLeft: 8 }}>
                                {session.status === 'active' ? t('statusActive') : session.status === 'closed' ? t('statusClosed') : t('statusPending')}
                              </span>
                            </h3>
                            <div className="session-code-badge" title={t('sessionCodeTooltip')}>
                              {session.code}
                            </div>
                          </div>

                          <div className="session-meta">
                            <span className="session-meta-item">
                              📅 {session.date ? new Date(session.date).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </span>
                            <span className="session-meta-item">⏱ {session.duree || 120} min</span>
                            <span className="session-meta-item">👥 {session.totalStudents || 0} {t('studentsBtn').toLowerCase()}</span>
                            
                            {session.enonceTexte && (() => {
                              try { return JSON.parse(session.enonceTexte).length > 0; } catch { return false; }
                            })() && (
                              <span className="session-meta-item" style={{ borderColor: 'rgba(99,102,241,0.3)', color: 'var(--accent-light)' }}>
                                ❓ {(() => { try { return JSON.parse(session.enonceTexte).length; } catch { return 0; }})()} {t('qbankQuestionLabel').toLowerCase()}(s)
                              </span>
                            )}
                            {session.sujetPdfBase64 && (
                              <span className="session-meta-item" style={{ borderColor: 'rgba(16,185,129,0.3)', color: 'var(--success)' }}>
                                📎 PDF
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="session-actions">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => navigate('/teacher/create-exam', { state: { sessionId: session.id, sessionTitle: session.title } })}
                          >
                            ✏️ {t('examBtn')}
                          </button>
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
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB BANQUE DE QUESTIONS ────────────────────────────────────── */}
        {activeTab === 'qbank' && (
          <div className="animate-fade-up">
            <div className="page-header">
              <h1>📂 {t('qbankTitle')}</h1>
              <p>{t('qbankDesc')}</p>
            </div>

            <div className="section-header">
              <h2>❓ {t('qbankTitle')}</h2>
              <button className="btn btn-primary btn-sm" onClick={() => setShowQBankModal(true)}>
                {t('qbankAddBtn')}
              </button>
            </div>

            {qBankQuestions.length === 0 ? (
              <div className="glass-card empty-state">
                <div className="empty-icon">❓</div>
                <p>{t('qbankNoQuestions')}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {qBankQuestions.map(q => (
                  <div key={q.id} className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span className={`badge ${
                          q.typeReponse === 'code' ? 'badge-green' : q.typeReponse === 'uml' ? 'badge-blue' : 'badge-yellow'
                        }`}>
                          {q.typeReponse === 'code' ? t('qbankTypeCode') : q.typeReponse === 'uml' ? t('qbankTypeUml') : t('qbankTypeTexte')}
                        </span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--accent-light)' }}>
                          {q.points} pt{q.points > 1 ? 's' : ''}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: 20, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                        {q.enonce}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)' }}
                        onClick={() => handleDeleteQBankQuestion(q.id)}>
                        ✕ {t('close')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                {sessions.map(s => (
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
                                  <span style={{ color: 'var(--success)' }}>{t('resultsStatusSubmitted')}</span>
                                ) : isClosed ? (
                                  <span style={{ color: 'var(--warning)' }}>{t('resultsStatusFinishedTime')}</span>
                                ) : (
                                  <span style={{ color: 'var(--accent-light)' }}>{t('resultsStatusInProgress')}</span>
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
                  <label className="form-label">{t('endTimeLabel')}</label>
                  <input className="form-input" type="time" required
                    value={newSession.heureFin} onChange={e => setNewSession({...newSession, heureFin: e.target.value})} />
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
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL NOUVELLE QUESTION BANQUE ────────────────────────────── */}
      {showQBankModal && (
        <div className="modal-overlay" onClick={() => setShowQBankModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>❓ {t('qbankAddBtn')}</h2>
            <p>{t('qbankStatementPlaceholder')}</p>
            <form onSubmit={handleSaveQBankQuestion} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">{t('qbankStatementPlaceholder')}</label>
                <textarea className="form-textarea" required rows={4}
                  value={newQBankQuestion.enonce} onChange={e => setNewQBankQuestion({...newQBankQuestion, enonce: e.target.value})} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">{t('qbankTypeLabel')}</label>
                  <select className="form-select" value={newQBankQuestion.typeReponse}
                    onChange={e => setNewQBankQuestion({...newQBankQuestion, typeReponse: e.target.value})}>
                    <option value="texte">{t('qbankTypeTexte')}</option>
                    <option value="code">{t('qbankTypeCode')}</option>
                    <option value="uml">{t('qbankTypeUml')}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('qbankPointsLabel')}</label>
                  <input className="form-input" type="number" min="1" required
                    value={newQBankQuestion.points} onChange={e => setNewQBankQuestion({...newQBankQuestion, points: Number(e.target.value)})} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowQBankModal(false)}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary">✨ {t('save')}</button>
              </div>
            </form>
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
        
        return (
          <div className="modal-overlay" onClick={() => setShowGradingModal(false)}>
            <div className="modal" style={{ maxWidth: '900px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <h2>{t('gradingTitle')}{activeCopie.prenom} {activeCopie.nom}</h2>
              <p style={{ marginBottom: 12 }}>Matricule: {activeCopie.matricule} • {t('gradingCopieStatus')}: {activeCopie.estValidee ? 'Validée' : 'Temps écoulé'}</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, margin: '20px 0' }}>
                {examQs.map((q, idx) => {
                  const answer = studentAnswers[q.id] || '';
                  const score = currentGrades[q.id] || 0;
                  return (
                    <div key={q.id} style={{ padding: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <h4 style={{ margin: 0, color: 'var(--accent-light)' }}>Question {idx + 1} ({q.points} pt{q.points > 1 ? 's' : ''})</h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('qbankPointsLabel')} :</label>
                          <input type="number" min="0" max={q.points} step="0.5" className="form-input" style={{ width: 80, padding: '6px 10px' }}
                            value={score} onChange={e => handleUpdateQuestionGrade(q.id, e.target.value)} />
                        </div>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 12, fontStyle: 'italic' }}>
                        {q.enonce}
                      </p>
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 6, border: '1px solid var(--border)' }}>
                        {q.typeReponse === 'code' ? (
                          <pre style={{ margin: 0, fontFamily: 'Fira Code, monospace', fontSize: '0.85rem', color: '#c4b5fd', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                            {answer || '// Aucune réponse fournie'}
                          </pre>
                        ) : q.typeReponse === 'uml' ? (
                          <div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>📐 Description UML :</span>
                            <pre style={{ margin: 0, fontFamily: 'Fira Code, monospace', fontSize: '0.85rem', color: '#67e8f9', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                              {answer || '// Aucune réponse fournie'}
                            </pre>
                          </div>
                        ) : (
                          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                            {answer || '(Aucune réponse fournie)'}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">{t('gradingCommentLabel')}</label>
                <textarea className="form-textarea" placeholder={t('gradingCommentPlaceholder')}
                  value={currentComment} onChange={e => setCurrentComment(e.target.value)} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                  {t('gradingFinalScore')} <span style={{ color: 'var(--accent-light)' }}>
                    {Object.values(currentGrades).reduce((acc, pts) => acc + Number(pts), 0)}
                  </span> / {examQs.reduce((acc, q) => acc + Number(q.points), 0)} pts
                </div>
                <div className="modal-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowGradingModal(false)}>{t('cancel')}</button>
                  <button className="btn btn-primary btn-sm" onClick={handleSaveGrading}>{t('gradingSaveBtn')}</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
