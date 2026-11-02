'use client';
// A typeset formula as the server drew it (handoff-1102/MATHTEX-SPEC.md section 5). The HTML comes from
// data/keycards_tex.js on the server (servedTex: prose escaped, math through KaTeX with trust off and a forbidden-command
// check), so only KaTeX's stylesheet and fonts reach the browser, never its JS. KaTeX keeps a MathML copy for screen readers.
//   <TexHtml html as className id />    `as` the wrapper element (span by default); its class is "kc-tex" plus className
import 'katex/dist/katex.min.css';

export function TexHtml({ html, as: Tag = 'span', className = '', id }) {
  return <Tag className={`kc-tex ${className}`.trim()} id={id} dangerouslySetInnerHTML={{ __html: html }} />;
}
