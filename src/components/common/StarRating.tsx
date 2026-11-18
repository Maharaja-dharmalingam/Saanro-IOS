import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  totalSessions?: number;
  size?: 'sm' | 'md';
}

export default function StarRating({ rating, totalSessions, size = 'sm' }: StarRatingProps) {
  const iconSize = size === 'sm' ? 12 : 16;
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className="flex items-center gap-1">
      <Star size={iconSize} className="text-amber-400 fill-amber-400" />
      <span className={`${textSize} font-semibold text-stone-700`}>{rating.toFixed(1)}</span>
      {totalSessions !== undefined && (
        <span className={`${textSize} text-stone-400`}>({totalSessions})</span>
      )}
    </div>
  );
}
