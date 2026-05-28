// Orchestrateur principal : Clerk gère l'auth, puis navigation entre écrans.
import { useState, useEffect } from "react";
import { SignedIn, SignedOut, SignIn, UserButton, useUser } from "@clerk/clerk-react";
import { SetupScreen } from "./components/screens/Setup";
import { WelcomeScreen } from "./components/screens/Welcome";
import { ThemeScreen } from "./components/screens/Theme";
import { LessonScreen } from "./components/screens/Lesson";
import { LunaAvatar } from "./components/ui";
import { stopSpeaking } from "./lib/tts";

const getStored = (key) => { try { return localStorage.getItem(key); } catch (e) { return null; } };
const setStored = (key, val) => { try { localStorage.setItem(key, val); } catch (e) {} };

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

// L'app principale (une fois connecté)
const MainApp = () => {
  const { user } = useUser();
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

  if (!childrenList) return <SetupScreen initialChildren={[]} onDone={saveChildren} />;

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
        {screen === "welcome" && <WelcomeScreen childrenList={childrenList} onSelect={(c) => { setChild(c); setScreen("theme"); }} onEditChildren={() => setChildrenList(null)} />}
        {screen === "theme" && <ThemeScreen child={child} onSelect={(t) => { setTheme(t); setScreen("lesson"); }} />}
        {screen === "lesson" && <LessonScreen child={child} theme={theme} password="" onDone={reset} />}
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