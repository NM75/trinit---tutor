// Écran de choix du thème (8 cartes).
import { useEffect } from "react";
import { LunaAvatar } from "../ui";
import { THEMES } from "../../lib/themes";
import { speakNatural, stopSpeaking } from "../../lib/tts";

export const ThemeScreen = ({ child, onSelect }) => {
  useEffect(() => {
    speakNatural(`${child.name}, choisis ce que tu veux apprendre aujourd'hui !`);
    return () => stopSpeaking();
  }, []);

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "20px 16px", gap: 20, height: "100%", overflowY: "auto",
      WebkitOverflowScrolling: "touch",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <LunaAvatar size={48} />
        <h2 style={{ fontSize: 24, fontWeight: 800, color: "#4c1d95", fontFamily: "'Baloo 2', cursive" }}>
          {child.name}, que veux-tu apprendre ?
        </h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, width: "100%", maxWidth: 500 }}>
        {THEMES.map((t) => (
          <button key={t.id}
            onClick={() => { stopSpeaking(); speakNatural(t.label); onSelect(t); }}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 6, padding: "18px 10px", borderRadius: 20,
              border: `3px solid ${t.color}`, background: t.bg,
              cursor: "pointer", WebkitTapHighlightColor: "transparent",
            }}
          >
            <span style={{ fontSize: 48 }}>{t.emoji}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: t.color, fontFamily: "'Baloo 2', cursive", textAlign: "center" }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};