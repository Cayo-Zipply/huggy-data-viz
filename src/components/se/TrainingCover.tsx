import { useEffect, useState } from 'react';
import { Play, type LucideIcon } from 'lucide-react';

/** Capa 16:9; sem imagem (ou imagem quebrada) vira fundo escuro com ícone de play. */
export function TrainingCover({ src, className = '', icon: Icon = Play, children }: { src: string | null; className?: string; icon?: LucideIcon; children?: React.ReactNode }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  return <div className={`training-cover relative aspect-video overflow-hidden rounded-xl ${className}`}>
    {src && !broken
      ? <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
      : <div className="flex h-full w-full items-center justify-center"><Icon className="h-10 w-10 opacity-60" aria-hidden /></div>}
    {children}
  </div>;
}
