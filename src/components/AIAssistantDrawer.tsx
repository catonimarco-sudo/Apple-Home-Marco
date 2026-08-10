import React, { useState } from 'react';
import { ChatMessage, SmartDevice, AutomationRule } from '../types';
import { 
  Bot, 
  X, 
  Send, 
  Sparkles, 
  RefreshCw, 
  Zap, 
  Sliders, 
  HelpCircle,
  Lightbulb
} from 'lucide-react';

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  devices: SmartDevice[];
  automations: AutomationRule[];
  onOpenTransferModal: () => void;
}

export const AIAssistantDrawer: React.FC<AIAssistantDrawerProps> = ({
  isOpen,
  onClose,
  devices,
  automations,
  onOpenTransferModal,
}) => {
  if (!isOpen) return null;

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'ai',
      text: 'Ciao! Sono il tuo Assistente Domotico Gemini per SmartLife Hub. Posso aiutarti a trasferire i dispositivi da Smart Life, creare automazioni personalizzate o ottimizzare i tuoi consumi energetici. Come posso aiutarti oggi?',
      timestamp: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputMessage, setInputMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputMessage;
    if (!query.trim()) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          devices,
          automations,
        }),
      });

      const data = await response.json();
      const aiReply = data.reply || 'Errore durante l\'elaborazione della risposta dall\'assistente.';

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: aiReply,
        timestamp: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: 'ai',
        text: 'Spiacente, si è verificato un problema di connessione al server dell\'assistente.',
        timestamp: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0B]/80 backdrop-blur-sm flex justify-end">
      <div className="bg-[#121214] border-l border-white/5 w-full max-w-lg h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 text-slate-100">
        
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-[#121214]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 p-2 shadow-lg flex items-center justify-center text-emerald-400">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Assistente AI Gemini</span>
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  3.6 Flash
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Domotica, Migrazione Smart Life & Automazioni
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Suggestion Pills */}
        <div className="p-3 bg-[#0A0A0B] border-b border-white/5 flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
          <button
            onClick={() => handleSendMessage('Come posso trasferire i miei dispositivi dall\'app Smart Life a questa app?')}
            className="bg-white/5 hover:bg-white/10 text-emerald-400 border border-white/10 px-3 py-1.5 rounded-full whitespace-nowrap cursor-pointer transition flex items-center gap-1 shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Come trasferire Smart Life?</span>
          </button>

          <button
            onClick={() => handleSendMessage('Suggerisci una routine di automazione per risparmiare energia la sera.')}
            className="bg-white/5 hover:bg-white/10 text-amber-400 border border-white/10 px-3 py-1.5 rounded-full whitespace-nowrap cursor-pointer transition flex items-center gap-1 shrink-0"
          >
            <Lightbulb className="w-3 h-3" />
            <span>Crea Automazione Risparmio</span>
          </button>
        </div>

        {/* Message Log */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${
                  msg.sender === 'user'
                    ? 'bg-emerald-500 text-black font-medium rounded-tr-none'
                    : 'bg-[#0A0A0B] border border-white/5 text-slate-200 rounded-tl-none'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5 opacity-75 text-[10px]">
                  <span className="font-bold uppercase">{msg.sender === 'user' ? 'Tu' : 'Gemini AI'}</span>
                  <span>{msg.timestamp}</span>
                </div>
                <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-slate-400 text-xs italic p-2">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Gemini sta analizzando la risposta...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-[#0A0A0B] border-t border-white/5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Chiedi all'AI (es: 'Spegni le luci', 'Spiegami il cloud Tuya')..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              className="flex-1 bg-[#121214] border border-white/10 text-white text-xs px-4 py-2.5 rounded-xl focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !inputMessage.trim()}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold p-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
