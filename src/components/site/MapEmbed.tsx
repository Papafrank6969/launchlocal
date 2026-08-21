export function MapEmbed({ address, businessName }: { address: string; businessName: string }) {
  const src = `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
  return (
    <div className="site-border mt-8 overflow-hidden rounded-xl border">
      <iframe
        src={src}
        title={`Map showing ${businessName}'s location`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="h-72 w-full"
      />
    </div>
  );
}
