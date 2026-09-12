#!/usr/bin/env node
/* =========================================================================
 * qmhub.cc.cd · 《灵兽家族》接入补丁工具 (patch-index.js)
 * ---------------------------------------------------------------------
 * 作用：把「宣传海报 + 灵兽家族入口」接入既有的论坛 index.html。
 *      只注入 1 行 <script>，其余全部由 qm-boot.js 在运行时完成
 *      （注入样式 / 创建海报挂载点 / 加载海报组件 / 加玩法中心入口）。
 *
 * 特性：
 *   · 幂等 —— 重复执行不会重复注入
 *   · 安全 —— 默认先备份 index.html.bak，且绝不改动其它任何内容
 *   · 零依赖 —— 只用 Node 内置模块，Node 14+ 即可
 *
 * 用法：
 *   node tools/patch-index.js                          # 就地修补 ./index.html
 *   node tools/patch-index.js _repo78/index.html       # 修补指定文件
 *   node tools/patch-index.js --restore                # 从 .bak 还原
 *   node tools/patch-index.js --check                  # 只检查是否已接入
 * ========================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const SNIPPET = '<script src="assets/js/qm-boot.js"></script>';
const MARKER = 'qm-boot.js';

const argv = process.argv.slice(2);
const flags = argv.filter(a => a.startsWith('--'));
const args = argv.filter(a => !a.startsWith('--'));
const target = path.resolve(args[0] || 'index.html');
const bakPath = target + '.bak';

function log(msg) { console.log(msg); }
function die(msg) { console.error('❌ ' + msg); process.exit(1); }

/* ---------------------------------------------------------------- 还原 */
if (flags.includes('--restore')) {
  if (!fs.existsSync(bakPath)) die('找不到备份文件：' + bakPath);
  fs.copyFileSync(bakPath, target);
  log('✅ 已从备份还原：' + target);
  process.exit(0);
}

if (!fs.existsSync(target)) die('找不到文件：' + target + '\n   请在项目根目录执行，或把 index.html 的路径作为第一个参数传入。');

const html = fs.readFileSync(target, 'utf8');

/* ---------------------------------------------------------------- 检查 */
if (flags.includes('--check') || html.includes(MARKER)) {
  if (html.includes(MARKER)) {
    log('ℹ️  已接入（检测到 ' + MARKER + '），无需重复注入。');
    process.exit(0);
  }
  if (flags.includes('--check')) {
    log('ℹ️  尚未接入。执行 `node tools/patch-index.js` 即可完成。');
    process.exit(0);
  }
}

/* ---------------------------------------------------------------- 定位插入点 */
const bodyClose = html.lastIndexOf('</body>');
if (bodyClose < 0) die('这个文件里找不到 </body>，可能不是完整的 HTML 页面。');

/* 取该行的缩进，保持代码风格一致 */
const lineStart = html.lastIndexOf('\n', bodyClose) + 1;
const indent = (html.slice(lineStart, bodyClose).match(/^[ \t]*/) || [''])[0] || '    ';

const lines = [
  '',
  '    <!-- =====================================================================',
  '         v2 新增：《灵兽家族》玩法接入（一行自举）',
  '         qm-boot.js 会自动完成：注入海报样式 → 创建海报挂载点',
  '         → 加载海报组件与论坛接入层 → 在「玩法中心」插入灵兽家族入口。',
  '         既有 HTML 结构 / CSS / JS 均未被修改，删除本行即可完全回滚。',
  '         ===================================================================== -->',
  '    ' + SNIPPET,
  ''
];

const before = html.slice(0, bodyClose);
const after = html.slice(bodyClose);
/* 保证 </body> 前留一个换行边界 */
const newHtml = before.replace(/\s*$/, '\n') + lines.join('\n').replace(/^\n/, '') + '\n' + after;

/* ---------------------------------------------------------------- 备份 + 写入 */
fs.writeFileSync(bakPath, html);
fs.writeFileSync(target, newHtml);

const added = newHtml.length - html.length;
log('');
log('  ✅ 接入完成');
log('  ────────────────────────────────────────');
log('  目标文件 : ' + target);
log('  备份文件 : ' + bakPath);
log('  新增字节 : ' + added);
log('  注入位置 : 最后一个 </body> 之前');
log('  ────────────────────────────────────────');
log('  回滚方式 : node tools/patch-index.js --restore');
log('');

/* ---------------------------------------------------------------- 顺手体检 */
const warn = [];
if (!fs.existsSync(path.join(path.dirname(target), 'assets/js/qm-boot.js'))) {
  warn.push('同目录下没有 assets/js/qm-boot.js —— 请确认已经把 assets/ 整个目录上传/拷贝到仓库根目录。');
}
if (!fs.existsSync(path.join(path.dirname(target), 'assets/css/poster.css'))) {
  warn.push('同目录下没有 assets/css/poster.css —— 海报样式会 404。');
}
if (warn.length) {
  log('  ⚠️  提醒：');
  warn.forEach(w => log('     · ' + w));
  log('');
}
