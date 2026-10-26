import {backtest, drawdowns, parseCSV, validateRows} from './engine.js?v=5af1cf0ce667';
import {comparison, MAX_IMPORTED_BYTES, restoreExperiment} from './experiments.js?v=25aa2e7508c6';
const $ = s => document.querySelector(s), money = n => n.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}), pct = n => `${(n*100).toFixed(2)}%`;
let bundled, data, current;
const key = 'atlas-experiments-v1';
const status = message => { $('#status').textContent=message; };
function setData(next) {
  data=next; current=null; $('#results').hidden=true; $('#empty').hidden=false;
  const rows=data.rows; const min=rows[0].date,max=rows.at(-1).date;
  for(const id of ['start','end','test-start']) { $(`#${id}`).min=min; $(`#${id}`).max=max; }
  $('#start').value=rows[Math.min(253,Math.max(0,rows.length-3))].date; $('#end').value=max;
  const first=rows.findIndex(row=>row.date>=$('#start').value),available=rows.length-first;
  $('#test-start').value=rows[first+Math.max(3,Math.min(available-3,Math.floor(available*.7)))].date;
  $('#data-note').textContent=`${data.ticker} · ${rows.length.toLocaleString()} observations · ${min} → ${max}. ${data.source}`;
  $('#run').disabled=false;
  showFreshness(data);
  status('Ready to test.');
}
function showFreshness(source) {
  const last=source.rows.at(-1).date;
  const stale=(Date.now()-Date.parse(last+'T23:59:59Z'))/86400000>5;
  const stamp=new Date(source.retrieved);
  const retrieved=Number.isNaN(stamp.getTime())?'unknown':stamp.toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
  $('#freshness').textContent=`Data through ${last}${stale?' · Data is over five days old':''}. Retrieved ${retrieved}.`;
  $('#freshness').classList.toggle('stale',stale);
}

