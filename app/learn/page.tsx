import type { Metadata } from "next";
import { Footprints, Shirt, SprayCan, Search, Stethoscope, Dog, Info, ExternalLink } from "lucide-react";
import { SpeciesGuide } from "@/components/Learn/SpeciesGuide";
import { SeasonalChart } from "@/components/Learn/SeasonalChart";
import { IdentifyHelper } from "@/components/Learn/IdentifyHelper";

export const metadata: Metadata = {
  title: "Learn about ticks – TickTrack UK",
  description: "Tick species in the TickTrack dataset, seasonal activity, and how to prevent and deal with tick bites.",
};

// Guidance below is summarised from the NHS and UKHSA pages linked under "Sources".
const PREVENTION_TIPS = [
  { Icon: Footprints, title: "Stick to paths", text: "Walk on clear paths and avoid brushing through long grass and vegetation." },
  { Icon: Shirt, title: "Cover up", text: "Wear long sleeves and long trousers tucked into socks. Light colours make ticks easier to spot." },
  { Icon: SprayCan, title: "Use repellent", text: "Insect repellent on skin and clothing helps. DEET-based products work best; follow the instructions." },
  { Icon: Search, title: "Check after being outdoors", text: "Check your whole body, especially armpits, groin, behind the knees, waistband and hairline. Check children's heads and necks." },
];

const REMOVAL_STEPS = [
  "Use fine-tipped tweezers or a tick removal tool.",
  "Grip the tick as close to the skin as you can.",
  "Pull upwards slowly and firmly, without squeezing or crushing the tick.",
  "Clean the bite with antiseptic, or soap and water.",
];

const SOURCES = [
  { label: "NHS – Lyme disease (preventing and removing tick bites)", href: "https://www.nhs.uk/conditions/Lyme-disease/" },
  { label: "UKHSA – What are ticks and how can you avoid being bitten?", href: "https://ukhsa.blog.gov.uk/2026/06/30/what-are-ticks-and-how-can-you-avoid-being-bitten/" },
  { label: "UKHSA – Tick species profiles", href: "https://www.gov.uk/guidance/tick-species-profiles" },
  { label: "GOV.UK – Tick recording scheme", href: "https://www.gov.uk/tick-recording-scheme" },
];

function SectionHeading({ id, title, children }: { id: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <h2 id={id} className="text-xl font-extrabold text-slate-900">{title}</h2>
      {children && <p className="text-sm text-slate-600 max-w-3xl">{children}</p>}
    </div>
  );
}

export default function LearnPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Learn about ticks</h1>
        <p className="text-slate-600 max-w-3xl">
          The species in this app, when ticks are active, and how to protect yourself and your pets. Health guidance here
          is a short summary of NHS and UKHSA advice. It isn&apos;t medical or veterinary advice.
        </p>
      </header>

      <section aria-labelledby="species-heading" className="space-y-4">
        <SectionHeading id="species-heading" title="Identify a tick">
          Where a tick was found is the best clue to which species it might be. Start here, then compare the species below.
        </SectionHeading>
        <div id="identify" className="scroll-mt-24">
          <IdentifyHelper />
        </div>
        <h3 className="text-lg font-bold text-slate-900 pt-2">The five species in this dataset</h3>
        <SpeciesGuide />
        <div className="flex gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
          <Info className="w-5 h-5 shrink-0 text-sky-700" aria-hidden="true" />
          <div className="space-y-1">
            <p>
              <strong>Worth knowing:</strong> the tick people and pets in the UK most often encounter, <em>Ixodes ricinus</em>{" "}
              (the sheep or deer tick), isn&apos;t one of the species in this dataset.
            </p>
            <p>
              Latin names are shown exactly as the data source provides them. The passerine tick is more commonly listed as{" "}
              <em>Ixodes frontalis</em>; we display the source&apos;s value rather than silently changing it.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="seasonal-heading" className="space-y-4">
        <SectionHeading id="seasonal-heading" title="Seasonal activity">
          How sightings are spread across the months of the year, for all cities or one city.
        </SectionHeading>
        <SeasonalChart />
      </section>

      <section aria-labelledby="prevention-heading" className="space-y-4">
        <SectionHeading id="prevention-heading" title="Preventing tick bites">
          Ticks live in woodland, grassland, moorland, parks and gardens, especially where there are deer or livestock.
        </SectionHeading>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PREVENTION_TIPS.map(({ Icon, title, text }) => (
            <li key={title} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
              <Icon className="w-6 h-6 text-emerald-700" aria-hidden="true" />
              <h3 className="font-bold text-slate-900">{title}</h3>
              <p className="text-sm text-slate-600">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="removal-heading" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
          <h2 id="removal-heading" className="text-lg font-extrabold text-slate-900">If you find a tick on you</h2>
          <p className="text-sm text-slate-600">Remove it as soon as possible. The longer it stays attached, the higher the risk.</p>
          <ol className="list-decimal pl-5 space-y-1.5 text-sm text-slate-700">
            {REMOVAL_STEPS.map((step) => <li key={step}>{step}</li>)}
          </ol>
          <div className="flex gap-3 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-950">
            <Stethoscope className="w-5 h-5 shrink-0 text-amber-700" aria-hidden="true" />
            <p>
              Contact your GP or NHS 111 if, within 3 months of a tick bite or visiting a tick area, you feel unwell with
              flu-like symptoms or notice a round or oval rash.
            </p>
          </div>
        </section>

        <section aria-labelledby="pets-heading" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
          <h2 id="pets-heading" className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Dog className="w-5 h-5 text-emerald-700" aria-hidden="true" />
            Found a tick on your pet?
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-700">
            <li>Check your pet after walks, especially around the head, ears, neck and feet.</li>
            <li>Remove ticks promptly with a tick removal tool, without squeezing the tick&apos;s body.</li>
            <li>Keep an eye on your pet afterwards for any change in behaviour or health.</li>
          </ul>
          <p className="text-sm font-semibold text-slate-900">
            Speak to your vet about tick prevention, or straight away if your pet seems unwell.
          </p>
          <p className="text-xs text-slate-500">
            You can also send ticks you find to UKHSA&apos;s tick recording scheme, which helps track where ticks are in the UK.
          </p>
        </section>
      </div>

      <section aria-labelledby="sources-heading" className="space-y-2">
        <h2 id="sources-heading" className="text-sm font-bold uppercase tracking-wider text-slate-500">Sources</h2>
        <ul className="space-y-1 text-sm">
          {SOURCES.map((s) => (
            <li key={s.href}>
              <a
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-800 underline underline-offset-2 hover:text-emerald-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded"
              >
                {s.label}
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
