# Changelog

## 2026-10-27

- Added a stateful close-channel breakout with separate entry and shorter exit
  windows, strict threshold crossings, prior-close signals, and next-close fills.

## 2026-10-26

- Extended transaction-cost sensitivity to rerun every selected fee and slippage
  combination, with separate modeled-cost totals and no performance ranking.

## 2026-10-24

- Added a separate slippage assumption that adversely adjusts buy and sell execution
  prices while keeping proportional transaction fees and slippage costs distinct.

## 2026-10-22

- Added transaction-cost sensitivity for 2–6 disclosed fee assumptions. Each scenario
  reruns the same fixed configuration and reports full-period and test returns without
  ranking or selecting a winner.

## 2026-10-20

- Added guarded lookback comparison for 2–12 candidate configurations. Candidates are
  ranked only by training return, the search breadth is disclosed, and test results are
  excluded from selection.

## 2026-10-19

- Added optional expanding walk-forward validation. It evaluates a fixed strategy
  configuration over consecutive, non-overlapping test windows and compounds only
  out-of-sample returns against the benchmark.

## 2026-10-18

- Added a fixed training/test split to each new backtest. Strategy state carries
  across the boundary while each period reports independent return, Sharpe, and
  drawdown metrics, making the test period an explicit out-of-sample result.

## 2026-10-15

- Added portable experiment import and side-by-side comparison for up to three
  archived runs. Imported results are validated and recomputed from their saved data.
- Added a moving-average trend filter to the historical backtester, preserving
  previous-close signals, next-close execution, transaction costs, and the
  same-asset buy-and-hold benchmark.
- Added a separate Black–Scholes–Merton calculator for theoretical European
  call/put values, Greeks, and hypothetical spot scenarios. It does not imply
  historical options trading.
- Added independent tests for signal timing, warmup, fees, lookahead prevention,
  standard option values, parity, numerical Greeks, and limiting cases.

## 2026-10-14

- Reframed the public field guide for graduate research review: added the project's purpose, a concrete research workflow, implemented architecture, current capabilities, and a separately labeled roadmap. Replaced the illustrative performance chart with a research-process diagram.
- Renamed the public project to Orion Quant Lab while preserving existing site URLs and repository links.
- Added annualized return and a strategy-versus-benchmark drawdown chart to backtest results.
- Added a research roadmap for staged strategy expansion and a separate options-pricing module.

## 2026-10-13

- Extracted Atlas Quant into its own repository with a standalone local preview.
- Retained the exhibit, backtest engine, saved experiments, exports, and free daily data refresh.
- Added CI checks, contributor instructions, and a pinned portfolio release contract.
- Preserved the complete tour-button border on hover and keyboard focus.
