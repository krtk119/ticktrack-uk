import type { Metadata } from "next";
import { ReportForm } from "@/components/Report/ReportForm";

export const metadata: Metadata = {
  title: "Report a sighting – TickTrack UK",
  description: "Report a tick sighting in one of 14 UK cities.",
};

export default function ReportPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Report a tick sighting</h1>
        <p className="text-slate-600">
          Seen a tick? Add it to the map so others in your area know. Fields marked{" "}
          <span className="text-red-700" aria-hidden="true">*</span>
          <span className="sr-only">with an asterisk</span> are required.
        </p>
      </header>
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
        <ReportForm />
      </div>
    </div>
  );
}
