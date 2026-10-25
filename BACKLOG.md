# Orion Quant Lab backlog

## Next
- Add transaction-cost sensitivity that varies fees and slippage independently.

## Later
- Additional strategies and Strategy Arena using the priorities and readiness rules in
  `STRATEGY_ROADMAP.md`; scheduled strategy work should read it first.
- Evaluate a supported market-data provider if the unofficial endpoint becomes unreliable.
- Server-side API, shared persistence, and optional React interface if needed.
- Walk-forward validation, then advanced research.
- Add a second asset only after its data quality and adjustment basis are documented.

## Completed
- Explicit fixed slippage assumption modeled through adverse buy and sell execution
  prices, reported separately from proportional transaction fees.
- Transaction-cost sensitivity across a small disclosed set of assumptions, rerunning
  one fixed configuration without ranking or selecting a winner.
- Guarded lookback comparison ranked by training return only, with disclosed search
  breadth and untouched test results.
- Expanding walk-forward validation with non-overlapping out-of-sample folds and
  compounded strategy-versus-benchmark test returns.
- Fixed train/test separation with continuous portfolio state, independent period
  metrics, and an explicit out-of-sample test result.
- `/quant/` landing page and `/quant/lab/` research workspace.
- Historical SPY snapshot, CSV import, configurable momentum and buy-and-hold.
- Moving-average trend filter with delayed signals, the same fees and benchmark,
  and hand-checked timing/fee tests.
- Separate Black–Scholes–Merton European options calculator with Greeks,
  hypothetical spot scenarios, and numerical validation tests.
- Delayed signal execution, transaction costs, benchmark, metrics, chart, trades.
- Browser-local experiments, self-contained JSON and equity CSV export.
- Validated JSON experiment import with recomputed results and side-by-side comparison
  for up to three archived runs.
- Calculation tests, methodology and first learning note.

- Daily API refresh, completed-session filtering, dataset hashes and freshness UI.
- Annualized return and strategy-versus-benchmark drawdown chart.

- Standalone Orion Quant Lab repository, preview, CI checks, and a pinned portfolio integration.
- Public research field guide with purpose, implemented-versus-planned record, workflow, architecture, and explicit backtest limitations.
