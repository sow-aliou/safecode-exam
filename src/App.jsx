import { useState } from 'react'
import './index.css'

function App() {
  const [activeTab, setActiveTab] = useState('code');
  const [code, setCode] = useState('');

  const handleCodeChange = (e) => {
    setCode(e.target.value);
    // Sauvegarde locale continue (SQLite via IPC)
    if (window.electronAPI) {
      window.electronAPI.saveCode(e.target.value)
        .catch(err => console.error("Erreur de sauvegarde:", err));
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>SAFECODE-EXAM</h1>
        <div className="tabs">
          <button 
            className={`tab-btn ${activeTab === 'code' ? 'active' : ''}`}
            onClick={() => setActiveTab('code')}
          >
            Rédiger le code source
          </button>
          <button 
            className={`tab-btn ${activeTab === 'uml' ? 'active' : ''}`}
            onClick={() => setActiveTab('uml')}
          >
            Concevoir les diagrammes UML
          </button>
        </div>
        <div>
          <button className="tab-btn active" style={{ backgroundColor: '#ef4444' }}>
            Soumettre la copie
          </button>
        </div>
      </header>

      <main className="main-content">
        {activeTab === 'code' ? (
          <div className="editor-container">
            <h2>Éditeur de Code</h2>
            <textarea 
              className="code-area"
              value={code}
              onChange={handleCodeChange}
              placeholder="Saisissez votre code ici. La sauvegarde automatique est activée."
            />
          </div>
        ) : (
          <div className="uml-container">
            <h2>Outil de Modélisation UML</h2>
            <div className="uml-canvas">
              <p>Interface de conception UML (Espace de travail graphique à intégrer)</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
