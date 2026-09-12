/* =========================================================================
 * qmhub.cc.cd · 宣传海报矢量插画库 (QMPosterArt)
 * ---------------------------------------------------------------------
 * 独立模块，零依赖，可被「论坛首页」与「灵兽世界」同时引用。
 * 所有插画均为纯 SVG 路径：
 *   · 无位图请求 -> 任意屏幕 / 任意 DPI 都锐利
 *   · 单主题体积 ~4KB -> 对首屏加载几乎无影响
 *   · preserveAspectRatio="xMidYMid slice" -> 任意容器比例都可铺满不变形
 * ========================================================================= */
(function (root) {
  'use strict';

  /* 局部坐标 100×100 的灵兽图腾，缩放到 (cx,cy) 半径 r */
  function beastGlyph(kind, cx, cy, r, p, opacity) {
    var s = r / 100;
    var g = 'translate(' + cx + ',' + cy + ') scale(' + s + ')';
    var main = '#fffdf7';
    var accent, dark, face;

    if (kind === 'tiger') {
      accent = '#b8860b'; dark = '#2f3a44';
      face =
        '<path d="M24,30 L38,12 L44,32 Z" fill="' + dark + '"/>' +
        '<path d="M76,30 L62,12 L56,32 Z" fill="' + dark + '"/>' +
        '<path d="M50,14 C76,14 88,34 88,55 C88,78 71,92 50,92 C29,92 12,78 12,55 C12,34 24,14 50,14 Z" fill="' + main + '"/>' +
        '<path d="M38,34 h24 M40,42 h20 M36,50 h28" stroke="' + accent + '" stroke-width="5" stroke-linecap="round" fill="none"/>' +
        '<path d="M17,50 l11,4 M17,60 l11,3 M83,50 l-11,4 M83,60 l-11,3" stroke="' + dark + '" stroke-width="4.5" stroke-linecap="round" opacity=".72"/>' +
        '<ellipse cx="35" cy="63" rx="6.2" ry="7.2" fill="' + dark + '"/>' +
        '<ellipse cx="65" cy="63" rx="6.2" ry="7.2" fill="' + dark + '"/>' +
        '<circle cx="36.6" cy="60.6" r="2" fill="#fff"/><circle cx="66.6" cy="60.6" r="2" fill="#fff"/>' +
        '<path d="M50,70 l7,7 h-14 Z" fill="' + accent + '"/>' +
        '<path d="M50,77 v6 M50,83 q-7,0 -10,-5 M50,83 q7,0 10,-5" stroke="' + dark + '" stroke-width="3.2" fill="none" stroke-linecap="round"/>';
    } else if (kind === 'ox') {
      accent = '#7a5230'; dark = '#3a2c1c';
      face =
        '<path d="M26,34 C8,28 4,10 14,4 C22,0 30,12 34,24" fill="none" stroke="' + accent + '" stroke-width="8" stroke-linecap="round"/>' +
        '<path d="M74,34 C92,28 96,10 86,4 C78,0 70,12 66,24" fill="none" stroke="' + accent + '" stroke-width="8" stroke-linecap="round"/>' +
        '<path d="M50,20 C78,20 90,38 90,58 C90,80 72,94 50,94 C28,94 10,80 10,58 C10,38 22,20 50,20 Z" fill="' + main + '"/>' +
        '<path d="M20,44 C28,40 34,44 36,50" stroke="' + dark + '" stroke-width="4" fill="none" opacity=".55" stroke-linecap="round"/>' +
        '<path d="M80,44 C72,40 66,44 64,50" stroke="' + dark + '" stroke-width="4" fill="none" opacity=".55" stroke-linecap="round"/>' +
        '<ellipse cx="33" cy="56" rx="5.4" ry="6.4" fill="' + dark + '"/>' +
        '<ellipse cx="67" cy="56" rx="5.4" ry="6.4" fill="' + dark + '"/>' +
        '<circle cx="34.6" cy="53.8" r="1.9" fill="#fff"/><circle cx="68.6" cy="53.8" r="1.9" fill="#fff"/>' +
        '<ellipse cx="50" cy="78" rx="22" ry="15" fill="' + accent + '" opacity=".26"/>' +
        '<ellipse cx="42" cy="76" rx="3.4" ry="2.6" fill="' + dark + '"/>' +
        '<ellipse cx="58" cy="76" rx="3.4" ry="2.6" fill="' + dark + '"/>' +
        '<path d="M50,80 v6 M50,86 q-8,2 -11,-4 M50,86 q8,2 11,-4" stroke="' + dark + '" stroke-width="3.2" fill="none" stroke-linecap="round"/>' +
        '<circle cx="50" cy="88" r="7" fill="none" stroke="' + accent + '" stroke-width="3.4"/>';
    } else {
      accent = '#d94f2b'; dark = '#4a2c1a';
      face =
        '<path d="M30,26 C30,12 42,8 46,18 C50,4 62,4 64,16 C76,10 82,20 76,30 Z" fill="' + accent + '"/>' +
        '<path d="M50,24 C74,24 88,42 88,62 C88,82 71,94 50,94 C29,94 12,82 12,62 C12,42 26,24 50,24 Z" fill="' + main + '"/>' +
        '<path d="M50,60 L74,70 L50,78 Z" fill="#e8a53c"/>' +
        '<path d="M50,78 L74,70 L50,72 Z" fill="#c1802a"/>' +
        '<path d="M48,80 C44,92 54,96 58,88 C61,82 56,78 48,80 Z" fill="' + accent + '" opacity=".8"/>' +
        '<ellipse cx="36" cy="56" rx="6" ry="7" fill="' + dark + '"/>' +
        '<circle cx="37.8" cy="53.4" r="2.1" fill="#fff"/>' +
        '<path d="M14,44 C6,32 12,20 24,22" fill="none" stroke="' + accent + '" stroke-width="4.6" stroke-linecap="round" opacity=".8"/>' +
        '<path d="M86,44 C94,32 88,20 76,22" fill="none" stroke="' + accent + '" stroke-width="4.6" stroke-linecap="round" opacity=".8"/>';
    }

    return '<g transform="' + g + '" opacity="' + (opacity == null ? 1 : opacity) + '">' +
      '<circle cx="0" cy="0" r="100" fill="rgba(255,253,247,.55)"/>' +
      '<circle cx="0" cy="0" r="100" fill="none" stroke="' + accent + '" stroke-width="3.4" opacity=".55"/>' +
      '<circle cx="0" cy="0" r="88" fill="none" stroke="' + accent + '" stroke-width="1.4" opacity=".34" stroke-dasharray="4 6"/>' +
      '<g transform="translate(-50,-50)">' + face + '</g></g>';
  }

  /* -------------------------------------------------- 主题一：青丘卷 */
  function keyvisual(p) {
    return '<svg viewBox="0 0 1200 560" preserveAspectRatio="xMidYMid slice" role="img" aria-label="青丘山水间的白虎、黄牛与司晨金鸡图腾">' +
      '<defs>' +
      '<linearGradient id="' + p + 'sky" x1="0" y1="0" x2="0.25" y2="1">' +
      '<stop offset="0" stop-color="#fdf8ec"/><stop offset=".5" stop-color="#f5ead3"/><stop offset="1" stop-color="#e9d8b6"/></linearGradient>' +
      '<radialGradient id="' + p + 'sun" cx=".5" cy=".5" r=".5">' +
      '<stop offset="0" stop-color="#ffe6a8" stop-opacity=".95"/><stop offset=".62" stop-color="#f2c160" stop-opacity=".5"/><stop offset="1" stop-color="#e8a53c" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="' + p + 'far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fb2b8"/><stop offset="1" stop-color="#c3cfd2"/></linearGradient>' +
      '<linearGradient id="' + p + 'mid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f8b90"/><stop offset="1" stop-color="#a7bcc0"/></linearGradient>' +
      '<linearGradient id="' + p + 'near" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#38505a"/><stop offset="1" stop-color="#5c7a80"/></linearGradient>' +
      '</defs>' +
      '<rect width="1200" height="560" fill="url(#' + p + 'sky)"/>' +
      '<circle cx="968" cy="132" r="196" fill="url(#' + p + 'sun)"/>' +
      '<circle cx="968" cy="132" r="82" fill="#f7d488" opacity=".92"/>' +
      '<g stroke="#5b6f75" stroke-width="3" fill="none" opacity=".5" stroke-linecap="round">' +
      '<path d="M300,120 q12,-10 24,0 q12,-10 24,0"/><path d="M368,88 q9,-8 18,0 q9,-8 18,0"/><path d="M246,168 q8,-7 16,0 q8,-7 16,0"/></g>' +
      '<path d="M0,352 L118,246 L206,318 L318,196 L440,352 Z" fill="url(#' + p + 'far)" opacity=".72"/>' +
      '<path d="M300,352 L440,206 L548,300 L640,222 L760,352 Z" fill="url(#' + p + 'far)" opacity=".55"/>' +
      '<path d="M0,392 L150,286 L262,362 L392,252 L520,392 Z" fill="url(#' + p + 'mid)" opacity=".8"/>' +
      '<path d="M640,392 L790,268 L900,344 L1030,262 L1200,392 Z" fill="url(#' + p + 'mid)" opacity=".72"/>' +
      '<g fill="#fffdf8" opacity=".78">' +
      '<ellipse cx="240" cy="236" rx="118" ry="19"/><ellipse cx="330" cy="224" rx="70" ry="15"/>' +
      '<ellipse cx="820" cy="300" rx="132" ry="20"/><ellipse cx="716" cy="290" rx="72" ry="14"/>' +
      '<ellipse cx="1080" cy="212" rx="94" ry="16"/></g>' +
      '<path d="M0,560 L0,430 L146,368 L306,444 L470,372 L648,452 L820,378 L984,448 L1200,386 L1200,560 Z" fill="url(#' + p + 'near)" opacity=".9"/>' +
      beastGlyph('tiger', 660, 262, 74, p) +
      beastGlyph('ox', 822, 236, 86, p) +
      beastGlyph('chicken', 986, 268, 72, p) +
      '<g fill="#e9b7a4" opacity=".7">' +
      '<circle cx="130" cy="316" r="5"/><circle cx="206" cy="386" r="4"/><circle cx="96" cy="436" r="3.5"/>' +
      '<circle cx="560" cy="212" r="4.5"/><circle cx="1140" cy="360" r="5"/><circle cx="1064" cy="470" r="4"/></g>' +
      '</svg>';
  }

  /* -------------------------------------------------- 主题二：神炼塔 */
  function tower(p) {
    function tier(y, w, h) {
      var x = 840 - w / 2;
      return '<path d="M' + x + ',' + (y + 16) + ' L' + (x + w) + ',' + (y + 16) + ' L' + (x + w - 12) + ',' + (y + h) + ' L' + (x + 12) + ',' + (y + h) + ' Z" fill="#3c4a52"/>' +
        '<path d="M' + (x - 26) + ',' + (y + 14) + ' Q840,' + (y - 4) + ' ' + (x + w + 26) + ',' + (y + 14) + ' Q840,' + (y + 30) + ' ' + (x - 26) + ',' + (y + 14) + ' Z" fill="#54646d"/>';
    }
    var body = '';
    for (var i = 0; i < 7; i++) body += tier(340 - i * 44, 150 - i * 13, 44);
    return '<svg viewBox="0 0 1200 560" preserveAspectRatio="xMidYMid slice" role="img" aria-label="云雾缭绕的百层试炼塔">' +
      '<defs>' +
      '<linearGradient id="' + p + 'sky" x1="0" y1="0" x2="0.2" y2="1">' +
      '<stop offset="0" stop-color="#fdf6e2"/><stop offset=".55" stop-color="#f4e3bd"/><stop offset="1" stop-color="#e5cf9f"/></linearGradient>' +
      '<radialGradient id="' + p + 'moon" cx=".5" cy=".5" r=".5">' +
      '<stop offset="0" stop-color="#fff4d0" stop-opacity=".95"/><stop offset="1" stop-color="#f0cf82" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="' + p + 'mt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8a462"/><stop offset="1" stop-color="#e0c68c"/></linearGradient>' +
      '</defs>' +
      '<rect width="1200" height="560" fill="url(#' + p + 'sky)"/>' +
      '<circle cx="300" cy="132" r="190" fill="url(#' + p + 'moon)"/>' +
      '<circle cx="300" cy="132" r="86" fill="#fdf0cd"/>' +
      '<path d="M0,392 L170,272 L300,356 L430,246 L580,392 Z" fill="url(#' + p + 'mt)" opacity=".55"/>' +
      '<path d="M420,392 L580,286 L700,362 L840,268 L1000,392 Z" fill="url(#' + p + 'mt)" opacity=".45"/>' +
      body +
      '<path d="M840,132 L852,110 L840,88 L828,110 Z" fill="#c9a227"/>' +
      '<circle cx="840" cy="82" r="9" fill="#e8c34a"/>' +
      '<ellipse cx="840" cy="368" rx="150" ry="34" fill="#c9a227" opacity=".14"/>' +
      '<g fill="#fffdf6" opacity=".85">' +
      '<ellipse cx="200" cy="392" rx="170" ry="26"/><ellipse cx="360" cy="378" rx="96" ry="18"/>' +
      '<ellipse cx="700" cy="404" rx="150" ry="24"/><ellipse cx="1010" cy="386" rx="130" ry="22"/>' +
      '<ellipse cx="1120" cy="430" rx="140" ry="26"/></g>' +
      '<path d="M0,560 L0,468 L200,432 L420,486 L700,440 L960,492 L1200,452 L1200,560 Z" fill="#7a6a4a" opacity=".55"/>' +
      '<g fill="none" stroke="#d9b969" stroke-width="3" opacity=".5" stroke-linecap="round">' +
      '<path d="M700,470 q-16,-40 0,-78 q16,-38 0,-74"/>' +
      '<path d="M982,486 q-14,-34 0,-66 q14,-32 0,-62"/>' +
      '<path d="M470,452 q-12,-28 0,-54"/></g>' +
      '</svg>';
  }

  /* -------------------------------------------------- 主题三：联盟争锋 */
  function alliance(p) {
    function flag(cx, cy, color, glyph) {
      return '<rect x="' + (cx - 4) + '" y="' + (cy - 200) + '" width="8" height="330" rx="4" fill="#6b5a3e"/>' +
        '<circle cx="' + cx + '" cy="' + (cy - 205) + '" r="11" fill="#d9b969"/>' +
        '<path d="M' + (cx + 2) + ',' + (cy - 176) + ' h96 v150 q-46,-26 -96,4 Z" fill="' + color + '"/>' +
        '<path d="M' + (cx + 2) + ',' + (cy - 176) + ' h96 v150 q-46,-26 -96,4 Z" fill="none" stroke="#d9b969" stroke-width="3"/>' +
        '<text x="' + (cx + 50) + '" y="' + (cy - 84) + '" font-size="52" text-anchor="middle" fill="#ffeec2" font-family="serif">' + glyph + '</text>';
    }
    return '<svg viewBox="0 0 1200 560" preserveAspectRatio="xMidYMid slice" role="img" aria-label="两面家族战旗与远处的九头相柳黑影">' +
      '<defs>' +
      '<linearGradient id="' + p + 'sky" x1="0" y1="0" x2="0.3" y2="1">' +
      '<stop offset="0" stop-color="#eaf4ef"/><stop offset=".5" stop-color="#dcebe3"/><stop offset="1" stop-color="#c6ddd2"/></linearGradient>' +
      '<linearGradient id="' + p + 'mt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fa596" stop-opacity=".8"/><stop offset="1" stop-color="#b6cec4" stop-opacity=".5"/></linearGradient>' +
      '</defs>' +
      '<rect width="1200" height="560" fill="url(#' + p + 'sky)"/>' +
      '<path d="M0,360 L160,238 L300,330 L448,214 L600,360 Z" fill="url(#' + p + 'mt)"/>' +
      '<path d="M560,360 L720,244 L860,326 L1000,232 L1200,360 Z" fill="url(#' + p + 'mt)" opacity=".7"/>' +
      '<g opacity=".3" transform="translate(0,-30)">' +
      '<path d="M600,430 C560,360 620,300 700,330 C790,364 860,300 940,336 C1010,368 1060,330 1096,300" fill="none" stroke="#2f5a4e" stroke-width="26" stroke-linecap="round"/>' +
      '<g fill="#2f5a4e">' +
      '<ellipse cx="600" cy="300" rx="30" ry="22"/><ellipse cx="676" cy="272" rx="30" ry="22"/>' +
      '<ellipse cx="754" cy="268" rx="30" ry="22"/><ellipse cx="836" cy="286" rx="30" ry="22"/>' +
      '<ellipse cx="918" cy="318" rx="30" ry="22"/><ellipse cx="998" cy="330" rx="30" ry="22"/>' +
      '<ellipse cx="1070" cy="306" rx="28" ry="20"/><ellipse cx="1122" cy="272" rx="26" ry="18"/>' +
      '<ellipse cx="524" cy="346" rx="26" ry="18"/></g>' +
      '<g fill="#f4d7a0" opacity=".9">' +
      '<circle cx="600" cy="296" r="5"/><circle cx="676" cy="268" r="5"/><circle cx="754" cy="264" r="5"/>' +
      '<circle cx="836" cy="282" r="5"/><circle cx="918" cy="314" r="5"/><circle cx="998" cy="326" r="5"/></g></g>' +
      '<g fill="#ffffff" opacity=".62">' +
      '<ellipse cx="200" cy="200" rx="130" ry="20"/><ellipse cx="1060" cy="176" rx="120" ry="18"/>' +
      '<ellipse cx="620" cy="150" rx="100" ry="16"/></g>' +
      flag(300, 460, '#1f6f5c', '⚔') + flag(1080, 470, '#2c8a72', '🛡') +
      '<path d="M0,560 L0,470 L240,438 L520,484 L800,442 L1060,494 L1200,462 L1200,560 Z" fill="#2f5a4e" opacity=".5"/>' +
      '<g fill="#ffd98a" opacity=".85">' +
      '<circle cx="420" cy="500" r="6"/><circle cx="700" cy="512" r="5"/><circle cx="930" cy="498" r="6"/></g>' +
      '</svg>';
  }

  var ART = { keyvisual: keyvisual, tower: tower, alliance: alliance };
  root.QMPosterArt = {
    render: function (name, prefix) { return (ART[name] || keyvisual)(prefix || 'qm-'); },
    beastGlyph: beastGlyph
  };
})(typeof window !== 'undefined' ? window : globalThis);
