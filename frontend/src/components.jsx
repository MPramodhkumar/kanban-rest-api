import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { BarChart3, LayoutDashboard, Columns3, FolderPlus, LogOut, MessageSquare, Moon, Plus, Search, Settings, Sun, Trash2, X } from "lucide-react";

const PRIORITY_LABEL = { low: "Low priority", medium: "Medium priority", high: "High priority" };
const AVATAR_COLORS = ["#ef5b4c", "#3b6ef0", "#f0a020", "#1fb26b", "#8b5cf6", "#0ea5e9"];

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ---------- Avatars ---------- */

export function Avatar({ user, size = 28 }) {
  return (
    <span
      className="avatar"
      title={user.name}
      style={{ width: size, height: size, fontSize: size * 0.43, background: AVATAR_COLORS[user.id % AVATAR_COLORS.length] }}
    >
      {user.name[0]?.toUpperCase()}
    </span>
  );
}

export function AvatarStack({ users, max = 3, size = 28 }) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <span className="avatar-stack">
      {shown.map((u) => <Avatar key={u.id} user={u} size={size} />)}
      {extra > 0 && <span className="avatar more" style={{ width: size, height: size, fontSize: size * 0.4 }}>+{extra}</span>}
    </span>
  );
}

/* ---------- Header & sidebar ---------- */

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

/* ---------- Board ---------- */

function TaskCard({ task, index, canDrag, dragging, onDragStart, onDragEnd, onOver, onDelete, onOpen }) {
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
      onClick={() => onOpen(task)}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(task.id));
        onDragStart(task.id);
      }}
      onDragEnd={onDragEnd}
      onDragOver={handleOver}
    >
      <div className="card-top">
        <h3><button className="card-title" type="button">{task.title}</button></h3>
        <button
          className="icon-btn"
          onClick={(e) => { e.stopPropagation(); onDelete(task); }}
          aria-label={`Delete ${task.title}`}
        >
          <Trash2 size={15} />
        </button>
      </div>
      {task.description && <p>{task.description}</p>}
      <div className="card-foot">
        <span className={"pill " + task.priority}>{PRIORITY_LABEL[task.priority]}</span>
        <span className="card-meta">
          <button
            type="button"
            className={"comment-btn" + (task.comment_count > 0 ? " has" : "")}
            title="Open comments"
            aria-label={`Comments (${task.comment_count ?? 0}) on ${task.title}`}
            onClick={(e) => { e.stopPropagation(); onOpen(task, true); }}
          >
            <MessageSquare size={15} />{task.comment_count ?? 0}
          </button>
          <time>{formatDate(task.created_at)}</time>
          {task.assignees?.length > 0 && <AvatarStack users={task.assignees} size={26} />}
        </span>
      </div>
    </li>
  );
}

