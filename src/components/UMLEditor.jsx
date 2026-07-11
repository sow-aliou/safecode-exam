import { useState, useEffect, useRef, useCallback } from 'react';

// Dimensions par défaut des cartes de classe
const CARD_WIDTH = 180;
const CARD_HEIGHT = 120;

export default function UMLEditor({ value, onChange, readOnly = false }) {
  // ─── États principaux ───
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);

  // État pour la création de relation
  const [isLinking, setIsLinking] = useState(false);
  const [linkingSourceId, setLinkingSourceId] = useState(null);

  // État de drag-and-drop
  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // ─── Initialisation ───
  useEffect(() => {
    if (!value) {
      setNodes([]);
      setEdges([]);
      return;
    }
    try {
      const parsed = JSON.parse(value);
      const diagram = parsed.diagram || parsed;
      if (Array.isArray(diagram.nodes) && Array.isArray(diagram.edges)) {
        setNodes(diagram.nodes);
        setEdges(diagram.edges);
      }
    } catch (_) {
      // Ignorer si format incorrect ou texte brut hérité
    }
  }, [value]);

  // ─── Notification parent (debounce/sauvegarde) ───
  const updateParent = useCallback((newNodes, newEdges) => {
    if (readOnly) return;
    
    // Génération automatique d'une description textuelle de secours
    let textRep = "";
    newNodes.forEach(n => {
      textRep += `Classe ${n.name}\n`;
      n.attributes.forEach(a => { textRep += `  - ${a}\n`; });
      n.methods.forEach(m => { textRep += `  + ${m}\n`; });
      textRep += "\n";
    });
    newEdges.forEach(e => {
      const fromNode = newNodes.find(n => n.id === e.from);
      const toNode = newNodes.find(n => n.id === e.to);
      if (fromNode && toNode) {
        const typeStr = e.type === 'generalization' ? '--|>' :
                        e.type === 'composition' ? '--*' :
                        e.type === 'aggregation' ? '--o' : '-->';
        textRep += `${fromNode.name} [${e.fromMultiplicity || ''}] ${typeStr} [${e.toMultiplicity || ''}] ${toNode.name}\n`;
      }
    });

    onChange(JSON.stringify({
      text: textRep,
      diagram: { nodes: newNodes, edges: newEdges }
    }));
  }, [onChange, readOnly]);

  // ─── Actions sur les Classes ───
  const handleAddClass = () => {
    if (readOnly) return;
    const name = `Classe_${nodes.length + 1}`;
    const newNode = {
      id: String(Date.now()),
      name,
      attributes: ['attribut1: String'],
      methods: ['methode1()'],
      x: 50 + (nodes.length * 30) % 300,
      y: 50 + (nodes.length * 20) % 200
    };
    const updatedNodes = [...nodes, newNode];
    setNodes(updatedNodes);
    setSelectedNodeId(newNode.id);
    setSelectedEdgeId(null);
    updateParent(updatedNodes, edges);
  };

  const handleUpdateNode = (id, field, value) => {
    if (readOnly) return;
    const updatedNodes = nodes.map(n => n.id === id ? { ...n, [field]: value } : n);
    setNodes(updatedNodes);
    updateParent(updatedNodes, edges);
  };

  const handleDeleteNode = (id) => {
    if (readOnly) return;
    const updatedNodes = nodes.filter(n => n.id !== id);
    const updatedEdges = edges.filter(e => e.from !== id && e.to !== id);
    setNodes(updatedNodes);
    setEdges(updatedEdges);
    if (selectedNodeId === id) setSelectedNodeId(null);
    updateParent(updatedNodes, updatedEdges);
  };

  // ─── Actions sur les Relations ───
  const handleStartLink = () => {
    if (readOnly) return;
    setIsLinking(true);
    setLinkingSourceId(null);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  };

  const handleNodeClick = (nodeId) => {
    if (readOnly) return;
    if (isLinking) {
      if (!linkingSourceId) {
        setLinkingSourceId(nodeId);
      } else if (linkingSourceId !== nodeId) {
        // Créer la relation
        const newEdge = {
          id: String(Date.now()),
          from: linkingSourceId,
          to: nodeId,
          type: 'association', // default
          fromMultiplicity: '',
          toMultiplicity: ''
        };
        const updatedEdges = [...edges, newEdge];
        setEdges(updatedEdges);
        setIsLinking(false);
        setLinkingSourceId(null);
        setSelectedEdgeId(newEdge.id);
        updateParent(nodes, updatedEdges);
      } else {
        // Annuler si même noeud cliqué
        setIsLinking(false);
        setLinkingSourceId(null);
      }
    } else {
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
    }
  };

  const handleUpdateEdge = (id, field, value) => {
    if (readOnly) return;
    const updatedEdges = edges.map(e => e.id === id ? { ...e, [field]: value } : e);
    setEdges(updatedEdges);
    updateParent(nodes, updatedEdges);
  };

  const handleDeleteEdge = (id) => {
    if (readOnly) return;
    const updatedEdges = edges.filter(e => e.id !== id);
    setEdges(updatedEdges);
    if (selectedEdgeId === id) setSelectedEdgeId(null);
    updateParent(nodes, updatedEdges);
  };

  // ─── Drag and Drop ───
  const handleMouseDown = (e, nodeId) => {
    if (readOnly || isLinking) return;
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    const node = nodes.find(n => n.id === nodeId);
    if (node && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left + containerRef.current.scrollLeft;
      const mouseY = e.clientY - rect.top + containerRef.current.scrollTop;
      dragOffset.current = {
        x: mouseX - node.x,
        y: mouseY - node.y
      };
      setDraggedNodeId(nodeId);
    }
  };

  const handleMouseMove = (e) => {
    if (draggedNodeId && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left + containerRef.current.scrollLeft;
      const mouseY = e.clientY - rect.top + containerRef.current.scrollTop;
      
      // Limiter dans la zone du SVG
      let newX = Math.max(0, mouseX - dragOffset.current.x);
      let newY = Math.max(0, mouseY - dragOffset.current.y);

      setNodes(prev => prev.map(n => n.id === draggedNodeId ? { ...n, x: newX, y: newY } : n));
    }
  };

  const handleMouseUp = () => {
    if (draggedNodeId) {
      setDraggedNodeId(null);
      updateParent(nodes, edges);
    }
  };

  // ─── Calculs d'intersections pour tracer les flèches proprement ───
  const getIntersectionPoint = (fromNode, toNode) => {
    const cx1 = fromNode.x + CARD_WIDTH / 2;
    const cy1 = fromNode.y + CARD_HEIGHT / 2;
    const cx2 = toNode.x + CARD_WIDTH / 2;
    const cy2 = toNode.y + CARD_HEIGHT / 2;

    const dx = cx2 - cx1;
    const dy = cy2 - cy1;

    let ix = cx2;
    let iy = cy2;

    if (Math.abs(dx) > 0.01) {
      const slope = dy / dx;
      const edgeX = dx > 0 ? toNode.x : toNode.x + CARD_WIDTH;
      const edgeY = cy2 + slope * (edgeX - cx2);

      if (edgeY >= toNode.y && edgeY <= toNode.y + CARD_HEIGHT) {
        ix = edgeX;
        iy = edgeY;
      } else {
        const edgeY2 = dy > 0 ? toNode.y : toNode.y + CARD_HEIGHT;
        const edgeX2 = cx2 + (edgeY2 - cy2) / slope;
        ix = edgeX2;
        iy = edgeY2;
      }
    } else {
      iy = dy > 0 ? toNode.y : toNode.y + CARD_HEIGHT;
    }
    return { x: ix, y: iy };
  };

  const getLabelCoords = (start, end, ratio) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = -dy / len * 15;
    const py = dx / len * 15;
    return {
      x: start.x + dx * ratio + px,
      y: start.y + dy * ratio + py
    };
  };

  // Sélections actives
  const activeNode = nodes.find(n => n.id === selectedNodeId);
  const activeEdge = edges.find(e => e.id === selectedEdgeId);

  return (
    <div style={{ display: 'flex', gap: 16, height: '100%', minHeight: 480, width: '100%' }}>
      {/* Canevas SVG de dessin */}
      <div 
        style={{
          flex: 1,
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          background: '#040710',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0
        }}
      >
        {/* Barre d'outils canevas */}
        {!readOnly && (
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.02)',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            zIndex: 10
          }}>
            <button 
              type="button" 
              className="btn btn-ghost btn-sm" 
              onClick={handleAddClass}
              style={{ fontSize: '0.8rem' }}
            >
              ➕ Classe
            </button>
            <button 
              type="button" 
              className={`btn btn-ghost btn-sm ${isLinking ? 'active' : ''}`}
              onClick={handleStartLink}
              style={{ 
                fontSize: '0.8rem',
                borderColor: isLinking ? 'var(--accent)' : 'transparent',
                background: isLinking ? 'rgba(99,102,241,0.1)' : 'transparent'
              }}
            >
              🔗 {isLinking ? (linkingSourceId ? 'Sélectionnez cible...' : 'Sélectionnez source...') : 'Relier'}
            </button>
            {isLinking && (
              <button 
                type="button" 
                className="btn btn-ghost btn-sm"
                onClick={() => { setIsLinking(false); setLinkingSourceId(null); }}
                style={{ fontSize: '0.75rem', color: 'var(--danger)' }}
              >
                Annuler
              </button>
            )}
          </div>
        )}

        <div 
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{ flex: 1, overflow: 'auto', background: '#040710', minHeight: 0 }}
        >
          <svg 
            style={{ width: 3000, height: 3000, cursor: isLinking ? 'crosshair' : 'default' }}
          onClick={() => {
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
            if (isLinking) {
              setIsLinking(false);
              setLinkingSourceId(null);
            }
          }}
        >
          {/* Définitions des flèches UML */}
          <defs>
            {/* Généralisation / Héritage (triangle vide) */}
            <marker 
              id="generalization" 
              viewBox="0 0 10 10" 
              refX="8" 
              refY="5" 
              markerWidth="8" 
              markerHeight="8" 
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#040710" stroke="#8b5cf6" strokeWidth="1.5" />
            </marker>

            {/* Composition (losange plein) */}
            <marker 
              id="composition" 
              viewBox="0 0 10 10" 
              refX="8" 
              refY="5" 
              markerWidth="9" 
              markerHeight="9" 
              orient="auto-start-reverse"
            >
              <path d="M 0 5 L 5 0 L 10 5 L 5 10 z" fill="#8b5cf6" />
            </marker>

            {/* Agrégation (losange vide) */}
            <marker 
              id="aggregation" 
              viewBox="0 0 10 10" 
              refX="8" 
              refY="5" 
              markerWidth="9" 
              markerHeight="9" 
              orient="auto-start-reverse"
            >
              <path d="M 0 5 L 5 0 L 10 5 L 5 10 z" fill="#040710" stroke="#8b5cf6" strokeWidth="1.5" />
            </marker>

            {/* Association (pointe simple) */}
            <marker 
              id="association" 
              viewBox="0 0 10 10" 
              refX="8" 
              refY="5" 
              markerWidth="8" 
              markerHeight="8" 
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10" fill="none" stroke="#8b5cf6" strokeWidth="1.5" />
            </marker>
          </defs>

          {/* Relations (Liens) */}
          {edges.map(e => {
            const fromNode = nodes.find(n => n.id === e.from);
            const toNode = nodes.find(n => n.id === e.to);
            if (!fromNode || !toNode) return null;

            const start = getIntersectionPoint(toNode, fromNode);
            const end = getIntersectionPoint(fromNode, toNode);
            const isSelected = selectedEdgeId === e.id;

            // Coordonnées pour les multiplicités
            const labelFrom = getLabelCoords(start, end, 0.15);
            const labelTo = getLabelCoords(start, end, 0.85);

            return (
              <g 
                key={e.id}
                onClick={(ev) => {
                  ev.stopPropagation();
                  setSelectedEdgeId(e.id);
                  setSelectedNodeId(null);
                }}
                style={{ cursor: 'pointer' }}
              >
                {/* Ligne invisible plus large pour faciliter le clic */}
                <path 
                  d={`M ${start.x} ${start.y} L ${end.x} ${end.y}`} 
                  stroke="transparent" 
                  strokeWidth="10" 
                />
                
                {/* Ligne de la relation */}
                <path 
                  d={`M ${start.x} ${start.y} L ${end.x} ${end.y}`} 
                  stroke={isSelected ? 'var(--accent)' : '#8b5cf6'} 
                  strokeWidth={isSelected ? '3' : '1.8'} 
                  markerEnd={`url(#${e.type})`}
                />

                {/* Multiplicité source */}
                {e.fromMultiplicity && (
                  <text 
                    x={labelFrom.x} 
                    y={labelFrom.y} 
                    fill="#94a3b8" 
                    fontSize="10" 
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {e.fromMultiplicity}
                  </text>
                )}

                {/* Multiplicité cible */}
                {e.toMultiplicity && (
                  <text 
                    x={labelTo.x} 
                    y={labelTo.y} 
                    fill="#94a3b8" 
                    fontSize="10" 
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {e.toMultiplicity}
                  </text>
                )}
              </g>
            );
          })}

          {/* Classes (Noeuds) */}
          {nodes.map(n => {
            const isSelected = selectedNodeId === n.id;
            const isLinkingSource = linkingSourceId === n.id;

            return (
              <g 
                key={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                onClick={(ev) => {
                  ev.stopPropagation();
                  handleNodeClick(n.id);
                }}
                style={{ cursor: isLinking ? 'pointer' : 'default' }}
              >
                {/* Ombre et contour de sélection */}
                <rect 
                  width={CARD_WIDTH} 
                  height={CARD_HEIGHT} 
                  rx="6" 
                  fill={isLinkingSource ? 'rgba(99,102,241,0.2)' : '#0f172a'}
                  stroke={isLinkingSource ? 'var(--accent)' : isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.08)'} 
                  strokeWidth={isSelected || isLinkingSource ? '2.5' : '1.2'}
                  style={{ filter: isSelected ? 'drop-shadow(0 4px 12px rgba(99,102,241,0.25))' : 'none' }}
                />

                {/* En-tête de classe (Drag handler) */}
                <rect 
                  width={CARD_WIDTH} 
                  height="32" 
                  rx="5"
                  fill="rgba(255,255,255,0.02)"
                  onMouseDown={(ev) => handleMouseDown(ev, n.id)}
                  style={{ cursor: readOnly ? 'default' : 'grab' }}
                />

                {/* Titre de la classe */}
                <text 
                  x={CARD_WIDTH / 2} 
                  y="20" 
                  fill="#fff" 
                  fontWeight="bold" 
                  fontSize="12" 
                  textAnchor="middle"
                >
                  {n.name}
                </text>

                {/* Ligne séparatrice 1 */}
                <line x1="0" y1="32" x2={CARD_WIDTH} y2="32" stroke="rgba(255,255,255,0.08)" />

                {/* Attributs */}
                <g transform="translate(10, 48)">
                  {n.attributes.slice(0, 3).map((attr, idx) => (
                    <text key={idx} y={idx * 14} fill="#e2e8f0" fontSize="10">
                      {attr.length > 25 ? attr.slice(0, 22) + '...' : attr}
                    </text>
                  ))}
                  {n.attributes.length > 3 && (
                    <text y="42" fill="#94a3b8" fontSize="9" fontStyle="italic">
                      + {n.attributes.length - 3} autres...
                    </text>
                  )}
                </g>

                {/* Ligne séparatrice 2 */}
                <line x1="0" y1="92" x2={CARD_WIDTH} y2="92" stroke="rgba(255,255,255,0.08)" />

                {/* Méthodes */}
                <g transform="translate(10, 106)">
                  {n.methods.slice(0, 2).map((m, idx) => (
                    <text key={idx} y={idx * 14} fill="#cbd5e1" fontSize="10">
                      {m.length > 25 ? m.slice(0, 22) + '...' : m}
                    </text>
                  ))}
                  {n.methods.length > 2 && (
                    <text y="28" fill="#94a3b8" fontSize="9" fontStyle="italic">
                      + {n.methods.length - 2} autres...
                    </text>
                  )}
                </g>
              </g>
            );
          })}
        </svg>
        </div>
      </div>

      {/* Panneau de configuration latéral */}
      {!readOnly && (activeNode || activeEdge) && (
        <div 
          className="glass-card animate-fade-in"
          style={{
            width: 250,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            border: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.02)',
            maxHeight: '100%',
            overflowY: 'auto'
          }}
        >
          {/* CONFIGURATION CLASSE */}
          {activeNode && (
            <>
              <h3 style={{ fontSize: '0.95rem', margin: 0, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                ✏️ Classe : {activeNode.name}
              </h3>
              
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Nom de classe</label>
                <input 
                  className="form-input" 
                  value={activeNode.name} 
                  onChange={e => handleUpdateNode(activeNode.id, 'name', e.target.value)} 
                />
              </div>

              {/* Attributs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', margin: 0 }}>Attributs</label>
                  <button 
                    type="button" 
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                    onClick={() => {
                      const updatedAttrs = [...activeNode.attributes, 'nouveau: Type'];
                      handleUpdateNode(activeNode.id, 'attributes', updatedAttrs);
                    }}
                  >
                    +
                  </button>
                </div>
                {activeNode.attributes.map((attr, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 4 }}>
                    <input 
                      className="form-input" 
                      style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                      value={attr}
                      onChange={e => {
                        const copy = [...activeNode.attributes];
                        copy[idx] = e.target.value;
                        handleUpdateNode(activeNode.id, 'attributes', copy);
                      }}
                    />
                    <button 
                      type="button" 
                      className="btn btn-ghost"
                      style={{ color: 'var(--danger)', fontSize: '0.75rem', border: 'none', padding: '0 6px' }}
                      onClick={() => {
                        const copy = activeNode.attributes.filter((_, i) => i !== idx);
                        handleUpdateNode(activeNode.id, 'attributes', copy);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Méthodes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', margin: 0 }}>Méthodes</label>
                  <button 
                    type="button" 
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                    onClick={() => {
                      const updatedMets = [...activeNode.methods, 'nouvelle()'];
                      handleUpdateNode(activeNode.id, 'methods', updatedMets);
                    }}
                  >
                    +
                  </button>
                </div>
                {activeNode.methods.map((met, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 4 }}>
                    <input 
                      className="form-input" 
                      style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                      value={met}
                      onChange={e => {
                        const copy = [...activeNode.methods];
                        copy[idx] = e.target.value;
                        handleUpdateNode(activeNode.id, 'methods', copy);
                      }}
                    />
                    <button 
                      type="button" 
                      className="btn btn-ghost"
                      style={{ color: 'var(--danger)', fontSize: '0.75rem', border: 'none', padding: '0 6px' }}
                      onClick={() => {
                        const copy = activeNode.methods.filter((_, i) => i !== idx);
                        handleUpdateNode(activeNode.id, 'methods', copy);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button 
                type="button" 
                className="btn btn-block btn-ghost"
                style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: 12 }}
                onClick={() => handleDeleteNode(activeNode.id)}
              >
                🗑️ Supprimer Classe
              </button>
            </>
          )}

          {/* CONFIGURATION RELATION */}
          {activeEdge && (
            <>
              <h3 style={{ fontSize: '0.95rem', margin: 0, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                ✏️ Relation
              </h3>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Type de relation</label>
                <select 
                  className="form-select"
                  value={activeEdge.type}
                  onChange={e => handleUpdateEdge(activeEdge.id, 'type', e.target.value)}
                >
                  <option value="association">Association (Simple)</option>
                  <option value="generalization">Héritage (Généralisation)</option>
                  <option value="aggregation">Agrégation</option>
                  <option value="composition">Composition</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Mult. Source (gauche/haut)</label>
                <input 
                  className="form-input" 
                  placeholder="ex: 1, 0..*" 
                  value={activeEdge.fromMultiplicity}
                  onChange={e => handleUpdateEdge(activeEdge.id, 'fromMultiplicity', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Mult. Cible (droite/bas)</label>
                <input 
                  className="form-input" 
                  placeholder="ex: 1, 0..*" 
                  value={activeEdge.toMultiplicity}
                  onChange={e => handleUpdateEdge(activeEdge.id, 'toMultiplicity', e.target.value)}
                />
              </div>

              <button 
                type="button" 
                className="btn btn-block btn-ghost"
                style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: 12 }}
                onClick={() => handleDeleteEdge(activeEdge.id)}
              >
                🗑️ Supprimer Relation
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
