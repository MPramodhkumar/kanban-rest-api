import { useEffect, useRef, useState } from "react";
import { BarChart3, LayoutDashboard, Columns3, FolderPlus, LogOut, Moon, Plus, Search, Settings, Sun, Trash2, X } from "lucide-react";

const PRIORITY_LABEL = { low: "Low priority", medium: "Medium priority", high: "High priority" };

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function Header({ query, onQuery, onNewTask, theme, onTheme, user, onLogout, projects = [], activeProjectId, onSelectProject, onNewProject }) {
  return (
    <header className="header">
      <div className="brand">
        <span className="logo"><Columns3 size={18} /></span>
        Task<span>Zen</span>
      </div>
      <div className="project-switch">
        {projects.length > 0 && (
          <select value={activeProjectId ?? ""} onChange={(e) => onSelectProject(Number(e.target.value))} aria-label="Project">
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <button className="theme-btn" onClick={onNewProject} aria-label="New project" title="New project">
          <FolderPlus size={18} />
        </button>
      </div>
      <label className="search">
        <Search size={16} />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search tasks"
          aria-label="Search tasks"
        />
      </label>
      <button className="btn primary" onClick={onNewTask}>
        <Plus size={16} /> New task
      </button>
      <button className="theme-btn" onClick={onTheme} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <div className="user-chip" title={user?.email}>
        <span className="me">{user?.name?.[0]?.toUpperCase() ?? "?"}</span>
        <span className="user-name">{user?.name}</span>
      </div>
      <button className="theme-btn" onClick={onLogout} aria-label="Log out" title="Log out">
        <LogOut size={18} />
      </button>
    </header>
  );
}

export function Sidebar({ view, onView }) {
  const items = [
    { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { id: "board", icon: Columns3, label: "Board" },
    { id: "reports", icon: BarChart3, label: "Reports", soon: true },
    { id: "settings", icon: Settings, label: "Settings", soon: true },
  ];
  return (
    <nav className="sidebar" aria-label="Main">
      {items.map(({ id, icon: Icon, label, soon }) => (
        <button
          key={id}
          className={"nav-item" + (view === id ? " active" : "")}
          aria-current={view === id ? "page" : undefined}
          disabled={soon}
          title={soon ? "Coming soon" : undefined}
          onClick={() => onView(id)}
        >
          <Icon size={20} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function TaskCard({ task, index, canDrag, dragging, onDragStart, onDragEnd, onOver, onDelete }) {
  const handleOver = (e) => {
    if (!canDrag) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    onOver(index + (e.clientY > rect.top + rect.height / 2 ? 1 : 0));
  };

  return (
    <li
      className={"card p-" + task.priority + (dragging ? " dragging" : "")}
      draggable={canDrag}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(task.id));
        onDragStart(task.id);
      }}
      onDragEnd={onDragEnd}
      onDragOver={handleOver}
    >
      <div className="card-top">
        <h3>{task.title}</h3>
        <button className="icon-btn" onClick={() => onDelete(task)} aria-label={`Delete ${task.title}`}>
          <Trash2 size={15} />
        </button>
      </div>
      {task.description && <p>{task.description}</p>}
      <div className="card-foot">
        <span className={"pill " + task.priority}>{PRIORITY_LABEL[task.priority]}</span>
        <time>{formatDate(task.created_at)}</time>
      </div>
    </li>
  );
}

export function Column({ column, tone, canDrag, dragId, drop, onDragStart, onDragEnd, onDropTarget, onDrop, onAdd, onDelete }) {
  const isTarget = drop?.columnId === column.id;

  const handleColumnOver = (e) => {
    if (!canDrag || dragId == null) return;
    e.preventDefault();
    onDropTarget({ columnId: column.id, index: column.tasks.length });
  };

  return (
    <section
      className={"column tone-" + tone + (isTarget ? " over" : "")}
      onDragOver={handleColumnOver}
      onDrop={(e) => {
        e.preventDefault();
        if (isTarget) onDrop(column.id, drop.index);
      }}
    >
      <header className="column-head">
        <h2>{column.name} <span>{column.tasks.length}</span></h2>
        <button className="icon-btn" onClick={onAdd} aria-label={`Add task to ${column.name}`}>
          <Plus size={18} />
        </button>
      </header>

      <ul className="cards">
        {column.tasks.map((task, i) => (
          <div key={task.id} style={{ display: "contents" }}>
            {isTarget && drop.index === i && <li className="drop-line" aria-hidden="true" />}
            <TaskCard
              task={task}
              index={i}
              canDrag={canDrag}
              dragging={dragId === task.id}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onOver={(index) => onDropTarget({ columnId: column.id, index })}
              onDelete={onDelete}
            />
          </div>
        ))}
        {isTarget && drop.index === column.tasks.length && <li className="drop-line" aria-hidden="true" />}
        {column.tasks.length === 0 && !isTarget && (
          <li className="empty">
            <button className="btn ghost" onClick={onAdd}>Add the first task</button>
          </li>
        )}
      </ul>
    </section>
  );
}

export function NewTaskModal({ columns, initialColumnId, onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [columnId, setColumnId] = useState(initialColumnId);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const titleRef = useRef(null);

  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return setError("Give the task a title.");
    setSaving(true);
    try {
      await onCreate(Number(columnId), {
        title: title.trim(),
        description: description.trim() || null,
        priority,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't add the task.");
      setSaving(false);
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-head">
          <h2 id="modal-title">New task</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <label>Title
          <input ref={titleRef} value={title} maxLength={200} onChange={(e) => { setTitle(e.target.value); setError(""); }} />
        </label>
        <label>Description
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="row">
          <label>Column
            <select value={columnId} onChange={(e) => setColumnId(e.target.value)}>
              {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>Priority
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>

        {error && <p className="error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={saving}>{saving ? "Adding…" : "Add task"}</button>
        </div>
      </form>
    </div>
  );
}

export function NewProjectModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError("Give the project a name.");
    setSaving(true);
    try {
      await onCreate({ name: name.trim(), description: description.trim() || null });
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't create the project.");
      setSaving(false);
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="project-title">
        <div className="modal-head">
          <h2 id="project-title">New project</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <label>Name
          <input ref={nameRef} value={name} maxLength={100} onChange={(e) => { setName(e.target.value); setError(""); }} />
        </label>
        <label>Description
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <p className="note">Starts with four columns: To Do, In Progress, In Review and Done.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={saving}>{saving ? "Creating…" : "Create project"}</button>
        </div>
      </form>
    </div>
  );
}
