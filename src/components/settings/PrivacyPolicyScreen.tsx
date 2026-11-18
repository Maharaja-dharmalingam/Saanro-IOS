import { ChevronLeft, Shield } from 'lucide-react';

interface LegalScreenProps {
  onBack: () => void;
}

const SECTIONS: Array<{ title: string; body: string }> = [
  {
    title: '1. Information We Collect',
    body: 'We collect information you provide (name, email, phone, location, bio, profile photo) and information generated through use (sessions booked, mentors viewed). We also collect limited technical data needed to operate the App.',
  },
  {
    title: '2. How We Use Information',
    body: 'We use your information to create and manage your account, match you with mentors, facilitate bookings and payments, and improve the App. We do not sell your personal data.',
  },
  {
    title: '3. Payments',
    body: 'Payment information is processed by our third-party payment provider (Stripe). Saanro does not store your full card details. Stripe’s own privacy policy governs payment data handling.',
  },
  {
    title: '4. Sharing',
    body: 'We share information only as needed to provide the service — for example, showing your public profile to other users, or sharing booking details with your mentor. We do not share data with advertisers.',
  },
  {
    title: '5. Your Rights',
    body: 'You may access, correct, or delete your personal data at any time from your Profile settings, or by contacting support@saanro.app. Subject to applicable law, we will action deletion requests promptly.',
  },
  {
    title: '6. Data Security',
    body: 'We use industry-standard measures to protect your data in transit and at rest. No method of transmission or storage is completely secure, but we work to protect your account.',
  },
  {
    title: '7. Children',
    body: 'Saanro is not directed to children under 13. If we learn we have collected data from a child under 13 without parental consent, we will delete it.',
  },
  {
    title: '8. Changes',
    body: 'We may update this Privacy Policy from time to time. Material changes will be communicated through the App.',
  },
  {
    title: '9. Contact',
    body: 'Questions about privacy can be directed to support@saanro.app.',
  },
];

export default function PrivacyPolicyScreen({ onBack }: LegalScreenProps) {
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
            <h1 className="text-lg font-bold text-stone-800">Privacy Policy</h1>
            <p className="text-xs text-stone-400">Last updated: July 2026</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-6 max-w-md mx-auto space-y-4 pb-8">
        <div className="card p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-saffron-50 flex items-center justify-center flex-shrink-0">
            <Shield size={15} className="text-saffron-500" />
          </div>
          <p className="text-xs text-stone-500 leading-relaxed">
            This Privacy Policy explains how Saanro handles your data. This is placeholder text — replace it with your legally reviewed policy before public release.
          </p>
        </div>

        {SECTIONS.map(s => (
          <div key={s.title} className="card p-4">
            <h3 className="text-sm font-semibold text-stone-800 mb-1.5">{s.title}</h3>
            <p className="text-xs text-stone-500 leading-relaxed">{s.body}</p>
          </div>
        ))}

        <p className="text-xs text-stone-400 text-center px-4 pb-2">
          Saanro · v1.0.0
        </p>
      </div>
    </div>
  );
}
