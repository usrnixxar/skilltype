// Word collections and normalization utilities for SkillType

export type WordCategory = 'common' | 'coding' | 'htmlcss' | 'business' | 'custom';

export interface CategoryData {
  id: WordCategory;
  name: string;
  description: string;
  short: string[];   // 3-4 letters (Scout ships)
  medium: string[];  // 5-7 letters (Fighter ships)
  long: string[];    // 8+ letters (Heavy ships)
}

export const COMMON_WORDS: CategoryData = {
  id: 'common',
  name: 'Common English',
  description: 'Everyday vocabulary for fluid typing rhythm and speed.',
  short: [
    'star', 'fire', 'ship', 'fast', 'glow', 'core', 'warp', 'beam', 'dark', 'void',
    'moon', 'mars', 'orbit', 'dust', 'nova', 'apex', 'zero', 'iron', 'flux', 'echo',
    'wave', 'bolt', 'wind', 'rock', 'time', 'blue', 'gold', 'neon', 'path', 'jump',
    'dash', 'grid', 'zone', 'pack', 'hunt', 'rise', 'fall', 'deep', 'high', 'wild',
    'calm', 'pure', 'true', 'bold', 'free', 'hope', 'life', 'mind', 'soul', 'burn'
  ],
  medium: [
    'galaxy', 'rocket', 'comet', 'vector', 'meteor', 'nebula', 'plasma', 'shield',
    'thrust', 'cosmic', 'pulsar', 'beacon', 'flight', 'engine', 'target', 'strike',
    'energy', 'quantum', 'charge', 'blaster', 'shadow', 'patrol', 'launch', 'sensor',
    'system', 'matrix', 'signal', 'danger', 'future', 'horizon', 'zenith', 'stellar',
    'gravity', 'vortex', 'phantom', 'stealth', 'raptor', 'tracker', 'armada', 'specter'
  ],
  long: [
    'hyperdrive', 'supernova', 'constellation', 'trajectory', 'interstellar', 'accelerator',
    'spacecraft', 'battleship', 'destruction', 'navigation', 'transporter', 'annihilation',
    'atmosphere', 'luminescence', 'propulsion', 'singularity', 'millennium', 'stratosphere',
    'exploration', 'electromagnetic', 'invulnerable', 'telemetry', 'intergalactic', 'subterranean'
  ]
};

export const CODING_WORDS: CategoryData = {
  id: 'coding',
  name: 'Computer Terminology',
  description: 'Programming syntax, hardware, networking, and algorithms.',
  short: [
    'byte', 'code', 'data', 'loop', 'node', 'null', 'void', 'bool', 'char', 'file',
    'host', 'port', 'link', 'pipe', 'heap', 'tree', 'hash', 'sync', 'fork', 'push',
    'pull', 'test', 'base', 'root', 'user', 'path', 'unit', 'dump', 'lock', 'ping',
    'json', 'ajax', 'crud', 'rest', 'http', 'grpc', 'bash', 'wasm', 'unix', 'sudo'
  ],
  medium: [
    'binary', 'buffer', 'thread', 'server', 'client', 'router', 'packet', 'memory',
    'kernel', 'script', 'string', 'number', 'method', 'object', 'module', 'stream',
    'filter', 'lambda', 'syntax', 'socket', 'docker', 'commit', 'branch', 'deploy',
    'render', 'parser', 'driver', 'tensor', 'schema', 'vector', 'cursor', 'bridge',
    'worker', 'promise', 'closure', 'boolean', 'integer', 'pointer', 'storage', 'runtime'
  ],
  long: [
    'algorithm', 'asynchronous', 'encryption', 'framework', 'interface', 'middleware',
    'repository', 'polymorphism', 'inheritance', 'concurrency', 'serialization', 'refactoring',
    'dependency', 'abstraction', 'microservice', 'distributed', 'performance', 'compilation',
    'optimization', 'architecture', 'authentication', 'authorization', 'virtualization'
  ]
};

