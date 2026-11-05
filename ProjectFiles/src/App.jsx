import React, { useEffect, useRef, useState } from 'react';
import { EmergencySystem } from '../structures.js'; 

const LEVELS = {5:['Critical','#d75b62','Immediate'],4:['Severe','#d99449','High priority'],3:['Urgent','#d0b04b','Urgent care'],2:['Moderate','#6998c9','Standard care'],1:['Low','#7ba389','Non-urgent']};
const time = value => new Date(value).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
const arrivalLabel = value => `#${String(value).padStart(3,'0')}`;

// JSON stores plain snapshots, not classes or pointers. Reconstruct the real
// BST, FIFO queues, heap and history nodes once when React mounts this app.
function loadSystem() {
  const system = new EmergencySystem();
  try {
    const saved = JSON.parse(localStorage.getItem('pulse-emergency-v1'));
    if (saved && Array.isArray(saved.waiting) && Array.isArray(saved.history)) {
      system.arrival = saved.arrival;
      system.usedIds = new Set(saved.usedIds);
      [...saved.waiting].sort((a,b) => a.arrival-b.arrival).forEach(p => system.addToStructures(p));
      [...saved.history].reverse().forEach(r => system.history.prepend(r.patient,r.treatedAt));
      return system;
    }
  } catch (_) { /* Storage may be disabled; the in-memory app still works. */ }
  [['PT-1004','Maya Sharma',3],['PT-1002','Arjun Mehta',5],['PT-1006','Sara Khan',2],['PT-1001','Rohan Verma',4],['PT-1005','Ananya Rao',3],['PT-1003','Vikram Singh',5]].forEach(p => system.register(...p));
  return system;
}

// Reusable presentation components contain no scheduling logic.
function Badge({level}) { return <span className={`badge level-${level}`}>● {level} · {LEVELS[level][0]}</span>; }
function PatientCell({patient}) { return <td><span className="patient">{patient.name}</span><small>{patient.id}</small></td>; }
function Stat({label,value,description,icon}) { return <div className="stat"><label>{label}</label><span className="stat-icon">{icon}</span><strong>{value}</strong><small>{description}</small></div>; }

function Sidebar({view,onNavigate}) {
  return <aside><div className="brand"><b>+</b><div>pulse<small>EMERGENCY CARE</small></div></div><div className="nav-label">WORKSPACE</div>{[['dashboard','▦','Overview'],['history','◷','Treatment history'],['guide','⌘','How it works']].map(([id,icon,label]) => <button key={id} className={`nav ${view === id ? 'active' : ''}`} onClick={() => onNavigate(id)}><span>{icon}</span>{label}</button>)}<div className="side-bottom"><span className="live"/>System operational<br/>Emergency department · ED 01<br/><small>Educational management demo · React</small></div></aside>;
}

