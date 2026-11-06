// 빌드 뒤에 사이트 파일(JS·CSS 등)을 미리 압축해 둡니다 (.br, .gz).
// Render 무료 서버는 CPU가 아주 작아서, 요청마다 압축하면 2KB 파일도 1~3초씩 걸려요. server.mjs가 이 파일을 그대로 보내요.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const TEXT = /\.(js|css|svg|json|txt|webmanifest|html|map)$/;
let n = 0;
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f);
    else if (TEXT.test(f) && !f.endsWith(".map")) {
      const raw = fs.readFileSync(f);
      if (raw.length < 512) continue;
      fs.writeFileSync(`${f}.br`, zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }));
      fs.writeFileSync(`${f}.gz`, zlib.gzipSync(raw, { level: 9 }));
      n++;
    }
  }
}
walk(".next/static");
console.log(`precompressed ${n} files`);
