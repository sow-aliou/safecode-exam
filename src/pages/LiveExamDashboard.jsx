import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const LiveExamDashboard = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [logs, setLogs] = useState([]);
  const [examInfo, setExamInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal Ajout de Temps
  const [showAddTimeModal, setShowAddTimeModal] = useState(false);
  const [timeToAdd, setTimeToAdd] = useState(15);
  const [successMsg, setSuccessMsg] = useState('');

  const getToken = () => sessionStorage.getItem('teacher_token') || sessionStorage.getItem('student_token');

  const fetchLiveStatus = async () => {
    try {
      let data;
      if (window.electronAPI && window.electronAPI.invoke) {
        data = await window.electronAPI.invoke('get-live-status', sessionId);
      } else {
        const token = getToken();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch(`http://localhost:3000/api/sessions/${sessionId}/live`, { headers });
        data = await response.json();
      }

      if (data && data.success) {
        setStudents(data.students || []);
        setLogs(data.logs || []);
        setError('');
      } else {
        setError(data?.error || "Erreur de chargement");
      }

    } catch (err) {
      console.error(err);
      setError("Erreur de connexion au serveur.");
    } finally {
      setLoading(false);
    }
  };

  const fetchExamInfo = async () => {
    try {
      const examRes = await fetch(`http://localhost:3000/api/sessions/${sessionId}/exam`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const examData = await examRes.json();
      if (examData.success) {
        setExamInfo(examData.exam);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const token = sessionStorage.getItem('teacher_token');
    if (!token) {
      navigate('/teacher/auth');
      return;
    }
    if (window.electronAPI) {
      window.electronAPI.invoke('set-auth-token', token).then(() => {
        fetchExamInfo();
        fetchLiveStatus();
      });
    } else {
      fetchExamInfo();
      fetchLiveStatus();
    }
    const interval = setInterval(fetchLiveStatus, 3000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const getStatus = (student) => {
    if (student.estValidee) {
      return { label: 'Terminé / Soumis', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' }; // Bleu
    }
    if (!student.dernierPing) {
      return { label: 'Hors ligne', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' }; // Rouge
    }
    
    const now = new Date();
    const lastPing = new Date(student.dernierPing);
    const diffSeconds = (now - lastPing) / 1000;
    
    if (diffSeconds < 15) {
      return { label: 'En ligne', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' }; // Vert
    } else {
      return { label: 'Déconnecté', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' }; // Rouge
    }
  };

  const handleAddTimeSubmit = async () => {
    try {
      if (window.electronAPI && window.electronAPI.invoke) {
        const res = await window.electronAPI.invoke('add-session-time', { sessionId, additionalMinutes: timeToAdd });
        if (res.success) {
          setSuccessMsg(`Temps ajouté avec succès (+${timeToAdd} min).`);
          fetchLiveStatus();
        } else {
          setError(res.error || "Erreur lors de l'ajout de temps.");
        }
      } else {
        const res = await fetch(`http://localhost:3000/api/sessions/${sessionId}/add-time`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}` 
          },
          body: JSON.stringify({ additionalMinutes: timeToAdd })
        });
        const data = await res.json();
        if (data.success) {
          setSuccessMsg(`Temps ajouté avec succès (+${timeToAdd} min).`);
          fetchLiveStatus();
        } else {
          setError(data.error || "Erreur lors de l'ajout de temps.");
        }
      }
    } catch (err) {
      console.error("Erreur add-time:", err);
      setError("Erreur: " + (err.message || "Impossible de se connecter"));
    } finally {
      setShowAddTimeModal(false);
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  const getRemainingTime = () => {
    if (!examInfo || !examInfo.date) return null;
    const end = new Date(examInfo.date).getTime() + (examInfo.duree * 60000);
    const now = Date.now();
    const remaining = Math.max(0, Math.floor((end - now) / 1000));
    
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    const s = remaining % 60;
    const pad = n => String(n).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };
  
  // Re-render component every second to update timer
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="gradient-bg" style={{ minHeight: '100vh', padding: '2rem' }}>
      <div className="container" style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '2rem', color: 'var(--text-primary)' }}>📡 Suivi en Direct</h1>
            <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0 0' }}>Session d'examen #{sessionId}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {examInfo && (
              <div style={{ 
                padding: '8px 16px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', 
                color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.3)',
                fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: 700 
              }}>
                ⏱ {getRemainingTime() || '--:--:--'}
              </div>
            )}
            
            <button
              className="btn btn-ghost"
              onClick={() => setShowAddTimeModal(true)}
              style={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.3)', padding: '8px 16px' }}
            >
              ⏱️ + Temps
            </button>

            <button 
              className="btn btn-secondary" 
              onClick={() => navigate('/teacher/dashboard')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '8px 16px' }}
            >
              Retour
            </button>
          </div>
        </header>

        {successMsg && (
          <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '8px', marginBottom: '2rem' }}>
            {successMsg}
          </div>
        )}

        {error && (
          <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', marginBottom: '2rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
          
          {/* Grille des étudiants */}
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              👨‍🎓 Statut des Étudiants ({students.length})
            </h2>
            
            {loading && students.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>Chargement des étudiants...</p>
            ) : students.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>Aucun étudiant n'a encore rejoint cette session.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                {students.map(student => {
                  const status = getStatus(student);
                  const studentLogs = logs.filter(l => l.etudiant_id === student.studentId);
                  const criticalLogs = studentLogs.filter(l => l.criticite === 'Critique').length;

                  return (
                    <div key={student.copieId} style={{ 
                      background: 'rgba(255, 255, 255, 0.05)', 
                      borderRadius: '12px', 
                      padding: '1.5rem',
                      border: `1px solid ${criticalLogs > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.1)'}`,
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      {criticalLogs > 0 && (
                         <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: '#ef4444' }} />
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                        <div>
                          <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem' }}>{student.prenom} {student.nom}</h3>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                            {student.matricule}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                        <span style={{ 
                          display: 'inline-block', 
                          width: '10px', 
                          height: '10px', 
                          borderRadius: '50%', 
                          background: status.color,
                          boxShadow: `0 0 8px ${status.color}`
                        }} />
                        <span style={{ fontSize: '0.9rem', color: status.color, fontWeight: '500' }}>{status.label}</span>
                      </div>

                      {criticalLogs > 0 && (
                        <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          ⚠️ {criticalLogs} alerte(s) critique(s)
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Flux d'activité / Alertes */}
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 150px)' }}>
            <h2 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🚨 Flux d'Activité
            </h2>
            
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {logs.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '2rem' }}>
                  Aucune activité suspecte détectée pour le moment.
                </p>
              ) : (
                logs.map(log => {
                  const isCritical = log.criticite === 'Critique';
                  const student = students.find(s => s.studentId === log.etudiant_id);
                  const studentName = student ? `${student.prenom} ${student.nom}` : `Étudiant #${log.etudiant_id}`;
                  const timeStr = new Date(log.horodatage).toLocaleTimeString();

                  return (
                    <div key={log.id} style={{
                      padding: '1rem',
                      background: isCritical ? 'rgba(239, 68, 68, 0.05)' : 'rgba(245, 158, 11, 0.05)',
                      borderLeft: `4px solid ${isCritical ? '#ef4444' : '#f59e0b'}`,
                      borderRadius: '0 8px 8px 0'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{studentName}</strong>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{timeStr}</span>
                      </div>
                      <div style={{ fontSize: '0.9rem', color: isCritical ? '#ef4444' : '#f59e0b', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                        {log.typeEvenement}
                      </div>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {log.description}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Modal Ajout de Temps */}
      {showAddTimeModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top:0, left:0, right:0, bottom:0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="glass-card modal-content" style={{ padding: '24px', width: '90%', maxWidth: '400px', animation: 'scale-up 0.3s ease' }}>
            <h2 style={{ marginTop: 0, marginBottom: '16px', fontSize: '1.2rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⏱️ Ajouter du Temps
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Prolonger la durée de l'examen en cours.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
              {[5, 10, 15, 30].map(mins => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setTimeToAdd(mins)}
                  style={{
                    padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
                    background: timeToAdd === mins ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)',
                    color: timeToAdd === mins ? '#f59e0b' : '#fff', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s'
                  }}
                >
                  + {mins} minutes
                </button>
              ))}
            </div>
            
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Ou définir manuellement (minutes) :</label>
              <input
                type="number"
                className="form-input"
                min="1"
                value={timeToAdd}
                onChange={e => setTimeToAdd(Number(e.target.value))}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                type="button" 
                className="btn btn-ghost" 
                onClick={() => setShowAddTimeModal(false)}
              >
                Annuler
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleAddTimeSubmit}
                style={{ background: '#f59e0b', border: 'none', color: '#fff' }}
              >
                Confirmer l'ajout
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default LiveExamDashboard;
