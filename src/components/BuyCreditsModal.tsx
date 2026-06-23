import { useEffect, useState } from "react";
import { Coins, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface CreditPackage {
  id: string;
  name: string;
  price: number;
  credits: number;
  currency: string;
}

interface BuyCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentCredits: number;
}

const loadRazorpayScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) {
        resolve();
      } else {
        reject(new Error("Razorpay failed to load"));
      }
    };
    script.onerror = () => reject(new Error("Failed to load Razorpay script"));
    document.head.appendChild(script);
  });
};

export function BuyCreditsModal({ isOpen, onClose, onSuccess, currentCredits }: BuyCreditsModalProps) {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingPackage, setProcessingPackage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPackages();
      loadRazorpayScript().catch((error) => {
        console.error("Failed to load Razorpay:", error);
        toast.error("Failed to load payment gateway. Please try again.");
      });
    }
  }, [isOpen]);

  const loadPackages = async () => {
    try {
      setLoading(true);
      const res = await api("/api/credits/packages");
      setPackages(res.packages || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load credit packages");
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (pkg: CreditPackage) => {
    try {
      setProcessingPackage(pkg.id);
      await loadRazorpayScript();

      if (!window.Razorpay) {
        throw new Error("Payment gateway not available");
      }

      // Create payment order
      const orderData = await api("/api/payments/create-order", {
        method: "POST",
        body: { package_id: pkg.id },
      });

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: "INR",
        name: "GraspAI",
        description: `${pkg.credits} Credits`,
        order_id: orderData.order_id,
        handler: async (response: any) => {
          try {
            const verifyRes = await api("/api/payments/verify", {
              method: "POST",
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
            });

            toast.success(`Successfully added ${verifyRes.credits_added} credits!`);
            onSuccess();
            onClose();
          } catch (err: any) {
            toast.error(err.message || "Payment verification failed");
          }
        },
        prefill: {
          email: "",
          contact: "",
        },
        theme: {
          color: "#eab308", // Yellow-500 matching the credits theme
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        toast.error(response.error.description || "Payment failed");
      });
      rzp.open();
    } catch (error: any) {
      toast.error(error.message || "Failed to create payment order");
    } finally {
      setProcessingPackage(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-yellow-500" />
            Buy Credits
          </DialogTitle>
          <DialogDescription>
            You currently have {currentCredits} credit(s). Purchase more to continue using our services.
          </DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-4">
            {packages.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => handlePurchase(pkg)}
                disabled={processingPackage === pkg.id}
                className="p-4 border rounded-lg flex justify-between items-center hover:border-yellow-500 transition-colors cursor-pointer hover:bg-yellow-500/5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="text-left">
                  <h4 className="font-semibold text-lg">{pkg.credits} Credits</h4>
                  <p className="text-sm text-muted-foreground">{pkg.name}</p>
                </div>
                <div className="font-bold text-lg">₹{pkg.price}</div>
              </button>
            ))}
          </div>
        )}
        
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose} disabled={processingPackage !== null}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
