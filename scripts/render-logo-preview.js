const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const root = path.resolve(__dirname, '..');
const input = path.join(root, 'public', 'assets', 'logo-concepts.svg');
const output = path.join(root, 'public', 'assets', 'logo-concepts.png');

async function main() {
  await app.whenReady();

  const win = new BrowserWindow({
    width: 1280,
    height: 420,
    show: false,
    transparent: false,
    webPreferences: {
      offscreen: true,
      sandbox: true,
    },
  });

  await win.loadFile(input);
  const image = await win.webContents.capturePage();
  fs.writeFileSync(output, image.toPNG());
  win.destroy();
  app.quit();
  console.log(output);
}

main().catch(error => {
  console.error(error);
  app.exit(1);
});
