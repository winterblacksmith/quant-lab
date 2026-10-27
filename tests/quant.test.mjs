import test from 'node:test';
import assert from 'node:assert/strict';
import {backtest,compareCosts,compareParameters,drawdowns,parseCSV,metrics,walkForward} from '../dist/assets/quant/engine.js';
const rows=prices=>prices.map((close,i)=>({date:`2024-01-${String(i+1).padStart(2,'0')}`,close}));
const config={start:'2024-01-03',end:'2024-01-06',capital:100,lookback:1,feeBps:0,strategy:'momentum'};
test('hold matches hand-calculated equity and benchmark',()=>{const r=backtest(rows([100,100,100,120,90,110]),{...config,strategy:'hold'});assert.equal(r.strategy.metrics.finalValue,110);assert.deepEqual(r.strategy,r.benchmark);assert.ok(Math.abs(r.strategy.metrics.maxDrawdown+.25)<1e-12);});
test('momentum uses prior prices, and earns returns only after execution',()=>{const r=backtest(rows([100,110,50,80,90,100]),config);assert.deepEqual(r.strategy.trades.map(t=>[t.date,t.side]),[['2024-01-03','BUY'],['2024-01-04','SELL'],['2024-01-05','BUY']]);assert.equal(r.strategy.curve[0].equity,100);assert.equal(r.strategy.curve[1].equity,160);});
test('future prices cannot alter previous positions or values',()=>{const a=backtest(rows([100,110,50,80,90,100]),config),b=backtest(rows([100,110,50,80,900,1]),config);assert.deepEqual(a.strategy.curve.slice(0,2),b.strategy.curve.slice(0,2));});
test('fees on both sides and initial fee drawdown',()=>{const r=backtest(rows([100,110,100,100,100,100]),{...config,feeBps:100});assert.ok(Math.abs(r.strategy.metrics.finalValue-100*.99/1.01)<1e-10);assert.equal(r.strategy.trades.length,2);assert.ok(r.strategy.metrics.maxDrawdown<0);});
test('slippage moves execution prices adversely and remains separate from fees',()=>{const r=backtest(rows([100,110,100,100,100,100]),{...config,feeBps:100,slippageBps:100});const [buy,sell]=r.strategy.trades;assert.equal(buy.close,100);assert.equal(buy.price,101);assert.equal(sell.close,100);assert.equal(sell.price,99);assert.ok(Math.abs(r.strategy.metrics.finalValue-100*99*.99/(101*1.01))<1e-10);assert.ok(r.strategy.costs>0);assert.ok(r.strategy.slippageCosts>0);assert.equal(r.benchmark.trades[0].price,101);});
test('missing slippage remains equivalent to zero for older experiments',()=>{const data=rows([100,110,100,100,100,100]),legacy=backtest(data,config),explicit=backtest(data,{...config,slippageBps:0});assert.deepEqual(legacy.strategy,explicit.strategy);assert.deepEqual(legacy.benchmark,explicit.benchmark);});
test('flat cash has undefined Sharpe',()=>{const r=backtest(rows([100,100,100,100,100,100]),config);assert.equal(r.strategy.metrics.sharpe,null);assert.equal(r.strategy.metrics.totalReturn,0);assert.equal(r.strategy.trades.length,0);});
test('CSV rejects duplicates, impossible dates, nonpositive prices and bad headers',()=>{for(const csv of ['date,close\n2024-02-30,2\n2024-03-01,3\n2024-03-02,4','date,close\n2024-01-01,1\n2024-01-01,2\n2024-01-02,3','date,close\n2024-01-01,0\n2024-01-02,2\n2024-01-03,3','x,y\n1,2'])assert.throws(()=>parseCSV(csv));});
test('valid CSV and config validation',()=>{assert.equal(parseCSV('date,close\n2024-01-01,1\n2024-01-02,2\n2024-01-03,3').length,3);for(const patch of [{start:'2024-01-01'},{end:'2024-01-02'},{capital:NaN},{feeBps:-1},{slippageBps:-1},{slippageBps:101},{lookback:2.5},{end:'2024-02-30'}])assert.throws(()=>backtest(rows([1,2,3,4,5,6]),{...config,...patch}));});
test('sample volatility matches independently calculated daily returns',()=>{const m=metrics([{equity:110},{equity:99},{equity:108.9}],100);const mean=1/30;const variance=((.1-mean)**2+(-.1-mean)**2+(.1-mean)**2)/2;assert.ok(Math.abs(m.volatility-Math.sqrt(variance*252))<1e-10);});
test('annualized return uses geometric growth over trading observations',()=>{const m=metrics([{equity:101},{equity:102.01}],100);assert.ok(Math.abs(m.annualizedReturn-(1.0201**126-1))<1e-10);});
test('drawdowns track declines from starting capital and recovered peaks',()=>{const points=drawdowns([{date:'a',equity:90},{date:'b',equity:120},{date:'c',equity:96},{date:'d',equity:132}],100);assert.deepEqual(points.map(p=>p.date),['a','b','c','d']);assert.ok(Math.abs(points[0].drawdown+.1)<1e-12);assert.equal(points[1].drawdown,0);assert.ok(Math.abs(points[2].drawdown+.2)<1e-12);assert.equal(points[3].drawdown,0);});

