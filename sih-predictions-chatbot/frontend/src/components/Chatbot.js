import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import "./Chatbot.css";

export default function Chatbot({ userId }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "bot", text: "Hi! Ask me about your budget, daily limit, or spending trends." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setSending(true);

    try {
      const res = await axios.post("/api/chatbot", { user_id: userId, message: text });
      setMessages((m) => [...m, { role: "bot", text: res.data.reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "bot", text: "Something went wrong — try again in a moment." },
      ]);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="chatbot-root">
      {open && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <span>Finance Assistant</span>
            <button className="chatbot-close" onClick={() => setOpen(false)} aria-label="Close">
              ×
            </button>
          </div>

          <div className="chatbot-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chatbot-bubble ${m.role}`}>
                {m.text}
              </div>
            ))}
            {sending && <div className="chatbot-bubble bot typing">Thinking…</div>}
            <div ref={bottomRef} />
          </div>

          <div className="chatbot-input-row">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask about your budget…"
              disabled={sending}
            />
            <button onClick={send} disabled={sending || !input.trim()}>
              Send
            </button>
          </div>
        </div>
      )}

      <button className="chatbot-fab" onClick={() => setOpen((o) => !o)} aria-label="Open assistant">
        {open ? "×" : "Chat"}
      </button>
    </div>
  );
}
