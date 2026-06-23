import { Toaster as Sonner } from "sonner";
import { Coffee } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

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

export { Toaster };
