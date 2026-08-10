import React, { useState } from 'react';
import { AutomationRule, SmartDevice } from '../types';
import { 
  Play, 
  Plus, 
  Sliders, 
  Clock, 
  Zap, 
  Sun, 
  Moon, 
  LogOut, 
  ShieldAlert, 
  Check, 
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2
} from 'lucide-react';

interface AutomationsTabProps {
  automations: AutomationRule[];
  devices: SmartDevice[];
  onExecuteTapToRun: (rule: AutomationRule) => void;
  onToggleAutomation: (automationId: string) => void;
  onAddAutomation: (newRule: AutomationRule) => void;
  onDeleteAutomation: (automationId: string) => void;
}

export const AutomationsTab: React.FC<AutomationsTabProps> = ({
  automations,
  devices,
  onExecuteTapToRun,
  onToggleAutomation,
  onAddAutomation,
  onDeleteAutomation,
}) => {
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [executedRuleId, setExecutedRuleId] = useState<string | null>(null);

  // New Rule Form State
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDesc, setNewDesc] = useState<string>('');
  const [newType, setNewType] = useState<'tap_to_run' | 'schedule' | 'device_condition'>('tap_to_run');
  const [newTime, setNewTime] = useState<string>('08:00');

  const handleRunScene = (rule: AutomationRule) => {
    onExecuteTapToRun(rule);
    setExecutedRuleId(rule.id);
    setTimeout(() => setExecutedRuleId(null), 1500);
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newRule: AutomationRule = {
      id: `rule-${Date.now()}`,
      title: newTitle,
      description: newDesc || 'Automazione personalizzata SmartLife Hub',
      iconName: newType === 'tap_to_run' ? 'Play' : 'Clock',
      type: newType,
      enabled: true,
      scheduleTime: newType === 'schedule' ? newTime : undefined,
      actions: [
        {
          deviceId: devices[0]?.id || 'dev-plug-01',
          targetState: { 'plug.power': false },
          actionDescription: 'Azione Automatica Dispositivo',
        },
      ],
    };

    onAddAutomation(newRule);
    setNewTitle('');
    setNewDesc('');
    setShowAddModal(false);
  };

  const tapToRunRules = automations.filter((a) => a.type === 'tap_to_run');
  const conditionalRules = automations.filter((a) => a.type !== 'tap_to_run');

  return (
    <div className="space-y-8 text-slate-100">
      {/* Tap-To-Run Quick Scenes Header */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <span>Scenari e Tocchi Rapidi (Tap-to-Run)</span>
            </h2>
            <p className="text-xs text-slate-400">
              Esegui routine complesse e controlla più dispositivi Smart Life contemporaneamente con un solo tocco
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Crea Scena</span>
          </button>
        </div>

        {/* Tap-To-Run Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tapToRunRules.map((rule) => {
            const isExecuted = executedRuleId === rule.id;

            return (
              <div
                key={rule.id}
                className="bg-[#121214] border border-white/5 hover:border-emerald-500/30 p-5 rounded-2xl flex flex-col justify-between transition-all duration-200 shadow-md group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center group-hover:scale-105 transition">
                      {rule.iconName === 'LogOut' && <LogOut className="w-5 h-5" />}
                      {rule.iconName === 'Moon' && <Moon className="w-5 h-5" />}
                      {rule.iconName === 'Sun' && <Sun className="w-5 h-5 text-amber-400" />}
                      {rule.iconName === 'Play' && <Play className="w-5 h-5" />}
                    </div>

                    <span className="bg-[#0A0A0B] text-emerald-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                      Tocco Rapido
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition">
                    {rule.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {rule.description}
                  </p>
                </div>

                {/* Trigger Button */}
                <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {rule.actions.length} Azioni Inserite
                  </span>

                  <button
                    onClick={() => handleRunScene(rule)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md ${
                      isExecuted
                        ? 'bg-emerald-500 text-black'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-black'
                    }`}
                  >
                    {isExecuted ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Eseguito!</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-black" />
                        <span>Esegui Ora</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Conditional Automations (IF / THEN Rules) */}
      <div className="pt-4 border-t border-white/5">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-400" />
            <span>Automazioni Smart Programmate (IF... THEN...)</span>
          </h2>
          <p className="text-xs text-slate-400">
            Regole automatiche basate su orari, stato dei dispositivi Smart Life o sensori
          </p>
        </div>

        <div className="space-y-3">
          {conditionalRules.map((rule) => (
            <div
              key={rule.id}
              className="bg-[#121214] border border-white/5 p-4 rounded-2xl flex items-center justify-between gap-4 transition hover:border-white/10"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 text-slate-300 flex items-center justify-center shrink-0">
                  {rule.type === 'schedule' ? <Clock className="w-5 h-5 text-amber-400" /> : <ShieldAlert className="w-5 h-5 text-rose-400" />}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">{rule.title}</h3>
                    {rule.scheduleTime && (
                      <span className="bg-amber-500/10 text-amber-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/20">
                        {rule.scheduleTime} ({rule.scheduleDays?.join(', ')})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{rule.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => onToggleAutomation(rule.id)}
                  className="cursor-pointer"
                  title="Attiva / Disattiva"
                >
                  {rule.enabled ? (
                    <ToggleRight className="w-8 h-8 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-600" />
                  )}
                </button>

                <button
                  onClick={() => onDeleteAutomation(rule.id)}
                  className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Custom Automation Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0B]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateRule}
            className="bg-[#121214] border border-white/5 rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <span>Nuova Automazione Smart</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">Titolo Scena / Automazione</label>
                <input
                  type="text"
                  required
                  placeholder="es. Rientro a Casa la Sera"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-[#0A0A0B] border border-white/10 px-3 py-2 rounded-xl text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Descrizione</label>
                <input
                  type="text"
                  placeholder="es. Accende le luci dell'ingresso e imposta il termostato a 21°C"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-[#0A0A0B] border border-white/10 px-3 py-2 rounded-xl text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Tipo di Innesco (Trigger)</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="w-full bg-[#0A0A0B] border border-white/10 px-3 py-2 rounded-xl text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="tap_to_run">Tocco Rapido Manuale (Tap-to-Run)</option>
                  <option value="schedule">Programmazione Oraria (Orologio)</option>
                  <option value="device_condition">Stato Sensore / Dispositivo Smart Life</option>
                </select>
              </div>

              {newType === 'schedule' && (
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Orario di Esecuzione</label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="bg-[#0A0A0B] border border-white/10 px-3 py-2 rounded-xl text-white font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs px-5 py-2 rounded-xl cursor-pointer"
              >
                Salva Automazione
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
