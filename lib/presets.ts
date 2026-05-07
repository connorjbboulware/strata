import type { BacktestRequest } from './types';

export type PresetKey = 'mag7' | 'sixty-forty' | 'sectors';

interface PresetMeta {
  label: string;
  subtitle: string;
}

export const PRESET_META: Record<PresetKey, PresetMeta> = {
  mag7: {
    label: 'Magnificent 7',
    subtitle: 'Mega-cap tech, equal weight, monthly rebalance',
  },
  'sixty-forty': {
    label: '60/40 Portfolio',
    subtitle: 'VTI + BND (60/40), quarterly rebalance',
  },
  sectors: {
    label: 'Sector Rotation',
    subtitle: '9 SPDR sectors, equal weight, quarterly rebalance',
  },
};

function isoYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function buildPreset(key: PresetKey): BacktestRequest {
  const end = isoYesterday();
  switch (key) {
    case 'mag7':
      return {
        strategies: [
          {
            name: 'Magnificent 7',
            tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'],
            weights: 'equal',
            start_date: '2018-01-02',
            end_date: end,
            initial_capital: 10000,
            rebalance_frequency: 'monthly',
          },
        ],
        benchmark: 'SPY',
      };
    case 'sixty-forty':
      return {
        strategies: [
          {
            name: '60/40 Portfolio',
            tickers: ['VTI', 'BND'],
            weights: [0.6, 0.4],
            start_date: '2010-01-04',
            end_date: end,
            initial_capital: 10000,
            rebalance_frequency: 'quarterly',
          },
        ],
        benchmark: 'SPY',
      };
    case 'sectors':
      return {
        strategies: [
          {
            name: 'Sector Rotation',
            tickers: ['XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLP', 'XLY', 'XLB', 'XLU'],
            weights: 'equal',
            start_date: '2015-01-02',
            end_date: end,
            initial_capital: 10000,
            rebalance_frequency: 'quarterly',
          },
        ],
        benchmark: 'SPY',
      };
  }
}
