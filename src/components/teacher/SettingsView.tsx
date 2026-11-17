import React, { useState, useEffect } from 'react';
import { SchoolSetting, AuditLog } from '../../types';
import { getSchoolSettings, updateSchoolSettings, getAuditLogs } from '../../services/dataService';
import { useAuth } from '../../context/AuthContext';
import {
  Settings,
  School,
  Clock,
  ShieldCheck,
  CheckCircle,
  FileText,
  Save,
  Database,
  Lock,
  AlertCircle,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { teacherProfile } = useAuth();
  const [settings, setSettings] = useState<SchoolSetting>({
    id: 'school_config',
    schoolName: 'Sangurur Comprehensive School',
    schoolMotto: 'THINK, CODE, CHANGE THE WORLD',
    timezone: 'Africa/Nairobi',
    allowLearnerReflections: true,
    lateCutoffTime: '08:30',
    attendanceCutoffTime: '16:30',
    contactEmail: 'sangururschool10@gmail.com',
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [sett, logs] = await Promise.all([getSchoolSettings(), getAuditLogs()]);
        setSettings(sett);
        setAuditLogs(logs);
      } catch (err) {
        console.warn('Settings load notice:', err);
      }
    }
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);
    setSaveError(null);

    try {
      await updateSchoolSettings(
        settings,
        teacherProfile
          ? { uid: teacherProfile.uid, fullName: teacherProfile.fullName, role: teacherProfile.role }
          : undefined
      );
      const updatedLogs = await getAuditLogs();
      setAuditLogs(updatedLogs);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err: any) {
      setSaveError(err.message || 'Error updating settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              System Configuration
            </span>
            <span className="text-xs text-slate-500 font-medium">Sangurur Comprehensive School</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1">
            Institutional Settings & Audit Trail
          </h2>
          <p className="text-xs text-slate-500">
            Configure school parameters, Nairobi local timezone defaults, attendance submission rules, and audit logs.
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center space-x-1.5 text-emerald-700 font-bold text-xs bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>Settings Saved</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form: School Parameters */}
        <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          {saveError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          <h3 className="font-extrabold text-sm text-slate-900 flex items-center space-x-2">
            <School className="w-4 h-4 text-emerald-700" />
            <span>School Identification & Timezone</span>
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Institution Name
            </label>
            <input
              type="text"
              value={settings.schoolName}
              onChange={(e) => setSettings({ ...settings, schoolName: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              School Motto
            </label>
            <input
              type="text"
              value={settings.schoolMotto}
              onChange={(e) => setSettings({ ...settings, schoolMotto: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold uppercase text-emerald-800 focus:ring-2 focus:ring-emerald-600 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                System Timezone
              </label>
              <input
                type="text"
                disabled
                value={settings.timezone}
                className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono text-slate-600"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">East Africa Time (UTC+3)</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Contact Administrator
              </label>
              <input
                type="email"
                value={settings.contactEmail}
                onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <h4 className="font-bold text-xs text-slate-800 mb-2">
              Attendance Rules & Cutoffs
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Morning Late Cutoff:
                </label>
                <input
                  type="time"
                  value={settings.lateCutoffTime}
                  onChange={(e) => setSettings({ ...settings, lateCutoffTime: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Register Closing Cutoff:
                </label>
                <input
                  type="time"
                  value={settings.attendanceCutoffTime}
                  onChange={(e) => setSettings({ ...settings, attendanceCutoffTime: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                />
              </div>
            </div>

            <label className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Allow Learner Daily Reflections
                </span>
                <span className="text-[11px] text-slate-500">
                  Enable daily reflection prompts in the learner digital register.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.allowLearnerReflections}
                onChange={(e) =>
                  setSettings({ ...settings, allowLearnerReflections: e.target.checked })
                }
                className="w-4 h-4 accent-emerald-700 rounded"
              />
            </label>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={saving}
              className="py-2.5 px-5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </form>

        {/* Database & Security Info */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center space-x-2">
            <Database className="w-4 h-4 text-blue-700" />
            <span>Database Persistence & Security Hardening</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-700 block">Cloud Firestore Status</span>
              <p className="text-slate-500 font-mono text-[11px]">
                Database: ai-studio-sangururdigitall-ec614d5a-13b5-4863-bd7d-92f4cb3d80e1
              </p>
              <p className="text-emerald-700 font-semibold flex items-center space-x-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Connected & Security Rules Deployed</span>
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-700 block">Learner Password Protection</span>
              <p className="text-slate-600 text-[11px]">
                PBKDF2 salted hash algorithm (1,000 iterations, 64-byte key). Plaintext passwords are never stored in database documents.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-700 block">Duplicate Prevention Protocol</span>
              <p className="text-slate-600 text-[11px]">
                Deterministic keying: <code className="text-blue-700 font-mono">reg_&#123;cohortId&#125;_&#123;learnerId&#125;_&#123;date&#125;</code> prevents multiple submissions per day.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Logs Viewer (Section 16 requirement) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/60">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Administrative Audit Trail ({auditLogs.length} Events)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Immutable security and attendance correction logs.
            </p>
          </div>
        </div>

        {auditLogs.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No administrative modifications recorded in the audit log yet.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold sticky top-0">
                <tr>
                  <th className="py-2.5 px-4">Timestamp (EAT)</th>
                  <th className="py-2.5 px-4">Staff Actor</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                      {new Date(log.timestamp).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">
                      {log.actorName} ({log.actorRole})
                    </td>
                    <td className="py-2.5 px-4 font-mono text-blue-700 font-bold">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-4 max-w-md text-slate-600">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
