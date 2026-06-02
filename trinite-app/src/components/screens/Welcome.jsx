// Écran d'accueil : "Qui es-tu aujourd'hui ?" (sélection de l'enfant).
import { useEffect } from "react";
import { LunaAvatar } from "../ui";
import { speakNatural, stopSpeaking } from "../../lib/tts";

export const WelcomeScreen = ({ childrenList, onSelect, onEditChildren }) => {
  useEffect(() => {
    speakNatural("Bonjour ! Je suis Trinité, ta fée savante. Qui es-tu aujourd'hui ?");
    return () => stopSpeaking();
  }, []);

  const colors = ["#EC4899", "#3B82F6", "#F59E0B", "#22C55E", "#8B5CF6", "#EF4444"];
  const bgs = ["#FCE7F3", "#DBEAFE", "#FEF3C7", "#DCFCE7", "#EDE9FE", "#FEE2E2"];
  const emojis = ["👧", "👦", "🧒", "👶", "🧒", "👦"];

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100%", gap: 28, padding: "24px 20px",
      overflowY: "auto", WebkitOverflowScrolling: "touch",
    }}>
      <LunaAvatar size={100} />
      <h1 style={{ fontSize: 32, fontWeight: 800, color: "#4c1d95", fontFamily: "'Baloo 2', cursive", textAlign: "center" }}>
        Bonjour ! Je suis Trinité 🧚
      </h1>
      <p style={{ fontSize: 22, color: "#6b21a8", textAlign: "center" }}>Qui es-tu aujourd'hui ?</p>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
        {childrenList.map((c, idx) => {
          const col = colors[idx % colors.length];
          const bg = bgs[idx % bgs.length];
          const em = emojis[idx % emojis.length];
          return (
            <button key={c.id ?? c.name}
              onClick={() => { stopSpeaking(); speakNatural(`Bonjour ${c.name} ! C'est parti !`); onSelect(c); }}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 8, padding: "22px 40px", borderRadius: 24,
                border: `4px solid ${col}`, background: bg,
                cursor: "pointer", WebkitTapHighlightColor: "transparent",
              }}
            >
              <span style={{ fontSize: 64 }}>{em}</span>
              <span style={{ fontSize: 26, fontWeight: 800, color: col, fontFamily: "'Baloo 2', cursive" }}>{c.name}</span>
            </button>
          );
        })}
      </div>
      <button onClick={onEditChildren} style={{
        background: "none", border: "none", color: "#7c3aed",
        fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif",
        marginTop: 8,
      }}>⚙️ Modifier les enfants</button>
    </div>
  );
};
