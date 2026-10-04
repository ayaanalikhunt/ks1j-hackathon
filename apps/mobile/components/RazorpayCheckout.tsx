import { useMemo } from "react";
import { Linking, Modal, Pressable, Text, View } from "react-native";
import { WebView } from "react-native-webview";

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

const WEB_SCHEMES = ["http:", "https:", "about:", "data:", "blob:"];

/**
 * Razorpay Checkout inside the app. The page below only opens Razorpay's own checkout and reports back; it holds no
 * secret. Whatever it reports is checked again by our server before a donation counts.
 */
export function RazorpayCheckout(p: CheckoutProps) {
  const html = useMemo(() => {
    const opts = JSON.stringify({
      key: p.keyId,
      order_id: p.orderId,
      name: "KS1J",
      description: p.description,
      prefill: p.prefill ?? {},
      theme: { color: "#0b4d3a" },
    }).replace(/</g, "\\u003c");
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://checkout.razorpay.com/v1/checkout.js"></script></head>
<body style="margin:0;background:#fff"><script>
function post(m){window.ReactNativeWebView.postMessage(JSON.stringify(m));}
var o=${opts};
o.handler=function(r){post({type:"success",paymentId:r.razorpay_payment_id,signature:r.razorpay_signature});};
o.modal={ondismiss:function(){post({type:"dismiss"});}};
try{var rz=new Razorpay(o);rz.on("payment.failed",function(r){post({type:"failed",message:(r.error&&r.error.description)||"Payment failed"});});rz.open();}
catch(e){post({type:"failed",message:"Could not open the payment window."});}
</script></body></html>`;
  }, [p.keyId, p.orderId, p.description, p.prefill]);

  return (
    <Modal visible={p.visible} animationType="slide" onRequestClose={p.onDismiss}>
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        <Pressable onPress={p.onDismiss} style={{ padding: 16, paddingTop: 40 }} accessibilityRole="button">
          <Text style={{ fontSize: 16, fontWeight: "600" }}>Close</Text>
        </Pressable>
        <WebView
          originWhitelist={["*"]}
          source={{ html, baseUrl: "https://checkout.razorpay.com" }}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          onMessage={(e) => {
            try {
              const m = JSON.parse(e.nativeEvent.data);
              if (m.type === "success") p.onSuccess({ paymentId: m.paymentId, signature: m.signature });
              else if (m.type === "failed") p.onFail(m.message);
              else p.onDismiss();
            } catch {
              /* ignore unrelated messages */
            }
          }}
          // UPI apps (Google Pay, PhonePe, BHIM...) are opened through their own links.
          onShouldStartLoadWithRequest={(req) => {
            try {
              if (WEB_SCHEMES.includes(new URL(req.url).protocol)) return true;
            } catch {
              /* fall through */
            }
            Linking.openURL(req.url).catch(() => {});
            return false;
          }}
        />
      </View>
    </Modal>
  );
}
