import { useState, useEffect, useRef } from 'react';
import { useTeamSpecStore } from '../../store/teamSpec.js';
import { useAIConfig } from '../../store/aiConfig.js';
import { useWizard } from '../../hooks/useWizard.js';
import { useScrollToBottom, useAutofocus } from '../../hooks/useChatUI.js';
import AISetup from '../ai/AISetup.jsx';
import { MessageBubble } from '../common/MessageBubble.jsx';
import { BouncingDots } from '../common/LoadingSpinner.jsx';

// ── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `PERSONA: You are a friendly Mac setup assistant for Shellmate — a personal AI helper that lives on your Mac.

CONVERSATION STYLE:
- Warm, concise, Mac-native language. Like a helpful friend who knows Macs really well.
- Plain English only. Never use technical jargon like "agent", "orchestration", "payload", "schema".
- Instead say: "helper", "what it does", "what you'd like automated", "off-limits"
- One question at a time. Wait for the answer before asking the next thing.
- If someone is vague, give Mac-specific examples to help them think of things.
- Be encouraging: "That's a great idea!" / "Perfect, that totally works."
- Aim for 4-6 exchanges total — this should feel quick and easy.

WHAT TO LEARN:
1. What's your name? What should your helper call you?
2. What do you mostly use your Mac for? (work, creative, personal, coding)
3. Which Mac apps do you use most? (Calendar, Reminders, Notes, Mail, Finder, Terminal, Shortcuts, Safari, Music, Photos, Messages, Slack, etc.)
4. What would you love to automate or get help with? Give Mac-specific examples like:
   - "Organize my Downloads folder every week"
   - "Remind me about calendar events"
   - "Help me write emails"
   - "Control my smart home from my Mac"
   - "Track my tasks across apps"
5. What should it be allowed to do on its own vs. what should it always ask first?
   This is important — explore with concrete examples based on what they want to automate:
   - "Should it be able to delete files, or always ask first?"
   - "Can it run terminal commands on its own, or should it check with you?"
   - "If it's organizing your Downloads, can it move files around freely or should it show you a plan first?"
   - "Can it send messages/emails, or always draft them for your approval?"
   - "Can it create and modify files, or just read them?"
   Frame this as: "Your helper will be more useful if it can act on its own for routine stuff, but you probably want it to check with you for anything important."
6. Anything it should absolutely NEVER do? (e.g. "never delete files permanently", "never send emails without showing me first")
7. What personality should it have? (casual, professional, playful, concise, etc.)

AUTONOMY MAPPING (apply silently based on answers):
- "Can do anything" / "full access" → tools.deny = []
- "Don't let it run commands" / "no terminal" → add 'exec' to tools.deny
- "Don't let it change my files" / "read only" → add 'write' to tools.deny
- "No web browsing" → add 'browser' to tools.deny
- "Ask before deleting" → add to escalation and never rules
- "Draft messages first" → add to escalation
- "Always ask before [X]" → add to escalation
- Include the deny list in capabilities.tools.deny in the spec

MAC SKILLS TO RECOMMEND (based on what they say):
- homeassistant: smart home / HomeKit control
- google-calendar: scheduling and calendar events
- todoist: task management
- notion: notes and knowledge base
- spotify / apple-music: music control
- playwright: web automation
- weather: weather lookups
- news: news briefings

SPEC SHAPE — output as <shellmate-spec> blocks:

<shellmate-spec>
{ ...partial spec JSON... }
</shellmate-spec>

When confirmed complete:
<shellmate-spec complete="true">
{ ...full spec... }
</shellmate-spec>

Spec fields:
{
  "name": "string - helper's display name",
  "personality": "string - personality description",
  "mission": "string - what the helper does",
  "mac_apps": ["Calendar", "Reminders", ...],
  "use_cases": ["Organize Downloads folder weekly", ...],
  "failure": "string - what to do when stuck",
  "escalation": "string - when to ask the human",
  "never": ["Never delete files without asking", ...],
  "capabilities": {
    "webSearch": false,
    "memory": "core",
    "tools": { "deny": [] },
    "recommendedSkills": [
      { "id": "skill-id", "name": "Human Name", "reason": "why", "source": "installed|clawhub", "install": "clawhub install skill-id" }
    ]
  }
}

COMPLETENESS CHECKLIST — do NOT mark complete="true" until ALL covered:
[ ] Name and personality
[ ] At least 2 Mac apps they use
[ ] At least 3 specific use cases / things to automate
[ ] Autonomy preferences (what it can do freely vs. what needs permission)
[ ] At least 1 "never" rule
[ ] User confirmation ("Does this sound right?")

When you think you have everything, summarize what you've captured and ask for confirmation. Only set complete="true" after they confirm.`;

// ── Parse shellmate-spec blocks ──────────────────────────────────────────────

