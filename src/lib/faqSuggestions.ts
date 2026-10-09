export type FaqSuggestion = { question: string; answer: string };
type FaqSuggestionGroup = { categories: string[]; faqs: FaqSuggestion[] };

/**
 * Curated FAQ starting points for niches where clients consistently arrive
 * with the same real questions before booking — timelines, aftercare, pain,
 * touch-ups. Never fabricated claims about a specific business; an operator
 * can edit or remove any of these after adding one. Deliberately scoped to
 * the trades where this actually matters (lash/nail/brow, barbershops,
 * detailers, tattoo shops) rather
 * than a generic catch-all — a vague FAQ suggestion is worse than none.
 */
const FAQ_SUGGESTIONS: FaqSuggestionGroup[] = [
  {
    categories: ["nail technician", "nail salon", "nail tech"],
    faqs: [
      {
        question: "How long does a manicure or pedicure last?",
        answer:
          "Gel polish typically lasts 2-3 weeks without chipping, while regular polish lasts about a week. We'll let you know what to expect for the specific service you book.",
      },
      {
        question: "What's the difference between gel and acrylic nails?",
        answer:
          "Gel is more flexible and looks natural, making it a good choice for shorter-term wear. Acrylic is more durable and better suited for adding length. We're happy to help you pick based on your lifestyle.",
      },
      {
        question: "Do you offer custom nail art?",
        answer:
          "Yes — let us know what you have in mind when booking so we can allow extra time for detailed designs.",
      },
      {
        question: "How should I prepare for my appointment?",
        answer: "Arrive with clean, polish-free nails if possible, and let us know about any allergies or sensitivities beforehand.",
      },
      {
        question: "How far in advance should I book?",
        answer: "We recommend booking a few days ahead, especially for weekends or before holidays and events.",
      },
    ],
  },
  {
    categories: ["lash technician", "lash tech", "eyelash technician", "lash artist"],
    faqs: [
      {
        question: "How long do lash extensions last?",
        answer:
          "Extensions follow your natural lash growth cycle, so most clients come in for a fill every 2-3 weeks to keep a full look as natural lashes shed.",
      },
      {
        question: "Do I need a patch test before my appointment?",
        answer:
          "Yes, if it's your first time with us — a patch test at least 24-48 hours beforehand checks for any sensitivity to the adhesive. Please book this in ahead of your appointment.",
      },
      {
        question: "What's the difference between classic and volume lashes?",
        answer:
          "Classic is one extension applied per natural lash for a more natural look. Volume uses multiple thinner extensions per lash for a fuller, more dramatic effect.",
      },
      {
        question: "How should I care for my lashes after my appointment?",
        answer:
          "Avoid water, steam, and oil-based products for the first 24-48 hours, and gently brush them daily afterward to keep them looking their best.",
      },
      {
        question: "How long does an appointment take?",
        answer: "A first full set usually takes 1.5-2.5 hours. Fills are quicker, typically 45-75 minutes.",
      },
    ],
  },
  {
    categories: ["brow technician", "brow artist", "microblading"],
    faqs: [
      {
        question: "How long does microblading last?",
        answer:
          "Results typically last 1-3 years depending on skin type, sun exposure, and skincare routine, gradually fading over time rather than disappearing all at once.",
      },
      {
        question: "Is microblading painful?",
        answer: "A topical numbing cream is applied beforehand, so most clients describe the sensation as mild discomfort rather than pain.",
      },
      {
        question: "What does the healing process look like?",
        answer:
          "Brows often appear darker and more defined for the first several days — this is normal and fades by up to 40% as healing completes over about 4 weeks. Some flaking or light scabbing is normal; avoid picking at it.",
      },
      {
        question: "Will I need a touch-up?",
        answer: "Yes — a touch-up session 4-6 weeks after your initial appointment fills in any spots where the pigment didn't fully take.",
      },
      {
        question: "How do I care for my brows after the appointment?",
        answer:
          "Avoid makeup on the brow area for at least 10 days, skip heavy exercise or sweating for 7-10 days, and don't pick at any scabbing — that can affect the final result.",
      },
    ],
  },
  {
    categories: ["barber", "barbershop"],
    faqs: [
      {
        question: "Do you take walk-ins or is it appointment only?",
        answer:
          "Let clients know how you run the shop — walk-ins welcome, appointment only, or a mix with walk-ins taken when a chair is open. If wait times are usually short, say so here.",
      },
      {
        question: "Do you cut children's hair?",
        answer:
          "Yes — we cut all ages. Let us know it's a child's first haircut when you book so we can take a little extra time.",
      },
      {
        question: "Do you do beard trims, line-ups, and hot towel shaves?",
        answer:
          "Beard trims and line-ups can be added to any haircut, and we also offer them on their own. Ask about a straight-razor hot towel shave if you'd like the full treatment.",
      },
      {
        question: "How long does a typical haircut take?",
        answer:
          "Most cuts run about 30-45 minutes. Add a bit more time if you're getting a beard service or a more detailed style.",
      },
      {
        question: "How do I explain the cut I want?",
        answer:
          "A photo is the easiest way — bring one if you have it. Otherwise let your barber know how you'd like the sides, the length on top, and how you usually style it, and they'll guide you from there.",
      },
    ],
  },
  {
    categories: ["auto detailing", "car detailing", "mobile detailing", "detailing", "ceramic coating"],
    faqs: [
      {
        question: "How long does a full detail take?",
        answer:
          "Most full details take a few hours, depending on the size and condition of the vehicle. We'll give you a time estimate when you book.",
      },
      {
        question: "Do you come to me?",
        answer:
          "Let clients know whether you're mobile, shop-based, or both, and what you need on site (a driveway, water or power).",
      },
      {
        question: "What's the difference between wax and a ceramic coating?",
        answer:
          "Wax adds shine and protection for a few weeks to a few months. A ceramic coating bonds to the paint and protects it much longer, so it costs more and takes more prep.",
      },
      {
        question: "Can you get out pet hair, stains and smells?",
        answer:
          "Usually, yes. Let us know about pet hair, stains or odors when you book so we can plan the time and products for it.",
      },
      {
        question: "What happens if it rains?",
        answer:
          "Let clients know your weather policy, for example rescheduling outdoor appointments at no charge.",
      },
    ],
  },
  {
    categories: ["tattoo", "tattoo shop", "tattoo artist"],
    faqs: [
      {
        question: "How much will my tattoo cost?",
        answer:
          "Price depends on size, placement and detail. Send your idea and placement and we'll give you a quote before you book.",
      },
      {
        question: "Do you take walk-ins?",
        answer:
          "Let clients know whether you take walk-ins, do flash days, or work by appointment only.",
      },
      {
        question: "Do I need a deposit?",
        answer:
          "Let clients know your deposit policy: how much, how to pay it, and whether it comes off the final price.",
      },
      {
        question: "How old do I have to be?",
        answer: "You must be 18 or older with a valid photo ID.",
      },
      {
        question: "How do I take care of my new tattoo?",
        answer:
          "Keep it clean, follow the aftercare instructions we give you, and stay out of pools and direct sun while it heals. Reach out if you have any questions during healing.",
      },
    ],
  },
];

function findGroup(category: string): FaqSuggestionGroup | undefined {
  const exact = FAQ_SUGGESTIONS.find((g) => g.categories.includes(category));
  if (exact) return exact;
  return FAQ_SUGGESTIONS.find((g) => g.categories.some((c) => category.includes(c)));
}

/** Trade-typical FAQ starting points, exact match before substring — same precedence as deterministicDesignSystem/suggestedServices. Empty when the category isn't one of the covered niches — no generic filler. */
export function suggestedFaqs(category?: string | null): FaqSuggestion[] {
  if (!category) return [];
  const cat = category.toLowerCase().trim();
  if (!cat) return [];
  return findGroup(cat)?.faqs ?? [];
}
