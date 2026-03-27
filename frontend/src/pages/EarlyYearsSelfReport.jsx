import React, { useState } from 'react';
import axios from 'axios';
import { ArrowLeft, Volume2, CheckCircle } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ── Year level detection ──────────────────────────────────────────────────────
export function isF2Student(yearLevel) {
  if (!yearLevel) return false;
  const yl = String(yearLevel).toLowerCase().trim();
  const EXACT = new Set([
    'foundation', 'prep', 'f', 'reception', 'kindy', 'kinder', 'kindergarten', 'pp', 'pre-primary',
    'year 1', 'yr 1', 'grade 1', 'y1', '1', 'year1', 'gr 1', 'gr1',
    'year 2', 'yr 2', 'grade 2', 'y2', '2', 'year2', 'gr 2', 'gr2',
    '1/2', '2/1', 'year 1/2', 'year 2/1', 'yr 1/2', 'yr 2/1',
    'f/1', 'f-1', 'f/2', 'f-2', 'f/p', 'p/f', 'prep/1', '1/prep',
  ]);
  if (EXACT.has(yl)) return true;
  if (yl.startsWith('foundation') || yl.startsWith('prep/') || yl.startsWith('f/')) return true;
  return false;
}

// ── Scoring ───────────────────────────────────────────────────────────────────
// Raw answers: 0/1/2 (per user spec)
// Rescale: 0→0, 1→1.5, 2→3  (maps 3-pt to same range as Y3-6 4-pt)
// Positive Q4-Q7: invert after rescale (3 - rescaled) so "Always" → 3 for backend
function buildF2BackendItems(rawAnswers) {
  const RESCALE = [0, 1.5, 3];
  return rawAnswers.map((raw, idx) => {
    const rescaled = RESCALE[raw];
    return idx >= 3 ? 3 - rescaled : rescaled;
  });
}

