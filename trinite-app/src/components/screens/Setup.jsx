// Écran de configuration des enfants (prénoms + âges).
import { useState } from "react";
import { BigButton, LunaAvatar } from "../ui";

export const SetupScreen = ({ initialChildren, onDone }) => {
  const initial = initialChildren && initialChildren.length ? initialChildren : [{ name: "", age: "" }];
  const [children, setChildren] = useState(initial);

  const update = (idx, field, val) => {
    const c = [...children];
    c[idx] = { ...c[idx], [field]: val };
    setChildren(c);
  };

  const addChild = () => setChildren((prev) => [...prev, { name: "", age: "" }]);
  const removeChild = (idx) => setChildren((prev) => prev.filter((_, i) => i !== idx));

  const save = () => {
    const valid = children.filter((c) => c.name.trim() && c.age);
    if (valid.length === 0) return;
    onDone(valid);
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100%", gap: 20, padding: 30,
      background: "linear-gradient(180deg, #f5f3ff 0%, #ede9fe 50%, #e0d4fc 100%)",
    }}>
      <LunaAvatar size={80} />
      <h2 style={{ fontSize: 26, fontWeight: 800, color: "#4c1d95", fontFamily: "'Baloo 2', cursive", textAlign: "center" }}>
        Qui sont les enfants ?
      </h2>
      <p style={{ fontSize: 16, color: "#6b21a8", textAlign: "center" }}>
        Ajoute les prénoms et âges (tu peux modifier plus tard)
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 360 }}>
        {children.map((c, idx) => (
          <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              value={c.name}
              onChange={(e) => update(idx, "name", e.target.value)}
              placeholder="Prénom"
              style={{
                flex: 2, padding: "12px 14px", fontSize: 16, borderRadius: 12,
                border: "2px solid #c4b5fd", fontFamily: "'Nunito', sans-serif", outline: "none",
              }}
            />
            <input
              value={c.age}
              onChange={(e) => update(idx, "age", e.target.value)}
              placeholder="Âge"
              type="number"
              style={{
                flex: 1, padding: "12px 10px", fontSize: 16, borderRadius: 12,
                border: "2px solid #c4b5fd", fontFamily: "'Nunito', sans-serif", outline: "none",
                textAlign: "center",
              }}
            />
            {children.length > 1 && (
              <button onClick={() => removeChild(idx)} style={{
                width: 36, height: 36, borderRadius: "50%", border: "none",
                background: "#FEE2E2", color: "#EF4444", fontSize: 18,
                cursor: "pointer", fontWeight: 700,
              }}>✕</button>
            )}
          </div>
        ))}
      </div>
      <button onClick={addChild} style={{
        background: "none", border: "none", color: "#7c3aed",
        fontSize: 16, fontWeight: 700, cursor: "pointer",
        fontFamily: "'Nunito', sans-serif",
      }}>+ Ajouter un enfant</button>
      <BigButton onClick={save} color="#7c3aed" bg="#ede9fe"
        disabled={!children.some((c) => c.name.trim() && c.age)}>
        C'est parti ! 🚀
      </BigButton>
    </div>
  );
};