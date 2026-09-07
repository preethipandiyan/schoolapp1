const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const apkPath = path.join(__dirname, 'mobile', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

http.createServer((req, res) => {
  if (fs.existsSync(apkPath)) {
    const stat = fs.statSync(apkPath);
    res.writeHead(200, {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': stat.size,
      'Content-Disposition': 'attachment; filename="zuna-school-app.apk"',
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(apkPath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<h1>APK Building...</h1><p>Please refresh this page in a few seconds once the APK compilation finishes.</p>');
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`APK Server active at http://0.0.0.0:${PORT}`);
});
