// Fill the menu with N items (default 200). Prices are integer dong.
import { open } from '../src/db.js';

const n = Number(process.argv[2] ?? 200);
const db = open();
const dishes = ['Phở bò', 'Bún chả', 'Cơm tấm', 'Bánh xèo', 'Gỏi cuốn', 'Cà phê sữa', 'Trà đá', 'Chè ba màu'];
const insert = db.prepare('INSERT INTO menu_items (name, price_vnd) VALUES (?, ?)');
db.exec('BEGIN');
for (let i = 0; i < n; i++) insert.run(`${dishes[i % dishes.length]} #${i + 1}`, (30 + Math.floor(Math.random() * 471)) * 500);
db.exec('COMMIT');
console.log(`seeded ${n} menu items`);
