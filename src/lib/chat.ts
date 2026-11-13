// Mirrors the database check in messages_before_insert so the warning shows while typing.
// Phone = optional +, then 8+ digits separated by at most single spaces (dates with dashes don't match).
export function hasContactInfo(text: string) {
  return /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text) || /(^|[^\d])\+?\d(?: ?\d){7,}/.test(text);
}
