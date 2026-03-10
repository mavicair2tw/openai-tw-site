"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { fetchAlerts, fetchDailyReports, fetchLatestStatements, fetchNarrativeRadar, fetchTimeline } from "../lib/api";
import { DailyReport, MarketAlert, NarrativePoint, TACOEvent } from "../types/taco";

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="bg-slate-900/40 rounded-3xl p-6 border border-slate-800 shadow-2xl shadow-slate-900/40">
    <h2 className="text-xl font-semibold mb-4">{title}</h2>
    {children}
  </section>
);

export default function Home() {
  const [latest, setLatest] = useState<TACOEvent[]>([]);
  const [timeline, setTimeline] = useState<TACOEvent[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [alerts, setAlerts] = useState<MarketAlert[]>([]);
  const [narrative, setNarrative] = useState<NarrativePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [latestResp, timelineResp, reportResp, alertsResp, narrativeResp] = await Promise.all([
          fetchLatestStatements(),
          fetchTimeline(),
          fetchDailyReports(),
          fetchAlerts(),
          fetchNarrativeRadar(),
        ]);
        setLatest(latestResp);
        setTimeline(timelineResp);
        setReports(reportResp);
        setAlerts(alertsResp);
        setNarrative(narrativeResp);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white px-6 py-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="space-y-3">
          <p className="text-sm uppercase text-slate-500 tracking-[0.4em]">Trump TACO Report</p>
          <h1 className="text-4xl font-bold">Ongoing Communication Observation</h1>
          <p className="text-slate-300">Tracking Donald Trump’s public remarks, gauging tone, and highlighting market impact.</p>
        </header>

        {loading && <div className="text-slate-400">Loading latest intelligence...</div>}

        <Section title="Latest Statements">
          <div className="grid gap-4">
            {latest.map((event) => (
              <article key={event.id} className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
                <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">{new Date(event.event_timestamp).toLocaleString()}</div>
                <p className="text-lg font-semibold">{event.quote}</p>
                {event.paraphrase && <p className="text-sm text-slate-400 mt-2">{event.paraphrase}</p>}
                <div className="flex flex-wrap gap-2 mt-3 text-xs">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300">{event.topic || "general"}</span>
                  <span className="px-3 py-1 rounded-full bg-sky-500/20 text-sky-300">{event.tone || "neutral"}</span>
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-200">Market score {event.market_score ?? 0}</span>
                </div>
              </article>
            ))}
          </div>
        </Section>

        <div className="grid lg:grid-cols-2 gap-6">
          <Section title="Daily Report">
            {reports[0] ? (
              <div className="space-y-3">
                <p className="text-slate-400">{new Date(reports[0].report_date).toLocaleDateString()}</p>
                <p>{reports[0].summary}</p>
                <ul className="list-disc list-inside text-sm text-slate-200 space-y-1">
                  {reports[0].highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-slate-500">No report generated yet.</p>
            )}
          </Section>

          <Section title="Market Alerts">
            <div className="space-y-3">
              {alerts.length ? (
                alerts.map((alert) => (
                  <article key={alert.id} className="rounded-2xl bg-slate-900 border border-rose-500/40 p-3">
                    <p className="text-sm text-rose-200">Score {alert.market_score}</p>
                    <p>{alert.quote}</p>
                  </article>
                ))
              ) : (
                <p className="text-slate-500">No high-impact market alerts right now.</p>
              )}
            </div>
          </Section>
        </div>

        <Section title="Quote Timeline">
          <div className="space-y-2">
            {timeline.map((event) => (
              <div key={event.id} className="rounded-xl bg-slate-900 border border-slate-800 p-4">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{new Date(event.event_timestamp).toLocaleString()}</span>
                  <span>{event.source}</span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{event.quote}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Narrative Radar">
          <div className="grid md:grid-cols-2 gap-4">
            {narrative.map((point) => (
              <div key={point.topic} className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
                <h3 className="font-semibold">{point.topic}</h3>
                <div className="text-sm text-slate-400">Today: {point.today_weight}</div>
                <div className="text-sm text-slate-400">Week: {point.weekly_weight}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </main>
  );
}
