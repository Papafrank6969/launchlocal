import Link from "next/link";

const STEPS = [
  {
    href: "/leads",
    title: "1. Find leads",
    description:
      "Search a city and category to surface local businesses with no website or a weak one (a bare Facebook page, a dead link, etc).",
  },
  {
    href: "/builder",
    title: "2. Build a site",
    description:
      "Turn a lead into a real site in minutes: pick a template, fill in the business details, publish a live preview.",
  },
  {
    href: "/stats",
    title: "3. Track results",
    description:
      "See how many leads you've found, how many sites you've shipped, and how those sites are performing.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
          Find small businesses that need a website. Build them one.
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          LaunchLocal is a lightweight prospecting-to-delivery pipeline: find businesses with no
          website (or a bad one), spin up a real site for them, and keep an eye on how it&apos;s doing.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {STEPS.map((step) => (
          <Link
            key={step.href}
            href={step.href}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <h2 className="font-semibold text-slate-900">{step.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{step.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
