// Mirrors the database check in messages_before_insert so the warning shows while typing.
export function hasContactInfo(text: string) {
  return /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text) || /\+?[0-9]{8,}/.test(text.replace(/[^0-9+]/g, ""));
}
