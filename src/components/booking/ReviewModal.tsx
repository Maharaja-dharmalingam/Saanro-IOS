import React, { useState } from 'react';
import { Star, X, MessageSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: any;
  onSuccess: () => void;
}

export default function ReviewModal({ isOpen, onClose, booking, onSuccess }: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !booking) return null;

  const handleSubmit = async () => {
    if (rating === 0) {
      alert('Please select a rating');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('reviews')
        .insert({
          booking_id: booking.id,
          mentor_id: booking.mentor_id,
          mentee_id: booking.mentee_id,
          rating,
          comment,
        });

      if (error) throw error;

      alert('Thank you for your review!');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error submitting review:', error);
      alert('Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-stone-100 flex items-center justify-between">
          <h3 className="text-xl font-bold text-stone-800">Rate your Session</h3>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
            <X size={20} className="text-stone-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center">
            <p className="text-stone-500 mb-4">How was your experience with {booking.mentor?.profile?.full_name}?</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onMouseEnter={() => setHover(star)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(star)}
                  className="transition-transform active:scale-90"
                >
                  <Star
                    size={32}
                    className={`${
                      star <= (hover || rating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-stone-200'
                    } transition-colors`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-stone-700 flex items-center gap-2">
              <MessageSquare size={16} />
              Share your feedback (optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you learn? How did the mentor help you?"
              className="w-full h-32 px-4 py-3 rounded-2xl border border-stone-200 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none text-stone-600 transition-all"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
            className={`w-full py-4 rounded-2xl font-bold text-white transition-all ${
              submitting || rating === 0
                ? 'bg-stone-300 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-100'
            }`}
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
}