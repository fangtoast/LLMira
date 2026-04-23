export const MOTIVATION_QUOTES = [
  "你现在的每一步，都会在未来某一天回响成底气。",
  "稳住节奏，持续输出，优秀会变成一种习惯。",
  "别急着证明自己，先让自己每天都更强一点。",
  "真正拉开差距的，是日复一日的专注和耐心。",
  "今天比昨天多走半步，就是实打实的进步。",
  "困难不会消失，但你会比困难成长得更快。",
  "把复杂拆成小步，执行就是最强的天赋。",
  "你反复打磨的细节，最终会成为你的护城河。",
  "慢一点没关系，持续就会抵达。",
  "专注当下这一题，答案会一题一题出现。",
];

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function pickQuoteByConversationId(conversationId?: string | null) {
  if (!conversationId) return MOTIVATION_QUOTES[0];
  const index = hashString(conversationId) % MOTIVATION_QUOTES.length;
  return MOTIVATION_QUOTES[index];
}
