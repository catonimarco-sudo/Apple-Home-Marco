import React from 'react';
import { SmartDevice, EnergyDataPoint } from '../types';
import { MOCK_ENERGY_HISTORY } from '../data/mockDevices';
import { 
  Zap, 
  TrendingDown, 
  Euro, 
  Award, 
  Sparkles, 
  BarChart2, 
  ShieldCheck, 
  Leaf 
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar 
} from 'recharts';

interface EnergyTabProps {
  devices: SmartDevice[];
}

export const EnergyTab: React.FC<EnergyTabProps> = ({ devices }) => {
  // Calculate total current active wattage
  const totalWatts = devices.reduce((sum, dev) => {
    if (dev.category === 'plug' && dev.state.plug?.power) {
      return sum + (dev.state.plug.watts || 0);
    }
    if (dev.category === 'light' && dev.state.light?.power) {
      return sum + (dev.state.light.brightness * 0.12); // ~12W LED bulb max
    }
    return sum;
  }, 0);

  // Cost estimates: ~0.25 € / kWh
  const hourlyCostEst = (totalWatts / 1000) * 0.25;
  const dailyCostEst = hourlyCostEst * 24;
  const monthlyCostEst = dailyCostEst * 30;

  // Active plugs ranking
  const activePlugs = devices
    .filter((d) => d.category === 'plug' && d.state.plug?.power)
    .sort((a, b) => (b.state.plug?.watts || 0) - (a.state.plug?.watts || 0));

  return (
    <div className="space-y-8 text-slate-100">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#121214] border border-white/5 p-5 rounded-2xl shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-semibold">Potenza Istantanea</span>
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">
            {totalWatts.toFixed(1)} <span className="text-sm font-normal text-slate-400">Watt</span>
          </div>
          <p className="text-[11px] text-emerald-400 mt-2 flex items-center gap-1 font-medium">
            <TrendingDown className="w-3.5 h-3.5" />
            <span>Consumi stabili rispetto a ieri</span>
          </p>
        </div>

        <div className="bg-[#121214] border border-white/5 p-5 rounded-2xl shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-semibold">Costo Orario Stimato</span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Euro className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">
            € {hourlyCostEst.toFixed(3)} <span className="text-sm font-normal text-slate-400">/ ora</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Tariffa stimata 0.25 € / kWh</p>
        </div>

        <div className="bg-[#121214] border border-white/5 p-5 rounded-2xl shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-semibold">Proiezione Mensile</span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <BarChart2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">
            € {monthlyCostEst.toFixed(2)} <span className="text-sm font-normal text-slate-400">/ mese</span>
          </div>
          <p className="text-[11px] text-emerald-400 mt-2 font-medium">Calcolato su 30 giorni</p>
        </div>

        <div className="bg-[#121214] border border-white/5 p-5 rounded-2xl shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-semibold">Eco Score Domotica</span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Leaf className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono">
            92 <span className="text-sm font-normal text-slate-400">/ 100</span>
          </div>
          <p className="text-[11px] text-slate-300 mt-2">Ottimo efficientamento energetico</p>
        </div>
      </div>

      {/* Main Consumption Area Chart */}
      <div className="bg-[#121214] border border-white/5 p-6 rounded-3xl shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-emerald-400" />
              <span>Andamento Consumi della Giornata (Watt)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Rilevamento in tempo reale fornito dalle prese intellgenti Smart Life (Tuya)
            </p>
          </div>

          <span className="bg-[#0A0A0B] text-emerald-400 text-xs font-mono font-bold px-3 py-1 rounded-full border border-emerald-500/30">
            24 ORE
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={MOCK_ENERGY_HISTORY}>
              <defs>
                <linearGradient id="colorWatts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="time" stroke="#71717a" fontSize={12} />
              <YAxis stroke="#71717a" fontSize={12} unit="W" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0A0A0B', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                labelStyle={{ color: '#34d399', fontWeight: 'bold' }}
              />
              <Area type="monotone" dataKey="watts" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorWatts)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Dispositivi ad Alto Consumo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#121214] border border-white/5 p-5 rounded-3xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Classifica Consumi Istantanei</span>
          </h3>

          <div className="space-y-3">
            {activePlugs.length === 0 ? (
              <p className="text-xs text-slate-400">Nessuna presa smart attiva al momento.</p>
            ) : (
              activePlugs.map((dev) => (
                <div key={dev.id} className="bg-[#0A0A0B] p-3 rounded-2xl border border-white/5 flex items-center justify-between text-xs">
                  <div>
                    <h4 className="font-bold text-white">{dev.name}</h4>
                    <span className="text-slate-400">{dev.room}</span>
                  </div>
                  <span className="font-mono font-bold text-amber-400 text-sm">
                    {dev.state.plug?.watts} W
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AI Energy Tip */}
        <div className="bg-[#121214] border border-emerald-500/20 p-6 rounded-3xl space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 mb-2">
              <Sparkles className="w-5 h-5" />
              <h3 className="text-sm font-bold text-white">Consiglio Smart dall'AI Gemini</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Dall'analisi dei dispositivi Smart Life, la "Presa Smart TV & Media" rimane accesa in stand-by durante la notte consumando circa 12W costanti. Abilitando un'automazione di spegnimento tra le 01:00 e le 07:00 risparmierai fino a € 18.50 all'anno.
            </p>
          </div>

          <button className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs px-4 py-2 rounded-xl transition self-start cursor-pointer">
            Attiva Automazione Risparmio
          </button>
        </div>
      </div>
    </div>
  );
};