// ── SVG Illustrations ─────────────────────────────────────────────────────────
function IllChildDesk() {
  return (
    <svg viewBox="0 0 240 148" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
      <rect width="240" height="148" fill="#FFF8F0"/>
      <rect y="115" width="240" height="33" fill="#F2DFC0"/>
      {/* Window */}
      <rect x="168" y="12" width="56" height="66" rx="6" fill="#B3E5FC"/>
      <rect x="194" y="12" width="3" height="66" fill="white" opacity="0.6"/>
      <rect x="168" y="44" width="56" height="3" fill="white" opacity="0.6"/>
      <circle cx="182" cy="30" r="11" fill="#FDD835" opacity="0.85"/>
      {/* Wall posters */}
      <rect x="14" y="14" width="34" height="42" rx="4" fill="#FFCC80"/>
      <rect x="19" y="21" width="24" height="3" rx="1.5" fill="#FFB300" opacity="0.5"/>
      <rect x="19" y="29" width="18" height="3" rx="1.5" fill="#FFB300" opacity="0.5"/>
      <rect x="55" y="14" width="34" height="42" rx="4" fill="#A5D6A7"/>
      <circle cx="72" cy="35" r="9" fill="#66BB6A" opacity="0.65"/>
      {/* Desk */}
      <rect x="64" y="107" width="9" height="22" rx="3" fill="#BCAAA4"/>
      <rect x="157" y="107" width="9" height="22" rx="3" fill="#BCAAA4"/>
      <rect x="50" y="97" width="130" height="12" rx="5" fill="#D7CCC8"/>
      <rect x="73" y="87" width="34" height="10" rx="3" fill="#FF8A80"/>
      <rect x="116" y="88" width="5" height="9" rx="2" fill="#FFD54F"/>
      {/* Child body */}
      <rect x="93" y="74" width="32" height="23" rx="10" fill="#7986CB"/>
      {/* Child head */}
      <circle cx="109" cy="62" r="15" fill="#FFCCBC"/>
      <path d="M 94 62 Q 94 44 109 44 Q 124 44 124 62 Q 121 53 109 51 Q 97 53 94 62 Z" fill="#5D4037"/>
      <circle cx="104" cy="61" r="2.5" fill="#424242"/>
      <circle cx="114" cy="61" r="2.5" fill="#424242"/>
      <path d="M 104 68 Q 109 73 114 68" fill="none" stroke="#424242" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function IllButterflyTummy() {
  return (
    <svg viewBox="0 0 240 148" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
      <rect width="240" height="148" fill="#E8F4FD"/>
      <rect y="122" width="240" height="26" fill="#C8E6C9"/>
      <path d="M 18 122 Q 21 115 24 122" fill="#A5D6A7"/>
      <path d="M 52 122 Q 55 116 58 122" fill="#A5D6A7"/>
      <path d="M 180 122 Q 183 116 186 122" fill="#A5D6A7"/>
      <path d="M 215 122 Q 218 116 221 122" fill="#A5D6A7"/>
      {/* Legs */}
      <rect x="99" y="107" width="13" height="20" rx="5" fill="#5C6BC0"/>
      <rect x="115" y="107" width="13" height="20" rx="5" fill="#5C6BC0"/>
      {/* Shirt body */}
      <rect x="92" y="73" width="42" height="36" rx="12" fill="#81C784"/>
      {/* Tummy window — see-through belly */}
      <rect x="99" y="83" width="28" height="26" rx="12" fill="#F1F8E9" opacity="0.75"/>
      <rect x="99" y="83" width="28" height="26" rx="12" fill="none" stroke="#A5D6A7" strokeWidth="2"/>
      {/* Butterfly 1 — orange, upper-centre */}
      <path d="M 108 92 C 107 84 99 84 100 92 Z" fill="#FFAB91"/>
      <path d="M 108 92 C 109 84 117 84 116 92 Z" fill="#FF7043"/>
      <path d="M 108 92 C 107 97 101 96 102 92 Z" fill="#FFAB91" opacity="0.85"/>
      <path d="M 108 92 C 109 97 115 96 114 92 Z" fill="#FF7043" opacity="0.85"/>
      <ellipse cx="108" cy="92" rx="1.5" ry="4" fill="#BF360C"/>
      <line x1="108" y1="88" x2="104" y2="84" stroke="#BF360C" strokeWidth="0.9" strokeLinecap="round"/>
      <circle cx="104" cy="83.5" r="1" fill="#BF360C"/>
      <line x1="108" y1="88" x2="112" y2="84" stroke="#BF360C" strokeWidth="0.9" strokeLinecap="round"/>
      <circle cx="112" cy="83.5" r="1" fill="#BF360C"/>
      {/* Butterfly 2 — teal, lower-right */}
      <path d="M 118 100 C 117 92 109 92 110 100 Z" fill="#80DEEA"/>
      <path d="M 118 100 C 119 92 127 92 126 100 Z" fill="#26C6DA"/>
      <path d="M 118 100 C 117 105 111 104 112 100 Z" fill="#80DEEA" opacity="0.85"/>
      <path d="M 118 100 C 119 105 125 104 124 100 Z" fill="#26C6DA" opacity="0.85"/>
      <ellipse cx="118" cy="100" rx="1.5" ry="4" fill="#006064"/>
      <line x1="118" y1="96" x2="114" y2="92" stroke="#006064" strokeWidth="0.9" strokeLinecap="round"/>
      <circle cx="113.5" cy="91.5" r="1" fill="#006064"/>
      <line x1="118" y1="96" x2="122" y2="92" stroke="#006064" strokeWidth="0.9" strokeLinecap="round"/>
      <circle cx="122.5" cy="91.5" r="1" fill="#006064"/>
      {/* Butterfly 3 — purple, lower-left */}
      <path d="M 108 103 C 107 95 99 95 100 103 Z" fill="#CE93D8"/>
      <path d="M 108 103 C 109 95 117 95 116 103 Z" fill="#AB47BC"/>
      <path d="M 108 103 C 107 108 101 107 102 103 Z" fill="#CE93D8" opacity="0.85"/>
      <path d="M 108 103 C 109 108 115 107 114 103 Z" fill="#AB47BC" opacity="0.85"/>
      <ellipse cx="108" cy="103" rx="1.5" ry="4" fill="#4A148C"/>
      <line x1="108" y1="99" x2="104" y2="95" stroke="#4A148C" strokeWidth="0.9" strokeLinecap="round"/>
      <circle cx="103.5" cy="94.5" r="1" fill="#4A148C"/>
      <line x1="108" y1="99" x2="112" y2="95" stroke="#4A148C" strokeWidth="0.9" strokeLinecap="round"/>
      <circle cx="112.5" cy="94.5" r="1" fill="#4A148C"/>
      {/* Arms */}
      <rect x="76" y="77" width="16" height="9" rx="4" fill="#FFCCBC" transform="rotate(-15 76 82)"/>
      <rect x="132" y="77" width="16" height="9" rx="4" fill="#FFCCBC" transform="rotate(15 148 82)"/>
      {/* Head */}
      <circle cx="113" cy="60" r="16" fill="#FFCCBC"/>
      {/* Hair */}
      <path d="M 97 60 Q 97 41 113 41 Q 129 41 129 60 Q 126 51 113 49 Q 100 51 97 60 Z" fill="#FF8A65"/>
      {/* Worried inner brows */}
      <path d="M 104 54 Q 107 50 111 54" fill="none" stroke="#37474F" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M 115 54 Q 119 50 122 54" fill="none" stroke="#37474F" strokeWidth="2.2" strokeLinecap="round"/>
      {/* Wide worried eyes */}
      <circle cx="108" cy="59" r="3.2" fill="#424242"/>
      <circle cx="118" cy="59" r="3.2" fill="#424242"/>
      <circle cx="109.5" cy="57.5" r="1.2" fill="white"/>
      <circle cx="119.5" cy="57.5" r="1.2" fill="white"/>
      {/* Worried downturned mouth */}
      <path d="M 108 68 Q 113 65 118 68" fill="none" stroke="#424242" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function IllAngryClassroom() {
  return (
    <svg viewBox="0 0 240 148" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
      {/* Classroom */}
      <rect width="240" height="148" fill="#FFF8F0"/>
      <rect y="116" width="240" height="32" fill="#F2DFC0"/>
      {/* Window */}
      <rect x="168" y="12" width="56" height="64" rx="6" fill="#B3E5FC"/>
      <rect x="194" y="12" width="3" height="64" fill="white" opacity="0.6"/>
      <rect x="168" y="43" width="56" height="3" fill="white" opacity="0.6"/>
      <circle cx="182" cy="28" r="11" fill="#FDD835" opacity="0.85"/>
      {/* Posters */}
      <rect x="14" y="14" width="34" height="42" rx="4" fill="#FFCC80"/>
      <rect x="55" y="14" width="34" height="42" rx="4" fill="#A5D6A7"/>
      {/* Desk */}
      <rect x="50" y="98" width="130" height="11" rx="5" fill="#D7CCC8"/>
      <rect x="65" y="109" width="9" height="20" rx="3" fill="#BCAAA4"/>
      <rect x="157" y="109" width="9" height="20" rx="3" fill="#BCAAA4"/>
      {/* Child body */}
      <rect x="93" y="74" width="34" height="26" rx="10" fill="#EF9A9A"/>
      {/* Steam from left ear — horizontal cartoon jets */}
      <line x1="93" y1="56" x2="70" y2="56" stroke="#B0BEC5" strokeWidth="3.5" strokeLinecap="round"/>
      <line x1="93" y1="62" x2="73" y2="62" stroke="#CFD8DC" strokeWidth="3" strokeLinecap="round"/>
      <line x1="93" y1="68" x2="76" y2="68" stroke="#ECEFF1" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Steam from right ear — horizontal cartoon jets */}
      <line x1="127" y1="56" x2="150" y2="56" stroke="#B0BEC5" strokeWidth="3.5" strokeLinecap="round"/>
      <line x1="127" y1="62" x2="147" y2="62" stroke="#CFD8DC" strokeWidth="3" strokeLinecap="round"/>
      <line x1="127" y1="68" x2="144" y2="68" stroke="#ECEFF1" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Red flushed head */}
      <circle cx="110" cy="61" r="16" fill="#EF5350"/>
      {/* Hair */}
      <path d="M 94 61 Q 94 42 110 42 Q 126 42 126 61 Q 123 52 110 50 Q 97 52 94 61 Z" fill="#5D4037"/>
      {/* Sharply slanted angry brows — inner ends low, outer ends high */}
      <line x1="108" y1="57" x2="100" y2="49" stroke="#1A237E" strokeWidth="3.5" strokeLinecap="round"/>
      <line x1="112" y1="57" x2="120" y2="49" stroke="#1A237E" strokeWidth="3.5" strokeLinecap="round"/>
      {/* Squinting angry eyes */}
      <ellipse cx="105" cy="59" rx="3" ry="2.5" fill="#37474F"/>
      <ellipse cx="115" cy="59" rx="3" ry="2.5" fill="#37474F"/>
      {/* Deep frown */}
      <path d="M 104 69 Q 110 64 116 69" fill="none" stroke="#37474F" strokeWidth="2.8" strokeLinecap="round"/>
      {/* Red flush on cheeks */}
      <circle cx="100" cy="65" r="6" fill="#C62828" opacity="0.25"/>
      <circle cx="120" cy="65" r="6" fill="#C62828" opacity="0.25"/>
    </svg>
  );
}

function IllArmsWide() {
  return (
    <svg viewBox="0 0 240 148" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
      <rect width="240" height="148" fill="#FFFDE7"/>
      <rect y="118" width="240" height="30" fill="#F3E5C3"/>
      {/* Wall decorations */}
      <rect x="14" y="12" width="42" height="44" rx="5" fill="#B3E5FC"/>
      <rect x="20" y="19" width="30" height="3" rx="1.5" fill="#4FC3F7" opacity="0.7"/>
      <rect x="20" y="28" width="22" height="3" rx="1.5" fill="#4FC3F7" opacity="0.7"/>
      <rect x="63" y="12" width="42" height="44" rx="5" fill="#DCEDC8"/>
      <circle cx="84" cy="34" r="12" fill="#AED581" opacity="0.8"/>
      {/* Blackboard */}
      <rect x="128" y="8" width="100" height="68" rx="6" fill="#455A64"/>
      <rect x="133" y="13" width="90" height="58" rx="4" fill="#37474F"/>
      <text x="148" y="48" fill="white" fontSize="14" fontFamily="sans-serif" opacity="0.5">A B C</text>
      {/* Rainbow on board */}
      <path d="M 145 55 Q 178 30 211 55" fill="none" stroke="#FF8A80" strokeWidth="3" opacity="0.5"/>
      <path d="M 148 58 Q 178 36 208 58" fill="none" stroke="#FFD54F" strokeWidth="3" opacity="0.5"/>
      {/* Child - arms spread */}
      <rect x="53" y="86" width="35" height="10" rx="5" fill="#FFCCBC" transform="rotate(-10 53 91)"/>
      <rect x="128" y="83" width="35" height="10" rx="5" fill="#FFCCBC" transform="rotate(10 163 88)"/>
      <rect x="91" y="90" width="34" height="28" rx="10" fill="#FFA726"/>
      <circle cx="108" cy="78" r="15" fill="#FFCCBC"/>
      <ellipse cx="108" cy="66" rx="15" ry="8" fill="#FDD835"/>
      <circle cx="103" cy="77" r="2.5" fill="#424242"/>
      <circle cx="113" cy="77" r="2.5" fill="#424242"/>
      <path d="M 101 85 Q 108 92 115 85" fill="none" stroke="#424242" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="99" cy="82" r="5" fill="#FF8A65" opacity="0.28"/>
      <circle cx="117" cy="82" r="5" fill="#FF8A65" opacity="0.28"/>
    </svg>
  );
}

function IllTwoKidsPlaying() {
  return (
    <svg viewBox="0 0 240 148" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
      <rect width="240" height="148" fill="#E1F5FE"/>
      {/* Sun */}
      <circle cx="200" cy="28" r="22" fill="#FDD835" opacity="0.9"/>
      <line x1="200" y1="3" x2="200" y2="0" stroke="#FDD835" strokeWidth="3"/>
      <line x1="222" y1="28" x2="226" y2="28" stroke="#FDD835" strokeWidth="3"/>
      <line x1="200" y1="53" x2="200" y2="57" stroke="#FDD835" strokeWidth="3"/>
      <line x1="178" y1="28" x2="174" y2="28" stroke="#FDD835" strokeWidth="3"/>
      <line x1="216" y1="12" x2="219" y2="9" stroke="#FDD835" strokeWidth="3"/>
      <line x1="216" y1="44" x2="219" y2="47" stroke="#FDD835" strokeWidth="3"/>
      <line x1="184" y1="12" x2="181" y2="9" stroke="#FDD835" strokeWidth="3"/>
      <line x1="184" y1="44" x2="181" y2="47" stroke="#FDD835" strokeWidth="3"/>
      {/* Clouds */}
      <ellipse cx="55" cy="28" rx="30" ry="14" fill="white" opacity="0.9"/>
      <ellipse cx="76" cy="22" rx="20" ry="11" fill="white" opacity="0.9"/>
      <ellipse cx="42" cy="22" rx="16" ry="9" fill="white" opacity="0.9"/>
      {/* Ground */}
      <rect y="118" width="240" height="30" fill="#C8E6C9"/>
      <path d="M 18 118 Q 21 110 24 118" fill="#A5D6A7"/>
      <path d="M 52 118 Q 55 112 58 118" fill="#A5D6A7"/>
      <path d="M 168 118 Q 171 111 174 118" fill="#A5D6A7"/>
      <path d="M 210 118 Q 213 112 216 118" fill="#A5D6A7"/>
      {/* Ball */}
      <circle cx="132" cy="110" r="10" fill="#FF7043"/>
      <path d="M 125 105 Q 132 102 139 105" fill="none" stroke="white" strokeWidth="1.5" opacity="0.7"/>
      <path d="M 123 112 Q 132 116 141 112" fill="none" stroke="white" strokeWidth="1.5" opacity="0.7"/>
      {/* Child 1 */}
      <rect x="63" y="95" width="28" height="26" rx="9" fill="#CE93D8"/>
      <circle cx="77" cy="82" r="14" fill="#FFCCBC"/>
      <ellipse cx="77" cy="71" rx="14" ry="7" fill="#FDD835"/>
      <circle cx="72" cy="81" r="2" fill="#424242"/>
      <circle cx="82" cy="81" r="2" fill="#424242"/>
      <path d="M 72 89 Q 77 94 82 89" fill="none" stroke="#424242" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Child 2 */}
      <rect x="145" y="95" width="28" height="26" rx="9" fill="#80CBC4"/>
      <circle cx="159" cy="82" r="14" fill="#FFCCBC"/>
      <ellipse cx="159" cy="71" rx="14" ry="7" fill="#5D4037"/>
      <circle cx="154" cy="81" r="2" fill="#424242"/>
      <circle cx="164" cy="81" r="2" fill="#424242"/>
      <path d="M 154 89 Q 159 94 164 89" fill="none" stroke="#424242" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IllTeacherChild() {
  return (
    <svg viewBox="0 0 240 148" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
      <rect width="240" height="148" fill="#FFF3E0"/>
      <rect y="120" width="240" height="28" fill="#F2DFC0"/>
      {/* Wall decorations */}
      <rect x="14" y="18" width="38" height="46" rx="5" fill="#FFCC80"/>
      <rect x="19" y="26" width="28" height="3" rx="1.5" fill="#FFB300" opacity="0.5"/>
      <rect x="19" y="34" width="20" height="3" rx="1.5" fill="#FFB300" opacity="0.5"/>
      <rect x="185" y="18" width="38" height="46" rx="5" fill="#A5D6A7"/>
      <circle cx="204" cy="41" r="12" fill="#66BB6A" opacity="0.65"/>
      {/* Child (right) */}
      <rect x="148" y="97" width="26" height="25" rx="8" fill="#90CAF9"/>
      <circle cx="161" cy="85" r="13" fill="#FFCCBC"/>
      <ellipse cx="161" cy="74" rx="13" ry="7" fill="#FF8A65"/>
      <circle cx="156" cy="84" r="2" fill="#424242"/>
      <circle cx="166" cy="84" r="2" fill="#424242"/>
      <path d="M 156 91 Q 161 96 166 91" fill="none" stroke="#424242" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Teacher (kneeling, left) — body lower to match child height */}
      <rect x="74" y="103" width="38" height="20" rx="8" fill="#7E57C2"/>
      {/* Knee on ground */}
      <ellipse cx="93" cy="123" rx="20" ry="8" fill="#6A1B9A" opacity="0.4"/>
      {/* Teacher head — same level as child */}
      <circle cx="93" cy="86" r="16" fill="#FFCCBC"/>
      <path d="M 77 86 Q 77 67 93 67 Q 109 67 109 86 Q 106 76 93 74 Q 80 76 77 86 Z" fill="#37474F"/>
      <circle cx="88" cy="85" r="2.5" fill="#424242"/>
      <circle cx="98" cy="85" r="2.5" fill="#424242"/>
      <path d="M 88 93 Q 93 98 98 93" fill="none" stroke="#424242" strokeWidth="1.8" strokeLinecap="round"/>
      {/* Teacher arm reaching toward child */}
      <rect x="112" y="93" width="32" height="8" rx="4" fill="#FFCCBC"/>
    </svg>
  );
}

function IllSafetyBubble() {
  return (
    <svg viewBox="0 0 240 148" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
      {/* Classroom background */}
      <rect width="240" height="148" fill="#FFFDE7"/>
      <rect y="122" width="240" height="26" fill="#F3E5C3"/>
      {/* Wall posters */}
      <rect x="12" y="10" width="36" height="44" rx="5" fill="#B3E5FC"/>
      <rect x="17" y="18" width="26" height="3" rx="1.5" fill="#4FC3F7" opacity="0.6"/>
      <rect x="17" y="26" width="18" height="3" rx="1.5" fill="#4FC3F7" opacity="0.6"/>
      <rect x="192" y="10" width="36" height="44" rx="5" fill="#DCEDC8"/>
      <circle cx="210" cy="32" r="10" fill="#AED581" opacity="0.8"/>
      {/* Glow bubble — layered warm radial glow */}
      <circle cx="120" cy="84" r="52" fill="#FFFDE7" opacity="0.4"/>
      <circle cx="120" cy="84" r="42" fill="#FFF9C4" opacity="0.5"/>
      <circle cx="120" cy="84" r="33" fill="#FFF8E1" opacity="0.7"/>
      <circle cx="120" cy="84" r="24" fill="white" opacity="0.85"/>
      {/* Bubble ring */}
      <circle cx="120" cy="84" r="33" fill="none" stroke="#FFD54F" strokeWidth="2.5" opacity="0.9"/>
      <circle cx="120" cy="84" r="42" fill="none" stroke="#FFE082" strokeWidth="1.5" opacity="0.5"/>
      {/* Sparkles */}
      <circle cx="93" cy="54" r="3" fill="#FFE082"/>
      <circle cx="149" cy="50" r="3" fill="#FFE082"/>
      <circle cx="88" cy="106" r="2.5" fill="#FFCC02"/>
      <circle cx="154" cy="110" r="2.5" fill="#FFCC02"/>
      <circle cx="78" cy="80" r="2" fill="#FFD54F"/>
      <circle cx="163" cy="78" r="2" fill="#FFD54F"/>
      {/* Child in centre of bubble */}
      <rect x="108" y="91" width="24" height="22" rx="8" fill="#FFA726"/>
      <circle cx="120" cy="79" r="13" fill="#FFCCBC"/>
      <path d="M 107 79 Q 107 63 120 63 Q 133 63 133 79 Q 130 70 120 68 Q 110 70 107 79 Z" fill="#FDD835"/>
      <circle cx="115" cy="78" r="2" fill="#424242"/>
      <circle cx="125" cy="78" r="2" fill="#424242"/>
      <path d="M 115 85 Q 120 90 125 85" fill="none" stroke="#424242" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="111" cy="83" r="4" fill="#FF8A65" opacity="0.25"/>
      <circle cx="129" cy="83" r="4" fill="#FF8A65" opacity="0.25"/>
      {/* Surrounding kind faces */}
      {/* Face — top left */}
      <circle cx="62" cy="44" r="17" fill="#FFCC80"/>
      <circle cx="57" cy="42" r="2.2" fill="#424242"/>
      <circle cx="67" cy="42" r="2.2" fill="#424242"/>
      <path d="M 57 49 Q 62 54 67 49" fill="none" stroke="#424242" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="53" cy="46" r="4" fill="#FF8A65" opacity="0.25"/>
      <circle cx="71" cy="46" r="4" fill="#FF8A65" opacity="0.25"/>
      {/* Face — top right */}
      <circle cx="178" cy="44" r="17" fill="#A5D6A7"/>
      <circle cx="173" cy="42" r="2.2" fill="#424242"/>
      <circle cx="183" cy="42" r="2.2" fill="#424242"/>
      <path d="M 173 49 Q 178 54 183 49" fill="none" stroke="#424242" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="169" cy="46" r="4" fill="#66BB6A" opacity="0.2"/>
      <circle cx="187" cy="46" r="4" fill="#66BB6A" opacity="0.2"/>
      {/* Face — left */}
      <circle cx="36" cy="86" r="15" fill="#F48FB1"/>
      <circle cx="31" cy="84" r="2" fill="#424242"/>
      <circle cx="41" cy="84" r="2" fill="#424242"/>
      <path d="M 31 90 Q 36 95 41 90" fill="none" stroke="#424242" strokeWidth="1.8" strokeLinecap="round"/>
      {/* Face — right */}
      <circle cx="204" cy="86" r="15" fill="#80DEEA"/>
      <circle cx="199" cy="84" r="2" fill="#424242"/>
      <circle cx="209" cy="84" r="2" fill="#424242"/>
      <path d="M 199 90 Q 204 95 209 90" fill="none" stroke="#424242" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

// ── Question data ─────────────────────────────────────────────────────────────
const F2_QUESTIONS = [
  {
    id: 1, question: "Do you feel sad at school?",
    support: "Do you cry or feel unhappy at school?",
    Illustration: IllChildDesk,
    options: [{ label: 'Never', emoji: '😊', value: 0 }, { label: 'Sometimes', emoji: '😐', value: 1 }, { label: 'Always', emoji: '😢', value: 2 }],
  },
  {
    id: 2, question: "Do you feel worried at school?",
    support: "Does your tummy feel funny or scared at school?",
    Illustration: IllButterflyTummy,
    options: [{ label: 'Never', emoji: '😊', value: 0 }, { label: 'Sometimes', emoji: '😐', value: 1 }, { label: 'Always', emoji: '😟', value: 2 }],
  },
  {
    id: 3, question: "Do you feel angry at school?",
    support: "Do you feel like you want to yell or cry at school?",
    Illustration: IllAngryClassroom,
    options: [{ label: 'Never', emoji: '😊', value: 0 }, { label: 'Sometimes', emoji: '😐', value: 1 }, { label: 'Always', emoji: '😠', value: 2 }],
  },
  {
    id: 4, question: "Do you feel like you belong at school?",
    support: "Does school feel like a good place for you?",
    Illustration: IllArmsWide,
    options: [{ label: 'Never', emoji: '🙁', value: 2 }, { label: 'Sometimes', emoji: '😐', value: 1 }, { label: 'Always', emoji: '😊', value: 0 }],
  },
  {
    id: 5, question: "Do you have friends at school?",
    support: "Do you have someone to play with at break times?",
    Illustration: IllTwoKidsPlaying,
    options: [{ label: 'Never', emoji: '🙁', value: 2 }, { label: 'Sometimes', emoji: '😐', value: 1 }, { label: 'Always', emoji: '😊', value: 0 }],
  },
  {
    id: 6, question: "Do your teachers look after you?",
    support: "Does your teacher help you when you need it?",
    Illustration: IllTeacherChild,
    options: [{ label: 'Never', emoji: '🙁', value: 2 }, { label: 'Sometimes', emoji: '😐', value: 1 }, { label: 'Always', emoji: '😊', value: 0 }],
  },
  {
    id: 7, question: "Do you feel safe at school?",
    support: "Do you feel okay and safe when you are here?",
    Illustration: IllSafetyBubble,
    options: [{ label: 'Never', emoji: '🙁', value: 2 }, { label: 'Sometimes', emoji: '😐', value: 1 }, { label: 'Always', emoji: '😊', value: 0 }],
  },
];

// ── Web Speech ────────────────────────────────────────────────────────────────
function useSpeech() {
  const [speaking, setSpeaking] = useState(false);

  const speak = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    if (speaking) { setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.85;
    u.pitch = 1.1;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  };

  const stop = () => { window.speechSynthesis.cancel(); setSpeaking(false); };

  return { speaking, speak, stop };
}
export function F2SelfReportForm({ student, period, screeningId, onSave, onBack }) {
  const [answers, setAnswers] = useState(Array(7).fill(null));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const { speaking, speak, stop } = useSpeech();
  const [activeQ, setActiveQ] = useState(null);

  // Stop speech when navigating away
  const handleBack = () => { stop(); onBack(); };

  const handleSpeak = (qIdx, q) => {
    const text = `${q.question} ${q.support}`;
    if (activeQ === qIdx && speaking) {
      stop();
      setActiveQ(null);
    } else {
      setActiveQ(qIdx);
      speak(text);
    }
  };

  const answeredCount = answers.filter(a => a !== null).length;
  const allAnswered = answeredCount === 7;

  const handleAnswer = (qIdx, value) => {
    setAnswers(prev => prev.map((a, i) => i === qIdx ? value : a));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const backendItems = buildF2BackendItems(answers);
      await axios.post(`${API}/screening/saebrs-plus`, {
        student_id: student.student_id,
        screening_id: screeningId,
        screening_period: period,
        self_report_items: backendItems,
        attendance_pct: 100,
        social_domain: 0, academic_domain: 0, emotional_domain: 0, belonging_domain: 0,
        wellbeing_total: 0, wellbeing_tier: 1,
      }, { withCredentials: true });
      onSave(student.student_id);
    } catch (e) {
      setSaveError(e.response?.data?.detail || 'Failed to save. Please try again.');
      setSaving(false);
    }
  };

  const displayName = student.preferred_name && student.preferred_name !== student.first_name
    ? student.preferred_name
    : student.first_name;

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #FFF8F0 0%, #EEF4FF 100%)' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={handleBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors font-medium">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="text-center">
            <p className="text-base font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>{displayName}</p>
            <p className="text-xs text-slate-400">{period}</p>
          </div>
          {/* Progress badge */}
          <div className={`text-xs font-bold px-3 py-1 rounded-full ${allAnswered ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
            {answeredCount}/7
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{ width: `${(answeredCount / 7) * 100}%`, background: allAnswered ? '#10B981' : '#6366F1' }}
          />
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-6 pb-12">
        {F2_QUESTIONS.map((q, qIdx) => {
          const Ill = q.Illustration;
          const answered = answers[qIdx] !== null;
          return (
            <div
              key={q.id}
              data-testid={`f2-question-${q.id}`}
              className={`bg-white rounded-3xl shadow-sm border-2 overflow-hidden mb-10 transition-all duration-300 ${answered ? 'border-emerald-200' : 'border-slate-100'}`}
            >
              {/* Illustration */}
              <div className="bg-gradient-to-br from-sky-50 to-amber-50 overflow-hidden">
                <Ill />
              </div>

              <div className="p-6 pt-5">
                {/* Question header */}
                <div className="flex justify-between items-start mb-3">
                  <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">Question {q.id}</span>
                  {/* Audio button */}
                  <button
                    onClick={() => handleSpeak(qIdx, q)}
                    data-testid={`f2-listen-q${q.id}`}
                    title={activeQ === qIdx && speaking ? 'Stop' : 'Listen to question'}
                    className={`flex items-center justify-center gap-1 text-xs font-semibold border rounded-full w-16 py-1 transition-colors ${
                      activeQ === qIdx && speaking
                        ? 'bg-indigo-100 border-indigo-400 text-indigo-700'
                        : 'border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-500'
                    }`}
                  >
                    <Volume2
                      size={12}
                      className={activeQ === qIdx && speaking ? 'animate-bounce' : ''}
                    />
                    {activeQ === qIdx && speaking ? 'Stop' : 'Listen'}
                  </button>
                </div>

                {/* Main question */}
                <h2
                  className="text-2xl font-extrabold text-slate-900 leading-snug mb-2"
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                >
                  {q.question}
                </h2>

                {/* Support question */}
                <p className="text-base text-slate-400 leading-relaxed mb-8">{q.support}</p>

                {/* Face buttons */}
                <div className="grid grid-cols-3 gap-3">
                  {q.options.map(opt => {
                    const selected = answers[qIdx] === opt.value;
                    return (
                      <button
                        key={opt.label}
                        data-testid={`f2-q${q.id}-${opt.label.toLowerCase()}`}
                        onClick={() => handleAnswer(qIdx, opt.value)}
                        className={`flex flex-col items-center py-5 px-2 rounded-2xl border-2 transition-all duration-150 active:scale-95 select-none ${
                          selected
                            ? 'border-indigo-400 bg-indigo-50 shadow-md scale-105'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-5xl mb-2 leading-none">{opt.emoji}</span>
                        <span className={`text-sm font-bold ${selected ? 'text-indigo-700' : 'text-slate-500'}`}>
                          {opt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Answered tick */}
                {answered && (
                  <div className="flex items-center gap-1.5 mt-4 text-emerald-600">
                    <CheckCircle size={14} />
                    <span className="text-xs font-semibold">Answered</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Save */}
        {saveError && (
          <p className="text-sm text-rose-600 text-center mb-4 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">{saveError}</p>
        )}
        <button
          data-testid="f2-save-btn"
          onClick={handleSave}
          disabled={!allAnswered || saving}
          className="w-full py-4 rounded-2xl text-lg font-extrabold text-white shadow-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: allAnswered ? 'linear-gradient(135deg, #4F46E5, #7C3AED)' : '#94A3B8' }}
        >
          {saving
            ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
            : allAnswered
            ? <><CheckCircle size={20} /> All done! Save answers</>
            : `Answer all questions (${answeredCount}/7 done)`
          }
        </button>
      </div>
    </div>
  );
}
