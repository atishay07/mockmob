import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestEmail, TYPO_COPY } from './emailTypo.mjs';

test('O9: the common slips of the big mail services are caught, the name before @ kept as typed', () => {
  const cases = {
    'asha@gmial.com': 'asha@gmail.com',
    'asha@gmal.com': 'asha@gmail.com',
    'asha@gamil.com': 'asha@gmail.com',
    'asha@gmai.com': 'asha@gmail.com',
    'asha@gmail.co': 'asha@gmail.com',
    'asha@gmail.con': 'asha@gmail.com',
    'asha@gmail.cm': 'asha@gmail.com',
    'asha@gmail.in': 'asha@gmail.com',
    'asha@gmail.com.': 'asha@gmail.com',
    'asha@gmail': 'asha@gmail.com',
    'Asha.K99@GMIAL.COM': 'Asha.K99@gmail.com',
    '  asha@gmial.com  ': 'asha@gmail.com',
    'asha@yahooo.com': 'asha@yahoo.com',
    'asha@yaho.com': 'asha@yahoo.com',
    'asha@yaho.co.in': 'asha@yahoo.co.in',
    'asha@yahoo.con': 'asha@yahoo.com',
    'asha@hotmial.com': 'asha@hotmail.com',
    'asha@outlok.com': 'asha@outlook.com',
    'asha@outlook.con': 'asha@outlook.com',
    'asha@iclod.com': 'asha@icloud.com',
    'asha@redifmail.com': 'asha@rediffmail.com',
  };
  for (const [typed, meant] of Object.entries(cases)) assert.equal(suggestEmail(typed), meant, typed);
});

test('O9: a right address, an unknown domain or a real ending is never questioned', () => {
  for (const typed of [
    'asha@gmail.com', 'Asha@Gmail.com', 'asha@yahoo.com', 'asha@yahoo.in', 'asha@yahoo.co.in', 'asha@yahoo.co.uk',
    'asha@hotmail.com', 'asha@hotmail.co.uk', 'asha@outlook.com', 'asha@outlook.in', 'asha@icloud.com', 'asha@rediffmail.com',
    'asha@ymail.com', 'asha@mail.com', 'asha@gmx.com', 'asha@live.com', 'asha@me.com', 'asha@rediff.com', 'asha@protonmail.com',
    'asha@dpsrkp.net', 'asha@student.du.ac.in', 'asha@gm.com', 'asha@yahoo.co', 'asha@hotmail.co',
    '', 'asha', 'asha@', '@gmial.com', 'as ha@gmial .com', null, undefined,
  ]) assert.equal(suggestEmail(typed), null, String(typed));
});

test('O9: the line and its two keys', () => {
  assert.equal(TYPO_COPY.line('asha@gmail.com'), 'Did you mean asha@gmail.com?');
  assert.equal(TYPO_COPY.use, 'Use this');
  assert.equal(TYPO_COPY.keep, 'No, send it');
});
