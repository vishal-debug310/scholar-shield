import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Shield, Monitor, Key, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

const socket = io('http://localhost:5000');

export default function App() {
  const [childStatus, setChildStatus] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
  const [parentPin, setParentPin] = useState('1234');
  const [newPin, setNewPin] = useState('');
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to ScholarShield Backend');
    });

    socket.on('child-status-change', (data: { status: 'ONLINE' | 'OFFLINE' }) => {
      setChildStatus(data.status);
    });

    socket.on('new-violation-alert', (data: { message: string }) => {
      setAlerts((prev) => [data.message, ...prev]);
    });

    return () => {
      socket.off('child-status-change');
      socket.off('new-violation-alert');
    };
  }, []);

  const handlePinUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length === 4) {
      setParentPin(newPin);
      setNewPin('');
      alert('Parent PIN Updated Successfully!');
    } else {
      alert('PIN must be 4 digits');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
      <header className="max-w-6xl mx-auto flex items-center justify-between pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-sky-400" />
          <h1 className="text-2xl font-bold text-white">ScholarShield Parent Dashboard</h1>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700">
          <span className={`w-3 h-3 rounded-full ${childStatus === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className="text-sm font-medium">{childStatus === 'ONLINE' ? 'Child Active' : 'Child Offline'}</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Child Monitoring Card */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Monitor className="w-5 h-5 text-sky-400" /> Live Monitoring
            </h2>
            <RefreshCw className="w-4 h-4 text-slate-400 cursor-pointer hover:rotate-180 transition-transform" />
          </div>
          <div className="bg-slate-950 rounded-lg p-4 text-center border border-slate-800">
            <p className="text-xs text-slate-400 mb-2">Focus Kiosk App Status</p>
            <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold">
              <CheckCircle className="w-5 h-5" /> Kiosk Locked & Shielded
            </div>
          </div>
        </div>

        {/* Parent PIN Control */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Key className="w-5 h-5 text-amber-400" /> Exit PIN Settings
          </h2>
          <p className="text-xs text-slate-400 mb-3">Current Unlock PIN: <span className="font-mono text-amber-400">{parentPin}</span></p>
          <form onSubmit={handlePinUpdate} className="flex gap-2">
            <input
              type="password"
              maxLength={4}
              placeholder="New 4-digit PIN"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500"
            />
            <button type="submit" className="bg-sky-600 hover:bg-sky-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              Save
            </button>
          </form>
        </div>

        {/* Alert Logs */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-rose-400" /> Live Alert Log
          </h2>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {alerts.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No security violations recorded.</p>
            ) : (
              alerts.map((alert, index) => (
                <div key={index} className="bg-rose-950/40 border border-rose-800/50 p-2 rounded text-xs text-rose-300">
                  {alert}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}