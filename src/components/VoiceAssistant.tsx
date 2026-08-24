import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX,
  Sparkles, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Radio,
  Send,
  Zap,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { SmartDevice } from '../types';
import { parseVoiceCommand, VoiceCommandResult, extractWakeWordCommand } from '../services/voiceCommandEngine';

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
  const [lastExecutedCommand, setLastExecutedCommand] = useState<string>('');
  const [lastCommandResult, setLastCommandResult] = useState<VoiceCommandResult | null>(null);
  const [voiceFeedbackEnabled, setVoiceFeedbackEnabled] = useState<boolean>(true);
  const [chimeEnabled, setChimeEnabled] = useState<boolean>(true);
  const [requireWakeWord, setRequireWakeWord] = useState<boolean>(true);
  const [manualText, setManualText] = useState<string>('');
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [detectedWakeWord, setDetectedWakeWord] = useState<boolean>(false);

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const restartTimeoutRef = useRef<any>(null);
  const lastProcessedTextRef = useRef<string>('');
  const consecutiveErrorsRef = useRef<number>(0);

  // Initialize Web Audio Context for pleasant iOS-compatible chime
  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  // Play pleasant acoustic feedback chime on iOS/Safari
  const playChime = useCallback((type: 'success' | 'listening' | 'error') => {
    if (!chimeEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        // High double chime (E5 -> A5)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, now); // E5
        osc.frequency.setValueAtTime(880.00, now + 0.08); // A5
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'listening') {
        // Subtle activation beep (C5 -> G5)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(783.99, now + 0.06);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else {
        // Soft error tone
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.setValueAtTime(200, now + 0.1);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (e) {
      console.warn('Audio chime warning:', e);
    }
  }, [chimeEnabled, getAudioContext]);

  // Text-to-speech feedback
  const speakFeedback = useCallback((text: string) => {
    if (!voiceFeedbackEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'it-IT';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis warning:', e);
    }
  }, [voiceFeedbackEnabled]);

  // Esegue l'azione del comando vocale
  const executeCommand = useCallback((commandText: string, options?: { force?: boolean }) => {
    if (!commandText || !commandText.trim()) return;

    // Evita esecuzioni duplicate della stessa trascrizione
    const cleanCmd = commandText.toLowerCase().trim();
    if (cleanCmd === lastProcessedTextRef.current && !options?.force) {
      return;
    }

    const parsed = parseVoiceCommand(commandText, devices, rooms, {
      requireWakeWord: options?.force ? false : requireWakeWord
    });

    if (parsed.wakeWordDetected) {
      setDetectedWakeWord(true);
      setTimeout(() => setDetectedWakeWord(false), 2500);
    }

    if (parsed.success) {
      lastProcessedTextRef.current = cleanCmd;
      setLastExecutedCommand(commandText);
      setLastCommandResult(parsed);

      playChime('success');
      onShowToast(`🎙️ Vocale: ${parsed.message}`);
      speakFeedback(parsed.message);

      // Esegui l'azione
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
          // Toggle o stato ON/OFF specifico
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

      // Reset buffer visuale dopo esecuzione
      setTimeout(() => {
        setTranscript('');
      }, 1800);

    } else if (parsed.wakeWordDetected) {
      // Ha detto la wake word ma il comando non è chiaro
      setLastCommandResult(parsed);
      playChime('error');
      onShowToast(`⚠️ ${parsed.message}`);
    } else if (options?.force) {
      // Inoltro manuale fallito
      setLastCommandResult(parsed);
      playChime('error');
      onShowToast(`⚠️ ${parsed.message}`);
    }
  }, [devices, rooms, requireWakeWord, playChime, onShowToast, speakFeedback, onTurnOffRoom, onTurnOnRoom, onUpdateDeviceState, onToggleDevice]);

  // Auto-restart helper per iOS / Safari timeout
  const restartListeningIfActive = useCallback(() => {
    if (!isListeningRef.current) return;
    if (consecutiveErrorsRef.current > 4) {
      setIsListening(false);
      isListeningRef.current = false;
      return;
    }

    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    restartTimeoutRef.current = setTimeout(() => {
      if (isListeningRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e: any) {
          // Se già in avvio o transizione, ignora
        }
      }
    }, 200);
  }, []);

  // Initialize SpeechRecognition with continuous = true and interimResults = true
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
      recognition.continuous = true; // Ascolto prolungato e continuo per iOS
      recognition.interimResults = true; // Trascrizione in tempo reale
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        isListeningRef.current = true;
        setPermissionError(null);
        consecutiveErrorsRef.current = 0;
      };

      recognition.onresult = (event: any) => {
        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            finalText += res[0].transcript;
          } else {
            interimText += res[0].transcript;
          }
        }

        const currentStream = (finalText || interimText).trim();
        if (currentStream) {
          setTranscript(currentStream);

          // Verifica se include la Wake Word in tempo reale
          const { hasWakeWord, commandText } = extractWakeWordCommand(currentStream);
          if (hasWakeWord) {
            setDetectedWakeWord(true);
            if (commandText && commandText.length > 2) {
              executeCommand(currentStream);
            }
          } else if (!requireWakeWord && finalText) {
            executeCommand(finalText);
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('SpeechRecognition notice:', event.error);

        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          setIsListening(false);
          isListeningRef.current = false;
          setPermissionError('Permesso microfono non concesso. Abilita il microfono nelle impostazioni di Safari / iOS.');
          onShowToast('⚠️ Permesso microfono negato.');
        } else if (event.error === 'no-speech') {
          // Normale timeout da silenzio su iOS/WebKit: gestito con onend auto-restart
        } else if (event.error === 'audio-capture') {
          setPermissionError('Nessun microfono rilevato sul dispositivo.');
        } else if (event.error === 'network') {
          consecutiveErrorsRef.current++;
        }
      };

      recognition.onend = () => {
        // Se l'utente ha richiesto l'ascolto continuo attivo, riavvia su timeout iOS
        if (isListeningRef.current) {
          restartListeningIfActive();
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('SpeechRecognition initialization error:', e);
      setIsSupported(false);
    }

    return () => {
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
    };
  }, [executeCommand, onShowToast, requireWakeWord, restartListeningIfActive]);

  // Avvia l'ascolto da gesture utente (click/touch)
  const startListening = () => {
    getAudioContext(); // Sblocca audio Web Audio su iOS
    playChime('listening');
    setPermissionError(null);
    setTranscript('');
    lastProcessedTextRef.current = '';
    consecutiveErrorsRef.current = 0;
    isListeningRef.current = true;
    setIsListening(true);

    if (!recognitionRef.current) {
      if (!isSupported) {
        setPermissionError('Web Speech API non supportata da questo browser. Puoi digitare i comandi.');
      }
      return;
    }

    try {
      recognitionRef.current.start();
    } catch (err: any) {
      // Se già attivo o in transizione
      try {
        recognitionRef.current.stop();
        setTimeout(() => {
          if (isListeningRef.current && recognitionRef.current) {
            recognitionRef.current.start();
          }
        }, 150);
      } catch (e2) {
        // ignore
      }
    }
  };

  // Ferma l'ascolto
  const stopListening = () => {
    isListeningRef.current = false;
    setIsListening(false);
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    const textToSend = manualText;
    setManualText('');
    setTranscript(textToSend);
    executeCommand(textToSend, { force: true });
  };

  return (
    <>
      {/* Floating Microphone Trigger Button (Mobile & Desktop) */}
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
            ? 'bg-gradient-to-r from-rose-600 via-red-500 to-amber-500 text-white ring-4 ring-rose-500/40 scale-110 shadow-rose-500/40'
            : 'bg-slate-900/90 hover:bg-slate-800 text-amber-400 border border-white/15 backdrop-blur-xl hover:scale-105 shadow-black/60'
        }`}
        title={isListening ? 'Ascolto continuo attivo ("My Home ...") - Tocca per fermare' : 'Attiva Assistente Vocale'}
        aria-label="Assistente Vocale My Home"
      >
        {isListening ? (
          <div className="relative flex items-center justify-center">
            <span className="absolute -inset-2.5 rounded-full bg-rose-500/30 animate-ping" />
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
        ) : (
          <div className="relative">
            <Mic className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-slate-950" />
          </div>
        )}
      </button>

      {/* Voice Assistant Panel Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#101217] border border-white/15 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold transition-all ${
                  isListening
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse ring-2 ring-rose-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Assistente Vocale</span>
                    <span className="text-[10px] bg-amber-400/15 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full font-mono">
                      it-IT • iOS Ready
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                    {isListening ? (
                      <>
                        <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                        <span className="text-rose-300 font-medium">Ascolto continuo ("My Home ...")</span>
                      </>
                    ) : (
                      'In pausa • Tocca per attivare'
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Chime Audio Toggle */}
                <button
                  onClick={() => setChimeEnabled(!chimeEnabled)}
                  className={`p-2 rounded-xl border transition ${
                    chimeEnabled
                      ? 'bg-white/10 text-amber-300 border-white/15'
                      : 'bg-transparent text-slate-500 border-transparent hover:text-slate-300'
                  }`}
                  title={chimeEnabled ? 'Segnale acustico attivo' : 'Segnale acustico disattivato'}
                >
                  <Zap className="w-4 h-4" />
                </button>

                {/* Voice Feedback Toggle */}
                <button
                  onClick={() => setVoiceFeedbackEnabled(!voiceFeedbackEnabled)}
                  className={`p-2 rounded-xl border transition ${
                    voiceFeedbackEnabled
                      ? 'bg-white/10 text-amber-300 border-white/15'
                      : 'bg-transparent text-slate-500 border-transparent hover:text-slate-300'
                  }`}
                  title={voiceFeedbackEnabled ? 'Sintesi vocale attiva' : 'Sintesi vocale disattivata'}
                >
                  {voiceFeedbackEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => {
                    stopListening();
                    setIsOpen(false);
                  }}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
                  title="Chiudi"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Listening Wave & Transcript Display */}
            <div className="p-6 space-y-5 flex-1 text-center">
              
              {/* Mic Ripple Animation */}
              <div className="relative py-3 flex flex-col items-center justify-center">
                {isListening ? (
                  <div className="relative">
                    <div className="absolute -inset-6 rounded-full bg-rose-500/20 animate-ping opacity-75" />
                    <div className="absolute -inset-3 rounded-full bg-gradient-to-tr from-rose-500 via-amber-500 to-red-500 opacity-40 blur-sm animate-pulse" />
                    <button
                      onClick={stopListening}
                      className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-rose-600 via-red-500 to-amber-500 text-white flex items-center justify-center shadow-xl shadow-rose-600/40 cursor-pointer hover:scale-95 transition"
                    >
                      <Radio className="w-8 h-8 animate-pulse" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={startListening}
                    className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-400 to-amber-200 text-slate-950 flex items-center justify-center shadow-xl shadow-amber-400/25 hover:scale-105 transition cursor-pointer"
                  >
                    <Mic className="w-8 h-8 fill-current" />
                  </button>
                )}

                <div className="mt-4 flex items-center gap-2">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full border flex items-center gap-1.5 ${
                    isListening
                      ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                      : 'bg-white/5 text-slate-400 border-white/10'
                  }`}>
                    {detectedWakeWord && <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />}
                    {isListening 
                      ? (detectedWakeWord ? 'Wake Word "My Home" Rilevata!' : 'In ascolto continuo...') 
                      : 'Tocca per attivare'}
                  </span>

                  {/* Wake Word Pill */}
                  <span className="text-[11px] bg-amber-400/10 text-amber-300 border border-amber-400/25 px-2.5 py-1 rounded-full font-medium">
                    Wake Word: <strong className="text-amber-200">"My Home"</strong>
                  </span>
                </div>
              </div>

              {/* Realtime Stream Transcript */}
              <div className="min-h-[56px] p-3.5 bg-black/40 rounded-2xl border border-white/10 flex items-center justify-center text-center">
                {transcript ? (
                  <p className="text-sm font-medium text-white italic">
                    "{transcript}"
                  </p>
                ) : (
                  <p className="text-xs text-slate-400">
                    Pronuncia: <strong className="text-amber-300">"My Home accendi ripostiglio"</strong>, <strong className="text-amber-300">"My Home spegni cucina"</strong> o <strong className="text-amber-300">"My Home apri cancelletto"</strong>
                  </p>
                )}
              </div>

              {/* Last Executed Result Feedback */}
              {lastCommandResult && (
                <div className={`p-3.5 rounded-2xl border text-xs flex items-center gap-3 text-left transition-all ${
                  lastCommandResult.success
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 shadow-lg shadow-emerald-500/5'
                    : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                }`}>
                  {lastCommandResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                  )}
                  <div className="flex-1">
                    <span className="font-bold block text-[11px] uppercase tracking-wider">
                      {lastCommandResult.success ? 'Comando Eseguito con Successo' : 'Avviso Riconoscimento'}
                    </span>
                    <p className="leading-tight mt-0.5">{lastCommandResult.message}</p>
                  </div>
                </div>
              )}

              {/* Permission / Error Notification */}
              {permissionError && (
                <div className="p-3.5 bg-red-500/15 border border-red-500/30 rounded-2xl text-red-300 text-xs flex items-start gap-2.5 text-left">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Accesso al Microfono Richiesto</p>
                    <p className="text-[11px] text-red-300/90 leading-tight">{permissionError}</p>
                  </div>
                </div>
              )}

              {/* Quick Examples Pills with "My Home" */}
              <div className="space-y-1.5 text-left">
                <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Esempi rapidi (tocca per testare subito):</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'My Home accendi ripostiglio',
                    'My Home spegni ripostiglio',
                    'My Home spegni garage',
                    'My Home accendi luce salone',
                    'My Home accendi termosifoni',
                    'My Home apri cancelletto',
                    'My Home spegni tutta la casa',
                  ].map((example, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setTranscript(example);
                        executeCommand(example, { force: true });
                      }}
                      className="text-[11px] bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg border border-white/10 transition cursor-pointer"
                    >
                      "{example}"
                    </button>
                  ))}
                </div>
              </div>

              {/* iOS Compatibility Note */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-1 border-t border-white/5">
                <div className="flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ottimizzato per iPhone, iPad e Safari</span>
                </div>
                <div className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Auto-Restart attivo</span>
                </div>
              </div>

              {/* Manual Input Fallback */}
              <form onSubmit={handleManualSubmit} className="pt-1 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Oppure scrivi un comando (es. 'accendi ripostiglio')..."
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
