const LAB = "https://www.eliseblasingame.com/lab";

/**
 * The project's own description, in one place.
 *
 * The home page and the dashboard both show this. They had drifted — the home
 * page carried a single trimmed sentence while the dashboard had the full
 * text — so it lives here and each page supplies the wrapper class. The markup
 * is plain h2/h3/p, which both stylesheets already target.
 */
export default function AboutProject({ className }: { className?: string }) {
  return (
    <div className={className}>
      <h2>About this project</h2>
      <p>
        Online Provenance is a free tool built by Anish Thota (Emory University) and Ethan Park
        (Northwestern University) under the guidance of Dr. Elise Blasingame, a professor and
        citizen of the Osage Nation. The project is part of the{" "}
        <a href={LAB} target="_blank" rel="noopener noreferrer">
          𐒻𐒼𐓂 Lab
        </a>{" "}
        (Indigenous Politics Lab) at Emory. It is and will remain completely free — our only goal
        is to make it useful to Native communities.
      </p>
      <p>
        There has been a documented increase in counterfeit &ldquo;Native-made&rdquo; goods on
        platforms like Amazon, Alibaba, and Temu that profit from tribal names, designs, and
        artwork without permission — often in violation of the Indian Arts and Crafts Act. Online
        Provenance monitors these marketplaces for unauthorized use of Tribal seals, flags, and
        designs, documents likely infringements with a confidence score and an on-the-record case
        file, and prepares takedown notices so Tribal Nations can get infringing listings removed.
      </p>
      <h3>Our values</h3>
      <p>
        We understand research as a set of relationships — with communities, data, histories, and
        one another. Our work prioritizes trust, reciprocity, and responsibility over extraction or
        individual credit. We recognize Tribal Nations as sovereign political entities and approach
        this work with humility, consent, and respect for Indigenous governance, law, and
        self-determination. We believe Indigenous data belongs to Indigenous communities, and we
        handle it in alignment with Tribal priorities and the principles of Indigenous data
        governance. These values come from the{" "}
        <a href={LAB} target="_blank" rel="noopener noreferrer">
          𐒻𐒼𐓂 Lab&apos;s statement of values
        </a>
        .
      </p>
    </div>
  );
}