function el(tag,text,className) {const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;}
function draw(result) {
  const svg=$('#chart'); svg.querySelectorAll('g').forEach(n=>n.remove());
  const ns='http://www.w3.org/2000/svg',g=document.createElementNS(ns,'g');svg.append(g);
  const a=result.strategy.curve,b=result.benchmark.curve,values=[result.config.capital,...a.map(p=>p.equity),...b.map(p=>p.equity)];
  let lo=Math.min(...values),hi=Math.max(...values); const pad=Math.max((hi-lo)*.1,hi*.01);lo-=pad;hi+=pad;
  const x=i=>65+i/(a.length-1)*710,y=v=>265-(v-lo)/(hi-lo)*235;
  function node(tag,attrs,text){const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text)n.textContent=text;g.append(n);}
  for(let i=0;i<5;i++){const v=lo+(hi-lo)*i/4;node('line',{x1:65,x2:775,y1:y(v),y2:y(v),class:'chart-grid'});node('text',{x:55,y:y(v)+4,'text-anchor':'end',class:'chart-label'},`${Math.round(v/1000)}k`);}
  for(const [series,cls] of [[b,'benchmark-line'],[a,'strategy-line']])node('path',{d:series.map((p,i)=>`${i?'L':'M'}${x(i).toFixed(2)},${y(p.equity).toFixed(2)}`).join(' '),class:cls});
  const split=a.findIndex(point=>point.date===result.config.testStart);
  if(split>=0){node('line',{x1:x(split),x2:x(split),y1:30,y2:265,class:'split-line'});node('text',{x:x(split)+6,y:44,class:'chart-label'},'TEST');}
  node('text',{x:65,y:295,class:'chart-label'},a[0].date);node('text',{x:775,y:295,'text-anchor':'end',class:'chart-label'},a.at(-1).date);
}
function drawDrawdown(result) {
  const svg=$('#drawdown-chart'); svg.querySelectorAll('g').forEach(n=>n.remove());
  const ns='http://www.w3.org/2000/svg',g=document.createElementNS(ns,'g');svg.append(g);
  const a=drawdowns(result.strategy.curve,result.config.capital),b=drawdowns(result.benchmark.curve,result.config.capital);
  const lo=Math.min(-.01,...a.map(p=>p.drawdown),...b.map(p=>p.drawdown)),hi=0;
  const x=i=>65+i/(a.length-1)*710,y=v=>265-(v-lo)/(hi-lo)*235;
  function node(tag,attrs,text){const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text)n.textContent=text;g.append(n);}
  for(let i=0;i<5;i++){const v=lo+(hi-lo)*i/4;node('line',{x1:65,x2:775,y1:y(v),y2:y(v),class:'chart-grid'});node('text',{x:55,y:y(v)+4,'text-anchor':'end',class:'chart-label'},`${(v*100).toFixed(0)}%`);}
  for(const [series,cls] of [[b,'benchmark-line'],[a,'strategy-line']])node('path',{d:series.map((p,i)=>`${i?'L':'M'}${x(i).toFixed(2)},${y(p.drawdown).toFixed(2)}`).join(' '),class:cls});
  const split=a.findIndex(point=>point.date===result.config.testStart);
  if(split>=0)node('line',{x1:x(split),x2:x(split),y1:30,y2:265,class:'split-line'});
  node('text',{x:65,y:295,class:'chart-label'},a[0].date);node('text',{x:775,y:295,'text-anchor':'end',class:'chart-label'},a.at(-1).date);
}
function render(experiment) {
  current=experiment;const r=current.result,s=r.strategy.metrics,b=r.benchmark.metrics;
  $('#empty').hidden=true;$('#results').hidden=false;
  const strategyNames={hold:'Buy and hold',momentum:'Time-series momentum',sma:'Moving-average trend filter'};
  $('#result-title').textContent=`${current.data.ticker} / ${strategyNames[r.config.strategy]}`;
  $('#range').textContent=`${r.strategy.curve[0].date} → ${r.strategy.curve.at(-1).date}`;
  $('#metrics').replaceChildren();
  const defs=[['Total return','totalReturn',pct,'Change in portfolio value after modeled costs.'],['Annualized return','annualizedReturn',pct,'Geometric return scaled to 252 trading observations.'],['Sharpe ratio','sharpe',v=>v===null?'N/A':v.toFixed(2),'Daily mean / daily sample deviation × √252; zero risk-free rate.'],['Max drawdown','maxDrawdown',pct,'Largest decline from a prior peak, including starting capital.'],['Volatility','volatility',pct,'Daily sample standard deviation × √252.']];
  for(const [label,key,format,help] of defs){const box=el('div','','metric');box.title=help;box.tabIndex=0;box.setAttribute('aria-label',`${label}: ${format(s[key])}. ${help}`);box.append(el('span',label),el('strong',format(s[key])),el('p',`B&H ${format(b[key])}`));$('#metrics').append(box);}
  $('#parameter-results').hidden=!r.parameterComparison;
  $('#parameter-ranking').replaceChildren();
  if(r.parameterComparison){const p=r.parameterComparison;$('#parameter-summary').textContent=`Compared ${p.configurationsTried} configurations on ${p.trainingStart} → ${p.trainingEnd}. Lookback ${p.selectedLookback} ranked first by training return and was then evaluated on the untouched test period.`;p.results.forEach((candidate,index)=>{const tr=el('tr','',index===0?'test-row':'');for(const value of [index+1,candidate.lookback,pct(candidate.totalReturn),candidate.sharpe===null?'N/A':candidate.sharpe.toFixed(2),pct(candidate.maxDrawdown),candidate.trades])tr.append(el('td',value));$('#parameter-ranking').append(tr);});}
  $('#period-comparison').hidden=!r.periods;
  $('#periods').replaceChildren();
  if(r.periods)for(const [key,label] of [['training','Training'],['test','Test']]){const period=r.periods[key],tr=el('tr','',key==='test'?'test-row':'');for(const value of [label,`${period.start} → ${period.end}`,pct(period.strategy.totalReturn),pct(period.benchmark.totalReturn),period.strategy.sharpe===null?'N/A':period.strategy.sharpe.toFixed(2),pct(period.strategy.maxDrawdown)])tr.append(el('td',value));$('#periods').append(tr);}
  $('#walk-forward-results').hidden=!r.walkForward;
  $('#walk-forward-folds').replaceChildren();
  if(r.walkForward){const w=r.walkForward;$('#walk-forward-summary').textContent=`${w.folds.length} non-overlapping test folds · compounded strategy return ${pct(w.strategyReturn)} vs. ${pct(w.benchmarkReturn)} buy and hold · ${w.winningFolds}/${w.folds.length} folds beat the benchmark.`;for(const fold of w.folds){const tr=el('tr','');for(const value of [fold.number,`${fold.trainingStart} → ${fold.trainingEnd}`,`${fold.testStart} → ${fold.testEnd}`,fold.testObservations,pct(fold.strategy.totalReturn),pct(fold.benchmark.totalReturn),fold.strategy.sharpe===null?'N/A':fold.strategy.sharpe.toFixed(2)])tr.append(el('td',value));$('#walk-forward-folds').append(tr);}}
  $('#cost-sensitivity-results').hidden=!r.costSensitivity;
  $('#cost-scenarios').replaceChildren();
  if(r.costSensitivity){const c=r.costSensitivity;$('#cost-sensitivity-summary').textContent=`Same strategy, lookback, dates, and capital rerun across ${c.scenarios.length} fee/slippage combinations. Rows are ordered by fee then slippage, not performance.`;for(const scenario of c.scenarios){const selected=scenario.feeBps===c.selectedFeeBps&&scenario.slippageBps===c.selectedSlippageBps,tr=el('tr','',selected?'test-row':'');for(const value of [`${scenario.feeBps} bps`,`${scenario.slippageBps} bps`,pct(scenario.totalReturn),scenario.testReturn===null?'N/A':pct(scenario.testReturn),pct(scenario.benchmarkReturn),money(scenario.costs),money(scenario.slippageCosts),money(scenario.finalValue),scenario.trades])tr.append(el('td',value));$('#cost-scenarios').append(tr);}}
  draw(r);
  drawDrawdown(r);
  const testSummary=r.periods?` Out-of-sample test return: ${pct(r.periods.test.strategy.totalReturn)} vs. ${pct(r.periods.test.benchmark.totalReturn)} for buy and hold.`:'';
  $('#interpretation').textContent=`Final value ${money(s.finalValue)} vs. ${money(b.finalValue)} for buy and hold. Strategy fees: ${money(r.strategy.costs)}; modeled slippage: ${money(r.strategy.slippageCosts)}. Full-period difference: ${((s.totalReturn-b.totalReturn)*100).toFixed(2)} percentage points.${testSummary}`;
  $('#trade-count').textContent=`${r.strategy.trades.length} executions`;
  $('#trades').replaceChildren();
  for(const t of r.strategy.trades){const tr=el('tr','');for(const v of [t.date,t.side,t.close.toFixed(2),t.price.toFixed(2),t.shares.toFixed(4),t.cost.toFixed(2),t.slippageCost.toFixed(2)])tr.append(el('td',v));$('#trades').append(tr);}
  if(!r.strategy.trades.length){const tr=el('tr','');const td=el('td','No trades. The strategy held cash throughout.');td.colSpan=7;tr.append(td);$('#trades').append(tr);}
}
$('#backtest-form').addEventListener('submit',event=>{
  event.preventDefault();try {
    if(!data)throw new Error('Load a dataset first.');
    const config={strategy:$('#strategy').value,start:$('#start').value,end:$('#end').value,testStart:$('#test-start').value,capital:Number($('#capital').value),lookback:Number($('#lookback').value),feeBps:Number($('#fee').value),slippageBps:Number($('#slippage').value)};
    if($('#compare-parameters').checked)config.parameterLookbacks=$('#parameter-candidates').value.split(',').map(value=>Number(value.trim()));
    if($('#walk-forward').checked)config.walkForwardWindow=Number($('#walk-forward-window').value);
    if($('#cost-sensitivity').checked){config.costSensitivityBps=$('#cost-scenarios-input').value.split(',').map(value=>Number(value.trim()));config.costSensitivitySlippageBps=$('#slippage-scenarios-input').value.split(',').map(value=>Number(value.trim()));}
    const result=backtest(data.rows,config);
    render({id:crypto.randomUUID(),created:new Date().toISOString(),data:{...data,ticker:$('#dataset').value==='csv'?($('#ticker').value.trim()||'CUSTOM'):data.ticker},result});
    status(result.parameterComparison?`Backtest complete. Compared ${result.parameterComparison.configurationsTried} training configurations and selected lookback ${result.config.lookback}.`:'Backtest complete. Results reflect the settings at the time of this run.');
  }catch(error){status(error.message);}
});
$('#walk-forward').addEventListener('change',()=>{$('#walk-forward-window').disabled=!$('#walk-forward').checked;});
$('#cost-sensitivity').addEventListener('change',()=>{const hidden=!$('#cost-sensitivity').checked;$('#cost-scenarios-field').hidden=hidden;$('#slippage-scenarios-field').hidden=hidden;});
$('#compare-parameters').addEventListener('change',()=>{
  $('#parameter-candidates-field').hidden=!$('#compare-parameters').checked;
  $('#lookback').disabled=$('#compare-parameters').checked||$('#strategy').value==='hold';
});
$('#strategy').addEventListener('change',()=>{
  const strategy=$('#strategy').value;
  if(strategy==='hold')$('#compare-parameters').checked=false;
  $('#compare-parameters').disabled=strategy==='hold';
  $('#parameter-candidates-field').hidden=!$('#compare-parameters').checked;
  $('#lookback').disabled=strategy==='hold'||$('#compare-parameters').checked;
  $('#lookback').min=strategy==='sma'?'2':'1';
  if(strategy==='sma' && Number($('#lookback').value)<2)$('#lookback').value='2';
  $('#rule').textContent={
    hold:'Buy at the first selected close and hold through the final close.',
    momentum:'Own the asset when its prior closing price is above its close N sessions earlier. Otherwise, hold cash.',
    sma:'Own the asset when the prior close is strictly above the average of the previous N closes (N ≥ 2). Otherwise, hold cash.'
  }[strategy];
});
$('#dataset').addEventListener('change',()=>{
  const custom=$('#dataset').value==='csv';$('#import-fields').hidden=!custom;$('#check-data').hidden=custom;$('#freshness').textContent='';
  if(!custom && bundled)setData(bundled);else{data=null;current=null;$('#results').hidden=true;$('#empty').hidden=false;$('#run').disabled=true;$('#csv').value='';$('#data-note').textContent='Import a daily price series to begin.';status('Choose a CSV file.');}
});
$('#csv').addEventListener('change',async()=>{try{const f=$('#csv').files[0];if(!f)return;if(f.size>2000000)throw new Error('Choose a CSV smaller than 2 MB.');const rows=parseCSV(await f.text());setData({ticker:$('#ticker').value.trim()||'CUSTOM',source:`User CSV: ${f.name}`,retrieved:new Date().toISOString(),priceBasis:'User supplied; adjustment and daily frequency not independently verified.',rows});}catch(e){data=null;$('#run').disabled=true;status(e.message);}});
function download(content,type,name){const url=URL.createObjectURL(new Blob([content],{type}));const a=el('a','');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#export').addEventListener('click',()=>{if(current)download(JSON.stringify(current,null,2),'application/json',`orion-${current.id}.json`);});
$('#export-csv').addEventListener('click',()=>{if(!current)return;const r=current.result;const csv=['date,strategy_equity,benchmark_equity,cash,units',...r.strategy.curve.map((p,i)=>[p.date,p.equity,r.benchmark.curve[i].equity,p.cash,p.shares].join(','))].join('\n');download(csv,'text/csv',`orion-equity-${current.id}.csv`);});
function saved(){const value=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(value))throw new Error('Invalid archive');return value.map(restoreExperiment);}
function showComparison(runs){const selected=[...document.querySelectorAll('[data-compare]:checked')].map(input=>runs.find(run=>run.id===input.value)).filter(Boolean),section=$('#comparison');if(selected.length<2){section.hidden=true;return;}try{const compared=comparison(selected);section.hidden=false;$('#comparison-head').replaceChildren(el('th','Metric'));for(const run of compared)$('#comparison-head').append(el('th',`${run.ticker} · ${run.strategy}`));const metrics=[['Period',run=>`${run.start} → ${run.end}`],['Test starts',run=>run.testStart||'Not split'],['Training return',run=>run.trainingReturn===null?'N/A':pct(run.trainingReturn)],['Test return',run=>run.testReturn===null?'N/A':pct(run.testReturn)],['Full-period return',run=>pct(run.totalReturn)],['Annualized return',run=>pct(run.annualizedReturn)],['Sharpe',run=>run.sharpe===null?'N/A':run.sharpe.toFixed(2)],['Max drawdown',run=>pct(run.maxDrawdown)],['Volatility',run=>pct(run.volatility)],['Final value',run=>money(run.finalValue)]];$('#comparison-body').replaceChildren();for(const [label,format] of metrics){const tr=el('tr','');tr.append(el('th',label));for(const run of compared)tr.append(el('td',format(run)));$('#comparison-body').append(tr);}}catch(error){section.hidden=true;status(error.message);}}
function archive(){try{const runs=saved();$('#saved').replaceChildren();if(!runs.length)$('#saved').append(el('p','No saved experiments yet. Run a backtest, save it, or import an exported JSON file.','fine'));for(const e of runs){const row=el('div','','saved-row'),label=el('label','','compare-choice'),compare=document.createElement('input');compare.type='checkbox';compare.value=e.id;compare.dataset.compare='';compare.setAttribute('aria-label',`Compare ${e.data.ticker} ${e.result.config.strategy} run`);compare.addEventListener('change',()=>{const checked=document.querySelectorAll('[data-compare]:checked');if(checked.length>3){compare.checked=false;status('Compare up to three experiments at a time.');}showComparison(runs);});label.append(compare,el('span',`${e.data.ticker} · ${e.result.config.strategy} · ${e.result.config.start} → ${e.result.config.end}`));row.append(label);const open=el('button','Load run');open.addEventListener('click',()=>{render(e);status('Saved run restored. Form settings apply to your next run.');$('#results').scrollIntoView({block:'start'});});row.append(open);$('#saved').append(row);}showComparison(runs);}catch{$('#saved').textContent='Browser storage is unavailable or damaged. Use JSON export to retain your experiments.';$('#comparison').hidden=true;}}
$('#save').addEventListener('click',()=>{if(!current)return;try{const runs=saved().filter(e=>e.id!==current.id);localStorage.setItem(key,JSON.stringify([current,...runs].slice(0,10)));archive();status('Experiment saved in this browser.');}catch{status('Could not save to browser storage. Export JSON to keep this experiment.');}});
$('#import-experiment').addEventListener('change',async()=>{try{const file=$('#import-experiment').files[0];if(!file)return;if(file.size>MAX_IMPORTED_BYTES)throw new Error('Choose an experiment JSON file smaller than 5 MB.');const imported=restoreExperiment(JSON.parse(await file.text())),runs=saved().filter(run=>run.id!==imported.id);localStorage.setItem(key,JSON.stringify([imported,...runs].slice(0,10)));archive();render(imported);status(`Imported and verified ${file.name}. Results were recomputed from its saved data.`);$('#results').scrollIntoView({block:'start'});}catch(error){status(`Could not import experiment: ${error.message}`);}finally{$('#import-experiment').value='';}});
async function loadPublishedData(initial = false) {
  const button=$('#check-data');button.disabled=true;
  try {
    const response=await fetch('/assets/quant/spy.json',{cache:'no-store'});
    if(!response.ok)throw new Error('Dataset request failed');
    const next=await response.json();validateRows(next.rows);
    if(next.ticker!=='SPY')throw new Error('Unexpected dataset');
    const changed=JSON.stringify(bundled?.rows)!==JSON.stringify(next.rows);
    bundled=next;
    if($('#dataset').value==='spy') {
      if(initial || changed)setData(bundled);
      else {data=bundled;showFreshness(bundled);}
      if(!initial)status(changed?'Updated data loaded. Run a new backtest.':'You have the latest published dataset. New daily prices appear after the scheduled refresh.');
    }
  } catch {
    status(data?'Update check failed. Your loaded data and results are unchanged.':'Daily data could not load. Reload or import a CSV.');
  } finally {button.disabled=false;}
}
$('#check-data').addEventListener('click',()=>loadPublishedData());
await loadPublishedData(true);
archive();
