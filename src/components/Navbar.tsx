import React from 'react';
import { 
  Home, 
  Zap, 
  Cpu, 
  Sliders, 
  Bot, 
  RefreshCw, 
  Plus, 
  Search, 
  ShieldCheck,
  SunMedium,
  Lock,
  Thermometer,
  Sparkles,
  Image as ImageIcon,
  Layers,
  FolderPlus
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'devices' | 'rooms' | 'automations' | 'energy' | 'ai';
  setActiveTab: (tab: 'devices' | 'rooms' | 'automations' | 'energy' | 'ai') => void;
  onOpenTransferModal: () => void;
  onOpenAiDrawer: () => void;
  onOpenAddDeviceModal: () => void;
  onOpenWallpaperModal: () => void;
  onOpenAddRoomModal?: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  totalActiveCount: number;
  totalWatts: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenTransferModal,
  onOpenAiDrawer,
  onOpenAddDeviceModal,
  onOpenWallpaperModal,
  onOpenAddRoomModal,
  searchQuery,
  setSearchQuery,
  totalActiveCount,
  totalWatts,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-950/85 backdrop-blur-2xl border-b border-white/10 text-slate-100 shadow-2xl">
      {/* Top Live Sync Status Notice */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-xs text-amber-300 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-ping" />
          <span className="font-bold text-amber-400">Sincronizzazione Live Firestore & Tuya Cloud API</span>
          <span className="hidden sm:inline text-slate-300">• Apple Home Architecture</span>
        </div>
        <button
          onClick={onOpenTransferModal}
          className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold px-3 py-0.5 rounded-full text-xs transition-all cursor-pointer shadow-md shadow-amber-400/10"
        >
          <RefreshCw className="w-3 h-3 animate-spin-slow" />
          <span>Configura Credenziali Tuya</span>
        </button>
      </div>

      {/* Main Apple Home Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo & House Title */}
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-200 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-amber-400/20">
                <Home className="w-6 h-6 fill-current" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight text-white font-sans">
                    Casa
                  </h1>
                  <span className="bg-white/10 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-white/15">
                    Apple Home
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Controllo Intelligente in Tempo Reale
                </p>
              </div>
            </div>

            {/* Mobile Quick Action Buttons */}
            <div className="flex items-center gap-2 md:hidden">
              <button
                onClick={onOpenWallpaperModal}
                className="p-2 rounded-full bg-white/10 text-amber-300 border border-white/15 hover:bg-white/20 transition"
                title="Cambia Sfondo"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              <button
                onClick={onOpenAiDrawer}
                className="p-2 rounded-full bg-white/10 text-white border border-white/15 hover:bg-white/20 transition"
                title="Siri AI"
              >
                <Bot className="w-5 h-5" />
              </button>
              <button
                onClick={onOpenAddDeviceModal}
                className="p-2 rounded-full bg-white text-slate-950 font-bold hover:bg-amber-300 transition"
                title="Aggiungi Dispositivo"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Apple Home Status Pills Bar */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <div className="flex items-center gap-1.5 bg-amber-400/15 border border-amber-400/30 text-amber-300 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-sm">
              <SunMedium className="w-4 h-4 text-amber-400 fill-current" />
              <span>{totalActiveCount} Attivi</span>
            </div>
            <div 
              onClick={() => setActiveTab('energy')}
              className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer hover:bg-emerald-500/25 transition shadow-sm"
              title="Visualizza Dettaglio Consumi"
            >
              <Zap className="w-4 h-4 text-emerald-400 fill-current" />
              <span>{totalWatts.toFixed(0)} W</span>
            </div>
            <div className="flex items-center gap-1.5 bg-sky-500/15 border border-sky-500/30 text-sky-300 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-sm">
              <Thermometer className="w-4 h-4 text-sky-400" />
              <span>21.5°C Clima</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/10 border border-white/15 text-slate-200 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-sm">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>Casa Protetta</span>
            </div>
          </div>

          {/* Search & Actions on Desktop */}
          <div className="hidden md:flex items-center gap-2.5">
            <div className="relative w-52">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cerca dispositivi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 text-slate-200 text-xs pl-9 pr-3 py-2 rounded-full border border-white/15 focus:outline-none focus:border-amber-400 transition placeholder-slate-500"
              />
            </div>

            <button
              onClick={onOpenWallpaperModal}
              className="flex items-center gap-1.5 bg-white/5 hover:bg-white/15 text-amber-300 font-semibold px-3 py-2 rounded-full text-xs border border-white/10 transition cursor-pointer"
              title="Personalizza Sfondo Casa"
            >
              <ImageIcon className="w-4 h-4 text-amber-400" />
              <span>Sfondo</span>
            </button>

            {onOpenAddRoomModal && (
              <button
                onClick={onOpenAddRoomModal}
                className="flex items-center gap-1.5 bg-white/5 hover:bg-white/15 text-white font-semibold px-3 py-2 rounded-full text-xs border border-white/10 transition cursor-pointer"
                title="Aggiungi una Stanza"
              >
                <FolderPlus className="w-4 h-4 text-sky-400" />
                <span className="hidden lg:inline">+ Stanza</span>
              </button>
            )}

            <button
              onClick={onOpenAiDrawer}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-semibold px-3.5 py-2 rounded-full text-xs border border-white/15 transition cursor-pointer"
            >
              <Bot className="w-4 h-4 text-amber-300" />
              <span>Siri AI</span>
            </button>

            <button
              onClick={onOpenAddDeviceModal}
              className="flex items-center gap-1 bg-white hover:bg-amber-300 text-slate-950 font-bold px-4 py-2 rounded-full text-xs transition cursor-pointer shadow-lg shadow-white/10"
            >
              <Plus className="w-4 h-4" />
              <span>Aggiungi</span>
            </button>
          </div>
        </div>

        {/* Apple Home Section Tabs Bar */}
        <nav className="flex items-center gap-1.5 mt-3 pt-2 border-t border-white/10 overflow-x-auto no-scrollbar select-none">
          <button
            onClick={() => setActiveTab('devices')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'devices'
                ? 'bg-white text-slate-950 font-bold shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Casa (Dispositivi)</span>
          </button>

          <button
            onClick={() => setActiveTab('rooms')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'rooms'
                ? 'bg-white text-slate-950 font-bold shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Stanze</span>
          </button>

          <button
            onClick={() => setActiveTab('energy')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'energy'
                ? 'bg-white text-slate-950 font-bold shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Zap className="w-4 h-4 text-emerald-400" />
            <span>Consumi & Energia</span>
          </button>

          <button
            onClick={() => setActiveTab('automations')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'automations'
                ? 'bg-white text-slate-950 font-bold shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Scene & Automazioni</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'ai'
                ? 'bg-white text-slate-950 font-bold shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Bot className="w-4 h-4 text-amber-400" />
            <span>Assistente AI Gemini</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
