import { useState } from 'react';
import { ChevronLeft, Eye, Search, Users, UserCheck } from 'lucide-react';

interface PrivacyScreenProps {
  onBack: () => void;
}

interface ToggleRowProps {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
  icon: React.ReactNode;
}

function ToggleRow({ label, desc, value, onChange, icon }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 border-b border-stone-50 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-stone-50 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-stone-700">{label}</p>
          <p className="text-xs text-stone-400 mt-0.5">{desc}</p>
        </div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${value ? 'bg-blue-500' : 'bg-stone-200'}`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${value ? 'translate-x-5' : 'translate-x-0.5'}`}
        />
      </button>
    </div>
  );
}

export default function PrivacyScreen({ onBack }: PrivacyScreenProps) {
  const [profileVisible, setProfileVisible] = useState(true);
  const [showInSearch, setShowInSearch] = useState(true);
  const [showLocation, setShowLocation] = useState(true);
  const [showConnections, setShowConnections] = useState(false);

  return (
    <div className="min-h-screen bg-stone-50 animate-fade-in">
      <div className="bg-white px-4 pt-12 pb-4 border-b border-stone-100">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-stone-200 bg-white hover:bg-stone-50 active:scale-95 transition-all flex-shrink-0"
          >
            <ChevronLeft size={18} className="text-stone-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-stone-800">Privacy</h1>
            <p className="text-xs text-stone-400">Control who can see your information</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-6 max-w-md mx-auto space-y-4">
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-50">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Profile Visibility</p>
          </div>
          <ToggleRow
            label="Public Profile"
            desc="Allow others to view your profile"
            value={profileVisible}
            onChange={setProfileVisible}
            icon={<Eye size={15} className="text-blue-500" />}
          />
          <ToggleRow
            label="Appear in Search"
            desc="Show up in mentor and mentee discovery"
            value={showInSearch}
            onChange={setShowInSearch}
            icon={<Search size={15} className="text-saffron-500" />}
          />
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-50">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Information Sharing</p>
          </div>
          <ToggleRow
            label="Show Location"
            desc="Display your current city on your profile"
            value={showLocation}
            onChange={setShowLocation}
            icon={<UserCheck size={15} className="text-green-500" />}
          />
          <ToggleRow
            label="Show Connections"
            desc="Display the number of your connections"
            value={showConnections}
            onChange={setShowConnections}
            icon={<Users size={15} className="text-stone-400" />}
          />
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-semibold text-stone-700 mb-1">Data & Account</h3>
          <p className="text-xs text-stone-400 leading-relaxed mb-3">
            Your data is stored securely and never shared with third parties without your consent.
          </p>
          <button className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors">
            Request data deletion
          </button>
        </div>

        <p className="text-xs text-stone-400 text-center px-4 pb-6">
          Changes to privacy settings take effect immediately.
        </p>
      </div>
    </div>
  );
}
