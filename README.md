# Orion Quant Lab

A small, transparent research lab for asking how a trading rule behaved in the past
and how an options-pricing model responds to its assumptions. Start with the
museum-style field guide, then run a browser-based historical experiment or an
educational European options calculation.

**[Take the tour](https://shishirlohar.com/quant/) · [Run a backtest](https://shishirlohar.com/quant/lab/) · [Explore options pricing](https://shishirlohar.com/quant/options/)**

## What you can investigate

- Compare time-series momentum or a moving-average trend filter with buy and hold
  on the same history. The moving-average rule uses the previous close and the
  average of the previous `N` closes; a signal executes at the next close.
- Change dates, lookback, starting capital, transaction fees, and execution slippage;
  compare independently varied fee/slippage combinations without ranking them.
- Inspect daily equity, geometric annualized return, drawdown, volatility, Sharpe
  ratio, and individual trades.
- Save experiments locally and export full experiment JSON or daily equity CSV.
- Import a different daily series with `date,close` columns.
- Calculate theoretical European call and put values, Greeks, and hypothetical
  spot-price scenarios with a separate Black–Scholes–Merton module.

The results are historical evidence, not a forecast or proof that a rule will work
in the future. Annualized return assumes 252 trading observations. The drawdown
chart tracks declines from prior portfolio peaks for the strategy and benchmark.
See [the strategy research roadmap](STRATEGY_ROADMAP.md) for staged ideas and the
data and testing requirements for future strategies and options research.

This is a historical simulation with imaginary money. There is no brokerage
connection or real trading. Signals use prior closes and execute at the next close;
the tests cover timing, fees, validation, and metric calculations.
The options calculator is not a backtest or trading strategy. It has no historical
option-chain data and does not produce a tradable quote.

## Run locally

Requires Node.js 18+ and Python 3.9+; there are no packages to install.

```sh
npm run check
npm run dev
```

Open http://127.0.0.1:4174/quant/. Calculations and saved experiments stay in the
browser. The included data is a snapshot; read its dates in the lab before use.

```sh
npm run refresh:data
npm run check
```

The refresh uses Yahoo Finance's unofficial chart endpoint with no API key,
subscription, or paid fallback. It rejects incomplete sessions and invalid data.
Failure preserves the last local snapshot. Production refreshes on the portfolio's
weekday schedule, so the repository snapshot may be older than the live website.

## Code map

| Path | Purpose |
| --- | --- |
| `dist/quant/` | Field guide and research workspace |
| `dist/assets/quant/engine.js` | Pure backtest and metric functions |
| `dist/assets/quant/lab.js` | Inputs, charts, imports, exports, local saves |
| `dist/quant/options/` | Educational European options calculator |
| `dist/assets/quant/options-engine.js` | Black–Scholes–Merton prices and Greeks |
| `dist/assets/quant/options.js` | Options form, results, and hypothetical scenarios |
| `dist/assets/atlas-shell/` | Independent navigation, theme, and base styles |
| `scripts/refresh-market-data.py` | Validated daily adjusted-price refresh |
| `tests/` | Engine and refresh regression tests |
| `learning/` | Short notes explaining research decisions |

See [architecture and assumptions](ARCHITECTURE.md), [backlog](BACKLOG.md),
[development workflow](CONTRIBUTING.md), and [release history](CHANGELOG.md).

## Development and review

Ongoing lab changes use one persistent branch, `codex/orion-quant-rebrand`, and one
open pull request. The daily Codex task adds tested improvements to that review and
reports the changes, commit, checks, and PR on every run, including runs with no
changes. It does not merge the PR or publish to the website. After a reviewed PR is
merged, the same branch is reset from the latest `main` for future work.

## Connected to the portfolio

This repository owns Orion Quant Lab. The [portfolio](https://github.com/winterblacksmith/shishirlohar.com)
includes a tested, pinned commit in its existing deployment. Visitors still use
`shishirlohar.com/quant/`; the portfolio's Projects page links to both this repo
and the live lab. Updating Orion Quant Lab's `main` does not by itself publish a new release.
This project is maintained in [`winterblacksmith/quant-lab`](https://github.com/winterblacksmith/quant-lab).
The public lab keeps its `/quant/` routes. Publishing a reviewed lab update requires
the portfolio to pin its full commit SHA and pass its own checks.

Initial code was extracted from the portfolio on 2026-10-13, preserving attribution
and methodology. The earlier implementation history remains in the portfolio repo.
Standard public-repository CI and the existing web server are used; no additional
hosting account, paid data provider, or deployment credential is needed here.
