import { useState, useEffect, useRef, useCallback } from 'react';

// Dimensions de base par type de noeud
const SIZES = {
  class: { w: 180, h: 120 },
  actor: { w: 60, h: 90 },
  use_case: { w: 160, h: 80 },
  lifeline: { w: 120, h: 40 }, // La ligne descend dynamiquement, mais la hitbox de base est le rectangle du haut
  activity: { w: 140, h: 60 },
  note: { w: 150, h: 80 },
  system_boundary: { w: 300, h: 400 },
  activation: { w: 20, h: 100 },
  fragment: { w: 300, h: 200 }
};

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
  
  // État de redimensionnement
  const [resizingNodeId, setResizingNodeId] = useState(null);
  const resizeStart = useRef({ w: 0, h: 0, x: 0, y: 0 });

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
        // Migration rétrocompatible (attribuer type 'class' par défaut)
        setNodes(diagram.nodes.map(n => ({ ...n, type: n.type || 'class' })));
        setEdges(diagram.edges);
      }
    } catch (_) {
      // Ignorer si format incorrect
    }
  }, [value]);

  // ─── Notification parent (debounce/sauvegarde) ───
  const updateParent = useCallback((newNodes, newEdges) => {
    if (readOnly) return;
    
    // Génération automatique d'une description textuelle de secours
    let textRep = "";
    newNodes.forEach(n => {
      textRep += `[${(n.type || 'class').toUpperCase()}] ${n.name}\n`;
      if (n.type === 'class') {
        n.attributes?.forEach(a => { textRep += `  - ${a}\n`; });
        n.methods?.forEach(m => { textRep += `  + ${m}\n`; });
      }
      textRep += "\n";
    });
    newEdges.forEach(e => {
      const fromNode = newNodes.find(n => n.id === e.from);
      const toNode = newNodes.find(n => n.id === e.to);
      if (fromNode && toNode) {
        textRep += `${fromNode.name} [${e.fromMultiplicity || ''}] --(${e.type})--> [${e.toMultiplicity || ''}] ${toNode.name}\n`;
      }
    });

    onChange(JSON.stringify({
      text: textRep,
      diagram: { nodes: newNodes, edges: newEdges }
    }));
  }, [onChange, readOnly]);

  // ─── Actions sur les Noeuds ───
  const handleAddNode = (type) => {
    if (readOnly) return;
    
    let defaultName = "Nouvel Élément";
    if (type === 'class') defaultName = `Classe_${nodes.length + 1}`;
    if (type === 'actor') defaultName = "Acteur";
    if (type === 'use_case') defaultName = "Cas d'utilisation";
    if (type === 'lifeline') defaultName = ":Objet";
    if (type === 'activity') defaultName = "Action";
    if (type === 'note') defaultName = "Commentaire...";
    if (type === 'system_boundary') defaultName = "Système";
    if (type === 'activation') defaultName = "";
    if (type === 'fragment') defaultName = "alt";

    const newNode = {
      id: String(Date.now()),
      type,
      name: defaultName,
      attributes: type === 'class' ? ['attribut: Type'] : [],
      methods: type === 'class' ? ['methode()'] : [],
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

  // ─── Drag, Drop & Resize ───
  const handleResizeMouseDown = (e, nodeId) => {
    if (readOnly) return;
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    const node = nodes.find(n => n.id === nodeId);
    if (node && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left + containerRef.current.scrollLeft;
      const mouseY = e.clientY - rect.top + containerRef.current.scrollTop;
      const defaultSize = SIZES[node.type || 'class'] || SIZES.class;
      resizeStart.current = {
        w: node.w || defaultSize.w,
        h: node.h || defaultSize.h,
        x: mouseX,
        y: mouseY
      };
      setResizingNodeId(nodeId);
    }
  };

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
      let newX = Math.max(0, mouseX - dragOffset.current.x);
      let newY = Math.max(0, mouseY - dragOffset.current.y);
      setNodes(prev => prev.map(n => n.id === draggedNodeId ? { ...n, x: newX, y: newY } : n));
    } else if (resizingNodeId && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left + containerRef.current.scrollLeft;
      const mouseY = e.clientY - rect.top + containerRef.current.scrollTop;
      const dx = mouseX - resizeStart.current.x;
      const dy = mouseY - resizeStart.current.y;
      
      setNodes(prev => prev.map(n => {
        if (n.id === resizingNodeId) {
          return {
            ...n,
            w: Math.max(50, resizeStart.current.w + dx),
            h: Math.max(40, resizeStart.current.h + dy)
          };
        }
        return n;
      }));
    }
  };

  const handleMouseUp = () => {
    if (draggedNodeId) {
      setDraggedNodeId(null);
      updateParent(nodes, edges);
    }
    if (resizingNodeId) {
      setResizingNodeId(null);
      updateParent(nodes, edges);
    }
  };

  // ─── Calculs Géométriques ───
  const getIntersectionPoint = (fromNode, toNode) => {
    const defaultSizeFrom = SIZES[fromNode.type || 'class'] || SIZES.class;
    const sFrom = { w: fromNode.w || defaultSizeFrom.w, h: fromNode.h || defaultSizeFrom.h };
    const defaultSizeTo = SIZES[toNode.type || 'class'] || SIZES.class;
    const sTo = { w: toNode.w || defaultSizeTo.w, h: toNode.h || defaultSizeTo.h };

    const cx1 = fromNode.x + sFrom.w / 2;
    const cy1 = fromNode.y + (fromNode.type === 'lifeline' ? sFrom.h / 2 : sFrom.h / 2);
    const cx2 = toNode.x + sTo.w / 2;
    const cy2 = toNode.y + (toNode.type === 'lifeline' ? sTo.h / 2 : sTo.h / 2);

    const dx = cx2 - cx1;
    const dy = cy2 - cy1;

    let ix = cx2, iy = cy2;
    if (Math.abs(dx) > 0.01) {
      const slope = dy / dx;
      const edgeX = dx > 0 ? toNode.x : toNode.x + sTo.w;
      const edgeY = cy2 + slope * (edgeX - cx2);

      if (edgeY >= toNode.y && edgeY <= toNode.y + sTo.h) {
        ix = edgeX; iy = edgeY;
      } else {
        const edgeY2 = dy > 0 ? toNode.y : toNode.y + sTo.h;
        const edgeX2 = cx2 + (edgeY2 - cy2) / slope;
        ix = edgeX2; iy = edgeY2;
      }
    } else {
      iy = dy > 0 ? toNode.y : toNode.y + sTo.h;
    }
    
    if (toNode.type === 'actor' || toNode.type === 'use_case') {
      const angle = Math.atan2(cy2 - cy1, cx2 - cx1);
      ix = cx2 - (sTo.w/2) * Math.cos(angle);
      iy = cy2 - (sTo.h/2) * Math.sin(angle);
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

  // ─── Rendu Spécifique des Noeuds ───
  const renderNodeShape = (n, isSelected, isLinkingSource) => {
    const defaultSize = SIZES[n.type || 'class'] || SIZES.class;
    const s = { w: n.w || defaultSize.w, h: n.h || defaultSize.h };
    const strokeColor = isLinkingSource ? 'var(--accent)' : isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.08)';
    const strokeW = isSelected || isLinkingSource ? '2.5' : '1.2';
    const fillBG = isLinkingSource ? 'rgba(99,102,241,0.2)' : '#0f172a';

    switch (n.type) {
      case 'actor':
        return (
          <g>
            <rect width={s.w} height={s.h} fill="transparent" />
            <circle cx={s.w/2} cy="20" r="15" fill={fillBG} stroke={strokeColor} strokeWidth={strokeW} />
            <line x1={s.w/2} y1="35" x2={s.w/2} y2="65" stroke={strokeColor} strokeWidth={strokeW} />
            <line x1="10" y1="45" x2={s.w-10} y2="45" stroke={strokeColor} strokeWidth={strokeW} />
            <line x1={s.w/2} y1="65" x2="15" y2="90" stroke={strokeColor} strokeWidth={strokeW} />
            <line x1={s.w/2} y1="65" x2={s.w-15} y2="90" stroke={strokeColor} strokeWidth={strokeW} />
            <text x={s.w/2} y={s.h + 15} fill="#fff" fontSize="12" textAnchor="middle" fontWeight="bold">{n.name}</text>
          </g>
        );
      case 'use_case':
        return (
          <g>
            <ellipse cx={s.w/2} cy={s.h/2} rx={s.w/2} ry={s.h/2} fill={fillBG} stroke={strokeColor} strokeWidth={strokeW} />
            <text x={s.w/2} y={s.h/2 + 4} fill="#fff" fontSize="12" textAnchor="middle" fontWeight="bold">
              {n.name.length > 20 ? n.name.slice(0,18)+'...' : n.name}
            </text>
          </g>
        );
      case 'lifeline':
        return (
          <g>
            <line x1={s.w/2} y1={s.h} x2={s.w/2} y2="400" stroke={strokeColor} strokeWidth="1.5" strokeDasharray="5,5" />
            <rect width={s.w} height={s.h} rx="4" fill={fillBG} stroke={strokeColor} strokeWidth={strokeW} />
            <text x={s.w/2} y={s.h/2 + 4} fill="#fff" fontSize="12" textAnchor="middle" fontWeight="bold">{n.name}</text>
          </g>
        );
      case 'activity':
        return (
          <g>
            <rect width={s.w} height={s.h} rx={s.h/2} fill={fillBG} stroke={strokeColor} strokeWidth={strokeW} />
            <text x={s.w/2} y={s.h/2 + 4} fill="#fff" fontSize="12" textAnchor="middle" fontWeight="bold">{n.name}</text>
          </g>
        );
      case 'note':
        return (
          <g>
            <path d={`M0,0 L${s.w-15},0 L${s.w},15 L${s.w},${s.h} L0,${s.h} Z`} fill="#fef08a" stroke="#ca8a04" strokeWidth={strokeW} />
            <path d={`M${s.w-15},0 L${s.w-15},15 L${s.w},15`} fill="none" stroke="#ca8a04" strokeWidth={strokeW} />
            <text x={s.w/2} y={s.h/2 + 4} fill="#000" fontSize="11" textAnchor="middle">
              {n.name.length > 20 ? n.name.slice(0,18)+'...' : n.name}
            </text>
          </g>
        );
      case 'system_boundary':
        return (
          <g>
            <rect width={s.w} height={s.h} rx="0" fill="transparent" stroke={strokeColor} strokeWidth={strokeW} />
            <text x={s.w/2} y="20" fill="#fff" fontWeight="bold" fontSize="14" textAnchor="middle">{n.name}</text>
          </g>
        );
      case 'fragment':
        return (
          <g>
            <rect width={s.w} height={s.h} rx="0" fill="transparent" stroke={strokeColor} strokeWidth={strokeW} />
            <path d={`M 0,0 L 50,0 L 60,15 L 60,25 L 0,25 Z`} fill="rgba(255,255,255,0.05)" stroke={strokeColor} strokeWidth="1" />
            <text x="5" y="16" fill="#fff" fontSize="11" fontWeight="bold">{n.name}</text>
          </g>
        );

      case 'activation':
        return (
          <g>
            <rect width={s.w} height={s.h} fill="#e2e8f0" stroke="#475569" strokeWidth="1" />
          </g>
        );
      case 'class':
      default:
        return (
          <g>
            <rect width={s.w} height={s.h} rx="6" fill={fillBG} stroke={strokeColor} strokeWidth={strokeW} style={{ filter: isSelected ? 'drop-shadow(0 4px 12px rgba(99,102,241,0.25))' : 'none' }} />
            <rect width={s.w} height="32" rx="5" fill="rgba(255,255,255,0.02)" />
            <text x={s.w/2} y="20" fill="#fff" fontWeight="bold" fontSize="12" textAnchor="middle">{n.name}</text>
            <line x1="0" y1="32" x2={s.w} y2="32" stroke="rgba(255,255,255,0.08)" />
            <g transform="translate(10, 48)">
              {n.attributes?.slice(0, 3).map((attr, idx) => (
                <text key={'a'+idx} y={idx * 14} fill="#e2e8f0" fontSize="10">{attr.length > 25 ? attr.slice(0, 22) + '...' : attr}</text>
              ))}
              {n.attributes?.length > 3 && <text y="42" fill="#94a3b8" fontSize="9" fontStyle="italic">+ {n.attributes?.length - 3} autres...</text>}
            </g>
            <line x1="0" y1="92" x2={s.w} y2="92" stroke="rgba(255,255,255,0.08)" />
            <g transform="translate(10, 106)">
              {n.methods?.slice(0, 2).map((m, idx) => (
                <text key={'m'+idx} y={idx * 14} fill="#cbd5e1" fontSize="10">{m.length > 25 ? m.slice(0, 22) + '...' : m}</text>
              ))}
              {n.methods?.length > 2 && <text y="28" fill="#94a3b8" fontSize="9" fontStyle="italic">+ {n.methods?.length - 2} autres...</text>}
            </g>
          </g>
        );
    }
  };

  // Sélections actives
  const activeNode = nodes.find(n => n.id === selectedNodeId);
  const activeEdge = edges.find(e => e.id === selectedEdgeId);

  // Bounding Box (Auto-cadrage ReadOnly)
  const getBoundingBox = () => {
    if (nodes.length === 0) return { width: 3000, height: 3000, viewBox: undefined };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      const defaultSize = SIZES[n.type || 'class'] || SIZES.class;
      const s = { w: n.w || defaultSize.w, h: n.h || defaultSize.h };
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + s.w > maxX) maxX = n.x + s.w;
      if (n.y + (n.type==='lifeline' ? 300 : s.h) > maxY) maxY = n.y + (n.type==='lifeline' ? 300 : s.h);
    });
    const pad = 60;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    const width = (maxX + pad) - minX;
    const height = (maxY + pad) - minY;
    return { 
      width: readOnly ? '100%' : 3000, 
      height: readOnly ? '100%' : 3000, 
      viewBox: readOnly ? `${minX} ${minY} ${width} ${height}` : undefined 
    };
  };
  const svgConfig = getBoundingBox();

  return (
    <div style={{ display: 'flex', gap: 16, height: '100%', minHeight: 480, width: '100%' }}>
      {/* Canevas SVG */}
      <div style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: '#040710', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        
        {/* Barre d'outils */}
        {!readOnly && (
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', display: 'flex', gap: 8, alignItems: 'center', zIndex: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.3)', padding: 4, borderRadius: 8 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleAddNode('class')} title="Classe">📦 Classe</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleAddNode('actor')} title="Acteur">🧍 Acteur</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleAddNode('use_case')} title="Cas d'utilisation">⚪ Cas</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleAddNode('system_boundary')} title="Système">🔲 Système</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleAddNode('lifeline')} title="Ligne de vie">⏳ Objet</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleAddNode('activation')} title="Activation">🟦 Activation</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleAddNode('fragment')} title="Cadre d'interaction (alt, opt, loop...)">🔳 Cadre</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleAddNode('activity')} title="Activité">🔄 Activité</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleAddNode('note')} title="Note">📝 Note</button>
            </div>
            
            <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 8px' }} />

            <button 
              type="button" 
              className={`btn btn-ghost btn-sm ${isLinking ? 'active' : ''}`}
              onClick={handleStartLink}
              style={{ borderColor: isLinking ? 'var(--accent)' : 'transparent', background: isLinking ? 'rgba(99,102,241,0.1)' : 'transparent' }}
            >
              🔗 {isLinking ? (linkingSourceId ? 'Sélectionnez cible...' : 'Sélectionnez source...') : 'Relier'}
            </button>
            {isLinking && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setIsLinking(false); setLinkingSourceId(null); }} style={{ color: 'var(--danger)' }}>
                Annuler
              </button>
            )}
          </div>
        )}

        <div ref={containerRef} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} style={{ flex: 1, overflow: 'auto', background: '#040710', minHeight: 0 }}>
          <svg 
            width={svgConfig.width}
            height={svgConfig.height}
            viewBox={svgConfig.viewBox}
            style={{ cursor: isLinking ? 'crosshair' : 'default', minHeight: readOnly ? '100%' : undefined }}
            onClick={() => {
              setSelectedNodeId(null); setSelectedEdgeId(null);
              if (isLinking) { setIsLinking(false); setLinkingSourceId(null); }
            }}
          >
            {/* Définitions des flèches UML */}
            <defs>
              <marker id="generalization" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#040710" stroke="#8b5cf6" strokeWidth="1.5" />
              </marker>
              <marker id="composition" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
                <path d="M 0 5 L 5 0 L 10 5 L 5 10 z" fill="#8b5cf6" />
              </marker>
              <marker id="aggregation" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
                <path d="M 0 5 L 5 0 L 10 5 L 5 10 z" fill="#040710" stroke="#8b5cf6" strokeWidth="1.5" />
              </marker>
              <marker id="association" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10" fill="none" stroke="#8b5cf6" strokeWidth="1.5" />
              </marker>
              <marker id="sync_message" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#8b5cf6" />
              </marker>
            </defs>

            {/* Lignes (Relations) */}
            {edges.map(e => {
              const fromNode = nodes.find(n => n.id === e.from);
              const toNode = nodes.find(n => n.id === e.to);
              if (!fromNode || !toNode) return null;

              const start = getIntersectionPoint(toNode, fromNode);
              const end = getIntersectionPoint(fromNode, toNode);
              const isSelected = selectedEdgeId === e.id;
              const isDashed = e.type === 'dependency' || e.type === 'include' || e.type === 'extend' || e.type === 'return_message';

              const labelFrom = getLabelCoords(start, end, 0.15);
              const labelTo = getLabelCoords(start, end, 0.85);
              const labelCenter = getLabelCoords(start, end, 0.5); // Center for include/extend labels
              
              // Sélection du marqueur SVG (flèche)
              let markerEnd = `url(#association)`;
              if (e.type === 'generalization' || e.type === 'realization') markerEnd = `url(#generalization)`;
              if (e.type === 'composition') markerEnd = `url(#composition)`;
              if (e.type === 'aggregation') markerEnd = `url(#aggregation)`;
              if (e.type === 'sync_message') markerEnd = `url(#sync_message)`;
              if (e.type === 'association_none') markerEnd = ``; // Ligne simple

              return (
                <g key={e.id} onClick={(ev) => { ev.stopPropagation(); setSelectedEdgeId(e.id); setSelectedNodeId(null); }} style={{ cursor: 'pointer' }}>
                  <path d={`M ${start.x} ${start.y} L ${end.x} ${end.y}`} stroke="transparent" strokeWidth="15" />
                  <path 
                    d={`M ${start.x} ${start.y} L ${end.x} ${end.y}`} 
                    stroke={isSelected ? 'var(--accent)' : '#8b5cf6'} 
                    strokeWidth={isSelected ? '3' : '1.8'} 
                    strokeDasharray={isDashed ? '6,6' : 'none'}
                    markerEnd={markerEnd}
                  />
                  {e.type === 'include' && <text x={labelCenter.x} y={labelCenter.y - 8} fill="#94a3b8" fontSize="11" fontWeight="bold" textAnchor="middle">&lt;&lt;include&gt;&gt;</text>}
                  {e.type === 'extend' && <text x={labelCenter.x} y={labelCenter.y - 8} fill="#94a3b8" fontSize="11" fontWeight="bold" textAnchor="middle">&lt;&lt;extend&gt;&gt;</text>}
                  {e.fromMultiplicity && (
                    <text 
                      x={['dependency', 'sync_message', 'return_message', 'include', 'extend'].includes(e.type) ? labelCenter.x : labelFrom.x} 
                      y={['dependency', 'sync_message', 'return_message', 'include', 'extend'].includes(e.type) ? labelCenter.y - 8 : labelFrom.y} 
                      fill="#94a3b8" 
                      fontSize={['dependency', 'sync_message', 'return_message', 'include', 'extend'].includes(e.type) ? "11" : "10"} 
                      fontWeight="bold" 
                      textAnchor="middle"
                    >
                      {e.fromMultiplicity}
                    </text>
                  )}
                  {e.toMultiplicity && !['dependency', 'sync_message', 'return_message', 'include', 'extend'].includes(e.type) && (
                    <text x={labelTo.x} y={labelTo.y} fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle">{e.toMultiplicity}</text>
                  )}
                </g>
              );
            })}

            {/* Noeuds (Formes) */}
            {[...nodes].sort((a, b) => {
              const bg = ['system_boundary', 'fragment', 'package'];
              return bg.includes(a.type) ? -1 : bg.includes(b.type) ? 1 : 0;
            }).map(n => {
              const defaultSize = SIZES[n.type || 'class'] || SIZES.class;
              const s = { w: n.w || defaultSize.w, h: n.h || defaultSize.h };
              return (
                <g 
                  key={n.id}
                  transform={`translate(${n.x}, ${n.y})`}
                  onClick={(ev) => { ev.stopPropagation(); handleNodeClick(n.id); }}
                  onMouseDown={(ev) => handleMouseDown(ev, n.id)}
                  style={{ cursor: isLinking ? 'pointer' : readOnly ? 'default' : 'grab' }}
                >
                  <rect width={s.w} height={n.type === 'lifeline' ? 400 : s.h} fill="transparent" />
                  {renderNodeShape(n, selectedNodeId === n.id, linkingSourceId === n.id)}
                  
                  {/* Poignée de redimensionnement */}
                  {!readOnly && selectedNodeId === n.id && (
                    <rect 
                      x={s.w - 8} 
                      y={(n.type === 'lifeline' ? 400 : s.h) - 8} 
                      width="16" 
                      height="16" 
                      fill="var(--accent)" 
                      style={{ cursor: 'nwse-resize' }}
                      onMouseDown={(ev) => handleResizeMouseDown(ev, n.id)}
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Panneau Latéral (Configuration) */}
      {!readOnly && (activeNode || activeEdge) && (
        <div className="glass-card animate-fade-in" style={{ width: 250, padding: 16, display: 'flex', flexDirection: 'column', gap: 14, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', maxHeight: '100%', overflowY: 'auto' }}>
          
          {/* Config Noeud */}
          {activeNode && (
            <>
              <h3 style={{ fontSize: '0.95rem', margin: 0, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>✏️ Élément</h3>
              
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Nom / Texte</label>
                {activeNode.type === 'note' ? (
                  <textarea 
                    className="form-input" 
                    rows={4}
                    value={activeNode.name} 
                    onChange={e => handleUpdateNode(activeNode.id, 'name', e.target.value)} 
                  />
                ) : (
                  <input 
                    className="form-input" 
                    value={activeNode.name} 
                    onChange={e => handleUpdateNode(activeNode.id, 'name', e.target.value)} 
                  />
                )}
              </div>

              {/* Uniquement pour les Classes : Attributs & Méthodes */}
              {(activeNode.type === 'class' || !activeNode.type) && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem', margin: 0 }}>Attributs</label>
                      <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', padding: '2px 6px' }} onClick={() => handleUpdateNode(activeNode.id, 'attributes', [...(activeNode.attributes||[]), 'nouveau: Type'])}>+</button>
                    </div>
                    {(activeNode.attributes||[]).map((attr, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 4 }}>
                        <input className="form-input" style={{ fontSize: '0.8rem', padding: '4px 8px' }} value={attr} onChange={e => { const copy = [...activeNode.attributes]; copy[idx] = e.target.value; handleUpdateNode(activeNode.id, 'attributes', copy); }} />
                        <button type="button" className="btn btn-ghost" style={{ color: 'var(--danger)', fontSize: '0.75rem', border: 'none', padding: '0 6px' }} onClick={() => handleUpdateNode(activeNode.id, 'attributes', activeNode.attributes.filter((_, i) => i !== idx))}>✕</button>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem', margin: 0 }}>Méthodes</label>
                      <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', padding: '2px 6px' }} onClick={() => handleUpdateNode(activeNode.id, 'methods', [...(activeNode.methods||[]), 'nouvelle()'])}>+</button>
                    </div>
                    {(activeNode.methods||[]).map((met, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 4 }}>
                        <input className="form-input" style={{ fontSize: '0.8rem', padding: '4px 8px' }} value={met} onChange={e => { const copy = [...activeNode.methods]; copy[idx] = e.target.value; handleUpdateNode(activeNode.id, 'methods', copy); }} />
                        <button type="button" className="btn btn-ghost" style={{ color: 'var(--danger)', fontSize: '0.75rem', border: 'none', padding: '0 6px' }} onClick={() => handleUpdateNode(activeNode.id, 'methods', activeNode.methods.filter((_, i) => i !== idx))}>✕</button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <button type="button" className="btn btn-block btn-ghost" style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: 12 }} onClick={() => handleDeleteNode(activeNode.id)}>
                🗑️ Supprimer l'élément
              </button>
            </>
          )}

          {/* Config Relation */}
          {activeEdge && (
            <>
              <h3 style={{ fontSize: '0.95rem', margin: 0, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>✏️ Relation</h3>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Type de relation</label>
                <select className="form-select" value={activeEdge.type} onChange={e => handleUpdateEdge(activeEdge.id, 'type', e.target.value)}>
                  <optgroup label="Structurel (Classes)">
                    <option value="association">Association (Flèche simple)</option>
                    <option value="association_none">Association (Ligne continue)</option>
                    <option value="generalization">Héritage (Généralisation)</option>
                    <option value="aggregation">Agrégation</option>
                    <option value="composition">Composition</option>
                  </optgroup>
                  <optgroup label="Comportemental (Cas, Séquence)">
                    <option value="dependency">Dépendance (pointillée)</option>
                    <option value="include">&lt;&lt;include&gt;&gt;</option>
                    <option value="extend">&lt;&lt;extend&gt;&gt;</option>
                    <option value="sync_message">Message Synchrone (Séquence)</option>
                    <option value="return_message">Message Retour (Séquence)</option>
                  </optgroup>
                </select>
              </div>

              {['sync_message', 'return_message', 'dependency', 'include', 'extend'].indexOf(activeEdge.type) === -1 && (
                <>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Texte Source (gauche/haut)</label>
                    <input className="form-input" placeholder="ex: 1, 0..*" value={activeEdge.fromMultiplicity || ''} onChange={e => handleUpdateEdge(activeEdge.id, 'fromMultiplicity', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Texte Cible (droite/bas)</label>
                    <input className="form-input" placeholder="ex: 1, 0..*" value={activeEdge.toMultiplicity || ''} onChange={e => handleUpdateEdge(activeEdge.id, 'toMultiplicity', e.target.value)} />
                  </div>
                </>
              )}

              {['dependency', 'sync_message', 'return_message'].indexOf(activeEdge.type) !== -1 && (
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Label du message / lien</label>
                  <input className="form-input" placeholder="ex: <<include>>, login()" value={activeEdge.fromMultiplicity || ''} onChange={e => handleUpdateEdge(activeEdge.id, 'fromMultiplicity', e.target.value)} />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block', marginTop: 4 }}>Ce texte s'affichera sur la ligne.</small>
                </div>
              )}

              <button type="button" className="btn btn-block btn-ghost" style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: 12 }} onClick={() => handleDeleteEdge(activeEdge.id)}>
                🗑️ Supprimer Relation
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
