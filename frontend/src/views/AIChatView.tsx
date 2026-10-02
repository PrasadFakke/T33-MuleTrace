import React, { useState, useRef, useEffect } from 'react';
import { sendChatMessage, ChatResponse } from '../api';
import { 
  Bot, 
  Send, 
  User, 
  Sparkles, 
  ArrowUpRight, 
  RotateCcw, 
  ShieldAlert, 
  Sliders, 
  Activity, 
  Copy, 
  Check, 
  Search,
  Zap,
  Info
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AIChatViewProps {
  onNavigateToInvestigation: (accountId: string) => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  accountId?: string | null;
  suggestedActions?: string[];
  timestamp: string;
}

export const AIChatView: React.FC<AIChatViewProps> = ({ onNavigateToInvestigation }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `### 👋 Welcome to MuleTrace AML Forensic Copilot\n\nI am your specialized AI AML investigation assistant trained on the **RBI Mule Account Detection Framework** and connected to the live telemetry of all **40,038 bank accounts** and **7.42 million transactions**.\n\nYou can ask me:\n* **Account Inquiries:** *"Why is ACCT_149010 flagged?"* or *"Analyze ACCT_000006"*\n* **Network Analysis:** *"Explain circular reciprocal flow patterns"*\n* **Telemetry & Alerts:** *"What are the top suspicious accounts?"*\n* **Threshold Rules:** *"What are the current detection parameters?"*`,
      suggestedActions: [
        'Analyze ACCT_149010',
        'Top Suspicious Accounts',
        'Explain Pass-Through vs Fan-In',
        'Show Current Thresholds'
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || loading) return;

    const userMsgId = 'user_' + Date.now();
    const newUserMsg: Message = {
      id: userMsgId,
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newUserMsg]);
    if (!messageText) setInput('');
    setLoading(true);

    try {
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const response: ChatResponse = await sendChatMessage(textToSend.trim(), history);

      const aiMsgId = 'ai_' + Date.now();
      const newAiMsg: Message = {
        id: aiMsgId,
        role: 'assistant',
        content: response.reply,
        accountId: response.account_id,
        suggestedActions: response.suggested_actions,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, newAiMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: 'err_' + Date.now(),
        role: 'assistant',
        content: `### ⚠️ Connection Error\n\nCould not reach the MuleTrace Forensic AI engine: ${err.message || 'Server error'}. Please check backend status on port 8000.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome_reset',
        role: 'assistant',
        content: 'Chat session reset. What account or fraud pattern would you like to investigate?',
        suggestedActions: ['Top Suspicious Accounts', 'Analyze ACCT_149010', 'Show Current Thresholds'],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] w-full max-w-6xl mx-auto space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm shadow-blue-500/25">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <span>MuleTrace AML Forensic Copilot</span>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
                AI ASSISTANT
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Interactive natural language forensic reasoning over 40,038 bank accounts & bipartite network telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-sm transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear Session</span>
          </button>
        </div>
      </div>

      {/* Quick Prompt Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0 text-sm no-scrollbar">
        <span className="text-xs text-slate-500 flex items-center gap-1.5 shrink-0 font-semibold">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span>Quick Prompts:</span>
        </span>
        {[
          'Why is ACCT_149010 flagged?',
          'Top Suspicious Accounts',
          'Explain Pass-Through vs Fan-In',
          'Show Current Thresholds',
          'Platform Summary Statistics'
        ].map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(prompt)}
            disabled={loading}
            className="px-3.5 py-1.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 rounded-lg whitespace-nowrap transition-all shadow-xs text-xs font-semibold shrink-0"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 select-text">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-blue-500/25">
                <Bot className="w-5 h-5 text-white" />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-xl p-5 text-sm space-y-3 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20 self-end'
                  : 'bg-white border border-slate-200 shadow-sm text-slate-800'
              }`}
            >
              <div className={`flex items-center justify-between gap-4 border-b pb-2 text-xs ${
                msg.role === 'user' ? 'border-blue-500 text-blue-100' : 'border-slate-100 text-slate-500 font-semibold'
              }`}>
                <span>{msg.role === 'user' ? 'AML Investigator' : 'Forensic AI Engine'}</span>
                <div className="flex items-center gap-2">
                  <span>{msg.timestamp}</span>
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="text-slate-400 hover:text-slate-600 transition"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Message Content rendered cleanly with markdown formatting */}
              <div className={`leading-relaxed ${msg.role === 'user' ? 'text-white' : 'text-slate-700'}`}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ node, ...props }) => <h1 className={`text-xl font-bold mt-3 mb-2 ${msg.role === 'user' ? 'text-white' : 'text-slate-900'}`} {...props} />,
                    h2: ({ node, ...props }) => <h2 className={`text-lg font-bold mt-2.5 mb-1.5 ${msg.role === 'user' ? 'text-white' : 'text-slate-900'}`} {...props} />,
                    h3: ({ node, ...props }) => <h3 className={`text-base font-bold mt-2 mb-1 flex items-center gap-1.5 ${msg.role === 'user' ? 'text-blue-100' : 'text-blue-700'}`} {...props} />,
                    h4: ({ node, ...props }) => <h4 className={`text-sm font-semibold mt-2 mb-1 ${msg.role === 'user' ? 'text-white' : 'text-slate-800'}`} {...props} />,
                    p: ({ node, ...props }) => <p className="mb-2.5 leading-relaxed text-sm" {...props} />,
                    strong: ({ node, ...props }) => <strong className={`font-bold ${msg.role === 'user' ? 'text-white' : 'text-slate-900'}`} {...props} />,
                    ul: ({ node, ...props }) => <ul className={`list-disc list-inside space-y-1.5 mb-2.5 pl-1 ${msg.role === 'user' ? 'text-blue-50' : 'text-slate-700'}`} {...props} />,
                    ol: ({ node, ...props }) => <ol className={`list-decimal list-inside space-y-1.5 mb-2.5 pl-1 ${msg.role === 'user' ? 'text-blue-50' : 'text-slate-700'}`} {...props} />,
                    li: ({ node, ...props }) => <li className="leading-relaxed text-sm" {...props} />,
                    code: ({ node, className, children, ...props }) => (
                      <code className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                        msg.role === 'user' 
                          ? 'bg-blue-700 text-white' 
                          : 'bg-slate-100 border border-slate-200 text-blue-700'
                      }`} {...props}>
                        {children}
                      </code>
                    ),
                    table: ({ node, ...props }) => (
                      <div className="overflow-x-auto my-3 border border-slate-200 rounded-lg">
                        <table className="w-full text-left border-collapse text-sm bg-white" {...props} />
                      </div>
                    ),
                    thead: ({ node, ...props }) => <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 text-xs font-bold uppercase" {...props} />,
                    th: ({ node, ...props }) => <th className="p-3 border border-slate-200 font-bold text-slate-900" {...props} />,
                    td: ({ node, ...props }) => <td className="p-2.5 border border-slate-200 text-slate-700" {...props} />,
                    tr: ({ node, ...props }) => <tr className="hover:bg-slate-50/60 transition" {...props} />
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>

              {/* Action buttons if an account was mentioned */}
              {msg.accountId && (
                <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-slate-150">
                  <button
                    onClick={() => onNavigateToInvestigation(msg.accountId!)}
                    className="flex items-center gap-2 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-xs shadow-sm hover:shadow-[0_0_12px_rgba(244,63,94,0.35)] transition-all"
                  >
                    <span>Open Account {msg.accountId} in Forensic Studio</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Suggested follow-up prompt chips */}
              {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                <div className="pt-2 flex flex-wrap gap-2 border-t border-slate-100">
                  {msg.suggestedActions.map((action, aIdx) => (
                    <button
                      key={aIdx}
                      onClick={() => {
                        if (action.startsWith('Investigate ACCT_')) {
                          const acct = action.replace('Investigate ', '').trim();
                          onNavigateToInvestigation(acct);
                        } else {
                          handleSend(action);
                        }
                      }}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-xs text-blue-700 font-semibold rounded-md transition-all shadow-2xs"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5 text-slate-600 shadow-2xs">
                <User className="w-5 h-5" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-9 h-9 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0 animate-pulse">
              <Bot className="w-5 h-5 text-blue-600" />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-blue-600 flex items-center gap-2.5 shadow-sm">
              <Activity className="w-4 h-4 text-blue-600 animate-pulse" />
              <span className="font-medium text-slate-700">Forensic AI scanning transaction ledgers & network graph...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="relative shrink-0 pt-2"
      >
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about any account (e.g. ACCT_149010), thresholds, fraud patterns, or AML guidelines..."
            disabled={loading}
            className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 rounded-xl pl-4 pr-24 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all shadow-xs font-sans"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm hover:shadow-[0_0_12px_rgba(37,99,235,0.3)] transition-all disabled:opacity-40"
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};
