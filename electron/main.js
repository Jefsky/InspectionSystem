const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const isDev = process.env.NODE_ENV === 'development';
const serverProcess = require('path').join(__dirname, '../server/index.js');

let mainWindow;
let serverInstance;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../public/favicon.ico')
  });

  // 在开发环境中加载开发服务器URL，在生产环境中加载打包后的文件
  if (isDev) {
    mainWindow.loadURL('http://localhost:3002');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

function startServer() {
  console.log('Starting server...');
  serverInstance = spawn('node', [serverProcess]);
  
  serverInstance.stdout.on('data', (data) => {
    console.log(`Server stdout: ${data}`);
  });
  
  serverInstance.stderr.on('data', (data) => {
    console.error(`Server stderr: ${data}`);
  });
  
  serverInstance.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
  });
}

app.on('ready', () => {
  startServer();
  setTimeout(createWindow, 1000); // 给服务器一些启动时间
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

app.on('before-quit', () => {
  if (serverInstance) {
    console.log('Killing server process...');
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', serverInstance.pid, '/f', '/t']);
    } else {
      serverInstance.kill('SIGINT');
    }
  }
});
