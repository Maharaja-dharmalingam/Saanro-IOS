import { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Phone, ShieldCheck, RotateCcw, Search, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import TermsScreen from '../components/settings/TermsScreen';
import PrivacyPolicyScreen from '../components/settings/PrivacyPolicyScreen';

interface AuthPageProps {
  onAuthSuccess: () => void;
}

// Comprehensive country dial code list
const ALL_COUNTRIES = [
  { code: '+93', flag: '🇦🇫', name: 'Afghanistan' },
  { code: '+355', flag: '🇦🇱', name: 'Albania' },
  { code: '+213', flag: '🇩🇿', name: 'Algeria' },
  { code: '+1684', flag: '🇦🇸', name: 'American Samoa' },
  { code: '+376', flag: '🇦🇩', name: 'Andorra' },
  { code: '+244', flag: '🇦🇴', name: 'Angola' },
  { code: '+1264', flag: '🇦🇮', name: 'Anguilla' },
  { code: '+1268', flag: '🇦🇬', name: 'Antigua & Barbuda' },
  { code: '+54', flag: '🇦🇷', name: 'Argentina' },
  { code: '+374', flag: '🇦🇲', name: 'Armenia' },
  { code: '+297', flag: '🇦🇼', name: 'Aruba' },
  { code: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: '+43', flag: '🇦🇹', name: 'Austria' },
  { code: '+994', flag: '🇦🇿', name: 'Azerbaijan' },
  { code: '+1242', flag: '🇧🇸', name: 'Bahamas' },
  { code: '+973', flag: '🇧🇭', name: 'Bahrain' },
  { code: '+880', flag: '🇧🇩', name: 'Bangladesh' },
  { code: '+1246', flag: '🇧🇧', name: 'Barbados' },
  { code: '+375', flag: '🇧🇾', name: 'Belarus' },
  { code: '+32', flag: '🇧🇪', name: 'Belgium' },
  { code: '+501', flag: '🇧🇿', name: 'Belize' },
  { code: '+229', flag: '🇧🇯', name: 'Benin' },
  { code: '+1441', flag: '🇧🇲', name: 'Bermuda' },
  { code: '+975', flag: '🇧🇹', name: 'Bhutan' },
  { code: '+591', flag: '🇧🇴', name: 'Bolivia' },
  { code: '+387', flag: '🇧🇦', name: 'Bosnia & Herzegovina' },
  { code: '+267', flag: '🇧🇼', name: 'Botswana' },
  { code: '+55', flag: '🇧🇷', name: 'Brazil' },
  { code: '+246', flag: '🇮🇴', name: 'British Indian Ocean Territory' },
  { code: '+673', flag: '🇧🇳', name: 'Brunei' },
  { code: '+359', flag: '🇧🇬', name: 'Bulgaria' },
  { code: '+226', flag: '🇧🇫', name: 'Burkina Faso' },
  { code: '+257', flag: '🇧🇮', name: 'Burundi' },
  { code: '+855', flag: '🇰🇭', name: 'Cambodia' },
  { code: '+237', flag: '🇨🇲', name: 'Cameroon' },
  { code: '+1', flag: '🇨🇦', name: 'Canada' },
  { code: '+238', flag: '🇨🇻', name: 'Cape Verde' },
  { code: '+1345', flag: '🇰🇾', name: 'Cayman Islands' },
  { code: '+236', flag: '🇨🇫', name: 'Central African Republic' },
  { code: '+235', flag: '🇹🇩', name: 'Chad' },
  { code: '+56', flag: '🇨🇱', name: 'Chile' },
  { code: '+86', flag: '🇨🇳', name: 'China' },
  { code: '+57', flag: '🇨🇴', name: 'Colombia' },
  { code: '+269', flag: '🇰🇲', name: 'Comoros' },
  { code: '+242', flag: '🇨🇬', name: 'Congo' },
  { code: '+243', flag: '🇨🇩', name: 'Congo (DRC)' },
  { code: '+682', flag: '🇨🇰', name: 'Cook Islands' },
  { code: '+506', flag: '🇨🇷', name: 'Costa Rica' },
  { code: '+385', flag: '🇭🇷', name: 'Croatia' },
  { code: '+53', flag: '🇨🇺', name: 'Cuba' },
  { code: '+357', flag: '🇨🇾', name: 'Cyprus' },
  { code: '+420', flag: '🇨🇿', name: 'Czech Republic' },
  { code: '+45', flag: '🇩🇰', name: 'Denmark' },
  { code: '+253', flag: '🇩🇯', name: 'Djibouti' },
  { code: '+1767', flag: '🇩🇲', name: 'Dominica' },
  { code: '+1809', flag: '🇩🇴', name: 'Dominican Republic' },
  { code: '+593', flag: '🇪🇨', name: 'Ecuador' },
  { code: '+20', flag: '🇪🇬', name: 'Egypt' },
  { code: '+503', flag: '🇸🇻', name: 'El Salvador' },
  { code: '+240', flag: '🇬🇶', name: 'Equatorial Guinea' },
  { code: '+291', flag: '🇪🇷', name: 'Eritrea' },
  { code: '+372', flag: '🇪🇪', name: 'Estonia' },
  { code: '+268', flag: '🇸🇿', name: 'Eswatini' },
  { code: '+251', flag: '🇪🇹', name: 'Ethiopia' },
  { code: '+500', flag: '🇫🇰', name: 'Falkland Islands' },
  { code: '+298', flag: '🇫🇴', name: 'Faroe Islands' },
  { code: '+679', flag: '🇫🇯', name: 'Fiji' },
  { code: '+358', flag: '🇫🇮', name: 'Finland' },
  { code: '+33', flag: '🇫🇷', name: 'France' },
  { code: '+594', flag: '🇬🇫', name: 'French Guiana' },
  { code: '+689', flag: '🇵🇫', name: 'French Polynesia' },
  { code: '+241', flag: '🇬🇦', name: 'Gabon' },
  { code: '+220', flag: '🇬🇲', name: 'Gambia' },
  { code: '+995', flag: '🇬🇪', name: 'Georgia' },
  { code: '+49', flag: '🇩🇪', name: 'Germany' },
  { code: '+233', flag: '🇬🇭', name: 'Ghana' },
  { code: '+350', flag: '🇬🇮', name: 'Gibraltar' },
  { code: '+30', flag: '🇬🇷', name: 'Greece' },
  { code: '+299', flag: '🇬🇱', name: 'Greenland' },
  { code: '+1473', flag: '🇬🇩', name: 'Grenada' },
  { code: '+590', flag: '🇬🇵', name: 'Guadeloupe' },
  { code: '+1671', flag: '🇬🇺', name: 'Guam' },
  { code: '+502', flag: '🇬🇹', name: 'Guatemala' },
  { code: '+224', flag: '🇬🇳', name: 'Guinea' },
  { code: '+245', flag: '🇬🇼', name: 'Guinea-Bissau' },
  { code: '+592', flag: '🇬🇾', name: 'Guyana' },
  { code: '+509', flag: '🇭🇹', name: 'Haiti' },
  { code: '+504', flag: '🇭🇳', name: 'Honduras' },
  { code: '+852', flag: '🇭🇰', name: 'Hong Kong' },
  { code: '+36', flag: '🇭🇺', name: 'Hungary' },
  { code: '+354', flag: '🇮🇸', name: 'Iceland' },
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+62', flag: '🇮🇩', name: 'Indonesia' },
  { code: '+98', flag: '🇮🇷', name: 'Iran' },
  { code: '+964', flag: '🇮🇶', name: 'Iraq' },
  { code: '+353', flag: '🇮🇪', name: 'Ireland' },
  { code: '+972', flag: '🇮🇱', name: 'Israel' },
  { code: '+39', flag: '🇮🇹', name: 'Italy' },
  { code: '+225', flag: '🇨🇮', name: 'Ivory Coast' },
  { code: '+1876', flag: '🇯🇲', name: 'Jamaica' },
  { code: '+81', flag: '🇯🇵', name: 'Japan' },
  { code: '+962', flag: '🇯🇴', name: 'Jordan' },
  { code: '+7', flag: '🇰🇿', name: 'Kazakhstan' },
  { code: '+254', flag: '🇰🇪', name: 'Kenya' },
  { code: '+686', flag: '🇰🇮', name: 'Kiribati' },
  { code: '+965', flag: '🇰🇼', name: 'Kuwait' },
  { code: '+996', flag: '🇰🇬', name: 'Kyrgyzstan' },
  { code: '+856', flag: '🇱🇦', name: 'Laos' },
  { code: '+371', flag: '🇱🇻', name: 'Latvia' },
  { code: '+961', flag: '🇱🇧', name: 'Lebanon' },
  { code: '+266', flag: '🇱🇸', name: 'Lesotho' },
  { code: '+231', flag: '🇱🇷', name: 'Liberia' },
  { code: '+218', flag: '🇱🇾', name: 'Libya' },
  { code: '+423', flag: '🇱🇮', name: 'Liechtenstein' },
  { code: '+370', flag: '🇱🇹', name: 'Lithuania' },
  { code: '+352', flag: '🇱🇺', name: 'Luxembourg' },
  { code: '+853', flag: '🇲🇴', name: 'Macau' },
  { code: '+261', flag: '🇲🇬', name: 'Madagascar' },
  { code: '+265', flag: '🇲🇼', name: 'Malawi' },
  { code: '+60', flag: '🇲🇾', name: 'Malaysia' },
  { code: '+960', flag: '🇲🇻', name: 'Maldives' },
  { code: '+223', flag: '🇲🇱', name: 'Mali' },
  { code: '+356', flag: '🇲🇹', name: 'Malta' },
  { code: '+692', flag: '🇲🇭', name: 'Marshall Islands' },
  { code: '+596', flag: '🇲🇶', name: 'Martinique' },
  { code: '+222', flag: '🇲🇷', name: 'Mauritania' },
  { code: '+230', flag: '🇲🇺', name: 'Mauritius' },
  { code: '+52', flag: '🇲🇽', name: 'Mexico' },
  { code: '+691', flag: '🇫🇲', name: 'Micronesia' },
  { code: '+373', flag: '🇲🇩', name: 'Moldova' },
  { code: '+377', flag: '🇲🇨', name: 'Monaco' },
  { code: '+976', flag: '🇲🇳', name: 'Mongolia' },
  { code: '+382', flag: '🇲🇪', name: 'Montenegro' },
  { code: '+1664', flag: '🇲🇸', name: 'Montserrat' },
  { code: '+212', flag: '🇲🇦', name: 'Morocco' },
  { code: '+258', flag: '🇲🇿', name: 'Mozambique' },
  { code: '+95', flag: '🇲🇲', name: 'Myanmar' },
  { code: '+264', flag: '🇳🇦', name: 'Namibia' },
  { code: '+674', flag: '🇳🇷', name: 'Nauru' },
  { code: '+977', flag: '🇳🇵', name: 'Nepal' },
  { code: '+31', flag: '🇳🇱', name: 'Netherlands' },
  { code: '+687', flag: '🇳🇨', name: 'New Caledonia' },
  { code: '+64', flag: '🇳🇿', name: 'New Zealand' },
  { code: '+505', flag: '🇳🇮', name: 'Nicaragua' },
  { code: '+227', flag: '🇳🇪', name: 'Niger' },
  { code: '+234', flag: '🇳🇬', name: 'Nigeria' },
  { code: '+683', flag: '🇳🇺', name: 'Niue' },
  { code: '+850', flag: '🇰🇵', name: 'North Korea' },
  { code: '+389', flag: '🇲🇰', name: 'North Macedonia' },
  { code: '+47', flag: '🇳🇴', name: 'Norway' },
  { code: '+968', flag: '🇴🇲', name: 'Oman' },
  { code: '+92', flag: '🇵🇰', name: 'Pakistan' },
  { code: '+680', flag: '🇵🇼', name: 'Palau' },
  { code: '+970', flag: '🇵🇸', name: 'Palestine' },
  { code: '+507', flag: '🇵🇦', name: 'Panama' },
  { code: '+675', flag: '🇵🇬', name: 'Papua New Guinea' },
  { code: '+595', flag: '🇵🇾', name: 'Paraguay' },
  { code: '+51', flag: '🇵🇪', name: 'Peru' },
  { code: '+63', flag: '🇵🇭', name: 'Philippines' },
  { code: '+48', flag: '🇵🇱', name: 'Poland' },
  { code: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: '+1787', flag: '🇵🇷', name: 'Puerto Rico' },
  { code: '+974', flag: '🇶🇦', name: 'Qatar' },
  { code: '+40', flag: '🇷🇴', name: 'Romania' },
  { code: '+7', flag: '🇷🇺', name: 'Russia' },
  { code: '+250', flag: '🇷🇼', name: 'Rwanda' },
  { code: '+1869', flag: '🇰🇳', name: 'Saint Kitts & Nevis' },
  { code: '+1758', flag: '🇱🇨', name: 'Saint Lucia' },
  { code: '+1784', flag: '🇻🇨', name: 'Saint Vincent & Grenadines' },
  { code: '+685', flag: '🇼🇸', name: 'Samoa' },
  { code: '+378', flag: '🇸🇲', name: 'San Marino' },
  { code: '+239', flag: '🇸🇹', name: 'São Tomé & Príncipe' },
  { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+221', flag: '🇸🇳', name: 'Senegal' },
  { code: '+381', flag: '🇷🇸', name: 'Serbia' },
  { code: '+248', flag: '🇸🇨', name: 'Seychelles' },
  { code: '+232', flag: '🇸🇱', name: 'Sierra Leone' },
  { code: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: '+421', flag: '🇸🇰', name: 'Slovakia' },
  { code: '+386', flag: '🇸🇮', name: 'Slovenia' },
  { code: '+677', flag: '🇸🇧', name: 'Solomon Islands' },
  { code: '+252', flag: '🇸🇴', name: 'Somalia' },
  { code: '+27', flag: '🇿🇦', name: 'South Africa' },
  { code: '+82', flag: '🇰🇷', name: 'South Korea' },
  { code: '+211', flag: '🇸🇸', name: 'South Sudan' },
  { code: '+34', flag: '🇪🇸', name: 'Spain' },
  { code: '+94', flag: '🇱🇰', name: 'Sri Lanka' },
  { code: '+249', flag: '🇸🇩', name: 'Sudan' },
  { code: '+597', flag: '🇸🇷', name: 'Suriname' },
  { code: '+46', flag: '🇸🇪', name: 'Sweden' },
  { code: '+41', flag: '🇨🇭', name: 'Switzerland' },
  { code: '+963', flag: '🇸🇾', name: 'Syria' },
  { code: '+886', flag: '🇹🇼', name: 'Taiwan' },
  { code: '+992', flag: '🇹🇯', name: 'Tajikistan' },
  { code: '+255', flag: '🇹🇿', name: 'Tanzania' },
  { code: '+66', flag: '🇹🇭', name: 'Thailand' },
  { code: '+670', flag: '🇹🇱', name: 'Timor-Leste' },
  { code: '+228', flag: '🇹🇬', name: 'Togo' },
  { code: '+676', flag: '🇹🇴', name: 'Tonga' },
  { code: '+1868', flag: '🇹🇹', name: 'Trinidad & Tobago' },
  { code: '+216', flag: '🇹🇳', name: 'Tunisia' },
  { code: '+90', flag: '🇹🇷', name: 'Turkey' },
  { code: '+993', flag: '🇹🇲', name: 'Turkmenistan' },
  { code: '+1649', flag: '🇹🇨', name: 'Turks & Caicos' },
  { code: '+688', flag: '🇹🇻', name: 'Tuvalu' },
  { code: '+256', flag: '🇺🇬', name: 'Uganda' },
  { code: '+380', flag: '🇺🇦', name: 'Ukraine' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+44', flag: '🇬🇧', name: 'United Kingdom' },
  { code: '+1', flag: '🇺🇸', name: 'United States' },
  { code: '+598', flag: '🇺🇾', name: 'Uruguay' },
  { code: '+998', flag: '🇺🇿', name: 'Uzbekistan' },
  { code: '+678', flag: '🇻🇺', name: 'Vanuatu' },
  { code: '+58', flag: '🇻🇪', name: 'Venezuela' },
  { code: '+84', flag: '🇻🇳', name: 'Vietnam' },
  { code: '+1340', flag: '🇻🇮', name: 'Virgin Islands (US)' },
  { code: '+967', flag: '🇾🇪', name: 'Yemen' },
  { code: '+260', flag: '🇿🇲', name: 'Zambia' },
  { code: '+263', flag: '🇿🇼', name: 'Zimbabwe' },
];

function CountryCodePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = ALL_COUNTRIES.find(c => c.code === value) ?? ALL_COUNTRIES[0];
  const filtered = ALL_COUNTRIES.filter(
    c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.includes(search)
  );

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="input-field flex items-center gap-1.5 w-28 text-sm select-none"
      >
        <span className="text-base leading-none">{selected.flag}</span>
        <span className="font-medium text-stone-700">{selected.code}</span>
        <ChevronDown size={13} className={`ml-auto text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1.5 w-72 bg-white rounded-2xl shadow-2xl border border-stone-100 overflow-hidden animate-fade-in">
          {/* Search */}
          <div className="p-2 border-b border-stone-100">
            <div className="flex items-center gap-2 bg-stone-50 rounded-xl px-3 py-2">
              <Search size={13} className="text-stone-400 flex-shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search country or code..."
                className="flex-1 bg-transparent text-base outline-none text-stone-700 placeholder-stone-400"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-center text-stone-400 text-sm py-4">No results</p>
            ) : (
              filtered.map(c => (
                <button
                  key={`${c.code}-${c.name}`}
                  type="button"
                  onClick={() => {
                    onChange(c.code);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-stone-50 transition-colors text-left ${
                    c.code === value && c.name === selected.name ? 'bg-saffron-50 text-saffron-700' : 'text-stone-700'
                  }`}
                >
                  <span className="text-base w-6 text-center">{c.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-stone-400 font-medium">{c.code}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const { signIn, startPhoneRegistration, sendPhoneOtp, verifyPhoneOtp, pendingRegistration, clearPendingRegistration, checkPhoneExists } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [legalView, setLegalView] = useState<null | 'terms' | 'privacypolicy'>(null);

  // ── Login state ────────────────────────────────────────────────────────────
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // ── Register state ─────────────────────────────────────────────────────────
  const [fullName, setFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [dialCode, setDialCode] = useState('+91');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');

  // ── OTP state ──────────────────────────────────────────────────────────────
  // otpStep is derived from pendingRegistration so it survives re-renders
  const otpStep = !!pendingRegistration;
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const fullPhone = `${dialCode}${phoneLocal.replace(/\D/g, '')}`;

  useEffect(() => {
    if (otpStep) setTimeout(() => otpRefs.current[0]?.focus(), 100);
  }, [otpStep]);

  // ── Login submit ───────────────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const { error } = await signIn(loginEmail, loginPassword);
      if (error) throw error;
      onAuthSuccess();
    } catch (err: unknown) {
      setLoginError((err as Error).message || 'Invalid credentials');
    } finally {
      setLoginLoading(false);
    }
  }

  // ── Register: send OTP first, account created after verification ──────────
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError('');
    if (!fullName.trim()) return setRegError('Please enter your full name');
    const digits = phoneLocal.replace(/\D/g, '');
    if (digits.length < 5) return setRegError('Please enter a valid phone number');

    setRegLoading(true);
    try {
      // Check for an existing account with this phone number (ignores formatting)
      const exists = await checkPhoneExists(fullPhone);
      if (exists) {
        setRegError('A user with this phone number already exists. Please sign in instead.');
        return;
      }
      const { error } = await startPhoneRegistration(regEmail, regPassword, fullName, fullPhone);
      if (error) throw error;
      startResendCooldown();
    } catch (err: unknown) {
      setRegError((err as Error).message || 'Something went wrong. Please try again.');
    } finally {
      setRegLoading(false);
    }
  }

  // ── OTP helpers ────────────────────────────────────────────────────────────
  function startResendCooldown() {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown(v => {
        if (v <= 1) { clearInterval(interval); return 0; }
        return v - 1;
      });
    }, 1000);
  }

  function handleOtpInput(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtpDigits(pasted.split(''));
      otpRefs.current[5]?.focus();
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const token = otpDigits.join('');
    if (token.length < 6) return setOtpError('Please enter all 6 digits');
    setOtpError('');
    setOtpLoading(true);
    try {
      const phone = pendingRegistration?.phone ?? fullPhone;
      const { error } = await verifyPhoneOtp(phone, token);
      if (error) throw error;
      // Session is now set — App.tsx will route past AuthPage automatically
    } catch (err: unknown) {
      setOtpError((err as Error).message || 'Invalid code. Please try again.');
      setOtpDigits(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0) return;
    setOtpError('');
    const phone = pendingRegistration?.phone ?? fullPhone;
    const { error } = await sendPhoneOtp(phone);
    if (error) {
      setOtpError(error.message || 'Failed to resend code.');
    } else {
      startResendCooldown();
    }
  }

  function switchMode(m: 'login' | 'register') {
    setMode(m);
    setLoginError('');
    setRegError('');
    setOtpDigits(['', '', '', '', '', '']);
    setOtpError('');
  }

  return (
    <>
      {legalView === 'terms' && <TermsScreen onBack={() => setLegalView(null)} />}
      {legalView === 'privacypolicy' && <PrivacyPolicyScreen onBack={() => setLegalView(null)} />}
      {!legalView && (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Hero */}
      <div className="gradient-hero flex flex-col items-center justify-center pt-14 pb-10 px-6">
        <div className="flex items-center gap-3 mb-5">
          <img src="/logo-flat-r.png" alt="Saanro" className="w-12 h-12 rounded-2xl object-contain" />
          <div>
            <h1 className="text-2xl font-bold text-white leading-tight">Saanro</h1>
            <p className="text-white/60 text-sm">சாண்றோ</p>
          </div>
        </div>
        <p className="text-white/70 text-center text-sm max-w-xs leading-relaxed">
          Connect with Tamil mentors worldwide. Learn, grow, and preserve culture.
        </p>
        <div className="flex items-center gap-4 mt-5 text-xs text-white/40">
          <span>🇮🇳 India</span>
          <span>·</span>
          <span>🇱🇰 Sri Lanka</span>
          <span>·</span>
          <span>🌐 Global Diaspora</span>
        </div>
      </div>

      <div className="flex-1 px-6 pt-7 pb-10 max-w-md mx-auto w-full">

        {/* ── OTP VERIFICATION ─────────────────────────────────────────────── */}
        {otpStep ? (
          <form onSubmit={handleVerifyOtp} className="animate-fade-in">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 bg-saffron-50 rounded-2xl flex items-center justify-center mb-4">
                <ShieldCheck size={30} className="text-saffron-500" />
              </div>
              <h2 className="text-xl font-bold text-stone-800 mb-1">Enter verification code</h2>
              <p className="text-stone-500 text-sm leading-relaxed">
                We sent a 6-digit code via SMS to
              </p>
              <p className="text-stone-700 font-semibold text-sm mt-0.5">{pendingRegistration?.phone ?? fullPhone}</p>
            </div>

            {/* 6-digit OTP boxes */}
            <div className="flex gap-2.5 justify-center mb-6" onPaste={handleOtpPaste}>
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpInput(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  className={`w-11 h-14 text-center text-xl font-bold rounded-2xl border-2 transition-all outline-none
                    ${digit
                      ? 'border-saffron-500 bg-saffron-50 text-saffron-700'
                      : 'border-stone-200 bg-white text-stone-800'}
                    focus:border-saffron-500 focus:bg-saffron-50`}
                />
              ))}
            </div>

            {otpError && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4 animate-fade-in">
                <p className="text-red-600 text-sm text-center">{otpError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={otpLoading || otpDigits.join('').length < 6}
              className="w-full btn-primary py-4 text-base mb-4"
            >
              {otpLoading ? 'Verifying…' : 'Verify & Continue'}
            </button>

            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0}
                className="flex items-center gap-1.5 text-sm font-semibold transition-colors text-saffron-500 hover:text-saffron-600 disabled:text-stone-400 disabled:cursor-not-allowed"
              >
                <RotateCcw size={13} />
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
            </div>

            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => {
                  setOtpDigits(['', '', '', '', '', '']);
                  setOtpError('');
                  clearPendingRegistration();
                }}
                className="text-stone-400 text-sm hover:text-stone-600 transition-colors"
              >
                Back to registration
              </button>
            </div>
          </form>

        ) : (
          <>
            {/* Tab switcher */}
            <div className="flex gap-1 bg-stone-100 p-1 rounded-2xl mb-7">
              {(['login', 'register'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    mode === m
                      ? 'bg-white text-stone-800 shadow-sm'
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  {m === 'login' ? 'Sign In' : 'Join Now'}
                </button>
              ))}
            </div>

            {/* ── SIGN IN ────────────────────────────────────────────────────── */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4 animate-fade-in">
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="input-field"
                    required
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      placeholder="Your password"
                      className="input-field pr-12"
                      required
                      minLength={6}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(v => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 animate-fade-in">
                    <p className="text-red-600 text-sm">{loginError}</p>
                  </div>
                )}

                <button type="submit" disabled={loginLoading} className="w-full btn-primary py-4 text-base mt-2">
                  {loginLoading ? 'Signing in…' : 'Sign In'}
                </button>
              </form>
            )}

            {/* ── JOIN NOW ───────────────────────────────────────────────────── */}
            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4 animate-fade-in">
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g., Arun Selvakumar"
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="input-field"
                    required
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="input-field pr-12"
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(v => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Phone size={13} className="text-saffron-500" />
                      Phone Number
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <CountryCodePicker value={dialCode} onChange={setDialCode} />
                    <input
                      type="tel"
                      value={phoneLocal}
                      onChange={e => setPhoneLocal(e.target.value)}
                      placeholder="98765 43210"
                      className="input-field flex-1"
                      required
                    />
                  </div>
                  <p className="text-xs text-stone-400 mt-1.5">
                    A verification code will be sent to this number
                  </p>
                </div>

                {regError && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 animate-fade-in">
                    <p className="text-red-600 text-sm">{regError}</p>
                  </div>
                )}

                <button type="submit" disabled={regLoading} className="w-full btn-primary py-4 text-base mt-2 flex items-center justify-center gap-2">
                  {regLoading ? (
                    'Sending verification code…'
                  ) : (
                    <>
                      <Phone size={16} />
                      Send Verification Code
                    </>
                  )}
                </button>

                <p className="text-xs text-stone-400 text-center leading-relaxed">
                  By joining, you agree to our{' '}
                  <button
                    type="button"
                    onClick={() => setLegalView('terms')}
                    className="text-saffron-500 font-semibold hover:text-saffron-600 transition-colors"
                  >
                    Terms of Service
                  </button>{' '}
                  and{' '}
                  <button
                    type="button"
                    onClick={() => setLegalView('privacypolicy')}
                    className="text-saffron-500 font-semibold hover:text-saffron-600 transition-colors"
                  >
                    Privacy Policy
                  </button>.
                </p>
              </form>
            )}

            {/* Bottom switch link */}
            <div className="mt-7 text-center">
              <p className="text-stone-400 text-sm">
                {mode === 'login' ? 'New to Saanro? ' : 'Already have an account? '}
                <button
                  onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                  className="text-saffron-500 font-semibold hover:text-saffron-600"
                >
                  {mode === 'login' ? 'Join the community' : 'Sign in'}
                </button>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
      )}
    </>
  );
}
