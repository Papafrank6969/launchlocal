"use client";

import { CalendarCheck, MessageCircle, Phone } from "lucide-react";
import { readableTextColor } from "@/lib/contrast";

export function FloatingContactButton({
  bookingUrl,
  phone,
  dmUrl,
  color,
}: {
  bookingUrl?: string | null;
  phone?: string | null;
  dmUrl?: string | null;
  color: string;
}) {
  // Booking is the primary action when it exists — that's the whole point of
  // the button for an appointment-based business.
  const action = bookingUrl
    ? { href: bookingUrl, external: true, label: "Book an appointment", icon: <CalendarCheck size={22} /> }
    : phone
      ? { href: `tel:${phone}`, external: false, label: `Call ${phone}`, icon: <Phone size={22} /> }
      : dmUrl
        ? { href: dmUrl, external: true, label: "Message us on Instagram", icon: <MessageCircle size={22} /> }
        : null;

  if (!action) return null;

  return (
    <a
      href={action.href}
      target={action.external ? "_blank" : undefined}
      rel={action.external ? "noopener noreferrer" : undefined}
      aria-label={action.label}
      className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 print:hidden"
      style={{ backgroundColor: color, color: readableTextColor(color) }}
    >
      {action.icon}
    </a>
  );
}