export const HTML_CSS_WORDS: CategoryData = {
  id: 'htmlcss',
  name: 'HTML & CSS Vocabulary',
  description: 'Layout, typography, animation, and frontend DOM properties.',
  short: [
    'flex', 'grid', 'font', 'size', 'bold', 'span', 'link', 'head', 'body', 'form',
    'main', 'wrap', 'left', 'glow', 'ease', 'blur', 'fill', 'clip', 'mask', 'view',
    'auto', 'text', 'line', 'card', 'icon', 'href', 'meta', 'slot', 'none', 'calc',
    'rem', 'em', 'vh', 'vw', 'px', 'div', 'nav', 'img', 'css', 'dom'
  ],
  medium: [
    'margin', 'padding', 'border', 'radius', 'shadow', 'display', 'opacity', 'zindex',
    'hidden', 'visible', 'inline', 'block', 'cursor', 'column', 'header', 'footer',
    'section', 'article', 'button', 'canvas', 'svgxml', 'keyframe', 'transform', 'filter',
    'linear', 'relative', 'absolute', 'sticky', 'selector', 'content', 'inherit', 'initial',
    'overflow', 'baseline', 'center', 'between', 'stretch', 'justify', 'sibling', 'pseudo'
  ],
  long: [
    'background', 'transition', 'animation', 'responsive', 'typography', 'perspective',
    'mediaquery', 'stylesheet', 'proportional', 'declaration', 'specificity', 'flexibility',
    'transparent', 'containment', 'interaction', 'composition', 'accessibility', 'viewportfit'
  ]
};

export const BUSINESS_WORDS: CategoryData = {
  id: 'business',
  name: 'Business & Office',
  description: 'Corporate strategy, project management, and commerce vocabulary.',
  short: [
    'plan', 'goal', 'team', 'lead', 'cost', 'sale', 'deal', 'fund', 'risk', 'task',
    'work', 'meet', 'bill', 'hire', 'grow', 'gain', 'cash', 'debt', 'term', 'rate',
    'base', 'firm', 'unit', 'post', 'rank', 'flow', 'peer', 'brand', 'core', 'role',
    'peer', 'ship', 'sign', 'view', 'poll', 'brief', 'chat', 'note', 'desk', 'mark'
  ],
  medium: [
    'budget', 'client', 'agenda', 'market', 'profit', 'target', 'metric', 'action',
    'review', 'report', 'status', 'talent', 'vision', 'growth', 'leader', 'career',
    'invest', 'launch', 'policy', 'equity', 'roster', 'survey', 'portal', 'assets',
    'credit', 'output', 'vendor', 'supply', 'demand', 'salary', 'income', 'branch'
  ],
  long: [
    'benchmark', 'executive', 'milestone', 'strategy', 'presentation', 'stakeholder',
    'performance', 'investment', 'deliverable', 'monetization', 'efficiency', 'leadership',
    'optimization', 'negotiation', 'partnership', 'organization', 'sustainable', 'prioritize'
  ]
};

export const ALL_CATEGORIES: Record<WordCategory, CategoryData> = {
  common: COMMON_WORDS,
  coding: CODING_WORDS,
  htmlcss: HTML_CSS_WORDS,
  business: BUSINESS_WORDS,
  custom: {
    id: 'custom',
    name: 'Custom Vocabulary',
    description: 'Practice your own custom pasted words and phrases.',
    short: [],
    medium: [],
    long: []
  }
};

/**
 * Normalizes user-pasted text into valid, clean, unique words (3-15 chars, a-z only).
 */
export function normalizeCustomWords(rawText: string): { validWords: string[]; rejectedCount: number } {
  if (!rawText || !rawText.trim()) {
    return { validWords: [], rejectedCount: 0 };
  }

  // Split on commas, spaces, tabs, newlines, semicolons
  const tokens = rawText.split(/[\s,;\n\r\t]+/);
  const seen = new Set<string>();
  const validWords: string[] = [];
  let rejectedCount = 0;

  for (const token of tokens) {
    const clean = token.toLowerCase().replace(/[^a-z]/g, '').trim();
    if (!clean) continue;

    // Filter length: 3 to 15 characters
    if (clean.length >= 3 && clean.length <= 15) {
      if (!seen.has(clean)) {
        seen.add(clean);
        validWords.push(clean);
      }
    } else {
      rejectedCount++;
    }
  }

  return { validWords, rejectedCount };
}

/**
 * Splits a list of custom words into short (3-4), medium (5-7), and long (8+) buckets.
 */
export function categorizeCustomWords(words: string[]): { short: string[]; medium: string[]; long: string[] } {
  const short: string[] = [];
  const medium: string[] = [];
  const long: string[] = [];

  for (const w of words) {
    if (w.length <= 4) {
      short.push(w);
    } else if (w.length <= 7) {
      medium.push(w);
    } else {
      long.push(w);
    }
  }

  // Fallbacks if one bucket is completely empty
  const fallback = words.length > 0 ? words : COMMON_WORDS.short;
  return {
    short: short.length > 0 ? short : fallback,
    medium: medium.length > 0 ? medium : fallback,
    long: long.length > 0 ? long : fallback
  };
}
