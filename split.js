const fs = require('fs');
const path = require('path');

const srcDir = path.join(process.cwd(), 'src/app');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(srcDir, filePath);
  
  if (content.includes('"use client"') || content.includes("'use client'")) {
    const defaultExportMatch = content.match(/export default function\s+([A-Za-z0-9_]+)/);
    if (!defaultExportMatch) {
      console.log('No default export function in', filePath);
      return;
    }
    const compName = defaultExportMatch[1];
    const clientCompName = compName + 'Client';
    
    // Replace the default export name
    content = content.replace(`export default function ${compName}`, `export default function ${clientCompName}`);
    
    const clientFileName = `${clientCompName}.jsx`;
    const clientFilePath = path.join(path.dirname(filePath), clientFileName);
    fs.writeFileSync(clientFilePath, content);
    
    const isLayout = path.basename(filePath) === 'layout.js';
    let newPageContent = ``;
    
    // Add force-dynamic to anything except the root page/layout if not already there
    if (!isLayout && relPath !== 'page.js') {
      newPageContent += `export const dynamic = "force-dynamic";\n\n`;
    }
    
    newPageContent += `import ${clientCompName} from './${clientCompName}';\n\n`;
    
    if (isLayout) {
        newPageContent += `export default function ${compName}({ children }) {\n  return <${clientCompName}>{children}</${clientCompName}>;\n}\n`;
    } else {
        newPageContent += `export default function ${compName}() {\n  return <${clientCompName} />;\n}\n`;
    }
    fs.writeFileSync(filePath, newPageContent);
    console.log(`Processed (split) ${filePath}`);
  } else {
     // If it's already a server component and not layout, maybe add export const dynamic = 'force-dynamic';
     if (filePath.endsWith('page.js') && relPath !== 'page.js' && !content.includes('force-dynamic')) {
         fs.writeFileSync(filePath, `export const dynamic = "force-dynamic";\n` + content);
         console.log(`Added force-dynamic to ${filePath}`);
     }
  }
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (file === 'page.js' || (fullPath.includes('(app)') && file === 'layout.js')) {
      processFile(fullPath);
    }
  }
}

walk(srcDir);
