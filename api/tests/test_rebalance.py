from datetime import date

import pandas as pd

from api.engine.rebalance import generate_rebalance_dates


def _bdays(start: str, end: str) -> list[date]:
    return [d.date() for d in pd.bdate_range(start, end)]


def test_none_returns_empty_list():
    cal = _bdays("2020-01-01", "2020-12-31")
    assert generate_rebalance_dates(date(2020, 1, 1), date(2020, 12, 31), "none", cal) == []


def test_monthly_excludes_start():
    cal = _bdays("2020-01-01", "2020-12-31")
    rds = generate_rebalance_dates(date(2020, 1, 2), date(2020, 12, 31), "monthly", cal)
    # Jan 2 is start; first monthly rebalance is Feb 3 (Mon, since Feb 1-2 are weekend)
    assert rds[0] == date(2020, 2, 3)
    # Should be 11 monthly rebalances Feb..Dec
    assert len(rds) == 11
    assert all(d > date(2020, 1, 2) for d in rds)


def test_quarterly_count():
    cal = _bdays("2020-01-01", "2020-12-31")
    rds = generate_rebalance_dates(date(2020, 1, 2), date(2020, 12, 31), "quarterly", cal)
    # Quarters Q2, Q3, Q4 (Q1 contains start) → 3 rebalances
    assert len(rds) == 3
    assert rds[0] == date(2020, 4, 1)


def test_yearly_count():
    cal = _bdays("2018-01-01", "2020-12-31")
    rds = generate_rebalance_dates(date(2018, 1, 2), date(2020, 12, 31), "yearly", cal)
    # 2019, 2020 → 2 rebalances. pd.bdate_range is weekday-only (no holidays),
    # so Jan 1 of each year IS in the calendar when it lands on a weekday.
    assert len(rds) == 2
    assert rds[0] == date(2019, 1, 1)  # Tue
    assert rds[1] == date(2020, 1, 1)  # Wed


def test_first_rebalance_after_start_only():
    cal = _bdays("2020-01-01", "2020-06-30")
    # start exactly on a calendar date: that date must NOT be a rebalance
    rds = generate_rebalance_dates(date(2020, 2, 3), date(2020, 6, 30), "monthly", cal)
    assert date(2020, 2, 3) not in rds
    assert rds[0] > date(2020, 2, 3)
