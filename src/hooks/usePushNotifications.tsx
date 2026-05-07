import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  firebaseEnabled,
  getFirebaseMessaging,
  getToken,
  onMessage,
  VAPID_KEY,
} from "@/lib/firebase";

/**
 * Solicita permissão, registra service worker, captura token FCM e
 * persiste no Supabase. Também escuta mensagens em foreground.
 */
export function usePushNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !firebaseEnabled) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;

    let unsub: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        // Pede permissão (silenciosamente — só mostra toast se negado pelo usuário ativamente)
        let permission = Notification.permission;
        if (permission === "default") {
          permission = await Notification.requestPermission();
        }
        if (permission !== "granted") return;

        const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        const messaging = getFirebaseMessaging();
        if (!messaging) return;

        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: reg,
        });
        if (!token || cancelled) return;

        // Upsert do token no banco
        await supabase.from("device_tokens").upsert(
          {
            user_id: user.id,
            token,
            platform: "web",
            user_agent: navigator.userAgent,
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: "token" },
        );

        // Mensagens em foreground
        unsub = onMessage(messaging, (payload) => {
          const title = payload.notification?.title || payload.data?.title || "Nova notificação";
          const body = payload.notification?.body || payload.data?.body || "";
          toast(title, { description: body });
        });
      } catch (err) {
        // Silencioso — falhas comuns: bloqueio de SW, navegador sem suporte, etc.
        console.warn("[push] init falhou:", err);
      }
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [user]);
}