function parseSpecBlocks(content) {
  const results = [];
  const re = /<shellmate-spec(\s+complete="true")?>([\s\S]*?)<\/shellmate-spec>/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    try {
      results.push({ spec: JSON.parse(m[2].trim()), complete: !!m[1] });
    } catch { /* skip malformed JSON blocks */ }
  }
  return results;
}

function stripSpec(content) {
  return content.replace(/<shellmate-spec[\s\S]*?<\/shellmate-spec>/g, '').trim();
}

// ── Main component ───────────────────────────────────────────────────────────

export default function ConversationPhase() {
  const {
    conversationMessages, setConversationMessages,
    conversationComplete, setConversationComplete,
    mergeSpec,
  } = useTeamSpecStore();
  const { configured, provider, apiKey, model, envKey } = useAIConfig();
  const { advance } = useWizard();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const initialized = useRef(false);
  const bottomRef = useScrollToBottom([conversationMessages, loading]);
  const [inputRef, focusInput] = useAutofocus();

  // Auto-start: AI sends first message once configured
  useEffect(() => {
    if (configured && !initialized.current && conversationMessages.length === 0) {
      initialized.current = true;
      sendToAI("Hi! I'd like to set up my Mac helper.", []);
    }
  }, [configured]);

  async function sendToAI(userText, history) {
    const userMsg = { role: 'user', content: userText };
    const isOpening = userText === "Hi! I'd like to set up my Mac helper.";
    const next = isOpening ? history : [...history, userMsg];
    if (!isOpening) setConversationMessages(next);
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: isOpening
            ? [{ role: 'user', content: 'Greet the user warmly and ask what their name is and what they mostly use their Mac for.' }]
            : next,
          ...(envKey ? {} : { apiKey }),
          model,
          provider,
          system: SYSTEM_PROMPT,
          maxTokens: 4096,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI request failed');

      const assistantMsg = { role: 'assistant', content: data.content };
      const final = [...next, assistantMsg];
      setConversationMessages(final);

      // Process any shellmate-spec blocks
      const blocks = parseSpecBlocks(data.content);
      for (const b of blocks) {
        mergeSpec(b.spec);
        if (b.complete) setConversationComplete(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      focusInput();
    }
  }

  function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    sendToAI(text, conversationMessages);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ── Not configured ──────────────────────────────────────────────────────────
  if (!configured || showSetup) {
    return (
      <div className="max-w-lg mx-auto pt-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🐢</div>
          <h2 className="text-2xl font-bold text-white mb-2">Set up your Mac helper</h2>
          <p className="text-gray-400 text-sm">
            I'll have a friendly conversation with you and handle all the technical stuff behind the scenes.
          </p>
        </div>
        <AISetup onDone={() => {
          setShowSetup(false);
          initialized.current = false;
        }} />
      </div>
    );
  }

  // ── Conversation ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0 max-w-2xl mx-auto">
      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto py-4 scrollbar-thin">
        {conversationMessages.length === 0 && !loading && (
          <div className="text-center text-gray-600 text-sm mt-16">Starting conversation...</div>
        )}

        {conversationMessages.map((msg, i) => (
          <MessageBubble
            key={i}
            role={msg.role}
            content={msg.content}
            showAvatar
            transformContent={msg.role === 'assistant' ? stripSpec : undefined}
          />
        ))}

        {loading && (
          <div className="flex justify-start mb-4">
            <div className="w-8 h-8 rounded-full bg-shell-700 flex items-center justify-center text-sm mr-3 shrink-0">
              🐢
            </div>
            <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3">
              <BouncingDots />
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-3 mb-4 text-sm text-red-300">
            {error}
            <button onClick={() => { setError(''); setShowSetup(true); }} className="ml-2 underline text-xs">
              Check AI settings
            </button>
          </div>
        )}

        {/* Ready-to-review banner */}
        {conversationComplete && !loading && (
          <div className="bg-green-900/20 border border-green-700 rounded-xl p-4 mb-4 text-center">
            <p className="text-green-300 text-sm font-medium mb-3">
              All set! Ready to review and generate your helper.
            </p>
            <button
              onClick={advance}
              className="px-6 py-2.5 bg-green-700 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Review & generate →
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 pt-4 pb-2">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your reply..."
            rows={2}
            disabled={loading}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-shell-500 resize-none disabled:opacity-50 leading-relaxed"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-5 py-3 bg-shell-600 hover:bg-shell-500 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 shrink-0"
          >
            Send
          </button>
        </div>

        <div className="flex items-center justify-between mt-2 px-1">
          <span className="text-xs text-gray-600">Press Enter to send, Shift+Enter for new line</span>
          {!conversationComplete && conversationMessages.length >= 10 && (
            <button
              onClick={advance}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Skip to review →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
