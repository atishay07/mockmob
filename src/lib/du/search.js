// Finds CUET subjects from the name a student knows their Class 12 subject by.
// DU/NTA count papers listed together (for example Computer Science and Informatics
// Practices) as ONE subject, so "informatics" or "IP" must lead to that single entry.

function norm(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Returns matching subject ids and, for each, the alias the query matched (when it differs
// from the first word of the official name) so the UI can say "counted as ...".
export function searchSubjects(query, catalog) {
  const q = norm(query);
  const out = { languages: [], domains: [], hits: {} };
  if (q.length < 2) return out;
  const test = (entry) => {
    // Aliases first, so a query like "informatics" reports the alias the student meant.
    const names = [...(entry.aliases || []), entry.name];
    for (const name of names) {
      const n = norm(name);
      // whole-word prefix match: "info" -> "informatics practices"; "ip" -> alias "IP"
      if (n === q || n.startsWith(q) || n.split(' ').some((w) => w.startsWith(q))) return name;
    }
    return null;
  };
  for (const l of catalog.languages) {
    const hit = test(l);
    if (hit) out.languages.push(l.id);
  }
  for (const d of catalog.domains) {
    const hit = test(d);
    if (hit) {
      out.domains.push(d.id);
      out.hits[d.id] = hit;
    }
  }
  return out;
}
