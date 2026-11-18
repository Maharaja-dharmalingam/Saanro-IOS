interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

export default function LoadingSpinner({ size = 'md', fullScreen }: LoadingSpinnerProps) {
  const sizeClass = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' }[size];

  const spinner = (
    <div className={`${sizeClass} rounded-full border-2 border-stone-100 border-t-saffron-500 animate-spin`} />
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-stone-100 border-t-saffron-500 animate-spin" />
          <p className="text-stone-400 text-sm font-medium">Loading Saanro...</p>
        </div>
      </div>
    );
  }

  return spinner;
}
