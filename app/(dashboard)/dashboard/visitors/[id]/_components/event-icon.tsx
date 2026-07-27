import {
  Eye,
  FileText,
  ShoppingCart,
  CreditCard,
  CheckCircle2,
  UserPlus,
  MousePointerClick,
  ScrollText,
  Clock,
  Zap,
  Circle,
  type LucideIcon,
} from "lucide-react";

const EVENT_ICONS: Record<string, LucideIcon> = {
  PageView: Eye,
  ViewContent: FileText,
  AddToCart: ShoppingCart,
  InitiateCheckout: CreditCard,
  Purchase: CheckCircle2,
  Lead: UserPlus,
  PageDuration: Clock,
  DiagnosticPing: Zap,
};

export function getEventIcon(eventName: string): LucideIcon {
  if (EVENT_ICONS[eventName]) return EVENT_ICONS[eventName];
  if (eventName.startsWith("Scroll")) return ScrollText;
  if (eventName.toLowerCase().includes("click")) return MousePointerClick;
  return Circle;
}
