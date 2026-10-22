# Orion Quant Lab architecture

## First release

Orion Quant Lab lives at `/quant/`, with the backtest workspace at `/quant/lab/`
and a separate educational options calculator at `/quant/options/`.
The existing portfolio is a dependency-free static website served by Nginx.
This release keeps that deployment model: browser ES modules provide the interface,
a pure reusable JavaScript engine provides calculations, and a bundled SPY daily
adjusted-close snapshot provides historical data. CSV import accepts other daily
series; the benchmark always uses the same asset as the strategy.

This deliberately adapts the brief's suggested React/FastAPI/PostgreSQL stack to
the existing website. A server API and shared database are future work, not required
for this single-user research workflow. Experiments persist locally in the browser
and can be downloaded as self-contained JSON including input data and CSV results.
No trading connection is activated. A daily Codex task proposes bounded improvements through reviewed branches.

## Methodology

Signals use only closes available before execution. At close t, momentum uses
close[t-1] / close[t-1-lookback] > 1. Positions established at close t first earn
the return from t to t+1. Warmup observations precede the selected test window.
Buy-and-hold enters at the first test close. Both pay the same proportional fee
on each entry or exit. Fractional shares; long or cash only; cash earns zero;
no leverage, taxes, separate spread or slippage. Open positions are marked to
market at the last close, without forced liquidation. Adjusted prices model a
reinvested distribution series, not actual historical share counts or fills.

Return = final equity / initial capital - 1. Annualized return is the geometric
return scaled to 252 trading observations. Daily returns include the initial
entry fee. Annualized volatility uses sample standard deviation × sqrt(252).
Sharpe uses arithmetic daily mean / sample deviation × sqrt(252), zero risk-free
rate; undefined when deviation is zero. Drawdown includes starting capital as
an initial high-water mark. Annualization assumes daily trading observations;
import validation cannot independently verify a provider's trading calendar.

Each new experiment has a fixed training/test split with at least three observations
on each side. The strategy runs continuously across the boundary so an existing
position and its transaction history are not reset. Training metrics use starting
capital as their baseline; test metrics use the portfolio value immediately before
the first test observation. The split is descriptive rather than an automated
optimizer: researchers choose parameters from training evidence and reserve the
test result for out-of-sample evaluation. Older exported experiments without a
split remain importable and display their original full-period result.

Optional expanding walk-forward validation begins at that same test boundary. Each
fold trains from the selected start through the prior fold, then evaluates the next
non-overlapping 3–252-observation test window. A final short remainder is included
in the preceding fold; fewer than two folds is rejected. Strategy state is continuous
across the training/test boundary within each fold, but each fold is independently
initialized to avoid carrying capital between repeated simulations. Aggregate
strategy and benchmark returns compound only the disjoint out-of-sample windows.
The validator applies one fixed configuration and does not search or rank parameters.

Optional guarded parameter comparison accepts 2–12 unique lookbacks and ranks them by
training-period total return, with the shorter lookback breaking exact ties. The selected
lookback is then used for the full continuous run, whose test metrics remain out of the
ranking. The result records every candidate's training return, Sharpe, drawdown, and trade
count plus the number of configurations tried so the search breadth is visible.

Optional transaction-cost sensitivity accepts 2–6 unique assumptions from 0–100 basis
points and reruns one fixed strategy, lookback, date range, and capital setting at each
cost. Scenarios are ordered by cost rather than performance and report full-period and
test returns, benchmark return, modeled costs, final value, and unchanged trade count.
It is a robustness view, not a parameter selector.

The moving-average filter owns the asset when the close at `t-1` is strictly
greater than the arithmetic average of closes `t-lookback` through `t-1`.
Equality means cash. It uses the same delayed execution, long-or-cash sizing,
transaction costs, and buy-and-hold benchmark as momentum. At least `lookback`
warmup observations must precede the selected start date.

## European options calculator

