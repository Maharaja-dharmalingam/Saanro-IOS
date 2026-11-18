import { useState } from 'react';
import { ChevronLeft, ChevronDown, ChevronUp, MessageSquare, Mail, BookOpen } from 'lucide-react';

interface HelpSupportScreenProps {
  onBack: () => void;
}

const FAQS = [
  {
    q: 'How do I book a session with a mentor?',
    a: 'Go to the Discover tab, browse mentors, and tap on a mentor card to view their profile. From there you can view available time slots and book a session.',
  },
  {
    q: 'Can I reschedule or cancel a booking?',
    a: 'Yes. Head to the Bookings tab, find the session you want to change, and tap on it for options. Cancellations made 24 hours before the session are fully refunded.',
  },
  {
    q: 'How is the Tamil dialect matching done?',
    a: 'During onboarding you select your Tamil proficiency preference (Formal, Casual, or Both). We match you with mentors who share your dialect style for a more comfortable experience.',
  },
  {
    q: 'How do I become a mentor on Saanro?',
    a: 'You can switch your role to Mentor in your profile settings. You\'ll be asked to provide your industry, expertise, and availability before your profile goes live.',
  },
  {
    q: 'Is my personal data safe?',
    a: 'Yes. We use industry-standard encryption and never sell your data to third parties. You can review our privacy settings or request data deletion at any time.',
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-stone-50 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-stone-50 transition-colors"
      >
        <p className="text-sm font-medium text-stone-700 pr-4">{q}</p>
        {open ? <ChevronUp size={15} className="text-stone-400 flex-shrink-0" /> : <ChevronDown size={15} className="text-stone-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-3.5">
          <p className="text-sm text-stone-500 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function HelpSupportScreen({ onBack }: HelpSupportScreenProps) {
  const [reportText, setReportText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    if (!reportText.trim()) return;
    setSubmitted(true);
    setReportText('');
  }

  return (
    <div className="min-h-screen bg-stone-50 animate-fade-in pb-12">
      <div className="bg-white px-4 pt-12 pb-4 border-b border-stone-100">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-stone-200 bg-white hover:bg-stone-50 active:scale-95 transition-all flex-shrink-0"
          >
            <ChevronLeft size={18} className="text-stone-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-stone-800">Help & Support</h1>
            <p className="text-xs text-stone-400">We're here to help</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-6 max-w-md mx-auto space-y-4">
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-50">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Contact Us</p>
          </div>
          <a
            href="mailto:support@saanro.com"
            className="flex items-center gap-3 px-4 py-3.5 border-b border-stone-50 hover:bg-stone-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Mail size={15} className="text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-700">Email Support</p>
              <p className="text-xs text-stone-400">support@saanro.com</p>
            </div>
          </a>
          <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-stone-50 transition-colors">
            <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
              <MessageSquare size={15} className="text-green-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-700">Live Chat</p>
              <p className="text-xs text-stone-400">Available Mon–Fri, 9am–6pm EST</p>
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-50 flex items-center gap-2">
            <BookOpen size={14} className="text-stone-400" />
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Frequently Asked Questions</p>
          </div>
          {FAQS.map(faq => (
            <FaqItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-semibold text-stone-700 mb-1">Report an Issue</h3>
          <p className="text-xs text-stone-400 mb-3">Describe the problem you're experiencing and we'll look into it.</p>
          {submitted ? (
            <div className="bg-green-50 border border-green-100 rounded-xl p-3">
              <p className="text-green-700 text-sm font-medium">Report submitted. Thank you!</p>
              <p className="text-green-600 text-xs mt-0.5">We'll get back to you within 1–2 business days.</p>
            </div>
          ) : (
            <>
              <textarea
                value={reportText}
                onChange={e => setReportText(e.target.value)}
                rows={4}
                placeholder="Describe what happened..."
                className="input-field resize-none text-sm mb-3"
              />
              <button
                onClick={handleSubmit}
                disabled={!reportText.trim()}
                className="w-full btn-primary py-2.5 text-sm disabled:opacity-40"
              >
                Submit Report
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
