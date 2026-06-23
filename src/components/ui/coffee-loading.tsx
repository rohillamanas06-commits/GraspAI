import { Coffee } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CoffeeLoading({ className, text = "Brewing..." }: { className?: string, text?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 text-muted-foreground", className)}>
      <div className="relative">
        {/* Coffee Cup */}
        <div className="animate-cup-bounce">
          <Coffee className="h-12 w-12 text-primary drop-shadow-md" strokeWidth={1.5} />
        </div>
      </div>
      <p className="text-sm font-medium animate-pulse text-foreground/80 tracking-wide mt-2">{text}</p>
    </div>
  );
}
