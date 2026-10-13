import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MARKET_INSTRUMENTS, buildMarketObservations, summarizePrices, momentumSignal,
  marketFlowCoverage,
} from '../src/lib/marketFlowIntelligence.ts';

const now=Date.parse('2026-10-13T18:00:00Z');
const makePoints=(price=100,count=85,older=95)=>{
  const end=Math.floor(Date.parse('2026-10-13T16:00:00Z')/1000);
  return Array.from({length:count},(_,i)=>({
    at:end-(count-1-i)*86400,
    price:i===count-1?price:older,
  }));
};

test('require enough sessions for each price comparison',()=>{
  const one=summarizePrices(makePoints(110,22),now);
  assert.equal(one.oneMonthPct,15.79);
  assert.equal(one.threeMonthsPct,null);
  const both=summarizePrices(makePoints(110,64),now);
  assert.equal(both.oneMonthPct,15.79);
  assert.equal(both.threeMonthsPct,15.79);
});

test('stale observation never silently turns into a trend',()=>{
  const stale=makePoints(110,85).map(p=>({...p,at:p.at-30*86400}));
  const result=summarizePrices(stale,now);
  assert.equal(result.oneMonthPct,null);
  assert.equal(result.threeMonthsPct,null);
  assert.match(result.reason,'古い');
});

test('missing SPY benchmark leaves relative ranking unknown',()=>{
  const o=buildMarketObservations({qqq:{points:makePoints(),priceBasis:'raw'}},now);
  assert.equal(o.find(x=>x.key==='qqq').relativeOneMonthPp,null);
  assert.equal(o.find(x=>x.key==='qqq').signal,'unknown');
  assert.equal(marketFlowCoverage(o).relative,0);
});

test('relative strength uses percentage point difference, not a fund flow estimate',()=>{
  const samples={
    spy:{points:makePoints(100,85,100),priceBasis:'adjusted'},
    qqq:{points:makePoints(112,85,100),priceBasis:'adjusted'},
    iwm:{points:makePoints(90,85,100),priceBasis:'adjusted'},
  };
  const results=buildMarketObservations(samples,now);
  const qqq=results.find(x=>x.key==='qqq');
  const iwm=results.find(x=>x.key==='iwm');
  assert.equal(qqq.relativeOneMonthPp,12);
  assert.equal(qqq.relativeThreeMonthsPp,12);
  assert.equal(qqq.signal,'persistent');
  assert.equal(iwm.signal,'lagging');
  assert.equal(results.length,MARKET_INSTRUMENTS.length);
  assert.equal(marketFlowCoverage(results).relative,3);
});

test('3pp signal thresholds, emerging setup and unknown are deterministic',()=>{
  assert.equal(momentumSignal(3,3),'persistent');
  assert.equal(momentumSignal(4,-1),'emerging');
  assert.equal(momentumSignal(-3,-3),'lagging');
  assert.equal(momentumSignal(1,1),'mixed');
  assert.equal(momentumSignal(6,null),'unknown');
});

test('mismatched session timestamps prevent spurious benchmark comparison',()=>{
  const samples={
    spy:{points:makePoints(100),priceBasis:'adjusted'},
    qqq:{points:makePoints(110).map(p=>({...p,at:p.at-5*86400})),priceBasis:'raw'},
  };
  const res=buildMarketObservations(samples,now);
  assert.equal(res.find(x=>x.key==='qqq').relativeOneMonthPp,null);
});
