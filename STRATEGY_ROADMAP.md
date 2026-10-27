# Strategy research roadmap

Scheduled work should read this file before choosing or specifying any strategy
change. It turns the broad “additional strategies” backlog item into bounded,
testable increments while preserving the assumptions in `ARCHITECTURE.md`.

## Current boundary

The lab currently has one daily adjusted-close series, one asset at a time, and a
long-or-cash engine. A signal may use data through the prior close and executes at
the current close. New strategies must retain that timing rule, apply transaction
costs to every position change, and compare against buy-and-hold on the same series.

Do not describe a pricing model, indicator, or risk overlay as a profitable strategy
without defining a complete entry, exit, sizing, and cost model. Do not add a
strategy until its rule can be calculated by hand on a small fixture.

## Priority 1: close-only strategies

These fit the current dataset and engine. Add only one per pull request or scheduled
task increment.

### Simple moving-average trend filter — implemented

- **Rule:** at close `t`, own the asset when `close[t-1]` is above the simple average
  ending at `t-1`; otherwise hold cash. Execute any change at `close[t]`.
- **Parameter:** integer lookback, initially 2–252 observations.
- **Why first:** it adds a different trend definition without new data or sizing
  machinery. Faber describes a related monthly moving-average timing model.
- **Validation:** warmup boundary, equality behavior, delayed execution, fees on
  a crossover, and proof that future prices cannot change earlier positions.

### Dual moving-average crossover

- **Rule:** own the asset when the short average through `t-1` is above the long
  average through `t-1`; otherwise hold cash. Execute at `close[t]`.
- **Parameters:** integer short and long windows with `short < long <= 252`.
- **Required tests:** invalid ordering, crossover timing, equality behavior, warmup,
  costs, and lookahead prevention.
- **Dependency:** implement after the single-average version so shared rolling-average
  code is already independently tested.

### Close-channel breakout — implemented

- **Rule:** enter when the prior close exceeds the highest earlier close in an entry
  window; exit when it falls below the lowest earlier close in a shorter exit window.
  The position persists between thresholds.
- **Parameters:** entry and exit windows, with explicit equality behavior.
- **Required tests:** state persistence, entry and exit warmups, delayed fills,
  repeated threshold touches, fees, and lookahead prevention.
- **Caveat:** call this a close-channel breakout, not a Donchian high/low breakout;
  the current dataset has no intraday high or low.

## Priority 2: risk overlays and research controls

Implement these only after train/test separation is available. They affect exposure
or evaluation rather than supplying a standalone directional signal.

### Long-or-cash volatility targeting

- Estimate trailing realized volatility only from returns known by `t-1`.
- Convert a target volatility into exposure clamped to `[0, 1]`; do not add leverage.
- Charge costs on the notional change whenever exposure is rebalanced.
- Report average exposure and turnover alongside the existing metrics.
- Treat this as an overlay, not evidence of superior returns. Moreira and Muir study
  volatility-managed portfolios, but Orion's no-leverage, single-asset version would
  be deliberately narrower.

### Parameter comparison

- Add train/test separation before any grid search or ranking.
- Display the number of tried configurations and keep the untouched test period
  visually distinct.
- Never select a parameter on the observations used for its headline result.
- Prefer walk-forward evaluation only after a fixed split is tested and usable.

## Priority 3: multi-asset research

Relative momentum, defensive rotation, risk parity, pairs trading, and portfolio
rebalancing require at least a second validated asset plus synchronized calendars,
documented adjustment bases, missing-data rules, and per-asset transaction costs. Do
not approximate these with duplicated SPY data or silently forward-fill prices.

Before the first multi-asset strategy, land the data model and validation separately.
Then add one simple equal-weight or relative-momentum experiment with an explicit
cash rule and benchmark.

## Black–Scholes has a separate options module

“Black shoals” usually refers to **Black–Scholes**, more fully the
Black–Scholes–Merton option-pricing model. It produces a theoretical option value
under specified assumptions; it is not an entry-and-exit strategy by itself.

The educational calculator at `/quant/options/` now provides:

- inputs: spot price, strike, time to expiry, risk-free rate, dividend yield, and
  volatility;
- outputs: European call and put values plus clearly defined Greeks;
- validation: put-call parity, spot monotonicity, limiting cases, a standard
  benchmark, and numerical checks on Greeks;
- interface: a spot-scenario table that changes one input at a time;
- disclosure: European exercise, constant volatility and rates, frictionless hedging,
  and the difference between theoretical and traded prices.

Do **not** present the calculator as a Black–Scholes backtest using only the
current SPY close history.
A credible historical options strategy also needs point-in-time contract chains,
strikes, expirations, bid/ask or executable prices, implied volatility, rates,
dividends, exercise and assignment rules, contract multipliers, and corporate-action
handling. The lab must identify a documented, legally usable, sustainable data source
before that work is ready; the scheduled task must not add a paid service.

## Scheduled-task selection checklist

Before choosing daily strategy work:

1. Read `AGENTS.md`, `ARCHITECTURE.md`, this file, `BACKLOG.md`, `CHANGELOG.md`, and
   `CONTRIBUTING.md`.
2. Fetch `origin` and inspect the persistent pull request to avoid overlap.
3. Choose the highest-priority ready item whose data and engine dependencies exist.
   Implement one strategy or prerequisite per scheduled increment.
4. Write the signal, execution timing, equality behavior, warmup, sizing, and fees
   before coding.
5. Add hand-calculated regression tests and an explicit lookahead-prevention test.
6. Run `npm run check`; for UI changes, inspect narrow and wide layouts and keyboard
   use.
7. Update this roadmap and `BACKLOG.md` only for work completed or newly blocked.

Skip implementation when the required data, methodology decision, or validation
cannot be completed honestly in one bounded change. A research note or prerequisite
can be the useful daily improvement instead.

## Primary references

- Fischer Black and Myron Scholes, “The Pricing of Options and Corporate Liabilities,”
  *Journal of Political Economy* 81(3), 1973:
  https://doi.org/10.1086/260062
- Tobias J. Moskowitz, Yao Hua Ooi, and Lasse Heje Pedersen, “Time Series Momentum,”
  *Journal of Financial Economics* 104(2), 2012:
  https://doi.org/10.1016/j.jfineco.2011.11.003
- Mebane T. Faber, “A Quantitative Approach to Tactical Asset Allocation,” *Journal
  of Wealth Management* 9(4), 2007: https://papers.ssrn.com/abstract=962461
- Alan Moreira and Tyler Muir, “Volatility-Managed Portfolios,” *Journal of Finance*
  72(4), 2017: https://doi.org/10.1111/jofi.12513

These papers motivate research questions; they do not guarantee that a simplified
Orion implementation will reproduce published results or perform well in the future.
