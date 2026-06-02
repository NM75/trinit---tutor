// Orchestrateur principal : Clerk gère l'auth, puis navigation entre écrans.
import { useState, useEffect } from "react";
import { SignedIn, SignedOut, SignIn, UserButton } from "@clerk/clerk-react";
import { SetupScreen } from "./components/screens/Setup";
import { WelcomeScreen } from "./components/screens/Welcome";
import { ThemeScreen } from "./components/screens/Theme";
import { LessonScreen } from "./components/screens/Lesson";
import { LunaAvatar, BigButton, LoadingDots } from "./components/ui";
import { stopSpeaking } from "./lib/tts";
import { useSupabase } from "./lib/supabase";
import { listChildren, addChild, reconcileChildren } from "./lib/db";

const getStored = (key) => { try { return localStorage.getItem(key); } catch (e) { return null; } };

// Charge les enfants depuis Supabase. Au 1er passage, si la base est vide mais
// que d'anciens enfants existent en localStorage, on les importe une fois.
async function loadChildren(sb) {
  let rows = await listChildren(sb);
  if (rows.length === 0) {
    const legacy = getStored("trinite_children");
    if (legacy) {
      try {
        const parsed = JSON.parse(legacy);
        for (const c of parsed) {
          if (c?.name?.trim() && c?.age) await addChild(sb, c);
        }
        rows = await listChildren(sb);
        if (rows.length) localStorage.removeItem("trinite_children");
      } catch (e) {}
    }
  }
  return rows;
}

// Écran de connexion (remplace l'ancien mot de passe)
const LoginScreen = () => (
  <div style={{
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", minHeight: "100vh", gap: 24, padding: 40,
    background: "linear-gradient(180deg, #f5f3ff 0%, #ede9fe 50%, #e0d4fc 100%)",
  }}>
    <LunaAvatar size={100} />
    <h1 style={{ fontSize: 32, fontWeight: 800, color: "#4c1d95", fontFamily: "'Baloo 2', cursive", textAlign: "center" }}>
      Trinité — Tuteur 🧚
    </h1>
    <p style={{ fontSize: 18, color: "#6b21a8", textAlign: "center" }}>
      Connecte-toi pour commencer
    </p>
    <SignIn routing="hash" />
  </div>
);

// Écran plein centré (chargement / erreur).
const FullScreen = ({ children }) => (
  <div style={{
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    minHeight: "100vh", gap: 20, padding: 40,
    background: "linear-gradient(180deg, #f5f3ff 0%, #ede9fe 50%, #e0d4fc 100%)",
  }}>{children}</div>
);

// L'app principale (une fois connecté)
const MainApp = () => {
  const sb = useSupabase();
  const [childrenList, setChildrenList] = useState(null); // null = pas encore chargé
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [screen, setScreen] = useState("welcome");
  const [child, setChild] = useState(null);
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
  }, []);

  const load = async () => {
    setLoading(true); setError(false);
    try { setChildrenList(await loadChildren(sb)); }
    catch (e) { setError(true); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [sb]);

  const reset = () => { stopSpeaking(); setScreen("welcome"); setChild(null); setTheme(null); };

  const saveChildren = async (desired) => {
    setLoading(true); setError(false);
    try {
      setChildrenList(await reconcileChildren(sb, desired, childrenList ?? []));
      setEditing(false);
    } catch (e) { setError(true); }
    finally { setLoading(false); }
  };

  if (loading) return <FullScreen><LunaAvatar size={100} /><LoadingDots /></FullScreen>;

  if (error) return (
    <FullScreen>
      <LunaAvatar size={100} />
      <p style={{ fontSize: 20, color: "#6b21a8", fontFamily: "'Baloo 2', cursive", textAlign: "center" }}>
        Trinité n'arrive pas à charger tes données...
      </p>
      <BigButton onClick={load} color="#7c3aed" bg="#ede9fe">Réessayer 🔄</BigButton>
    </FullScreen>
  );

  if (editing || !childrenList || childrenList.length === 0)
    return <SetupScreen initialChildren={childrenList ?? []} onDone={saveChildren} />;

  return (
    <div style={{
      width: "100%", minHeight: "100vh", maxHeight: "-webkit-fill-available",
      background: "linear-gradient(180deg, #f5f3ff 0%, #ede9fe 50%, #e0d4fc 100%)",
      fontFamily: "'Nunito', sans-serif",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", background: "#7c3aed", flexShrink: 0 }}>
        {screen !== "welcome" ? (
          <button onClick={reset} style={{ background: "none", border: "none", color: "white", fontSize: 16, cursor: "pointer", fontWeight: 700, fontFamily: "'Nunito', sans-serif" }}>← Accueil</button>
        ) : <span style={{ color: "white", fontSize: 16, fontWeight: 700 }}>🧚 Trinité</span>}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {screen !== "welcome" && <span style={{ color: "white", fontSize: 16, fontWeight: 700 }}>{child?.name}</span>}
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {screen === "welcome" && <WelcomeScreen childrenList={childrenList} onSelect={(c) => { setChild(c); setScreen("theme"); }} onEditChildren={() => setEditing(true)} />}
        {screen === "theme" && <ThemeScreen child={child} onSelect={(t) => { setTheme(t); setScreen("lesson"); }} />}
        {screen === "lesson" && <LessonScreen child={child} theme={theme} onDone={reset} />}
      </div>
    </div>
  );
};

const App = () => (
  <>
    <SignedOut>
      <LoginScreen />
    </SignedOut>
    <SignedIn>
      <MainApp />
    </SignedIn>
  </>
);

export default App;
