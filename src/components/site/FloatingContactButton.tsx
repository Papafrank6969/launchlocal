"use client";

import { MessageCircle, Phone } from "lucide-react";

export function FloatingContactButton({
  phone,
  dmUrl,
  color,
}: {
  phone?: string | null;
  dmUrl?: string | null;
  color: string;
}) {
  const href = phone ? `tel:${phone}` : dmUrl;
  if (!href) return null;

  return (
    <a
      href={href}
      target={phone ? undefined : "_blank"}
      rel={phone ? undefined : "noopener noreferrer"}
      aria-label={phone ? `Call ${phone}` : "Message us on Instagram"}
      className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 print:hidden"
      style={{ backgroundColor: color }}
    >
      {phone ? <Phone size={22} /> : <MessageCircle size={22} />}
    </a>
  );
}
