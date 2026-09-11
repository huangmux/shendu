export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export const MENTORS = [
  {
    id: "socrates",
    name: "苏格拉底",
    description: "哲学思辨导师",
    avatar: "🧙‍♂️",
    greeting: "用问题带你自己把这一章想清楚",
    systemPrompt:
      "你是苏格拉底式导师。用简短中文提问，引导学生自己从章节原文中发现答案。每次只问一个问题，适当引用原文短句。不要直接给完整结论，不要脱离本章内容。",
  },
  {
    id: "feynman",
    name: "费曼",
    description: "科学启蒙导师",
    avatar: "🔬",
    greeting: "用大白话把复杂概念讲明白",
    systemPrompt:
      "你是费曼式导师。用大白话和比喻解释本章概念，再请学生用自己的话讲回来。中文回复，每次只推进一个点，紧扣章节原文，避免堆砌术语。",
  },
  {
    id: "zhuge",
    name: "诸葛亮",
    description: "战略智慧导师",
    avatar: "📜",
    greeting: "把章节要点看成一盘棋来拆",
    systemPrompt:
      "你是战略导师诸葛亮。把本章内容拆成格局、取舍和落子顺序。中文回复，每次只追问一个决策点，结合原文谈利弊，不要空谈兵法套话。",
  },
] as const;

export type MentorId = (typeof MENTORS)[number]["id"];

const MAX_CHAPTER_CHARS = 8000;

export function getMentor(id: string) {
  return MENTORS.find((mentor) => mentor.id === id);
}

export function buildMentorMessages(input: {
  mentorId: string;
  chapterTitle: string;
  chapterText: string;
  messages: ChatMessage[];
}): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const mentor = getMentor(input.mentorId);
  const chapterText = (input.chapterText || "").slice(0, MAX_CHAPTER_CHARS);
  const system = `${mentor?.systemPrompt ?? "你是一位耐心的阅读导师，用中文陪学生精读本章。"}

你正在陪学生精读下面这一章。只依据本章内容提问和追问，不要脱离文本空讲。回复简洁，用中文。

章节标题：${input.chapterTitle}

章节正文：
${chapterText || "（正文为空，请根据标题引导学生）"}`;

  const history = input.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  if (history.length === 0) {
    return [
      { role: "system", content: system },
      { role: "user", content: "请开始这一章的学习。先用你的方式提出第一个问题，把我带进文本。" },
    ];
  }

  return [{ role: "system", content: system }, ...history];
}

function clip(text: string, max = 80) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

function pickQuote(text: string, index: number) {
  const parts = text
    .split(/[\n。！？!?；;]+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length >= 10 && part.length <= 180);

  if (parts.length === 0) {
    const fallback = text.replace(/\s+/g, " ").trim();
    return fallback ? clip(fallback, 120) : "这一段的核心观点";
  }

  return parts[index % parts.length];
}

export function generateMentorReply(input: {
  mentorId: string;
  chapterTitle: string;
  chapterText: string;
  messages: ChatMessage[];
}) {
  const { mentorId, chapterTitle, chapterText, messages } = input;
  const round = messages.filter((message) => message.role === "user").length;
  const quote = pickQuote(chapterText || chapterTitle, round);
  const lastUser =
    [...messages].reverse().find((message) => message.role === "user")
      ?.content ?? "";

  if (mentorId === "feynman") {
    if (round === 0) {
      return `咱们把「${chapterTitle}」讲给一个聪明的外行人听。原文里比较关键的一句是：\n\n「${quote}」\n\n你能不能用三句话、尽量少用术语，告诉我这是在干什么？卡住的词直接圈出来也行。`;
    }
    return `听起来你已经有画面了。假如对方追问「那具体是怎么做到的？」，结合「${quote}」，你准备怎么用大白话接下去？`;
  }

  if (mentorId === "zhuge") {
    if (round === 0) {
      return `这一章「${chapterTitle}」我看成一盘棋。先看这步：\n\n「${quote}」\n\n你觉得作者真正要破的是什么局——性能、成本、复杂度，还是别的？选一个，说说理由。`;
    }
    return `你的判断是「${clip(lastUser)}」。若按原文「${quote}」去落子，会先得到什么，又可能踩什么坑？`;
  }

  if (round === 0) {
    return `先别急着记结论。这一章是「${chapterTitle}」，文中有句话：\n\n「${quote}」\n\n你觉得作者为什么要先讲这个？用你自己的话试试看。`;
  }

  return `你刚才说「${clip(lastUser)}」。我们对照原文再看：\n\n「${quote}」\n\n这两处能对上吗？如果对不上，是原文在补充你的想法，还是你发现了原文没说清的地方？`;
}
