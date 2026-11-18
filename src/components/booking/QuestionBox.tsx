import { useState, useEffect } from 'react';
import { MessageSquare, Send, CheckCircle2, X } from 'lucide-react';
import { Question } from '../../lib/types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface QuestionBoxProps {
  bookingId: string;
  onClose?: () => void;
}

export default function QuestionBox({ bookingId, onClose }: QuestionBoxProps) {
  const { profile } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function fetchQuestions() {
    const { data } = await supabase
      .from('questions')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true });
    setQuestions(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchQuestions(); }, [bookingId]);

  async function handleSubmit() {
    if (!newQuestion.trim() || !profile) return;
    setSubmitting(true);
    try {
      await supabase.from('questions').insert({
        booking_id: bookingId,
        author_id: profile.id,
        content: newQuestion.trim(),
      });
      setNewQuestion('');
      fetchQuestions();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl max-h-[80vh] flex flex-col modal-content">
        <div className="px-4 pt-4 pb-3 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-saffron-500" />
            <h3 className="font-bold text-stone-800">Question Box</h3>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-stone-50">
              <X size={18} className="text-stone-500" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="h-16 bg-stone-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare size={32} className="text-stone-200 mx-auto mb-2" />
              <p className="text-stone-400 text-sm">No questions yet</p>
              <p className="text-stone-300 text-xs mt-1">Be the first to ask a question</p>
            </div>
          ) : (
            questions.map(q => (
              <div key={q.id} className="animate-fade-in">
                <div className="bg-stone-50 rounded-2xl p-3">
                  <p className="text-stone-700 text-sm">{q.content}</p>
                  {q.is_answered && q.answer && (
                    <div className="mt-2 pt-2 border-t border-stone-200">
                      <div className="flex items-center gap-1 mb-1">
                        <CheckCircle2 size={12} className="text-green-500" />
                        <span className="text-xs font-medium text-green-600">Mentor's Response</span>
                      </div>
                      <p className="text-stone-600 text-sm">{q.answer}</p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-stone-300 mt-1 ml-1">
                  {new Date(q.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-stone-100">
          <div className="flex gap-2">
            <input
              type="text"
              value={newQuestion}
              onChange={e => setNewQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="Ask a question before your session..."
              className="flex-1 input-field py-3 text-sm"
              maxLength={500}
            />
            <button
              onClick={handleSubmit}
              disabled={!newQuestion.trim() || submitting}
              className="p-3 bg-saffron-500 text-white rounded-xl active:scale-95 transition-all disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
