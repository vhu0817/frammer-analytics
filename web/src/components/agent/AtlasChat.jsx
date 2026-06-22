/**
 * AtlasChat — Slide-out right panel for the ATLAS AI agent.
 *
 * Features:
 *   - Slide-in/out animation with Framer Motion
 *   - Message history with auto-scroll
 *   - Thinking indicator with animated dots
 *   - Suggested starter queries for new users
 *   - Clear history button
 *   - Enter to send, Shift+Enter for newline
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Bot, X, Send, Trash2, Sparkles,
} from "lucide-react";
import useAgentStore from "@/stores/agentStore";
import ChatMessage from "./ChatMessage";

const SUGGESTED_QUERIES = [
  "How many videos were uploaded this month?",
  "Show me the top 5 clients by upload count",
  "What's the publishing rate by platform?",
  "Compare uploads this week vs last week",
];

/** Animated dots for the "thinking" state */
function ThinkingIndicator() {
  return (
    <div className="flex gap-2.5" id="atlas-thinking">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Bot className="size-3.5" />
      </div>
      <div className="glass-card rounded-xl rounded-tl-sm px-4 py-3">
        <div className="flex items-center gap-1.5">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="size-1.5 rounded-full bg-primary"
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground ml-1">Thinking...</span>
        </div>
      </div>
    </div>
  );
}


export default function AtlasChat({ isOpen, onClose }) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const messages = useAgentStore((s) => s.messages);
  const isLoading = useAgentStore((s) => s.isLoading);
  const sendQuery = useAgentStore((s) => s.sendQuery);
  const clearMessages = useAgentStore((s) => s.clearMessages);

  // auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    sendQuery(trimmed);
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* backdrop overlay */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            id="atlas-backdrop"
          />

          {/* chat panel */}
          <motion.div
            className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-md flex-col border-l border-border bg-background shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            id="atlas-chat-panel"
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Bot className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">ATLAS</h3>
                  <p className="text-[11px] text-muted-foreground">Analytics & Trends Language Agent</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={clearMessages}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                    title="Clear chat"
                    id="atlas-clear"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  id="atlas-close"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.length === 0 && !isLoading ? (
                <EmptyState onSelect={(q) => { setInput(q); inputRef.current?.focus(); }} />
              ) : (
                <>
                  {messages.map((msg, i) => (
                    <ChatMessage key={i} message={msg} />
                  ))}
                  {isLoading && <ThinkingIndicator />}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ── Input bar ── */}
            <div className="border-t border-border p-3">
              <div className="flex items-end gap-2 rounded-xl bg-secondary/50 border border-border p-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask ATLAS anything..."
                  rows={1}
                  className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none max-h-24"
                  style={{ minHeight: "1.5rem" }}
                  id="atlas-input"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg transition-all",
                    input.trim() && !isLoading
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "bg-secondary text-muted-foreground cursor-not-allowed"
                  )}
                  id="atlas-send"
                >
                  <Send className="size-3.5" />
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                ATLAS can make mistakes. Verify important data.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}


/** Empty state with suggested queries */
function EmptyState({ onSelect }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
        <Sparkles className="size-7" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">Ask ATLAS</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-[280px]">
        I can query your video analytics data, build charts, and answer questions in plain English.
      </p>
      <div className="w-full space-y-2">
        {SUGGESTED_QUERIES.map((q, i) => (
          <button
            key={i}
            onClick={() => onSelect(q)}
            className="w-full text-left rounded-xl glass-card-hover px-3.5 py-2.5 text-[13px] text-foreground/80 transition-all hover:text-foreground"
            id={`atlas-suggestion-${i}`}
          >
            <span className="text-primary mr-1.5">→</span> {q}
          </button>
        ))}
      </div>
    </div>
  );
}
