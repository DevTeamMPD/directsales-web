// Step 3: ตรวจว่า session ที่บันทึกไว้ยังล็อกอิน JST อยู่ (headless) — exit 0 = ล็อกอินอยู่, 1 = หลุด
// node check.mjs [--headed]
import { checkSession, loadConfig, parseArgs } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const r = await checkSession(loadConfig(), { headless: !args.headed });
console.log(JSON.stringify(r));
process.exit(r.logged_in ? 0 : 1);
