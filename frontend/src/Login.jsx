import { useState } from "react";
import { Columns3 } from "lucide-react";
import { api, login, register } from "./api";

export default function Login({ onAuthed }) {
  const [mode, setMode] = useState("login"); // login | register
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isRegister = mode === "register";

  const switchMode = () => {
    setMode(isRegister ? "login" : "register");
    setError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (isRegister && password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy(true);
    setError("");
    try {
      if (isRegister) await register(name.trim(), email.trim(), password);
      await login(email.trim(), password);
      onAuthed(await api.get("/auth/me"));
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Can't reach the server. Is the backend running?"
          : err.message || "Something went wrong."
      );
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-art" aria-hidden="true">
        <div className="brand big"><span className="logo"><Columns3 size={22} /></span>Task<span>Zen</span></div>
        <h2>Plan it. Move it. Finish it.</h2>
        <p>A simple Kanban board backed by FastAPI and PostgreSQL.</p>
      </div>

      <form className="auth-card" onSubmit={submit}>
        <h1>{isRegister ? "Create your account" : "Welcome back"}</h1>
        <p className="auth-sub">{isRegister ? "It only takes a moment." : "Sign in to open your board."}</p>

        {isRegister && (
          <label>Name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required autoComplete="name" />
          </label>
        )}
        <label>Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
            autoComplete={isRegister ? "new-password" : "current-password"} />
        </label>

        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary wide" type="submit" disabled={busy}>
          {busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
        </button>
        <button className="link-btn" type="button" onClick={switchMode}>
          {isRegister ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </form>
    </div>
  );
}
