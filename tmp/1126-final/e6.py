import io, json
edits = [[
"""    const key = `${subjectId}|${window.innerWidth}`;""",
"""    // One width, one floor (26 Nov 2026): starting again for each paper let the place shrink when the paper changed, and the
    // browser then moved the page to keep its anchor, so the stream tab that was just pressed jumped 26 px on desktop.
    const key = String(window.innerWidth);"""]]
io.open('tmp/1126-final/e6.json','w',encoding='utf-8').write(json.dumps(edits))
