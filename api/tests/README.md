# Strata API tests

Run from the repo root:

```
uv run pytest api/tests/ -v
```

These tests are pure-Python — no DB, no network, no FastAPI client. Synthetic prices only.