export function Column({ column, tone, canDrag, dragId, drop, onDragStart, onDragEnd, onDropTarget, onDrop, onAdd, onDelete, onOpen }) {
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
              onOpen={onOpen}
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

/* ---------- Modals ---------- */

function useModalKeys(onClose, focusRef) {
  useEffect(() => {
    focusRef?.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, focusRef]);
}

function formatWhen(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function Comments({ taskId, user, ownerId, onCount, autoFocus }) {
  const [items, setItems] = useState(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    let off = false;
    api.get(`/tasks/${taskId}/comments`)
      .then((list) => !off && setItems(list))
      .catch(() => !off && setError("Couldn't load comments."));
    return () => { off = true; };
  }, [taskId]);

  const post = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setError("");
    try {
      const created = await api.post(`/tasks/${taskId}/comments`, { text: value });
      const next = [...(items ?? []), created];
      setItems(next);
      setText("");
      onCount(next.length);
    } catch (err) {
      setError(err.message || "Couldn't post the comment.");
    }
    setBusy(false);
  };

  const remove = async (comment) => {
    try {
      await api.del(`/comments/${comment.id}`);
      const next = items.filter((c) => c.id !== comment.id);
      setItems(next);
      onCount(next.length);
    } catch (err) {
      setError(err.message || "Couldn't delete the comment.");
    }
  };

  return (
    <section className="comments" aria-label="Comments">
      <h3>Comments{items?.length ? ` (${items.length})` : ""}</h3>

      {items === null && !error && <p className="note">Loading…</p>}
      {items?.length === 0 && <p className="note">No comments yet.</p>}

      <ul>
        {items?.map((c) => (
          <li key={c.id}>
            <Avatar user={c.user} size={28} />
            <div className="comment-body">
              <div className="comment-head">
                <strong>{c.user.name}</strong>
                <time>{formatWhen(c.created_at)}</time>
                {(c.user.id === user.id || ownerId === user.id) && (
                  <button type="button" className="icon-btn" onClick={() => remove(c)} aria-label="Delete comment">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <p>{c.text}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="comment-form">
        <input
          ref={inputRef}
          value={text}
          maxLength={2000}
          placeholder="Write a comment…"
          aria-label="Write a comment"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); post(); } }}
        />
        <button type="button" className="btn primary" onClick={post} disabled={busy || !text.trim()}>Post</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}

// One modal for both creating a task and editing an existing one.
export function TaskModal({ columns, members, task, initialColumnId, onClose, onSubmit, user, ownerId, onCommentCount, focusComments }) {
  const editing = Boolean(task);
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState(task?.priority ?? "medium");
  const [columnId, setColumnId] = useState(initialColumnId);
  const [assigneeIds, setAssigneeIds] = useState((task?.assignees ?? []).map((a) => a.id));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const titleRef = useRef(null);
  useModalKeys(onClose, focusComments ? null : titleRef);

  const toggle = (id) =>
    setAssigneeIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return setError("Give the task a title.");
    setSaving(true);
    try {
      await onSubmit(
        { title: title.trim(), description: description.trim() || null, priority, assignee_ids: assigneeIds },
        Number(columnId)
      );
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't save the task.");
      setSaving(false);
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-head">
          <h2 id="modal-title">{editing ? "Edit task" : "New task"}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <label>Title
          <input ref={titleRef} value={title} maxLength={200} onChange={(e) => { setTitle(e.target.value); setError(""); }} />
        </label>
        <label>Description
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="row">
          {!editing && (
            <label>Column
              <select value={columnId} onChange={(e) => setColumnId(e.target.value)}>
                {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
          <label>Priority
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>

        <fieldset className="assign">
          <legend>Assign to</legend>
          <div className="chips">
            {members.map((m) => (
              <label key={m.id} className={"chip" + (assigneeIds.includes(m.id) ? " on" : "")}>
                <input type="checkbox" checked={assigneeIds.includes(m.id)} onChange={() => toggle(m.id)} />
                <Avatar user={m} size={22} /> {m.name}
              </label>
            ))}
          </div>
        </fieldset>

        {editing && (
          <Comments taskId={task.id} user={user} ownerId={ownerId} autoFocus={focusComments} onCount={(n) => onCommentCount(task.id, n)} />
        )}

        {error && <p className="error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add task"}
          </button>
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
  useModalKeys(onClose, nameRef);

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

export function MembersModal({ members, project, user, onInvite, onClose }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const emailRef = useRef(null);
  const isOwner = project.owner_id === user.id;
  useModalKeys(onClose, isOwner ? emailRef : null);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError("");
    try {
      await onInvite(email.trim());
      setEmail("");
    } catch (err) {
      setError(err.message || "Couldn't invite that person.");
    }
    setBusy(false);
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="team-title">
        <div className="modal-head">
          <h2 id="team-title">Team · {project.name}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <ul className="members">
          {members.map((m) => (
            <li key={m.id}>
              <Avatar user={m} size={34} />
              <div>
                <strong>{m.name}{m.id === project.owner_id && <em>Owner</em>}</strong>
                <small>{m.email}</small>
              </div>
            </li>
          ))}
        </ul>

        {isOwner ? (
          <form className="invite" onSubmit={submit}>
            <label>Invite by email
              <input ref={emailRef} type="email" value={email} placeholder="name@example.com"
                onChange={(e) => { setEmail(e.target.value); setError(""); }} />
            </label>
            <button className="btn primary" type="submit" disabled={busy}>{busy ? "Adding…" : "Invite"}</button>
          </form>
        ) : (
          <p className="note">Only the project owner can invite people.</p>
        )}
        {isOwner && <p className="note">They need a TaskZen account first.</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
