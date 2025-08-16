// Simple HTTP server to host the dynamic hierarchy test
// Accessible on local network at http://[your-ip]:3030

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3030;

// Get local IP addresses
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  
  return ips;
}

// MIME types for different file extensions
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon'
};

// Simple HTTP server
const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  // Enable CORS for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Determine file path
  let filePath = '.';
  if (req.url === '/') {
    filePath = './test-dynamic-hierarchy.html';
  } else {
    filePath = '.' + req.url;
  }
  
  // Get file extension for MIME type
  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeType = mimeTypes[extname] || 'application/octet-stream';
  
  // Read and serve file
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // File not found
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <head><title>404 - Not Found</title></head>
            <body>
              <h1>404 - File Not Found</h1>
              <p>The requested file <code>${req.url}</code> was not found.</p>
              <p><a href="/">← Back to Dynamic Hierarchy Test</a></p>
            </body>
          </html>
        `);
      } else {
        // Server error
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      // Success - serve the file
      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(content, 'utf-8');
    }
  });
});

// Start server
server.listen(PORT, () => {
  const localIPs = getLocalIPs();
  
  console.log('🌐 Dynamic Hierarchy Test Server Started!');
  console.log('=====================================');
  console.log(`📡 Port: ${PORT}`);
  console.log('🖥️  Local Access:');
  console.log(`   http://localhost:${PORT}`);
  console.log(`   http://127.0.0.1:${PORT}`);
  
  if (localIPs.length > 0) {
    console.log('🌍 Network Access:');
    localIPs.forEach(ip => {
      console.log(`   http://${ip}:${PORT}`);
    });
  }
  
  console.log('=====================================');
  console.log('📱 On mobile devices or other computers on your network:');
  console.log(`   Use any of the network addresses above`);
  console.log('🛑 To stop server: Press Ctrl+C');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server stopped successfully');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  server.close(() => {
    console.log('✅ Server stopped successfully');
    process.exit(0);
  });
});