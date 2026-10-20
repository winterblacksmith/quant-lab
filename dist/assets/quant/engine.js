export const VERSION = '1.4.0';
export function validateRows(rows) {
  if (!Array.isArray(rows) || rows.length < 3 || rows.length > 20000) throw new Error('Provide 3–20,000 daily observations.');
  rows.forEach((r, i) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !Number.isFinite(Date.parse(r.date)) || new Date(r.date).toISOString().slice(0,10) !== r.date || !Number.isFinite(r.close) || r.close <= 0) throw new Error(`Invalid date or positive price at row ${i + 1}.`);
    if (i && r.date <= rows[i-1].date) throw new Error('Dates must be unique and in ascending order.');
  });
  return rows;
}
export function parseCSV(text) {
  const lines = text.trim().replace(/^\uFEFF/, '').split(/\r?\n/);
  const headers = lines.shift().toLowerCase().split(',').map(s => s.trim());
  const date = headers.indexOf('date'), close = headers.indexOf('close');
  if (date < 0 || close < 0) throw new Error('CSV needs date,close columns, ISO dates, and decimal prices.');
  return validateRows(lines.map(line => { const cells = line.split(','); return {date: (cells[date] || '').trim(), close: Number(cells[close])}; }));
}
export function drawdowns(curve, capital) {
  let peak = capital;
  return curve.map(point => {
    peak = Math.max(peak, point.equity);
    return {date: point.date, drawdown: point.equity / peak - 1};
  });
}
export function metrics(curve, capital) {
  let prev = capital;
  const returns = curve.map(p => { const r = p.equity / prev - 1; prev = p.equity; return r; });
  const mean = returns.reduce((a,b)=>a+b,0)/returns.length;
  const variance = returns.reduce((s,r)=>s+(r-mean)**2,0)/(returns.length-1);
  const sd = Math.sqrt(variance);
  const annualizedReturn = (prev / capital) ** (252 / returns.length) - 1;
  const maxDrawdown = Math.min(0, ...drawdowns(curve, capital).map(point => point.drawdown));
  return {totalReturn:prev/capital-1, annualizedReturn, volatility:sd*Math.sqrt(252), sharpe:sd > 1e-12 ? mean/sd*Math.sqrt(252) : null, maxDrawdown, finalValue:prev};
}
function periodMetrics(simulation, startIndex, endIndex, capital) {
  const curve = simulation.curve.slice(startIndex, endIndex);
  const openingValue = startIndex ? simulation.curve[startIndex - 1].equity : capital;
  return metrics(curve, openingValue);
}
export function backtest(rows, config) {
  validateRows(rows);
  if (config.parameterLookbacks !== undefined) {
    const parameterComparison=compareParameters(rows,config,config.parameterLookbacks);
    const result=backtest(rows,{...config,lookback:parameterComparison.selectedLookback,parameterLookbacks:undefined});
    result.config.parameterLookbacks=[...config.parameterLookbacks];
    result.parameterComparison=parameterComparison;
    return result;
  }
  const {start,end,capital,lookback,feeBps,strategy} = config;
  if (!['momentum','sma','hold'].includes(strategy) || !Number.isFinite(capital) || capital <= 0 || capital > 1e9 || !Number.isInteger(lookback) || lookback < (strategy === 'sma' ? 2 : 1) || lookback > 252 || !Number.isFinite(feeBps) || feeBps < 0 || feeBps > 100) throw new Error('Check capital, lookback (2–252 for moving average), and costs (0–100 bps).');
  if (![start,end].every(d=>/^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0,10) === d) || start > end || start < rows[0].date || end > rows.at(-1).date) throw new Error('Choose a valid date range within this dataset.');
  const first = rows.findIndex(r=>r.date>=start), selected = rows.filter(r=>r.date>=start && r.date<=end);
  if (selected.length < 3) throw new Error('Choose at least three trading observations.');
  if (strategy === 'momentum' && first < lookback + 1) throw new Error(`Momentum needs ${lookback+1} observations before the start date. Choose a later start.`);
  if (strategy === 'sma' && first < lookback) throw new Error(`Moving average needs ${lookback} observations before the start date. Choose a later start.`);
  const prefix = strategy === 'sma' ? [0] : null;
  if (prefix) for (const row of rows) {
    const sum = prefix.at(-1) + row.close;
    if (!Number.isFinite(sum)) throw new Error('Prices are too large for a moving-average calculation.');
    prefix.push(sum);
  }
  function target(kind, i) {
    if (kind === 'hold') return true;
    if (kind === 'momentum') return rows[i-1].close > rows[i-1-lookback].close;
    const priorAverage = (prefix[i] - prefix[i-lookback]) / lookback;
    return rows[i-1].close > priorAverage;
  }
  function simulate(kind) {
    let cash = capital, shares = 0, costs = 0;
    const trades = [], curve = [], fee = feeBps / 10000;
    selected.forEach((r,j)=>{
      const i = first+j;
      const own = target(kind, i);
      if (own && !shares) {
        shares = cash / (r.close*(1+fee));
        const cost = shares*r.close*fee; costs += cost; cash = 0;
        trades.push({date:r.date,side:'BUY',price:r.close,shares,cost});
      } else if (!own && shares) {
        const cost = shares*r.close*fee; cash = shares*r.close-cost; costs += cost;
        trades.push({date:r.date,side:'SELL',price:r.close,shares,cost}); shares=0;
      }
      curve.push({date:r.date,equity:cash+shares*r.close,cash,shares});
    });
    return {curve,trades,costs,metrics:metrics(curve,capital)};
  }
  const strategyResult=simulate(strategy),benchmark=simulate('hold');
  let periods=null;
  if (config.testStart !== undefined) {
    const split=selected.findIndex(row=>row.date>=config.testStart);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(config.testStart) || split < 3 || selected.length-split < 3 || selected[split].date !== config.testStart) throw new Error('Choose a test start with at least three observations in both training and test periods.');
    periods={
      training:{start:selected[0].date,end:selected[split-1].date,strategy:periodMetrics(strategyResult,0,split,capital),benchmark:periodMetrics(benchmark,0,split,capital)},
      test:{start:selected[split].date,end:selected.at(-1).date,strategy:periodMetrics(strategyResult,split,selected.length,capital),benchmark:periodMetrics(benchmark,split,selected.length,capital)}
    };
  }
  const result={version:VERSION,config:{...config},strategy:strategyResult,benchmark,periods,parameterComparison:null};
  result.walkForward=config.walkForwardWindow===undefined?null:walkForward(rows,config,config.walkForwardWindow);
  return result;
}