test('train and test metrics use the prior period value as the test baseline',()=>{
  const result=backtest(rows([100,100,100,120,90,99,108,117]),{...config,strategy:'hold',end:'2024-01-08',testStart:'2024-01-06'});
  assert.deepEqual([result.periods.training.start,result.periods.training.end],['2024-01-03','2024-01-05']);
  assert.deepEqual([result.periods.test.start,result.periods.test.end],['2024-01-06','2024-01-08']);
  assert.ok(Math.abs(result.periods.training.strategy.totalReturn+.1)<1e-12);
  assert.ok(Math.abs(result.periods.test.strategy.totalReturn-.3)<1e-12);
  assert.deepEqual(result.periods.training.strategy,result.periods.training.benchmark);
});

test('train and test split requires exact dates and three observations per period',()=>{
  const base={...config,end:'2024-01-08'};
  const data=rows([1,2,3,4,5,6,7,8]);
  for(const testStart of ['2024-01-04','2024-01-07','2024-01-06T00:00:00Z','2024-02-01'])assert.throws(()=>backtest(data,{...base,testStart}),/at least three observations/);
});

test('moving-average filter uses only prior closes and holds cash at equality',()=>{
  const settings={...config,strategy:'sma',lookback:2,start:'2024-01-04',end:'2024-01-08'};
  const result=backtest(rows([10,10,12,11,9,12,13,8]),settings);
  assert.deepEqual(result.strategy.trades.map(trade=>[trade.date,trade.side]),[
    ['2024-01-04','BUY'],['2024-01-05','SELL'],['2024-01-07','BUY']
  ]);
  assert.ok(Math.abs(result.strategy.curve[0].equity-100)<1e-10);
  assert.ok(Math.abs(result.strategy.curve[1].equity-100*9/11)<1e-10);
  const flat=backtest(rows([100,100,100,100,100,100]),{...settings,end:'2024-01-06'});
  assert.equal(flat.strategy.trades.length,0);
});

test('moving-average filter enforces warmup, charges both trades, and prevents lookahead',()=>{
  const settings={...config,strategy:'sma',lookback:2,start:'2024-01-04',end:'2024-01-06'};
  const prices=[10,10,12,11,9,12];
  assert.throws(()=>backtest(rows(prices),{...settings,start:'2024-01-02'}),/Moving average needs/);
  assert.throws(()=>backtest(rows(prices),{...settings,lookback:1}),/lookback/);
  assert.throws(()=>backtest(rows(Array(6).fill(1e308)),settings),/too large/);
  const result=backtest(rows(prices),{...settings,feeBps:100});
  assert.equal(result.strategy.trades.length,2);
  assert.ok(Math.abs(result.strategy.metrics.finalValue-100/(11*1.01)*9*.99)<1e-10);
  const changed=backtest(rows([10,10,12,11,900,1]),{...settings,feeBps:100});
  assert.deepEqual(result.strategy.curve[0].shares,changed.strategy.curve[0].shares);
  assert.equal(result.strategy.trades[0].date,changed.strategy.trades[0].date);
});

test('close-channel breakout persists between strict entry and exit thresholds',()=>{
  const settings={...config,strategy:'channel',lookback:3,exitLookback:2,start:'2024-01-05',end:'2024-01-08'};
  const result=backtest(rows([10,11,12,13,14,14,9,8]),settings);
  assert.deepEqual(result.strategy.trades.map(trade=>[trade.date,trade.side]),[
    ['2024-01-05','BUY'],['2024-01-08','SELL']
  ]);
  assert.equal(result.strategy.curve[1].shares,result.strategy.curve[2].shares);
  assert.ok(Math.abs(result.strategy.metrics.finalValue-100*8/14)<1e-10);
});

test('close-channel breakout validates windows, charges costs, and prevents lookahead',()=>{
  const data=rows([10,11,12,13,14,14,9,8]);
  const settings={...config,strategy:'channel',lookback:3,exitLookback:2,start:'2024-01-05',end:'2024-01-08',feeBps:100};
  assert.throws(()=>backtest(data,{...settings,start:'2024-01-04'}),/Close-channel breakout needs/);
  for(const exitLookback of [0,3,3.5])assert.throws(()=>backtest(data,{...settings,exitLookback}),/exit must be shorter/);
  const result=backtest(data,settings);
  assert.ok(Math.abs(result.strategy.metrics.finalValue-100/(14*1.01)*8*.99)<1e-10);
  const changed=backtest(rows([10,11,12,13,14,1,900,1]),settings);
  assert.deepEqual(result.strategy.curve[0].shares,changed.strategy.curve[0].shares);
  assert.equal(result.strategy.trades[0].date,changed.strategy.trades[0].date);
});

