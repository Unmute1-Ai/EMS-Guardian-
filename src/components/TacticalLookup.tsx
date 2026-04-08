import React, { useState } from 'react';
import { Search, Hash, Hospital, ChevronRight, X, Languages } from 'lucide-react';
import { cn } from '../lib/utils';

const TEN_CODES = [
  { code: '10-1', meaning: 'Receiving Poorly' },
  { code: '10-2', meaning: 'Receiving Well' },
  { code: '10-4', meaning: 'Acknowledgment (OK)' },
  { code: '10-7', meaning: 'Out of Service' },
  { code: '10-8', meaning: 'In Service' },
  { code: '10-9', meaning: 'Repeat' },
  { code: '10-10', meaning: 'Fight in Progress' },
  { code: '10-12', meaning: 'Standby' },
  { code: '10-13', meaning: 'Weather/Road Report' },
  { code: '10-19', meaning: 'Return to Station' },
  { code: '10-20', meaning: 'Location' },
  { code: '10-21', meaning: 'Call by Telephone' },
  { code: '10-22', meaning: 'Disregard' },
  { code: '10-23', meaning: 'Arrived at Scene' },
  { code: '10-33', meaning: 'Emergency Traffic' },
  { code: '10-41', meaning: 'Beginning Tour of Duty' },
  { code: '10-42', meaning: 'Ending Tour of Duty' },
  { code: '10-50', meaning: 'Accident (F, PI, PD)' },
  { code: '10-70', meaning: 'Fire Alarm' },
  { code: '10-74', meaning: 'Negative' },
  { code: '10-76', meaning: 'En Route' },
  { code: '10-77', meaning: 'ETA' },
  { code: '10-78', meaning: 'Need Assistance' },
  { code: '10-80', meaning: 'Pursuit in Progress' },
  { code: '10-97', meaning: 'Arrived at Scene' },
  { code: '10-98', meaning: 'Finished with Last Assignment' },
];

const HOSPITALS = [
  { name: 'Central General Hospital', level: 'Level I Trauma', distance: '1.2 mi', status: 'Diversion: NO' },
  { name: 'St. Jude Medical Center', level: 'Level II Trauma', distance: '3.5 mi', status: 'Diversion: NO' },
  { name: 'Mercy Children\'s Hospital', level: 'Pediatric Specialty', distance: '5.1 mi', status: 'Diversion: YES' },
  { name: 'University Medical Center', level: 'Level I Trauma', distance: '6.8 mi', status: 'Diversion: NO' },
  { name: 'Westside Community Hospital', level: 'Community Access', distance: '8.2 mi', status: 'Diversion: NO' },
  { name: 'North Memorial Health', level: 'Level III Trauma', distance: '10.4 mi', status: 'Diversion: NO' },
];

const PHRASES = [
  { en: 'Where does it hurt?', es: '¿Dónde le duele?', asl: 'WHERE HURT' },
  { en: 'What is your name?', es: '¿Cómo se llama?', asl: 'YOUR NAME WHAT' },
  { en: 'Are you allergic?', es: '¿Es alérgico?', asl: 'YOU ALLERGY' },
  { en: 'Breathe deeply.', es: 'Respire profundo.', asl: 'BREATHE DEEP' },
  { en: 'Help is here.', es: 'La ayuda está aquí.', asl: 'HELP HERE' },
  { en: 'Do you have pain?', es: '¿Tiene dolor?', asl: 'YOU PAIN' },
  { en: 'Stay still.', es: 'Quédese quieto.', asl: 'STAY STILL' },
  { en: 'I am a paramedic.', es: 'Soy paramédico.', asl: 'ME PARAMEDIC' },
  { en: 'Can you hear me?', es: '¿Puede oírme?', asl: 'YOU HEAR ME' },
  { en: 'Open your eyes.', es: 'Abra los ojos.', asl: 'OPEN EYES' },
];

