import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyFinancialRisk, summarizeFinancialRisk } from '../src/lib/financialRisk.ts';

const s = (key, level) => ({
  key, label:key, value:1, formatted:'1', monthChange:null, monthChangeUnit:null,
  observedAt:'2026-10-13T00:00:00Z', source:'Test', sourceUrl:'https://example.com',
  level, note:'',
});

test('US yield moves in percentage points convert to basis-point thresholds',()=>{
  assert.equal(classifyFinancialRisk('ust10',5.0,0.39), 'normal');
  assert.equal(classifyFinancialRisk('ust10',5.0,0.40), 'watch');
  assert.equal(classifyFinancialRisk('ust10',5.0,0.75), 'elevated');
  assert.equal(classifyFinancialRisk('ust10',5.0,1.25), 'severe');
});

test('credit spreads have percent units, not basis points',()=>{
  assert.equal(classifyFinancialRisk('credit',3.2,0.1),'normal');
  assert.equal(classifyFinancialRisk('credit',4.5,null),'watch');
  assert.equal(classifyFinancialRisk('credit',6.0,null),'elevated');
  assert.equal(classifyFinancialRisk('credit',8.0,null),'severe');
  assert.equal(classifyFinancialRisk('credit',3.2,2),'elevated');
});

test('VIX, oil, FX and NASDAQ have distinct risk drivers',()=>{
  assert.equal(classifyFinancialRisk('vix',30,null),'elevated');
  assert.equal(classifyFinancialRisk('oil',85,26),'elevated');
  assert.equal(classifyFinancialRisk('usdjpy',150,-8.5),'elevated');
  assert.equal(classifyFinancialRisk('nasdaq',18000,null,-14),'elevated');
  assert.equal(classifyFinancialRisk('nasdaq',18000,null,null),'normal');
});

test('missing data never counts as normal and coverage is explicit',()=>{
  const r=summarizeFinancialRisk([s('ust10','normal'),s('oil','unknown'),s('credit','unknown'),s('vix','severe')]);
  assert.equal(r.level,'unknown');
  assert.equal(r.coverage,2);
  assert.equal(r.expected,4);
});

test('aggregate red requires several simultaneous stress signals including credit/VIX',()=>{
  assert.equal(summarizeFinancialRisk([
    s('ust10','severe'),s('oil','severe'),s('gold','severe'),
    s('credit','normal'),s('vix','normal'),s('nasdaq','normal'),s('usdjpy','normal'),
  ]).level,'elevated');
  assert.equal(summarizeFinancialRisk([
    s('ust10','severe'),s('oil','severe'),s('vix','severe'),
    s('credit','normal'),s('nasdaq','normal'),s('usdjpy','normal'),
  ]).level,'severe');
  assert.equal(summarizeFinancialRisk([
    s('ust10','normal'),s('oil','normal'),s('vix','normal'),
    s('credit','normal'),s('nasdaq','normal'),s('usdjpy','normal'),
  ]).level,'normal');
});
