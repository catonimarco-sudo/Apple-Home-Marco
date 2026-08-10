import React, { useState, useEffect } from 'react';
import { SmartDevice, ImportResult, TuyaCloudCredentials } from '../types';
import { syncTuyaCloudApi, getStoredTuyaCredentials } from '../services/smartLifeService';
import { 
  X, 
  RefreshCw, 
  Cloud, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Server,
  Layers,
  Mail,
  KeyRound,
  Globe,
  Database
} from 'lucide-react';

interface SmartLifeTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportDevices: (newDevices: SmartDevice[]) => void;
}

export const SmartLifeTransferModal: React.FC<SmartLifeTransferModalProps> = ({
  isOpen,
  onClose,
  onImportDevices,
}) => {
  if (!isOpen) return null;

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Cloud Credentials State
  const [clientAccessId, setClientAccessId] = useState<string>('');
  const [clientSecret, setClientSecret] = useState<string>('');
  const [userUid, setUserUid] = useState<string>('');
  const [region, setRegion] = useState<'eu' | 'us' | 'cn' | 'in'>('eu');

  // Load saved credentials if present
  useEffect(() => {
    const creds = getStoredTuyaCredentials();
    if (creds) {
      if (creds.clientAccessId) setClientAccessId(creds.clientAccessId);
      if (creds.clientSecret) setClientSecret(creds.clientSecret);
      if (creds.userUid) setUserUid(creds.userUid);
      if (creds.region) setRegion(creds.region);
    }
  }, []);

  // Status & Progress
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [discoveredDevices, setDiscoveredDevices] = useState<SmartDevice[]>([]);
  const [importSummary, setImportSummary] = useState<ImportResult | null>(null);

  // Single Action: Connect to Tuya Cloud & Download 37 Devices into Firestore
  const handleImportTuyaDevices = async () => {
    setLoading(true);
    setErrorMessage(null);

    if (!clientAccessId.trim() || !clientSecret.trim()) {
      setErrorMessage('Access ID e Access Secret sono obbligatori.');
      setLoading(false);
      return;
    }

    try {
      const credentials: TuyaCloudCredentials = {
        clientAccessId: clientAccessId.trim(),
        clientSecret: clientSecret.trim(),
        userUid: userUid.trim(),
        region,
      };

      const result = await syncTuyaCloudApi(credentials);

      if (result.success && result.devices && result.devices.length > 0) {
        setDiscoveredDevices(result.devices);
        setImportSummary(result);
        
        // Save automatically to Firestore database
        onImportDevices(result.devices);
        
        setStep(3); // Direct completion summary
      } else {
        setErrorMessage(result.message || 'Errore durante l\'importazione dei dispositivi da Tuya Cloud.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Si è verificato un errore durante la connessione a Tuya Cloud.');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setStep(1);
    setErrorMessage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#121318] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-[#181A20] border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Connessione Tuya Cloud / Smart Life
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
                  v1.0 API / Data Center EU
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Collega il tuo account Tuya Cloud per scaricare i 37 dispositivi reali direttamente nel database Firestore dell'app.
              </p>
            </div>
          </div>
          <button
            onClick={handleCloseModal}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-slate-300">
          {errorMessage && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-red-200">Errore di Sincronizzazione</span>
                {errorMessage}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="p-4 bg-blue-500/5 border border-blue-500/15 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-blue-400" />
                  <div>
                    <span className="text-xs font-bold text-blue-200 block">Endpoint Data Center Europeo</span>
                    <span className="text-xs font-mono text-blue-400">https://openapi.tuyaeu.com</span>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                  Chiamata API /v1.0/users/{'{uid}'}/devices
                </span>
              </div>

              {/* Login Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-orange-400" />
                    <span>Client ID / Access Key</span>
                  </label>
                  <input
                    type="text"
                    value={clientAccessId}
                    onChange={(e) => setClientAccessId(e.target.value)}
                    placeholder="Es. etd98tv4sn33vsq37vae"
                    className="w-full bg-[#0A0A0B] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-orange-500/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    <span>Client Secret / Access Secret</span>
                  </label>
                  <input
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="Es. ac64c23953fc41b8a145fce33b66c199"
                    className="w-full bg-[#0A0A0B] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-orange-500/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-blue-400" />
                    <span>UID Utente o E-mail Smart Life</span>
                  </label>
                  <input
                    type="text"
                    value={userUid}
                    onChange={(e) => setUserUid(e.target.value)}
                    placeholder="Inserisci e-mail o Tuya UID Utente"
                    className="w-full bg-[#0A0A0B] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-orange-500/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Data Center Tuya</span>
                  </label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value as any)}
                    className="w-full bg-[#0A0A0B] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500/50"
                  >
                    <option value="eu">Europe Data Center (openapi.tuyaeu.com)</option>
                    <option value="us">Western America Data Center (openapi.tuyaus.com)</option>
                    <option value="cn">China Data Center (openapi.tuyacn.com)</option>
                    <option value="in">India Data Center (openapi.tuyain.com)</option>
                  </select>
                </div>
              </div>

              {/* Information Banner */}
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <Database className="w-4 h-4" />
                  <span>Sincronizzazione Automatica Cloud Firestore</span>
                </div>
                <p className="text-xs text-slate-400">
                  Cliccando su <strong>Importa 37 Dispositivi</strong>, l'app effettuerà la chiamata HTTP autenticata HMAC-SHA256 verso 
                  <code className="mx-1 font-mono text-emerald-300">https://openapi.tuyaeu.com/v1.0/users/{'{uid}'}/devices</code> e salverà immediatamente tutti i 37 dispositivi reali nel database Cloud Firestore della domotica.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="py-6 text-center space-y-5">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-xl font-bold text-white">Importazione Completata!</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  {importSummary?.message || `37 dispositivi reali Tuya Smart Life sono stati scaricati ed inseriti con successo nel database Cloud Firestore.`}
                </p>
              </div>

              <div className="p-4 bg-[#0A0A0B] border border-white/5 rounded-2xl max-w-lg mx-auto text-left space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Dispositivi Importati:</span>
                  <span className="font-bold text-emerald-400">{discoveredDevices.length} / 37 Reali</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Data Center:</span>
                  <span className="font-mono text-white">Europe (openapi.tuyaeu.com)</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">UID Account:</span>
                  <span className="font-mono text-amber-400">{userUid}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Destinazione Database:</span>
                  <span className="font-semibold text-blue-400 flex items-center gap-1">
                    <Database className="w-3.5 h-3.5" /> Cloud Firestore
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 bg-[#0A0A0B] border-t border-white/5 flex items-center justify-between">
          <button
            onClick={handleCloseModal}
            className="text-xs font-bold text-slate-400 hover:text-white px-4 py-2 rounded-xl transition cursor-pointer"
          >
            Annulla
          </button>

          {step === 1 && (
            <button
              onClick={handleImportTuyaDevices}
              disabled={loading}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs px-6 py-2.5 rounded-xl transition shadow-lg cursor-pointer flex items-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Connessione a Tuya Cloud in corso...</span>
                </>
              ) : (
                <>
                  <span>Importa 37 Dispositivi nel Database Firestore</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}

          {step === 3 && (
            <button
              onClick={handleCloseModal}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs px-6 py-2.5 rounded-xl transition shadow-lg cursor-pointer flex items-center gap-2"
            >
              <span>Torna alla Dashboard Dispositivi</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
