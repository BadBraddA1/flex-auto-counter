import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "../test/form.html");
const port = Number(process.env.PORT || 8765);

const server = http.createServer((req, res) => {
  if (req.url !== "/" && req.url !== "/index.html") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const html = fs.readFileSync(htmlPath);
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});

server.listen(port, () => {
  console.log(`Flex test form: http://localhost:${port}`);
  console.log("1. Open that URL and click Serial Number");
  console.log("2. In another terminal (stencil only):");
  console.log('   /flexac -n "USB Drive" -c 5 -l 40 --countdown 3');
  console.log("   Or with operator serials:");
  console.log('   /flexac -n "USB Drive" -c 5 -l 40 --with-serial');
});
