"""
Generate base64url-encoded share-URL hashes for each preset, for the README.

Run with:
    uv run python scripts/build_share_links.py
"""
from __future__ import annotations

import base64
import json
from datetime import date, timedelta


def _yesterday() -> str:
    return (date.today() - timedelta(days=1)).isoformat()


def _build_presets() -> dict[str, dict]:
    end = _yesterday()
    return {
        "Magnificent 7": {
            "strategies": [
                {
                    "name": "Magnificent 7",
                    "tickers": ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"],
                    "weights": "equal",
                    "start_date": "2018-01-02",
                    "end_date": end,
                    "initial_capital": 10000,
                    "rebalance_frequency": "monthly",
                }
            ],
            "benchmark": "SPY",
        },
        "60/40 Classic": {
            "strategies": [
                {
                    "name": "60/40 Portfolio",
                    "tickers": ["VTI", "BND"],
                    "weights": [0.6, 0.4],
                    "start_date": "2010-01-04",
                    "end_date": end,
                    "initial_capital": 10000,
                    "rebalance_frequency": "quarterly",
                }
            ],
            "benchmark": "SPY",
        },
        "Sector Rotation": {
            "strategies": [
                {
                    "name": "Sector Rotation",
                    "tickers": ["XLK", "XLF", "XLE", "XLV", "XLI", "XLP", "XLY", "XLB", "XLU"],
                    "weights": "equal",
                    "start_date": "2015-01-02",
                    "end_date": end,
                    "initial_capital": 10000,
                    "rebalance_frequency": "quarterly",
                }
            ],
            "benchmark": "SPY",
        },
    }


def encode_share_link(requests: list[dict]) -> str:
    payload = {"v": 1, "requests": requests}
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def main() -> None:
    presets = _build_presets()
    print("Share-link hashes (paste after `<demo-url>/#config=` in the README):\n")
    for name, req in presets.items():
        print(f"{name}:")
        print(f"  #config={encode_share_link([req])}\n")


if __name__ == "__main__":
    main()
