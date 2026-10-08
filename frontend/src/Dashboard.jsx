//Dashboard.jsx takes the same board data and turns it into the stats, donut and bars.

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Layers, Loader } from "lucide-react";

export const TONES = ["#ef5b4c", "#3b6ef0", "#f0a020", "#1fb26b", "#8b5cf6"];
const PRIORITY_COLOR = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };

function useCountUp(target, ms = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setValue(target);
    let raf, start;
    const step = (t) => {
      start ??= t;
      const p = Math.min((t - start) / ms, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

function Stat({ icon: Icon, label, value, from, to, delay }) {
  const shown = useCountUp(value);
  return (
    <div className="stat" style={{ "--delay": delay + "ms" }}>
      <span className="stat-icon" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
        <Icon size={22} />
      </span>
      <div>
        <strong>{shown}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

const C = 2 * Math.PI * 52;

function Donut({ segments, total, centerLabel }) {
  let used = 0;
  return (
    <svg className="donut" viewBox="0 0 140 140" role="img" aria-label="Tasks by priority">
      <g transform="rotate(-90 70 70)">
        <circle cx="70" cy="70" r="52" className="donut-track" />
        {segments.filter((s) => s.value > 0).map((s) => {
          const len = (s.value / total) * C;
          const el = (
            <circle
              key={s.label}
              cx="70" cy="70" r="52"
              className="donut-seg"
              stroke={s.color}
              strokeDasharray={`${Math.max(len - 3, 0)} ${C - Math.max(len - 3, 0)}`}
              strokeDashoffset={-used}
            />
          );
          used += len;
          return el;
        })}
      </g>
      <text x="70" y="68" textAnchor="middle" className="donut-num">{total}</text>
      <text x="70" y="86" textAnchor="middle" className="donut-cap">{centerLabel}</text>
    </svg>
  );
}

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
}

export default function Dashboard({ project, columns, onOpenBoard }) {
  const all = columns.flatMap((c) => c.tasks.map((t) => ({ ...t, columnName: c.name, columnId: c.id })));
  const doneCol = columns.find((c) => /done/i.test(c.name)) ?? columns[columns.length - 1];
  const progressCol = columns.find((c) => /progress/i.test(c.name));

  const total = all.length;
  const done = all.filter((t) => t.columnId === doneCol?.id).length;
  const inProgress = progressCol ? progressCol.tasks.length : 0;
  const open = all.filter((t) => t.columnId !== doneCol?.id);
  const highOpen = open.filter((t) => t.priority === "high");
  const percent = total ? Math.round((done / total) * 100) : 0;
  const percentShown = useCountUp(percent);

  const priorities = ["high", "medium", "low"].map((p) => ({
    label: p, color: PRIORITY_COLOR[p], value: all.filter((t) => t.priority === p).length,
  }));
  const maxCol = Math.max(1, ...columns.map((c) => c.tasks.length));
  const recent = [...all].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "") || b.id - a.id).slice(0, 5);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="dash">
      <section className="hero">
        <div>
          <h1>{greeting}, Pramodh</h1>
          <p>
            {total === 0
              ? `${project.name} has no tasks yet.`
              : `${project.name}: ${open.length} open ${open.length === 1 ? "task" : "tasks"} across ${columns.length} columns, ${percent}% complete.`}
          </p>
        </div>
        <button className="btn light" onClick={onOpenBoard}>Open board</button>
      </section>

      <section className="stats">
        <Stat icon={Layers} label="Total tasks" value={total} from="#6d7cff" to="#9b5de5" delay={0} />
        <Stat icon={Loader} label="In progress" value={inProgress} from="#3b6ef0" to="#38bdf8" delay={70} />
        <Stat icon={CheckCircle2} label="Completed" value={done} from="#1fb26b" to="#7ddf64" delay={140} />
        <Stat icon={AlertTriangle} label="High priority open" value={highOpen.length} from="#ef5b4c" to="#f59e0b" delay={210} />
      </section>

      <section className="panels">
        <article className="panel">
          <h2>Completion</h2>
          <div className="ring-wrap">
            <svg viewBox="0 0 140 140" className="ring" role="img" aria-label={`${percent}% complete`}>
              <defs>
                <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#6d7cff" />
                  <stop offset="100%" stopColor="#1fb26b" />
                </linearGradient>
              </defs>
              <g transform="rotate(-90 70 70)">
                <circle cx="70" cy="70" r="52" className="donut-track" />
                <circle cx="70" cy="70" r="52" className="ring-fill" stroke="url(#ringGrad)"
                  strokeDasharray={`${(percent / 100) * C} ${C}`} />
              </g>
              <text x="70" y="78" textAnchor="middle" className="donut-num">{percentShown}%</text>
            </svg>
            <p>{done} of {total} tasks are in <b>{doneCol?.name}</b>.</p>
          </div>
        </article>

        <article className="panel">
          <h2>Tasks by priority</h2>
          <div className="donut-wrap">
            <Donut segments={priorities} total={total} centerLabel="tasks" />
            <ul className="legend">
              {priorities.map((p) => (
                <li key={p.label}><i style={{ background: p.color }} />{p.label[0].toUpperCase() + p.label.slice(1)}<b>{p.value}</b></li>
              ))}
            </ul>
          </div>
        </article>

        <article className="panel">
          <h2>Tasks per column</h2>
          <ul className="bars">
            {columns.map((c, i) => (
              <li key={c.id}>
                <div className="bar-label"><span>{c.name}</span><b>{c.tasks.length}</b></div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(c.tasks.length / maxCol) * 100}%`, background: TONES[i % TONES.length], "--i": i }} />
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel wide">
          <h2>Needs attention</h2>
          {highOpen.length === 0 ? (
            <p className="muted">No open high-priority tasks. Nice work.</p>
          ) : (
            <ul className="rows">
              {highOpen.slice(0, 4).map((t) => (
                <li key={t.id}><i style={{ background: PRIORITY_COLOR.high }} /><span>{t.title}</span><em>{t.columnName}</em></li>
              ))}
            </ul>
          )}
        </article>

        <article className="panel wide">
          <h2>Recently added</h2>
          {recent.length === 0 ? (
            <p className="muted">Tasks you add will show up here.</p>
          ) : (
            <ul className="rows">
              {recent.map((t) => (
                <li key={t.id}><i style={{ background: PRIORITY_COLOR[t.priority] }} /><span>{t.title}</span><em>{t.columnName}{t.created_at ? ` · ${formatDate(t.created_at)}` : ""}</em></li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </div>
  );
}
