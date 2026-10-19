import {backtest, validateRows} from './engine.js?v=d2130638506f';

export const MAX_IMPORTED_BYTES = 5_000_000;

export function restoreExperiment(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Experiment JSON must contain one exported experiment.');
  }
  const {id, created, data, result} = value;
  if (typeof id !== 'string' || !id || typeof created !== 'string' || !Number.isFinite(Date.parse(created))) {
    throw new Error('Experiment identifier or creation date is invalid.');
  }
  if (!data || typeof data !== 'object' || typeof data.ticker !== 'string' || !data.ticker.trim()) {
    throw new Error('Experiment dataset metadata is invalid.');
  }
  validateRows(data.rows);
  if (!result || typeof result !== 'object' || !result.config) {
    throw new Error('Experiment settings are missing.');
  }
  const recalculated = backtest(data.rows, result.config);
  return {id, created: new Date(created).toISOString(), data: {...data, ticker: data.ticker.trim().slice(0, 20)}, result: recalculated};
}

export function comparison(experiments) {
  if (!Array.isArray(experiments) || experiments.length < 2 || experiments.length > 3) {
    throw new Error('Choose two or three experiments to compare.');
  }
  return experiments.map(experiment => {
    const restored = restoreExperiment(experiment), metrics = restored.result.strategy.metrics;
    return {id:restored.id,ticker:restored.data.ticker,strategy:restored.result.config.strategy,start:restored.result.config.start,end:restored.result.config.end,testStart:restored.result.config.testStart||null,trainingReturn:restored.result.periods?.training.strategy.totalReturn??null,testReturn:restored.result.periods?.test.strategy.totalReturn??null,totalReturn:metrics.totalReturn,annualizedReturn:metrics.annualizedReturn,sharpe:metrics.sharpe,maxDrawdown:metrics.maxDrawdown,volatility:metrics.volatility,finalValue:metrics.finalValue};
  });
}
