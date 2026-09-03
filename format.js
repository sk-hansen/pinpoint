// Shared Markdown formatting (loaded by both content script and popup).
function efFormatAnnotation(a, index) {
  const lines = [];
  lines.push(`## ${index}. \`${a.selector}\``);
  lines.push("");
  if (a.comment) {
    lines.push(a.comment);
    lines.push("");
  }
  lines.push(`- **Page:** ${a.url}`);
  lines.push(`- **Viewport:** ${a.viewport.w}\u00d7${a.viewport.h}`);
  lines.push(`- **Device pixel ratio:** ${a.dpr}`);
  lines.push(`- **Position:** X ${a.position.x}, Y ${a.position.y}`);
  lines.push(`- **Size:** ${a.size.w}\u00d7${a.size.h}`);
  if (a.source) lines.push(`- **Source:** \`${a.source}\``);
  if (a.html) {
    lines.push("");
    lines.push("```html");
    lines.push(a.html);
    lines.push("```");
  }
  return lines.join("\n");
}

function efFormatAll(annotations, title) {
  const parts = [`# ${title || "Feedback"}`, ""];
  annotations.forEach((a, i) => {
    parts.push(efFormatAnnotation(a, i + 1));
    parts.push("");
  });
  return parts.join("\n").trim() + "\n";
}
