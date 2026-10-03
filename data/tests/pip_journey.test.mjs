import test from 'node:test';
import assert from 'node:assert/strict';
import {stationIndex} from '../../src/components/brand/pipJourney.js';
test('fast forward and reverse jumps select the final ordered station',()=>{
 const anchors=[100,1800,3100,7000,14000];
 assert.equal(stationIndex(anchors,15000,0),4);
 assert.equal(stationIndex(anchors,0,4),0);
 assert.equal(stationIndex(anchors,7200,0),3);
});
test('hysteresis prevents bouncing at a boundary and gaps retain a station',()=>{
 assert.equal(stationIndex([100,1100],620,0),0);
 assert.equal(stationIndex([100,1100],640,0),1);
 assert.equal(stationIndex([100,1100],580,1),1);
 assert.equal(stationIndex([100,1100],560,1),0);
 assert.equal(stationIndex([],100),-1);
});
