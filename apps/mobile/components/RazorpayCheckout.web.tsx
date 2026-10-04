import { useEffect, useRef } from "react";

export interface CheckoutProps {
  visible: boolean;
  keyId: string;
  orderId: string;
  description: string;
  prefill?: { name?: string; email?: string };
  onSuccess: (r: { paymentId: string; signature: string }) => void;
  onFail: (message: string) => void;
  onDismiss: () => void;
}

function load(): Promise<boolean> {
  return new Promise((ok) => {
    const w = window as any;
    if (w.Razorpay) return ok(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => ok(true);
    s.onerror = () => ok(false);
    document.body.appendChild(s);
  });
}

/** The web build of the app opens Razorpay's own checkout window directly. */
export function RazorpayCheckout(p: CheckoutProps) {
  const latest = useRef(p);
  latest.current = p;
  useEffect(() => {
    if (!p.visible) return;
    let live = true;
    load().then((ok) => {
      if (!live) return;
      if (!ok) return latest.current.onFail("Could not load the payment window.");
      const cur = latest.current;
      const rz = new (window as any).Razorpay({
        key: cur.keyId,
        order_id: cur.orderId,
        name: "KS1J",
        description: cur.description,
        prefill: cur.prefill ?? {},
        theme: { color: "#0b4d3a" },
        handler: (r: any) => latest.current.onSuccess({ paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }),
        modal: { ondismiss: () => latest.current.onDismiss() },
      });
      rz.on("payment.failed", (r: any) => latest.current.onFail(r?.error?.description ?? "Payment failed"));
      rz.open();
    });
    return () => {
      live = false;
    };
  }, [p.visible, p.orderId]);
  return null;
}
