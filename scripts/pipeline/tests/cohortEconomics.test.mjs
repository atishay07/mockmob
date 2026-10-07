import test from 'node:test';import assert from 'node:assert/strict';import {measuredEconomics} from '../lib/cohortEconomics.mjs';
const row=(id,approved,gross,more={})=>({id,author_contract:'current',complete:true,pending:0,denominator:100,approved_unique:approved,cost:{gross_usd:gross,held_usd:0},...more});
test('completed comparable cohorts retain failures and preparation is added only once',()=>{
 const m=measuredEconomics([row('a',80,.4),row('b',20,.6),row('old',50,.5,{author_contract:'old'})],{committedUsd:8,usable:150,authorContract:'current'});
 assert.equal(m.completed_denominator,300);assert.equal(m.comparable_denominator,200);assert.equal(m.gross_cost_per_approved_usd,.01);assert.equal(m.conditional_lifetime_to_10000_usd,106.5);
 assert.deepEqual(m.comparable_cohorts,['a','b']);
});
test('partial approvals never become reliability or final unit-cost evidence',()=>{
 const m=measuredEconomics([row('pending',90,.1,{complete:false,pending:10})],{committedUsd:8,usable:50,authorContract:'current'});
 assert.equal(m.comparable_denominator,0);assert.equal(m.gross_cost_per_approved_usd,null);assert.equal(m.estimate_settled,false);
});
test('conservative held costs remain gross and explicitly unsettled',()=>{
 const m=measuredEconomics([row('held',50,.5,{cost:{gross_usd:.5,held_usd:.1}})],{committedUsd:8,usable:50,authorContract:'current'});
 assert.equal(m.gross_cost_per_approved_usd,.01);assert.equal(m.comparable_held_usd,.1);assert.equal(m.estimate_settled,false);
});
