const fs = require('fs');
const path = require('path');

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
      const content = fs.readFileSync(p, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (
          (line.includes('style={`') ||
           line.includes('style="') ||
           line.includes('style={""') ||
           line.includes("style={''") ||
           line.includes('style={filled()') ||
           line.includes('style={props.fill') ||
           line.includes('return `--') ||
           line.includes('return `left:') ||
           line.includes('return `transform:')) &&
          !line.includes('font-style="')
        ) {
          console.log(`${p}:${i+1}: ${line.trim()}`);
        }
      });
    }
  }
}

walk('src');