test('walk-forward compounds only consecutive out-of-sample windows',()=>{
  const data=rows([90,95,100,105,110,120,126,132,138,144,150,156]);
  const settings={...config,strategy:'hold',start:'2024-01-03',end:'2024-01-12',testStart:'2024-01-07'};
  const result=walkForward(data,settings,3);
  assert.equal(result.folds.length,2);
  assert.deepEqual(result.folds.map(fold=>[fold.trainingObservations,fold.testObservations]),[[4,3],[7,3]]);
  assert.deepEqual(result.folds.map(fold=>[fold.testStart,fold.testEnd]),[['2024-01-07','2024-01-09'],['2024-01-10','2024-01-12']]);
  assert.ok(Math.abs(result.strategyReturn-(156/120-1))<1e-12);
  assert.equal(result.strategyReturn,result.benchmarkReturn);
});

test('walk-forward rejects unusable windows and preserves earlier fold results',()=>{
  const settings={...config,start:'2024-01-03',end:'2024-01-12',testStart:'2024-01-07'};
  const original=rows([90,95,100,105,110,120,126,132,138,144,150,156]);
  const changed=rows([90,95,100,105,110,120,126,132,138,1,1000,1]);
  assert.deepEqual(walkForward(original,settings,3).folds[0],walkForward(changed,settings,3).folds[0]);
  assert.throws(()=>walkForward(original,settings,2),/3–252/);
  assert.throws(()=>walkForward(original,{...settings,testStart:'2024-01-10'},3),/at least two/);
});

test('parameter comparison ranks lookbacks using training returns only',()=>{
  const settings={...config,start:'2024-01-05',end:'2024-01-12',testStart:'2024-01-09'};
  const original=rows([10,11,12,13,9,8,12,14,16,18,20,22]);
  const changed=rows([10,11,12,13,9,8,12,14,1600,1,2000,1]);
  const first=compareParameters(original,settings,[1,2,3]);
  const second=compareParameters(changed,settings,[1,2,3]);
  assert.deepEqual(first,second);
  assert.equal(first.configurationsTried,3);
  assert.equal(first.results[0].lookback,first.selectedLookback);
  assert.deepEqual([...first.results].sort((a,b)=>b.totalReturn-a.totalReturn||a.lookback-b.lookback),first.results);
});

test('parameter comparison validates candidates and drives the full test config',()=>{
  const data=rows([10,11,12,13,9,8,12,14,16,18,20,22]);
  const settings={...config,start:'2024-01-05',end:'2024-01-12',testStart:'2024-01-09'};
  for(const candidates of [[1],[1,1],Array.from({length:13},(_,i)=>i+1),[0,2]])assert.throws(()=>compareParameters(data,settings,candidates),/2–12/);
  assert.throws(()=>compareParameters(data,{...settings,strategy:'hold'},[1,2]),/no lookback/);
  assert.throws(()=>compareParameters(data,{...settings,strategy:'sma'},[1,2]),/2–12/);
  const result=backtest(data,{...settings,parameterLookbacks:[1,2,3]});
  assert.equal(result.config.lookback,result.parameterComparison.selectedLookback);
  assert.deepEqual(result.config.parameterLookbacks,[1,2,3]);
  assert.ok(result.periods.test);
});

test('cost sensitivity reruns each fee and slippage combination in ascending order',()=>{
  const data=rows([100,110,100,120,90,110,80,100]);
  const settings={...config,end:'2024-01-08',testStart:'2024-01-06',feeBps:10,slippageBps:5};
  const result=compareCosts(data,settings,[25,0,10],[20,0,5]);
  assert.deepEqual(result.scenarios.map(scenario=>[scenario.feeBps,scenario.slippageBps]),[
    [0,0],[0,5],[0,20],[10,0],[10,5],[10,20],[25,0],[25,5],[25,20]
  ]);
  assert.equal(result.selectedFeeBps,10);
  assert.equal(result.selectedSlippageBps,5);
  assert.ok(result.scenarios[0].totalReturn>result.scenarios[1].totalReturn);
  assert.ok(result.scenarios[1].totalReturn>result.scenarios[2].totalReturn);
  assert.ok(result.scenarios[0].totalReturn>result.scenarios[3].totalReturn);
  assert.ok(result.scenarios.some(scenario=>scenario.slippageCosts>0));
  assert.ok(result.scenarios.every(scenario=>scenario.testReturn!==null&&scenario.trades===result.scenarios[0].trades));
});

test('cost sensitivity validates scenarios and is included in the backtest result',()=>{
  const data=rows([100,110,100,120,90,110,80,100]);
  const settings={...config,end:'2024-01-08',testStart:'2024-01-06',costSensitivityBps:[0,5,20],costSensitivitySlippageBps:[0,10]};
  const result=backtest(data,settings);
  assert.equal(result.costSensitivity.scenarios.length,6);
  assert.deepEqual(result.costSensitivity.scenarios.map(scenario=>scenario.slippageBps),[0,10,0,10,0,10]);
  assert.ok(result.costSensitivity.scenarios.every(scenario=>scenario.testReturn!==null));
  for(const rates of [[0],[0,0],[0,101],[0,5,10,15,20,25,30]])assert.throws(()=>compareCosts(data,settings,rates),/2–6/);
  for(const rates of [[],[0,0],[0,101],[0,5,10,15,20,25,30]])assert.throws(()=>compareCosts(data,settings,[0,5],rates),/1–6/);
});
