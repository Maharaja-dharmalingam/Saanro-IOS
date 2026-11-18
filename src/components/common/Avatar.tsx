import { getInitials } from '../../lib/utils';

interface AvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES = {
  xs: 'w-7 h-7 text-xs',
  sm: 'w-9 h-9 text-sm',
  md: 'w-12 h-12 text-base',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-24 h-24 text-3xl',
};

export default function Avatar({ name, imageUrl, size = 'md', className = '' }: AvatarProps) {
  const sizeClass = SIZE_CLASSES[size];

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${className}`}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full gradient-saffron flex items-center justify-center flex-shrink-0 font-semibold text-white ${className}`}
    >
      {getInitials(name)}
    </div>
  );
}
