import { execFileSync } from "node:child_process";
const staged = execFileSync("git", ["diff","--cached","--name-only","-z"], {encoding:"utf8"}).split("\0").filter(Boolean);
for (const file of staged) {
  if (/(^|\/)\.env($|\.)/.test(file) && file !== ".env.example") {
    console.error("Commit blocked: an environment secret file is staged.");
    process.exit(1);
  }
  if (/(^|\/)(node_modules|\.next|\.vercel)(\/|$)/.test(file) || /\.(pem|key|log)$/.test(file)) {
    console.error("Commit blocked: an artifact or private-key file is staged.");
    process.exit(1);
  }
  if (file === ".env.example") {
    const content = execFileSync("git", ["show", ":"+file], {encoding:"utf8"});
    if (content.split(/\r?\n/).some(line => /^[A-Z][A-Z0-9_]*=.+$/.test(line))) {
      console.error("Commit blocked: .env.example must contain empty values.");
      process.exit(1);
    }
  }
  // Scan staged text without printing potential secrets. Ignore binary files.
  const content = execFileSync("git", ["show", ":"+file], {encoding:"utf8",maxBuffer:16*1024*1024});
  if (!content.includes("\0") && (
    /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(content) ||
    /sb_secret_[A-Za-z0-9_-]{12,}/.test(content) ||
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content))) {
    console.error("Commit blocked: potential secret found in staged content.");
    process.exit(1);
  }
}
console.log("PASS staged check: no secret env files, populated env template, private keys or artifacts.");
