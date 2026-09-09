"""
A spend guard for the Temu scraper.

Residential proxies bill per request or per GB, so a scraper that retries hard
on a page that will never load is the expensive failure mode — not the one that
gives up. This tracks a run's requests and consecutive failures and trips a
breaker, so a bad day costs a handful of requests rather than a month's
allowance.

Everything is per-run and in memory. There is nothing to reset between runs.
"""

import os


class BudgetExceeded(RuntimeError):
    """Raised when a run has used its allowance, or is clearly being blocked."""


class Budget:
    def __init__(
        self,
        max_requests: int | None = None,
        max_consecutive_failures: int | None = None,
    ):
        self.max_requests = max_requests if max_requests is not None else int(
            os.getenv("TEMU_MAX_REQUESTS", "40")
        )
        # Three blocked pages in a row is a wall, not bad luck. Stopping there
        # is the difference between spending three requests and forty.
        self.max_consecutive_failures = (
            max_consecutive_failures
            if max_consecutive_failures is not None
            else int(os.getenv("TEMU_MAX_CONSECUTIVE_FAILURES", "3"))
        )
        self.requests = 0
        self.failures = 0
        self.consecutive_failures = 0

    def check(self) -> None:
        """Call before spending a request."""
        if self.requests >= self.max_requests:
            raise BudgetExceeded(
                f"stopping: used the run's {self.max_requests}-request allowance "
                f"(raise TEMU_MAX_REQUESTS to allow more)"
            )
        if self.consecutive_failures >= self.max_consecutive_failures:
            raise BudgetExceeded(
                f"stopping: {self.consecutive_failures} pages in a row came back "
                f"blocked or empty — something upstream changed, and retrying "
                f"only spends proxy credit"
            )

    def spent(self, ok: bool) -> None:
        self.requests += 1
        if ok:
            self.consecutive_failures = 0
        else:
            self.failures += 1
            self.consecutive_failures += 1

    def summary(self) -> str:
        return (
            f"{self.requests} request(s), {self.failures} failed "
            f"(allowance {self.max_requests})"
        )
