import { ChevronLeft, FileText } from 'lucide-react';

interface LegalScreenProps {
  onBack: () => void;
}

const SECTIONS: Array<{ title: string; body: string }> = [
  {
    title: '1. Acceptance of Terms',
    body: 'By accessing or using Saanro ("the App"), you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree with any part of these terms, you must not use the App.',
  },
  {
    title: '2. Eligibility',
    body: 'You must be at least 13 years old to use Saanro. Mentors offering paid sessions must be of legal age in their jurisdiction and are responsible for any taxes or obligations arising from payments received through the App.',
  },
  {
    title: '3. Accounts',
    body: 'You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You agree to provide accurate information and to keep it up to date.',
  },
  {
    title: '4. Community Guidelines',
    body: 'Saanro is a respectful space for mentorship within the Tamil community and beyond. You agree not to post unlawful, harassing, discriminatory, or misleading content, and not to impersonate others.',
  },
  {
    title: '5. Mentorship & Payments',
    body: 'Paid sessions are facilitated through third-party payment processors (Stripe). Saanro is not a party to the transaction between mentors and mentees. All sales are final unless otherwise required by law. Refund eligibility is determined by the mentor’s stated policy.',
  },
  {
    title: '6. Intellectual Property',
    body: 'All trademarks, logos, and content provided by Saanro remain the property of Saanro. User-generated content remains yours, but you grant Saanro a license to display it within the App.',
  },
  {
    title: '7. Limitation of Liability',
    body: 'The App is provided "as is" without warranties of any kind. Saanro is not liable for any disputes between users, or for any indirect or consequential damages arising from use of the App.',
  },
  {
    title: '8. Termination',
    body: 'We may suspend or terminate your account if you violate these terms. You may delete your account at any time from your Profile settings.',
  },
  {
    title: '9. Changes to Terms',
    body: 'We may update these Terms from time to time. Continued use of the App after changes take effect constitutes acceptance of the revised Terms.',
  },
  {
    title: '10. Contact',
    body: 'Questions about these Terms can be directed to support@saanro.app.',
  },
];

export default function TermsScreen({ onBack }: LegalScreenProps) {
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
            <h1 className="text-lg font-bold text-stone-800">Terms of Service</h1>
            <p className="text-xs text-stone-400">Last updated: July 2026</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-6 max-w-md mx-auto space-y-4 pb-8">
        <div className="card p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-saffron-50 flex items-center justify-center flex-shrink-0">
            <FileText size={15} className="text-saffron-500" />
          </div>
          <p className="text-xs text-stone-500 leading-relaxed">
            These Terms of Service govern your use of Saanro. This is placeholder text — replace it with your legally reviewed terms before public release.
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
