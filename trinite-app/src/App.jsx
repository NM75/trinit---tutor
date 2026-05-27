// Orchestrateur principal : gère l'auth, les enfants, et la navigation entre écrans.
import { useState, useEffect } from "react";
import { SetupScreen } from "./components/screens/Setup";
import { WelcomeScreen } from "./components/screens/Welcome";
import { ThemeScreen } from "./components/screens/Theme";
import { LessonScreen } from "./components/screens/Lesson";
import { LunaAvatar, BigButton } from "./components/ui";
import { callClaude } from "./lib/api";
import { stopSpeaking } from "./lib/tts";

const getStored = (key) => { try { return localStorage.getItem(key); } catch (e) { return null; } };
const setStored = (key, val) => { try { localStorage.setItem(key, val); } catch (e) {} };

// Écran de mot de passe (temporaire, remplacé par Clerk en Phase 2)
const PasswordScreen = ({ onSuccess }) => {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true); setError(false);
    const result = await callClaude(
      [{ role: "user", content: "Dis juste: OK" }],
      "Réponds uniquement OK.", pw
    );
    setChecking(false);
    if (result === "__WRONG_PASSWORD__") setError(true);
    else if (result) { setStored("trinite_pw", pw); onSuccess(pw); }
    else setError(true);
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100%", gap: 24, padding: 40,
      background: "linear-gradient(180deg, #f5f3ff 0%, #ede9fe 50%, #e0d4fc 100%)",
    }}>
      <LunaAvatar size={100} />
      <h1 style={{ fontSize: 32, fontWeight: 800, color: "#4c1d95", fontFamily: "'Baloo 2', cursive", textAlign: "center" }}>
        Trinité — Tuteur 🧚
      </h1>
      <p style={{ fontSize: 18, color: "#6b21a8", textAlign: "center" }}>
        Entre le mot de passe pour commencer
      </p>
      <input
        type="password" value={pw}
        onChange={(e) => setPw(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && check()}
        placeholder="Mot de passe..."
        style={{
          padding: "14px 20px", fontSize: 18, borderRadius: 16,
          border: error ? "3px solid #EF4444" : "3px solid #c4b5fd",
          width: "100%", maxWidth: 300, textAlign: "center",
          fontFamily: "'Nunito', sans-serif", outline: "none",
        }}
      />
      {error && <p style={{ color: "#EF4444", fontWeight: 700 }}>Mot de passe incorrect</p>}
      <BigButton onClick={check} color="#7c3aed" bg="#ede9fe" disabled={checking || !pw}>
        {checking ? "Vérification..." : "Entrer"}
      </BigButton>
    </div>
  );
};

const App = () => {
  const [password, setPassword] = useState(getStored("trinite_pw") || "");
  const [authenticated, setAuthenticated] = useState(!!getStored("trinite_pw"));
  const [childrenList, setChildrenList] = useState(() => {
    const s = getStored("trinite_children");
    return s ? JSON.parse(s) : null;
  });
  const [screen, setScreen] = useState("welcome");
  const [child, setChild] = useState(null);
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
  }, []);

  const reset = () => { stopSpeaking(); setScreen("welcome"); setChild(null); setTheme(null); };

  const saveChildren = (c) => { setStored("trinite_children", JSON.stringify(c)); setChildrenList(c); };

  if (!authenticated) return <PasswordScreen onSuccess={(pw) => { setPassword(pw); setAuthenticated(true); }} />;
  if (!childrenList) return <SetupScreen initialChildren={[]} onDone={saveChildren} />;

  return (
    <div style={{
      width: "100%", height: "100vh", maxHeight: "-webkit-fill-available",
      background: "linear-gradient(180deg, #f5f3ff 0%, #ede9fe 50%, #e0d4fc 100%)",
      fontFamily: "'Nunito', sans-serif",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {screen !== "welcome" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", background: "#7c3aed", flexShrink: 0 }}>
          <button onClick={reset} style={{ background: "none", border: "none", color: "white", fontSize: 16, cursor: "pointer", fontWeight: 700, fontFamily: "'Nunito', sans-serif" }}>← Accueil</button>
          <span style={{ color: "white", fontSize: 16, fontWeight: 700 }}>🧚 Trinité — {child?.name}</span>
        </div>
      )}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {screen === "welcome" && <WelcomeScreen childrenList={childrenList} onSelect={(c) => { setChild(c); setScreen("theme"); }} onEditChildren={() => setChildrenList(null)} />}
        {screen === "theme" && <ThemeScreen child={child} onSelect={(t) => { setTheme(t); setScreen("lesson"); }} />}
        {screen === "lesson" && <LessonScreen child={child} theme={theme} password={password} onDone={reset} />}
      </div>
    </div>
  );
};

export default App;
