import { Toaster as Sonner, toast as sonnerToast } from "sonner";
import { Coffee } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const playPop = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {
    // Ignore audio context errors
  }
};

const customToast = ((...args: any[]) => {
  playPop();
  return (sonnerToast as any)(...args);
}) as typeof sonnerToast;

Object.keys(sonnerToast).forEach(key => {
  if (typeof (sonnerToast as any)[key] === 'function') {
    (customToast as any)[key] = (...args: any[]) => {
      if (['success', 'error', 'info', 'warning', 'message'].includes(key)) playPop();
      return (sonnerToast as any)[key](...args);
    }
  } else {
    (customToast as any)[key] = (sonnerToast as any)[key];
  }
});

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#3e2723] group-[.toaster]:text-[#efebe9] group-[.toaster]:border-[#5d4037] group-[.toaster]:shadow-xl",
          description: "group-[.toast]:text-[#d7ccc8]",
          actionButton: "group-[.toast]:bg-[#8d6e63] group-[.toast]:text-[#efebe9]",
          cancelButton: "group-[.toast]:bg-[#5d4037] group-[.toast]:text-[#d7ccc8]",
        },
      }}
      icons={{
        success: <Coffee className="h-5 w-5 text-[#d7ccc8]" />,
        error: <Coffee className="h-5 w-5 text-[#ff8a65]" />,
        info: <Coffee className="h-5 w-5 text-[#8d6e63]" />,
        warning: <Coffee className="h-5 w-5 text-[#ffb74d]" />,
      }}
      {...props}
    />
  );
};

export { Toaster, customToast as toast };
