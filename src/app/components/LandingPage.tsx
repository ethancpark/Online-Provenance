"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-6 py-16">
        {/* Hero Section */}
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight mb-4">
            Indigenous Scraper
          </h1>
          <p className="text-xl text-zinc-400 mb-8">
            Infringement Monitor for Tribal Intellectual Property
          </p>
          <div className="inline-block rounded-lg bg-emerald-900/40 px-4 py-2 text-emerald-300 text-sm font-medium mb-12">
            Research Prototype — Auto-updated Daily
          </div>
        </div>

        {/* What is this? */}
        <section className="mb-12 bg-zinc-900 rounded-lg border border-zinc-800 p-8">
          <h2 className="text-2xl font-semibold mb-4">What is this?</h2>
          <p className="text-zinc-300 leading-relaxed mb-4">
            Indigenous Scraper is an automated monitoring system that surfaces unauthorized
            merchandise reproducing federally recognized tribes' seals and flags on e-commerce
            platforms like Amazon and Temu.
          </p>
          <p className="text-zinc-300 leading-relaxed">
            This tool helps protect tribal intellectual property rights by identifying potential
            infringements and streamlining the process of reporting violations to platform holders.
          </p>
        </section>

        {/* How it Works */}
        <section className="mb-12 bg-zinc-900 rounded-lg border border-zinc-800 p-8">
          <h2 className="text-2xl font-semibold mb-4">How it Works</h2>
          <ol className="space-y-4 text-zinc-300">
            <li className="flex gap-4">
              <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-sky-900/40 text-sky-300 font-semibold">
                1
              </span>
              <div>
                <strong className="text-zinc-100">Automated Scraping</strong>
                <p className="text-sm mt-1">
                  Daily scans of major e-commerce platforms for products matching tribal seals and flags
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-sky-900/40 text-sky-300 font-semibold">
                2
              </span>
              <div>
                <strong className="text-zinc-100">AI-Powered Matching</strong>
                <p className="text-sm mt-1">
                  Advanced image recognition to identify potential unauthorized use of tribal intellectual property
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-sky-900/40 text-sky-300 font-semibold">
                3
              </span>
              <div>
                <strong className="text-zinc-100">Review Queue</strong>
                <p className="text-sm mt-1">
                  Human-reviewed flagged listings with confidence scores and visual comparisons
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-sky-900/40 text-sky-300 font-semibold">
                4
              </span>
              <div>
                <strong className="text-zinc-100">Draft Reports</strong>
                <p className="text-sm mt-1">
                  Auto-generated infringement reports queued for review before submission
                </p>
              </div>
            </li>
          </ol>
        </section>

        {/* Key Features */}
        <section className="mb-12 bg-zinc-900 rounded-lg border border-zinc-800 p-8">
          <h2 className="text-2xl font-semibold mb-4">Key Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-md bg-zinc-800/50 border border-zinc-700">
              <h3 className="font-semibold text-zinc-100 mb-2">Multi-Platform Monitoring</h3>
              <p className="text-sm text-zinc-400">
                Tracks listings across Amazon, Temu, and other major e-commerce platforms
              </p>
            </div>
            <div className="p-4 rounded-md bg-zinc-800/50 border border-zinc-700">
              <h3 className="font-semibold text-zinc-100 mb-2">USPTO Integration</h3>
              <p className="text-sm text-zinc-400">
                Links to official trademark registrations for tribes with registered marks
              </p>
            </div>
            <div className="p-4 rounded-md bg-zinc-800/50 border border-zinc-700">
              <h3 className="font-semibold text-zinc-100 mb-2">Confidence Scoring</h3>
              <p className="text-sm text-zinc-400">
                AI-powered similarity analysis to prioritize the most likely infringements
              </p>
            </div>
            <div className="p-4 rounded-md bg-zinc-800/50 border border-zinc-700">
              <h3 className="font-semibold text-zinc-100 mb-2">Safe by Default</h3>
              <p className="text-sm text-zinc-400">
                All reports require human review — nothing files automatically
              </p>
            </div>
          </div>
        </section>

        {/* Get Started */}
        <section className="text-center mb-12">
          <Link
            href="/dashboard"
            className="inline-block bg-sky-600 hover:bg-sky-500 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
          >
            View Dashboard
          </Link>
          <p className="mt-4 text-sm text-zinc-500">
            Monitor infringements for federally recognized tribes
          </p>
        </section>

        {/* Footer */}
        <footer className="text-center text-xs text-zinc-500 pt-8 border-t border-zinc-800">
          <p>
            Indigenous Scraper — Research prototype for tribal intellectual property protection
          </p>
        </footer>
      </div>
    </div>
  );
}
