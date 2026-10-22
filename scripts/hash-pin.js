import {hashPin} from '../src/auth.js';
const pin=process.argv[2];
if (!pin) {console.error('Usage: npm run pin -- 123456 (choose a private 6+ digit PIN; never commit its hash to Git)');process.exit(1);}
console.log(`PIN_HASH=${hashPin(pin)}`);