export function TacticalLookup({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'10-CODES' | 'HOSPITALS' | 'PHRASES'>('10-CODES');

  const filteredCodes = TEN_CODES.filter(c => 
    c.code.toLowerCase().includes(search.toLowerCase()) || 
    c.meaning.toLowerCase().includes(search.toLowerCase())
  );

  const filteredHospitals = HOSPITALS.filter(h => 
    h.name.toLowerCase().includes(search.toLowerCase()) || 
    h.level.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPhrases = PHRASES.filter(p => 
    p.en.toLowerCase().includes(search.toLowerCase()) || 
    p.es.toLowerCase().includes(search.toLowerCase()) ||
    p.asl.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-cad-surface border-l border-cad-border shadow-2xl font-mono">
      <div className="bg-cad-border px-2 py-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="w-3 h-3 text-cad-amber" />
          <span className="text-[10px] font-bold uppercase tracking-widest">TACTICAL LOOKUP</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/10">
          <X className="w-3 h-3 text-cad-muted" />
        </button>
      </div>

      <div className="p-2 space-y-2">
        <div className="flex gap-1 bg-black/40 p-0.5 border border-cad-border">
          {[
            { id: '10-CODES', label: '10-CODES' },
            { id: 'HOSPITALS', label: 'HOSP' },
            { id: 'PHRASES', label: 'PHR' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={cn(
                "flex-1 py-1 text-[9px] font-bold uppercase tracking-tighter transition-all",
                tab === t.id ? "bg-cad-green text-black" : "text-cad-muted hover:text-white"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-cad-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="SEARCH..."
            className="w-full bg-black border border-cad-border py-1.5 pl-7 pr-2 text-[10px] focus:outline-none focus:border-cad-green transition-colors uppercase"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {tab === '10-CODES' && filteredCodes.map((c) => (
          <div key={c.code} className="p-2 bg-black/20 border border-cad-border hover:bg-cad-border/30 transition-colors group">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] font-bold text-cad-green">{c.code}</span>
              <ChevronRight className="w-2 h-2 text-cad-muted group-hover:text-white" />
            </div>
            <p className="text-[9px] text-white/60 uppercase tracking-tight">{c.meaning}</p>
          </div>
        ))}

        {tab === 'HOSPITALS' && filteredHospitals.map((h) => (
          <div key={h.name} className="p-2 bg-black/20 border border-cad-border hover:bg-cad-border/30 transition-colors group">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] font-bold text-white/80">{h.name}</span>
              <span className={cn(
                "text-[8px] font-bold px-1 rounded uppercase",
                h.status.includes('YES') ? "bg-cad-red text-white" : "bg-cad-green text-black"
              )}>
                {h.status.includes('YES') ? 'DIV' : 'OPEN'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-cad-muted uppercase">{h.level}</p>
              <p className="text-[9px] text-cad-cyan">{h.distance}</p>
            </div>
          </div>
        ))}

        {tab === 'PHRASES' && filteredPhrases.map((p, i) => (
          <div key={i} className="p-2 bg-black/20 border border-cad-border hover:bg-cad-border/30 transition-colors group">
            <div className="mb-1">
              <span className="text-[8px] font-bold text-cad-muted uppercase block">EN</span>
              <p className="text-[10px] font-bold text-white/90">{p.en}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[8px] font-bold text-cad-green/40 uppercase block">ES</span>
                <p className="text-[9px] text-cad-green">{p.es}</p>
              </div>
              <div>
                <span className="text-[8px] font-bold text-cad-cyan/40 uppercase block">ASL</span>
                <p className="text-[9px] text-cad-cyan">{p.asl}</p>
              </div>
            </div>
          </div>
        ))}

        {((tab === '10-CODES' && filteredCodes.length === 0) || 
          (tab === 'HOSPITALS' && filteredHospitals.length === 0) ||
          (tab === 'PHRASES' && filteredPhrases.length === 0)) && (
          <div className="h-full flex flex-col items-center justify-center opacity-10 py-12">
            <Search className="w-6 h-6 mb-2" />
            <p className="text-[10px] uppercase">NO DATA</p>
          </div>
        )}
      </div>
    </div>
  );
}
