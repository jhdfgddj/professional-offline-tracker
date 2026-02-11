
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Sun, Moon, Pencil, Save, 
  Calculator, Check, X, 
  Download, ChevronLeft, User, Trash2
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { AppState, DayData, INITIAL_DAY_DATA, CircleKey, RectKey } from './types';

const STORAGE_KEY = 'ramadan_tracker_v1';
const SELECTION_TIMEOUT = 7000; // 7 Seconds

const CIRCLE_COLS: CircleKey[] = ['F', 'Z', 'A', 'M', 'E', 'T1', 'T2'];
const RECT_COLS: RectKey[] = ['QURAN', 'HADITH', 'SADKA', 'DUROOD', 'ISTIGFAAR', 'DUA'];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
    return {
      theme: 'dark',
      appTitle: 'Tracker',
      userName: 'User Name',
      userImage: 'https://picsum.photos/100/100',
      selectedDay: 0, // 0 means no row is selected
      removedT2: false,
      data: {}
    };
  });

  const [longPressActive, setLongPressActive] = useState<{ type: string; progress: number } | null>(null);
  const [editingRect, setEditingRect] = useState<{ day: number; key: RectKey } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [activeMenu, setActiveMenu] = useState<{ day: number; key: CircleKey; x: number; y: number } | null>(null);
  const [notepad, setNotepad] = useState<{ day: number; key: RectKey } | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isRenamingTitle, setIsRenamingTitle] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [showRemoveT2Confirm, setShowRemoveT2Confirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const selectionTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const resetSelectionTimer = useCallback(() => {
    if (selectionTimerRef.current) {
      window.clearTimeout(selectionTimerRef.current);
    }
    selectionTimerRef.current = window.setTimeout(() => {
      setState(prev => ({ ...prev, selectedDay: 0 }));
    }, SELECTION_TIMEOUT);
  }, []);

  useEffect(() => {
    if (state.selectedDay !== 0) {
      resetSelectionTimer();
    } else {
      if (selectionTimerRef.current) window.clearTimeout(selectionTimerRef.current);
    }
    return () => {
      if (selectionTimerRef.current) window.clearTimeout(selectionTimerRef.current);
    };
  }, [state.selectedDay, resetSelectionTimer]);

  const handleReset = useCallback(() => {
    setState(prev => ({
      ...prev,
      data: {},
      selectedDay: 0,
      removedT2: false // Restore the deleted column on reset
    }));
    setProfileOpen(false);
    setNotepad(null);
    setEditingRect(null);
    alert("Reset successful!");
  }, []);

  const startLongPress = (type: string, duration: number, callback: () => void) => {
    if (longPressTimerRef.current) clearInterval(longPressTimerRef.current);
    const startTime = Date.now();
    setLongPressActive({ type, progress: 0 });
    longPressTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setLongPressActive({ type, progress });
      if (elapsed >= duration) {
        if (longPressTimerRef.current) clearInterval(longPressTimerRef.current);
        longPressTimerRef.current = null;
        setLongPressActive(null);
        callback();
      }
    }, 50);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearInterval(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setLongPressActive(null);
  };

  const calculateDayStats = useCallback((day: number) => {
    const dayData = state.data[day];
    if (!dayData) return 0;
    const activeCircles = CIRCLE_COLS.filter(c => !state.removedT2 || c !== 'T2');
    const circleCount = activeCircles.reduce((acc, c) => acc + (dayData.circles[c] ? 1 : 0), 0);
    // Cast to string | undefined to handle potentially unknown values in strict environments
    const rectCount = RECT_COLS.reduce((acc, r) => acc + ((dayData.rects[r] as string | undefined)?.trim() ? 1 : 0), 0);
    
    if (circleCount === 0 && rectCount === 0) return 0;

    const totalPossible = activeCircles.length + RECT_COLS.length;
    return Math.round(((circleCount + rectCount) / totalPossible) * 100);
  }, [state.data, state.removedT2]);

  const trackedDays = useMemo(() => {
    // শুধুমাত্র সেই দিনগুলোই ফিল্টার করবে যেগুলোর প্রোগ্রেস ০ এর বেশি
    return Object.keys(state.data).filter(day => calculateDayStats(Number(day)) > 0);
  }, [state.data, calculateDayStats]);

  const overallEfficiency = useMemo(() => {
    if (trackedDays.length === 0) return 0;
    const totalStats = trackedDays.reduce((sum, day) => sum + calculateDayStats(Number(day)), 0);
    return Math.round(totalStats / trackedDays.length);
  }, [trackedDays, calculateDayStats]);

  const updateCircle = (day: number, key: CircleKey, val: boolean) => {
    setState(prev => {
      const dayData = prev.data[day] || { ...INITIAL_DAY_DATA };
      const updatedDayData = {
        ...dayData,
        circles: { ...dayData.circles, [key]: val }
      };

      // চেক করছি দিনটি এখন খালি কি না (cleanup)
      const noCircles = Object.values(updatedDayData.circles).every(v => !v);
      // Object.values returns unknown[] in some versions of TS, so we cast to handle .trim()
      const noRects = Object.values(updatedDayData.rects).every(v => !(v as string | undefined)?.trim());
      
      const newData = { ...prev.data };
      if (noCircles && noRects) {
        delete newData[day];
      } else {
        newData[day] = updatedDayData;
      }

      return { ...prev, data: newData };
    });
    setActiveMenu(null);
    resetSelectionTimer();
  };

  const saveRectValue = () => {
    if (!editingRect) return;
    setState(prev => {
      const dayData = prev.data[editingRect.day] || { ...INITIAL_DAY_DATA };
      const updatedDayData = {
        ...dayData,
        rects: { ...dayData.rects, [editingRect.key]: editValue }
      };

      const noCircles = Object.values(updatedDayData.circles).every(v => !v);
      // Object.values returns unknown[] in some versions of TS, so we cast to handle .trim()
      const noRects = Object.values(updatedDayData.rects).every(v => !(v as string | undefined)?.trim());

      const newData = { ...prev.data };
      if (noCircles && noRects) {
        delete newData[editingRect.day];
      } else {
        newData[editingRect.day] = updatedDayData;
      }

      return { ...prev, data: newData };
    });
    setEditingRect(null);
    resetSelectionTimer();
  };

  const saveNoteValue = (value: string) => {
    if (!notepad) return;
    setState(prev => {
      const dayData = prev.data[notepad.day] || { ...INITIAL_DAY_DATA };
      return {
        ...prev,
        data: {
          ...prev.data,
          [notepad.day]: {
            ...dayData,
            notes: { ...dayData.notes, [notepad.key]: value }
          }
        }
      };
    });
    resetSelectionTimer();
  };

  const exportImage = async (ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
    if (!ref.current || isExporting) return;
    try {
      setIsExporting(true);
      await new Promise(resolve => setTimeout(resolve, 300));

      const canvas = await html2canvas(ref.current, {
        backgroundColor: state.theme === 'dark' ? '#0f172a' : '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        width: ref.current.offsetWidth,
        height: ref.current.offsetHeight
      });

      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const isDark = state.theme === 'dark';
  const bgColor = isDark ? 'bg-slate-900' : 'bg-white';
  const textColor = isDark ? 'text-slate-100' : 'text-slate-900';
  const boxColor = isDark ? 'bg-slate-800' : 'bg-slate-100';
  const borderColor = isDark ? 'border-slate-700' : 'border-slate-200';

  const gridColsClass = state.removedT2 
    ? "grid grid-cols-[28px_repeat(6,22px)_repeat(6,1fr)]" 
    : "grid grid-cols-[28px_repeat(7,22px)_repeat(6,1fr)]";

  return (
    <div 
      ref={containerRef}
      className={`fixed inset-0 flex flex-col ${bgColor} ${textColor} no-select overflow-hidden`}
    >
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onloadend = () => setState(p => ({ ...p, userImage: reader.result as string }));
          reader.readAsDataURL(file);
        }
      }} />

      {/* Top Bar */}
      <div className={`h-14 border-b ${borderColor} flex items-center justify-between px-4 relative z-50 shrink-0`}>
        <div className="w-24"></div>
        <div 
          className="flex-1 text-center font-bold text-lg cursor-pointer relative py-2"
          onMouseDown={() => startLongPress('renameTitle', 2000, () => setIsRenamingTitle(true))}
          onMouseUp={cancelLongPress}
          onMouseLeave={cancelLongPress}
          onTouchStart={() => startLongPress('renameTitle', 2000, () => setIsRenamingTitle(true))}
          onTouchEnd={cancelLongPress}
        >
          {isRenamingTitle ? (
            <input 
              autoFocus
              className="bg-transparent text-center border-b border-emerald-500 outline-none w-32"
              value={state.appTitle}
              onChange={(e) => setState(prev => ({ ...prev, appTitle: e.target.value }))}
              onBlur={() => setIsRenamingTitle(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsRenamingTitle(false)}
            />
          ) : state.appTitle}
          {longPressActive?.type === 'renameTitle' && (
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 bg-emerald-500 transition-all duration-75" style={{ width: `${longPressActive.progress * 80}px` }}></div>
          )}
        </div>
        <div className="flex items-center gap-4 w-24 justify-end">
          <div 
            className="text-[10px] opacity-60 cursor-pointer font-bold uppercase tracking-widest relative py-2 px-3 -mr-2"
            onMouseDown={() => startLongPress('reset', 4000, handleReset)}
            onMouseUp={cancelLongPress}
            onMouseLeave={cancelLongPress}
            onTouchStart={() => startLongPress('reset', 4000, handleReset)}
            onTouchEnd={cancelLongPress}
          >
            Reset
            {longPressActive?.type === 'reset' && (
              <div className="absolute bottom-1 left-0 right-0 h-0.5 bg-red-500 transition-all duration-75" style={{ width: `${longPressActive.progress * 100}%` }}></div>
            )}
          </div>
          <button onClick={() => setState(prev => ({ ...prev, theme: prev.theme === 'dark' ? 'white' : 'dark' }))}>
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>

      {/* Header Grid */}
      <div className={`h-8 ${borderColor} border-b ${gridColsClass} gap-0.5 px-1 shrink-0`}>
        <div className="flex items-center justify-center text-[8px] font-black opacity-40">Day</div>
        {CIRCLE_COLS.filter(c => !state.removedT2 || c !== 'T2').map((c) => {
          const isT2 = c === 'T2';
          const isLongPressing = isT2 && longPressActive?.type === 'deleteT2';
          
          return (
            <div 
              key={c} 
              className={`text-[8px] font-black flex items-center justify-center uppercase relative cursor-help transition-all duration-300
                ${isLongPressing ? 'scale-125 opacity-100 text-red-500' : 'opacity-40'}
              `}
              onMouseDown={isT2 ? () => startLongPress('deleteT2', 4000, () => setShowRemoveT2Confirm(true)) : undefined}
              onMouseUp={isT2 ? cancelLongPress : undefined}
              onMouseLeave={isT2 ? cancelLongPress : undefined}
              onTouchStart={isT2 ? () => startLongPress('deleteT2', 4000, () => setShowRemoveT2Confirm(true)) : undefined}
              onTouchEnd={isT2 ? cancelLongPress : undefined}
            >
              <span className={isLongPressing ? 'animate-pulse' : ''}>{c.startsWith('T') ? 'T' : c}</span>
              
              {isLongPressing && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <svg className="w-6 h-6 -rotate-90" viewBox="0 0 32 32">
                    <circle
                      cx="16"
                      cy="16"
                      r="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray="100"
                      pathLength="100"
                      strokeDashoffset={100 - (longPressActive.progress * 100)}
                      strokeLinecap="round"
                      className="text-red-500 drop-shadow-[0_0_2px_rgba(239,68,68,0.8)]"
                    />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
        {RECT_COLS.map(r => (
          <div key={r} className="text-[5px] font-black opacity-30 flex items-center justify-center text-center uppercase leading-[1.1] truncate">{r}</div>
        ))}
      </div>

      {/* Main Grid Content */}
      <div className="flex-1 flex flex-col gap-0.5 p-1 overflow-hidden">
        {Array.from({ length: 30 }, (_, i) => i + 1).map(day => {
          const isActiveDay = state.selectedDay === day;
          const dayData = state.data[day] || INITIAL_DAY_DATA;

          return (
            <div 
              key={day} 
              onClick={() => setState(p => ({ ...p, selectedDay: day }))}
              className={`flex-1 ${gridColsClass} gap-0.5 items-stretch relative cursor-pointer transition-all duration-300 rounded-sm
                ${isActiveDay ? 'bg-emerald-500/10 border border-emerald-500/30' : 'border border-transparent'}
              `}
            >
              <div className={`flex items-center justify-center text-[9px] font-bold rounded-sm relative
                ${isActiveDay ? 'bg-emerald-600 text-white' : ''}
              `}>
                {day}
              </div>

              {CIRCLE_COLS.filter(c => !state.removedT2 || c !== 'T2').map(c => (
                <div 
                  key={c} 
                  className={`rounded-full border ${borderColor} flex items-center justify-center transition-all
                    ${dayData.circles[c] ? 'bg-emerald-500 border-emerald-500 scale-90' : boxColor}
                    ${!isActiveDay ? 'pointer-events-none opacity-100' : 'cursor-pointer'}
                  `}
                  onClick={(e) => {
                    if (isActiveDay) {
                      e.stopPropagation();
                      updateCircle(day, c, !dayData.circles[c]);
                    }
                  }}
                  onMouseDown={(e) => {
                    if (isActiveDay) {
                      e.stopPropagation();
                      startLongPress(`menu-${day}-${c}`, 800, () => setActiveMenu({ day, key: c, x: e.clientX, y: e.clientY }));
                    }
                  }}
                  onMouseUp={cancelLongPress}
                  onTouchStart={(e) => {
                    if (isActiveDay) {
                      e.stopPropagation();
                      const touch = e.touches[0];
                      startLongPress(`menu-${day}-${c}`, 800, () => setActiveMenu({ day, key: c, x: touch.clientX, y: touch.clientY }));
                    }
                  }}
                  onTouchEnd={cancelLongPress}
                >
                  {dayData.circles[c] && <Check size={10} className="text-white" strokeWidth={4} />}
                </div>
              ))}

              {RECT_COLS.map(r => (
                <div 
                  key={r} 
                  className={`min-w-0 ${boxColor} border ${borderColor} rounded-sm flex items-center justify-between px-0.5 relative group overflow-hidden
                    ${!isActiveDay ? 'pointer-events-none opacity-100' : ''}
                  `}
                  onMouseDown={(e) => { 
                    if (isActiveDay) {
                      e.stopPropagation();
                      startLongPress(`note-${day}-${r}`, 2000, () => setNotepad({ day, key: r })); 
                    }
                  }}
                  onMouseUp={cancelLongPress}
                  onTouchStart={(e) => { 
                    if (isActiveDay) {
                      e.stopPropagation();
                      startLongPress(`note-${day}-${r}`, 2000, () => setNotepad({ day, key: r })); 
                    }
                  }}
                  onTouchEnd={cancelLongPress}
                >
                  <span className="text-[7px] font-black truncate uppercase opacity-80">{dayData.rects[r] || ''}</span>
                  {isActiveDay && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingRect({ day, key: r });
                        setEditValue(dayData.rects[r] || '');
                      }}
                      className="p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Pencil size={7} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Footer Section */}
      <div className={`h-20 border-t ${borderColor} px-4 flex items-center gap-3 shrink-0 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
        <div className="relative cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <img src={state.userImage} className="w-12 h-12 rounded-full border-2 border-emerald-500 object-cover" alt="Avatar"/>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isEditingName ? (
              <input autoFocus className="bg-transparent border-b border-emerald-500 outline-none w-full font-bold" value={state.userName} onChange={(e) => setState(prev => ({ ...prev, userName: e.target.value }))} onBlur={() => setIsEditingName(false)}/>
            ) : (
              <span className="font-bold text-base truncate" onClick={() => setIsEditingName(true)}>{state.userName}</span>
            )}
            <Calculator size={16} className="text-emerald-500 ml-auto cursor-pointer" onClick={() => setProfileOpen(true)} />
          </div>
          <div className="text-[10px] opacity-60 font-bold uppercase tracking-tight">Selected Day’s Amal Progress: {state.selectedDay !== 0 ? calculateDayStats(state.selectedDay) : '---'}%</div>
        </div>
        <button 
          disabled={isExporting}
          onClick={() => exportImage(containerRef, `tracker-${state.userName}`)} 
          className={`bg-emerald-600 text-white p-2.5 rounded-full shadow-lg ${isExporting ? 'opacity-50 animate-pulse' : ''}`}
        >
          <Download size={18} />
        </button>
      </div>

      {/* Overlays */}
      {editingRect && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className={`${bgColor} w-full max-w-xs rounded-2xl p-6 border ${borderColor} shadow-2xl`}>
            <div className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-40">{editingRect.key}</div>
            <input autoFocus className={`w-full ${boxColor} border ${borderColor} rounded-lg p-3 text-sm font-bold outline-none`} value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveRectValue()}/>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditingRect(null)} className="text-xs font-bold uppercase opacity-60">Cancel</button>
              <button onClick={saveRectValue} className="bg-emerald-600 text-white px-5 py-2 rounded-full text-xs font-bold flex items-center gap-2"><Save size={14} /> Save</button>
            </div>
          </div>
        </div>
      )}

      {showRemoveT2Confirm && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className={`${bgColor} w-full max-w-xs rounded-2xl p-6 border ${borderColor} shadow-2xl`}>
            <div className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-40">Column Deletion</div>
            <p className="text-sm font-bold mb-6">Are you sure you want to remove the last 'T' column?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowRemoveT2Confirm(false)} className="text-xs font-bold uppercase opacity-60 px-4 py-2">Cancel</button>
              <button onClick={() => { setState(p => ({ ...p, removedT2: true })); setShowRemoveT2Confirm(false); }} className="bg-red-600 text-white px-5 py-2 rounded-full text-xs font-bold flex items-center gap-2"><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        </div>
      )}

      {activeMenu && (
        <div className="fixed inset-0 z-[100]" onClick={() => setActiveMenu(null)}>
            <div className={`${bgColor} absolute w-32 border ${borderColor} shadow-2xl rounded-xl overflow-hidden`} style={{ top: Math.min(activeMenu.y, window.innerHeight - 110), left: Math.min(activeMenu.x, window.innerWidth - 140) }}>
                <button className="w-full p-4 text-xs font-bold border-b border-slate-700/10 flex items-center gap-3" onClick={() => updateCircle(activeMenu.day, activeMenu.key, true)}><Check size={14} className="text-emerald-500" /> Mark</button>
                <button className="w-full p-4 text-xs font-bold flex items-center gap-3" onClick={() => updateCircle(activeMenu.day, activeMenu.key, false)}><X size={14} className="text-red-500" /> Unmark</button>
            </div>
        </div>
      )}

      {notepad && (
        <div className={`fixed inset-0 z-[200] ${bgColor} flex flex-col animate-in slide-in-from-right duration-300`}>
          <div className={`h-14 border-b ${borderColor} flex items-center px-4 gap-4`}>
            <button onClick={() => setNotepad(null)} className="p-1"><ChevronLeft size={24} /></button>
            <span className="font-bold text-sm uppercase tracking-widest opacity-60 flex-1">Notepad - {notepad.key}</span>
          </div>
          <textarea autoFocus className="flex-1 w-full bg-transparent p-6 text-xl font-bold outline-none resize-none" placeholder="Details..." value={state.data[notepad.day]?.notes[notepad.key] || ''} onChange={(e) => saveNoteValue(e.target.value)} />
        </div>
      )}

      {profileOpen && (
        <div ref={profileRef} className={`fixed inset-0 z-[300] ${bgColor} flex flex-col animate-in zoom-in-95 duration-300`}>
           <div className={`h-14 border-b ${borderColor} flex items-center px-4 gap-4`}>
            <button onClick={() => setProfileOpen(false)} className="p-1"><ChevronLeft size={24} /></button>
            <span className="font-black text-xs uppercase tracking-widest flex-1">Insights</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8 relative">
             <div className="relative">
                <img src={state.userImage} className="w-40 h-40 rounded-full border-4 border-emerald-500 shadow-2xl object-cover" alt="Profile" />
                <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-2 rounded-full shadow-lg"><Check size={20} strokeWidth={4} /></div>
             </div>
             <div className="text-center">
                <h2 className="text-4xl font-black tracking-tighter">{state.userName}</h2>
                <p className="text-emerald-500 font-black uppercase text-xs tracking-widest mt-2">PROFILE</p>
             </div>
             <div className="w-full max-w-xs space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-3xl text-center shadow-xl">
                   <div className="text-7xl font-black text-emerald-500 tabular-nums">{overallEfficiency}%</div>
                   <div className="text-[10px] font-black uppercase opacity-40 mt-2 tracking-[0.2em]">Overall Efficiency</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                   <div className={`${boxColor} p-4 rounded-2xl text-center border ${borderColor}`}>
                      <div className="text-xl font-bold text-emerald-500">{trackedDays.length}</div>
                      <div className="text-[8px] font-black uppercase opacity-40">Tracked Days</div>
                   </div>
                   <div className={`${boxColor} p-4 rounded-2xl text-center border ${borderColor}`}>
                      <div className="text-xl font-bold text-emerald-500">{state.selectedDay !== 0 ? calculateDayStats(state.selectedDay) : '0'}%</div>
                      <div className="text-[8px] font-black uppercase opacity-40">Selected Day</div>
                   </div>
                </div>
             </div>

             {/* Profile Export Button */}
             <button 
                disabled={isExporting}
                onClick={() => exportImage(profileRef, `profile-${state.userName}`)} 
                className={`absolute bottom-8 right-8 bg-emerald-600 text-white p-4 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all ${isExporting ? 'opacity-50' : ''}`}
             >
                <Download size={24} />
             </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
