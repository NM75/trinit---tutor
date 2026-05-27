// Composants visuels réutilisables de Trinité.
import { useState, useEffect, useRef, useCallback } from "react";

export const BigButton = ({ onClick, children, color, bg, style = {}, disabled = false }) => (
  <button onClick={onClick} disabled={disabled} style={{
    padding: "16px 28px", fontSize: 20, fontWeight: 700,
    border: `3px solid ${color || "#6366F1"}`, borderRadius: 20,
    background: bg || "#EEF2FF", color: color || "#6366F1",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1, transition: "all 0.2s",
    fontFamily: "'Nunito', sans-serif",
    WebkitTapHighlightColor: "transparent", ...style,
  }}>{children}</button>
);

export const LunaAvatar = ({ size = 80 }) => (
  <div style={{
    width: size, height: size, borderRadius: "50%",
    background: "linear-gradient(135deg, #f0abfc 0%, #c026d3 100%)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: size * 0.5, boxShadow: "0 4px 20px rgba(192,38,211,0.3)", flexShrink: 0,
  }}>🧚</div>
);

export const ChatBubble = ({ text, isLuna = true }) => (
  <div style={{
    display: "flex", gap: 12, alignItems: "flex-start",
    marginBottom: 14, flexDirection: isLuna ? "row" : "row-reverse",
    animation: "fadeIn 0.4s ease",
  }}>
    {isLuna && <LunaAvatar size={44} />}
    <div style={{
      background: isLuna ? "#F3F0FF" : "#E0F2FE",
      borderRadius: isLuna ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
      padding: "14px 18px", maxWidth: "80%",
      fontSize: 18, lineHeight: 1.6, color: "#1e1b4b",
      fontFamily: "'Nunito', sans-serif",
    }}>{text}</div>
    {!isLuna && <div style={{
      width: 44, height: 44, borderRadius: "50%", background: "#E0F2FE",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 24, flexShrink: 0,
    }}>🧒</div>}
  </div>
);

export const LoadingDots = () => (
  <div style={{ display: "flex", gap: 8, padding: 20, justifyContent: "center" }}>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{
        width: 12, height: 12, borderRadius: "50%", background: "#a78bfa",
        animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
      }} />
    ))}
  </div>
);

export const MicButton = ({ listening, onPress, size = 72 }) => (
  <button onClick={onPress} style={{
    width: size, height: size, borderRadius: "50%",
    background: listening ? "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)" : "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
    border: listening ? "4px solid #FCA5A5" : "4px solid #c4b5fd",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", fontSize: size * 0.38,
    boxShadow: listening ? "0 0 0 8px rgba(239,68,68,0.2)" : "0 4px 20px rgba(192,38,211,0.3)",
    transition: "all 0.3s", animation: listening ? "pulse 1.5s ease-in-out infinite" : "none",
    WebkitTapHighlightColor: "transparent",
  }}>{listening ? "⏹️" : "🎤"}</button>
);