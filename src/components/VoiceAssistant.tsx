import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  Sparkles, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle,
  Radio,
  Send,
  Zap
} from 'lucide-react';
import { SmartDevice } from '../types';
import { parseVoiceCommand, VoiceCommandResult } from '../services/voiceCommandEngine';

interface VoiceAssistantProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  devices: SmartDevice[];
  rooms: string[];
  onToggleDevice: (device: SmartDevice) => void;
  onTurnOnRoom: (roomName: string) => void;
  onTurnOffRoom: (roomName: string) => void;
  onUpdateDeviceState?: (deviceId: string, updatedState: any) => void;
  onShowToast: (message: string) => void;
}

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  isOpen: controlledIsOpen,
  onOpenChange,
  devices,
  rooms,
  onToggleDevice,
  onTurnOnRoom,
  onTurnOffRoom,
  onUpdateDeviceState,
  onShowToast,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState<boolean>(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const setIsOpen = (val: boolean) => {
    setInternalIsOpen(val);
    if (onOpenChange) onOpenChange(val);
  };

  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [lastCommandResult, setLastCommandResult] = useState<VoiceCommandResult | null>(null);
  const [voiceFeedbackEnabled, setVoiceFeedbackEnabled] = useState<boolean>(true);
  const [manualText, setManualText] = useState<string>('');
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);

  // Initialize SpeechRecognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      (window as any).mozSpeechRecognition ||
      (window as any).msSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'it-IT';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        isListeningRef.current = true;
        setPermissionError(null);
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);

        if (event.results[0] && event.results[0].isFinal) {
          executeCommand(currentTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('SpeechRecognition error:', event.error);
        setIsListening(false);
        isListeningRef.current = false;

        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          setPermissionError('Permesso microfono non concesso. Abilita il microfono nel browser.');
          onShowToast('⚠️ Permesso microfono negato.');
        } else if (event.error === 'no-speech') {
          // Silent timeout
        } else if (event.error === 'network') {
          setPermissionError('Errore di connessione Web Speech API.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        isListeningRef.current = false;
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('Could not initialize SpeechRecognition:', e);
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
    };
  }, [devices, rooms]);

  const speakFeedback = (text: string) => {
    if (!voiceFeedbackEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'it-IT';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  };

  const startListening = () => {
    setPermissionError(null);
    setTranscript('');
    setIsOpen(true);

    if (!recognitionRef.current) {
      if (!isSupported) {
        setPermissionError('Web Speech API non supportata in questo browser. Puoi digitare il comando.');
      }
      return;
    }

    try {
      if (isListeningRef.current) {
        recognitionRef.current.stop();
      }
      recognitionRef.current.start();
    } catch (err: any) {
      console.warn('Error starting speech recognition:', err);
      // If already started, restart
      try {
        recognitionRef.current.stop();
        setTimeout(() => {
          recognitionRef.current.start();
        }, 150);
      } catch (e2) {
        // ignore
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListeningRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
    setIsListening(false);
    isListeningRef.current = false;
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Esegue l'azione dedotta dal comando vocale
  const executeCommand = (commandText: string) => {
    if (!commandText || !commandText.trim()) return;

    const parsed = parseVoiceCommand(commandText, devices, rooms);
    setLastCommandResult(parsed);

    if (parsed.success) {
      onShowToast(`🎙️ Vocale: ${parsed.message}`);
      speakFeedback(parsed.message);

      // Esegui l'azione appropriata
      if (parsed.action === 'all_off') {
        for (const room of rooms) {
          if (room !== 'Tutti') onTurnOffRoom(room);
        }
      } else if (parsed.action === 'all_on') {
        for (const room of rooms) {
          if (room !== 'Tutti') onTurnOnRoom(room);
        }
      } else if (parsed.action === 'room_off' && parsed.targetRoom) {
        onTurnOffRoom(parsed.targetRoom);
      } else if (parsed.action === 'room_on' && parsed.targetRoom) {
        onTurnOnRoom(parsed.targetRoom);
      } else if (parsed.targetDevice) {
        const dev = parsed.targetDevice;

        if (parsed.action === 'set_temperature' && parsed.numericValue !== undefined && onUpdateDeviceState) {
          onUpdateDeviceState(dev.id, {
            thermostat: {
              ...(dev.state.thermostat || { currentTemp: 20, humidity: 50, mode: 'heat', power: true }),
              targetTemp: parsed.numericValue,
              power: true,
            },
          });
        } else if (parsed.action === 'set_brightness' && parsed.numericValue !== undefined && onUpdateDeviceState) {
          onUpdateDeviceState(dev.id, {
            light: {
              ...(dev.state.light || { power: true, color: '#ffffff', colorTemp: 4000, mode: 'white' }),
              brightness: parsed.numericValue,
              power: true,
            },
          });
        } else {
          // Toggle or specific ON/OFF
          const currentPower = Boolean(
            dev.state.plug?.power || 
            dev.state.light?.power || 
            dev.state.switch?.power || 
            dev.state.thermostat?.power || 
            (dev.state as any)?.power
          );

          if (parsed.action === 'turn_on') {
            if (!currentPower) {
              onToggleDevice(dev);
            }
          } else if (parsed.action === 'turn_off') {
            if (currentPower) {
              onToggleDevice(dev);
            }
          } else {
            onToggleDevice(dev);
          }
        }
      }
    } else {
      onShowToast(`⚠️ ${parsed.message}`);
      speakFeedback('Comando non riconosciuto.');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    setTranscript(manualText);
    executeCommand(manualText);
    setManualText('');
  };

  return (
    <>
      {/* Floating Microphone Trigger Button */}
      <button
        onClick={() => {
          if (!isOpen) {
            setIsOpen(true);
            startListening();
          } else {
            toggleListening();
          }
        }}
        className={`fixed bottom-6 left-6 z-40 p-3.5 rounded-2xl shadow-2xl flex items-center justify-center transition-all duration-300 cursor-pointer ${
          isListening
            ? 'bg-gradient-to-r from-rose-600 to-red-500 text-white ring-4 ring-rose-500/40 scale-110 shadow-rose-500/30'
            : 'bg-slate-900/90 hover:bg-slate-800 text-amber-400 border border-white/15 backdrop-blur-xl hover:scale-105 shadow-black/60'
        }`}
        title={isListening ? 'Ascolto in corso... Clicca per fermare' : 'Attiva Controllo Vocale'}
        aria-label="Assistente Vocale"
      >
        {isListening ? (
          <div className="relative flex items-center justify-center">
            <span className="absolute -inset-2 rounded-full bg-rose-500/30 animate-ping" />
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
        ) : (
          <div className="relative">
            <Mic className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />
          </div>
        )}
      </button>

      {/* Voice Assistant Panel Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#101217] border border-white/15 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold transition-colors ${
                  isListening
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Assistente Vocale</span>
                    <span className="text-[10px] bg-amber-400/10 text-amber-300 border border-amber-400/25 px-2 py-0.5 rounded-full font-mono">
                      it-IT
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isListening ? 'Parla adesso... Ti sto ascoltando' : 'Pronto a ricevere comandi vocali'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setVoiceFeedbackEnabled(!voiceFeedbackEnabled)}
                  className={`p-2 rounded-xl border transition ${
                    voiceFeedbackEnabled
                      ? 'bg-white/10 text-amber-300 border-white/15'
                      : 'bg-transparent text-slate-500 border-transparent hover:text-slate-300'
                  }`}
                  title={voiceFeedbackEnabled ? 'Risposta vocale attiva' : 'Risposta vocale disattivata'}
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    stopListening();
                    setIsOpen(false);
                  }}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Listening Wave & Transcript Display */}
            <div className="p-6 space-y-5 flex-1 text-center">
              {/* Mic Ripple Animation */}
              <div className="relative py-4 flex flex-col items-center justify-center">
                {isListening ? (
                  <div className="relative">
                    <div className="absolute -inset-6 rounded-full bg-rose-500/20 animate-ping opacity-75" />
                    <div className="absolute -inset-3 rounded-full bg-gradient-to-tr from-rose-500 to-amber-500 opacity-40 blur-sm animate-pulse" />
                    <button
                      onClick={stopListening}
                      className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-rose-600 to-red-500 text-white flex items-center justify-center shadow-xl shadow-rose-600/30 cursor-pointer"
                    >
                      <Radio className="w-8 h-8 animate-pulse" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={startListening}
                    className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-400 to-amber-200 text-slate-950 flex items-center justify-center shadow-xl shadow-amber-400/20 hover:scale-105 transition cursor-pointer"
                  >
                    <Mic className="w-8 h-8 fill-current" />
                  </button>
                )}

                <div className="mt-4">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                    isListening
                      ? 'bg-rose-500/10 text-rose-300 border-rose-500/30 animate-pulse'
                      : 'bg-white/5 text-slate-400 border-white/10'
                  }`}>
                    {isListening ? 'In ascolto...' : 'Tocca il microfono per parlare'}
                  </span>
                </div>
              </div>

              {/* Realtime Transcript */}
              <div className="min-h-[50px] p-3.5 bg-black/40 rounded-2xl border border-white/10 flex items-center justify-center text-center">
                {transcript ? (
                  <p className="text-sm font-medium text-white italic">
                    "{transcript}"
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Pronuncia ad es.: <em>"Accendi luce salone"</em>, <em>"Spegni cucina"</em> o <em>"Apri cancelletto"</em>
                  </p>
                )}
              </div>

              {/* Last Executed Result Feedback */}
              {lastCommandResult && (
                <div className={`p-3.5 rounded-2xl border text-xs flex items-center gap-3 text-left ${
                  lastCommandResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                }`}>
                  {lastCommandResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                  )}
                  <div className="flex-1">
                    <span className="font-bold block text-[11px] uppercase tracking-wider">
                      {lastCommandResult.success ? 'Comando Eseguito' : 'Avviso'}
                    </span>
                    <p className="leading-tight mt-0.5">{lastCommandResult.message}</p>
                  </div>
                </div>
              )}

              {/* Permission / Error Notification */}
              {permissionError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs flex items-center gap-2 text-left">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{permissionError}</span>
                </div>
              )}

              {/* Quick Examples Pills */}
              <div className="space-y-1.5 text-left">
                <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Esempi di comandi vocali supportati:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Accendi luce salone',
                    'Spegni presa garage',
                    'Accendi termosifoni',
                    'Apri cancelletto',
                    'Spegni cucina',
                    'Spegni tutta la casa',
                  ].map((example, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setTranscript(example);
                        executeCommand(example);
                      }}
                      className="text-[11px] bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg border border-white/10 transition cursor-pointer"
                    >
                      "{example}"
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual Input Fallback */}
              <form onSubmit={handleManualSubmit} className="pt-2 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Oppure scrivi un comando vocale..."
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  className="flex-1 bg-black/40 text-xs text-white px-3.5 py-2.5 rounded-xl border border-white/15 focus:outline-none focus:border-amber-400 placeholder-slate-500"
                />
                <button
                  type="submit"
                  disabled={!manualText.trim()}
                  className="p-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold transition disabled:opacity-40 cursor-pointer"
                  title="Invia comando"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
