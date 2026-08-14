import React, { useState, useMemo } from 'react';
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
  Leaf,
  Search,
  Power,
  SlidersHorizontal,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  Tv,
  Utensils,
  Lightbulb,
  Thermometer,
  Layers,
  Cpu
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
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface EnergyTabProps {
  devices: SmartDevice[];
  onTogglePower?: (device: SmartDevice) => void;
}

export const EnergyTab: React.FC<EnergyTabProps> = ({ devices, onTogglePower }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'plug' | 'light' | 'thermostat' | 'active'>('all');
  const [selectedRoom, setSelectedRoom] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'watts' | 'kwh' | 'cost' | 'name'>('watts');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Tariffs: ~0.25 € / kWh
  const KWH_COST_EUR = 0.25;

  // Helper to compute live and estimated consumption for any device
  const getDeviceConsumption = (dev: SmartDevice) => {
    let currentWatts = 0;
    let isPowered = false;
    let totalKwh = 0;

    if (dev.category === 'plug') {
      isPowered = Boolean(dev.state.plug?.power);
      currentWatts = isPowered ? (dev.state.plug?.watts || 0) : 0;
      totalKwh = dev.state.plug?.totalKwh || 0;
    } else if (dev.category === 'light') {
      isPowered = Boolean(dev.state.light?.power);
      // LED bulbs ~3W to 15W based on brightness
      currentWatts = isPowered ? Math.max(3, (dev.state.light?.brightness || 100) * 0.12) : 0;
      totalKwh = Number(((dev.state.light?.brightness || 50) * 0.08).toFixed(2));
    } else if (dev.category === 'thermostat') {
      isPowered = Boolean(dev.state.thermostat?.power);
      currentWatts = isPowered ? 450 : 5; // Heating / standby
      totalKwh = isPowered ? 14.2 : 0.8;
    } else if (dev.category === 'vacuum') {
      isPowered = dev.state.vacuum?.status === 'cleaning';
      currentWatts = isPowered ? 45 : (dev.state.vacuum?.status === 'docked' ? 5 : 0);
      totalKwh = 3.5;
    } else {
      // Switches, gates, cameras
      isPowered = Boolean(dev.state.switch?.power || dev.state.camera?.power);
      currentWatts = isPowered ? 8 : 2; // Electronics standby
      totalKwh = 1.2;
    }

    const estDailyKwh = currentWatts > 0 ? (currentWatts * 24) / 1000 : (isPowered ? 0.2 : 0.02);
    const estMonthlyCost = estDailyKwh * 30 * KWH_COST_EUR;

    return {
      currentWatts: Math.round(currentWatts * 10) / 10,
      isPowered,
      totalKwh,
      estDailyKwh: Number(estDailyKwh.toFixed(3)),
      estMonthlyCost: Number(estMonthlyCost.toFixed(2)),
    };
  };

  // Calculate total current active wattage across ALL devices
  const totalWatts = useMemo(() => {
    return devices.reduce((sum, dev) => {
      const { currentWatts } = getDeviceConsumption(dev);
      return sum + currentWatts;
    }, 0);
  }, [devices]);

  const hourlyCostEst = (totalWatts / 1000) * KWH_COST_EUR;
  const dailyCostEst = hourlyCostEst * 24;
  const monthlyCostEst = dailyCostEst * 30;
  const totalDailyKwh = (totalWatts * 24) / 1000;

  // Breakdown by Room
  const roomBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    devices.forEach((dev) => {
      const { currentWatts } = getDeviceConsumption(dev);
      const room = dev.room || 'Altri';
      map[room] = (map[room] || 0) + currentWatts;
    });
    return Object.entries(map)
      .map(([room, watts]) => ({ room, watts: Math.round(watts) }))
      .sort((a, b) => b.watts - a.watts);
  }, [devices]);

  // Unique rooms list
  const roomsList = useMemo(() => {
    return Array.from(new Set(devices.map((d) => d.room).filter(Boolean)));
  }, [devices]);

  // Filtered and Sorted Devices List for Detailed Breakdown
  const filteredAndSortedDevices = useMemo(() => {
    return devices
      .map((dev) => {
        const stats = getDeviceConsumption(dev);
        const percentOfTotal = totalWatts > 0 ? ((stats.currentWatts / totalWatts) * 100).toFixed(1) : '0';
        return {
          ...dev,
          stats,
          percentOfTotal: Number(percentOfTotal),
        };
      })
      .filter((item) => {
        const matchesSearch = 
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.room.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.category.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesRoom = selectedRoom === 'all' || item.room === selectedRoom;

        let matchesCat = true;
        if (categoryFilter === 'active') {
          matchesCat = item.stats.isPowered && item.stats.currentWatts > 0;
        } else if (categoryFilter !== 'all') {
          matchesCat = item.category === categoryFilter;
        }

        return matchesSearch && matchesRoom && matchesCat;
      })
      .sort((a, b) => {
        let valA: any = a.stats.currentWatts;
        let valB: any = b.stats.currentWatts;

        if (sortBy === 'kwh') {
          valA = a.stats.estDailyKwh;
          valB = b.stats.estDailyKwh;
        } else if (sortBy === 'cost') {
          valA = a.stats.estMonthlyCost;
          valB = b.stats.estMonthlyCost;
        } else if (sortBy === 'name') {
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }

        return sortOrder === 'desc' ? valB - valA : valA - valB;
      });
  }, [devices, totalWatts, searchQuery, categoryFilter, selectedRoom, sortBy, sortOrder]);

  const activeDevicesCount = devices.filter((d) => getDeviceConsumption(d).isPowered).length;

  return (
    <div className="space-y-8 text-slate-100 pb-12">
      
      {/* Apple Home Energy Hero Section */}
      <div className="bg-gradient-to-br from-emerald-950/40 via-[#0e1726]/70 to-[#0a0f1d]/90 border border-emerald-500/20 backdrop-blur-2xl rounded-[32px] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-72 h-72 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-1">
              <Zap className="w-4 h-4" />
              <span>Apple Home • Monitoraggio Energia & Consumi</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white font-sans tracking-tight">
              Quadro Consumi Casa
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Controllo completo della potenza istantanea, dei costi stimati e dell'assorbimento di ciascuno dei {devices.length} dispositivi domotici.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto bg-black/40 border border-white/15 px-4 py-2.5 rounded-2xl backdrop-blur-md">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Dispositivi Attivi</p>
              <p className="text-sm font-bold text-white font-mono">{activeDevicesCount} su {devices.length}</p>
            </div>
          </div>
        </div>

        {/* 4 Apple Key Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-black/35 border border-white/10 p-4 sm:p-5 rounded-2xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-semibold">Potenza Istantanea</span>
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Zap className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              {totalWatts.toFixed(1)} <span className="text-sm font-normal text-slate-400">W</span>
            </div>
            <p className="text-[11px] text-emerald-400 mt-2 flex items-center gap-1 font-medium">
              <TrendingDown className="w-3.5 h-3.5" />
              <span>{(totalWatts / 1000).toFixed(2)} kW in tempo reale</span>
            </p>
          </div>

          <div className="bg-black/35 border border-white/10 p-4 sm:p-5 rounded-2xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-semibold">Consumo Giornaliero</span>
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <BarChart2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              {totalDailyKwh.toFixed(2)} <span className="text-sm font-normal text-slate-400">kWh/g</span>
            </div>
            <p className="text-[11px] text-slate-300 mt-2">
              Circa € {dailyCostEst.toFixed(2)} al giorno
            </p>
          </div>

          <div className="bg-black/35 border border-white/10 p-4 sm:p-5 rounded-2xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-semibold">Stima Bolletta Mese</span>
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Euro className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              € {monthlyCostEst.toFixed(2)} <span className="text-sm font-normal text-slate-400">/ mese</span>
            </div>
            <p className="text-[11px] text-emerald-400 mt-2 font-medium">
              Calcolato a € 0.25 / kWh
            </p>
          </div>

          <div className="bg-black/35 border border-white/10 p-4 sm:p-5 rounded-2xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-semibold">Efficienza Casa</span>
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Leaf className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
              94 <span className="text-sm font-normal text-slate-400">/ 100</span>
            </div>
            <p className="text-[11px] text-slate-300 mt-2">Ottimizzazione Eco Attiva</p>
          </div>
        </div>
      </div>

      {/* Charts Section: 24h Trend + Room Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main 24h Curve (2 Cols) */}
        <div className="lg:col-span-2 bg-black/30 backdrop-blur-xl border border-white/10 p-6 rounded-[28px] space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-emerald-400" />
                <span>Andamento Consumo Complessivo (Ultime 24 Ore)</span>
              </h3>
              <p className="text-xs text-slate-400">
                Potenza totale assorbita dall'impianto Smart Life e Tuya
              </p>
            </div>
            <span className="bg-emerald-500/20 text-emerald-400 text-xs font-mono font-bold px-3 py-1 rounded-full border border-emerald-500/30">
              Live Watt
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_ENERGY_HISTORY} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="totalColorWatts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={11} unit="W" tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.15)', borderRadius: '14px', fontSize: '12px' }}
                  labelStyle={{ color: '#34d399', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="watts" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#totalColorWatts)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Room Energy Share (1 Col) */}
        <div className="bg-black/30 backdrop-blur-xl border border-white/10 p-6 rounded-[28px] space-y-4 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" />
              <span>Assorbimento per Stanza</span>
            </h3>
            <p className="text-xs text-slate-400">
              Distribuzione dei Watt nelle varie aree
            </p>

            <div className="mt-4 space-y-2.5 max-h-56 overflow-y-auto pr-1 no-scrollbar">
              {roomBreakdown.map((r, idx) => {
                const pct = totalWatts > 0 ? Math.round((r.watts / totalWatts) * 100) : 0;
                return (
                  <div key={r.room} className="bg-white/5 p-2.5 rounded-xl border border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white">{r.room}</span>
                      <span className="font-mono font-bold text-emerald-400">{r.watts} W ({pct}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3 bg-amber-400/10 border border-amber-400/20 rounded-2xl flex items-center gap-2.5 text-xs text-amber-200">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Istanze ad alto assorbimento identificate e gestibili singolarmente in basso.</span>
          </div>
        </div>
      </div>

      {/* DETAILED PER-DEVICE CONSUMPTION SECTION */}
      <div className="bg-black/30 backdrop-blur-2xl border border-white/10 rounded-[32px] p-6 sm:p-8 space-y-6 shadow-2xl">
        
        {/* Section Header with Title & Live Device Counter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-emerald-400" />
              <span>Consumo per Singolo Dispositivo ({filteredAndSortedDevices.length})</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Visualizza la potenza esatta, i kWh giornalieri e il costo di ogni apparecchio collegato
            </p>
          </div>

          {/* Quick Action: Spegni dispositivi inattivi / standby */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">
              Totale Selezionato: <strong className="text-emerald-400">{filteredAndSortedDevices.reduce((s, d) => s + d.stats.currentWatts, 0).toFixed(0)} W</strong>
            </span>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          
          {/* Search Input */}
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filtra dispositivo per nome o stanza..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-white/15 text-slate-200 text-xs pl-10 pr-4 py-2.5 rounded-full focus:outline-none focus:border-emerald-400 placeholder-slate-500 transition"
            />
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto no-scrollbar py-1">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer border ${
                categoryFilter === 'all'
                  ? 'bg-white text-slate-950 border-white font-bold shadow-md'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
              }`}
            >
              Tutti ({devices.length})
            </button>

            <button
              onClick={() => setCategoryFilter('active')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer border ${
                categoryFilter === 'active'
                  ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold shadow-md'
                  : 'bg-white/5 border-white/10 text-amber-300 hover:bg-white/10'
              }`}
            >
              ⚡ Solo Accesi ({activeDevicesCount})
            </button>

            <button
              onClick={() => setCategoryFilter('plug')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer border ${
                categoryFilter === 'plug'
                  ? 'bg-emerald-400 text-slate-950 border-emerald-300 font-bold shadow-md'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
              }`}
            >
              Prese Smart
            </button>

            <button
              onClick={() => setCategoryFilter('light')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer border ${
                categoryFilter === 'light'
                  ? 'bg-yellow-400 text-slate-950 border-yellow-300 font-bold shadow-md'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
              }`}
            >
              Luci
            </button>
          </div>

          {/* Room Filter & Sort Dropdown */}
          <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="bg-black/40 border border-white/15 text-slate-200 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-emerald-400 cursor-pointer"
            >
              <option value="all">Tutte le Stanze</option>
              {roomsList.map((rm) => (
                <option key={rm} value={rm}>{rm}</option>
              ))}
            </select>

            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('-');
                setSortBy(sb as any);
                setSortOrder(so as any);
              }}
              className="bg-black/40 border border-white/15 text-slate-200 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-emerald-400 cursor-pointer"
            >
              <option value="watts-desc">Assorbimento Max (W)</option>
              <option value="watts-asc">Assorbimento Min (W)</option>
              <option value="cost-desc">Costo Mensile Max (€)</option>
              <option value="name-asc">Nome (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Devices Consumption Table / List */}
        {filteredAndSortedDevices.length === 0 ? (
          <div className="py-12 text-center bg-black/20 rounded-2xl border border-dashed border-white/10">
            <p className="text-xs text-slate-400">Nessun dispositivo corrisponde ai filtri impostati.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredAndSortedDevices.map((dev) => {
              const { currentWatts, isPowered, estDailyKwh, estMonthlyCost } = dev.stats;

              // Color coding based on power consumption
              let wattBadgeColor = 'bg-white/10 text-slate-400 border-white/10';
              if (isPowered) {
                if (currentWatts > 500) {
                  wattBadgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
                } else if (currentWatts > 50) {
                  wattBadgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
                } else {
                  wattBadgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
                }
              }

              return (
                <div
                  key={dev.id}
                  className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isPowered && currentWatts > 0
                      ? 'bg-black/40 border-white/15 hover:border-emerald-500/40 shadow-sm'
                      : 'bg-black/20 border-white/5 opacity-75 hover:opacity-100'
                  }`}
                >
                  {/* Left: Device Name, Room, Icon */}
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <button
                      type="button"
                      onClick={() => onTogglePower && onTogglePower(dev)}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer shrink-0 ${
                        isPowered
                          ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                          : 'bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white'
                      }`}
                      title={isPowered ? 'Clicca per spegnere' : 'Clicca per accendere'}
                    >
                      <Power className="w-4 h-4" />
                    </button>

                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-white truncate">{dev.name}</h4>
                        <span className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded-md ${
                          isPowered ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-400'
                        }`}>
                          {isPowered ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span>{dev.room}</span>
                        <span>•</span>
                        <span className="capitalize opacity-80">{dev.category}</span>
                      </p>
                    </div>
                  </div>

                  {/* Middle: Live Wattage & % of Home */}
                  <div className="flex items-center gap-4 justify-between sm:justify-start">
                    <div className="text-right sm:text-left min-w-[90px]">
                      <span className="text-[10px] text-slate-400 font-semibold block">Potenza Live</span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${wattBadgeColor}`}>
                        <Zap className="w-3 h-3" />
                        {currentWatts} W
                      </span>
                    </div>

                    <div className="text-right sm:text-left min-w-[100px]">
                      <span className="text-[10px] text-slate-400 font-semibold block">Consumo Giornaliero</span>
                      <span className="text-xs font-mono font-bold text-white">
                        {estDailyKwh} <span className="text-[10px] font-normal text-slate-400">kWh/g</span>
                      </span>
                    </div>

                    <div className="text-right sm:text-left min-w-[100px]">
                      <span className="text-[10px] text-slate-400 font-semibold block">Stima Mese</span>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        € {estMonthlyCost.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Right: Progress bar representing % of Home Consumption */}
                  <div className="w-full sm:w-36 flex flex-col justify-center">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span>Quota Casa</span>
                      <span className="font-mono font-bold text-slate-300">{dev.percentOfTotal}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(dev.percentOfTotal > 0 ? 3 : 0, dev.percentOfTotal))}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
