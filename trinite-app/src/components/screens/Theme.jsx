// Écran de choix du thème (8 cartes) + pastilles de progression.
import { useEffect, useState } from "react";
import { LunaAvatar } from "../ui";
import { THEMES } from "../../lib/themes";
import { speakNatural, stopSpeaking } from "../../lib/tts";
import { useSupabase } from "../../lib/supabase";
import { getChildProgress } from "../../lib/db";

// Ratio score/total → nombre d'étoiles (cohérent avec l'écran Résultats).
const stars = (ratio) => (ratio >= 1 ? "⭐⭐⭐" : ratio >= 0.66 ? "⭐⭐" : "⭐");

export const ThemeScreen = ({ child, onSelect }) => {
  const sb = useSupabase();
  const [progress, setProgress] = useState({ best: {}, seen: new Set() });

  useEffect(() => {
    speakNatural(`${child.name}, choisis ce que tu veux apprendre aujourd'hui !`);
    return () => stopSpeaking();
  }, []);

  useEffect(() => {
    if (child.id) getChildProgress(sb, child.id).then(setProgress).catch(() => {});
  }, [sb, child.id]);

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
        {THEMES.map((t) => {
          const seen = progress.seen.has(t.id);
          const best = progress.best[t.id];
          return (
            <button key={t.id}
              onClick={() => { stopSpeaking(); speakNatural(t.label); onSelect(t); }}
              style={{
                position: "relative",
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 6, padding: "18px 10px", borderRadius: 20,
                border: `3px solid ${t.color}`, background: t.bg,
                cursor: "pointer", WebkitTapHighlightColor: "transparent",
              }}
            >
              {seen && (
                <span style={{
                  position: "absolute", top: 6, right: 8, fontSize: 13, fontWeight: 700,
                  color: t.color, display: "flex", alignItems: "center", gap: 2,
                }}>
                  {best !== undefined ? stars(best) : "✓"}
                </span>
              )}
              <span style={{ fontSize: 48 }}>{t.emoji}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: t.color, fontFamily: "'Baloo 2', cursive", textAlign: "center" }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};