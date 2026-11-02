import React, { useState } from 'react';
import { Utensils } from 'lucide-react';

interface MealImageProps {
  src: string;
  alt: string;
  className?: string;
}

export const MealImage: React.FC<MealImageProps> = ({ src, alt, className = '' }) => {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-slate-100 text-slate-500 p-4 text-center ${className}`}
      >
        <Utensils className="w-7 h-7 text-emerald-600 mb-2" />
        <span className="text-xs font-medium text-slate-700 line-clamp-2">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
