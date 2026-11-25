import io, json
edits = [[
"""  if (source !== 'touch') nudge(s, next > from ? 1 : -1);""",
"""  // A picked step (a rail key, an arrow) gets no nudge (owner, 25 Nov 2026: on desktop "whenever clicking any rectangle
  // button, the button jumps ... and then comes back"): the nudge moves the whole stage 10 px, and the key that was just
  // pressed sits on that stage, so it jumped under the pointer. A wheel or a keyboard step keeps it (no key is under a pointer).
  if (source !== 'touch' && source !== 'pick') nudge(s, next > from ? 1 : -1);"""]]
io.open('tmp/1126-final/e1.json','w',encoding='utf-8').write(json.dumps(edits))
