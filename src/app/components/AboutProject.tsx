"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";

export default function AboutProject() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-xs hover:underline"
        style={{ color: "var(--color-text-muted)", fontWeight: 500 }}
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
        About this project
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div
          className="mt-3 flex flex-col gap-4 rounded-xl p-6 text-sm"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-secondary)",
            lineHeight: 1.65,
          }}
        >
          <h2
            className="text-xl"
            style={{ fontFamily: "var(--font-display)", fontWeight: 500, color: "var(--color-navy)" }}
          >
            About this project
          </h2>
          <p>
            Online Provenance protects the intellectual property, cultural symbols, and
            sovereign rights of federally recognized Native American tribes by identifying and
            reporting unauthorized commercial use of tribal flags, emblems, and protected
            cultural assets on online marketplaces. It maintains a verified database of
            federally recognized tribes, monitors e-commerce sites such as Amazon and Temu for
            potential misuse, trademark violations, and copyright infringements, and
            streamlines documenting and reporting violations to the appropriate tribal
            authorities and legal entities.
          </p>
          <p>
            Through automated monitoring, evidence collection, copyright-registration support,
            and notification workflows, the project helps tribes and government agencies take
            timely action against unauthorized merchandise and counterfeit products. By
            facilitating communication with tribal representatives, state attorneys general, and
            marketplace operators, it helps safeguard tribal identity and ensures intellectual
            property rights are respected across digital commerce.
          </p>

          <h3
            className="text-base"
            style={{ fontFamily: "var(--font-display)", fontWeight: 500, color: "var(--color-navy)" }}
          >
            Call to action
          </h3>
          <p>
            Join us in protecting tribal heritage and intellectual property. Whether you are a
            tribal representative, legal advocate, government agency, or technology partner, your
            participation can help identify violations faster, strengthen enforcement, and
            preserve the integrity of tribal symbols for future generations.
          </p>
        </div>
      )}
    </div>
  );
}
