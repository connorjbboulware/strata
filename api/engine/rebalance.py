from datetime import date
from typing import Iterable, List, Literal

import pandas as pd

Frequency = Literal["none", "monthly", "quarterly", "yearly"]


def generate_rebalance_dates(
    start: date,
    end: date,
    frequency: Frequency,
    calendar_dates: Iterable[date],
) -> List[date]:
    """
    First trading day on or after each scheduled period boundary in [start, end].
    Excludes `start` itself (no rebalance on day zero).
    """
    if frequency == "none":
        return []

    cal = sorted({d for d in calendar_dates if start <= d <= end})
    if not cal:
        return []

    period_alias = {"monthly": "M", "quarterly": "Q", "yearly": "Y"}.get(frequency)
    if period_alias is None:
        return []

    ts = pd.DatetimeIndex(pd.to_datetime(cal))
    periods = ts.to_period(period_alias)
    df = pd.DataFrame({"date": ts, "p": periods})
    firsts = df.groupby("p", sort=True)["date"].min()

    return [d.date() for d in firsts if d.date() > start]
