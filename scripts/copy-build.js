const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../frontend/dist');
const destDir = path.join(__dirname, '../backend/public');

function copyFolderSync(from, to) {
  if (!fs.existsSync(from)) {
    console.warn(`Source folder does not exist: ${from}`);
    return;
  }
  if (fs.existsSync(to)) {
    fs.rmSync(to, { recursive: true, force: true });
  }
  fs.mkdirSync(to, { recursive: true });
  
  fs.readdirSync(from).forEach(element => {
    const srcElement = path.join(from, element);
    const destElement = path.join(to, element);
    
    if (fs.lstatSync(srcElement).isDirectory()) {
      copyFolderSync(srcElement, destElement);
    } else {
      fs.copyFileSync(srcElement, destElement);
    }
  });
}

console.log('🚀 Copying frontend/dist assets into backend/public...');
copyFolderSync(srcDir, destDir);
console.log('✅ Assets copied successfully!');
