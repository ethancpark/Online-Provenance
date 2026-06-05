"use client";

import { useState } from "react";

export default function AboutProject() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-800"
      >
        About This Project
        <span className="text-xs text-zinc-500">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-4 rounded-md border border-zinc-800 bg-zinc-900/60 p-4 text-sm leading-relaxed text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-100">
            About This Project
          </h2>
          <p>
            This initiative is focused on protecting the intellectual property,
            cultural symbols, and sovereign rights of federally recognized Native
            American tribes by identifying and reporting unauthorized commercial use
            of tribal flags, emblems, and protected cultural assets on online
            marketplaces. The platform will maintain a verified database of federally
            recognized tribes, monitor e-commerce sites such as Amazon and Alibaba
            for potential misuse, trademark violations, and copyright infringements,
            and streamline the process of documenting and reporting violations to the
            appropriate tribal authorities and legal entities.
          </p>
          <p>
            Through automated monitoring, evidence collection, copyright registration
            support, and notification workflows, the project aims to empower tribes
            and government agencies to take timely action against unauthorized
            merchandise and counterfeit products. By facilitating communication with
            tribal representatives, state Attorneys General, and marketplace
            operators, the solution helps safeguard tribal identity and ensures that
            intellectual property rights are respected across digital commerce
            platforms.
          </p>

          <h2 className="text-base font-semibold text-zinc-100">Call to Action</h2>
          <p>
            Join us in protecting tribal heritage and intellectual property. Whether
            you are a tribal representative, legal advocate, government agency, or
            technology partner, your participation can help identify violations
            faster, strengthen enforcement efforts, and preserve the integrity of
            tribal symbols for future generations.
          </p>
        </div>
      )}
    </div>
  );
}
