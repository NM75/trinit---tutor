// Écran principal : leçon (avec TTS) + questions/réponses + quiz.
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { LunaAvatar, BigButton, ChatBubble, LoadingDots, MicButton } from "../ui";
import { ResultsScreen } from "./Results";
import { QUIZ_COLORS } from "../../lib/themes";
import { lessonPrompt, qaPrompt, quizPrompt } from "../../lib/prompts";
import { callClaude, startCheckout } from "../../lib/api";
import { useSupabase } from "../../lib/supabase";
import { recordLesson, markThemeSeen } from "../../lib/db";
import { speakNatural, stopSpeaking } from "../../lib/tts";
import { useSpeechRecognition } from "../../lib/speech";

export const LessonScreen = ({ child, theme, onDone }) => {
  const { getToken } = useAuth();
  const sb = useSupabase();
  const [lesson, setLesson] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [quota, setQuota] = useState(null); // { plan, limit } si le quota hebdo est atteint
  const [upgrading, setUpgrading] = useState(false); // redirection Stripe en cours
  const [questions, setQuestions] = useState([]);
  const [chat, setChat] = useState([]);
  const [phase, setPhase] = useState("lesson");
  const [quizIndex, setQuizIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [waitingAnswer, setWaitingAnswer] = useState(false);
  const [textInput, setTextInput] = useState("");
  const chatEndRef = useRef(null);
  const lessonRef = useRef("");
  const { listening, transcript, startListening, stopListening, setTranscript, available: micAvailable } = useSpeechRecognition();
  const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" });

  const fetchLesson = useCallback(async () => {
    setLoading(true); setError(false); setQuota(null);
    const res = await callClaude(
      [{ role: "user", content: `Fais une leçon passionnante sur "${theme.label}" pour un enfant de ${child.age} ans. Thème : ${theme.id}. Vivant et amusant !` }],
      lessonPrompt(child, theme), getToken, { kind: "lesson" }
    );
    // Quota hebdo atteint : écran dédié, pas une erreur technique.
    if (res && res.quota) { setQuota(res); setLoading(false); return; }
    const text = res;
    if (!text) { setLoading(false); setError(true); return; }
    setLesson(text); lessonRef.current = text;
    setLoading(false); setError(false);
    // Thème marqué « vu » dès que la leçon s'affiche (best-effort, non bloquant).
    if (child.id) markThemeSeen(sb, { childId: child.id, themeId: theme.id }).catch(() => {});
    setIsSpeaking(true);
    speakNatural(text, () => setIsSpeaking(false));
  }, [child, theme, getToken, sb]);

  useEffect(() => { fetchLesson(); return () => stopSpeaking(); }, []);

  useEffect(() => {
    if (phase === "quiz" && questions.length === 0) {
      (async () => {
        const raw = await callClaude(
          [{ role: "user", content: `Voici la leçon :\n${lessonRef.current}\n\nGénère 3 questions de quiz.` }],
          quizPrompt(child), getToken
        );
        if (!raw) { setQuestions([{ question: "As-tu aimé la leçon ?", options: ["Oui", "Beaucoup", "Super"], correct: 0, explanation: "Tant mieux !" }]); return; }
        try { setQuestions(JSON.parse(raw.replace(/```json|```/g, "").trim())); }
        catch (e) { setQuestions([{ question: "As-tu aimé la leçon ?", options: ["Oui", "Beaucoup", "Super"], correct: 0, explanation: "Tant mieux !" }]); }
      })();
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "quiz" && questions[quizIndex] && !answered) {
      const q = questions[quizIndex];
      const narration = `${q.question}. ` + q.options.map((o, i) => `Le rond ${QUIZ_COLORS[i].label}, ${o}`).join(". ") + ". Appuie sur le rond de ta réponse !";
      setIsSpeaking(true);
      speakNatural(narration, () => setIsSpeaking(false));
    }
  }, [phase, quizIndex, questions.length]);

  useEffect(() => {
    if (transcript && phase === "qa") { handleChildQuestion(transcript); setTranscript(""); }
  }, [transcript]);

  const handleChildQuestion = async (text) => {
    if (!text.trim()) return;
    setChat((prev) => [...prev, { role: "child", text: text.trim() }]);
    setWaitingAnswer(true);
    const answer = await callClaude([{ role: "user", content: text.trim() }], qaPrompt(child, lessonRef.current), getToken);
    const finalAnswer = answer || "Hmm, je n'ai pas réussi. Essaie de me reposer la question !";
    setChat((prev) => [...prev, { role: "luna", text: finalAnswer }]);
    setWaitingAnswer(false);
    setIsSpeaking(true);
    speakNatural(finalAnswer, () => setIsSpeaking(false));
  };

  const submitText = () => { if (!textInput.trim()) return; handleChildQuestion(textInput.trim()); setTextInput(""); };

  const handleQuizAnswer = (idx) => {
    if (answered) return;
    stopSpeaking(); setAnswered(true); setSelectedAnswer(idx);
    const q = questions[quizIndex];
    if (idx === q.correct) { setScore((s) => s + 1); speakNatural("Bravo, c'est la bonne réponse !"); }
    else { speakNatural(`Pas tout à fait. ${q.explanation}. Mais c'est pas grave !`); }
  };

  const nextQuizQuestion = () => {
    stopSpeaking();
    if (quizIndex + 1 < questions.length) { setQuizIndex((i) => i + 1); setAnswered(false); setSelectedAnswer(null); }
    else {
      setPhase("results");
      speakNatural(score >= questions.length - 1 ? `Félicitations ${child.name} !` : `Bien joué ${child.name} !`);
      // Enregistre le résultat (best-effort, ne bloque pas l'écran de résultats).
      if (child.id) recordLesson(sb, { childId: child.id, theme, score, total: questions.length }).catch(() => {});
    }
  };

  useEffect(scrollToBottom, [chat, phase, quizIndex, waitingAnswer]);

  if (quota) {
    const isPremium = quota.plan === "premium";
    const onUpgrade = async () => {
      setUpgrading(true);
      const ok = await startCheckout(getToken); // succès → redirection Stripe (on ne revient pas)
      if (!ok) setUpgrading(false);             // échec → on réaffiche le bouton
    };
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 18, padding: 30 }}>
        <LunaAvatar size={100} />
        <p style={{ fontSize: 22, color: "#6b21a8", fontFamily: "'Baloo 2', cursive", textAlign: "center" }}>
          Tu as fait tes {quota.limit} leçons de la semaine ! 🎉
        </p>
        <p style={{ fontSize: 17, color: "#7c3aed", textAlign: "center", maxWidth: 320, lineHeight: 1.5 }}>
          {isPremium
            ? "Reviens lundi pour de nouvelles aventures 🌙"
            : "Reviens lundi 🌙 ou passe en Premium pour 15 leçons par semaine !"}
        </p>
        {!isPremium && (
          <BigButton onClick={onUpgrade} color="#7c3aed" bg="#f5d0fe" disabled={upgrading}>
            {upgrading ? "Redirection…" : "✨ Passer en Premium"}
          </BigButton>
        )}
        <BigButton onClick={onDone} color="#7c3aed" bg="#ede9fe" style={!isPremium ? { fontSize: 16, padding: "12px 20px" } : {}}>← Retour à l'accueil</BigButton>
      </div>
    );
  }

  if (loading || error) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 20, padding: 30 }}>
      <LunaAvatar size={100} />
      {error ? (<>
        <p style={{ fontSize: 20, color: "#6b21a8", fontFamily: "'Baloo 2', cursive", textAlign: "center" }}>Trinité n'arrive pas à se connecter...</p>
        <BigButton onClick={fetchLesson} color="#7c3aed" bg="#ede9fe">Réessayer 🔄</BigButton>
        <BigButton onClick={onDone} color="#9ca3af" bg="#f3f4f6" style={{ fontSize: 16, padding: "12px 20px" }}>← Retour</BigButton>
      </>) : (<>
        <p style={{ fontSize: 22, color: "#6b21a8", fontFamily: "'Baloo 2', cursive" }}>Trinité prépare ta leçon...</p>
        <LoadingDots />
      </>)}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "2px solid #ede9fe", background: "#faf5ff" }}>
        <span style={{ fontSize: 30 }}>{theme.emoji}</span>
        <span style={{ fontSize: 20, fontWeight: 800, color: theme.color, fontFamily: "'Baloo 2', cursive" }}>{theme.label}</span>
        <span style={{ marginLeft: "auto", fontSize: 14, color: "#7c3aed", fontWeight: 600 }}>
          {phase === "lesson" ? "📖 Leçon" : phase === "qa" ? "❓ Questions" : phase === "quiz" ? "🧩 Quiz" : "🏆 Résultat"}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 10px", WebkitOverflowScrolling: "touch" }}>

        {phase === "lesson" && (<>
          <ChatBubble text={lesson} isLuna />
          <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
            {isSpeaking
              ? <BigButton onClick={() => { stopSpeaking(); setIsSpeaking(false); }} color="#EF4444" bg="#FEE2E2">Pause ⏸️</BigButton>
              : <BigButton onClick={() => { setIsSpeaking(true); speakNatural(lesson, () => setIsSpeaking(false)); }} color="#7c3aed" bg="#ede9fe">Réécouter 🔊</BigButton>
            }
            <BigButton onClick={() => { stopSpeaking(); setIsSpeaking(false); setPhase("qa"); speakNatural("Est-ce que tu as des questions ?"); }} color="#22c55e" bg="#dcfce7">J'ai compris ! ✅</BigButton>
          </div>
        </>)}

        {phase === "qa" && (<>
          <ChatBubble text={`${child.name}, est-ce que tu as des questions ?`} isLuna />
          <p style={{ textAlign: "center", color: "#7c3aed", fontSize: 15, margin: "2px 0 12px" }}>
            {micAvailable ? "Appuie sur le micro ou tape ta question !" : "Tape ta question en bas !"}
          </p>
          {chat.map((msg, i) => <ChatBubble key={i} text={msg.text} isLuna={msg.role === "luna"} />)}
          {waitingAnswer && <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}><LunaAvatar size={44} /><LoadingDots /></div>}
          <div ref={chatEndRef} />
        </>)}

        {phase === "quiz" && (<>
          <ChatBubble text={`Question ${quizIndex + 1} sur ${questions.length}`} isLuna />
          {questions[quizIndex] ? (
            <div style={{ padding: "8px 0" }}>
              <div style={{ background: "#faf5ff", borderRadius: 18, padding: 20, marginBottom: 16, border: "2px solid #ede9fe" }}>
                <p style={{ fontSize: 20, fontWeight: 700, color: "#4c1d95" }}>{questions[quizIndex].question}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {questions[quizIndex].options.map((opt, idx) => {
                  const qc = QUIZ_COLORS[idx];
                  const isCorrect = idx === questions[quizIndex].correct;
                  const isSelected = idx === selectedAnswer;
                  let circleBg = qc.color, cardBg = qc.bg, cardBorder = qc.border, extra = {};
                  if (answered) {
                    if (isCorrect) { circleBg = "#16A34A"; cardBg = "#BBF7D0"; cardBorder = "#16A34A"; }
                    else if (isSelected) { circleBg = "#DC2626"; cardBg = "#FECACA"; cardBorder = "#DC2626"; extra = { opacity: 0.8 }; }
                    else { extra = { opacity: 0.4 }; }
                  }
                  return (
                    <button key={idx} onClick={() => handleQuizAnswer(idx)} disabled={answered} style={{
                      display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderRadius: 18,
                      border: `3px solid ${cardBorder}`, background: cardBg, cursor: answered ? "default" : "pointer",
                      fontFamily: "'Nunito', sans-serif", WebkitTapHighlightColor: "transparent", transition: "all 0.2s", ...extra,
                    }}>
                      <div style={{ width: 48, height: 48, borderRadius: "50%", background: circleBg, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 2px 8px ${circleBg}44` }}>
                        {answered && isCorrect && <span style={{ fontSize: 24, color: "white" }}>✓</span>}
                        {answered && isSelected && !isCorrect && <span style={{ fontSize: 24, color: "white" }}>✗</span>}
                      </div>
                      <span style={{ fontSize: 20, fontWeight: 700, color: "#1e1b4b" }}>{opt}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ textAlign: "center", marginTop: 12 }}>
                <button onClick={() => {
                  const q = questions[quizIndex];
                  speakNatural(`${q.question}. ` + q.options.map((o, i) => `Le rond ${QUIZ_COLORS[i].label}, ${o}`).join(". "));
                }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, color: "#7c3aed", fontWeight: 600, fontFamily: "'Nunito', sans-serif" }}>🔊 Réécouter</button>
              </div>
              {answered && (
                <div style={{ marginTop: 16, textAlign: "center" }}>
                  <p style={{ fontSize: 18, color: "#6b21a8", marginBottom: 12, fontWeight: 600 }}>
                    {selectedAnswer === questions[quizIndex].correct ? "🎉 Bravo !" : questions[quizIndex].explanation}
                  </p>
                  <BigButton onClick={nextQuizQuestion} color="#7c3aed" bg="#ede9fe">
                    {quizIndex + 1 < questions.length ? "Suivante ➡️" : "Résultats 🏆"}
                  </BigButton>
                </div>
              )}
            </div>
          ) : <LoadingDots />}
        </>)}

        {phase === "results" && (
          <ResultsScreen child={child} score={score} total={questions.length} onRestart={onDone} />
        )}
      </div>

      {phase === "qa" && (
        <div style={{ padding: "12px 14px", borderTop: "2px solid #ede9fe", background: "#faf5ff", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          {listening && <div style={{ color: "#EF4444", fontWeight: 700, fontSize: 18, animation: "fadeIn 0.3s ease" }}>Je t'écoute... 👂</div>}
          <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
            {micAvailable && <MicButton listening={listening} onPress={listening ? stopListening : startListening} size={56} />}
            <input value={textInput} onChange={(e) => setTextInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitText()}
              placeholder="Tape la question ici..." style={{
                flex: 1, padding: "12px 16px", fontSize: 16, borderRadius: 14,
                border: "2px solid #c4b5fd", fontFamily: "'Nunito', sans-serif", outline: "none",
              }} />
            <button onClick={submitText} style={{ width: 48, height: 48, borderRadius: "50%", background: "#7c3aed", border: "none", color: "white", fontSize: 22, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>➤</button>
          </div>
          <BigButton onClick={() => { stopSpeaking(); setPhase("quiz"); speakNatural("C'est l'heure du quiz !"); }}
            color="#22c55e" bg="#dcfce7" style={{ padding: "12px 24px", fontSize: 18, width: "100%" }}>Passer au quiz ! 🧩</BigButton>
        </div>
      )}
    </div>
  );
};