export function compareParameters(rows, config, candidates) {
  validateRows(rows);
  if (!config.testStart) throw new Error('Parameter comparison requires a training/test split.');
  if (config.strategy === 'hold') throw new Error('Buy and hold has no lookback parameter to compare.');
  if (!Array.isArray(candidates) || candidates.length < 2 || candidates.length > 12 ||
      candidates.some(value=>!Number.isInteger(value) || value < (config.strategy === 'sma' ? 2 : 1) || value > 252) ||
      new Set(candidates).size !== candidates.length) {
    throw new Error('Compare 2–12 unique valid lookbacks (1–252; moving average starts at 2).');
  }
  const selected=rows.filter(row=>row.date>=config.start&&row.date<=config.end);
  const split=selected.findIndex(row=>row.date===config.testStart);
  if (split < 3) throw new Error('Parameter comparison needs a valid test start after at least three training observations.');
  const trainingEnd=selected[split-1].date;
  const results=candidates.map(lookback=>{
    const run=backtest(rows,{...config,end:trainingEnd,lookback,testStart:undefined,walkForwardWindow:undefined,parameterLookbacks:undefined});
    return {lookback,totalReturn:run.strategy.metrics.totalReturn,sharpe:run.strategy.metrics.sharpe,maxDrawdown:run.strategy.metrics.maxDrawdown,trades:run.strategy.trades.length};
  }).sort((a,b)=>b.totalReturn-a.totalReturn||a.lookback-b.lookback);
  return {objective:'trainingTotalReturn',trainingStart:config.start,trainingEnd,configurationsTried:results.length,selectedLookback:results[0].lookback,results};
}

export function walkForward(rows, config, testWindow) {
  if (!Number.isInteger(testWindow) || testWindow < 3 || testWindow > 252) {
    throw new Error('Choose a walk-forward test window of 3–252 observations.');
  }
  const selected=rows.filter(row=>row.date>=config.start&&row.date<=config.end);
  const firstTest=selected.findIndex(row=>row.date===config.testStart);
  if (firstTest < 3) throw new Error('Walk-forward validation needs a valid initial test date after at least three training observations.');
  const folds=[];
  let cursor=firstTest;
  while (selected.length-cursor>=3) {
    let next=Math.min(cursor+testWindow,selected.length);
    if (selected.length-next<3) next=selected.length;
    const foldResult=backtest(rows,{...config,end:selected[next-1].date,testStart:selected[cursor].date,walkForwardWindow:undefined});
    const test=foldResult.periods.test;
    folds.push({
      number:folds.length+1,
      trainingStart:selected[0].date,
      trainingEnd:selected[cursor-1].date,
      trainingObservations:cursor,
      testStart:selected[cursor].date,
      testEnd:selected[next-1].date,
      testObservations:next-cursor,
      strategy:test.strategy,
      benchmark:test.benchmark
    });
    cursor=next;
  }
  if (folds.length<2) throw new Error('Choose a date range with enough test observations for at least two walk-forward folds.');
  const compound=key=>folds.reduce((growth,fold)=>growth*(1+fold[key].totalReturn),1)-1;
  return {
    testWindow,
    folds,
    strategyReturn:compound('strategy'),
    benchmarkReturn:compound('benchmark'),
    positiveFolds:folds.filter(fold=>fold.strategy.totalReturn>0).length,
    winningFolds:folds.filter(fold=>fold.strategy.totalReturn>fold.benchmark.totalReturn).length
  };
}
