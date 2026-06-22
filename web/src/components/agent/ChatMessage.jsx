/**
 * ChatMessage — Renders a single message bubble in the ATLAS chat panel.
 *
 * User messages: right-aligned, primary-colored.
 * Agent messages: left-aligned, glass card, with inline markdown rendering
 *   and optional chart attachment.
 *
 * Markdown is rendered with a lightweight custom parser (bold, inline code,
 * tables, lists, headers) to avoid adding react-markdown as a dependency.
 */

import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";
import AgentChart from "./AgentChart";

/**
 * Lightweight markdown-to-JSX converter.
 * Handles: **bold**, `code`, headers, lists, and tables.
 * Not a full markdown parser — just enough for agent output.
 */
function renderMarkdown(text) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // table detection: line starts with | and next line is separator
    if (line.trim().startsWith("|") && i + 1 < lines.length && /^\|[\s:-]+\|/.test(lines[i + 1]?.trim())) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      elements.push(renderTable(tableLines, elements.length));
      continue;
    }

    // headers
    if (line.startsWith("### ")) {
      elements.push(<h4 key={i} className="text-xs font-semibold text-foreground mt-2 mb-1">{inlineFormat(line.slice(4))}</h4>);
    } else if (line.startsWith("## ")) {
      elements.push(<h3 key={i} className="text-sm font-semibold text-foreground mt-2 mb-1">{inlineFormat(line.slice(3))}</h3>);
    } else if (line.startsWith("# ")) {
      elements.push(<h2 key={i} className="text-sm font-bold text-foreground mt-2 mb-1">{inlineFormat(line.slice(2))}</h2>);
    }
    // unordered list
    else if (/^[-*]\s/.test(line.trim())) {
      elements.push(
        <div key={i} className="flex gap-1.5 text-[13px] leading-relaxed">
          <span className="text-muted-foreground shrink-0">•</span>
          <span>{inlineFormat(line.trim().slice(2))}</span>
        </div>
      );
    }
    // ordered list
    else if (/^\d+\.\s/.test(line.trim())) {
      const match = line.trim().match(/^(\d+)\.\s(.*)/);
      elements.push(
        <div key={i} className="flex gap-1.5 text-[13px] leading-relaxed">
          <span className="text-muted-foreground shrink-0">{match[1]}.</span>
          <span>{inlineFormat(match[2])}</span>
        </div>
      );
    }
    // empty line → small spacer
    else if (line.trim() === "") {
      elements.push(<div key={i} className="h-1.5" />);
    }
    // regular paragraph
    else {
      elements.push(
        <p key={i} className="text-[13px] leading-relaxed">{inlineFormat(line)}</p>
      );
    }
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}

/** Inline formatting: **bold**, `code` */
function inlineFormat(text) {
  if (!text) return text;

  // split by **bold** and `code` markers
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // inline code
    const codeMatch = remaining.match(/`([^`]+)`/);

    // find earliest match
    const boldIdx = boldMatch?.index ?? Infinity;
    const codeIdx = codeMatch?.index ?? Infinity;

    if (boldIdx === Infinity && codeIdx === Infinity) {
      parts.push(remaining);
      break;
    }

    if (boldIdx <= codeIdx) {
      parts.push(remaining.slice(0, boldIdx));
      parts.push(<strong key={key++} className="font-semibold text-foreground">{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldIdx + boldMatch[0].length);
    } else {
      parts.push(remaining.slice(0, codeIdx));
      parts.push(
        <code key={key++} className="px-1 py-0.5 rounded bg-secondary text-[12px] font-mono text-primary">
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeIdx + codeMatch[0].length);
    }
  }

  return parts;
}

/** Render a markdown table from raw lines */
function renderTable(tableLines, key) {
  const rows = tableLines
    .filter((line) => !/^[\s|:-]+$/.test(line.replace(/\|/g, ""))) // skip separator rows
    .map((line) =>
      line.split("|").slice(1, -1).map((cell) => cell.trim())
    );

  if (rows.length === 0) return null;
  const [header, ...body] = rows;

  return (
    <div key={key} className="overflow-x-auto my-2">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-border">
            {header.map((cell, i) => (
              <th key={i} className="px-2 py-1.5 text-left font-semibold text-muted-foreground">{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} className="border-b border-border/50">
              {row.map((cell, ci) => (
                <td key={ci} className="px-2 py-1.5 text-foreground">{inlineFormat(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


export default function ChatMessage({ message }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-2.5 max-w-full",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
      id={`chat-msg-${isUser ? "user" : "agent"}`}
    >
      {/* avatar */}
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full text-xs",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-muted-foreground"
        )}
      >
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </div>

      {/* message body */}
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-3.5 py-2.5",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "glass-card rounded-tl-sm"
        )}
      >
        {isUser ? (
          <p className="text-[13px] leading-relaxed">{message.content}</p>
        ) : (
          <>
            {renderMarkdown(message.content)}
            {message.chart && <AgentChart config={message.chart} />}
          </>
        )}
      </div>
    </div>
  );
}
