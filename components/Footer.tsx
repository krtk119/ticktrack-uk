export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 mt-auto py-8 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-2">
        <p className="font-medium text-slate-300">
          Independent project for the Elanco placement task. Sightings show where ticks were reported, not tick risk.
        </p>
        <p className="text-xs text-slate-500">
          Sighting data from the Elanco placement task API, plus community reports submitted here. Map tiles ©{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-white underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
          >
            OpenStreetMap
          </a>{" "}
          contributors.
        </p>
      </div>
    </footer>
  );
}