function NextPatient({patient,onTreat}) {
  return <div className="card next"><div className="eyebrow">↗ Next in line</div>{patient ? <><div className="next-avatar">{patient.name.split(/\s+/).map(x => x[0]).slice(0,2).join('')}</div><h3>{patient.name}</h3><div className="id">{patient.id}</div><Badge level={patient.level}/><div className="details"><div className="detail">Arrival number <b>{arrivalLabel(patient.arrival)}</b></div><div className="detail">Registered at <b>{time(patient.registeredAt)}</b></div><div className="detail">Queue position <b>First in line</b></div></div></> : <div className="empty">All clear.<br/>No patients are waiting.</div>}<button className="button" disabled={!patient} onClick={onTreat} style={!patient ? {opacity:.5}:undefined}>✓ Treat next patient</button><p className="hint">Moves this patient to treatment history</p></div>;
}
function LevelGuide() {
  return <div className="card legend"><h2>Emergency level guide</h2>{[5,4,3,2,1].map(level => <div className="legend-item" key={level}><span><i className="dot" style={{background:LEVELS[level][1]}}/>{level} · {LEVELS[level][0]}</span><span>{LEVELS[level][2]}</span></div>)}<p style={{fontSize:10,marginTop:20}}>Demo scale: 5 is highest priority.<br/>Not a clinical triage or diagnostic tool.</p></div>;
}
function WaitingRoom({system,onCancel,onTreat}) {
  // Controlled inputs: their values live in React state, not DOM queries.
  const [search,setSearch] = useState('');
  const [filter,setFilter] = useState('');
  const waiting = system.waiting();
  const query = search.trim().toUpperCase();
  // Exact-ID search follows BST links. The array below is only a UI snapshot.
  const match = query ? system.index.search(query) : null;
  const displayed = (query ? (match ? [match] : []) : waiting).filter(p => !filter || p.level === Number(filter));
  return <div className="layout"><div><div className="card"><div className="card-head"><div><h2>Waiting room</h2><p>Ordered by emergency level, then arrival time</p></div><span className="count">{waiting.length} waiting</span></div><div className="toolbar"><div className="search">⌕ <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by patient ID…" aria-label="Search by patient ID"/></div><select aria-label="Filter emergency level" value={filter} onChange={e => setFilter(e.target.value)}><option value="">All emergency levels</option>{[5,4,3,2,1].map(l => <option key={l} value={l}>{l} · {LEVELS[l][0]}</option>)}</select></div><div className="table-wrap"><table><thead><tr><th>Patient</th><th>Emergency level</th><th>Arrival</th><th>Action</th></tr></thead><tbody>{displayed.length ? displayed.map(p => <tr key={p.id}><PatientCell patient={p}/><td><Badge level={p.level}/></td><td>{arrivalLabel(p.arrival)}<br/><small>{time(p.registeredAt)}</small></td><td><button className="cancel" title="Cancel registration" aria-label={`Cancel ${p.name}`} onClick={() => onCancel(p)}>×</button></td></tr>) : <tr><td colSpan="4" className="empty">No waiting patients match. Search uses the full patient ID.</td></tr>}</tbody></table></div><div className="table-foot">Showing {displayed.length} of {waiting.length} waiting patients · Highest priority first</div></div><div className="note"><span>ⓘ</span><div><b>Priority-based care, fair by design.</b><br/>Higher emergency levels are treated first. Within each level, patients are seen in the order they arrive.</div></div></div><div className="right"><NextPatient patient={system.next()} onTreat={onTreat}/><LevelGuide/></div></div>;
}
function History({history}) {
  // Traversal follows history.head -> next -> next. It never sorts treatments.
  const records = history.toArray();
  return <div className="card"><div className="card-head"><div><h2>Treatment history</h2><p>Linked-list records · newest treatment first</p></div><span className="count">{history.size} treated</span></div><div className="table-wrap"><table><thead><tr><th>Patient</th><th>Emergency level</th><th>Arrival</th><th>Treated at</th></tr></thead><tbody>{records.length ? records.map(({patient:p,treatedAt}) => <tr key={p.id}><PatientCell patient={p}/><td><Badge level={p.level}/></td><td>{arrivalLabel(p.arrival)}</td><td>{new Date(treatedAt).toLocaleString()}</td></tr>) : <tr><td colSpan="4" className="empty">No treatments yet. Treated patients will appear here.</td></tr>}</tbody></table></div></div>;
}
function Explanation({title,children,visual}) { return <div className="card explain"><h2>{title}</h2>{children}{visual !== undefined && <div className="structure">{visual}</div>}</div>; }
function StructureGuide({system}) {
  const tree = [], stack = system.index.root ? [[system.index.root,'ROOT']] : [];
  // Iterative visualization avoids call-stack overflow for a skewed BST.
  while (stack.length) {
    const [node,path] = stack.pop(); tree.push(`${path}: ${node.patient.id}`);
    if (node.right) stack.push([node.right,path+'.R']);
    if (node.left) stack.push([node.left,path+'.L']);
  }
  return <>
    <Explanation title="01 / Priority queue — a max heap of emergency levels" visual={`Heap array: [${system.heap.items.join(', ')}]\nRoot / next level: ${system.heap.peek() ?? 'empty'}`}><p>Each active emergency level appears once in a binary max heap. The highest level stays at the root. The first registration at a level inserts that level; an empty queue removes it. Heap insertion takes O(log k). Root lookup is O(1). Arbitrary level removal takes O(k) to locate the level, then O(log k) to repair the heap. There are at most five levels.</p></Explanation>
    <Explanation title="02 / Queue — first in, first out at each level" visual={[5,4,3,2,1].map(l => `Level ${l}: HEAD → ${system.queues.get(l)?.toArray().map(p => p.id).join(' → ') || '(empty)'} → null`).join('\n')}><p>Each level has its own linked FIFO queue. A node holds a patient and a <code>next</code> pointer. Enqueue attaches a new node at <code>tail</code>; dequeue advances <code>head</code>. Both take O(1). Removing the last node clears both pointers. Cancellation scans the queue and reconnects the previous node to the next node: O(m).</p></Explanation>
    <Explanation title="03 / Binary search tree — patient ID index" visual={tree.join('\n') || 'ROOT → null'}><p>Every waiting patient is indexed by a unique uppercase ID. Smaller IDs go left; larger IDs go right (lexicographic comparison). Search follows one branch at a time. For deletion with two children, copy the in-order successor from the right subtree, then unlink that successor. Operations take O(h): average O(log n), worst-case O(n) for an unbalanced tree.</p></Explanation>
    <Explanation title="04 / Linked list — treatment history" visual={`HEAD → ${system.history.toArray().map(r => r.patient.id).join(' → ') || '(empty)'} → null`}><p>Every history node contains a patient, treatment timestamp, and <code>next</code> pointer. To record treatment: create a node, set <code>node.next = head</code>, then <code>head = node</code>. This prepend takes O(1) and keeps the newest record first. Display follows each next pointer until null: O(t). The live history is a real singly linked list, not an array.</p></Explanation>
    <Explanation title="Putting it together — React + data structures"><p><b>Register:</b> validate → insert BST node → enqueue patient → add emergency level to heap if needed.<br/><b>Treat:</b> peek highest level → dequeue oldest patient → remove BST entry → prepend history node.<br/><b>Cancel:</b> search BST → unlink queue node → remove empty level → remove BST entry.</p><p>React renders components from state. A stable <code>useRef</code> retains the domain model across renders; a revision state triggers a fresh UI after mutations. Browser storage saves snapshots and rebuilds the actual structures on reload. Exact-ID search covers waiting patients only. IDs remain unique after cancellation or treatment.</p><p>Read <code>src/structures.js</code> for detailed // explanations of pointer operations, heap repair, and BST deletion. Read <code>src/App.jsx</code> for React hooks, components, forms, and persistence. Educational prototype only; do not enter real patient data.</p></Explanation>
  </>;
}
function RegisterDialog({onClose,onRegister}) {
  const dialog = useRef(null);
  const [id,setId] = useState(''), [name,setName] = useState(''), [level,setLevel] = useState('3'), [error,setError] = useState('');
  // Native dialog provides focus trapping and Escape support; effect runs on mount.
  useEffect(() => { dialog.current.showModal(); }, []);
  function submit(event) {
    event.preventDefault();
    try { onRegister(id,name,level); onClose(); } catch (err) { setError(err.message); }
  }
  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="registerTitle"><form onSubmit={submit}><h2 id="registerTitle">Register a patient</h2><p>Add a patient to the emergency queue.</p><label htmlFor="patientId">Patient ID</label><input id="patientId" autoFocus required maxLength={24} pattern="[A-Za-z0-9-]+" placeholder="e.g. PT-1009" value={id} onChange={e => setId(e.target.value)}/><label htmlFor="patientName">Full name</label><input id="patientName" required maxLength={70} placeholder="Patient’s full name" value={name} onChange={e => setName(e.target.value)}/><label htmlFor="patientLevel">Emergency level</label><select id="patientLevel" value={level} onChange={e => setLevel(e.target.value)}>{[5,4,3,2,1].map(l => <option value={l} key={l}>{l} · {LEVELS[l][0]}{l === 5 ? ' — highest priority' : ''}</option>)}</select>{error && <div id="error" role="alert">{error}</div>}<div className="actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button" type="submit">Register patient</button></div></form></dialog>;
}
export default function App() {
  // Keep mutable node references stable. Recreating the model on each render
  // would lose the heap, queues, tree, and history whenever an input changes.
  const model = useRef(null);
  if (!model.current) model.current = loadSystem();
  const system = model.current;
  const [revision,setRevision] = useState(0);
  const [view,setView] = useState('dashboard');
  const [registerOpen,setRegisterOpen] = useState(false);
  const [toast,setToast] = useState('');
  const labels = {dashboard:['Emergency overview','Every second matters. Keep your care moving.','Overview'],history:['Treatment history','A clear record of the care you’ve delivered.','Treatment history'],guide:['Behind the care','Four data structures. One coordinated workflow.','How it works']};
  const [title,subtitle,crumb] = labels[view];
  // Persistence is a side effect, not work performed during React rendering.
  useEffect(() => { try { system.save(); } catch (err) { setToast(err.message); } }, [system,revision]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''),4200); return () => clearTimeout(timer); }, [toast]);
  function changed(message) { setRevision(r => r+1); setToast(message); }
  function register(id,name,level) { const p = system.register(id,name,level); changed(`${p.name} registered · arrival ${arrivalLabel(p.arrival)}`); }
  function treat() { const p = system.treat(); if (p) changed(`${p.name} treated and added to history.`); }
  function cancel(p) { if (window.confirm(`Cancel registration for ${p.name} (${p.id})? This will not add a treatment record.`)) { system.cancel(p.id); changed(`${p.name}'s registration cancelled.`); } }
  // JSX safely escapes user names/IDs automatically; no innerHTML is used.
  return <><Sidebar view={view} onNavigate={setView}/><main><header><div className="crumb">Workspace / <span>{crumb}</span></div><div className="staff"><span>{new Date().toLocaleDateString([], {month:'short',day:'numeric',year:'numeric'})}</span><span className="avatar">ED</span><div className="staff-text">Emergency desk<small>Care coordination</small></div></div></header><div className="title-row"><div><h1>{title}</h1><p>{subtitle}</p></div><button className="button" onClick={() => setRegisterOpen(true)}>＋ Register patient</button></div><div className="stats"><Stat label="Waiting patients" value={system.waiting().length} description="Currently in the emergency queue" icon="♧"/><Stat label="Critical patients" value={system.queues.get(5)?.size || 0} description="Level 5 · Immediate attention" icon="♡"/><Stat label="Patients treated" value={system.history.size} description="Completed in this browser" icon="✓"/><Stat label="Total registrations" value={system.arrival} description="Across all emergency levels" icon="↗"/></div>{view === 'dashboard' && <WaitingRoom system={system} onCancel={cancel} onTreat={treat}/>} {view === 'history' && <History history={system.history}/>} {view === 'guide' && <StructureGuide system={system}/>}</main>{registerOpen && <RegisterDialog onClose={() => setRegisterOpen(false)} onRegister={register}/>} {toast && <div className="toast" role="status">{toast}</div>}</>;
}
