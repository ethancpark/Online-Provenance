/**
 * Password rules, shown live rather than enforced by ambush after submitting.
 *
 * Length and a check against the obvious, not composition rules — NIST dropped
 * the "one uppercase, one symbol" advice years ago because it produces
 * predictable passwords people cannot remember. A long phrase is stronger and
 * easier, and the copy says so.
 */
export const MIN_LENGTH = 12;

export type Rule = { label: string; met: boolean };

export function passwordRules(password: string, email: string): Rule[] {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  const lower = password.toLowerCase();
  const distinct = new Set(password).size;

  return [
    { label: `At least ${MIN_LENGTH} characters`, met: password.length >= MIN_LENGTH },
    {
      label: "Not your email address or name in the address",
      met: password.length > 0 && !(local.length >= 3 && lower.includes(local)),
    },
    {
      label: "More than one repeated character",
      met: password.length > 0 && distinct >= 4,
    },
  ];
}

/** The first unmet rule, or null when the password is acceptable. */
export function firstProblem(password: string, email: string): string | null {
  return passwordRules(password, email).find((r) => !r.met)?.label ?? null;
}
