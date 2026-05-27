// Écran de résultats : score + étoiles.
import { LunaAvatar, BigButton } from "../ui";

export const ResultsScreen = ({ child, score, total, onRestart }) => {
  const stars = score === total ? "⭐⭐⭐" : score >= total - 1 ? "⭐⭐" : "⭐";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "16px 10px" }}>
      <LunaAvatar size={80} />
      <h2 style={{ fontSize: 28, fontWeight: 800, color: "#4c1d95", fontFamily: "'Baloo 2', cursive", textAlign: "center" }}>
        {score >= total - 1 ? `Bravo ${child.name} !` : `Bien joué ${child.name} !`}
      </h2>
      <div style={{ background: "#faf5ff", borderRadius: 22, padding: "24px 32px", textAlign: "center", border: "3px solid #c4b5fd" }}>
        <p style={{ fontSize: 48, marginBottom: 6 }}>{stars}</p>
        <p style={{ fontSize: 26, fontWeight: 800, color: "#6b21a8" }}>{score} / {total}</p>
        <p style={{ fontSize: 16, color: "#7c3aed" }}>bonnes réponses</p>
      </div>
      <BigButton onClick={onRestart} color="#0ea5e9" bg="#e0f2fe">Nouvelle leçon 🔄</BigButton>
    </div>
  );
};