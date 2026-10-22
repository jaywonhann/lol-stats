import type { Lang } from "./i18n";

export const CT = {
  ko: {
    title: "커뮤니티",
    intro: "가입 없이 닉네임만으로 글과 댓글을 남길 수 있어요. 빌드 팁, 듀오 구인, 질문 모두 환영해요.",
    all: "전체",
    cats: { free: "자유", build: "빌드·팁", duo: "듀오 구함", question: "질문" } as Record<string, string>,
    write: "글쓰기",
    empty: "아직 글이 없어요. 첫 글을 남겨 보세요!",
    off: "지금은 커뮤니티를 쓸 수 없어요.",
    comments: "댓글",
    noComments: "첫 댓글을 남겨 보세요.",
    back: "← 목록",
    commentPh: "댓글을 입력하세요",
    rule: "광고·욕설·개인정보는 지워질 수 있어요.",
    form: {
      nick: "닉네임 (비우면 익명)", title: "제목", body: "내용", send: "등록", sending: "등록 중…",
      empty: "제목과 내용을 입력해 주세요.", blocked: "광고나 링크가 많은 글은 올릴 수 없어요.",
      slow: "너무 빨라요. 잠시 후 다시 시도해 주세요.", error: "등록에 실패했어요. 잠시 후 다시 시도해 주세요.",
      off: "지금은 글을 올릴 수 없어요.",
    },
  },
  en: {
    title: "Community",
    intro: "Post and comment with just a nickname, no sign-up. Build tips, duo requests and questions are all welcome.",
    all: "All",
    cats: { free: "General", build: "Builds & tips", duo: "Looking for duo", question: "Questions" } as Record<string, string>,
    write: "Write a post",
    empty: "No posts yet. Be the first!",
    off: "The community is unavailable right now.",
    comments: "Comments",
    noComments: "Be the first to comment.",
    back: "← Back",
    commentPh: "Write a comment",
    rule: "Ads, abuse and personal info may be removed.",
    form: {
      nick: "Nickname (blank = anonymous)", title: "Title", body: "Message", send: "Post", sending: "Posting…",
      empty: "Please enter a title and message.", blocked: "Posts with ads or many links aren't allowed.",
      slow: "Too fast. Please try again in a moment.", error: "Couldn't post. Please try again shortly.",
      off: "Posting is unavailable right now.",
    },
  },
} as const;
export const ct = (lang: Lang) => (lang === "ko" ? CT.ko : CT.en);