The independent Black–Scholes–Merton module calculates theoretical European
call and put values with continuous dividend yield from spot, strike, positive
time in years, continuously compounded risk-free rate, continuously compounded
dividend yield, and positive annualized volatility. It also reports delta,
gamma, vega, theta, and rho. The interface converts annual theta to per-calendar-
day values and vega/rho to the effect of a one-percentage-point input change.
The scenario table changes spot alone, holding every other input fixed.

The normal CDF uses the Abramowitz–Stegun 26.2.17 approximation (maximum
absolute CDF error about 7.5e-8). Tests check a standard numerical benchmark,
put–call parity, monotonicity, numerical derivatives of Greeks, and
limiting cases. The calculator assumes European exercise, constant volatility
and rates, continuous yield, and frictionless trading. It uses hypothetical
inputs, not option-chain data or a historical options strategy.

## Reproducibility and boundaries

Each saved run records engine version, config,
source metadata, all input rows, results and timestamp. Exports survive browser
storage clearing. Local storage is limited to the latest 10 experiments. There
is no account, cloud sync, live quote feed, or claim of predictive performance.
Imported experiment JSON is schema-checked and its results are recomputed from the
embedded rows and configuration before storage or comparison; exported metrics are
not trusted as authoritative.

## Daily data refresh

`scripts/refresh-market-data.py` calls the Yahoo Finance chart endpoint from the
build runner. It refreshes the complete adjusted history, rather than appending
new prices to a history with a different dividend-adjustment basis. The endpoint
requires no key in this implementation, but is unofficial and has no availability
contract; HTTP errors, throttling or schema changes fail the refresh visibly.

The deployment workflow runs weekdays at 23:30 UTC and also refreshes on production
push/manual deployments. GitHub schedules become active only on the default branch;
the job additionally requires `main`. No production deployment runs on the feature
branch. Prices dated today are excluded until 18:00 America/New_York, allowing a
buffer after the regular close. Holidays/weekends add no rows. Validation checks
symbol, ordering, finite positive prices, full history, previously known dates,
and a maximum five-calendar-day lag. This is a freshness heuristic, not a complete
exchange holiday calendar. Failed refreshes abort before publishing.

The runner atomically replaces its local dataset, runs checks, and copies it into
the release package. It does not commit generated prices or require repository
write permission. Release IDs are 40 hexadecimal characters from the package hash
so new data gets its own release even when the source commit is unchanged. This
uses the existing deployment helper's accepted ID format and keeps rollback releases.

The frontend fetches same-origin JSON with no-store and provides an explicit update
check. That button checks the published snapshot; it does not contact Yahoo or start
a deployment. Experiments retain their original input rows and metadata. The data
includes a SHA-256 of the price rows, retrieval timestamp, and latest session date.
GitHub Actions run logs report refresh failures. Scheduled workflows can be delayed
or disabled by GitHub; the UI flags data more than five days old.

## Independent repository and deployment

Orion Quant Lab is maintained in `winterblacksmith/quant-lab`. Its static output is
`dist/quant/`, `dist/assets/quant/`, and `dist/assets/atlas-shell/`. The shell is a
small independent copy of the portfolio's navigation, themes, and styles; Orion Quant Lab
owns this copy so a release can be previewed and tested without the portfolio.
The `atlas-*` integration paths remain stable for the portfolio release workflow;
Orion Quant Lab is the public product name.
Portfolio links are absolute; all Orion Quant Lab runtime dependencies are local.

The portfolio stores a full commit SHA in `atlas-quant.lock.json`, checks out
that exact Orion revision, runs its checks and data refresh, and assembles those
three directories into its release. Orion code changes go live only when
the portfolio pin is updated and deployed. Weekday data refresh continues through
the portfolio workflow at 23:30 UTC, using the pinned Orion refresh script.
No deployment secrets are copied into this repository. Pull requests use read-only
CI permissions. The Codex daily task updates one persistent review branch and PR;
it does not merge or change the production pin automatically.
