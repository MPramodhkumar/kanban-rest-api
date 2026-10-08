import { useCallback, useEffect, useMemo, useState } from "react";
import { api, auth } from "./api";
import { Column, Header, NewTaskModal, Sidebar } from "./components";
import Dashboard from "./Dashboard";
import Login from "./Login";

export default function App() {
  const [user, setUser] = useState(null);
  const [authState, setAuthState] = useState(auth.getToken() ? "checking" : "out"); // checking | in | out | error
  const [project, setProject] = useState(null);
  const [columns, setColumns] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | empty | error
  const [query, setQuery] = useState("");
  const [modalColumnId, setModalColumnId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [drop, setDrop] = useState(null); // { columnId, index }
  const [toast, setToast] = useState("");
  const [view, setView] = useState("dashboard"); // dashboard | board
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("tz-theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); }
    catch { return "light"; }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("tz-theme", theme); } catch {}
  }, [theme]);

  const notify = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(""), 3500);
  }, []);

  // ----- authentication -----
  const resetSession = useCallback(() => {
    setUser(null);
    setColumns([]);
    setProject(null);
    setStatus("loading");
    setView("dashboard");
    setQuery("");
    setAuthState("out");
  }, []);

  useEffect(() => {
    auth.onUnauthorized = resetSession;
    return () => { auth.onUnauthorized = null; };
  }, [resetSession]);

  const checkSession = useCallback(async () => {
    setAuthState("checking");
    try {
      setUser(await api.get("/auth/me"));
      setAuthState("in");
    } catch (e) {
      if (e.status === 401) { auth.clear(); setAuthState("out"); }
      else setAuthState("error");
    }
  }, []);

  useEffect(() => {
    if (auth.getToken()) checkSession();
  }, [checkSession]);

  const logout = () => {
    auth.clear();
    resetSession();
  };

  // ----- board data -----
  const load = useCallback(async () => {
    try {
      const projects = await api.get("/projects");
      if (projects.length === 0) return setStatus("empty");
      const board = await api.get(`/projects/${projects[0].id}/board`);
      setProject(board.project);
      setColumns(board.columns);
      setStatus("ready");
    } catch (e) {
      if (e.status !== 401) setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (authState === "in") load();
  }, [authState, load]);

  const q = query.trim().toLowerCase();
  const visibleColumns = useMemo(() => {
    if (!q) return columns;
    return columns.map((c) => ({
      ...c,
      tasks: c.tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q)
      ),
    }));
  }, [columns, q]);

  const moveTask = async (taskId, toColumnId, toIndex) => {
    const from = columns.find((c) => c.tasks.some((t) => t.id === taskId));
    if (!from) return;
    const fromIndex = from.tasks.findIndex((t) => t.id === taskId);
    const task = from.tasks[fromIndex];

    let index = toIndex;
    if (from.id === toColumnId && fromIndex < index) index -= 1;
    if (from.id === toColumnId && fromIndex === index) return;

    const next = columns.map((c) => {
      const tasks = c.tasks.filter((t) => t.id !== taskId);
      if (c.id === toColumnId) tasks.splice(index, 0, { ...task, column_id: toColumnId });
      return { ...c, tasks: tasks.map((t, i) => ({ ...t, position: i + 1 })) };
    });

    // Only save the cards whose column or position actually changed
    const before = new Map(columns.flatMap((c) => c.tasks).map((t) => [t.id, t]));
    const saves = next
      .flatMap((c) => c.tasks)
      .filter((t) => {
        const old = before.get(t.id);
        return old.position !== t.position || old.column_id !== t.column_id;
      })
      .map((t) => api.patch(`/tasks/${t.id}`, { column_id: t.column_id, position: t.position }));

    setColumns(next);
    try {
      await Promise.all(saves);
    } catch {
      notify("Couldn't save that move. The board was reloaded.");
      load();
    }
  };

  const createTask = async (columnId, data) => {
    const column = columns.find((c) => c.id === columnId);
    const position = Math.max(0, ...column.tasks.map((t) => t.position)) + 1;
    const created = await api.post("/tasks", { column_id: columnId, ...data, position });
    setColumns((cs) =>
      cs.map((c) => (c.id === columnId ? { ...c, tasks: [...c.tasks, created] } : c))
    );
    notify("Task added");
  };

  const deleteTask = async (task) => {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    const snapshot = columns;
    setColumns((cs) => cs.map((c) => ({ ...c, tasks: c.tasks.filter((t) => t.id !== task.id) })));
    try {
      await api.del(`/tasks/${task.id}`);
      notify("Task deleted");
    } catch {
      setColumns(snapshot);
      notify("Couldn't delete that task.");
    }
  };

  // ----- screens before login -----
  if (authState === "out") {
    return (
      <Login
        onAuthed={(u) => {
          setUser(u);
          setStatus("loading");
          setAuthState("in");
        }}
      />
    );
  }
  if (authState === "checking") return <div className="splash">Loading…</div>;
  if (authState === "error") {
    return (
      <div className="splash">
        <h2>Can't reach the API</h2>
        <p>Start the backend with <code>uvicorn main:app --reload</code>, then try again.</p>
        <button className="btn primary" onClick={checkSession}>Try again</button>
      </div>
    );
  }

  const modalColumn = columns.find((c) => c.id === modalColumnId);
  const total = columns.reduce((n, c) => n + c.tasks.length, 0);

  return (
    <div className="app">
      <Header
        query={query}
        onQuery={(v) => { setQuery(v); if (v) setView("board"); }}
        onNewTask={() => columns[0] && setModalColumnId(columns[0].id)}
        theme={theme}
        onTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
        user={user}
        onLogout={logout}
      />
      <Sidebar view={view} onView={setView} />
      <main className="main">
        {status === "loading" && <p className="state">Loading your board…</p>}

        {status === "error" && (
          <div className="state">
            <h2>Can't reach the API</h2>
            <p>Start the backend with <code>uvicorn main:app --reload</code> in D:\TaskZen, then try again.</p>
            <button className="btn primary" onClick={() => { setStatus("loading"); load(); }}>Try again</button>
          </div>
        )}

        {status === "empty" && (
          <div className="state">
            <h2>No projects yet</h2>
            <p>Add a project and its columns in the database, then reload this page.</p>
          </div>
        )}

        {status === "ready" && view === "dashboard" && (
          <Dashboard project={project} columns={columns} userName={user.name} onOpenBoard={() => setView("board")} />
        )}

        {status === "ready" && view === "board" && (
          <>
            <div className="titlebar">
              <h1>{project.name}</h1>
              <span className="count">{total} {total === 1 ? "task" : "tasks"}</span>
              {q && <span className="hint">Search is on, so dragging is paused.</span>}
            </div>
            <div className="board">
              {visibleColumns.map((column, i) => (
                <Column
                  key={column.id}
                  column={column}
                  tone={i % 5}
                  canDrag={!q}
                  dragId={dragId}
                  drop={drop}
                  onDragStart={setDragId}
                  onDragEnd={() => { setDragId(null); setDrop(null); }}
                  onDropTarget={setDrop}
                  onDrop={(columnId, index) => {
                    if (dragId != null) moveTask(dragId, columnId, index);
                    setDragId(null);
                    setDrop(null);
                  }}
                  onAdd={() => setModalColumnId(column.id)}
                  onDelete={deleteTask}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {modalColumn && (
        <NewTaskModal
          columns={columns}
          initialColumnId={modalColumn.id}
          onClose={() => setModalColumnId(null)}
          onCreate={createTask}
        />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
